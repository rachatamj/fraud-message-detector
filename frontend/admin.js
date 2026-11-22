const API_BASE = "";
const SVG_NS = "http://www.w3.org/2000/svg";

const els = {
  banner: document.getElementById("adminBanner"),
  loading: document.getElementById("adminLoading"),
  content: document.getElementById("adminContent"),
  authArea: document.getElementById("authArea"),
  cardUsers: document.getElementById("cardUsers"),
  cardChecks: document.getElementById("cardChecks"),
  cardToday: document.getElementById("cardToday"),
  cardModel: document.getElementById("cardModel"),
  cardModelNote: document.getElementById("cardModelNote"),
  riskSplit: document.getElementById("riskSplit"),
  riskSplitLegend: document.getElementById("riskSplitLegend"),
  dailyChart: document.getElementById("dailyChart"),
  userBody: document.getElementById("userBody"),
  pwDialog: document.getElementById("pwDialog"),
  pwForm: document.getElementById("pwForm"),
  pwTarget: document.getElementById("pwTarget"),
  pwInput: document.getElementById("pwInput"),
  pwGenBtn: document.getElementById("pwGenBtn"),
  pwCancel: document.getElementById("pwCancel"),
  pwSave: document.getElementById("pwSave"),
  pwError: document.getElementById("pwError"),
};

let pwTargetUser = null;

function showBanner(message, ok = false) {
  els.banner.textContent = message;
  els.banner.classList.toggle("is-success", ok);
  els.banner.classList.remove("hidden");
}
function hideBanner() { els.banner.classList.add("hidden"); }

function fmtNum(n) { return Number(n).toLocaleString("th-TH"); }
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtShortDate(iso) {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "same-origin", ...options });
  if (res.status === 401) { window.location.href = "/login"; throw new Error("unauthorized"); }
  if (res.status === 403) { window.location.href = "/"; throw new Error("forbidden"); }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || `เกิดข้อผิดพลาด (HTTP ${res.status})`);
  return body;
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
  logoutBtn.addEventListener("click", async () => {
    try { await fetch(`${API_BASE}/api/logout`, { method: "POST", credentials: "same-origin" }); } catch (e) {}
    window.location.href = "/login";
  });
  els.authArea.appendChild(nameSpan);
  els.authArea.appendChild(logoutBtn);
}

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

function renderCards(stats) {
  els.cardUsers.textContent = fmtNum(stats.users_total);
  els.cardChecks.textContent = fmtNum(stats.checks_total);
  els.cardToday.textContent = fmtNum(stats.checks_today);
  els.cardModel.textContent = stats.model_loaded ? "พร้อม" : "ไม่พร้อม";
  els.cardModelNote.textContent = stats.device ? `อุปกรณ์: ${stats.device}` : "";
}

const RISK_LABELS = { low: "ความเสี่ยงต่ำ", caution: "ควรระมัดระวัง", high: "ความเสี่ยงสูง" };

function legendItem(key, text) {
  const item = document.createElement("span");
  item.className = "adm-legend-item";
  const dot = document.createElement("i");
  dot.className = `adm-dot is-${key}`;
  item.appendChild(dot);
  item.appendChild(document.createTextNode(text));
  return item;
}

function renderRiskSplit(by) {
  const total = by.low + by.caution + by.high;
  els.riskSplit.innerHTML = "";
  els.riskSplitLegend.innerHTML = "";
  if (!total) {
    els.riskSplitLegend.textContent = "ยังไม่มีการตรวจสอบในระบบ";
    return;
  }
  ["low", "caution", "high"].forEach((k) => {
    if (by[k]) {
      const seg = document.createElement("div");
      seg.className = `risk-split-seg is-${k}`;
      seg.style.flexGrow = by[k];
      seg.textContent = `${Math.round((by[k] / total) * 100)}%`;
      seg.title = `${RISK_LABELS[k]}: ${fmtNum(by[k])} ครั้ง`;
      els.riskSplit.appendChild(seg);
    }
    els.riskSplitLegend.appendChild(legendItem(k, `${RISK_LABELS[k]} ${fmtNum(by[k])} ครั้ง`));
  });
}

function niceStep(max) {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  return steps.find((s) => max / s <= 4) || 10000;
}

function renderDaily(daily) {
  const wrap = els.dailyChart;
  wrap.innerHTML = "";
  const W = 760, H = 230, padL = 34, padB = 28, padT = 14, padR = 10;
  const maxTotal = Math.max(1, ...daily.map((d) => d.total));
  const step = niceStep(maxTotal);
  const yMax = Math.ceil(maxTotal / step) * step;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const slot = innerW / daily.length;
  const bw = Math.min(18, Math.max(6, slot * 0.66));
  const yOf = (v) => padT + innerH * (1 - v / yMax);

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "จำนวนการตรวจสอบรายวัน 30 วันล่าสุด แยกตามระดับความเสี่ยง" });

  for (let v = 0; v <= yMax; v += step) {
    const y = yOf(v);
    svg.appendChild(svgEl("line", { x1: padL, x2: W - padR, y1: y, y2: y, class: v === 0 ? "adm-axis" : "lc-grid" }));
    const t = svgEl("text", { x: padL - 8, y: y + 4, "text-anchor": "end", class: "lc-axis-text" });
    t.textContent = v;
    svg.appendChild(t);
  }

  const tip = document.createElement("div");
  tip.className = "lc-tip adm-tip hidden";
  wrap.appendChild(tip);

  const showTip = (d, cx, topY) => {
    tip.innerHTML = "";
    const head = document.createElement("strong");
    head.textContent = fmtDay(d.date);
    tip.appendChild(head);
    const sum = document.createElement("div");
    sum.textContent = d.total ? `ตรวจ ${fmtNum(d.total)} ครั้ง` : "ไม่มีการตรวจสอบ";
    tip.appendChild(sum);
    if (d.total) {
      ["low", "caution", "high"].forEach((k) => {
        const row = document.createElement("div");
        row.className = "adm-tip-row";
        const dot = document.createElement("i");
        dot.className = `adm-dot is-${k}`;
        row.appendChild(dot);
        row.appendChild(document.createTextNode(`${RISK_LABELS[k]} ${fmtNum(d[k] || 0)}`));
        tip.appendChild(row);
      });
    }
    tip.classList.remove("hidden");
    const wrapW = svg.clientWidth;   // กว้างของกราฟจริง (จอแคบกราฟจะเลื่อนซ้าย-ขวาได้)
    const px = (cx / W) * wrapW;
    const half = tip.offsetWidth / 2;
    tip.style.left = `${Math.min(Math.max(px - half, 0), wrapW - tip.offsetWidth)}px`;
    tip.style.top = `${Math.max((topY / H) * svg.clientHeight - tip.offsetHeight - 8, 0)}px`;
  };

  daily.forEach((d, i) => {
    const x = padL + slot * i + (slot - bw) / 2;
    const cx = x + bw / 2;
    const g = svgEl("g", { class: "adm-day" });
    const base = yOf(0);
    if (d.total === 0) {
      g.appendChild(svgEl("rect", { x, y: base - 3, width: bw, height: 3, rx: 1.5, class: "adm-empty" }));
    } else {
      const clipId = `admclip${i}`;
      const topY = yOf(d.total);
      const clip = svgEl("clipPath", { id: clipId });
      clip.appendChild(svgEl("rect", { x, y: topY, width: bw, height: base - topY, rx: 3 }));
      g.appendChild(clip);
      const stack = svgEl("g", { "clip-path": `url(#${clipId})` });
      let acc = 0;
      ["low", "caution", "high"].forEach((k) => {
        const n = d[k] || 0;
        if (!n) return;
        const y1 = yOf(acc + n), y0 = yOf(acc);
        stack.appendChild(svgEl("rect", { x, y: y1, width: bw, height: y0 - y1, class: `adm-seg is-${k}` }));
        acc += n;
      });
      g.appendChild(stack);
    }
    const hit = svgEl("rect", { x: padL + slot * i, y: padT, width: slot, height: innerH, class: "lc-hit" });
    hit.addEventListener("mouseenter", () => { g.classList.add("is-hover"); showTip(d, cx, d.total ? yOf(d.total) : base - 3); });
    hit.addEventListener("mouseleave", () => { g.classList.remove("is-hover"); tip.classList.add("hidden"); });
    hit.addEventListener("click", () => showTip(d, cx, d.total ? yOf(d.total) : base - 3));   // จอสัมผัส: แตะเพื่อดูตัวเลข
    g.appendChild(hit);
    svg.appendChild(g);

    const last = i === daily.length - 1;
    if (i % 5 === 0 || last) {
      const lx = svgEl("text", { x: cx, y: H - 8, "text-anchor": "middle", class: `lc-axis-text${last ? " adm-today" : ""}` });
      lx.textContent = last ? "วันนี้" : fmtShortDate(d.date);
      svg.appendChild(lx);
    }
  });
  wrap.appendChild(svg);
  wrap.scrollLeft = wrap.scrollWidth;   // จอแคบ: เลื่อนไปท้ายกราฟให้เห็น "วันนี้" ก่อน
}

function fmtDay(iso) {
  const d = new Date(`${iso}T00:00:00+07:00`);
  return d.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function actionButton(label, className, onClick, disabled = false, title = "") {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.textContent = label;
  b.disabled = disabled;
  if (title) b.title = title;
  b.addEventListener("click", onClick);
  return b;
}

function renderUsers(items) {
  els.userBody.innerHTML = "";
  items.forEach((u) => {
    const tr = document.createElement("tr");
    const tdName = document.createElement("td");
    tdName.textContent = u.username;
    if (u.is_admin) {
      const badge = document.createElement("span");
      badge.className = "adm-badge";
      badge.textContent = "แอดมิน";
      tdName.appendChild(document.createTextNode(" "));
      tdName.appendChild(badge);
    }
    const tdCreated = document.createElement("td");
    tdCreated.textContent = fmtDateTime(u.created_at);
    const tdChecks = document.createElement("td");
    tdChecks.className = "num";
    tdChecks.textContent = fmtNum(u.checks);
    const tdLast = document.createElement("td");
    tdLast.textContent = fmtDateTime(u.last_check);
    const tdAct = document.createElement("td");
    tdAct.className = "adm-actions";
    tdAct.appendChild(actionButton("ตั้งรหัสผ่านใหม่", "btn btn-ghost btn-small", () => openPwDialog(u.username)));
    tdAct.appendChild(actionButton("ลบผู้ใช้", "btn btn-danger-ghost btn-small", () => handleDelete(u.username), u.is_admin, u.is_admin ? "ลบบัญชีผู้ดูแลระบบไม่ได้" : ""));
    [tdName, tdCreated, tdChecks, tdLast, tdAct].forEach((td) => tr.appendChild(td));
    els.userBody.appendChild(tr);
  });
}

function randomPassword(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  const pw = Array.from(buf, (n) => chars[n % chars.length]).join("");
  // ให้ผ่านเงื่อนไขรหัสผ่านใหม่เสมอ: มีทั้งตัวอักษรและตัวเลข
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return randomPassword(len);
  return pw;
}

function openPwDialog(username) {
  pwTargetUser = username;
  els.pwTarget.textContent = username;
  els.pwInput.value = "";
  els.pwError.classList.add("hidden");
  els.pwDialog.showModal();
  els.pwInput.focus();
}

async function handleDelete(username) {
  if (!window.confirm(`ลบบัญชี "${username}" พร้อมประวัติและสถิติทั้งหมด? ย้อนกลับไม่ได้`)) return;
  hideBanner();
  try {
    const res = await api(`/api/admin/users/${encodeURIComponent(username)}`, { method: "DELETE" });
    showBanner(res.message, true);
    await loadAll();
  } catch (err) {
    if (err.message !== "unauthorized" && err.message !== "forbidden") showBanner(err.message);
  }
}

els.pwGenBtn.addEventListener("click", () => { els.pwInput.value = randomPassword(); });
els.pwCancel.addEventListener("click", () => els.pwDialog.close());
els.pwForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pw = els.pwInput.value;
  if (pw.length < 6) {
    els.pwError.textContent = "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร";
    els.pwError.classList.remove("hidden");
    return;
  }
  els.pwSave.disabled = true;
  try {
    const res = await api(`/api/admin/users/${encodeURIComponent(pwTargetUser)}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_password: pw }),
    });
    els.pwDialog.close();
    showBanner(`${res.message} รหัสผ่านใหม่: ${pw} (จดไว้ส่งให้ผู้ใช้ ระบบจะไม่แสดงอีก)`, true);
  } catch (err) {
    if (err.message !== "unauthorized" && err.message !== "forbidden") {
      els.pwError.textContent = err.message;
      els.pwError.classList.remove("hidden");
    }
  } finally {
    els.pwSave.disabled = false;
  }
});

async function loadAll() {
  const [stats, users] = await Promise.all([api("/api/admin/stats"), api("/api/admin/users")]);
  renderCards(stats);
  renderRiskSplit(stats.by_risk);
  renderDaily(stats.daily);
  renderUsers(users.items);
  els.loading.classList.add("hidden");
  els.content.classList.remove("hidden");
}

async function init() {
  try {
    const me = await api("/api/me");
    renderAuthArea(me.username);
    await loadAll();
  } catch (err) {
    els.loading.classList.add("hidden");
    if (err.message !== "unauthorized" && err.message !== "forbidden") showBanner(err.message);
  }
}
init();
