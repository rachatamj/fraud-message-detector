// trend.js
// logic เฉพาะหน้า trend.html — "แนวโน้มความเสี่ยงส่วนบุคคล"
// (อ่านจากประวัติการตรวจสอบ) ดึงข้อมูลจาก /api/trend?days=7|30|90|180|365 แล้วแสดง: สรุปภาพรวม, กราฟแท่งสัดส่วนข้อความที่มีความเสี่ยง (แบ่งแท่งตามหน่วยที่อ่านง่าย: รายวัน/สัปดาห์/ครึ่งเดือน/เดือน),
// และตารางข้อมูลของกราฟ
// หลักการ: ตัวเลขทั้งหมดพูดถึง "ข้อความที่ตรวจ" ไม่ใช่การประเมินตัวผู้ใช้ และทุกข้อความที่แสดงสร้างด้วย
// textContent / createElement เท่านั้น (ไม่ใช้ innerHTML กับข้อมูลจาก API)
// กราฟวาดเป็น SVG เอง ไม่พึ่ง library ภายนอก ให้เข้ากับส่วนอื่นของโปรเจกต์

const API_BASE = "";
const SVG_NS = "http://www.w3.org/2000/svg";
const DEFAULT_DAYS = 30;
// หน่วยของแต่ละแท่ง/แถวในตาราง (ตรงกับ TREND_BUCKETS ใน backend/auth.py)
const BUCKET_UNIT = { 7: "1 วัน", 30: "ประมาณ 1 สัปดาห์ (7–8 วัน)", 90: "ครึ่งเดือน (15 วัน)", 180: "1 เดือน (30 วัน)", 365: "ประมาณ 1 เดือน (30–31 วัน)" };
const RANGE_LABEL = { 7: "1 สัปดาห์", 30: "1 เดือน", 90: "3 เดือน", 180: "6 เดือน", 365: "1 ปี" };
function rangeLabel(days) {
  return RANGE_LABEL[days] || `${days} วัน`;
}

const els = {
  statusBanner: document.getElementById("statusBanner"),
  authArea: document.getElementById("authArea"),
  rangeButtons: Array.from(document.querySelectorAll(".range-btn")),
  trendLoading: document.getElementById("trendLoading"),
  trendEmpty: document.getElementById("trendEmpty"),
  trendContent: document.getElementById("trendContent"),
  trendHeadline: document.getElementById("trendHeadline"),
  cardTotal: document.getElementById("cardTotal"),
  cardTotalNote: document.getElementById("cardTotalNote"),
  cardRisky: document.getElementById("cardRisky"),
  cardRiskyNote: document.getElementById("cardRiskyNote"),
  cardNormal: document.getElementById("cardNormal"),
  cardRate: document.getElementById("cardRate"),
  riskBarChart: document.getElementById("riskBarChart"),
  chartNote: document.getElementById("chartNote"),
  chartTable: document.getElementById("chartTable"),
  incompleteNote: document.getElementById("incompleteNote"),
};

let currentDays = DEFAULT_DAYS;
let requestSeq = 0; // กันผลของคำขอเก่าทับคำขอใหม่ เมื่อผู้ใช้กดเปลี่ยนช่วงเวลารัวๆ

// ---------- ทั่วไป ----------
function showBanner(message) {
  els.statusBanner.textContent = message;
  els.statusBanner.classList.remove("hidden");
}

function hideBanner() {
  els.statusBanner.classList.add("hidden");
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
    // เชื่อมต่อไม่ได้ก็ยังพากลับไปหน้า login ตามปกติ
  }
  window.location.href = "/login";
}

// วันที่จาก backend เป็น "YYYY-MM-DD" ตามเวลาไทยอยู่แล้ว จึงแปลงที่เวลา UTC เพื่อไม่ให้วันเลื่อนตามเขตเวลาของเบราว์เซอร์
function fmtDate(dateStr, withYear = false) {
  const d = new Date(dateStr + "T00:00:00Z");
  if (isNaN(d.getTime())) return dateStr;
  const opts = { day: "numeric", month: "short", timeZone: "UTC" };
  if (withYear) opts.year = "numeric";
  return d.toLocaleDateString("th-TH", opts);
}

function fmtRange(start, end, withYear = false) {
  return start === end ? fmtDate(start, withYear) : `${fmtDate(start, withYear)} – ${fmtDate(end, withYear)}`;
}

function fmtNum(n) {
  return Number(n).toLocaleString("th-TH");
}

function fmtRate(rate) {
  return rate === null || rate === undefined ? "—" : `${rate.toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`;
}

function setText(el, text) {
  el.textContent = text;
}

// ---------- สรุปภาพรวม ----------
function renderHeadline(data) {
  const cur = data.current;
  const range = fmtRange(data.period_start, data.period_end, true);

  if (cur.total === 0) {
    setText(els.trendHeadline, `ในช่วง ${rangeLabel(data.days)}ที่ผ่านมา (${range}) ยังไม่มีข้อความที่ตรวจสอบ`);
    return;
  }
  setText(
    els.trendHeadline,
    `ในช่วง ${rangeLabel(data.days)}ที่ผ่านมา (${range}) พบข้อความที่มีความเสี่ยง ${fmtRate(cur.rate)} ` +
      `ของข้อความทั้งหมดที่ตรวจสอบ (${fmtNum(cur.risky)} จาก ${fmtNum(cur.total)} ข้อความ)`
  );
}

function renderCards(data) {
  const cur = data.current;
  setText(els.cardTotal, fmtNum(cur.total));
  setText(els.cardTotalNote, `ข้อความ ใน ${rangeLabel(data.days)}ล่าสุด`);
  setText(els.cardRisky, fmtNum(cur.risky));
  setText(
    els.cardRiskyNote,
    cur.risky > 0 ? `ควรระมัดระวัง ${fmtNum(cur.caution)} · ความเสี่ยงสูง ${fmtNum(cur.high)}` : "ข้อความ"
  );
  setText(els.cardNormal, fmtNum(cur.normal));
  setText(els.cardRate, fmtRate(cur.rate));
}

// ---------- กราฟแท่ง (SVG) ----------
function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  return el;
}

// เพดานแกน Y: ปัดขึ้นเป็นหลัก 10/25/50/100 ให้อ่านง่าย แต่เริ่มที่ 0 เสมอ ไม่ตัดแกนให้ภาพผันผวนเกินจริง
function niceMax(maxRate) {
  if (maxRate <= 10) return 10;
  if (maxRate <= 25) return 25;
  if (maxRate <= 50) return 50;
  return 100;
}

function pointRange(p) {
  return fmtRange(p.start, p.end);
}

function pointLabel(p) {
  if (p.total === 0) return { head: pointRange(p), body: "ไม่มีข้อความที่ตรวจ" };
  return {
    head: pointRange(p),
    body: `ตรวจ ${fmtNum(p.total)} ข้อความ · มีความเสี่ยง ${fmtNum(p.risky)} (${fmtRate(p.rate)})`,
  };
}

let lastData = null;
let lastNarrow = null;

function renderBarChart(data) {
  lastData = data;
  const wrap = els.riskBarChart;
  wrap.innerHTML = "";

  const points = data.points;
  if (!points.some((p) => p.rate !== null)) {
    const empty = document.createElement("p");
    empty.className = "hbar-empty";
    empty.textContent = "ไม่มีข้อความที่ตรวจในช่วงนี้ จึงไม่มีข้อมูลให้แสดงเป็นกราฟ";
    wrap.appendChild(empty);
    return;
  }

  // จอแคบ: ใช้ viewBox เล็กลง เพื่อให้ตัวอักษรบนแกนยังอ่านได้เมื่อ SVG ถูกย่อให้พอดีความกว้าง
  const narrow = wrap.clientWidth > 0 && wrap.clientWidth < 520;
  const W = narrow ? 360 : 720;
  const H = narrow ? 260 : 300;
  const m = narrow ? { top: 22, right: 8, bottom: 34, left: 38 } : { top: 24, right: 16, bottom: 38, left: 46 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;

  const maxRate = Math.max(...points.map((p) => (p.rate === null ? 0 : p.rate)));
  const yMax = niceMax(maxRate);
  const n = points.length;
  const slot = iw / n;
  const barW = Math.min(slot * 0.62, 56);
  const cx = (i) => m.left + slot * (i + 0.5);
  const y = (rate) => m.top + ih - (rate / yMax) * ih;

  const svg = svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": `กราฟแท่งสัดส่วนข้อความที่มีความเสี่ยง ย้อนหลัง ${rangeLabel(data.days)} แบ่งเป็น ${n} ช่วง`,
  });

  for (let k = 0; k <= 4; k++) {
    const v = (yMax / 4) * k;
    const yy = y(v);
    svg.appendChild(svgEl("line", { x1: m.left, x2: W - m.right, y1: yy, y2: yy, class: "lc-grid" }));
    const label = svgEl("text", { x: m.left - 8, y: yy + 4, "text-anchor": "end", class: "lc-axis-text" });
    label.textContent = `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
    svg.appendChild(label);
  }

  const tip = document.createElement("div");
  tip.className = "lc-tip";
  tip.style.display = "none";
  const tipHead = document.createElement("strong");
  const tipBody = document.createElement("div");
  tip.appendChild(tipHead);
  tip.appendChild(tipBody);

  let activeBar = null;
  function showTip(i, bar) {
    const info = pointLabel(points[i]);
    tipHead.textContent = info.head;
    tipBody.textContent = info.body;
    tip.style.display = "block";
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / W;
    const tipW = tip.offsetWidth;
    const left = Math.min(Math.max(cx(i) * scale - tipW / 2, 0), Math.max(0, rect.width - tipW));
    tip.style.left = `${left}px`;
    tip.style.top = "0px";
    if (activeBar) activeBar.classList.remove("is-hover");
    activeBar = bar;
    if (activeBar) activeBar.classList.add("is-hover");
  }
  function hideTip() {
    tip.style.display = "none";
    if (activeBar) activeBar.classList.remove("is-hover");
    activeBar = null;
  }

  points.forEach((p, i) => {
    let bar = null;
    if (p.rate !== null) {
      // แท่งสูง 0% ยังวาดเส้นบางๆ ไว้ เพื่อให้ต่างจาก "ไม่มีข้อความ" (ไม่วาดอะไรเลย)
      const h = Math.max(2, (p.rate / yMax) * ih);
      bar = svgEl("rect", { x: cx(i) - barW / 2, y: m.top + ih - h, width: barW, height: h, rx: 3, class: "bar-rect" });
      svg.appendChild(bar);
      const val = svgEl("text", { x: cx(i), y: m.top + ih - h - 5, "text-anchor": "middle", class: "bar-value" });
      val.textContent = narrow && n > 7 ? `${Math.round(p.rate)}%` : fmtRate(p.rate);
      svg.appendChild(val);
    } else {
      const none = svgEl("text", { x: cx(i), y: m.top + ih - 6, "text-anchor": "middle", class: "bar-none" });
      none.textContent = narrow ? "–" : "ไม่มีข้อมูล";
      svg.appendChild(none);
    }
    if (!(narrow && n > 8 && i % 2 === 1)) {
      const xl = svgEl("text", { x: cx(i), y: H - 12, "text-anchor": "middle", class: "lc-axis-text" });
      xl.textContent = fmtDate(p.start);
      svg.appendChild(xl);
    }

    const hit = svgEl("rect", { x: m.left + slot * i, y: m.top, width: slot, height: ih, class: "lc-hit" });
    hit.addEventListener("pointerenter", () => showTip(i, bar));
    hit.addEventListener("pointerdown", () => showTip(i, bar));
    hit.addEventListener("pointerleave", hideTip);
    svg.appendChild(hit);
  });

  wrap.appendChild(svg);
  wrap.appendChild(tip);
  lastNarrow = narrow;
}

function renderChartNote(data) {
  setText(
    els.chartNote,
    `ช่วง ${rangeLabel(data.days)} แบ่งเป็น ${data.points.length} แท่ง แท่งละ${BUCKET_UNIT[data.days] || ""} (ชื่อใต้แท่งคือวันเริ่มต้นของแต่ละช่วง ดูช่วงเต็มได้จากตาราง) ` +
      "แกนตั้งเริ่มที่ 0% ช่วงที่ไม่มีข้อความตรวจจะไม่มีแท่ง ไม่นับเป็น 0% และแท่งที่มีข้อความน้อยอาจแกว่งมาก " +
      "เช่น ตรวจ 1 ข้อความ ถ้าเป็นข้อความเสี่ยงจะแสดง 100%"
  );
}

// ---------- ตาราง ----------
function appendRow(table, cells, isHead = false) {
  const tr = document.createElement("tr");
  cells.forEach((c, idx) => {
    const cell = document.createElement(isHead ? "th" : "td");
    if (idx > 0) cell.className = "num";
    cell.textContent = c;
    tr.appendChild(cell);
  });
  table.appendChild(tr);
}

function renderChartTable(data) {
  const t = els.chartTable;
  t.innerHTML = "";
  appendRow(t, ["ช่วงเวลา", "ตรวจ (ข้อความ)", "มีความเสี่ยง (ข้อความ)", "สัดส่วน"], true);
  data.points.forEach((p) => {
    appendRow(t, [pointRange(p), fmtNum(p.total), fmtNum(p.risky), fmtRate(p.rate)]);
  });
}

// ---------- ควบคุมหน้า ----------
function render(data) {
  els.trendLoading.classList.add("hidden");

  if (data.all_time_total === 0) {
    els.trendEmpty.classList.remove("hidden");
    els.trendContent.classList.add("hidden");
    return;
  }
  els.trendEmpty.classList.add("hidden");
  els.trendContent.classList.remove("hidden");


  // ประวัติเต็มเพดานและรายการเก่าสุดที่เหลืออยู่ใหม่กว่าจุดเริ่มของช่วงเปรียบเทียบ = ตัวเลขช่วงเก่าอาจไม่ครบ
  if (data.data_incomplete) {
    setText(
      els.incompleteNote,
      `หมายเหตุ: ประวัติเต็ม ${fmtNum(data.history_limit)} รายการแล้ว ระบบเหลือข้อมูลย้อนหลังถึงวันที่ ${fmtDate(data.oldest_date, true)} ` +
        "เท่านั้น ตัวเลขของช่วงที่เก่ากว่านั้นอาจไม่ครบ ช่วงที่เก่ากว่านั้นจึงอาจแสดงว่าไม่มีข้อมูลทั้งที่เคยตรวจไว้"
    );
    els.incompleteNote.classList.remove("hidden");
  } else {
    els.incompleteNote.classList.add("hidden");
  }

  renderHeadline(data);
  renderCards(data);
  renderBarChart(data);
  renderChartNote(data);
  renderChartTable(data);
}

function markActiveRange(days) {
  els.rangeButtons.forEach((btn) => {
    const active = Number(btn.dataset.days) === days;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
}

async function loadTrend(days) {
  const seq = ++requestSeq;
  currentDays = days;
  markActiveRange(days);
  hideBanner();
  els.trendLoading.classList.remove("hidden");

  try {
    const res = await fetch(`${API_BASE}/api/trend?days=${encodeURIComponent(days)}`, { credentials: "same-origin" });
    if (seq !== requestSeq) return; // มีคำขอใหม่กว่าแล้ว ทิ้งผลนี้
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.detail || `เกิดข้อผิดพลาด (HTTP ${res.status})`);
    }
    const data = await res.json();
    if (seq !== requestSeq) return;
    render(data);
  } catch (err) {
    if (seq !== requestSeq) return;
    els.trendLoading.classList.add("hidden");
    showBanner(err.message || "โหลดข้อมูลแนวโน้มไม่สำเร็จ");
  }
}

els.rangeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const days = Number(btn.dataset.days);
    if (days !== currentDays) loadTrend(days);
  });
});

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!lastData) return;
    const narrowNow = els.riskBarChart.clientWidth > 0 && els.riskBarChart.clientWidth < 520;
    if (narrowNow !== lastNarrow) renderBarChart(lastData);
  }, 150);
});

checkAuth();
loadTrend(DEFAULT_DAYS);
