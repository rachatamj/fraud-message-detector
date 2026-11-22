const API_BASE = "";

const EXAMPLE_MESSAGES = [
  "ยินดีด้วย คุณได้รับอนุมัติสินเชื่อ 50,000 บาท ไม่ต้องค้ำ โทรติดต่อเจ้าหน้าที่ 081-234-5678",
  "สล็อตแตกหนักรอบนี้ ฝาก 50 รับ 300 ถอนไม่อั้น ทักไลน์แอดมิน admin.cash99",
  "พัสดุของคุณจัดส่งสำเร็จแล้ว เช็กสถานะได้ที่ https://th.kerryexpress.com/track/123456789",
  "วันนี้เลิกงานแล้วไปกินชาบูกันไหม เจอกันร้านเดิมนะ",
];

const els = {
  statusBanner: document.getElementById("statusBanner"),
  messageInput: document.getElementById("messageInput"),
  chipList: document.getElementById("chipList"),
  submitBtn: document.getElementById("submitBtn"),
  clearBtn: document.getElementById("clearBtn"),
  emptyState: document.getElementById("emptyState"),
  resultState: document.getElementById("resultState"),
  recoveryLink: document.getElementById("recoveryLink"),
  loadingState: document.getElementById("loadingState"),
  riskStrip: document.getElementById("riskStrip"),
  riskLevel: document.getElementById("riskLevel"),
  riskAdvice: document.getElementById("riskAdvice"),
  signalsList: document.getElementById("signalsList"),
  actionsList: document.getElementById("actionsList"),
  actionsTitle: document.getElementById("actionsTitle"),
  meterFill: document.getElementById("meterFill"),
  modelStatusText: document.getElementById("modelStatusText"),
  authArea: document.getElementById("authArea"),
  checkStep: document.getElementById("checkStep"),
  resultStep: document.getElementById("resultStep"),
  backToCheckBtn: document.getElementById("backToCheckBtn"),
};

const RISK_KEYS = ["low", "caution", "high"];

function showBanner(message) {
  els.statusBanner.textContent = message;
  els.statusBanner.classList.remove("hidden");
}

function hideBanner() {
  els.statusBanner.classList.add("hidden");
}

function showCheckStep() {
  els.checkStep.classList.remove("hidden");
  els.resultStep.classList.add("hidden");
}

function showResultStep() {
  els.checkStep.classList.add("hidden");
  els.resultStep.classList.remove("hidden");
}

function renderExampleChips() {
  EXAMPLE_MESSAGES.forEach((msg) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = msg.length > 36 ? msg.slice(0, 36) + "…" : msg;
    chip.title = msg;
    chip.addEventListener("click", () => {
      els.messageInput.value = msg;
      els.messageInput.focus();
    });
    els.chipList.appendChild(chip);
  });
}

async function checkAuth() {
  try {
    const res = await fetch(`${API_BASE}/api/me`, { credentials: "same-origin" });
    if (!res.ok) {
      window.location.href = "/login";
      return;
    }
    const data = await res.json();
    renderAuthArea(data.username);
  } catch (err) {
    window.location.href = "/login";
  }
}

function renderAuthArea(username) {
  els.authArea.innerHTML = "";

  const nameSpan = document.createElement("span");
  nameSpan.className = "username";
  nameSpan.textContent = username;

  const logoutBtn = document.createElement("button");
  logoutBtn.type = "button";
  logoutBtn.className = "logout-btn";
  logoutBtn.textContent = "ออกจากระบบ";
  logoutBtn.addEventListener("click", handleLogout);

  els.authArea.appendChild(nameSpan);
  els.authArea.appendChild(logoutBtn);
}

async function handleLogout() {
  try {
    await fetch(`${API_BASE}/api/logout`, { method: "POST", credentials: "same-origin" });
  } catch (err) {

  }
  window.location.href = "/login";
}

async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json();

    if (!data.model_loaded) {
      els.modelStatusText.textContent = "โมเดล: ไม่พร้อมใช้งาน";
      showBanner(
        data.error ||
          "โมเดลยังไม่พร้อมใช้งาน กรุณาตรวจสอบ path โมเดลในไฟล์ config.py ของ backend"
      );
      els.submitBtn.disabled = true;
      return;
    }

    els.modelStatusText.textContent = `โมเดล: พร้อมใช้งาน (${data.device})`;
    hideBanner();
    els.submitBtn.disabled = false;
  } catch (err) {
    els.modelStatusText.textContent = "โมเดล: เชื่อมต่อ backend ไม่ได้";
    showBanner(
      "เชื่อมต่อกับ backend ไม่ได้ กรุณาตรวจสอบว่าได้รันคำสั่ง uvicorn main:app --reload แล้ว"
    );
    els.submitBtn.disabled = true;
  }
}

function setLoading(isLoading) {
  els.loadingState.classList.toggle("hidden", !isLoading);
  if (isLoading) {
    els.emptyState.classList.add("hidden");
    els.resultState.classList.add("hidden");
  }
}

function renderResult(data) {

  const riskKey = RISK_KEYS.includes(data.risk_key) ? data.risk_key : "low";

  els.riskStrip.classList.remove(...RISK_KEYS.map((k) => `is-${k}`));
  els.riskStrip.classList.add(`is-${riskKey}`);
  els.riskLevel.textContent = data.risk_level;

  els.riskAdvice.classList.remove(...RISK_KEYS.map((k) => `is-${k}`));
  els.riskAdvice.classList.add(`is-${riskKey}`);
  els.riskAdvice.textContent = data.risk_advice;
  // ผลที่ไม่ใช่ความเสี่ยงต่ำ: แสดงลิงก์ไปหน้า "รับมือเมื่อถูกหลอก" เผื่อผู้ใช้ทำตามข้อความไปแล้ว
  els.recoveryLink.classList.toggle("hidden", riskKey === "low");

  els.meterFill.classList.remove(...RISK_KEYS.map((k) => `is-${k}`));
  els.meterFill.classList.add(`is-${riskKey}`);
  els.meterFill.style.width = `${Math.min(data.spam_probability, 100)}%`;

  if (data.signal_details && data.signal_details.length) {
    renderSignalDetails(els.signalsList, data.signal_details);
  } else {
    renderList(els.signalsList, data.signals);
  }
  renderList(els.actionsList, data.recommended_actions);
  // ระดับควรระมัดระวัง: บอกให้ชัดว่าต้องตรวจสอบเองก่อน (ปรับตามผลทดสอบกับผู้ใช้)
  if (els.actionsTitle) {
    els.actionsTitle.textContent = riskKey === "caution"
      ? "ตรวจสอบตามนี้ก่อนทำตามข้อความ"
      : "คำแนะนำที่ควรทำ";
  }

  els.loadingState.classList.add("hidden");
  els.emptyState.classList.add("hidden");
  els.resultState.classList.remove("hidden");
}

function renderSignalDetails(ulElement, items) {
  ulElement.innerHTML = "";
  items.forEach((it) => {
    const li = document.createElement("li");
    const main = document.createElement("span");
    main.textContent = it.text;
    li.appendChild(main);

    if (it.matched && it.matched.length) {
      const row = document.createElement("div");
      row.className = "signal-matched";
      row.appendChild(document.createTextNode("พบในข้อความ: "));
      it.matched.forEach((w) => {
        const tag = document.createElement("span");
        tag.className = "kw-chip";
        tag.textContent = w;
        row.appendChild(tag);
      });
      li.appendChild(row);
    }

    if (it.source_name) {
      const src = document.createElement("div");
      src.className = "signal-source";
      src.appendChild(document.createTextNode("ที่มา: "));
      if (it.source_url && it.source_url.startsWith("https://")) {
        const a = document.createElement("a");
        a.href = it.source_url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = it.source_name;
        src.appendChild(a);
      } else {
        src.appendChild(document.createTextNode(it.source_name));
      }
      li.appendChild(src);
    }
    ulElement.appendChild(li);
  });
}

function renderList(ulElement, items) {
  ulElement.innerHTML = "";
  (items || []).forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    ulElement.appendChild(li);
  });
}

async function handleSubmit() {
  const text = els.messageInput.value.trim();
  if (!text) {
    showBanner("กรุณากรอกข้อความก่อนกดตรวจสอบ");
    return;
  }
  hideBanner();
  showResultStep();
  setLoading(true);

  try {
    const res = await fetch(`${API_BASE}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ text }),
    });

    if (res.status === 401) {

      window.location.href = "/login";
      return;
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.detail || `เกิดข้อผิดพลาด (HTTP ${res.status})`);
    }

    const data = await res.json();
    renderResult(data);
  } catch (err) {
    setLoading(false);
    els.emptyState.classList.remove("hidden");
    showBanner(err.message || "เกิดข้อผิดพลาดระหว่างการตรวจสอบข้อความ");
    showCheckStep();
  }
}

function handleClear() {
  els.messageInput.value = "";
  els.resultState.classList.add("hidden");
  els.emptyState.classList.remove("hidden");
  hideBanner();
}

renderExampleChips();
checkAuth();
checkHealth();
els.submitBtn.addEventListener("click", handleSubmit);
els.clearBtn.addEventListener("click", handleClear);
els.backToCheckBtn.addEventListener("click", () => {
  handleClear();
  showCheckStep();
});
