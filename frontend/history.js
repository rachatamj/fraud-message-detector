const API_BASE = "";

const els = {
  statusBanner: document.getElementById("statusBanner"),
  historyCount: document.getElementById("historyCount"),
  clearAllBtn: document.getElementById("clearAllBtn"),
  historyEmpty: document.getElementById("historyEmpty"),
  historyLoading: document.getElementById("historyLoading"),
  historyList: document.getElementById("historyList"),
  authArea: document.getElementById("authArea"),
};

const RISK_KEYS = ["low", "caution", "high"];

function showBanner(message) {
  els.statusBanner.textContent = message;
  els.statusBanner.classList.remove("hidden");
}

function hideBanner() {
  els.statusBanner.classList.add("hidden");
}

function formatTime(isoString) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
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

async function handleLogout() {
  try {
    await fetch(`${API_BASE}/api/logout`, { method: "POST", credentials: "same-origin" });
  } catch (err) {

  }
  window.location.href = "/login";
}

function renderHistory(items) {
  els.historyList.innerHTML = "";
  els.historyLoading.classList.add("hidden");

  const isEmpty = items.length === 0;
  els.historyEmpty.classList.toggle("hidden", !isEmpty);
  els.clearAllBtn.classList.toggle("hidden", isEmpty);
  els.historyCount.textContent = isEmpty ? "" : `ทั้งหมด ${items.length} รายการ`;

  items.forEach((item) => {
    const riskKey = RISK_KEYS.includes(item.risk_key) ? item.risk_key : "low";

    const row = document.createElement("article");
    row.className = `history-item is-${riskKey}`;

    const body = document.createElement("div");
    body.className = "history-body";

    const meta = document.createElement("div");
    meta.className = "history-meta";

    const risk = document.createElement("span");
    risk.className = "history-risk";
    risk.textContent = item.risk_level;

    const time = document.createElement("span");
    time.className = "history-time";
    time.textContent = formatTime(item.created_at);

    meta.appendChild(risk);
    meta.appendChild(time);

    const text = document.createElement("p");
    text.className = "history-text";
    text.textContent = item.text;

    body.appendChild(meta);
    body.appendChild(text);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "history-delete";
    del.title = "ลบรายการนี้";
    del.textContent = "✕";
    del.addEventListener("click", () => handleDeleteItem(item.id));

    row.appendChild(body);
    row.appendChild(del);
    els.historyList.appendChild(row);
  });
}

async function loadHistory() {
  hideBanner();
  try {
    const res = await fetch(`${API_BASE}/api/history`, { credentials: "same-origin" });
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.detail || `เกิดข้อผิดพลาด (HTTP ${res.status})`);
    }
    const data = await res.json();
    renderHistory(data.items);
  } catch (err) {
    els.historyLoading.classList.add("hidden");
    showBanner(err.message || "โหลดประวัติไม่สำเร็จ");
  }
}

async function handleDeleteItem(itemId) {
  try {
    const res = await fetch(`${API_BASE}/api/history/${itemId}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!res.ok && res.status !== 404) {
      throw new Error(`ลบไม่สำเร็จ (HTTP ${res.status})`);
    }
    await loadHistory();
  } catch (err) {
    showBanner(err.message || "ลบรายการไม่สำเร็จ");
  }
}

async function handleClearAll() {
  if (!window.confirm("ต้องการล้างประวัติการตรวจสอบทั้งหมดของบัญชีนี้ใช่หรือไม่? การลบไม่สามารถกู้คืนได้")) {
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/history`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!res.ok) {
      throw new Error(`ล้างประวัติไม่สำเร็จ (HTTP ${res.status})`);
    }
    await loadHistory();
  } catch (err) {
    showBanner(err.message || "ล้างประวัติไม่สำเร็จ");
  }
}

checkAuth();
loadHistory();
els.clearAllBtn.addEventListener("click", handleClearAll);
