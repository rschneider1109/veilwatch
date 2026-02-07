const path = require("path");
const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const pg = require("pg");
const PgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");
const { z } = require("zod");

const PORT = parseInt(process.env.PORT || "8080", 10);

const DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgresql://${encodeURIComponent(process.env.DB_USER || "veilwatch")}:${encodeURIComponent(
    process.env.DB_PASSWORD || "veilwatch_pw_change_me"
  )}@${process.env.DB_HOST || "db"}:${process.env.DB_PORT || "5432"}/${process.env.DB_NAME || "veilwatch"}`;

const ADMIN_SEED_USER = process.env.ADMIN_SEED_USER || "admin";
const ADMIN_SEED_PASSWORD = process.env.ADMIN_SEED_PASSWORD || "ChangeMe_Now_123!";

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function dbQuery(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function ensureSchema() {
  // Required for connect-pg-simple
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS session (
      sid varchar NOT NULL,
      sess json NOT NULL,
      expire timestamp(6) NOT NULL,
      CONSTRAINT session_pkey PRIMARY KEY (sid)
    );
  `);
  await dbQuery(`CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire);`);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS characters (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'Operative',
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id)
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS quickref (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await dbQuery(`
    INSERT INTO quickref(key, value)
    VALUES ('default', jsonb_build_object('status','online','notes','Welcome to Veilwatch OS'))
    ON CONFLICT (key) DO NOTHING;
  `);

  // Seed admin
  const existing = await dbQuery(`SELECT id FROM users WHERE username = $1`, [ADMIN_SEED_USER]);
  if (existing.rowCount === 0) {
    const hash = await bcrypt.hash(ADMIN_SEED_PASSWORD, 12);
    await dbQuery(
      `INSERT INTO users(username, password_hash, role, must_change_password)
       VALUES ($1, $2, 'admin', TRUE)`,
      [ADMIN_SEED_USER, hash]
    );
    console.log(`[db] Seeded admin user: ${ADMIN_SEED_USER} (must_change_password=true)`);
  }
}

function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: "Not authenticated" });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.session.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));

app.use(
  session({
    store: new PgSession({ pool, tableName: "session" }),
    name: "veilwatch.sid",
    secret: process.env.SESSION_SECRET || "veilwatch_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

// Static front-end
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));
app.get("/", (req, res) => res.sendFile(path.join(publicDir, "index.html")));

// ---- API ----
app.get("/api/health", async (req, res) => {
  try {
    await dbQuery("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: "db unavailable" });
  }
});

app.get("/api/me", (req, res) => {
  if (!req.session?.user) return res.json({ authenticated: false });
  res.json({ authenticated: true, user: req.session.user });
});

app.post("/api/login", async (req, res) => {
  const schema = z.object({ username: z.string().min(1), password: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

  const { username, password } = parsed.data;
  const r = await dbQuery(
    `SELECT id, username, password_hash, role, must_change_password FROM users WHERE username=$1`,
    [username]
  );
  if (r.rowCount === 0) return res.status(401).json({ error: "Invalid credentials" });

  const u = r.rows[0];
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  req.session.user = {
    id: u.id,
    username: u.username,
    role: u.role,
    mustChangePassword: u.must_change_password
  };
  res.json({ ok: true, user: req.session.user });
});

app.post("/api/logout", (req, res) => {
  if (!req.session) return res.json({ ok: true });
  req.session.destroy(() => res.json({ ok: true }));
});

app.post("/api/change-password", requireAuth, async (req, res) => {
  const schema = z.object({ oldPassword: z.string().min(1), newPassword: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

  const { oldPassword, newPassword } = parsed.data;
  const uid = req.session.user.id;

  const r = await dbQuery(`SELECT password_hash FROM users WHERE id=$1`, [uid]);
  if (r.rowCount === 0) return res.status(404).json({ error: "User not found" });

  const ok = await bcrypt.compare(oldPassword, r.rows[0].password_hash);
  if (!ok) return res.status(401).json({ error: "Old password incorrect" });

  const hash = await bcrypt.hash(newPassword, 12);
  await dbQuery(`UPDATE users SET password_hash=$1, must_change_password=FALSE WHERE id=$2`, [hash, uid]);

  req.session.user.mustChangePassword = false;
  res.json({ ok: true });
});

app.get("/api/quickref", async (req, res) => {
  const r = await dbQuery(`SELECT key, value, updated_at FROM quickref ORDER BY key ASC`);
  res.json({ ok: true, items: r.rows });
});

app.get("/api/character", requireAuth, async (req, res) => {
  const uid = req.session.user.id;
  const r = await dbQuery(`SELECT id, name, data, updated_at FROM characters WHERE user_id=$1`, [uid]);

  if (r.rowCount === 0) {
    const ins = await dbQuery(
      `INSERT INTO characters(user_id, name, data)
       VALUES ($1,'Operative','{}'::jsonb)
       RETURNING id, name, data, updated_at`,
      [uid]
    );
    return res.json({ ok: true, character: ins.rows[0] });
  }

  res.json({ ok: true, character: r.rows[0] });
});

// DM/Admin
app.post("/api/admin/login", async (req, res) => {
  const schema = z.object({ username: z.string().min(1), password: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

  const { username, password } = parsed.data;
  const r = await dbQuery(
    `SELECT id, username, password_hash, role, must_change_password FROM users WHERE username=$1`,
    [username]
  );
  if (r.rowCount === 0) return res.status(401).json({ error: "Invalid credentials" });

  const u = r.rows[0];
  if (u.role !== "admin") return res.status(403).json({ error: "Admin only" });

  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  req.session.user = {
    id: u.id,
    username: u.username,
    role: u.role,
    mustChangePassword: u.must_change_password
  };
  res.json({ ok: true, user: req.session.user });
});

app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const r = await dbQuery(`SELECT id, username, role, must_change_password, created_at FROM users ORDER BY id ASC`);
  res.json({ ok: true, users: r.rows });
});

async function main() {
  const start = Date.now();
  for (;;) {
    try {
      await dbQuery("SELECT 1");
      break;
    } catch {
      if (Date.now() - start > 120000) throw new Error("DB not reachable in time");
      console.log("[db] waiting for postgres...");
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  await ensureSchema();

  app.listen(PORT, () => console.log(`[app] listening on :${PORT}`));
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
