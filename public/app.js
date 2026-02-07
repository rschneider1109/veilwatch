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
  try { data = JSON.parse(text); } catch { data = text; }

  return { ok: res.ok, status: res.status, data };
}

function show(id, payload) {
  $(id).textContent = pretty(payload);
}

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = $("username").value.trim();
  const password = $("password").value;

  const r = await api("/api/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });

  show("authOut", r);
});

$("logoutBtn").addEventListener("click", async () => {
  const r = await api("/api/logout", { method: "POST" });
  show("authOut", r);
});

$("meBtn").addEventListener("click", async () => {
  const r = await api("/api/me");
  show("authOut", r);
});

$("qrBtn").addEventListener("click", async () => {
  const r = await api("/api/quickref");
  show("qrOut", r);
});

$("chBtn").addEventListener("click", async () => {
  const r = await api("/api/character");
  show("chOut", r);
});

// Admin helpers (uses same session cookie)
$("adminLoginBtn").addEventListener("click", async () => {
  const username = $("username").value.trim();
  const password = $("password").value;

  const r = await api("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });

  show("adminOut", r);
});

$("usersBtn").addEventListener("click", async () => {
  const r = await api("/api/admin/users");
  show("adminOut", r);
});
