const API_BASE = "";



const POLICE_URL = "https://thaipoliceonline.go.th/";

const CASES = [
  {
    id: "transfer",
    title: "โอนเงินให้มิจฉาชีพไปแล้ว",
    sub: "รวมถึงเติมเงินหรือชำระค่าธรรมเนียมตามที่ถูกบอก",
    steps: [
      {
        id: "transfer-bank",
        urgent: true,
        text: "ติดต่อธนาคารที่คุณมีบัญชี เพื่อระงับการโอนและการถอนเงิน",
        detail:
          "ใช้เบอร์จากเว็บไซต์หรือแอปทางการของธนาคาร (เช่น เบอร์หลังบัตร) ธปท. กำหนดให้ธนาคารต้องมีช่องทางติดต่อเร่งด่วน (hotline) ทั้งในและนอกเวลาทำการ",
      },
      {
        id: "transfer-1441",
        urgent: true,
        text: "โทร 1441 (ศูนย์ AOC) และแจ้งความ เพื่อให้ธนาคารของบัญชีปลายทางระงับการใช้บัญชีนั้น",
        detail: "ทำทันที เร็วที่สุดเท่าที่ทำได้ เพราะถ้าแจ้งเร็ว โอกาสกักเงินไว้ได้จะสูงขึ้น",
      },
      {
        id: "transfer-police",
        text: "แจ้งความออนไลน์ หรือแจ้งที่สถานีตำรวจ",
        detail:
          "ถ้าธนาคารระงับให้ไม่ได้ ให้รวบรวมหลักฐานแจ้งความ และลงบันทึกประจำวันในท้องที่เกิดเหตุ ทั้งนี้ สถาบันการเงินต้องตรวจสอบข้อเท็จจริงก่อนจึงจะคืนเงินได้",
        link: { label: "เว็บแจ้งความออนไลน์ (thaipoliceonline.go.th)", url: POLICE_URL },
      },
      {
        id: "transfer-1213",
        text: "ขอคำปรึกษาเพิ่มเติมที่ศูนย์คุ้มครองผู้ใช้บริการทางการเงิน ธปท. โทร 1213",
      },
    ],
  },
  {
    id: "otp",
    title: "ให้ OTP รหัสผ่าน หรือข้อมูลบัตร/บัญชีไปแล้ว",
    sub: "รวมถึงถ่ายรูปบัตรประชาชนส่งให้",
    steps: [
      {
        id: "otp-pass",
        urgent: true,
        text: "เปลี่ยนรหัสผ่านของบัญชีที่เกี่ยวข้องทันที และเปิดการยืนยันตัวตนหลายขั้นตอนถ้ามี",
      },
      {
        id: "otp-review",
        text: "ตรวจประวัติการเข้าสู่ระบบย้อนหลัง และเปลี่ยนรหัสผ่านทุกบริการที่ใช้รหัสซ้ำกัน",
      },
      {
        id: "otp-bank",
        text: "ถ้าให้ข้อมูลบัตรหรือบัญชีธนาคาร ให้ติดต่อธนาคารเพื่ออายัดหรือเฝ้าระวังธุรกรรม",
      },
      {
        id: "otp-watch",
        urgent: true,
        text: "ถ้ายอดเงินลดลง หรือได้รับ OTP ทั้งที่ไม่ได้ทำรายการ ให้ติดต่อธนาคารทันที",
      },
    ],
  },
  {
    id: "app",
    title: "ติดตั้งแอปตามที่มิจฉาชีพบอก",
    sub: "เช่น แอปที่ให้ควบคุมเครื่องหรือแอปปลอมของหน่วยงาน",
    steps: [
      {
        id: "app-remove",
        text: "ลบแอปที่น่าสงสัย และสแกนเครื่องด้วยเครื่องมือที่เชื่อถือได้",
      },
      {
        id: "app-reset",
        text: "ถ้าพบแอปของมิจฉาชีพในเครื่อง ให้ทำ factory reset ถ้าทำเองไม่ได้ ให้ปิดเครื่องแล้วไปที่ศูนย์บริการโทรศัพท์มือถือที่ใช้อยู่",
        note: "หมายเหตุของระบบ: ก่อนรีเซ็ตเครื่อง ควรเก็บหลักฐานตามหัวข้อ \"เก็บหลักฐาน\" ด้านล่างก่อน",
      },
      {
        id: "app-watch",
        urgent: true,
        text: "ถ้ายอดเงินลดลง หรือได้รับ OTP ทั้งที่ไม่ได้ทำรายการ ให้ติดต่อธนาคารทันที",
        note: "หมายเหตุของระบบ: ถ้าเคยกรอกรหัสผ่านหรือ OTP ในเครื่องนั้นด้วย ให้เลือกข้อ \"ให้ OTP รหัสผ่าน หรือข้อมูลบัตร/บัญชีไปแล้ว\" เพิ่ม",
      },
    ],
  },
  {
    id: "link",
    title: "กดลิงก์หรือกรอกข้อมูลในเว็บที่ส่งมา",
    sub: "ลิงก์จาก SMS แชต หรืออีเมล",
    steps: [
      { id: "link-nodl", text: "ไม่ดาวน์โหลดไฟล์จากข้อความหรือเว็บนั้น" },
      { id: "link-pass", text: "เปลี่ยนรหัสผ่านและตรวจสอบบัญชีที่เกี่ยวข้อง" },
      {
        id: "link-report",
        text: "เก็บหลักฐาน และพิจารณาแจ้งเหตุหรือแจ้งความตามความเหมาะสม",
        note: "หมายเหตุของระบบ: ถ้าติดตั้งแอปไปด้วย ให้เลือกข้อ \"ติดตั้งแอปตามที่มิจฉาชีพบอก\" เพิ่ม",
      },
    ],
  },
  {
    id: "wrong",
    title: "มีคนบอกว่าโอนเงินผิดมา และขอให้โอนคืน",
    sub: "เงินเข้าบัญชีคุณโดยที่คุณไม่ได้คาดหมาย",
    steps: [
      {
        id: "wrong-dont",
        urgent: true,
        text: "อย่าโอนเงินคืนเอง ให้สอบถามธนาคารที่คุณมีบัญชีก่อน",
        detail: "อาจเป็นกลโกงที่ใช้บัญชีของคุณเป็นบัญชีม้าเพื่อโอนเงินผิดกฎหมาย",
      },
      {
        id: "wrong-confirm",
        text: "ให้ธนาคารตรวจสอบรายการ ถ้ายืนยันว่าเป็นการโอนผิดจริง จึงยินยอมให้ธนาคารโอนเงินกลับไปยังบัญชีต้นทาง",
      },
    ],
  },
  {
    id: "unsure",
    title: "ยังไม่ได้โอนหรือให้ข้อมูล แต่ไม่แน่ใจ",
    sub: "ได้รับการติดต่อและกำลังลังเล",
    steps: [
      {
        id: "unsure-ask",
        text: "ขอคำปรึกษาก่อนตัดสินใจทำตาม โทร 1213 (ศูนย์คุ้มครองผู้ใช้บริการทางการเงิน ธปท.) หรือ 1441",
      },
      {
        id: "unsure-callback",
        text: "วางสาย แล้วติดต่อหน่วยงานที่ถูกอ้างถึงด้วยเบอร์ที่คุณหาเอง",
      },
      {
        id: "unsure-nodata",
        text: "อย่าให้ข้อมูลส่วนตัวที่สำคัญ แม้ผู้ติดต่ออ้างว่าเป็นหน่วยงานราชการหรือสถาบันการเงิน",
      },
    ],
  },
];

const EVIDENCE = {
  items: [
    "ภาพหน้าจอข้อความหรือการสนทนา",
    "ลิงก์ เบอร์โทร ชื่อบัญชีหรือชื่อผู้ใช้ที่ติดต่อมา",
    "วันและเวลาที่เกิดเหตุ",
    "ถ้าโอนเงิน: ยอดเงิน ช่องทางที่ใช้โอน และสลิปการโอน (ถ้ามี)",
  ],
};

const selected = new Set();

const els = {
  authArea: document.getElementById("authArea"),
  cases: document.getElementById("rcCases"),
  hint: document.getElementById("rcHint"),
  urgent: document.getElementById("rcUrgent"),
  urgentList: document.getElementById("rcUrgentList"),
  results: document.getElementById("rcResults"),
  evidence: document.getElementById("rcEvidence"),
  evidenceList: document.getElementById("rcEvidenceList"),
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function stepItem(step) {
  const li = el("li", "rc-step");
  const main = el("div", "rc-step-main");
  const text = el("p", "rc-step-text");
  if (step.urgent) text.appendChild(el("span", "rc-badge", "ทันที"));
  text.appendChild(document.createTextNode(step.text));
  main.appendChild(text);
  if (step.detail) main.appendChild(el("p", "rc-step-detail", step.detail));
  if (step.link) {
    const p = el("p", "rc-step-detail");
    const a = el("a", "rc-link", step.link.label);
    a.href = step.link.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    p.appendChild(a);
    main.appendChild(p);
  }
  if (step.note) main.appendChild(el("p", "rc-step-note", step.note));
  li.appendChild(main);
  return li;
}

function renderCases() {
  els.cases.innerHTML = "";
  CASES.forEach((c) => {
    const lab = el("label", "rc-case" + (selected.has(c.id) ? " is-on" : ""));
    const cb = el("input");
    cb.type = "checkbox";
    cb.id = `case-${c.id}`;
    cb.checked = selected.has(c.id);
    cb.addEventListener("change", () => {
      if (cb.checked) selected.add(c.id);
      else selected.delete(c.id);
      render();
    });
    const text = el("span");
    text.appendChild(el("span", "rc-case-title", c.title));
    text.appendChild(el("span", "rc-case-sub", c.sub));
    lab.appendChild(cb);
    lab.appendChild(text);
    els.cases.appendChild(lab);
  });
}

function renderResults() {
  els.results.innerHTML = "";
  const chosen = CASES.filter((c) => selected.has(c.id));
  chosen.forEach((c) => {
    const sec = el("section", "panel rc-panel");
    sec.appendChild(el("h2", "panel-label", c.title));
    const ul = el("ol", "rc-steps");
    c.steps.forEach((s) => ul.appendChild(stepItem(s)));
    sec.appendChild(ul);
    els.results.appendChild(sec);
  });
}

function renderUrgent() {
  const chosen = CASES.filter((c) => selected.has(c.id));
  const seen = new Set();
  const urgent = [];
  chosen.forEach((c) =>
    c.steps.forEach((s) => {
      if (s.urgent && !seen.has(s.id)) {
        seen.add(s.id);
        urgent.push(s);
      }
    })
  );
  els.urgentList.innerHTML = "";
  if (!urgent.length) {
    els.urgent.classList.add("hidden");
    return;
  }
  urgent.forEach((s) => els.urgentList.appendChild(stepItem({ text: s.text })));
  els.urgent.classList.remove("hidden");
}

function renderEvidence() {
  const any = selected.size > 0 && !(selected.size === 1 && selected.has("unsure"));
  els.evidence.classList.toggle("hidden", !any);
  if (!any) return;
  els.evidenceList.innerHTML = "";
  EVIDENCE.items.forEach((t) => {
    els.evidenceList.appendChild(el("li", "rc-evi", t));
  });
}

function render() {
  const scrollY = window.scrollY;
  const focusId = document.activeElement && document.activeElement.id;
  renderCases();
  els.hint.classList.toggle("hidden", selected.size > 0);
  renderUrgent();
  renderResults();
  renderEvidence();
  if (focusId) {
    const back = document.getElementById(focusId);
    if (back) back.focus({ preventScroll: true });
  }
  window.scrollTo(0, scrollY);
}

// ---------- สรุปเหตุการณ์ (สร้างในเบราว์เซอร์ ไม่ส่งไปที่ใด) ----------
const FIELDS = [
  ["fWhen", "วันและเวลาที่เกิดเหตุ"],
  ["fChannel", "ช่องทางที่ถูกติดต่อ"],
  ["fContact", "เบอร์โทร/ชื่อบัญชีที่ติดต่อมา"],
  ["fAction", "สิ่งที่ทำไปแล้ว/ยอดเงิน"],
  ["fAccount", "บัญชีปลายทางที่โอนไป"],
  ["fStory", "เหตุการณ์โดยย่อ"],
];

function buildSummary() {
  const lines = ["สรุปเหตุการณ์ถูกหลอกลวง"];
  FIELDS.forEach(([id, label]) => {
    const v = document.getElementById(id).value.trim();
    if (v) lines.push(`${label}: ${v}`);
  });
  return lines.length > 1 ? lines.join("\n") : "";
}

function refreshSummary() {
  document.getElementById("fOutput").textContent = buildSummary();
  document.getElementById("fCopied").classList.add("hidden");
}

async function copySummary() {
  const text = buildSummary();
  if (!text) return;
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch (e) {
    const range = document.createRange();
    range.selectNodeContents(document.getElementById("fOutput"));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
  }
  const msg = document.getElementById("fCopied");
  msg.textContent = ok ? "คัดลอกแล้ว" : "คัดลอกไม่สำเร็จ ลองเลือกข้อความแล้วคัดลอกเอง";
  msg.classList.remove("hidden");
}

// ---------- ส่วนบัญชีใน nav (ไม่บังคับล็อกอิน) ----------
function renderAuthArea(username) {
  els.authArea.innerHTML = "";
  if (!username) {
    const a = el("a", "nav-link", "เข้าสู่ระบบ");
    a.href = "/login";
    els.authArea.appendChild(a);
    return;
  }
  els.authArea.appendChild(el("span", "username", username));
  const btn = el("button", "logout-btn", "ออกจากระบบ");
  btn.type = "button";
  btn.addEventListener("click", async () => {
    try { await fetch(`${API_BASE}/api/logout`, { method: "POST", credentials: "same-origin" }); } catch (e) {}
    window.location.href = "/login";
  });
  els.authArea.appendChild(btn);
}

async function loadAuth() {
  try {
    const res = await fetch(`${API_BASE}/api/me`, { credentials: "same-origin" });
    if (!res.ok) return renderAuthArea(null);
    const data = await res.json();
    renderAuthArea(data.username);
  } catch (e) {
    renderAuthArea(null);
  }
}

FIELDS.forEach(([id]) => document.getElementById(id).addEventListener("input", refreshSummary));
document.getElementById("fCopy").addEventListener("click", copySummary);

render();
loadAuth();
