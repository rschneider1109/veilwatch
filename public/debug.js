// public/app.js
const $ = (id) => document.getElementById(id);
const pretty = (obj) => JSON.stringify(obj, null, 2);

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...opts
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { ok: res.ok, status: res.status, data };
}

function show(id, payload) {
  const el = $(id);
  if (!el) return;
  el.textContent = pretty(payload);
}

async function refreshMe() {
  const r = await api("/api/me");
  show("authOut", r);

  const must = r?.data?.user?.mustChangePassword === true;
  const statusEl = $("status");
  if (statusEl) statusEl.textContent = must ? "PASSWORD UPDATE REQUIRED" : "ONLINE";

  return r;
}

// ---- Login ----
$("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = $("username")?.value?.trim() || "";
  const password = $("password")?.value || "";

  const r = await api("/api/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });

  show("authOut", r);
  if (r.ok) await refreshMe();
});

// ---- Logout ----
$("logoutBtn")?.addEventListener("click", async () => {
  const r = await api("/api/logout", { method: "POST" });
  show("authOut", r);
  await refreshMe();
});

// ---- /api/me ----
$("meBtn")?.addEventListener("click", refreshMe);

// ---- QuickRef ----
$("qrBtn")?.addEventListener("click", async () => {
  const r = await api("/api/quickref");
  show("qrOut", r);
});

// ---- Character ----
$("chBtn")?.addEventListener("click", async () => {
  const r = await api("/api/character");
  show("chOut", r);
});

// ---- Admin Login (uses same username/password inputs) ----
$("adminLoginBtn")?.addEventListener("click", async () => {
  const username = $("username")?.value?.trim() || "";
  const password = $("password")?.value || "";

  const r = await api("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });

  show("adminOut", r);
  if (r.ok) await refreshMe();
});

// ---- List Users (requires admin session) ----
$("usersBtn")?.addEventListener("click", async () => {
  const r = await api("/api/admin/users");
  show("adminOut", r);
});

// ---- Change Password ----
$("pwForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const oldPassword = $("oldPassword")?.value || "";
  const newPassword = $("newPassword")?.value || "";
  const newPassword2 = $("newPassword2")?.value || "";

  if (newPassword !== newPassword2) {
    show("pwOut", { ok: false, error: "New passwords do not match" });
    return;
  }

  const r = await api("/api/change-password", {
    method: "POST",
    body: JSON.stringify({ oldPassword, newPassword })
  });

  show("pwOut", r);
  if (r.ok) {
    // clear fields after success
    $("oldPassword").value = "";
    $("newPassword").value = "";
    $("newPassword2").value = "";
  }

  await refreshMe();
});

// On load, show current auth state
window.addEventListener("load", refreshMe);
