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
  fileSaveState(st);
  dbSaveState(st).catch(()=>{});

  try{ sseBroadcast(); }catch(e){}
}

let state = structuredClone(DEFAULT_STATE);

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

const INDEX_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Veilwatch OS</title>
<style>
:root{
  --bg:#060b10; --panel:#0b141d; --panel2:#0a1a22;
  --ink:#d8f6ff; --muted:#86b7c6;
  --accent:#00e5ff; --accent2:#00bcd4;
  --line:rgba(0,229,255,.18); --glow:rgba(0,229,255,.25);
}
*{box-sizing:border-box;}
body{margin:0;background:radial-gradient(1200px 600px at 30% 0%, rgba(0,229,255,.10), transparent 60%),
     radial-gradient(900px 500px at 70% 20%, rgba(0,229,255,.06), transparent 55%),
     var(--bg); color:var(--ink); font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;}
header{display:flex;gap:12px;align-items:center;padding:14px 18px;border-bottom:1px solid var(--line);background:rgba(2,8,12,.6);backdrop-filter:blur(6px);}
.brand{font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);}
.pill{font-size:12px;color:var(--muted);border:1px solid var(--line);padding:4px 10px;border-radius:999px;}
main{padding:18px;max-width:1200px;margin:0 auto;}
.nav{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;}
.btn{border:1px solid var(--line);background:linear-gradient(180deg, rgba(0,229,255,.10), rgba(0,229,255,.03));
     color:var(--ink);padding:10px 12px;border-radius:12px;cursor:pointer;box-shadow:0 0 0 1px rgba(0,229,255,.08) inset;}
.btn.active{outline:2px solid rgba(0,229,255,.25);box-shadow:0 0 30px rgba(0,229,255,.10);}
.grid{display:grid;gap:12px;}
.cards{grid-template-columns:repeat(12,1fr);}
.card{grid-column:span 4;background:linear-gradient(180deg, rgba(0,229,255,.06), rgba(0,229,255,.02));
      border:1px solid var(--line);border-radius:16px;padding:14px;box-shadow:0 10px 30px rgba(0,0,0,.35);}
.card h3{margin:0 0 6px 0;font-size:14px;color:var(--accent);}
.mini{color:var(--muted);font-size:12px;line-height:1.4;}
.panel{background:linear-gradient(180deg, rgba(0,229,255,.05), rgba(0,229,255,.02));
       border:1px solid var(--line);border-radius:16px;padding:14px;}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
.input, select, textarea{background:rgba(2,10,14,.7);color:var(--ink);border:1px solid var(--line);
  border-radius:12px;padding:10px 12px;outline:none;}
.input:focus, select:focus, textarea:focus{border-color:rgba(0,229,255,.45);box-shadow:0 0 0 4px rgba(0,229,255,.08);}
hr{border:none;border-top:1px solid var(--line);margin:12px 0;}
.hidden{display:none;}
.badge{font-size:11px;color:var(--muted);border:1px solid var(--line);padding:2px 8px;border-radius:999px;}
table{width:100%;border-collapse:collapse;}
th,td{border-bottom:1px solid var(--line);padding:10px 8px;text-align:left;font-size:13px;}
th{color:var(--muted);font-weight:600;}
.smallbtn{padding:8px 10px;border-radius:10px;}
.right{margin-left:auto;}
.toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:rgba(6,16,22,.9);
  border:1px solid var(--line);border-radius:14px;padding:10px 12px;color:var(--ink);box-shadow:0 10px 30px rgba(0,0,0,.5);display:none;}
/* Login overlay */
#loginOverlay{position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:999;}
.loginCard{width:min(520px,92vw);}
.loginTitle{display:flex;align-items:center;gap:10px;margin:0 0 8px 0;}
.loginTitle span{color:var(--accent);font-weight:700;letter-spacing:.08em;text-transform:uppercase;}

/* Intel live indicator */
.intel-indicator{display:inline-flex;align-items:center;gap:6px;margin-left:8px;padding:2px 8px;border-radius:999px;font-size:12px;line-height:18px;border:1px solid rgba(255,80,80,.45);background:rgba(255,60,60,.12);color:#ff6b6b;}
.intel-indicator.hidden{display:none;}
.intel-glow{box-shadow:0 0 0 rgba(255,60,60,0);animation:intelPulse 1.2s ease-in-out infinite;}
@keyframes intelPulse{0%{box-shadow:0 0 0 rgba(255,60,60,.0);}50%{box-shadow:0 0 18px rgba(255,60,60,.55);}100%{box-shadow:0 0 0 rgba(255,60,60,.0);}}
</style>
</head>
<body>
<div id="loginOverlay">
  <div class="panel loginCard">
    <div class="loginTitle"><span>VEILWATCH ACCESS</span><span class="badge" id="buildTag">v4.3</span></div>
    <div class="mini">Choose a role. DM requires the passkey. Player is local to this browser.</div>
    <hr/>
    <div class="grid" style="grid-template-columns:repeat(12,1fr);gap:10px;">
      <div style="grid-column:span 12;" class="row">
        <input class="input" id="whoName" placeholder="Display name" style="flex:1;min-width:220px;"/>
        <select id="whoRole">
          <option value="player">Player</option>
          <option value="dm">DM</option>
        </select>
      </div>
      <div style="grid-column:span 12;" class="row" id="dmKeyRow">
        <input class="input" id="dmKey" placeholder="DM passkey" style="flex:1;min-width:220px;"/>
        <button class="btn smallbtn" id="loginBtn">Login</button>
      </div>
      <div style="grid-column:span 12;" class="row hidden" id="playerBtnRow">
        <button class="btn" id="loginPlayerBtn">Enter as Player</button>
      </div>
    </div>
    <div class="mini" style="margin-top:10px;color:var(--muted);">Tip: DM passkey is stored server-side in Settings.</div>
  </div>
</div>

<header>
  <div class="brand">VEILWATCH OS</div>
  <div class="pill" id="whoPill">Not logged in</div>
  <div class="pill" id="shopPill">Shop: --</div>
  <div class="pill right" id="clockPill">--:--</div>
</header>

<main>
  <div class="nav">
    <button class="btn active" data-tab="home">Home</button>
    <button class="btn" data-tab="character">Character</button>
    <button class="btn" data-tab="intel">Intel</button>
    <button class="btn" data-tab="shop">Shop</button>
    <button class="btn hidden" id="settingsTabBtn" data-tab="settings">Settings</button>
  </div>

  <section id="tab-home" class="grid cards">
    <div class="card" style="grid-column:span 4;">
      <h3>Active Character</h3>
      <div class="mini" id="activeCharMini">None selected</div>
    </div>
    <div class="card" style="grid-column:span 4;">
      <h3>Save State</h3>
      <div class="mini">Auto-saved to server volume</div>
      <div class="mini" id="saveMini">OK</div>
    </div>
    <div class="card" style="grid-column:span 4;">
      <h3>Session Clock</h3>
      <div class="mini" id="sessionClockMini">00:00</div>
    </div>
    <div class="panel" style="grid-column:span 12;">
      <h3 style="margin:0 0 8px 0;color:var(--accent);">Quick Launch</h3>
      <div class="row">
        <button class="btn" data-go="character">Character</button>
        <button class="btn" data-go="intel">Intel</button>
        <button class="btn" data-go="shop">Shop</button>
      </div>

      <div id="ctab-sheet" class="hidden" style="margin-top:12px;">
        <div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end;">
          <div style="min-width:160px;">
            <div class="mini" style="margin-bottom:6px;">HP (current / max)</div>
            <input class="input" id="hpCur" placeholder="0" style="width:120px;"/> <span class="mini">/</span>
            <input class="input" id="hpMax" placeholder="0" style="width:120px;"/>
          </div>
          <div style="min-width:140px;">
            <div class="mini" style="margin-bottom:6px;">Temp HP</div>
            <input class="input" id="hpTemp" placeholder="0" style="width:120px;"/>
          </div>
          <div style="min-width:110px;">
            <div class="mini" style="margin-bottom:6px;">AC</div>
            <input class="input" id="acVal" placeholder="0" style="width:90px;"/>
          </div>
          <div style="min-width:130px;">
            <div class="mini" style="margin-bottom:6px;">Initiative</div>
            <input class="input" id="initVal" placeholder="+0" style="width:110px;"/>
          </div>
          <div style="min-width:140px;">
            <div class="mini" style="margin-bottom:6px;">Speed</div>
            <input class="input" id="spdVal" placeholder="30" style="width:110px;"/>
          </div>
          <div style="min-width:160px;">
            <div class="mini" style="margin-bottom:6px;">Money (cash / bank)</div>
            <input class="input" id="cashVal" placeholder="0" style="width:120px;"/> <span class="mini">/</span>
            <input class="input" id="bankVal" placeholder="0" style="width:120px;"/>
          </div>
        </div>

        <hr/>

        <div class="row" style="gap:10px;flex-wrap:wrap;">
          <div class="pill">Stats</div>
          <div class="mini">STR/DEX/CON/INT/WIS/CHA</div>
        </div>
        <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:8px;">
          <input class="input" id="statSTR" placeholder="STR" style="width:90px;"/>
          <input class="input" id="statDEX" placeholder="DEX" style="width:90px;"/>
          <input class="input" id="statCON" placeholder="CON" style="width:90px;"/>
          <input class="input" id="statINT" placeholder="INT" style="width:90px;"/>
          <input class="input" id="statWIS" placeholder="WIS" style="width:90px;"/>
          <input class="input" id="statCHA" placeholder="CHA" style="width:90px;"/>
        </div>

        <hr/>

        <div class="row" style="gap:10px;flex-wrap:wrap;">
          <div class="pill">Conditions</div>
          <div class="mini">Toggle active conditions.</div>
        </div>
        <div class="row" id="condRow" style="gap:10px;flex-wrap:wrap;margin-top:8px;"></div>

        <hr/>

        <div class="row" style="gap:10px;flex-wrap:wrap;">
          <div style="flex:1;min-width:260px;">
            <div class="mini" style="margin-bottom:6px;">Notes / Bio</div>
            <textarea class="input" id="notesBio" placeholder="Background, contacts, aliases..." style="width:100%;min-height:140px;resize:vertical;"></textarea>
          </div>
        </div>

        <div class="row" style="margin-top:10px;gap:10px;flex-wrap:wrap;">
          <button class="btn smallbtn" id="saveSheetBtn">Save Sheet</button>
          <button class="btn smallbtn hidden" id="dupCharBtn">Duplicate Character</button>
          <button class="btn smallbtn hidden" id="delCharBtn">Delete Character</button>
        </div>

        <div class="mini" style="margin-top:8px;color:var(--muted);">Sheet is stored with the character. Delete/Duplicate are DM-only.</div>
      </div>
    </div>
  </section>

  <section id="tab-character" class="hidden">
    <div class="panel">
      <div class="row">
        <select id="charSel"></select>
        <button class="btn smallbtn" id="newCharBtn">New Character</button>
      </div>
      <hr/>
      <div class="row">
        <button class="btn active" data-ctab="actions">Actions</button>
        <button class="btn" data-ctab="inventory">Inventory</button>
        <button class="btn" data-ctab="sheet">Sheet</button>
      </div>

      <div id="ctab-actions" style="margin-top:12px;">
        <table>
          <thead><tr><th>WEAPON</th><th>RANGE</th><th>HIT/DC</th><th>DAMAGE</th><th></th></tr></thead>
          <tbody id="weapBody"></tbody>
        </table>
        <div class="mini" style="margin-top:8px;">Weapons live here. Ammo lines under weapons track starting/current. Purchases go to Inventory.</div>
      </div>

      <div id="ctab-inventory" class="hidden" style="margin-top:12px;">
        <table>
          <thead><tr><th>CATEGORY</th><th>EQUIPMENT NAME</th><th>WEIGHT</th><th>QTY</th><th>COST ($)</th><th>NOTES</th><th></th></tr></thead>
          <tbody id="invBody"></tbody>
        </table>
        <button class="btn smallbtn" id="addInvBtn" style="margin-top:10px;">Add Inventory Item</button>
      </div>

      <div id="ctab-sheet" class="hidden" style="margin-top:12px;">
        <div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end;">
          <div style="min-width:160px;">
            <div class="mini" style="margin-bottom:6px;">HP (current / max)</div>
            <input class="input" id="hpCur" placeholder="0" style="width:120px;"/> <span class="mini">/</span>
            <input class="input" id="hpMax" placeholder="0" style="width:120px;"/>
          </div>
          <div style="min-width:140px;">
            <div class="mini" style="margin-bottom:6px;">Temp HP</div>
            <input class="input" id="hpTemp" placeholder="0" style="width:120px;"/>
          </div>
          <div style="min-width:110px;">
            <div class="mini" style="margin-bottom:6px;">AC</div>
            <input class="input" id="acVal" placeholder="0" style="width:90px;"/>
          </div>
          <div style="min-width:130px;">
            <div class="mini" style="margin-bottom:6px;">Initiative</div>
            <input class="input" id="initVal" placeholder="+0" style="width:110px;"/>
          </div>
          <div style="min-width:140px;">
            <div class="mini" style="margin-bottom:6px;">Speed</div>
            <input class="input" id="spdVal" placeholder="30" style="width:110px;"/>
          </div>
          <div style="min-width:160px;">
            <div class="mini" style="margin-bottom:6px;">Money (cash / bank)</div>
            <input class="input" id="cashVal" placeholder="0" style="width:120px;"/> <span class="mini">/</span>
            <input class="input" id="bankVal" placeholder="0" style="width:120px;"/>
          </div>
        </div>

        <hr/>

        <div class="row" style="gap:10px;flex-wrap:wrap;">
          <div class="pill">Stats</div>
          <div class="mini">STR/DEX/CON/INT/WIS/CHA</div>
        </div>
        <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:8px;">
          <input class="input" id="statSTR" placeholder="STR" style="width:90px;"/>
          <input class="input" id="statDEX" placeholder="DEX" style="width:90px;"/>
          <input class="input" id="statCON" placeholder="CON" style="width:90px;"/>
          <input class="input" id="statINT" placeholder="INT" style="width:90px;"/>
          <input class="input" id="statWIS" placeholder="WIS" style="width:90px;"/>
          <input class="input" id="statCHA" placeholder="CHA" style="width:90px;"/>
        </div>

        <hr/>

        <div class="row" style="gap:10px;flex-wrap:wrap;">
          <div class="pill">Conditions</div>
          <div class="mini">Toggle active conditions.</div>
        </div>
        <div class="row" id="condRow" style="gap:10px;flex-wrap:wrap;margin-top:8px;"></div>

        <hr/>

        <div class="row" style="gap:10px;flex-wrap:wrap;">
          <div style="flex:1;min-width:260px;">
            <div class="mini" style="margin-bottom:6px;">Notes / Bio</div>
            <textarea class="input" id="notesBio" placeholder="Background, contacts, aliases..." style="width:100%;min-height:140px;resize:vertical;"></textarea>
          </div>
        </div>

        <div class="row" style="margin-top:10px;gap:10px;flex-wrap:wrap;">
          <button class="btn smallbtn" id="saveSheetBtn">Save Sheet</button>
          <button class="btn smallbtn hidden" id="dupCharBtn">Duplicate Character</button>
          <button class="btn smallbtn hidden" id="delCharBtn">Delete Character</button>
        </div>

        <div class="mini" style="margin-top:8px;color:var(--muted);">Sheet is stored with the character. Delete/Duplicate are DM-only.</div>
      </div>
    </div>
  </section>

  <section id="tab-intel" class="hidden">
    <div class="panel">
      <div id="intelDisabledMsg" class="mini hidden">Intel feature is disabled.</div>
      <div class="row">
        <div class="pill">DM Tools</div>
        <div class="mini">Notifications + Archived Clues appear when logged in as DM.</div>
      </div>
      <hr/>
      <div id="dmPanels" class="hidden">
        <div class="row" style="margin-bottom:10px;">
          <button class="btn active" data-itab="notifications">Notifications</button>
          <button class="btn" data-itab="clues">Clues</button>
          <button class="btn" data-itab="archived">Archived</button>
        </div>
        <div id="itab-notifications">
          <div class="row" style="gap:10px;flex-wrap:wrap;margin-bottom:10px;">
            <button class="btn smallbtn" id="dmNewNotifBtn">New Notification</button>
          </div>
          <table>
            <thead><tr><th>ID</th><th>TYPE</th><th>DETAIL</th><th>FROM</th><th>STATUS</th><th>NOTES</th><th></th></tr></thead>
            <tbody id="notifBody"></tbody>
          </table>
          <button class="btn smallbtn" id="clearResolvedBtn" style="margin-top:10px;">Clear Resolved</button>
        </div>
        <div id="itab-clues" class="hidden">
          <div class="row" style="gap:10px;flex-wrap:wrap;margin-bottom:10px;">
            <button class="btn smallbtn" id="newClueBtn">New Clue</button>
          </div>
          <table>
            <thead><tr><th>ID</th><th>TITLE</th><th>VISIBILITY</th><th>TAGS</th><th>DISTRICT</th><th>DATE</th><th></th></tr></thead>
            <tbody id="clueBody"></tbody>
          </table>
          <div class="mini" style="margin-top:8px;color:var(--muted);">Hidden=DM only. Revealed=players see it. Archive moves it to Archived.</div>
        </div>
        <div id="itab-archived" class="hidden">
          <table>
            <thead><tr><th>CLUE</th><th>NOTES</th><th></th></tr></thead>
            <tbody id="archBody"></tbody>
          </table>
        </div>
      </div>
      <div id="playerIntel">
        <div class="row" style="gap:10px;flex-wrap:wrap;align-items:center;">
          <div class="pill">Intel</div>
          <input class="input" id="intelSearch" placeholder="Search clues..." style="flex:1;min-width:220px;"/>
          <input class="input" id="intelTag" placeholder="Tag filter (optional)" style="width:200px;"/>
          <input class="input" id="intelDistrict" placeholder="District filter (optional)" style="width:200px;"/>
          <button class="btn smallbtn" id="intelClearFilters">Clear</button>
        </div>
        <hr/>
        <div class="row" style="gap:10px;align-items:center;">
          <div class="pill">Session Recaps</div>
          <div class="mini">Last 5 revealed updates.</div>
        </div>
        <div id="intelSession Recaps" class="mini" style="margin-top:8px;"></div>
        <hr/>
        <table>
          <thead><tr><th>TITLE</th><th>TAGS</th><th>DISTRICT</th><th>DATE</th><th>DETAILS</th></tr></thead>
          <tbody id="intelBody"></tbody>
        </table>

        <hr/>
        <div class="row" style="gap:10px;align-items:center;">
          <div class="pill">Your Requests</div>
          <div class="mini">What you have sent to the DM.</div>
        </div>
        <table style="margin-top:8px;">
          <thead><tr><th>ID</th><th>TYPE</th><th>DETAIL</th><th>STATUS</th><th>DM NOTES</th></tr></thead>
          <tbody id="playerReqBody"></tbody>
        </table>
      </div>

      <div id="ctab-sheet" class="hidden" style="margin-top:12px;">
        <div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end;">
          <div style="min-width:160px;">
            <div class="mini" style="margin-bottom:6px;">HP (current / max)</div>
            <input class="input" id="hpCur" placeholder="0" style="width:120px;"/> <span class="mini">/</span>
            <input class="input" id="hpMax" placeholder="0" style="width:120px;"/>
          </div>
          <div style="min-width:140px;">
            <div class="mini" style="margin-bottom:6px;">Temp HP</div>
            <input class="input" id="hpTemp" placeholder="0" style="width:120px;"/>
          </div>
          <div style="min-width:110px;">
            <div class="mini" style="margin-bottom:6px;">AC</div>
            <input class="input" id="acVal" placeholder="0" style="width:90px;"/>
          </div>
          <div style="min-width:130px;">
            <div class="mini" style="margin-bottom:6px;">Initiative</div>
            <input class="input" id="initVal" placeholder="+0" style="width:110px;"/>
          </div>
          <div style="min-width:140px;">
            <div class="mini" style="margin-bottom:6px;">Speed</div>
            <input class="input" id="spdVal" placeholder="30" style="width:110px;"/>
          </div>
          <div style="min-width:160px;">
            <div class="mini" style="margin-bottom:6px;">Money (cash / bank)</div>
            <input class="input" id="cashVal" placeholder="0" style="width:120px;"/> <span class="mini">/</span>
            <input class="input" id="bankVal" placeholder="0" style="width:120px;"/>
          </div>
        </div>

        <hr/>

        <div class="row" style="gap:10px;flex-wrap:wrap;">
          <div class="pill">Stats</div>
          <div class="mini">STR/DEX/CON/INT/WIS/CHA</div>
        </div>
        <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:8px;">
          <input class="input" id="statSTR" placeholder="STR" style="width:90px;"/>
          <input class="input" id="statDEX" placeholder="DEX" style="width:90px;"/>
          <input class="input" id="statCON" placeholder="CON" style="width:90px;"/>
          <input class="input" id="statINT" placeholder="INT" style="width:90px;"/>
          <input class="input" id="statWIS" placeholder="WIS" style="width:90px;"/>
          <input class="input" id="statCHA" placeholder="CHA" style="width:90px;"/>
        </div>

        <hr/>

        <div class="row" style="gap:10px;flex-wrap:wrap;">
          <div class="pill">Conditions</div>
          <div class="mini">Toggle active conditions.</div>
        </div>
        <div class="row" id="condRow" style="gap:10px;flex-wrap:wrap;margin-top:8px;"></div>

        <hr/>

        <div class="row" style="gap:10px;flex-wrap:wrap;">
          <div style="flex:1;min-width:260px;">
            <div class="mini" style="margin-bottom:6px;">Notes / Bio</div>
            <textarea class="input" id="notesBio" placeholder="Background, contacts, aliases..." style="width:100%;min-height:140px;resize:vertical;"></textarea>
          </div>
        </div>

        <div class="row" style="margin-top:10px;gap:10px;flex-wrap:wrap;">
          <button class="btn smallbtn" id="saveSheetBtn">Save Sheet</button>
          <button class="btn smallbtn hidden" id="dupCharBtn">Duplicate Character</button>
          <button class="btn smallbtn hidden" id="delCharBtn">Delete Character</button>
        </div>

        <div class="mini" style="margin-top:8px;color:var(--muted);">Sheet is stored with the character. Delete/Duplicate are DM-only.</div>
      </div>
    </div>
  </section>

  <section id="tab-shop" class="hidden">
    <div class="panel">
      <div class="row">
        <div class="pill" id="shopEnabledPill">Shop: --</div>
        <div class="right row" id="dmShopRow" style="gap:8px;">
          <button class="btn smallbtn" id="toggleShopBtn">Toggle Shop</button>
          <button class="btn smallbtn" id="addShopBtn">New Shop</button>
        </div>
      </div>
      <hr/>
      <div class="row">
        <select id="shopSel"></select>
        <button class="btn smallbtn hidden" id="editShopBtn">Edit Shop</button>
      </div>
      <hr/>
      <table>
        <thead><tr><th>ITEM</th><th>CATEGORY</th><th>COST</th><th>WEIGHT</th><th>NOTES</th><th>STOCK</th><th></th></tr></thead>
        <tbody id="shopBody"></tbody>
      </table>
      <div class="mini" style="margin-top:10px;">Players can add shop items to Inventory. DM can customize each shop.</div>
    </div>
  </section>

  <section id="tab-settings" class="hidden">
    <div class="panel">
      <div class="row">
        <div class="pill">Admin / Settings</div>
        <div class="mini">DM only. Export/import state, reset, feature toggles.</div>
      </div>
      <hr/>
      <div class="row" style="gap:10px;flex-wrap:wrap;">
        <button class="btn smallbtn" id="exportStateBtn">Export State JSON</button>
        <button class="btn smallbtn" id="importStateBtn">Import State JSON</button>
        <button class="btn smallbtn" id="resetStateBtn">Reset State</button>
      </div>
      <hr/>
      <div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end;">
        <div style="min-width:240px;">
          <div class="mini" style="margin-bottom:6px;">DM Passkey (UI change only if env var is not set)</div>
          <input class="input" id="dmKeyNew" placeholder="New DM passkey" style="width:100%;"/>
        </div>
        <button class="btn smallbtn" id="saveDmKeyBtn">Save DM Passkey</button>
      </div>
      <hr/>
      <div class="row" style="gap:14px;flex-wrap:wrap;">
        <label class="row" style="gap:8px;"><input type="checkbox" id="featShop"/> <span class="mini">Shop enabled</span></label>
        <label class="row" style="gap:8px;"><input type="checkbox" id="featIntel"/> <span class="mini">Intel/Clues enabled</span></label>
      </div>
      <div class="mini" style="margin-top:10px;color:var(--muted);">Tip: keep backups before imports. State is auto-saved.</div>
    </div>
  </section>
</main>

<div class="toast" id="toast"></div>

<script>
function vwModalBaseSetup(title, okText, cancelText){
  const modal = document.getElementById("vwModal");
  const mTitle = document.getElementById("vwModalTitle");
  const mBody  = document.getElementById("vwModalBody");
  const btnOk  = document.getElementById("vwModalOk");
  const btnCan = document.getElementById("vwModalCancel");

  mTitle.textContent = title || "Modal";
  btnOk.textContent = okText || "OK";
  btnCan.textContent = cancelText || "Cancel";

  return { modal, mBody, btnOk, btnCan };
}

function vwModalInput(opts){
  opts ||= {};
  const title = opts.title || "Input";
  const label = opts.label || "Value";
  const placeholder = String(opts.placeholder || "").replace(/"/g, "&quot;");
  const okText = opts.okText || "OK";
  const cancelText = opts.cancelText || "Cancel";
  const value = String(opts.value || "");

  return new Promise((resolve) => {
    const ui = vwModalBaseSetup(title, okText, cancelText);

    ui.mBody.innerHTML =
      '<div style="margin-bottom:8px;opacity:.9">' + label + "</div>" +
      '<input id="vwModalInput" placeholder="' + placeholder + '" ' +
      'style="width:100%;padding:12px;border-radius:12px;border:1px solid #2b3a4d;' +
      'background:rgba(255,255,255,.03);color:#e9f1ff;outline:none;" />';

    const input = document.getElementById("vwModalInput");
    input.value = value;

    function close(val){
      ui.modal.style.display = "none";
      ui.btnOk.onclick = null;
      ui.btnCan.onclick = null;
      ui.modal.onclick = null;
      document.onkeydown = null;
      resolve(val);
    }

    ui.btnOk.onclick = () => close((input.value || "").trim());
    ui.btnCan.onclick = () => close(null);

    ui.modal.onclick = (e) => { if(e.target === ui.modal) close(null); };

    document.onkeydown = (e) => {
      if(e.key === "Escape") close(null);
      if(e.key === "Enter") close((input.value || "").trim());
    };

    ui.modal.style.display = "flex";
    setTimeout(() => input.focus(), 0);
  });
}

function vwModalConfirm(opts){
  opts ||= {};
  const title = opts.title || "Confirm";
  const message = opts.message || "Are you sure?";
  const okText = opts.okText || "Yes";
  const cancelText = opts.cancelText || "No";

  return new Promise((resolve) => {
    const ui = vwModalBaseSetup(title, okText, cancelText);

    ui.mBody.innerHTML =
      '<div style="line-height:1.5;opacity:.95">' + message + "</div>";

    function close(val){
      ui.modal.style.display = "none";
      ui.btnOk.onclick = null;
      ui.btnCan.onclick = null;
      ui.modal.onclick = null;
      document.onkeydown = null;
      resolve(val);
    }

    ui.btnOk.onclick = () => close(true);
    ui.btnCan.onclick = () => close(false);
    ui.modal.onclick = (e) => { if(e.target === ui.modal) close(false); };

    document.onkeydown = (e) => {
      if(e.key === "Escape") close(false);
      if(e.key === "Enter") close(true);
    };

    ui.modal.style.display = "flex";
  });
}

function vwModalForm(opts){
  opts ||= {};
  const title = opts.title || "Form";
  const fields = Array.isArray(opts.fields) ? opts.fields : [];
  const okText = opts.okText || "Save";
  const cancelText = opts.cancelText || "Cancel";

  function escAttr(s){
    return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  return new Promise((resolve) => {
    const ui = vwModalBaseSetup(title, okText, cancelText);

    let html = "";
    for(const f of fields){
      const key = f.key;
      const label = f.label || key;
      const placeholder = escAttr(f.placeholder || "");
      const value = escAttr(f.value || "");
      const type = (f.type || "text");
      html +=
        '<div style="margin:10px 0 6px;opacity:.9">' + label + "</div>" +
        (type==="textarea"
          ? ('<textarea class="vwFormInput" data-key="' + escAttr(key) + '" placeholder="' + placeholder + '" ' +
             'style="width:100%;min-height:110px;padding:12px;border-radius:12px;border:1px solid #2b3a4d;' +
             'background:rgba(255,255,255,.03);color:#e9f1ff;outline:none;resize:vertical;">' + value + ' </textarea>')
          : ('<input class="vwFormInput" data-key="' + escAttr(key) + '" ' +
             'placeholder="' + placeholder + '" value="' + value + '" ' +
             'style="width:100%;padding:12px;border-radius:12px;border:1px solid #2b3a4d;' +
             'background:rgba(255,255,255,.03);color:#e9f1ff;outline:none;" />')
        );
    }

    ui.mBody.innerHTML = html || '<div style="opacity:.85">No fields</div>';

    const inputs = Array.from(ui.mBody.querySelectorAll(".vwFormInput"));

    function collect(){
      const out = {};
      for(const inp of inputs){
        out[inp.dataset.key] = (inp.value || "").trim();
      }
      return out;
    }

    function close(val){
      ui.modal.style.display = "none";
      ui.btnOk.onclick = null;
      ui.btnCan.onclick = null;
      ui.modal.onclick = null;
      document.onkeydown = null;
      resolve(val);
    }

    ui.btnOk.onclick = () => close(collect());
    ui.btnCan.onclick = () => close(null);
    ui.modal.onclick = (e) => { if(e.target === ui.modal) close(null); };

    document.onkeydown = (e) => {
      if(e.key === "Escape") close(null);
      if(e.key === "Enter") close(collect());
    };

    ui.modal.style.display = "flex";
    if(inputs[0]) setTimeout(() => inputs[0].focus(), 0);
  });
}

let SESSION = { role:null, name:null, dmKey:null, activeCharId:null, sessionStart:Date.now() };
function esc(s){ return String(s||"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }
function toast(msg){
  const t=document.getElementById("toast");
  t.textContent=msg; t.style.display="block";
  clearTimeout(window.__toastT); window.__toastT=setTimeout(()=>t.style.display="none",1800);
}
function setRoleUI(){
  document.getElementById("dmPanels").classList.toggle("hidden", SESSION.role!=="dm");
  document.getElementById("playerIntel").classList.toggle("hidden", SESSION.role==="dm");
  document.getElementById("dmShopRow").classList.toggle("hidden", SESSION.role!=="dm");
  document.getElementById("editShopBtn").classList.toggle("hidden", SESSION.role!=="dm");
  document.getElementById("settingsTabBtn").classList.toggle("hidden", SESSION.role!=="dm");
  document.getElementById("tab-settings").classList.toggle("hidden", SESSION.role!=="dm");
}
async function api(path, opts={}){
  opts.headers ||= {};
  opts.headers["Content-Type"]="application/json";
  if(SESSION.role==="dm" && SESSION.dmKey) opts.headers["X-DM-Key"]=SESSION.dmKey;

  const r = await fetch(path, opts);
  const txt = await r.text();
  try { return JSON.parse(txt); }
  catch { return { ok:false, error: txt || ("HTTP " + r.status) }; }
}

let __vwES = null;
let __vwES = null;
let __vwStreamLastMsg = 0;
let __vwStreamBackoff = 1000;

function vwStartStream(){
  if(!SESSION || !SESSION.role){ return; }
  try{ if(__vwES){ __vwES.close(); __vwES=null; } }catch(e){}
  const qs = (SESSION.role==="dm" && SESSION.dmKey) ? ("?k="+encodeURIComponent(SESSION.dmKey)) : "";
  try{ __vwES = new EventSource("/api/stream"+qs); }catch(e){ __vwES=null; return; }
  __vwStreamLastMsg = Date.now();
  __vwStreamBackoff = 1000;

  __vwES.addEventListener("update", async ()=>{
    __vwStreamLastMsg = Date.now();
    try{
      const st = await api("/api/state");
      window.__STATE = st;
      if(typeof vwComputeUnseen==="function") vwComputeUnseen();
      if(typeof renderIntelPlayer==="function") renderIntelPlayer();
      if(typeof renderIntelDM==="function") renderIntelDM();
    }catch(e){}
  });

  __vwES.addEventListener("hello", ()=>{
    __vwStreamLastMsg = Date.now();
  });

  __vwES.onerror = ()=>{
    // Browser will retry, but some proxies kill streams; we force a controlled reconnect.
    try{ __vwES.close(); }catch(e){}
    __vwES = null;
    const wait = Math.min(__vwStreamBackoff, 15000);
    __vwStreamBackoff = Math.min(__vwStreamBackoff * 2, 15000);
    setTimeout(()=>{
      vwStartStream();
    }, wait);
  };
}

// Watchdog: if we haven't heard anything for a while, restart the stream.
setInterval(()=>{
  if(!SESSION || !SESSION.role) return;
  const now = Date.now();
  // if tab is hidden, browsers may throttle; give it more slack
  const slack = document.hidden ? 60000 : 20000;
  if(__vwES && (now - __vwStreamLastMsg) > slack){
    try{ __vwES.close(); }catch(e){}
    __vwES = null;
    vwStartStream();
  } else if(!__vwES && (now - __vwStreamLastMsg) > slack){
    vwStartStream();
  }
}, 5000);

// When tab becomes visible again, ensure stream is alive.
document.addEventListener("visibilitychange", ()=>{
  if(!document.hidden && SESSION && SESSION.role){
    vwStartStream();
  }
});catch(e){}
  });
  __vwES.addEventListener("hello", ()=>{});
  __vwES.onerror = ()=>{ /* browser auto-reconnects */ };
}


function nowClock(){
  const d=new Date();
  const hh=String(d.getHours()).padStart(2,"0");
  const mm=String(d.getMinutes()).padStart(2,"0");
  document.getElementById("clockPill").textContent=hh+":"+mm;
  const elapsed = Math.floor((Date.now()-SESSION.sessionStart)/1000);
  const m = String(Math.floor(elapsed/60)).padStart(2,"0");
  const s = String(elapsed%60).padStart(2,"0");
  document.getElementById("sessionClockMini").textContent = m+":"+s;
}
setInterval(nowClock,1000); nowClock();

function renderTabs(tab){
  document.querySelectorAll(".nav .btn").forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
  ["home","character","intel","shop","settings"].forEach(t=>{
    document.getElementById("tab-"+t).classList.toggle("hidden", t!==tab);
  });
  // When switching to Intel, render immediately so players don't need to type in search
  if(tab === "intel"){
    vwAcknowledgeIntel && vwAcknowledgeIntel();
    setTimeout(()=>{
      if(typeof renderIntelDM==="function") renderIntelDM();
      if(typeof renderIntelPlayer==="function") renderIntelPlayer();
    }, 0);
  }

}
document.querySelectorAll(".nav .btn").forEach(b=>b.onclick=()=>renderTabs(b.dataset.tab));
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>renderTabs(b.dataset.go));

document.querySelectorAll("[data-ctab]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("[data-ctab]").forEach(x=>x.classList.toggle("active", x===b));
  document.getElementById("ctab-actions").classList.toggle("hidden", b.dataset.ctab!=="actions");
  document.getElementById("ctab-inventory").classList.toggle("hidden", b.dataset.ctab!=="inventory");
  document.getElementById("ctab-sheet").classList.toggle("hidden", b.dataset.ctab!=="sheet");
});

document.querySelectorAll("[data-itab]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("[data-itab]").forEach(x=>x.classList.toggle("active", x===b));
  document.getElementById("itab-notifications").classList.toggle("hidden", b.dataset.itab!=="notifications");
  document.getElementById("itab-clues").classList.toggle("hidden", b.dataset.itab!=="clues");
  document.getElementById("itab-archived").classList.toggle("hidden", b.dataset.itab!=="archived");
});

function loginInit(){
  const roleSel=document.getElementById("whoRole");
  const dmRow=document.getElementById("dmKeyRow");
  const playerRow=document.getElementById("playerBtnRow");
  function sync(){
    const isDM = roleSel.value==="dm";
    dmRow.classList.toggle("hidden", !isDM);
    playerRow.classList.toggle("hidden", isDM);
  }
  roleSel.onchange=sync; sync();

  document.getElementById("loginBtn").onclick=async ()=>{
    const name=document.getElementById("whoName").value.trim()||"DM";
    const key=document.getElementById("dmKey").value.trim();
    const res = await api("/api/dm/login",{method:"POST",body:JSON.stringify({name, key})});
    if(!res.ok){ toast(res.error||"Denied"); return; }
    SESSION.role="dm"; SESSION.name=name; SESSION.dmKey=key;
    document.getElementById("whoPill").textContent="DM: "+name;
    document.getElementById("loginOverlay").style.display="none";
    setRoleUI();
    await refreshAll();
    if(typeof vwStartStream==="function" && SESSION && SESSION.role) vwStartStream();
  };
  document.getElementById("loginPlayerBtn").onclick=async ()=>{
    const name=document.getElementById("whoName").value.trim()||"Player";
    SESSION.role="player"; SESSION.name=name;
    document.getElementById("whoPill").textContent="Player: "+name;
    document.getElementById("loginOverlay").style.display="none";
    setRoleUI();
    await refreshAll();
    if(typeof vwStartStream==="function" && SESSION && SESSION.role) vwStartStream();
  };
}
loginInit();

// Intel filters (player)
["intelSearch","intelTag","intelDistrict"].forEach(id=>{
  const el=document.getElementById(id);
  if(el) el.oninput=()=>renderIntelPlayer();
});
const intelClear=document.getElementById("intelClearFilters");
if(intelClear) intelClear.onclick=()=>{
  document.getElementById("intelSearch").value="";
  document.getElementById("intelTag").value="";
  document.getElementById("intelDistrict").value="";
  renderIntelPlayer();
};

async function refreshAll(){
  const st = await api("/api/state");
  window.__STATE = st;
  // intel indicator baseline
  if(!VW_INTEL_UNSEEN.armed){ vwSyncSeenBaseline(); VW_INTEL_UNSEEN.armed = true; }
  else { vwComputeUnseen(); }
  if(typeof vwStartStream==="function" && SESSION && SESSION.role) vwStartStream();
  // characters
  const sel=document.getElementById("charSel");
  sel.innerHTML = "";
  (st.characters||[]).forEach(c=>{
    const o=document.createElement("option"); o.value=c.id; o.textContent=c.name;
    sel.appendChild(o);
  });
  if(!SESSION.activeCharId && st.characters?.length) SESSION.activeCharId = st.characters[0].id;
  if(SESSION.activeCharId){
    sel.value = SESSION.activeCharId;
  }
  sel.onchange=()=>{ SESSION.activeCharId=sel.value; renderCharacter(); };
  document.getElementById("activeCharMini").textContent = SESSION.activeCharId ? (st.characters.find(c=>c.id===SESSION.activeCharId)?.name || "Unknown") : "None selected";
  // shop
  renderShop();
  // DM panels
  renderDM();
  if(typeof renderIntelDM==='function') renderIntelDM();
  if(typeof renderIntelPlayer==='function') renderIntelPlayer();
  renderCharacter();
  if(typeof renderSheet==='function') renderSheet();
  if(typeof renderSettings==='function') renderSettings();
}

function getChar(){
  const st=window.__STATE||{};
  return (st.characters||[]).find(c=>c.id===SESSION.activeCharId);
}
function renderCharacter(){
  const c=getChar();
  const weapBody=document.getElementById("weapBody");
  const invBody=document.getElementById("invBody");
  weapBody.innerHTML=""; invBody.innerHTML="";
  if(!c){
    weapBody.innerHTML = '<tr><td colspan="5" class="mini">No character. Click New Character.</td></tr>';
    invBody.innerHTML = '<tr><td colspan="7" class="mini">No character.</td></tr>';
    return;
  }
  // weapons rows
  (c.weapons||[]).forEach(w=>{
    const tr=document.createElement("tr");
    tr.innerHTML = '<td>'+esc(w.name)+'</td><td>'+esc(w.range||"")+'</td><td>'+esc(w.hit||"")+'</td><td>'+esc(w.damage||"")+'</td><td><button class="btn smallbtn">Remove</button></td>';
    tr.querySelector("button").onclick=async ()=>{
      c.weapons = c.weapons.filter(x=>x.id!==w.id);
      await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
      toast("Removed weapon"); await refreshAll();
    };
    weapBody.appendChild(tr);
    if(w.ammo){
      const tr2=document.createElement("tr");
      tr2.innerHTML = '<td colspan="5" class="mini">Ammo: '+esc(w.ammo.type)+' | Starting '+esc(w.ammo.starting)+' | Current '+esc(w.ammo.current)+' | Mags '+esc(w.ammo.mags||"—")+'</td>';
      weapBody.appendChild(tr2);
    }
  });
  // inventory rows
  (c.inventory||[]).forEach((it,idx)=>{
    const tr=document.createElement("tr");
    tr.innerHTML =
      '<td><input class="input" value="'+esc(it.category||"")+'" data-k="category"/></td>'+
      '<td><input class="input" value="'+esc(it.name||"")+'" data-k="name"/></td>'+
      '<td><input class="input" value="'+esc(it.weight||"")+'" data-k="weight"/></td>'+
      '<td><input class="input" value="'+esc(it.qty||"")+'" data-k="qty"/></td>'+
      '<td><input class="input" value="'+esc(it.cost||"")+'" data-k="cost"/></td>'+
      '<td><input class="input" value="'+esc(it.notes||"")+'" data-k="notes"/></td>'+
      '<td><button class="btn smallbtn">Del</button></td>';
    tr.querySelectorAll("input").forEach(inp=>{
      inp.onchange=async ()=>{
        const k=inp.dataset.k;
        c.inventory[idx][k]=inp.value;
        await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
        document.getElementById("saveMini").textContent="Saved";
      };
    });
    tr.querySelector('button').onclick = async ()=>{
      c.inventory.splice(idx,1);
      await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
      toast("Removed item"); await refreshAll();
    };
    invBody.appendChild(tr);
  });

const CONDITIONS = ["bleeding","blinded","charmed","deafened","frightened","grappled","incapacitated","invisible","paralyzed","poisoned","prone","restrained","stunned","unconscious","exhaustion"];

function renderSheet(){
  const c=getChar();
  if(!c) return;

  c.sheet ||= {};
  c.sheet.vitals ||= { hpCur:"", hpMax:"", hpTemp:"", ac:"", init:"", speed:"" };
  c.sheet.money  ||= { cash:"", bank:"" };
  c.sheet.stats  ||= { STR:"",DEX:"",CON:"",INT:"",WIS:"",CHA:"" };
  c.sheet.conditions ||= [];
  c.sheet.notes ||= "";

  const v=c.sheet.vitals;
  document.getElementById("hpCur").value = v.hpCur ?? "";
  document.getElementById("hpMax").value = v.hpMax ?? "";
  document.getElementById("hpTemp").value = v.hpTemp ?? "";
  document.getElementById("acVal").value = v.ac ?? "";
  document.getElementById("initVal").value = v.init ?? "";
  document.getElementById("spdVal").value = v.speed ?? "";

  document.getElementById("cashVal").value = (c.sheet.money.cash ?? "");
  document.getElementById("bankVal").value = (c.sheet.money.bank ?? "");

  document.getElementById("statSTR").value = (c.sheet.stats.STR ?? "");
  document.getElementById("statDEX").value = (c.sheet.stats.DEX ?? "");
  document.getElementById("statCON").value = (c.sheet.stats.CON ?? "");
  document.getElementById("statINT").value = (c.sheet.stats.INT ?? "");
  document.getElementById("statWIS").value = (c.sheet.stats.WIS ?? "");
  document.getElementById("statCHA").value = (c.sheet.stats.CHA ?? "");

  document.getElementById("notesBio").value = (c.sheet.notes ?? "");

  // conditions
  const row=document.getElementById("condRow");
  row.innerHTML="";
  const active = new Set((c.sheet.conditions||[]).map(x=>String(x).toLowerCase()));
  CONDITIONS.forEach(name=>{
    const id="cond_"+name;
    const lab=document.createElement("label");
    lab.className="row";
    lab.style.gap="6px";
    lab.innerHTML = '<input type="checkbox" id="'+id+'"/> <span class="mini">'+name+'</span>';
    const cb=lab.querySelector("input");
    cb.checked = active.has(name);
    cb.onchange=()=>{
      if(cb.checked) active.add(name); else active.delete(name);
      c.sheet.conditions = Array.from(active);
    };
    row.appendChild(lab);
  });

  // DM-only buttons
  document.getElementById("dupCharBtn").classList.toggle("hidden", SESSION.role!=="dm");
  document.getElementById("delCharBtn").classList.toggle("hidden", SESSION.role!=="dm");
}
window.renderSheet = renderSheet;

document.getElementById("saveSheetBtn").onclick = async ()=>{
  const c=getChar(); if(!c){ toast("No character"); return; }
  c.sheet ||= {};
  c.sheet.vitals = {
    hpCur: document.getElementById("hpCur").value.trim(),
    hpMax: document.getElementById("hpMax").value.trim(),
    hpTemp: document.getElementById("hpTemp").value.trim(),
    ac: document.getElementById("acVal").value.trim(),
    init: document.getElementById("initVal").value.trim(),
    speed: document.getElementById("spdVal").value.trim()
  };
  c.sheet.money = {
    cash: document.getElementById("cashVal").value.trim(),
    bank: document.getElementById("bankVal").value.trim()
  };
  c.sheet.stats = {
    STR: document.getElementById("statSTR").value.trim(),
    DEX: document.getElementById("statDEX").value.trim(),
    CON: document.getElementById("statCON").value.trim(),
    INT: document.getElementById("statINT").value.trim(),
    WIS: document.getElementById("statWIS").value.trim(),
    CHA: document.getElementById("statCHA").value.trim()
  };
  c.sheet.notes = document.getElementById("notesBio").value;
  await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
  toast("Sheet saved"); await refreshAll();
};

document.getElementById("dupCharBtn").onclick = async ()=>{
  if(SESSION.role!=="dm") return;
  const c=getChar(); if(!c) return;
  const name = await vwModalInput({ title:"Duplicate Character", label:"New name", value: c.name + " (Copy)" });
  if(!name) return;
  const res = await api("/api/character/duplicate",{method:"POST",body:JSON.stringify({charId:c.id, name})});
  if(res.ok){ SESSION.activeCharId=res.id; toast("Duplicated"); await refreshAll(); }
  else toast(res.error||"Failed");
};

document.getElementById("delCharBtn").onclick = async ()=>{
  if(SESSION.role!=="dm") return;
  const c=getChar(); if(!c) return;
  const ok = await vwModalConfirm({ title:"Delete Character", message:'Delete "' + c.name + '"? This cannot be undone.' });
  if(!ok) return;
  const res = await api("/api/character/delete",{method:"POST",body:JSON.stringify({charId:c.id})});
  if(res.ok){ SESSION.activeCharId=null; toast("Deleted"); await refreshAll(); }
  else toast(res.error||"Failed");
};

function renderIntelPlayer(){
  const st=window.__STATE||{};
  const feat=(st.settings?.features)||{shop:true,intel:true};
  const dis=document.getElementById("intelDisabledMsg");
  if(dis) dis.classList.toggle("hidden", !!feat.intel);
  if(!feat.intel) return;
  const intelBody=document.getElementById("intelBody");
  const recap=document.getElementById("intelSession Recaps");
  const reqBody=document.getElementById("playerReqBody");
  if(!intelBody || !recap || !reqBody) return;

  const q=(document.getElementById("intelSearch").value||"").toLowerCase().trim();
  const tag=(document.getElementById("intelTag").value||"").toLowerCase().trim();
  const dist=(document.getElementById("intelDistrict").value||"").toLowerCase().trim();

  const clueItems = Array.isArray(st.clues) ? st.clues : (st.clues?.items || st.clues?.active || []);
  const clues = (clueItems||[]).filter(c=>String(c.visibility||"hidden")==="revealed");
  const filtered = clues.filter(c=>{
    const hay = (c.title||"")+" "+(c.details||"")+" "+(c.tags||"").join?.(",")+" "+(c.district||"");
    if(q && !hay.toLowerCase().includes(q)) return false;
    if(tag && !(c.tags||[]).some(t=>String(t).toLowerCase().includes(tag))) return false;
    if(dist && !String(c.district||"").toLowerCase().includes(dist)) return false;
    return true;
  });

  // recap: last 5 by revealedAt
  const rec = [...clues].sort((a,b)=>(b.revealedAt||0)-(a.revealedAt||0)).slice(0,5);
  recap.innerHTML = rec.length
    ? rec.map(c=>'<div>• <b>'+esc(c.title||"Clue")+'</b> <span class="badge">'+esc(c.district||"")+'</span></div>').join("")
    : '<div class="mini" style="opacity:.85">No revealed clues yet.</div>';

  intelBody.innerHTML="";
  if(!filtered.length){
    intelBody.innerHTML = '<tr><td colspan="5" class="mini">No matching revealed clues.</td></tr>';
  } else {
    filtered.sort((a,b)=>(b.revealedAt||0)-(a.revealedAt||0)).forEach(c=>{
      const tr=document.createElement("tr");
      tr.innerHTML =
        '<td>'+esc(c.title||"")+'</td>'+
        '<td>'+esc((c.tags||[]).join(", "))+'</td>'+
        '<td>'+esc(c.district||"")+'</td>'+
        '<td>'+esc(c.date||"")+'</td>'+
        '<td>'+esc(c.details||"")+'</td>';
      intelBody.appendChild(tr);
    });
  }

  // player requests (notifications from this player)
  const mine = (st.notifications?.items||[]).filter(n=>String(n.from||"")===String(SESSION.name||""));
  reqBody.innerHTML="";
  if(!mine.length){
    reqBody.innerHTML = '<tr><td colspan="5" class="mini">No requests yet.</td></tr>';
  } else {
    mine.slice().sort((a,b)=>b.id-a.id).forEach(n=>{
      const tr=document.createElement("tr");
      tr.innerHTML = '<td>'+n.id+'</td><td>'+esc(n.type)+'</td><td>'+esc(n.detail)+'</td><td>'+esc(n.status)+'</td><td>'+esc(n.notes||"")+'</td>';
      reqBody.appendChild(tr);
    });
  }
}
window.renderIntelPlayer = renderIntelPlayer;


function renderIntelDM(){
  const st=window.__STATE||{};
  const feat=(st.settings?.features)||{shop:true,intel:true};
  if(!feat.intel) return;
  if(SESSION.role!=="dm") return;
  const body=document.getElementById("clueBody");
  if(!body) return;
  body.innerHTML="";
  const items = (st.clues?.items||[]);
  if(!items.length){
    body.innerHTML = '<tr><td colspan="7" class="mini">No active clues yet.</td></tr>';
    return;
  }
  items.slice().sort((a,b)=>(b.id||0)-(a.id||0)).forEach(cl=>{
    const tr=document.createElement("tr");
    tr.innerHTML =
      '<td>'+cl.id+'</td>'+
      '<td>'+esc(cl.title||"")+'</td>'+
      '<td>'+esc(cl.visibility||"hidden")+'</td>'+
      '<td>'+esc((cl.tags||[]).join(", "))+'</td>'+
      '<td>'+esc(cl.district||"")+'</td>'+
      '<td>'+esc(cl.date||"")+'</td>'+
      '<td></td>';
    const td=tr.lastChild;
    td.innerHTML =
      '<button class="btn smallbtn">Edit</button> '+
      '<button class="btn smallbtn">Reveal</button> '+
      '<button class="btn smallbtn">Hide</button> '+
      '<button class="btn smallbtn">Archive</button> <button class="btn smallbtn">Delete</button>';
    const [bEdit,bRev,bHide,bArc,bDel]=td.querySelectorAll("button");

    bEdit.onclick = async ()=>{
      const result = await vwModalForm({
        title:"Edit Clue",
        fields:[
          {key:"title",label:"Title",value:cl.title||"",placeholder:"Clue title"},
          {key:"details",label:"Details",value:cl.details||"",placeholder:"Details", type:"textarea"},
          {key:"source",label:"Source",value:cl.source||"",placeholder:"Source"},
          {key:"tags",label:"Tags (comma)",value:(cl.tags||[]).join(", "),placeholder:"tag1, tag2"},
          {key:"district",label:"District",value:cl.district||"",placeholder:"Cock & Dagger"},
          {key:"date",label:"Date",value:cl.date||"",placeholder:"YYYY-MM-DD"}
        ],
        okText:"Save"
      });
      if(!result) return;
      const payload = {
        id: cl.id,
        title: result.title,
        details: result.details,
        source: result.source,
        tags: (result.tags||"").split(",").map(s=>s.trim()).filter(Boolean),
        district: result.district,
        date: result.date
      };
      const res = await api("/api/clues/update",{method:"POST",body:JSON.stringify(payload)});
      if(res.ok){ toast("Clue saved"); await refreshAll(); } else toast(res.error||"Failed");
    };

    bRev.onclick = async ()=>{
      const res = await api("/api/clues/visibility",{method:"POST",body:JSON.stringify({id:cl.id, visibility:"revealed"})});
      if(res.ok){ toast("Revealed"); await refreshAll(); } else toast(res.error||"Failed");
    };
    bHide.onclick = async ()=>{
      const res = await api("/api/clues/visibility",{method:"POST",body:JSON.stringify({id:cl.id, visibility:"hidden"})});
      if(res.ok){ toast("Hidden"); await refreshAll(); } else toast(res.error||"Failed");
    };
    bArc.onclick = async ()=>{
      const res = await api("/api/clues/archive",{method:"POST",body:JSON.stringify({id:cl.id})});
      if(res.ok){ toast("Archived (moved to Archived tab)"); await refreshAll();
        const ab=document.querySelector('#dmPanels button[data-itab="archived"]'); if(ab) ab.click();
      } else toast(res.error||"Failed");
    };

bDel && (bDel.onclick = async ()=>{
  const ok = await vwModalConfirm({
    title: "Delete Clue",
    message: 'Delete clue #' + cl.id + ' "' + (cl.title||"") + '"? This cannot be undone.'
  });
  if(!ok) return;
  const res = await api("/api/clues/delete", {method:"POST", body:JSON.stringify({id: cl.id})});
  if(res.ok){ toast("Deleted"); await refreshAll(); }
  else toast(res.error || "Failed");
});

    body.appendChild(tr);
  });
}
window.renderIntelDM = renderIntelDM;



}

document.getElementById("addInvBtn").onclick=async ()=>{
  const c=getChar(); if(!c){ toast("Create character first"); return; }
  c.inventory ||= [];
  c.inventory.push({category:"",name:"",weight:"",qty:"1",cost:"",notes:""});
  await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
  toast("Added inventory row"); await refreshAll();
};

document.getElementById("newCharBtn").onclick = async () => {
  const name = await vwModalInput({
    title: "New Character",
    label: "Character name",
    placeholder: "e.g. Mara Kincaid"
  });
  if (!name) return;

  const res = await api("/api/character/new", {
    method: "POST",
    body: JSON.stringify({ name })
  });

  if (res.ok) {
    SESSION.activeCharId = res.id;
    toast("Character created");
    await refreshAll();
    if(typeof vwStartStream==="function" && SESSION && SESSION.role) vwStartStream();
  } else {
    toast(res.error || "Failed to create character");
  }
};

function renderShop(){
  const st=window.__STATE||{};
  const shops=st.shops||{};
  const feat=(st.settings?.features)||{shop:true,intel:true};
  if(!feat.shop){
    document.getElementById("shopEnabledPill").textContent = "Shop: Disabled";
    document.getElementById("shopPill").textContent = "Shop: --";
    document.getElementById("shopBody").innerHTML = '<tr><td colspan="7" class="mini">Shop feature is disabled.</td></tr>';
    return;
  }
  const enabled=!!shops.enabled;
  document.getElementById("shopEnabledPill").textContent = enabled ? "Shop: Enabled" : "Shop: Disabled";
  document.getElementById("shopPill").textContent = "Shop: " + (shops.list?.find(s=>s.id===shops.activeShopId)?.name || "--");
  const sel=document.getElementById("shopSel");
  sel.innerHTML="";
  (shops.list||[]).forEach(s=>{
    const o=document.createElement("option"); o.value=s.id; o.textContent=s.name;
    if(s.id===shops.activeShopId) o.selected=true;
    sel.appendChild(o);
  });
  sel.onchange = async ()=>{
    if(SESSION.role!=="dm"){ toast("DM only"); sel.value=shops.activeShopId; return; }
    shops.activeShopId = sel.value;
    await api("/api/shops/save",{method:"POST",body:JSON.stringify({shops})});
    toast("Active shop set"); await refreshAll();
  };
  // DM buttons
  document.getElementById("toggleShopBtn").onclick = async ()=>{
    if(SESSION.role!=="dm") return;
    shops.enabled = !shops.enabled;
    await api("/api/shops/save",{method:"POST",body:JSON.stringify({shops})});
    toast("Shop toggled"); await refreshAll();
  };
  document.getElementById("addShopBtn").onclick = async ()=>{
  if(SESSION.role!=="dm") return;

  const n = await vwModalInput({
    title: "New Shop",
    label: "Shop name",
    placeholder: "e.g. Riverside Armory"
  });
  if(!n) return;

  const id=("s_"+Math.random().toString(36).slice(2,8));
  shops.list ||= [];
  shops.list.push({id:id, name:n, items:[]});
  shops.activeShopId=id;

  await api("/api/shops/save",{method:"POST",body:JSON.stringify({shops})});
  toast("Shop created"); await refreshAll();
  };
  document.getElementById("editShopBtn").onclick = async ()=>{
  if(SESSION.role!=="dm") return;

  const curr=(shops.list||[]).find(s=>s.id===shops.activeShopId);
  if(!curr) return;

  const n = await vwModalInput({
    title: "Rename Shop",
    label: "Shop name",
    value: curr.name,
    placeholder: "Shop name"
  });
  if(!n) return;

  curr.name=n;
  await api("/api/shops/save",{method:"POST",body:JSON.stringify({shops})});
  toast("Shop renamed"); await refreshAll();
  };
  const body=document.getElementById("shopBody");
  body.innerHTML="";
  if(!enabled && SESSION.role!=="dm"){
    body.innerHTML = '<tr><td colspan="7" class="mini">Shop is currently disabled.</td></tr>';
    return;
  }
  const shop=(shops.list||[]).find(s=>s.id===shops.activeShopId);
  if(!shop){
    body.innerHTML = '<tr><td colspan="7" class="mini">No shop selected.</td></tr>';
    return;
  }
  (shop.items||[]).forEach((it,idx)=>{
    const tr=document.createElement("tr");
    tr.innerHTML =
      '<td>'+esc(it.name)+'</td><td>'+esc(it.category||"")+'</td><td>$'+esc(it.cost||"")+'</td>'+
      '<td>'+esc(it.weight||"")+'</td><td>'+esc(it.notes||"")+'</td><td>'+esc(it.stock||"∞")+'</td>'+
      '<td></td>';
    const td=tr.lastChild;
    if(SESSION.role==="dm"){
      td.innerHTML = '<button class="btn smallbtn">Edit</button> <button class="btn smallbtn">Del</button>';
      const [editBtn,delBtn]=td.querySelectorAll("button");
      editBtn.onclick = async ()=>{
  const result = await vwModalForm({
    title: "Edit Item",
    fields: [
      { key:"name",     label:"Item name", value: it.name || "", placeholder:"Flashlight" },
      { key:"category", label:"Category",  value: it.category || "", placeholder:"Gear" },
      { key:"cost",     label:"Cost ($)",  value: String(it.cost ?? ""), placeholder:"35" },
      { key:"weight",   label:"Weight",    value: String(it.weight ?? ""), placeholder:"1" },
      { key:"notes",    label:"Notes",     value: it.notes || "", placeholder:"Unique / special" },
      { key:"stock",    label:"Stock (∞ or number)", value: String(it.stock ?? "∞"), placeholder:"∞" },
    ],
    okText: "Save"
  });

  if(!result) return;

  Object.assign(it, {
    name: result.name,
    category: result.category,
    cost: result.cost,
    weight: result.weight,
    notes: result.notes,
    stock: result.stock
  });

  await api("/api/shops/save",{method:"POST",body:JSON.stringify({shops})});
  toast("Item saved"); await refreshAll();
  };

      delBtn.onclick = async ()=>{
  const ok = await vwModalConfirm({
    title: "Delete Item",
    message: 'Delete "' + (it.name || "this item") + '"?'
  });
  if(!ok) return;

  shop.items.splice(idx,1);
  await api("/api/shops/save",{method:"POST",body:JSON.stringify({shops})});
  toast("Item deleted"); await refreshAll();
  };

    } else {
      td.innerHTML = '<button class="btn smallbtn">Add to Inventory</button>';
      td.querySelector("button").onclick=async ()=>{
        const c=getChar();
        if(!c){ toast("Create/select character first"); return; }
        c.inventory ||= [];
        // No duplicates for unique items (very simple rule: if notes contains "Unique")
        const isUnique = String(it.notes||"").toLowerCase().includes("unique");
        if(isUnique && c.inventory.some(x=>String(x.name||"").toLowerCase()===String(it.name||"").toLowerCase())){
          toast("Already owned"); return;
        }
        c.inventory.push({category:it.category||"", name:it.name, weight:String(it.weight||""), qty:"1", cost:String(it.cost||""), notes:it.notes||""});
        await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
        // create notification request for DM
        await api("/api/notify",{method:"POST",body:JSON.stringify({type:"Shop Purchase", detail: it.name + " ($" + it.cost + ")", from: SESSION.name||"Player"})});
        toast("Added to inventory"); await refreshAll();
      };
    }
    body.appendChild(tr);
  });

  if(SESSION.role==="dm"){
    const tr=document.createElement("tr");
    tr.innerHTML = '<td colspan="7"><button class="btn smallbtn" id="addShopItemBtn">Add Item</button></td>';
    body.appendChild(tr);
    tr.querySelector("#addShopItemBtn").onclick = async ()=>{
  const result = await vwModalForm({
    title: "Add Item",
    fields: [
      { key:"name",     label:"Item name", value:"", placeholder:"Flashlight" },
      { key:"category", label:"Category",  value:"Gear", placeholder:"Gear" },
      { key:"cost",     label:"Cost ($)",  value:"0", placeholder:"35" },
      { key:"weight",   label:"Weight",    value:"1", placeholder:"1" },
      { key:"notes",    label:"Notes",     value:"", placeholder:"Unique / special" },
      { key:"stock",    label:"Stock (∞ or number)", value:"∞", placeholder:"∞" },
    ],
    okText: "Add"
  });

  if(!result || !result.name) return;

  shop.items ||= [];
  shop.items.push({
    id:"i_"+Math.random().toString(36).slice(2,8),
    name: result.name,
    category: result.category,
    cost: result.cost,
    weight: result.weight,
    notes: result.notes,
    stock: result.stock
  });

  await api("/api/shops/save",{method:"POST",body:JSON.stringify({shops})});
  toast("Item added"); await refreshAll();
  };
  }
}

function renderDM(){
  if(SESSION.role!=="dm") return;
  const st=window.__STATE||{};
  const nb=document.getElementById("notifBody");
  nb.innerHTML="";
  (st.notifications?.items||[]).forEach(n=>{
    const tr=document.createElement("tr");
    tr.innerHTML = '<td>'+n.id+'</td><td>'+esc(n.type)+'</td><td>'+esc(n.detail)+'</td><td>'+esc(n.from)+'</td><td>'+esc(n.status)+'</td><td>'+esc(n.notes||"")+'</td><td></td>';
    const td=tr.lastChild;
    td.innerHTML = '<button class="btn smallbtn">Resolve</button>';
    td.querySelector("button").onclick=async ()=>{
      n.status="resolved";
      await api("/api/notifications/save",{method:"POST",body:JSON.stringify({notifications: st.notifications})});
      toast("Resolved"); await refreshAll();
    };
    nb.appendChild(tr);
  });
  document.getElementById("clearResolvedBtn").onclick=async ()=>{
    st.notifications.items = (st.notifications.items||[]).filter(x=>x.status!=="resolved");
    await api("/api/notifications/save",{method:"POST",body:JSON.stringify({notifications: st.notifications})});
    toast("Cleared"); await refreshAll();
  };

  const ab=document.getElementById("archBody");
  ab.innerHTML="";
  (st.clues?.archived||[]).forEach((c,idx)=>{
    const tr=document.createElement("tr");
    tr.innerHTML = '<td>'+esc(c.title||"Clue")+'</td><td>'+esc(c.notes||"")+'</td><td><button class="btn smallbtn">Restore</button> <button class="btn smallbtn">Delete</button></td>';
    
const btns = tr.querySelectorAll("button");
const restoreBtn = btns[0];
const del = btns[1];
restoreBtn && (restoreBtn.onclick = async ()=>{
  const res = await api("/api/clues/restoreActive",{method:"POST",body:JSON.stringify({id: c.id})});
  if(res.ok){ toast("Restored"); await refreshAll(); } else toast(res.error||"Failed");
});
    if(del){
      del.onclick = async ()=>{
        const ok = await vwModalConfirm({
          title: "Delete Clue",
          message: 'Delete archived clue #' + c.id + ' "' + (c.title||"") + '"? This cannot be undone.'
        });
        if(!ok) return;
        const r2 = await api("/api/clues/delete", {method:"POST", body:JSON.stringify({id: c.id})});
        if(r2.ok){ toast("Deleted"); await refreshAll(); }
        else toast(r2.error||"Failed");
      };
    };
    ab.appendChild(tr);
  });
}

function renderSettings(){
  const st=window.__STATE||{};
  if(SESSION.role!=="dm") return;
  // feature toggles
  const feat = (st.settings?.features) || {shop:true,intel:true};
  const cShop=document.getElementById("featShop");
  const cIntel=document.getElementById("featIntel");
  if(cShop) cShop.checked = !!feat.shop;
  if(cIntel) cIntel.checked = !!feat.intel;

  if(cShop) cShop.onchange = async ()=>{
    feat.shop = !!cShop.checked;
    const res = await api("/api/settings/save",{method:"POST",body:JSON.stringify({features: feat})});
    if(res.ok){ toast("Saved"); await refreshAll(); } else toast(res.error||"Failed");
  };
  if(cIntel) cIntel.onchange = async ()=>{
    feat.intel = !!cIntel.checked;
    const res = await api("/api/settings/save",{method:"POST",body:JSON.stringify({features: feat})});
    if(res.ok){ toast("Saved"); await refreshAll(); } else toast(res.error||"Failed");
  };

  const btnExp=document.getElementById("exportStateBtn");
  if(btnExp) btnExp.onclick = async ()=>{
    const r = await fetch("/api/state/export", { headers: { "X-DM-Key": SESSION.dmKey }});
    const txt = await r.text();
    // show in modal textarea for easy copy
    await vwModalForm({ title:"Export State (copy)", fields:[{key:"json",label:"State JSON",value:txt,type:"textarea"}], okText:"Close", cancelText:"Close" });
  };

  const btnImp=document.getElementById("importStateBtn");
  if(btnImp) btnImp.onclick = async ()=>{
    const result = await vwModalForm({ title:"Import State", fields:[{key:"json",label:"Paste JSON to import",value:"",type:"textarea"}], okText:"Import" });
    if(!result) return;
    const ok = await vwModalConfirm({ title:"Confirm Import", message:"Import will overwrite the current state. Continue?" });
    if(!ok) return;
    const res = await api("/api/state/import",{method:"POST",body:JSON.stringify({json: result.json})});
    if(res.ok){ toast("Imported"); await refreshAll(); } else toast(res.error||"Import failed");
  };

  const btnReset=document.getElementById("resetStateBtn");
  if(btnReset) btnReset.onclick = async ()=>{
    const ok = await vwModalConfirm({ title:"Reset State", message:"This resets all shops/characters/clues/notifications. Continue?" });
    if(!ok) return;
    const res = await api("/api/state/reset",{method:"POST"});
    if(res.ok){ toast("Reset"); await refreshAll(); } else toast(res.error||"Failed");
  };

  const btnKey=document.getElementById("saveDmKeyBtn");
  if(btnKey) btnKey.onclick = async ()=>{
    const nk = (document.getElementById("dmKeyNew").value||"").trim();
    if(!nk) return toast("Enter a new key");
    const res = await api("/api/settings/save",{method:"POST",body:JSON.stringify({dmKey: nk})});
    if(res.ok){ toast("DM key saved"); SESSION.dmKey = nk; await refreshAll(); }
    else toast(res.error||"Failed");
  };
}

document.getElementById("newClueBtn")?.addEventListener("click", async ()=>{
  if(SESSION.role!=="dm") return;
  const result = await vwModalForm({
    title:"New Clue",
    fields:[
      {key:"title",label:"Title",value:"",placeholder:"Clue title"},
      {key:"details",label:"Details",value:"",placeholder:"Details",type:"textarea"},
      {key:"source",label:"Source",value:"",placeholder:"Source"},
      {key:"tags",label:"Tags (comma)",value:"",placeholder:"tag1, tag2"},
      {key:"district",label:"District",value:"",placeholder:"Cock & Dagger"},
      {key:"date",label:"Date",value:"",placeholder:"YYYY-MM-DD"}
    ],
    okText:"Create"
  });
  if(!result || !result.title) return;
  const payload = {
    title: result.title,
    details: result.details,
    source: result.source,
    tags: (result.tags||"").split(",").map(s=>s.trim()).filter(Boolean),
    district: result.district,
    date: result.date
  };
  const res = await api("/api/clues/create",{method:"POST",body:JSON.stringify(payload)});
  if(res.ok){ toast("Clue created"); await refreshAll(); } else toast(res.error||"Failed");
});

document.getElementById("dmNewNotifBtn")?.addEventListener("click", async ()=>{
  if(SESSION.role!=="dm") return;
  const result = await vwModalForm({
    title:"New Notification",
    fields:[
      {key:"type",label:"Type",value:"Mission Update",placeholder:"request/intel/mission/etc"},
      {key:"detail",label:"Detail",value:"",placeholder:"What is this about?"},
      {key:"notes",label:"DM Notes (optional)",value:"",placeholder:"Approved, delivered next session",type:"textarea"}
    ],
    okText:"Send"
  });
  if(!result) return;
  const res = await api("/api/notify",{method:"POST",body:JSON.stringify({type:result.type, detail:result.detail, from:"DM", notes:result.notes})});
  if(res.ok){ toast("Sent"); await refreshAll(); } else toast(res.error||"Failed");
});

// Auto-refresh state so player/DM views update without manual actions.
const AUTO_REFRESH_MS = 5000;
let __lastSig = "";
async function pollState(){
  try{
    const st = await api("/api/state");
    if(!st || st.ok === false) return;
    window.__STATE = st;
    const sig = JSON.stringify({
      n:(st.notifications?.items||[]).length,
      c:(st.clues?.items||[]).length,
      a:(st.clues?.archived||[]).length,
      ch:(st.characters||[]).length,
      cv:(st.clues?.items||[]).map(x=>String(x.id)+":"+String(x.visibility)).join("|")
    });
    if(sig !== __lastSig){
      __lastSig = sig;
      // re-render active tab
      const activeTab = document.querySelector('#tabs .btn.active')?.dataset?.tab || "home";
      if(activeTab === "intel"){
        if(typeof renderIntelDM==="function") renderIntelDM();
        if(typeof renderIntelPlayer==="function") renderIntelPlayer();
      } else if(activeTab === "character"){
        renderCharacter();
        if(typeof renderSheet==="function") renderSheet();
      } else if(activeTab === "shop"){
        renderShop();
      } else if(activeTab === "home"){
        renderDM();
      }
    }
  } catch(e){}
}
setInterval(pollState, AUTO_REFRESH_MS);

// initial refresh will occur after login
</script>
<!-- Veilwatch Modal -->
<div id="vwModal" style="position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.65);z-index:9999;">
  <div style="width:min(560px,92vw);background:#0f1722;border:1px solid #2b3a4d;border-radius:14px;padding:16px;color:#e9f1ff;">
    <div id="vwModalTitle" style="font-size:18px;margin-bottom:10px;">Modal</div>
    <div id="vwModalBody"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;">
      <button id="vwModalCancel" style="padding:10px 14px;border-radius:12px;border:1px solid #2b3a4d;background:transparent;color:#e9f1ff;cursor:pointer;">Cancel</button>
      <button id="vwModalOk" style="padding:10px 14px;border-radius:12px;border:1px solid #2b3a4d;background:#19324f;color:#e9f1ff;cursor:pointer;">OK</button>
    </div>
  </div>
</div>
</body>
</html>`;

const server = http.createServer(async (req,res)=>{
  const parsed = url.parse(req.url, true);
  const p = parsed.pathname || "/";
  if(p === "/" || p === "/index.html"){
    return text(res, 200, INDEX_HTML, "text/html; charset=utf-8");
  }
  if(p === "/favicon.ico"){
    res.writeHead(204, {"Cache-Control":"no-store"});
    return res.end();
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
