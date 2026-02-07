const path = require("path");
const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const pg = require("pg");
const PgSession = require("connect-pg-simple")(session);

const PORT = parseInt(process.env.PORT || "8080", 10);

const pool = new pg.Pool({
  host: process.env.DB_HOST || "db",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "veilwatch",
  user: process.env.DB_USER || "veilwatch",
  password: process.env.DB_PASSWORD || "change_me_db_pw"
});

async function dbQuery(text, params) {
  const client = await pool.connect();
  try { return await client.query(text, params); }
  finally { client.release(); }
}

const DEFAULT_STATE = {
  settings: {
    dmKey: process.env.DM_PASSKEY || "VEILWATCHDM",
    theme: { accent: "#00e5ff" }
  },
  shops: { enabled: true, activeShopId: "hq", list: [] },
  notifications: { nextId: 1, items: [] },
  clues: { archived: [] },
  characters: []
};

async function ensureSchema() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS vw_state (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await dbQuery(
    `INSERT INTO vw_state(key, value)
     VALUES ('default', $1::jsonb)
     ON CONFLICT (key) DO NOTHING;`,
    [JSON.stringify(DEFAULT_STATE)]
  );
}

async function loadState() {
  const r = await dbQuery(`SELECT value FROM vw_state WHERE key='default'`);
  const st = r.rows[0]?.value || DEFAULT_STATE;

  // guardrails
  st.settings ||= DEFAULT_STATE.settings;
  st.settings.dmKey ||= DEFAULT_STATE.settings.dmKey;
  st.shops ||= DEFAULT_STATE.shops;
  st.notifications ||= DEFAULT_STATE.notifications;
  st.clues ||= DEFAULT_STATE.clues;
  st.characters ||= [];

  if (Array.isArray(st.characters)) {
    st.characters = st.characters.filter(
      c => !String(c?.name || "").toLowerCase().includes("example")
    );
  } else {
    st.characters = [];
  }

  return st;
}

async function saveState(st) {
  await dbQuery(
    `UPDATE vw_state SET value=$1::jsonb, updated_at=NOW() WHERE key='default'`,
    [JSON.stringify(st)]
  );
}

function dmKeyOk(req, st) {
  const key = req.get("x-dm-key") || "";
  return key && key === st.settings?.dmKey;
}

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "2mb" }));

app.use(session({
  store: new PgSession({ pool, tableName: "session" }),
  name: "veilwatch.sid",
  secret: process.env.SESSION_SECRET || "change_me_session_secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: false, maxAge: 1000 * 60 * 60 * 12 }
}));

// Serve UI
const publicDir = path.join("/app", "public");
app.use(express.static(publicDir));
app.get("/", (req, res) => res.sendFile(path.join(publicDir, "index.html")));

// Health
app.get("/api/health", async (req, res) => {
  try { await dbQuery("SELECT 1"); res.json({ ok: true }); }
  catch { res.status(500).json({ ok: false }); }
});

/**
 * V4.3-compatible API (persistent in Postgres)
 */
app.get("/api/state", async (req, res) => {
  const st = await loadState();
  res.json(st);
});

app.post("/api/dm/login", async (req, res) => {
  const st = await loadState();
  const key = String(req.body?.key || "");
  if (key !== st.settings.dmKey) return res.json({ ok: false, error: "Invalid DM passkey" });
  return res.json({ ok: true });
});

app.post("/api/character/new", async (req, res) => {
  const st = await loadState();
  const name = String(req.body?.name || "").trim().slice(0, 40) || "Unnamed";
  const id = "c_" + Math.random().toString(36).slice(2, 10);
  st.characters.push({ id, name, weapons: [], inventory: [] });
  await saveState(st);
  res.json({ ok: true, id });
});

app.post("/api/character/save", async (req, res) => {
  const st = await loadState();
  const charId = String(req.body?.charId || "");
  const idx = st.characters.findIndex(c => c.id === charId);
  if (idx < 0) return res.status(404).json({ ok: false, error: "Character not found" });

  st.characters[idx] = req.body.character;
  await saveState(st);
  res.json({ ok: true });
});

app.post("/api/shops/save", async (req, res) => {
  const st = await loadState();
  if (!dmKeyOk(req, st)) return res.status(403).json({ ok: false, error: "DM only" });
  st.shops = req.body.shops;
  await saveState(st);
  res.json({ ok: true });
});

app.post("/api/notify", async (req, res) => {
  const st = await loadState();
  st.notifications ||= { nextId: 1, items: [] };
  const id = st.notifications.nextId++;
  st.notifications.items.push({
    id,
    type: req.body?.type || "Request",
    detail: req.body?.detail || "",
    from: req.body?.from || "",
    status: "open"
  });
  await saveState(st);
  res.json({ ok: true });
});

app.post("/api/notifications/save", async (req, res) => {
  const st = await loadState();
  if (!dmKeyOk(req, st)) return res.status(403).json({ ok: false, error: "DM only" });
  st.notifications = req.body.notifications;
  await saveState(st);
  res.json({ ok: true });
});

app.post("/api/clues/save", async (req, res) => {
  const st = await loadState();
  if (!dmKeyOk(req, st)) return res.status(403).json({ ok: false, error: "DM only" });
  st.clues = req.body.clues;
  await saveState(st);
  res.json({ ok: true });
});

// Boot
(async () => {
  // Wait for DB
  const start = Date.now();
  for (;;) {
    try { await dbQuery("SELECT 1"); break; }
    catch {
      if (Date.now() - start > 120000) throw new Error("DB not reachable in time");
      console.log("[db] waiting...");
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  await ensureSchema();
  app.listen(PORT, () => console.log(`[app] listening on :${PORT}`));
})().catch(err => {
  console.error("[fatal]", err);
  process.exit(1);
});
