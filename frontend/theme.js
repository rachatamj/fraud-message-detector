const THEME_STORAGE_KEY = "thai-spam-detector-theme";

function getSavedTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) || "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function toggleTheme() {
  const current = getSavedTheme();
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_STORAGE_KEY, next);
  applyTheme(next);
  updateToggleIcon(next);
}

function updateToggleIcon(theme) {
  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.textContent = theme === "dark" ? "☀️" : "🌙";
    btn.title = theme === "dark" ? "สลับเป็นธีมสว่าง" : "สลับเป็นธีมมืด";
  }
}

applyTheme(getSavedTheme());

async function addAdminLink() {
  const nav = document.querySelector(".nav-links");
  if (!nav || nav.querySelector('a[href="/admin"]')) return;
  try {
    const res = await fetch("/api/me", { credentials: "same-origin" });
    if (!res.ok) return;
    const me = await res.json();
    if (!me.is_admin) return;
    const a = document.createElement("a");
    a.href = "/admin";
    a.className = "nav-link";
    a.textContent = "จัดการระบบ";
    nav.appendChild(a);
  } catch (err) {
    // เงียบไว้ ลิงก์แอดมินเป็นส่วนเสริม
  }
}

document.addEventListener("DOMContentLoaded", () => {
  addAdminLink();
  updateToggleIcon(getSavedTheme());
  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.addEventListener("click", toggleTheme);
  }
});
