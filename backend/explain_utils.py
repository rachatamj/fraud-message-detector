# -*- coding: utf-8 -*-
"""
explain_utils.py
หาคำที่ทำให้โมเดลตัดสินว่า "ข้อความหลอกลวง" ด้วยวิธี Occlusion
(ตัดคำออกทีละคำ แล้วดูว่าความน่าจะเป็นหลอกลวงลดลงเท่าไหร่)
ไม่แตะต้อง ไม่ฝึกใหม่ และไม่เปลี่ยนโมเดล ใช้โมเดลเดิมที่โหลดไว้แล้ว
"""
import re

try:
    import torch
except Exception:          # ให้ import ไฟล์นี้ได้แม้ยังไม่มี torch (ตอนทดสอบ)
    torch = None

try:
    from pythainlp.tokenize import word_tokenize
except Exception:
    word_tokenize = None

_MAX_UNITS = 60      # จำกัดจำนวนชิ้นที่ลองตัด กันข้อความยาวช้าเกินไป
_BATCH = 16


def _split_words(text: str) -> list[str]:
    """แบ่งข้อความเป็นคำ ต่อกลับด้วย ''.join() ได้ข้อความเดิมเป๊ะ"""
    if word_tokenize is not None:
        words = word_tokenize(text, engine="newmm", keep_whitespace=True)
    else:  # ไม่มี pythainlp: แบ่งตามช่องว่าง/เครื่องหมายเป็นวลีใหญ่ (หยาบกว่า) ควรติดตั้ง pythainlp
        words = [w for w in re.split(r"(\s+|[,;!?()\"'])", text) if w]
    return [w for w in words if w != ""]


def _group(words: list[str]) -> list[str]:
    """ถ้าคำเยอะเกิน รวมคำติดกันเป็นชิ้นใหญ่ขึ้น"""
    real = [w for w in words if w.strip()]
    if len(real) <= _MAX_UNITS:
        return words
    size = -(-len(real) // _MAX_UNITS)  # ปัดขึ้น
    out, buf, n = [], "", 0
    for w in words:
        buf += w
        if w.strip():
            n += 1
        if n == size:
            out.append(buf); buf, n = "", 0
    if buf:
        out.append(buf)
    return out


def _scam_percent(texts, model, tokenizer, device, max_length):
    """คืนรายการ % ที่โมเดลให้ว่าเป็นข้อความหลอกลวง (label สุดท้าย) ของแต่ละข้อความ"""
    res = []
    for i in range(0, len(texts), _BATCH):
        chunk = texts[i:i + _BATCH]
        inputs = tokenizer(chunk, return_tensors="pt", truncation=True,
                           padding=True, max_length=max_length).to(device)
        with torch.no_grad():
            probs = torch.softmax(model(**inputs).logits, dim=-1)
        res += (probs[:, -1] * 100).cpu().tolist()
    return res


def explain_words(text, model, tokenizer, device, max_length=256,
                  top_k=4, min_drop=3.0):
    """
    คืนรายการคำที่ดันให้โมเดลคิดว่าหลอกลวงมากที่สุด เรียงจากมากไปน้อย
    [{"word": "อนุมัติสินเชื่อ", "drop": 31.2}, ...]
    drop = ความน่าจะเป็นหลอกลวงที่ลดลง (จุดเปอร์เซ็นต์) เมื่อตัดคำนี้ออก
    คำที่ drop < min_drop ไม่เอา (ถือว่าไม่มีผลชัด) ถ้าไม่มีคำเด่น คืน []
    """
    words = _group(_split_words(text))
    idx = [i for i, w in enumerate(words) if w.strip()]
    if len(idx) < 2:
        return []
    variants = ["".join(w for j, w in enumerate(words) if j != i) for i in idx]
    probs = _scam_percent([text] + variants, model, tokenizer, device, max_length)
    base, rest = probs[0], probs[1:]
    scored = {}
    for i, p in zip(idx, rest):
        drop = base - p
        if drop >= min_drop:
            w = words[i].strip()
            scored[w] = max(drop, scored.get(w, 0))
    top = sorted(scored.items(), key=lambda x: -x[1])[:top_k]
    return [{"word": w, "drop": round(d, 1)} for w, d in top]
