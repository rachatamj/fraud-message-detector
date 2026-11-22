const els = {
  tabLogin: document.getElementById("tabLogin"),
  tabRegister: document.getElementById("tabRegister"),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  authBanner: document.getElementById("authBanner"),
};

function showBanner(message, isSuccess = false) {
  els.authBanner.textContent = message;
  els.authBanner.classList.toggle("is-success", isSuccess);
  els.authBanner.classList.remove("hidden");
}

function hideBanner() {
  els.authBanner.classList.add("hidden");
  els.authBanner.classList.remove("is-success");
}

function switchTab(target) {
  hideBanner();
  const isLogin = target === "login";
  els.tabLogin.classList.toggle("active", isLogin);
  els.tabRegister.classList.toggle("active", !isLogin);
  els.loginForm.classList.toggle("hidden", !isLogin);
  els.registerForm.classList.toggle("hidden", isLogin);
}


function passwordChecks(username, password) {
  const name = username.trim().toLowerCase();
  return [
    { rule: "length", label: "อย่างน้อย 8 ตัวอักษร", ok: password.length >= 8 },
    { rule: "letter", label: "มีตัวอักษร", ok: /[A-Za-zก-ฮ]/.test(password) },
    { rule: "digit", label: "มีตัวเลข", ok: /[0-9]/.test(password) },
    { rule: "noname", label: "ไม่มีชื่อผู้ใช้อยู่ในรหัสผ่าน",
      ok: password.length > 0 && (!name || !password.toLowerCase().includes(name)) },
  ];
}

function passwordStrength(password, checks) {
  if (!password) return { score: 0, text: "-", cls: "" };
  const passed = checks.filter((c) => c.ok).length;               // 0–4 ข้อพื้นฐาน
  if (passed < checks.length) return { score: passed, text: "อ่อน (ยังไม่ผ่านเงื่อนไข)", cls: "" };
  let bonus = 0;
  if (password.length >= 12) bonus += 1;
  if (/[^A-Za-z0-9฀-๿]/.test(password) || (/[a-z]/.test(password) && /[A-Z]/.test(password))) bonus += 1;
  if (bonus === 0) return { score: 4, text: "ปานกลาง (ยาวขึ้น หรือเพิ่มสัญลักษณ์จะดีกว่า)", cls: "is-medium" };
  return { score: 6, text: "แข็งแรง", cls: "is-strong" };
}

function updatePasswordUI() {
  const pwInput = document.getElementById("registerPassword");
  const fill = document.getElementById("pwMeterFill");
  const text = document.getElementById("pwStrengthText");
  const rules = document.getElementById("pwRules");
  if (!pwInput || !fill || !text || !rules) return;
  
  const feedback = document.getElementById("pwFeedback");
  if (feedback) feedback.classList.toggle("hidden", pwInput.value.length === 0);
  const username = document.getElementById("registerUsername").value;
  const checks = passwordChecks(username, pwInput.value);
  checks.forEach((c) => {
    const li = rules.querySelector(`[data-rule="${c.rule}"]`);
    if (li) li.classList.toggle("ok", c.ok);
  });
  const s = passwordStrength(pwInput.value, checks);
  fill.style.width = `${Math.round((s.score / 6) * 100)}%`;
  fill.classList.remove("is-medium", "is-strong");
  if (s.cls) fill.classList.add(s.cls);
  text.textContent = `ความแข็งแรงของรหัสผ่าน: ${s.text}`;
}

["registerPassword", "registerUsername"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", updatePasswordUI);
});

els.tabLogin.addEventListener("click", () => switchTab("login"));
els.tabRegister.addEventListener("click", () => switchTab("register"));

els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideBanner();

  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || "เข้าสู่ระบบไม่สำเร็จ");
    }

    window.location.href = "/";
  } catch (err) {
    showBanner(err.message || "เกิดข้อผิดพลาดระหว่างเข้าสู่ระบบ");
  }
});

els.registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideBanner();

  const username = document.getElementById("registerUsername").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirm = document.getElementById("registerConfirm").value;

  const failed = passwordChecks(username, password).find((c) => !c.ok);
  if (failed) {
    showBanner(`รหัสผ่านยังไม่ผ่านเงื่อนไข: ${failed.label}`);
    return;
  }

  if (password !== confirm) {
    showBanner("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
    return;
  }

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || "สมัครสมาชิกไม่สำเร็จ");
    }

    switchTab("login");
    document.getElementById("loginUsername").value = username;
    showBanner("สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ", true);
  } catch (err) {
    showBanner(err.message || "เกิดข้อผิดพลาดระหว่างสมัครสมาชิก");
  }
});
