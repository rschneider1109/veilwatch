const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

// structuredClone polyfill (Node < 17)
if(typeof globalThis.structuredClone !== "function"){
  globalThis.structuredClone = (obj)=>JSON.parse(JSON.stringify(obj));
}
const { Pool } = require("pg");

const DM_KEY = process.env.VEILWATCH_DM_KEY || "VEILWATCHDM";
const DATABASE_URL = process.env.DATABASE_URL || "";

let pool = null;

async function initDb(){
  if(!DATABASE_URL) return;
  const maxTries = 30;
  const delayMs = 2000;
  for(let attempt=1; attempt<=maxTries; attempt++){
    try{
      pool = new Pool({ connectionString: DATABASE_URL });
      await pool.query(`
        CREATE TABLE IF NOT EXISTS vw_state (
          id TEXT PRIMARY KEY,
          state JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      return;
    } catch(e){
      pool = null;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function dbGetState(){
  if(!pool) return null;
  const r = await pool.query("SELECT state FROM vw_state WHERE id=$1", ["main"]);
  return r.rows?.[0]?.state || null;
}

async function dbSaveState(st){
  if(!pool) return;
  await pool.query(
    "INSERT INTO vw_state (id, state) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET state=EXCLUDED.state, updated_at=NOW()",
    ["main", st]
  );
}


const PORT = parseInt(process.env.PORT || "8080", 10);
const DATA_DIR = "/app/data";
const STATE_PATH = path.join(DATA_DIR, "state.json");

function ensureDir(p){ try{ fs.mkdirSync(p,{recursive:true}); } catch(e){} }

const DEFAULT_STATE = {
  settings: { dmKey: DM_KEY, theme: { accent: "#00e5ff" }, features: { shop:true, intel:true } },
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
  clues: { nextId: 1, items: [], archived: [] },
  characters: [] // no example character
};
function normalizeCluesShape(st){
  st.clues ||= structuredClone(DEFAULT_STATE.clues);
  // Support older shapes
  if(Array.isArray(st.clues)){
    st.clues = { nextId: (st.clues.reduce((mx,c)=>Math.max(mx, Number(c.id||0)),0) + 1) || 1, items: st.clues, archived: [] };
  }
  st.clues.nextId ||= 1;
  st.clues.items ||= [];
  st.clues.archived ||= [];
  return st;
}


function fileLoadState(){
  ensureDir(DATA_DIR);
  if(!fs.existsSync(STATE_PATH)){
    fs.writeFileSync(STATE_PATH, JSON.stringify(DEFAULT_STATE, null, 2), "utf8");
    return structuredClone(DEFAULT_STATE);
  }
  try{
    const raw = fs.readFileSync(STATE_PATH,"utf8");
    const st = JSON.parse(raw);
    // remove any example character
    if(Array.isArray(st.characters)){
      st.characters = st.characters.filter(c => !String(c?.name||"").toLowerCase().includes("example"));
    } else st.characters = [];
    // migrate minimal shapes
    st.settings ||= DEFAULT_STATE.settings;
    st.settings.dmKey ||= DEFAULT_STATE.settings.dmKey;
    st.settings.features ||= DEFAULT_STATE.settings.features;
    st.shops ||= DEFAULT_STATE.shops;
    st.notifications ||= DEFAULT_STATE.notifications;
    st.clues ||= DEFAULT_STATE.clues;
    st.clues.nextId ||= 1;
    st.clues.items ||= [];
    st.clues.archived ||= [];
    normalizeCluesShape(st);
    fileSaveState(st);
    return st;
  } catch(e){
    // if corrupted, back it up and reset
    try{ fs.copyFileSync(STATE_PATH, STATE_PATH + ".corrupt.bak"); } catch(_){}
    fileSaveState(structuredClone(DEFAULT_STATE));
    return structuredClone(DEFAULT_STATE);
  }
}

function fileSaveState(st){
  ensureDir(DATA_DIR);
  fs.writeFileSync(STATE_PATH, JSON.stringify(st, null, 2), "utf8");
}

async function loadState(){
  // DB first, fall back to file
  try{
    const fromDb = await dbGetState();
    if(fromDb){
      // ensure dm key follows env
      fromDb.settings ||= {};
      fromDb.settings.dmKey = DM_KEY;
      fromDb.settings.features ||= DEFAULT_STATE.settings.features;
      // ensure shapes
      fromDb.shops ||= DEFAULT_STATE.shops;
      fromDb.notifications ||= DEFAULT_STATE.notifications;
      fromDb.clues ||= DEFAULT_STATE.clues;
      fromDb.clues.nextId ||= 1;
      fromDb.clues.items ||= [];
      fromDb.clues.archived ||= [];
      normalizeCluesShape(fromDb);
      fromDb.characters ||= [];
      fileSaveState(fromDb);
      return fromDb;
    }
  } catch(_){ /* ignore */ }

  const st = fileLoadState();
  // best effort seed DB
  dbSaveState(st).catch(()=>{});
  return st;
}

function saveState(st){
  try{ normalizeFeatures(st); }catch(e){}
  fileSaveState(st);
  dbSaveState(st).catch(()=>{});

  try{ sseBroadcast(); }catch(e){}
}

let state = normalizeFeatures(structuredClone(DEFAULT_STATE));

function normalizeFeatures(st){
  if(!st.settings) st.settings = {};
  if(!st.settings.features) st.settings.features = {};
  // Intel/Clues are always enabled (no settings toggle)
  st.settings.features.intel = true;
  // Shop feature always enabled; shop open/close is handled inside Shop tab
  st.settings.features.shop = true;
  return st;
}


const SSE_CLIENTS = new Set();
function sseSend(res, event, data){
  try{
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }catch(e){}
}
function sseBroadcast(){
  const payload = { ts: Date.now() };
  for(const client of Array.from(SSE_CLIENTS)){
    if(client.res.writableEnded){ SSE_CLIENTS.delete(client); continue; }
    sseSend(client.res, "update", payload);
  }
}

const SSE_KEEPALIVE_MS = 20000;
setInterval(()=>{
  for(const client of Array.from(SSE_CLIENTS)){
    try{
      if(client.res.writableEnded){ SSE_CLIENTS.delete(client); continue; }
      // comment ping to keep proxies from closing idle connection
      client.res.write(`: ping ${Date.now()}\n\n`);
    }catch(e){
      SSE_CLIENTS.delete(client);
    }
  }
}, SSE_KEEPALIVE_MS);




function json(res, code, obj){
  const body = JSON.stringify(obj);
  res.writeHead(code, {"Content-Type":"application/json","Cache-Control":"no-store"});
  res.end(body);
}
function text(res, code, body, ctype="text/plain"){
  res.writeHead(code, {"Content-Type":ctype,"Cache-Control":"no-store"});
  res.end(body);
}
function readBody(req){
  return new Promise((resolve,reject)=>{
    let data="";
    req.on("data",chunk=>{ data += chunk; if(data.length>2_000_000){ reject(new Error("too big")); req.destroy(); }});
    req.on("end",()=>resolve(data));
  });
}

function isDM(req){
  const key = req.headers["x-dm-key"] || "";
  return key && key === state.settings.dmKey;
}


    function loadIndexHtml(){
      try{
        return fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");
      }catch(e){
        console.warn("Veilwatch OS: public/index.html not found. Did you copy the /public folder into the container image?");
        return `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Veilwatch OS - Missing public/</title>
<style>
body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;background:#0b0f14;color:#d9e2ef;margin:0;padding:32px}
.card{max-width:820px;margin:0 auto;background:#101826;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:22px}
code{background:rgba(255,255,255,.06);padding:2px 6px;border-radius:6px}
h1{margin:0 0 10px 0;font-size:22px}
p{line-height:1.45}
ul{line-height:1.6}
</style></head>
<body>
<div class="card">
  <h1>Missing <code>/public</code> folder in container</h1>
  <p>Your server is running, but the UI files are not present inside the Docker image.</p>
  <p>Fix:</p>
  <ul>
    <li>Make sure the repo includes the <code>public/</code> directory.</li>
    <li>Update your Dockerfile to copy it, e.g. <code>COPY public ./public</code></li>
    <li>Rebuild and redeploy.</li>
  </ul>
</div>
</body></html>`;
      }
    }
    const INDEX_HTML = loadIndexHtml();

const server = http.createServer(async (req,res)=>{
  const parsed = url.parse(req.url, true);
  const p = parsed.pathname || "/";
  if(p === "/" || p === "/index.html"){
    return text(res, 200, INDEX_HTML, "text/html; charset=utf-8");
  }
  if(p === "/favicon.ico"){
    res.writeHead(204, {"Cache-Control":"no-store"});
    return res.end();
  

// Static assets
if(p === "/styles.css"){
  try{
    const css = fs.readFileSync(path.join(__dirname,"public","styles.css"),"utf8");
    return text(res, 200, css, "text/css; charset=utf-8");
  }catch(e){
    return text(res, 404, "Not found");
  }
}
if(p === "/client.js"){
  try{
    const js = fs.readFileSync(path.join(__dirname,"public","client.js"),"utf8");
    return text(res, 200, js, "application/javascript; charset=utf-8");
  }catch(e){
    return text(res, 404, "Not found");
  }
}

}

  

// Static file server (for /public/*). Keeps modular UI working.
// NOTE: must come before API routing.
if(req.method === "GET"){
  const pubRoot = path.join(__dirname, "public");
  // Serve index for "/" and "/index.html"
  if(p === "/" || p === "/index.html"){
    return text(res, 200, INDEX_HTML, "text/html; charset=utf-8");
  }
  // Attempt to serve anything else from /public (styles, scripts, images)
  if(!p.startsWith("/api/") && !p.startsWith("/ws")){
    const safePath = path.normalize(p).replace(/^(\.\.(\/|\\|$))+/, "");
    const filePath = path.join(pubRoot, safePath);
    // prevent directory traversal
    if(filePath.startsWith(pubRoot)){
      try{
        if(fs.existsSync(filePath) && fs.statSync(filePath).isFile()){
          const ext = path.extname(filePath).toLowerCase();
          const mime =
            ext === ".css" ? "text/css; charset=utf-8" :
            ext === ".js"  ? "application/javascript; charset=utf-8" :
            ext === ".html"? "text/html; charset=utf-8" :
            ext === ".png" ? "image/png" :
            ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
            ext === ".svg" ? "image/svg+xml; charset=utf-8" :
            ext === ".ico" ? "image/x-icon" :
            "application/octet-stream";
          const buf = fs.readFileSync(filePath);
          res.writeHead(200, {"Content-Type": mime, "Cache-Control":"no-store"});
          return res.end(buf);
        }
      }catch(e){
        // fallthrough to normal routing
      }
    }
  }
}

// API
if(p === "/api/stream" && req.method==="GET"){
  // SSE stream. DM passes ?k=dmKey because EventSource can't set headers.
  const parsed2 = url.parse(req.url, true);
  const k = (parsed2.query||{}).k || "";
  const isDmStream = k && k === state.settings.dmKey;

  res.writeHead(200, {
    "Content-Type":"text/event-stream",
    "Cache-Control":"no-cache, no-transform",
    "Connection":"keep-alive",
    "X-Accel-Buffering":"no"
  });
  res.write("\\n");

  const client = { res, isDmStream, started: Date.now() };
  SSE_CLIENTS.add(client);

  // Initial hello + one immediate update tick
  sseSend(res, "hello", { ts: Date.now(), role: isDmStream ? "dm" : "player" });
  sseSend(res, "update", { ts: Date.now() });

  req.on("close", ()=>{
    SSE_CLIENTS.delete(client);
  });
  return;
}


// API
  if(p === "/api/state" && req.method==="GET"){
    // Never leak DM key to players
    if(!isDM(req)){
      normalizeCluesShape(state);
      const safe = (typeof structuredClone==="function") ? structuredClone(state) : JSON.parse(JSON.stringify(state));
      if(safe.settings){
        safe.settings = { theme: safe.settings.theme, features: safe.settings.features || DEFAULT_STATE.settings.features };
      }
      // Players only receive revealed clues
      if(safe.clues){
        safe.clues.items = (safe.clues.items||[]).filter(c=>String(c.visibility||"hidden")==="revealed");
        safe.clues.archived = [];
      }
      return json(res, 200, safe);
    }
    return json(res, 200, state);
  }
  if(p === "/api/dm/login" && req.method==="POST"){
    const body = JSON.parse(await readBody(req) || "{}");
    if(String(body.key||"") !== state.settings.dmKey){
      return json(res, 200, {ok:false, error:"Invalid DM passkey"});
    }
    return json(res, 200, {ok:true});
  }

  if(p === "/api/character/new" && req.method==="POST"){
    const body = JSON.parse(await readBody(req) || "{}");
    const name = String(body.name||"").trim().slice(0,40) || "Unnamed";
    const id = "c_" + Math.random().toString(36).slice(2,10);
    const c = { id, name, weapons: [], inventory: [] };
    state.characters.push(c);
    saveState(state);
    return json(res, 200, {ok:true, id});
  }
  if(p === "/api/character/save" && req.method==="POST"){
    const body = JSON.parse(await readBody(req) || "{}");
    const charId = String(body.charId||"");
    const i = state.characters.findIndex(c=>c.id===charId);
    if(i<0) return json(res, 404, {ok:false});
    state.characters[i] = body.character;
    // remove example characters just in case
    state.characters = state.characters.filter(c => !String(c?.name||"").toLowerCase().includes("example"));
    saveState(state);
    return json(res, 200, {ok:true});
  }

  if(p === "/api/shops/save" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    state.shops = body.shops;
    saveState(state);
    return json(res, 200, {ok:true});
  }

  if(p === "/api/notify" && req.method==="POST"){
    const body = JSON.parse(await readBody(req) || "{}");
    state.notifications ||= { nextId: 1, items: [] };
    const id = state.notifications.nextId++;
    state.notifications.items.push({ id, type: body.type||"Request", detail: body.detail||"", from: body.from||"", status:"open", notes: body.notes||"" });
    saveState(state);
    return json(res, 200, {ok:true});
  }
  if(p === "/api/notifications/save" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    state.notifications = body.notifications;
    saveState(state);
    return json(res, 200, {ok:true});
  }
  if(p === "/api/settings/save" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    state.settings ||= {};
    state.settings.features ||= DEFAULT_STATE.settings.features;

    if(body.features){
      state.settings.features = {
        shop: !!body.features.shop,
        intel: !!body.features.intel
      };
    }

    if(body.dmKey){
      if(process.env.VEILWATCH_DM_KEY){
        return json(res, 200, {ok:false, error:"DM key locked by env var"});
      }
      const nk = String(body.dmKey||"").trim();
      if(nk.length < 4 || nk.length > 64) return json(res, 200, {ok:false, error:"DM key must be 4-64 chars"});
      state.settings.dmKey = nk;
    }

    saveState(state);
    return json(res, 200, {ok:true});
  }
if(p === "/api/clues/delete" && req.method==="POST"){
  if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
  const body = JSON.parse(await readBody(req) || "{}");
  const id = Number(body.id||0);
  state.clues ||= structuredClone(DEFAULT_STATE.clues);
  state.clues.items ||= [];
  state.clues.archived ||= [];
  let removed = false;
  const idx = state.clues.items.findIndex(c=>c.id===id);
  if(idx>=0){ state.clues.items.splice(idx,1); removed = true; }
  const idxA = state.clues.archived.findIndex(c=>c.id===id);
  if(idxA>=0){ state.clues.archived.splice(idxA,1); removed = true; }
  if(!removed) return json(res, 404, {ok:false, error:"Not found"});
  saveState(state);
  return json(res, 200, {ok:true});
}





  if(p === "/api/clues/create" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    state.clues ||= structuredClone(DEFAULT_STATE.clues);
    state.clues.nextId ||= 1;
    state.clues.items ||= [];
    state.clues.archived ||= [];
    const id = state.clues.nextId++;
    const clue = {
      id,
      title: String(body.title||"").slice(0,120),
      details: String(body.details||"").slice(0,4000),
      source: String(body.source||"").slice(0,120),
      tags: Array.isArray(body.tags) ? body.tags.slice(0,12).map(t=>String(t).slice(0,24)) : [],
      district: String(body.district||"").slice(0,80),
      date: String(body.date||"").slice(0,32),
      visibility: "hidden",
      createdAt: Date.now()
    };
    state.clues.items.push(clue);
    saveState(state);
    return json(res, 200, {ok:true, id});
  }
  if(p === "/api/clues/update" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    const id = Number(body.id||0);
    const clue = (state.clues?.items||[]).find(c=>c.id===id);
    if(!clue) return json(res, 404, {ok:false, error:"Not found"});
    clue.title = String(body.title||"").slice(0,120);
    clue.details = String(body.details||"").slice(0,4000);
    clue.source = String(body.source||"").slice(0,120);
    clue.tags = Array.isArray(body.tags) ? body.tags.slice(0,12).map(t=>String(t).slice(0,24)) : [];
    clue.district = String(body.district||"").slice(0,80);
    clue.date = String(body.date||"").slice(0,32);
    saveState(state);
    return json(res, 200, {ok:true});
  }
  if(p === "/api/clues/visibility" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    const id = Number(body.id||0);
    const vis = String(body.visibility||"hidden");
    const clue = (state.clues?.items||[]).find(c=>c.id===id);
    if(!clue) return json(res, 404, {ok:false, error:"Not found"});
    clue.visibility = (vis==="revealed") ? "revealed" : "hidden";
    if(clue.visibility==="revealed") clue.revealedAt = Date.now();
    saveState(state);
    return json(res, 200, {ok:true});
  }
  if(p === "/api/clues/archive" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    const id = Number(body.id||0);
    state.clues ||= structuredClone(DEFAULT_STATE.clues);
    state.clues.items ||= [];
    state.clues.archived ||= [];
    const idx = state.clues.items.findIndex(c=>c.id===id);
    if(idx<0) return json(res, 404, {ok:false, error:"Not found"});
    const clue = state.clues.items.splice(idx,1)[0];
    clue.archivedAt = Date.now();
    state.clues.archived.unshift(clue);
    saveState(state);
    return json(res, 200, {ok:true});
  }
  if(p === "/api/clues/restoreActive" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    const id = Number(body.id||0);
    state.clues ||= structuredClone(DEFAULT_STATE.clues);
    state.clues.items ||= [];
    state.clues.archived ||= [];
    const idx = state.clues.archived.findIndex(c=>c.id===id);
    if(idx<0) return json(res, 404, {ok:false, error:"Not found"});
    const clue = state.clues.archived.splice(idx,1)[0];
    state.clues.items.unshift(clue);
    saveState(state);
    return json(res, 200, {ok:true});
  }



  if(p === "/api/clues/save" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    state.clues = body.clues;
    saveState(state);
    return json(res, 200, {ok:true});
  }

  return text(res, 404, "Not found");
});

(async ()=>{
  try{ await initDb(); } catch(_){ /* ignore */ }
  state = await loadState();
  server.listen(PORT, ()=>console.log("Veilwatch OS listening on", PORT));
})();
