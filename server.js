/**
 * Veilwatch deployable server (single URL):
 * - Serves your full site from SITE_DIR (default: /app/site)
 * - Provides API endpoints under /api/*
 * - Persists state in Postgres (vw_state table, JSONB)
 *
 * Put your full website files in: ./api/site (copied into the image).
 * The homepage served at / will be: /app/site/index.html
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const zlib = require("zlib");

const { Pool } = require("pg");

const PORT = parseInt(process.env.PORT || "8080", 10);
const SITE_DIR = process.env.SITE_DIR || "/app/site";
const DATA_DIR = process.env.DATA_DIR || "/app/data";
const DM_KEY = process.env.VEILWATCH_DM_KEY || "VEILWATCHDM";
const DATABASE_URL = process.env.DATABASE_URL;

function ensureDir(p){ try{ fs.mkdirSync(p, {recursive:true}); } catch(_){} }
ensureDir(DATA_DIR);

const DEFAULT_STATE = {
  settings: { dmKey: DM_KEY, theme: { accent: "#00e5ff" } },
  shops: {
    enabled: true,
    activeShopId: "hq",
    list: [
      { id:"hq", name:"Cock & Dagger HQ", items: [
        { id:"ammo_9mm", name:"9mm Ammo (box)", category:"Ammo", cost:20, weight:1, notes:"50 rounds (reserve)", stock:"∞" },
        { id:"flashlight", name:"Flashlight (high lumen)", category:"Gear", cost:35, weight:1, notes:"Unique", stock:"∞" },
      ]},
    ]
  },
  notifications: { nextId: 1, items: [] },
  clues: { archived: [] },
  characters: []
};

function readBody(req){
  return new Promise((resolve,reject)=>{
    let b="";
    req.on("data", c=>{ b+=c; if(b.length>5e6) req.destroy(); });
    req.on("end", ()=>resolve(b));
    req.on("error", reject);
  });
}

function json(res, code, obj){
  const s = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store"
  });
  res.end(s);
}

function text(res, code, body, ctype="text/plain; charset=utf-8"){
  res.writeHead(code, {
    "Content-Type":ctype,
    "Cache-Control":"no-store"
  });
  res.end(body);
}

function setCORS(res){
  // Same-origin by default. If you later separate frontend/backend hosts, set explicit origin.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-DM-Key");
}

function safeJoin(base, target){
  const targetPath = path.normalize(path.join(base, target));
  if(!targetPath.startsWith(path.normalize(base))) return null;
  return targetPath;
}

function mimeFor(fp){
  const ext = path.extname(fp).toLowerCase();
  return ({
    ".html":"text/html; charset=utf-8",
    ".css":"text/css; charset=utf-8",
    ".js":"application/javascript; charset=utf-8",
    ".json":"application/json; charset=utf-8",
    ".png":"image/png",
    ".jpg":"image/jpeg",
    ".jpeg":"image/jpeg",
    ".webp":"image/webp",
    ".svg":"image/svg+xml",
    ".mp4":"video/mp4",
    ".woff":"font/woff",
    ".woff2":"font/woff2",
    ".ttf":"font/ttf",
    ".ico":"image/x-icon"
  })[ext] || "application/octet-stream";
}

function serveFile(res, fp){
  try{
    const stat = fs.statSync(fp);
    if(stat.isDirectory()){
      fp = path.join(fp, "index.html");
    }
    if(!fs.existsSync(fp)) return false;

    const ctype = mimeFor(fp);
    const raw = fs.readFileSync(fp);

    // basic gzip for text-ish files
    if(/text|javascript|json|svg/.test(ctype)){
      const gz = zlib.gzipSync(raw);
      res.writeHead(200, {
        "Content-Type": ctype,
        "Content-Encoding":"gzip",
        "Cache-Control":"no-store"
      });
      return res.end(gz);
    }

    res.writeHead(200, {"Content-Type": ctype, "Cache-Control":"no-store"});
    res.end(raw);
    return true;
  }catch(_){
    return false;
  }
}

// -------------------- DB persistence --------------------

let pool = null;

async function initDb(){
  if(!DATABASE_URL){
    console.warn("[veilwatch] DATABASE_URL not set; DB persistence disabled (file-only).");
    return;
  }
  pool = new Pool({ connectionString: DATABASE_URL });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vw_state (
      id TEXT PRIMARY KEY,
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function dbGetState(){
  if(!pool) return null;
  const r = await pool.query("SELECT state FROM vw_state WHERE id=$1", ["main"]);
  if(!r.rows.length) return null;
  return r.rows[0].state;
}

async function dbSaveState(state){
  if(!pool) return;
  await pool.query(
    "INSERT INTO vw_state (id, state) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET state=EXCLUDED.state, updated_at=NOW()",
    ["main", state]
  );
}

// Fallback file persistence (kept for safety / portability)
const STATE_PATH = path.join(DATA_DIR, "state.json");

function fileLoadState(){
  try{
    if(fs.existsSync(STATE_PATH)){
      const raw = fs.readFileSync(STATE_PATH,"utf8");
      return JSON.parse(raw);
    }
  }catch(_){}
  return null;
}

function fileSaveState(state){
  try{
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
  }catch(_){}
}

let state = DEFAULT_STATE;

async function loadState(){
  // DB first
  try{
    const s = await dbGetState();
    if(s){
      state = s;
      // keep DM key current if env changed
      state.settings ||= {};
      state.settings.dmKey = DM_KEY;
      return;
    }
  }catch(e){
    console.warn("[veilwatch] DB load failed, falling back to file:", e.message);
  }

  // File fallback
  const fsState = fileLoadState();
  if(fsState){
    state = fsState;
    state.settings ||= {};
    state.settings.dmKey = DM_KEY;
    // best effort: seed DB if available
    try{ await dbSaveState(state); } catch(_){}
    return;
  }

  // Nothing exists; seed defaults
  state = DEFAULT_STATE;
  fileSaveState(state);
  try{ await dbSaveState(state); } catch(_){}
}

async function saveState(next){
  state = next;
  fileSaveState(state);
  try{ await dbSaveState(state); } catch(e){
    console.warn("[veilwatch] DB save failed:", e.message);
  }
}

function isDM(req){
  const k = String(req.headers["x-dm-key"] || "");
  return k && k === state?.settings?.dmKey;
}

// -------------------- HTTP server --------------------

const server = http.createServer(async (req,res)=>{
  setCORS(res);
  const parsed = url.parse(req.url, true);
  const p = parsed.pathname || "/";

  if(req.method === "OPTIONS"){
    res.writeHead(204);
    return res.end();
  }

  // Health
  if(p === "/api/health" && req.method === "GET"){
    return json(res, 200, { ok: true, db: !!pool, time: new Date().toISOString() });
  }

  // API
  if(p === "/api/state" && req.method === "GET"){
    return json(res, 200, state);
  }

  if(p === "/api/dm/login" && req.method === "POST"){
    const body = JSON.parse(await readBody(req) || "{}");
    if(String(body.key||"") !== state.settings.dmKey){
      return json(res, 200, {ok:false, error:"Invalid DM passkey"});
    }
    return json(res, 200, {ok:true});
  }

  if(p === "/api/character/new" && req.method === "POST"){
    const body = JSON.parse(await readBody(req) || "{}");
    const name = String(body.name||"").trim().slice(0,40) || "Unnamed";
    const id = "c_" + Math.random().toString(36).slice(2,10);
    const c = { id, name, weapons: [], inventory: [] };
    state.characters ||= [];
    state.characters.push(c);
    await saveState(state);
    return json(res, 200, {ok:true, id});
  }

  if(p === "/api/character/save" && req.method === "POST"){
    const body = JSON.parse(await readBody(req) || "{}");
    const charId = String(body.charId||"");
    const i = (state.characters||[]).findIndex(c=>c.id===charId);
    if(i<0) return json(res, 404, {ok:false});
    state.characters[i] = body.character;
    state.characters = (state.characters||[]).filter(c => !String(c?.name||"").toLowerCase().includes("example"));
    await saveState(state);
    return json(res, 200, {ok:true});
  }

  if(p === "/api/shops/save" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    state.shops = body.shops;
    await saveState(state);
    return json(res, 200, {ok:true});
  }

  if(p === "/api/notify" && req.method==="POST"){
    const body = JSON.parse(await readBody(req) || "{}");
    state.notifications ||= { nextId: 1, items: [] };
    const id = state.notifications.nextId++;
    state.notifications.items.push({ id, type: body.type||"Request", detail: body.detail||"", from: body.from||"", status:"open" });
    await saveState(state);
    return json(res, 200, {ok:true});
  }

  if(p === "/api/notifications/save" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    state.notifications = body.notifications;
    await saveState(state);
    return json(res, 200, {ok:true});
  }

  if(p === "/api/clues/save" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    state.clues = body.clues;
    await saveState(state);
    return json(res, 200, {ok:true});
  }

  // Static site
  if(p === "/" || p === "/index.html"){
    const fp = path.join(SITE_DIR, "index.html");
    if(serveFile(res, fp)) return;
    return text(res, 500, "Site missing: /app/site/index.html");
  }

  // Serve any other file from SITE_DIR (no directory traversal)
  const candidate = safeJoin(SITE_DIR, p);
  if(candidate && serveFile(res, candidate)) return;

  return text(res, 404, "Not found");
});

(async ()=>{
  await initDb();
  await loadState();
  server.listen(PORT, ()=>console.log("[veilwatch] listening on", PORT, "site:", SITE_DIR));
})();
