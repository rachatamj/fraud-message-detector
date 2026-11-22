import os
import re
try:
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
    IMPORT_ERROR = None
except Exception as e:
    IMPORT_ERROR = e


def load_model(model_path: str):
    if not os.path.isdir(model_path):
        return (
            None, None, None,
            f"ไม่พบโฟลเดอร์โมเดลที่ '{model_path}' "
            "กรุณาตรวจสอบว่า Path ถูกต้อง และมีไฟล์โมเดล "
            "(config.json, pytorch_model.bin หรือ model.safetensors, "
            "tokenizer.json ฯลฯ) อยู่ในโฟลเดอร์นี้จริง"
        )
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_path)
        model = AutoModelForSequenceClassification.from_pretrained(model_path)
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        model.to(device)
        model.eval()
        return (model, tokenizer, device, None)
    except Exception as e:
        return (None, None, None, f'โหลดโมเดลไม่สำเร็จ: {e}')


def predict(text: str, model, tokenizer, device, labels, max_length: int=512):
    inputs = tokenizer(text, return_tensors='pt', truncation=True, padding=True, max_length=max_length).to(device)
    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        probs = torch.softmax(logits, dim=-1).squeeze().cpu().tolist()
    if isinstance(probs, float):
        probs = [probs]
    pred_idx = int(torch.argmax(logits, dim=-1).item())
    if pred_idx < len(labels):
        pred_label = labels[pred_idx]
    else:
        pred_label = f'class_{pred_idx}'
    confidence = probs[pred_idx] * 100
    detail = []
    for i, p in enumerate(probs):
        name = labels[i] if i < len(labels) else f'class_{i}'
        detail.append({'label': name, 'percentage': round(p * 100, 2)})
    return (pred_label, round(confidence, 2), detail)


def get_spam_probability(detail: list, labels: list) -> float:
    for item in detail:
        if item['label'] == 'ข้อความหลอกลวง':
            return item['percentage']
    fallback_label = labels[-1] if labels else None
    for item in detail:
        if item['label'] == fallback_label:
            return item['percentage']
    return 0.0


def get_risk_assessment(spam_probability: float):
    if spam_probability > 80:
        return ('high', 'ความเสี่ยงสูง (ข้อความหลอกลวง)', 'ข้อความนี้มีแนวโน้มเป็นข้อความหลอกลวงสูง ห้ามกดลิงก์ ห้ามเพิ่มเพื่อน หรือให้ข้อมูลส่วนตัวเด็ดขาด')
    elif spam_probability >= 50:
        return ('caution', 'ควรระมัดระวัง (ยังสรุปไม่ได้ ตรวจสอบก่อน)',
                'ระบบยังสรุปไม่ได้ว่าเป็นข้อความหลอกลวง แต่พบลักษณะบางอย่างที่คล้ายกัน '
                'อย่าเพิ่งกดลิงก์ โอนเงิน หรือให้ข้อมูลใด ๆ จนกว่าจะตรวจสอบตามคำแนะนำด้านล่าง')
    else:
        return ('low', 'ความเสี่ยงต่ำ (ข้อความทั่วไป)', 'ไม่พบความเสี่ยงที่เด่นชัดในข้อความนี้')
    
_URL_PATTERN = re.compile('https?://|www\\.|bit\\.ly|\\.co(m|\\.th)\\b', re.IGNORECASE)
_PHONE_PATTERN = re.compile('0\\d{1,2}[-\\s]?\\d{3}[-\\s]?\\d{4}')
_LINE_KEYWORDS = ['ไลน์ไอดี', 'แอดไลน์', 'ทักไลน์', 'ทักแชท', 'id line', 'line id']
_LOAN_KEYWORDS = ['สินเชื่อ', 'เงินกู้', 'อนุมัติวงเงิน', 'อนุมัติสินเชื่อ', 'เงินด่วน']
_GAMBLE_KEYWORDS = ['สล็อต', 'พนัน', 'บาคาร่า', 'หวยออนไลน์', 'คาสิโน', 'แทงบอล']
_URGENCY_KEYWORDS = ['ด่วน', 'ทันที', 'วันนี้เท่านั้น', 'รีบ', 'ก่อนใคร']
_MIN_SIGNAL_TEXT_LENGTH = 15


# แหล่งอ้างอิงของแต่ละสัญญาณ (หน่วยงาน/สื่อ ปี และลิงก์ที่ตรวจเปิดอ่านแล้ว)
# หมายเหตุ: กฎตรวจจับ (รายการคำ/regex ด้านบน) ผู้พัฒนากำหนดเอง แหล่งอ้างอิงใช้อธิบายเหตุผลว่าทำไมรูปแบบนั้นน่าสงสัย
_SOURCES = {
    'link': {
        'name': 'ธนาคารกสิกรไทย (2566) ไม่ส่ง SMS แนบลิงก์',
        'url': 'https://thestandard.co/breaking-kbank-stopped-sending-sms/',
    },
    'phone': {
        'name': 'ธนาคารกสิกรไทย (2569) สติไฟต์เตอร์',
        'url': 'https://www.kasikornbank.com/th/personal/digital-banking/kbankcyberrisk/pages/scamcall.aspx',
    },
    'line': {
        'name': 'ธนาคารกสิกรไทย (2569) สติไฟต์เตอร์',
        'url': 'https://www.kasikornbank.com/th/personal/digital-banking/kbankcyberrisk/pages/scamcall.aspx',
    },
    'loan': {
        'name': 'กรมพัฒนาธุรกิจการค้า (2566) ผ่านอินโฟเควสท์',
        'url': 'https://www.infoquest.co.th/?p=298025',
    },
    'gamble': {
        'name': 'ผู้จัดการออนไลน์ (2568) กฎหมายการพนันออนไลน์',
        'url': 'https://mgronline.com/cyberbiz/detail/9680000001834',
    },
    'urgency': {
        'name': 'Thai PBS Verify (2569)',
        'url': 'https://www.thaipbs.or.th/verify/article/content/11577',
    },
}


def _dedupe(words: list) -> list:
    """ตัดคำที่เป็นส่วนหนึ่งของคำที่ยาวกว่า เช่น 'สินเชื่อ' ใน 'อนุมัติสินเชื่อ'"""
    return [w for w in words if not any(w != o and w in o for o in words)]


def _token_at(text: str, pos: int) -> str:
    """ดึงคำ/ลิงก์ทั้งก้อน (คั่นด้วยช่องว่าง) ที่ตำแหน่ง pos อยู่"""
    a, b = pos, pos
    while a > 0 and not text[a - 1].isspace():
        a -= 1
    while b < len(text) and not text[b].isspace():
        b += 1
    return text[a:b]


def _signal(text: str, matched: list, key: str | None) -> dict:
    src = _SOURCES.get(key) if key else None
    return {
        'text': text,
        'matched': matched,
        'source_name': src['name'] if src else None,
        'source_url': src['url'] if src else None,
    }


def generate_signal_details(text: str) -> list[dict]:
    out: list[dict] = []
    m = _URL_PATTERN.search(text)
    if m:
        out.append(_signal('ข้อความมีลิงก์แนบมาด้วย ควรระวังการคลิกลิงก์ที่ไม่รู้จักแหล่งที่มา', [_token_at(text, m.start())[:60]], 'link'))
    pm = _PHONE_PATTERN.search(text)
    if pm or 'โทร' in text:
        out.append(_signal('ข้อความให้ติดต่อกลับทางโทรศัพท์ ควรติดต่อหน่วยงานตามช่องทางที่ทางการประกาศเอง ไม่ใช่เบอร์ที่มากับข้อความ',
                           [pm.group(0)] if pm else ['โทร'], 'phone'))
    low = text.lower()
    hit = [k for k in _LINE_KEYWORDS if k in low]
    if hit:
        out.append(_signal('ชักชวนให้ติดต่อผ่านไลน์ส่วนตัว แทนช่องทางทางการของหน่วยงาน', _dedupe(hit), 'line'))
    hit = [k for k in _LOAN_KEYWORDS if k in text]
    if hit:
        out.append(_signal('กล่าวถึงสินเชื่อหรือเงินกู้ ซึ่งมิจฉาชีพมักให้โอนค่าธรรมเนียมก่อนรับเงินกู้ หรือขอรูปบัตรประชาชน', _dedupe(hit), 'loan'))
    hit = [k for k in _GAMBLE_KEYWORDS if k in text]
    if hit:
        out.append(_signal('มีคำที่เกี่ยวข้องกับการพนันออนไลน์ ซึ่งผิดกฎหมายในประเทศไทย', _dedupe(hit), 'gamble'))
    hit = [k for k in _URGENCY_KEYWORDS if k in text]
    if hit:
        out.append(_signal('ใช้ถ้อยคำเร่งรัดให้ตัดสินใจอย่างรวดเร็ว ซึ่งเป็นเทคนิคกดดันที่พบได้บ่อย', _dedupe(hit), 'urgency'))
    if len(text.strip()) < _MIN_SIGNAL_TEXT_LENGTH:
        out.append(_signal('ข้อความสั้นเกินไปที่จะยืนยันเจตนาของผู้ส่งได้อย่างชัดเจน', [], None))
    if not out:
        out.append(_signal('ไม่พบรูปแบบคำที่เข้าข่ายหลอกลวงอย่างชัดเจนในข้อความนี้', [], None))
    return out[:4]


def generate_signals(text: str) -> list[str]:
    """เวอร์ชันข้อความล้วน (คงไว้เพื่อให้ส่วนอื่นและเทสต์เดิมใช้ต่อได้)"""
    return [d['text'] for d in generate_signal_details(text)]


# ---------------------------------------------------------------------------
# คำแนะนำตามเนื้อหาข้อความ
# เดิมคำแนะนำขึ้นกับระดับความเสี่ยงอย่างเดียว ทุกข้อความในระดับเดียวกันจึงได้คำแนะนำเหมือนกัน
# ตอนนี้ตรวจว่าข้อความ "ขออะไร" หรือ "อ้างอะไร" แล้วเลือกคำแนะนำให้ตรงเรื่อง
# ระดับความเสี่ยงยังมาจากแบบจำลองเหมือนเดิม ส่วนนี้เปลี่ยนแค่ถ้อยคำคำแนะนำ
# ---------------------------------------------------------------------------
_TOPIC_KEYWORDS = {
    'otp': ['otp', 'รหัสผ่าน', 'รหัสยืนยัน', 'รหัส pin', 'pin code', 'รหัสพิน'],
    'transfer': ['โอนเงิน', 'โอนมา', 'โอนค่า', 'ค่าธรรมเนียม', 'มัดจำ', 'ชำระเงิน', 'ชำระค่า', 'จ่ายค่า', 'วางเงิน'],
    'authority': ['บัญชีถูกระงับ', 'ระงับบัญชี', 'ระงับการใช้งาน', 'อายัด', 'ยืนยันตัวตน', 'อัปเดตข้อมูล', 'อัพเดทข้อมูล',
                  'กรมสรรพากร', 'ภาษีคืน', 'การไฟฟ้า', 'ค่าไฟ', 'ตำรวจ', 'dsi', 'หมายจับ', 'ประกันสังคม', 'ธนาคาร'],
    'parcel': ['พัสดุ', 'ขนส่ง', 'ไปรษณีย์', 'ค่าส่ง', 'ศุลกากร', 'kerry', 'flash express'],
    'prize': ['ได้รับรางวัล', 'ถูกรางวัล', 'รับรางวัล', 'ผู้โชคดี', 'รับเงินคืน', 'แจกฟรี', 'ฟรีเครดิต', 'เครดิตฟรี'],
    'job': ['งานออนไลน์', 'รายได้เสริม', 'ทำงานที่บ้าน', 'รายได้วันละ', 'กดไลก์', 'กดไลค์', 'รับสมัครงาน'],
}

# ลำดับความสำคัญ: เรื่องที่ทำให้เสียเงินหรือเสียบัญชีทันทีขึ้นก่อน
_TOPIC_ORDER = ['otp', 'transfer', 'link', 'authority', 'line', 'phone', 'loan', 'parcel', 'prize', 'job', 'gamble', 'urgency']

# (ระดับสูง, ระดับควรระมัดระวัง, ระดับต่ำแต่พบเรื่องนี้)  None = ไม่ต้องแสดงในระดับนั้น
_TOPIC_ACTIONS = {
    'otp': ('ข้อความนี้ขอรหัส OTP หรือรหัสผ่าน ห้ามให้กับใครเด็ดขาด ธนาคารและหน่วยงานไม่ขอรหัสเหล่านี้ทางข้อความ',
            'ข้อความนี้พูดถึงรหัส OTP หรือรหัสผ่าน ห้ามบอกรหัสให้ใคร ถ้ามีคนขอ ให้ถือว่าเป็นมิจฉาชีพ',
            'อย่าบอกรหัส OTP หรือรหัสผ่านให้ใคร แม้ข้อความจะดูน่าเชื่อถือ'),
    'transfer': ('ข้อความนี้ขอให้โอนเงินหรือจ่ายค่าธรรมเนียม ห้ามโอน ถ้าโอนไปแล้ว ให้โทรแจ้งธนาคารของคุณทันทีเพื่อขออายัด',
                 'ข้อความนี้ขอให้จ่ายเงิน อย่าเพิ่งโอนจนกว่าจะยืนยันกับผู้รับเงินผ่านช่องทางที่คุณรู้จักเอง',
                 'ก่อนโอนเงินตามข้อความ ให้ยืนยันกับผู้รับผ่านช่องทางที่คุณรู้จักเองก่อน'),
    'link': ('ห้ามกดลิงก์ในข้อความ ลิงก์อาจพาไปเว็บปลอมที่ขโมยรหัสหรือติดตั้งแอปควบคุมเครื่อง',
             'อย่ากดลิงก์ในข้อความ ถ้าต้องการตรวจสอบ ให้พิมพ์ชื่อเว็บไซต์ทางการเองหรือเข้าผ่านแอปทางการ',
             'ถ้าจะเปิดลิงก์ ตรวจให้แน่ใจว่าเป็นเว็บไซต์ทางการของผู้ส่งจริง'),
    'authority': ('ข้อความอ้างเป็นธนาคารหรือหน่วยงาน ห้ามทำตาม ให้ติดต่อหน่วยงานนั้นเองผ่านเบอร์บนเว็บไซต์ทางการหรือหลังบัตร',
                  'ข้อความอ้างเป็นธนาคารหรือหน่วยงาน ให้ตรวจสอบโดยติดต่อหน่วยงานนั้นเองผ่านเบอร์บนเว็บไซต์ทางการหรือหลังบัตร',
                  None),
    'line': ('ห้ามเพิ่มเพื่อนหรือทักไลน์ตามที่ข้อความบอก หน่วยงานจริงไม่ติดต่อผ่านไลน์ส่วนตัว',
             'อย่าเพิ่มเพื่อนไลน์ตามข้อความ ถ้าอ้างเป็นหน่วยงาน ให้หาบัญชีทางการที่มีเครื่องหมายยืนยันเอง',
             None),
    'phone': ('ห้ามโทรกลับเบอร์ในข้อความ ถ้าต้องการติดต่อ ให้ใช้เบอร์จากเว็บไซต์ทางการเท่านั้น',
              'อย่าโทรกลับเบอร์ในข้อความ ให้ค้นเบอร์ทางการของผู้ที่อ้างถึงแล้วโทรเอง',
              None),
    'loan': ('สินเชื่อจริงไม่เก็บเงินก่อนอนุมัติ ห้ามโอนค่าธรรมเนียมหรือส่งรูปบัตรประชาชนให้',
             'ถ้าสนใจสินเชื่อ ให้ติดต่อธนาคารหรือผู้ให้บริการที่ได้รับอนุญาตเอง และอย่าจ่ายเงินก่อนได้รับเงินกู้',
             None),
    'parcel': ('ข้อความอ้างเรื่องพัสดุ ห้ามจ่ายค่าส่งหรือกรอกข้อมูลตามลิงก์ ให้ตรวจเลขพัสดุในแอปหรือเว็บไซต์ของบริษัทขนส่งเอง',
               'ให้ตรวจสถานะพัสดุจากแอปหรือเว็บไซต์ของบริษัทขนส่งเอง แทนการทำตามข้อความ',
               None),
    'prize': ('รางวัลหรือเงินคืนที่ต้องจ่ายเงินหรือให้ข้อมูลก่อนรับ เป็นกลโกงที่พบบ่อย อย่าทำตาม',
              'ถ้าไม่ได้ร่วมกิจกรรมใดไว้ ให้ระวังข้อความแจ้งรางวัล และตรวจกับผู้จัดกิจกรรมผ่านช่องทางทางการ',
              None),
    'job': ('งานที่ให้จ่ายเงินก่อนหรือทำภารกิจแลกค่าตอบแทน มักเป็นกลโกง อย่าโอนเงินเพื่อรับงาน',
            'ตรวจสอบบริษัทที่รับสมัครงานก่อน และอย่าจ่ายเงินหรือโอนเงินเพื่อเริ่มงาน',
            None),
    'gamble': ('การพนันออนไลน์ผิดกฎหมาย อย่าสมัครหรือโอนเงินเข้าเว็บที่ส่งมา',
               'การพนันออนไลน์ผิดกฎหมาย ไม่ควรสมัครหรือโอนเงินตามข้อความ',
               None),
    'urgency': ('ข้อความเร่งให้รีบทำ ให้หยุดก่อน มิจฉาชีพมักกดดันให้ตัดสินใจโดยไม่มีเวลาคิด',
                'ข้อความเร่งให้รีบทำ ใช้เวลาตรวจสอบก่อน เรื่องจริงมักรอได้',
                None),
}

# คำแนะนำทั่วไป ใช้เติมเมื่อข้อความไม่เข้าเรื่องใดเลย หรือได้คำแนะนำเฉพาะไม่ครบ
_GENERIC_ACTIONS = {
    'high': ['ห้ามกดลิงก์หรือเพิ่มเพื่อนตามที่ข้อความแนะนำเด็ดขาด',
             'ห้ามให้ข้อมูลส่วนตัว รหัสผ่าน หรือรหัส OTP กับผู้ส่ง',
             'หากอ้างเป็นหน่วยงาน ให้ติดต่อกลับผ่านช่องทางทางการเท่านั้น'],
    'caution': ['ข้อความขอให้โอนเงิน ให้รหัส OTP หรือกดลิงก์หรือไม่ ถ้าใช่ ให้ถือว่าเสี่ยงสูงและหยุดทันที',
                'ถ้าอ้างว่าเป็นคนรู้จัก ให้โทรถามเจ้าตัวด้วยเบอร์ที่คุณมีอยู่เดิม ไม่ใช่เบอร์ในข้อความ',
                'ถ้าอ้างว่าเป็นหน่วยงาน ให้เข้าแอปหรือเว็บไซต์ทางการด้วยตนเอง ไม่กดลิงก์ในข้อความ'],
    'low': ['ยังไม่พบความเสี่ยงที่ชัดเจน แต่ควรระวังหากถูกขอข้อมูลส่วนตัวเพิ่มเติม'],
}
_MAX_ACTIONS = 4
_MIN_ACTIONS = {'high': 3, 'caution': 3, 'low': 1}


def detect_message_topics(text: str) -> list[str]:
    low = text.lower()
    found = set()
    for key, words in _TOPIC_KEYWORDS.items():
        if any(w in low for w in words):
            found.add(key)
    if _URL_PATTERN.search(text):
        found.add('link')
    if _PHONE_PATTERN.search(text) or 'โทร' in text:
        found.add('phone')
    if any(k in low for k in _LINE_KEYWORDS):
        found.add('line')
    if any(k in text for k in _LOAN_KEYWORDS):
        found.add('loan')
    if any(k in text for k in _GAMBLE_KEYWORDS):
        found.add('gamble')
    if any(k in text for k in _URGENCY_KEYWORDS):
        found.add('urgency')
    return [k for k in _TOPIC_ORDER if k in found]


def get_recommended_actions(risk_key: str, text: str | None = None) -> list[str]:
    level = risk_key if risk_key in _GENERIC_ACTIONS else 'low'
    idx = {'high': 0, 'caution': 1, 'low': 2}[level]
    actions: list[str] = []
    if text:
        for topic in detect_message_topics(text):
            msg = _TOPIC_ACTIONS[topic][idx]
            if msg and msg not in actions:
                actions.append(msg)
    if level == 'low':
        actions = actions[:2] + _GENERIC_ACTIONS['low']
        return actions
    actions = actions[:_MAX_ACTIONS]
    for g in _GENERIC_ACTIONS[level]:
        if len(actions) >= _MIN_ACTIONS[level]:
            break
        if g not in actions:
            actions.append(g)
    return actions
