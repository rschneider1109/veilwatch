/**
 * Veilwatch OS - app.js (patched)
 * Drop-in replacement for your single-file server that keeps the same vibe and adds:
 * - Intel/Clues pipeline (hidden/revealed/archived)
 * - Character sheet expansion (vitals/stats/conditions/notes/money/ammo)
 * - Notifications upgrades (DM create + notes + acknowledge flow)
 * - Settings/Admin tab (DM only: rotate key, toggles, export/import, reset)
 * - SECURITY: /api/state no longer leaks dmKey to non-DM clients
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
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

// ---- State model (migrated on load)
const DEFAULT_STATE = {
  version: 2,
  settings: {
    dmKey: DM_KEY,
    theme: { accent: "#00e5ff" },
    features: { shop: true, intel: true, notifications: true }
  },
  shops: {
    enabled: true,
    activeShopId: "hq",
    list: [
      { id:"hq", name:"Cock & Dagger HQ", items: [
        { id:"ammo_9mm", name:"9mm Ammo (box)", category:"Ammo", cost:20, weight:1, notes:"50 rounds (reserve)", stock:"INF" },
        { id:"flashlight", name:"Flashlight (high lumen)", category:"Gear", cost:35, weight:1, notes:"Unique", stock:"INF" },
      ]},
    ]
  },
  notifications: {
    nextId: 1,
    items: [
      // { id, type, title, detail, from, status, dmNotes, scope:'broadcast'|'request', createdAt }
    ]
  },
  clues: {
    // Active clues (hidden/revealed); archived stored separately for clarity
    list: [
      // { id, title, details, source, tags:[], district:'', date:'YYYY-MM-DD', visibility:'hidden'|'revealed', updatedAt }
    ],
    archived: [
      // same shape + archivedAt
    ]
  },
  characters: [
    // { id, name, sheet:{...}, weapons:[], inventory:[] }
  ]
};

function structuredCloneSafe(obj){
  return JSON.parse(JSON.stringify(obj));
}

function fileLoadState(){
  ensureDir(DATA_DIR);
  if(!fs.existsSync(STATE_PATH)){
    fs.writeFileSync(STATE_PATH, JSON.stringify(DEFAULT_STATE, null, 2), "utf8");
    return structuredCloneSafe(DEFAULT_STATE);
  }
  try{
    const raw = fs.readFileSync(STATE_PATH,"utf8");
    const st = JSON.parse(raw);
    return migrateState(st);
  } catch(e){
    // if corrupted, back it up and reset
    try{ fs.copyFileSync(STATE_PATH, STATE_PATH + ".corrupt.bak"); } catch(_){}
    fileSaveState(structuredCloneSafe(DEFAULT_STATE));
    return structuredCloneSafe(DEFAULT_STATE);
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
      const st = migrateState(fromDb);
      // ensure dm key follows env
      st.settings ||= {};
      st.settings.dmKey = DM_KEY;
      fileSaveState(st);
      return st;
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
}

// ---- migration
function isObj(x){ return x && typeof x === "object" && !Array.isArray(x); }
function nowISO(){ return new Date().toISOString(); }
function migrateState(st){
  st = isObj(st) ? st : {};
  st.version = st.version || 1;

  // settings
  st.settings ||= {};
  st.settings.theme ||= { accent: "#00e5ff" };
  st.settings.features ||= { shop: true, intel: true, notifications: true };
  st.settings.dmKey = DM_KEY; // authoritative

  // shops
  st.shops ||= structuredCloneSafe(DEFAULT_STATE.shops);
  st.shops.enabled = (typeof st.shops.enabled === "boolean") ? st.shops.enabled : true;
  st.shops.list ||= [];
  st.shops.activeShopId ||= (st.shops.list[0]?.id || "hq");

  // notifications: migrate older shapes
  if(!st.notifications) st.notifications = structuredCloneSafe(DEFAULT_STATE.notifications);
  st.notifications.nextId = Number(st.notifications.nextId || 1);
  st.notifications.items ||= [];
  // older build had {id,type,detail,from,status}
  st.notifications.items = st.notifications.items.map(n => {
    if(!isObj(n)) return null;
    return {
      id: n.id ?? null,
      type: String(n.type || "Request"),
      title: String(n.title || n.type || "Notification"),
      detail: String(n.detail || n.body || ""),
      from: String(n.from || n.createdBy || ""),
      status: String(n.status || "new"),
      dmNotes: String(n.dmNotes || n.dm_notes || ""),
      scope: String(n.scope || (String(n.type||"").toLowerCase().includes("request") ? "request" : "broadcast")),
      createdAt: n.createdAt || n.created_at || nowISO()
    };
  }).filter(Boolean);
  // ensure nextId > max id
  const maxId = st.notifications.items.reduce((m,n)=>{
    const v = parseInt(n.id,10); return (Number.isFinite(v) && v>m) ? v : m;
  }, 0);
  st.notifications.nextId = Math.max(st.notifications.nextId, maxId + 1);

  // clues: older build had {archived: []} only
  st.clues ||= {};
  if(Array.isArray(st.clues.archived) && !Array.isArray(st.clues.list)){
    st.clues.list = [];
  }
  st.clues.list ||= [];
  st.clues.archived ||= [];
  // normalize clue shapes
  function normClue(c, archived=false){
    if(!isObj(c)) return null;
    return {
      id: c.id || ("cl_" + Math.random().toString(36).slice(2,10)),
      title: String(c.title || "Clue"),
      details: String(c.details || c.notes || ""),
      source: String(c.source || ""),
      tags: Array.isArray(c.tags) ? c.tags.map(x=>String(x)).filter(Boolean).slice(0,20) : [],
      district: String(c.district || ""),
      date: c.date || c.clue_date || "",
      visibility: archived ? "archived" : (c.visibility === "revealed" ? "revealed" : "hidden"),
      updatedAt: c.updatedAt || nowISO(),
      archivedAt: archived ? (c.archivedAt || nowISO()) : undefined
    };
  }
  st.clues.list = st.clues.list.map(c=>normClue(c,false)).filter(Boolean);
  st.clues.archived = st.clues.archived.map(c=>normClue(c,true)).filter(Boolean);

  // characters
  st.characters ||= [];
  st.characters = Array.isArray(st.characters) ? st.characters : [];
  // remove example characters just in case
  st.characters = st.characters.filter(c => !String(c?.name||"").toLowerCase().includes("example"));
  st.characters = st.characters.map(c => {
    if(!isObj(c)) return null;
    c.id ||= "c_" + Math.random().toString(36).slice(2,10);
    c.name = String(c.name || "Unnamed").slice(0,60);
    c.weapons = Array.isArray(c.weapons) ? c.weapons : [];
    c.inventory = Array.isArray(c.inventory) ? c.inventory : [];
    c.sheet ||= {};
    c.sheet.vitals ||= { hp_current: 10, hp_max: 10, temp_hp: 0, ac: 10, initiative: 0, speed: 30 };
    c.sheet.stats ||= { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    c.sheet.conditions ||= Array.isArray(c.sheet.conditions) ? c.sheet.conditions : [];
    c.sheet.notes = String(c.sheet.notes || "");
    c.sheet.money ||= { cash: 0, bank: 0 };
    c.sheet.ammo ||= isObj(c.sheet.ammo) ? c.sheet.ammo : {};
    return c;
  }).filter(Boolean);

  st.version = 2;
  // persist any migration fixes immediately
  try{ fileSaveState(st); } catch(_){}
  return st;
}

let state = structuredCloneSafe(DEFAULT_STATE);

// ---- response helpers
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
function playerName(req){
  return String(req.headers["x-player-name"] || "").trim().slice(0,40);
}
function features(){
  return state.settings?.features || { shop:true, intel:true, notifications:true };
}
function clampInt(v, min, max){
  const n = parseInt(v,10);
  if(!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
function safeString(v, max=2000){
  return String(v ?? "").trim().slice(0, max);
}

// ---- UI
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
header{display:flex;gap:12px;align-items:center;padding:14px 18px;border-bottom:1px solid var(--line);background:rgba(2,8,12,.6);backdrop-filter:blur(6px);position:sticky;top:0;z-index:50;}
.brand{font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);}
.pill{font-size:12px;color:var(--muted);border:1px solid var(--line);padding:4px 10px;border-radius:999px;}
main{padding:18px;max-width:1200px;margin:0 auto;}
.nav{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;}
.btn{border:1px solid var(--line);background:linear-gradient(180deg, rgba(0,229,255,.10), rgba(0,229,255,.03));
     color:var(--ink);padding:12px 14px;border-radius:12px;cursor:pointer;box-shadow:0 0 0 1px rgba(0,229,255,.08) inset;touch-action:manipulation;}
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
  border-radius:12px;padding:10px 12px;outline:none;min-height:44px;}
textarea{min-height:120px;resize:vertical;}
.input:focus, select:focus, textarea:focus{border-color:rgba(0,229,255,.45);box-shadow:0 0 0 4px rgba(0,229,255,.08);}
hr{border:none;border-top:1px solid var(--line);margin:12px 0;}
.hidden{display:none;}
.badge{font-size:11px;color:var(--muted);border:1px solid var(--line);padding:2px 8px;border-radius:999px;}
table{width:100%;border-collapse:collapse;display:block;overflow-x:auto;}
th,td{border-bottom:1px solid var(--line);padding:10px 8px;text-align:left;font-size:13px;white-space:nowrap;}
th{color:var(--muted);font-weight:600;}
.smallbtn{padding:10px 12px;border-radius:10px;min-height:44px;}
.right{margin-left:auto;}
.toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:rgba(6,16,22,.9);
  border:1px solid var(--line);border-radius:14px;padding:10px 12px;color:var(--ink);box-shadow:0 10px 30px rgba(0,0,0,.5);display:none;z-index:99999;}
/* Login overlay */
#loginOverlay{position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:999;}
.loginCard{width:min(560px,92vw);}
.loginTitle{display:flex;align-items:center;gap:10px;margin:0 0 8px 0;}
.loginTitle span{color:var(--accent);font-weight:700;letter-spacing:.08em;text-transform:uppercase;}
.kv{display:grid;grid-template-columns:repeat(12,1fr);gap:10px;}
.kv .k{grid-column:span 6;}
.kv .k label{display:block;font-size:11px;color:var(--muted);margin:0 0 6px 2px;}
@media (max-width:720px){ .card{grid-column:span 12;} .kv .k{grid-column:span 12;} }
</style>
</head>
<body>
<div id="loginOverlay">
  <div class="panel loginCard">
    <div class="loginTitle"><span>VEILWATCH ACCESS</span><span class="badge" id="buildTag">v4.4</span></div>
    <div class="mini">Choose a role. DM requires the passkey. Player identity is the display name you enter.</div>
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
    <div class="mini" style="margin-top:10px;color:var(--muted);">DM passkey is stored server-side and never sent to players.</div>
  </div>
</div>

<header>
  <div class="brand">VEILWATCH OS</div>
  <div class="pill" id="whoPill">Not logged in</div>
  <div class="pill" id="shopPill">Shop: --</div>
  <div class="pill" id="featurePill">Features: --</div>
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
        <button class="btn hidden" id="quickSettingsBtn" data-go="settings">Settings</button>
      </div>
    </div>
  </section>

  <section id="tab-character" class="hidden">
    <div class="panel">
      <div class="row">
        <select id="charSel"></select>
        <button class="btn smallbtn" id="newCharBtn">New Character</button>
        <button class="btn smallbtn hidden" id="dupCharBtn">Duplicate</button>
        <button class="btn smallbtn hidden" id="delCharBtn">Delete</button>
      </div>
      <hr/>
      <div class="row">
        <button class="btn active" data-ctab="sheet">Sheet</button>
        <button class="btn" data-ctab="actions">Weapons</button>
        <button class="btn" data-ctab="inventory">Inventory</button>
      </div>

      <div id="ctab-sheet" style="margin-top:12px;">
        <div class="kv">
          <div class="k"><label>HP Current</label><input class="input" id="hpCur"/></div>
          <div class="k"><label>HP Max</label><input class="input" id="hpMax"/></div>
          <div class="k"><label>Temp HP</label><input class="input" id="hpTemp"/></div>
          <div class="k"><label>AC</label><input class="input" id="acVal"/></div>
          <div class="k"><label>Initiative</label><input class="input" id="initVal"/></div>
          <div class="k"><label>Speed</label><input class="input" id="spdVal"/></div>
        </div>
        <hr/>
        <div class="kv">
          <div class="k"><label>STR</label><input class="input" id="stStr"/></div>
          <div class="k"><label>DEX</label><input class="input" id="stDex"/></div>
          <div class="k"><label>CON</label><input class="input" id="stCon"/></div>
          <div class="k"><label>INT</label><input class="input" id="stInt"/></div>
          <div class="k"><label>WIS</label><input class="input" id="stWis"/></div>
          <div class="k"><label>CHA</label><input class="input" id="stCha"/></div>
        </div>
        <hr/>
        <div class="row">
          <div class="pill">Conditions</div>
          <div class="mini">Tap to toggle.</div>
        </div>
        <div class="row" id="condRow" style="margin-top:10px;gap:8px;flex-wrap:wrap;"></div>
        <div class="row" style="margin-top:10px;">
          <button class="btn smallbtn" id="addCondBtn">Add Condition</button>
        </div>
        <hr/>
        <div class="kv">
          <div class="k"><label>Cash</label><input class="input" id="cashVal"/></div>
          <div class="k"><label>Bank</label><input class="input" id="bankVal"/></div>
        </div>
        <hr/>
        <div class="row">
          <div class="pill">Ammo Tracking</div>
          <div class="mini">Keyed by ammo type (e.g. 9mm, .45, shells).</div>
          <button class="btn smallbtn right" id="addAmmoBtn">Add Ammo Type</button>
        </div>
        <table style="margin-top:10px;">
          <thead><tr><th>TYPE</th><th>CURRENT</th><th>MAGS</th><th></th></tr></thead>
          <tbody id="ammoBody"></tbody>
        </table>
        <hr/>
        <div>
          <div class="pill">Notes / Bio</div>
          <textarea id="notesBox" class="input" placeholder="Background, contacts, aliases, etc..." style="width:100%;margin-top:10px;"></textarea>
        </div>
        <div class="row" style="margin-top:10px;">
          <button class="btn smallbtn right" id="saveSheetBtn">Save Sheet</button>
        </div>
      </div>

      <div id="ctab-actions" class="hidden" style="margin-top:12px;">
        <table>
          <thead><tr><th>WEAPON</th><th>RANGE</th><th>HIT/DC</th><th>DAMAGE</th><th></th></tr></thead>
          <tbody id="weapBody"></tbody>
        </table>
        <div class="mini" style="margin-top:8px;">Ammo lines under weapons track starting/current. Purchases go to Inventory.</div>
      </div>

      <div id="ctab-inventory" class="hidden" style="margin-top:12px;">
        <table>
          <thead><tr><th>CATEGORY</th><th>EQUIPMENT NAME</th><th>WEIGHT</th><th>QTY</th><th>COST ($)</th><th>NOTES</th><th></th></tr></thead>
          <tbody id="invBody"></tbody>
        </table>
        <button class="btn smallbtn" id="addInvBtn" style="margin-top:10px;">Add Inventory Item</button>
      </div>
    </div>
  </section>

  <section id="tab-intel" class="hidden">
    <div class="panel">
      <div class="row">
        <div class="pill">Intel</div>
        <div class="mini">Players see revealed clues only. DM can manage visibility and archive.</div>
        <button class="btn smallbtn hidden right" id="createClueBtn">New Clue</button>
      </div>
      <hr/>

      <div id="dmIntelPanels" class="hidden">
        <div class="row" style="margin-bottom:10px;">
          <button class="btn active" data-itab="notifications">Notifications</button>
          <button class="btn" data-itab="activeclues">Active Clues</button>
          <button class="btn" data-itab="archived">Archived Clues</button>
        </div>

        <div id="itab-notifications">
          <div class="row" style="margin-bottom:10px;">
            <button class="btn smallbtn" id="dmNewNotifBtn">Create Notification</button>
            <button class="btn smallbtn" id="clearResolvedBtn">Clear Resolved</button>
          </div>
          <table>
            <thead><tr><th>ID</th><th>TYPE</th><th>TITLE</th><th>FROM</th><th>STATUS</th><th>DM NOTES</th><th></th></tr></thead>
            <tbody id="notifBody"></tbody>
          </table>
        </div>

        <div id="itab-activeclues" class="hidden">
          <table>
            <thead><tr><th>VIS</th><th>TITLE</th><th>TAGS</th><th>DISTRICT</th><th>DATE</th><th></th></tr></thead>
            <tbody id="clueBody"></tbody>
          </table>
        </div>

        <div id="itab-archived" class="hidden">
          <table>
            <thead><tr><th>TITLE</th><th>TAGS</th><th>DISTRICT</th><th>DATE</th><th></th></tr></thead>
            <tbody id="archBody"></tbody>
          </table>
        </div>
      </div>

      <div id="playerIntel">
        <div class="row">
          <input class="input" id="intelSearch" placeholder="Search revealed clues..." style="flex:1;min-width:240px;"/>
          <input class="input" id="intelTag" placeholder="Tag filter (optional)" style="min-width:200px;"/>
          <input class="input" id="intelDistrict" placeholder="District filter (optional)" style="min-width:200px;"/>
        </div>
        <div class="mini" style="margin-top:10px;">Recap: last 5 revealed</div>
        <div id="intelRecap" class="mini" style="margin-top:6px;"></div>
        <hr/>
        <div id="intelList"></div>
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
        <div class="pill">Settings</div>
        <div class="mini">DM-only. Changes apply immediately.</div>
      </div>
      <hr/>
      <div class="kv">
        <div class="k">
          <label>Accent Color</label>
          <input class="input" id="accentInput" placeholder="#00e5ff"/>
        </div>
        <div class="k">
          <label>DM Passkey (rotate)</label>
          <div class="row">
            <input class="input" id="dmKeyNew" placeholder="New DM passkey" style="flex:1;min-width:220px;"/>
            <button class="btn smallbtn" id="setDmKeyBtn">Set</button>
          </div>
        </div>
      </div>
      <hr/>
      <div class="row">
        <div class="pill">Feature Toggles</div>
        <label class="mini"><input type="checkbox" id="featShop"/> Shop</label>
        <label class="mini"><input type="checkbox" id="featIntel"/> Intel</label>
        <label class="mini"><input type="checkbox" id="featNotif"/> Notifications</label>
        <button class="btn smallbtn right" id="saveSettingsBtn">Save Settings</button>
      </div>
      <hr/>
      <div class="row">
        <button class="btn smallbtn" id="exportStateBtn">Export State JSON</button>
        <label class="btn smallbtn" style="cursor:pointer;">
          Import State JSON
          <input type="file" id="importStateFile" accept="application/json" style="display:none;" />
        </label>
        <button class="btn smallbtn" id="resetStateBtn" style="border-color:rgba(255,90,90,.35);">Reset State</button>
      </div>
      <div class="mini" style="margin-top:10px;">Reset is destructive. Export first unless you're feeling brave.</div>
    </div>
  </section>
</main>

<div class="toast" id="toast"></div>

<script>
// ---- Modal helpers (kept from your build)
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
    ui.mBody.innerHTML = '<div style="line-height:1.5;opacity:.95">' + message + "</div>";
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
      const isText = f.type === "textarea";
      html += '<div style="margin:10px 0 6px;opacity:.9">' + label + "</div>";
      if(isText){
        html += '<textarea class="vwFormInput" data-key="' + escAttr(key) + '" ' +
          'placeholder="' + placeholder + '" ' +
          'style="width:100%;min-height:120px;padding:12px;border-radius:12px;border:1px solid #2b3a4d;' +
          'background:rgba(255,255,255,.03);color:#e9f1ff;outline:none;">' + value + '</textarea>';
      } else {
        html += '<input class="vwFormInput" data-key="' + escAttr(key) + '" ' +
          'placeholder="' + placeholder + '" value="' + value + '" ' +
          'style="width:100%;padding:12px;border-radius:12px;border:1px solid #2b3a4d;' +
          'background:rgba(255,255,255,.03);color:#e9f1ff;outline:none;" />';
      }
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

// ---- app state
let SESSION = { role:null, name:null, dmKey:null, activeCharId:null, sessionStart:Date.now() };
function esc(s){ return String(s||"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }
function toast(msg){
  const t=document.getElementById("toast");
  t.textContent=msg; t.style.display="block";
  clearTimeout(window.__toastT); window.__toastT=setTimeout(()=>t.style.display="none",1800);
}

function setAccent(accent){
  if(!accent) return;
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--accent2", accent);
}

function setRoleUI(){
  const isDM = SESSION.role === "dm";
  document.getElementById("dmIntelPanels").classList.toggle("hidden", !isDM);
  document.getElementById("playerIntel").classList.toggle("hidden", isDM);
  document.getElementById("dmShopRow").classList.toggle("hidden", !isDM);
  document.getElementById("editShopBtn").classList.toggle("hidden", !isDM);
  document.getElementById("settingsTabBtn").classList.toggle("hidden", !isDM);
  document.getElementById("quickSettingsBtn").classList.toggle("hidden", !isDM);
  document.getElementById("dupCharBtn").classList.toggle("hidden", !isDM);
  document.getElementById("delCharBtn").classList.toggle("hidden", !isDM);
  document.getElementById("createClueBtn").classList.toggle("hidden", !isDM);
}

async function api(path, opts={}){
  opts.headers ||= {};
  opts.headers["Content-Type"]="application/json";
  if(SESSION.role==="dm" && SESSION.dmKey) opts.headers["X-DM-Key"]=SESSION.dmKey;
  if(SESSION.role==="player" && SESSION.name) opts.headers["X-Player-Name"]=SESSION.name;
  const r = await fetch(path, opts);
  const txt = await r.text();
  try { return JSON.parse(txt); }
  catch { return { ok:false, error: txt || ("HTTP " + r.status) }; }
}

function nowClock(){
  const d=new Date();
  const hh=String(d.getHours()).padStart(2,"0");
  const mm=String(d.getMinutes()).padStart(2,"0");
  const clockEl = document.getElementById("clockPill");
  if(clockEl) clockEl.textContent=hh+":"+mm;
  const elapsed = Math.floor((Date.now()-SESSION.sessionStart)/1000);
  const m = String(Math.floor(elapsed/60)).padStart(2,"0");
  const s = String(elapsed%60).padStart(2,"0");
  const sessEl = document.getElementById("sessionClockMini");
  if(sessEl) sessEl.textContent = m+":"+s;
}
setInterval(nowClock,1000); try{ nowClock(); } catch(e){}

function renderTabs(tab){
  document.querySelectorAll(".nav .btn").forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
  ["home","character","intel","shop","settings"].forEach(t=>{
    const el = document.getElementById("tab-"+t);
    if(el) el.classList.toggle("hidden", t!==tab);
  });
}
document.querySelectorAll(".nav .btn").forEach(b=>b.onclick=()=>renderTabs(b.dataset.tab));
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>renderTabs(b.dataset.go));

document.querySelectorAll("[data-ctab]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("[data-ctab]").forEach(x=>x.classList.toggle("active", x===b));
  document.getElementById("ctab-sheet").classList.toggle("hidden", b.dataset.ctab!=="sheet");
  document.getElementById("ctab-actions").classList.toggle("hidden", b.dataset.ctab!=="actions");
  document.getElementById("ctab-inventory").classList.toggle("hidden", b.dataset.ctab!=="inventory");
});

document.querySelectorAll("[data-itab]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("[data-itab]").forEach(x=>x.classList.toggle("active", x===b));
  document.getElementById("itab-notifications").classList.toggle("hidden", b.dataset.itab!=="notifications");
  document.getElementById("itab-activeclues").classList.toggle("hidden", b.dataset.itab!=="activeclues");
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
    const role = roleSel.value;
    const name=document.getElementById("whoName").value.trim()|| (role==="dm" ? "DM" : "Player");
    if(role==="dm"){
      const key=document.getElementById("dmKey").value.trim();
      const res = await api("/api/dm/login",{method:"POST",body:JSON.stringify({name, key})});
      if(!res.ok){ toast(res.error||"Denied"); return; }
      SESSION.role="dm"; SESSION.name=name; SESSION.dmKey=key;
      document.getElementById("whoPill").textContent="DM: "+name;
      document.getElementById("loginOverlay").style.display="none";
      setRoleUI();
      await refreshAll();
      return;
    }
    // player path (works even if the DM key row is still visible)
    SESSION.role="player"; SESSION.name=name;
    document.getElementById("whoPill").textContent="Player: "+name;
    document.getElementById("loginOverlay").style.display="none";
    setRoleUI();
    await refreshAll();
  };

document.getElementById("newCharBtn").onclick = async () => {
  const name = await vwModalInput({ title: "New Character", label: "Character name", placeholder: "e.g. Mara Kincaid" });
  if (!name) return;
  const res = await api("/api/character/new", { method: "POST", body: JSON.stringify({ name }) });
  if (res.ok) { SESSION.activeCharId = res.id; toast("Character created"); await refreshAll(); }
  else { toast(res.error || "Failed to create character"); }
};

// ---- Shop
function renderShop(){
  const st=window.__STATE||{};
  const f = st?.settings?.features || {};
  const shops=st.shops||{};
  const enabled=!!shops.enabled;
  document.getElementById("shopEnabledPill").textContent = enabled ? "Shop: Enabled" : "Shop: Disabled";
  document.getElementById("shopPill").textContent = "Shop: " + (shops.list?.find(s=>s.id===shops.activeShopId)?.name || "--");

  // feature toggle (players)
  if(f.shop === false && SESSION.role !== "dm"){
    document.getElementById("shopBody").innerHTML = '<tr><td colspan="7" class="mini">Shop is disabled by DM.</td></tr>';
    document.getElementById("shopEnabledPill").textContent = "Shop: Disabled";
    return;
  }

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

  document.getElementById("toggleShopBtn").onclick = async ()=>{
    if(SESSION.role!=="dm") return;
    shops.enabled = !shops.enabled;
    await api("/api/shops/save",{method:"POST",body:JSON.stringify({shops})});
    toast("Shop toggled"); await refreshAll();
  };
  document.getElementById("addShopBtn").onclick = async ()=>{
    if(SESSION.role!=="dm") return;
    const n = await vwModalInput({ title: "New Shop", label: "Shop name", placeholder: "e.g. Riverside Armory" });
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
    const n = await vwModalInput({ title: "Rename Shop", label: "Shop name", value: curr.name, placeholder: "Shop name" });
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
      '<td>'+esc(it.weight||"")+'</td><td>'+esc(it.notes||"")+'</td><td>'+esc(it.stock||"INF")+'</td>'+
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
            { key:"stock",    label:"Stock (INF or number)", value: String(it.stock ?? "INF"), placeholder:"INF" },
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
        const ok = await vwModalConfirm({ title: "Delete Item", message: 'Delete "' + (it.name || "this item") + '"?' });
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
        const isUnique = String(it.notes||"").toLowerCase().includes("unique");
        if(isUnique && c.inventory.some(x=>String(x.name||"").toLowerCase()===String(it.name||"").toLowerCase())){
          toast("Already owned"); return;
        }
        c.inventory.push({category:it.category||"", name:it.name, weight:String(it.weight||""), qty:"1", cost:String(it.cost||""), notes:it.notes||""});
        await saveCharacter(c);
        // create notification request for DM (if enabled)
        const f = (window.__STATE?.settings?.features)||{};
        if(f.notifications !== false){
          await api("/api/notify",{method:"POST",body:JSON.stringify({type:"purchase_request", title:"Shop Purchase", detail: it.name + " ($" + it.cost + ")", from: SESSION.name||"Player"})});
        }
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
          { key:"stock",    label:"Stock (INF or number)", value:"INF", placeholder:"INF" },
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

// ---- Intel
function renderIntel(){
  const st = window.__STATE || {};
  const f = st?.settings?.features || {};
  if(f.intel === false && SESSION.role !== "dm"){
    document.getElementById("intelList").innerHTML = '<div class="mini">Intel is disabled by DM.</div>';
    document.getElementById("intelRecap").textContent = "";
    return;
  }

  const revealed = (st.clues?.revealed || st.clues?.list || []).filter(c=>c.visibility==="revealed" || c.visibility==="revealed");
  // recap (last 5)
  const recap = revealed.slice(0,5).map(c => "- " + c.title).join("\n");
  document.getElementById("intelRecap").textContent = recap || "No revealed intel yet.";

  function applyFilters(){
    const q = (document.getElementById("intelSearch").value || "").toLowerCase().trim();
    const tag = (document.getElementById("intelTag").value || "").toLowerCase().trim();
    const dist = (document.getElementById("intelDistrict").value || "").toLowerCase().trim();
    let list = (st.clues?.revealed || []).slice();
    if(q) list = list.filter(c => (c.title||"").toLowerCase().includes(q) || (c.details||"").toLowerCase().includes(q));
    if(tag) list = list.filter(c => (c.tags||[]).some(t => String(t).toLowerCase().includes(tag)));
    if(dist) list = list.filter(c => String(c.district||"").toLowerCase().includes(dist));
    const wrap = document.getElementById("intelList");
    if(!list.length){
      wrap.innerHTML = '<div class="mini">No matching revealed clues.</div>';
      return;
    }
    wrap.innerHTML = list.map(c => (
      '<div class="panel" style="margin-bottom:10px;">' +
        '<div class="row">' +
          '<div style="color:var(--accent);font-weight:700;">'+esc(c.title)+'</div>' +
          '<div class="badge">'+esc(c.date||"")+'</div>' +
          (c.district ? '<div class="badge">'+esc(c.district)+'</div>' : '') +
          ((c.tags&&c.tags.length) ? '<div class="badge">'+esc(c.tags.join(", "))+'</div>' : '') +
        '</div>' +
        '<div class="mini" style="margin-top:8px;white-space:pre-wrap;">'+esc(c.details)+'</div>' +
        (c.source ? '<div class="mini" style="margin-top:8px;">Source: '+esc(c.source)+'</div>' : '') +
      '</div>'
    )).join("");
  }

  document.getElementById("intelSearch").oninput = applyFilters;
  document.getElementById("intelTag").oninput = applyFilters;
  document.getElementById("intelDistrict").oninput = applyFilters;
  applyFilters();

  // DM create clue button
  document.getElementById("createClueBtn").onclick = async ()=>{
    if(SESSION.role !== "dm") return;
    const r = await vwModalForm({
      title: "New Clue",
      fields: [
        { key:"title", label:"Title", placeholder:"Clue title" },
        { key:"details", label:"Details", placeholder:"Full intel details", type:"textarea" },
        { key:"source", label:"Source (optional)", placeholder:"Who/where it came from" },
        { key:"tags", label:"Tags (comma separated)", placeholder:"rift, hq, riverside" },
        { key:"district", label:"District (optional)", placeholder:"Cock & Dagger" },
        { key:"date", label:"Date (YYYY-MM-DD optional)", placeholder:"2026-02-07" },
      ],
      okText: "Create"
    });
    if(!r || !r.title || !r.details) return;
    const payload = {
      title: r.title,
      details: r.details,
      source: r.source,
      tags: (r.tags||"").split(",").map(x=>x.trim()).filter(Boolean),
      district: r.district,
      date: r.date
    };
    const out = await api("/api/clues/create",{method:"POST",body:JSON.stringify(payload)});
    if(out.ok){ toast("Clue created"); await refreshAll(); }
    else toast(out.error || "Failed");
  };
}

// ---- DM panels: notifications + clues
function renderDM(){
  if(SESSION.role!=="dm") return;
  const st=window.__STATE||{};

  // Notifications
  const nb=document.getElementById("notifBody");
  nb.innerHTML="";
  (st.notifications?.items||[]).forEach(n=>{
    const tr=document.createElement("tr");
    tr.innerHTML =
      '<td>'+n.id+'</td>'+
      '<td>'+esc(n.type)+'</td>'+
      '<td>'+esc(n.title||"")+'</td>'+
      '<td>'+esc(n.from||"")+'</td>'+
      '<td>'+esc(n.status||"")+'</td>'+
      '<td>'+esc(n.dmNotes||"")+'</td>'+
      '<td></td>';
    const td=tr.lastChild;
    td.innerHTML = '<button class="btn smallbtn">Ack</button> <button class="btn smallbtn">Resolve</button> <button class="btn smallbtn">Notes</button>';
    const [ackBtn, resBtn, noteBtn] = td.querySelectorAll("button");
    ackBtn.onclick = async ()=>{
      await api("/api/notifications/update",{method:"POST",body:JSON.stringify({id:n.id, status:"acknowledged"})});
      toast("Acknowledged"); await refreshAll();
    };
    resBtn.onclick = async ()=>{
      await api("/api/notifications/update",{method:"POST",body:JSON.stringify({id:n.id, status:"resolved"})});
      toast("Resolved"); await refreshAll();
    };
    noteBtn.onclick = async ()=>{
      const notes = await vwModalInput({title:"DM Notes", label:"Notes", value:n.dmNotes||"", placeholder:"approved, deliver next session"});
      if(notes === null) return;
      await api("/api/notifications/update",{method:"POST",body:JSON.stringify({id:n.id, dmNotes:notes})});
      toast("Notes saved"); await refreshAll();
    };
    nb.appendChild(tr);
  });

  document.getElementById("clearResolvedBtn").onclick=async ()=>{
    await api("/api/notifications/clear_resolved",{method:"POST"});
    toast("Cleared"); await refreshAll();
  };

  document.getElementById("dmNewNotifBtn").onclick = async ()=>{
    const r = await vwModalForm({
      title: "Create Notification",
      fields: [
        { key:"type", label:"Type", placeholder:"request | intel_drop | purchase_request | mission_update", value:"mission_update" },
        { key:"title", label:"Title", placeholder:"Short title", value:"" },
        { key:"detail", label:"Detail", placeholder:"Longer detail (optional)" , value:"" },
        { key:"scope", label:"Scope", placeholder:"broadcast or request", value:"broadcast" }
      ],
      okText: "Create"
    });
    if(!r || !r.title) return;
    const out = await api("/api/notifications/create",{method:"POST",body:JSON.stringify({
      type:r.type, title:r.title, detail:r.detail, scope:r.scope, from: SESSION.name || "DM"
    })});
    if(out.ok){ toast("Notification created"); await refreshAll(); }
    else toast(out.error || "Failed");
  };

  // Active clues
  const cb=document.getElementById("clueBody");
  cb.innerHTML="";
  (st.clues?.list||[]).forEach(c=>{
    const tr=document.createElement("tr");
    tr.innerHTML =
      '<td>'+esc(c.visibility||"hidden")+'</td>'+
      '<td>'+esc(c.title||"")+'</td>'+
      '<td>'+esc((c.tags||[]).join(", "))+'</td>'+
      '<td>'+esc(c.district||"")+'</td>'+
      '<td>'+esc(c.date||"")+'</td>'+
      '<td></td>';
    const td=tr.lastChild;
    td.innerHTML = '<button class="btn smallbtn">Edit</button> <button class="btn smallbtn">Reveal</button> <button class="btn smallbtn">Hide</button> <button class="btn smallbtn">Archive</button>';
    const [editBtn, revBtn, hideBtn, archBtn] = td.querySelectorAll("button");
    editBtn.onclick = async ()=>{
      const r = await vwModalForm({
        title: "Edit Clue",
        fields: [
          { key:"title", label:"Title", value:c.title||"" },
          { key:"details", label:"Details", value:c.details||"", type:"textarea" },
          { key:"source", label:"Source", value:c.source||"" },
          { key:"tags", label:"Tags (comma separated)", value:(c.tags||[]).join(", ") },
          { key:"district", label:"District", value:c.district||"" },
          { key:"date", label:"Date (YYYY-MM-DD)", value:c.date||"" },
        ],
        okText: "Save"
      });
      if(!r || !r.title || !r.details) return;
      const out = await api("/api/clues/update",{method:"POST",body:JSON.stringify({
        id:c.id,
        title:r.title, details:r.details, source:r.source,
        tags:(r.tags||"").split(",").map(x=>x.trim()).filter(Boolean),
        district:r.district, date:r.date
      })});
      if(out.ok){ toast("Saved"); await refreshAll(); }
      else toast(out.error || "Failed");
    };
    revBtn.onclick = async ()=>{
      await api("/api/clues/visibility",{method:"POST",body:JSON.stringify({id:c.id, visibility:"revealed"})});
      toast("Revealed"); await refreshAll();
    };
    hideBtn.onclick = async ()=>{
      await api("/api/clues/visibility",{method:"POST",body:JSON.stringify({id:c.id, visibility:"hidden"})});
      toast("Hidden"); await refreshAll();
    };
    archBtn.onclick = async ()=>{
      const ok = await vwModalConfirm({title:"Archive Clue", message:'Archive "'+c.title+'"?'});
      if(!ok) return;
      await api("/api/clues/archive",{method:"POST",body:JSON.stringify({id:c.id})});
      toast("Archived"); await refreshAll();
    };
    cb.appendChild(tr);
  });
  if(!(st.clues?.list||[]).length){
    cb.innerHTML = '<tr><td colspan="6" class="mini">No active clues yet. Click New Clue.</td></tr>';
  }

  // Archived clues
  const ab=document.getElementById("archBody");
  ab.innerHTML="";
  (st.clues?.archived||[]).forEach((c)=>{
    const tr=document.createElement("tr");
    tr.innerHTML =
      '<td>'+esc(c.title||"")+'</td>'+
      '<td>'+esc((c.tags||[]).join(", "))+'</td>'+
      '<td>'+esc(c.district||"")+'</td>'+
      '<td>'+esc(c.date||"")+'</td>'+
      '<td></td>';
    const td=tr.lastChild;
    td.innerHTML = '<button class="btn smallbtn">Restore</button> <button class="btn smallbtn">Delete</button>';
    const [restBtn, delBtn] = td.querySelectorAll("button");
    restBtn.onclick=async ()=>{
      await api("/api/clues/restore",{method:"POST",body:JSON.stringify({id:c.id})});
      toast("Restored"); await refreshAll();
    };
    delBtn.onclick=async ()=>{
      const ok = await vwModalConfirm({title:"Delete Archived Clue", message:'Delete "'+c.title+'"?'});
      if(!ok) return;
      await api("/api/clues/delete",{method:"POST",body:JSON.stringify({id:c.id, archived:true})});
      toast("Deleted"); await refreshAll();
    };
    ab.appendChild(tr);
  });
  if(!(st.clues?.archived||[]).length){
    ab.innerHTML = '<tr><td colspan="5" class="mini">No archived clues.</td></tr>';
  }
}

// ---- Settings
function renderSettings(){
  if(SESSION.role!=="dm") return;
  const st = window.__STATE || {};
  document.getElementById("accentInput").value = st?.settings?.theme?.accent || "#00e5ff";
  document.getElementById("featShop").checked = st?.settings?.features?.shop !== false;
  document.getElementById("featIntel").checked = st?.settings?.features?.intel !== false;
  document.getElementById("featNotif").checked = st?.settings?.features?.notifications !== false;

  document.getElementById("setDmKeyBtn").onclick = async ()=>{
    const key = document.getElementById("dmKeyNew").value.trim();
    if(!key){ toast("Enter a key"); return; }
    const ok = await vwModalConfirm({title:"Rotate DM Key", message:"This will immediately invalidate the old key. Continue?"});
    if(!ok) return;
    const out = await api("/api/settings/dmkey",{method:"POST",body:JSON.stringify({dmKey:key})});
    if(out.ok){ SESSION.dmKey = key; document.getElementById("dmKeyNew").value=""; toast("DM key updated"); await refreshAll(); }
    else toast(out.error || "Failed");
  };

  document.getElementById("saveSettingsBtn").onclick = async ()=>{
    const accent = document.getElementById("accentInput").value.trim();
    const feat = {
      shop: document.getElementById("featShop").checked,
      intel: document.getElementById("featIntel").checked,
      notifications: document.getElementById("featNotif").checked
    };
    const out = await api("/api/settings/save",{method:"POST",body:JSON.stringify({theme:{accent}, features:feat})});
    if(out.ok){ toast("Settings saved"); await refreshAll(); }
    else toast(out.error || "Failed");
  };

  document.getElementById("exportStateBtn").onclick = async ()=>{
    const out = await api("/api/settings/export",{method:"POST"});
    if(!out || !out.ok){ toast(out.error||"Export failed"); return; }
    const blob = new Blob([JSON.stringify(out.state, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "veilwatch_state_export.json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Exported");
  };

  document.getElementById("importStateFile").onchange = async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    const ok = await vwModalConfirm({title:"Import State", message:"Import will overwrite current state. Continue?"});
    if(!ok){ e.target.value=""; return; }
    const txt = await file.text();
    let parsed = null;
    try{ parsed = JSON.parse(txt); } catch(_){ toast("Invalid JSON"); e.target.value=""; return; }
    const out = await api("/api/settings/import",{method:"POST",body:JSON.stringify({state: parsed})});
    if(out.ok){ toast("Imported"); e.target.value=""; await refreshAll(); }
    else { toast(out.error || "Import failed"); e.target.value=""; }
  };

  document.getElementById("resetStateBtn").onclick = async ()=>{
    const ok = await vwModalConfirm({title:"Reset State", message:"This resets everything to defaults. Export first. Continue?"});
    if(!ok) return;
    const out = await api("/api/settings/reset",{method:"POST"});
    if(out.ok){ toast("Reset"); await refreshAll(); }
    else toast(out.error || "Failed");
  };
}

// initial refresh happens after login
</script>

<!-- Veilwatch Modal -->
<div id="vwModal" style="position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.65);z-index:9999;">
  <div style="width:min(640px,92vw);background:#0f1722;border:1px solid #2b3a4d;border-radius:14px;padding:16px;color:#e9f1ff;">
    <div id="vwModalTitle" style="font-size:18px;margin-bottom:10px;">Modal</div>
    <div id="vwModalBody"></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;">
      <button id="vwModalCancel" style="min-height:44px;padding:10px 14px;border-radius:12px;border:1px solid #2b3a4d;background:transparent;color:#e9f1ff;cursor:pointer;">Cancel</button>
      <button id="vwModalOk" style="min-height:44px;padding:10px 14px;border-radius:12px;border:1px solid #2b3a4d;background:#19324f;color:#e9f1ff;cursor:pointer;">OK</button>
    </div>
  </div>
</div>
</body>
</html>`;

// ---- Server
const server = http.createServer(async (req,res)=>{
  const parsed = url.parse(req.url, true);
  const p = parsed.pathname || "/";
  if(p === "/" || p === "/index.html"){
    return text(res, 200, INDEX_HTML, "text/html; charset=utf-8");
  }

  // API
  if(p === "/api/state" && req.method==="GET"){
    // SECURITY: never leak dmKey to non-DM
    if(isDM(req)){
      return json(res, 200, state);
    }
    // player view: redact + filter intel
    const st = structuredCloneSafe(state);
    if(st.settings) delete st.settings.dmKey;
    st.settings ||= {};
    st.settings.theme ||= { accent:"#00e5ff" };
    st.settings.features ||= { shop:true, intel:true, notifications:true };

    // hide DM-only lists
    if(st.notifications) st.notifications.items = (st.notifications.items||[]).filter(n=>{
      // players see broadcasts + their own requests (by display name)
      const name = playerName(req);
      return n.scope === "broadcast" || (name && String(n.from||"").toLowerCase() === name.toLowerCase());
    });

    // intel: revealed only (and only if enabled)
    const f = st.settings.features || {};
    if(f.intel === false){
      st.clues = { revealed: [] };
    } else {
      const revealed = (state.clues?.list||[]).filter(c=>c.visibility==="revealed").sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));
      st.clues = { revealed };
    }
    // settings still include theme+features
    return json(res, 200, st);
  }

  if(p === "/api/dm/login" && req.method==="POST"){
    const body = JSON.parse(await readBody(req) || "{}");
    if(String(body.key||"") !== state.settings.dmKey){
      return json(res, 200, {ok:false, error:"Invalid DM passkey"});
    }
    return json(res, 200, {ok:true});
  }

  // Characters
  if(p === "/api/character/new" && req.method==="POST"){
    const body = JSON.parse(await readBody(req) || "{}");
    const name = safeString(body.name, 60).slice(0,60) || "Unnamed";
    const id = "c_" + Math.random().toString(36).slice(2,10);
    const c = {
      id, name,
      sheet: {
        vitals: { hp_current: 10, hp_max: 10, temp_hp: 0, ac: 10, initiative: 0, speed: 30 },
        stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        conditions: [], notes: "", money: { cash: 0, bank: 0 }, ammo: {}
      },
      weapons: [], inventory: []
    };
    state.characters.push(c);
    saveState(state);
    return json(res, 200, {ok:true, id});
  }

  if(p === "/api/character/save" && req.method==="POST"){
    const body = JSON.parse(await readBody(req) || "{}");
    const charId = String(body.charId||"");
    const i = state.characters.findIndex(c=>c.id===charId);
    if(i<0) return json(res, 404, {ok:false, error:"Not found"});
    // migrate/normalize incoming character
    const incoming = migrateState({ ...state, characters:[body.character] }).characters[0];
    state.characters[i] = incoming;
    state.characters = state.characters.filter(c => !String(c?.name||"").toLowerCase().includes("example"));
    saveState(state);
    return json(res, 200, {ok:true});
  }

  if(p === "/api/character/delete" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    const charId = String(body.charId||"");
    state.characters = (state.characters||[]).filter(c=>c.id!==charId);
    saveState(state);
    return json(res, 200, {ok:true});
  }

  if(p === "/api/character/duplicate" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    const charId = String(body.charId||"");
    const name = safeString(body.name, 60) || "Copy";
    const c = (state.characters||[]).find(x=>x.id===charId);
    if(!c) return json(res, 404, {ok:false, error:"Not found"});
    const id = "c_" + Math.random().toString(36).slice(2,10);
    const copy = structuredCloneSafe(c);
    copy.id = id;
    copy.name = name;
    state.characters.push(copy);
    saveState(state);
    return json(res, 200, {ok:true, id});
  }

  // Shops save (DM only)
  if(p === "/api/shops/save" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    state.shops = body.shops;
    saveState(state);
    return json(res, 200, {ok:true});
  }

  // Notifications
  if(p === "/api/notify" && req.method==="POST"){
    // compatible endpoint: player-generated notification/request
    const body = JSON.parse(await readBody(req) || "{}");
    state.notifications ||= { nextId: 1, items: [] };
    const id = state.notifications.nextId++;
    const type = safeString(body.type || "request", 60) || "request";
    const title = safeString(body.title || "Request", 80);
    const detail = safeString(body.detail || "", 2000);
    const from = safeString(body.from || playerName(req) || "", 40);
    const scope = (type.includes("request") || type.includes("purchase")) ? "request" : "broadcast";
    state.notifications.items.unshift({
      id, type, title, detail, from, status:"new", dmNotes:"", scope, createdAt: nowISO()
    });
    saveState(state);
    return json(res, 200, {ok:true});
  }

  if(p === "/api/notifications/create" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    state.notifications ||= { nextId: 1, items: [] };
    const id = state.notifications.nextId++;
    state.notifications.items.unshift({
      id,
      type: safeString(body.type || "mission_update", 60),
      title: safeString(body.title || "Notification", 80),
      detail: safeString(body.detail || "", 2000),
      from: safeString(body.from || "DM", 40),
      status: "new",
      dmNotes: "",
      scope: (String(body.scope||"broadcast").toLowerCase()==="request") ? "request" : "broadcast",
      createdAt: nowISO()
    });
    saveState(state);
    return json(res, 200, {ok:true, id});
  }

  if(p === "/api/notifications/update" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    const id = parseInt(body.id,10);
    const i = (state.notifications?.items||[]).findIndex(n => parseInt(n.id,10) === id);
    if(i<0) return json(res, 404, {ok:false, error:"Not found"});
    const n = state.notifications.items[i];
    if(body.status) n.status = String(body.status);
    if(body.dmNotes !== undefined) n.dmNotes = safeString(body.dmNotes, 500);
    state.notifications.items[i] = n;
    saveState(state);
    return json(res, 200, {ok:true});
  }

  if(p === "/api/notifications/clear_resolved" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    state.notifications.items = (state.notifications.items||[]).filter(n => String(n.status||"") !== "resolved");
    saveState(state);
    return json(res, 200, {ok:true});
  }

  // Clues
  if(p === "/api/clues/create" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    const title = safeString(body.title, 120);
    const details = safeString(body.details, 6000);
    if(!title || !details) return json(res, 400, {ok:false, error:"Title + details required"});
    const id = "cl_" + Math.random().toString(36).slice(2,10);
    state.clues ||= { list: [], archived: [] };
    state.clues.list.unshift({
      id,
      title,
      details,
      source: safeString(body.source, 200),
      tags: Array.isArray(body.tags) ? body.tags.map(x=>safeString(x,40)).filter(Boolean).slice(0,20) : [],
      district: safeString(body.district, 80),
      date: safeString(body.date, 20),
      visibility: "hidden",
      updatedAt: nowISO()
    });
    saveState(state);
    return json(res, 200, {ok:true, id});
  }

  if(p === "/api/clues/update" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    const id = String(body.id||"");
    const i = (state.clues?.list||[]).findIndex(c=>c.id===id);
    if(i<0) return json(res, 404, {ok:false, error:"Not found"});
    const c = state.clues.list[i];
    c.title = safeString(body.title, 120) || c.title;
    c.details = safeString(body.details, 6000) || c.details;
    c.source = safeString(body.source, 200);
    c.tags = Array.isArray(body.tags) ? body.tags.map(x=>safeString(x,40)).filter(Boolean).slice(0,20) : c.tags;
    c.district = safeString(body.district, 80);
    c.date = safeString(body.date, 20);
    c.updatedAt = nowISO();
    state.clues.list[i] = c;
    saveState(state);
    return json(res, 200, {ok:true});
  }

  if(p === "/api/clues/visibility" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    const id = String(body.id||"");
    const vis = String(body.visibility||"hidden");
    const i = (state.clues?.list||[]).findIndex(c=>c.id===id);
    if(i<0) return json(res, 404, {ok:false, error:"Not found"});
    state.clues.list[i].visibility = (vis==="revealed") ? "revealed" : "hidden";
    state.clues.list[i].updatedAt = nowISO();
    saveState(state);
    return json(res, 200, {ok:true});
  }

  if(p === "/api/clues/archive" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    const id = String(body.id||"");
    const i = (state.clues?.list||[]).findIndex(c=>c.id===id);
    if(i<0) return json(res, 404, {ok:false, error:"Not found"});
    const c = state.clues.list.splice(i,1)[0];
    c.visibility = "archived";
    c.archivedAt = nowISO();
    state.clues.archived.unshift(c);
    saveState(state);
    return json(res, 200, {ok:true});
  }

  if(p === "/api/clues/restore" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    const id = String(body.id||"");
    const i = (state.clues?.archived||[]).findIndex(c=>c.id===id);
    if(i<0) return json(res, 404, {ok:false, error:"Not found"});
    const c = state.clues.archived.splice(i,1)[0];
    c.visibility = "hidden";
    c.updatedAt = nowISO();
    delete c.archivedAt;
    state.clues.list.unshift(c);
    saveState(state);
    return json(res, 200, {ok:true});
  }

  if(p === "/api/clues/delete" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    const id = String(body.id||"");
    if(body.archived){
      state.clues.archived = (state.clues.archived||[]).filter(c=>c.id!==id);
    } else {
      state.clues.list = (state.clues.list||[]).filter(c=>c.id!==id);
    }
    saveState(state);
    return json(res, 200, {ok:true});
  }

  // Back-compat saves
  if(p === "/api/notifications/save" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    state.notifications = body.notifications;
    state = migrateState(state);
    saveState(state);
    return json(res, 200, {ok:true});
  }
  if(p === "/api/clues/save" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    state.clues = body.clues;
    state = migrateState(state);
    saveState(state);
    return json(res, 200, {ok:true});
  }

  // Settings
  if(p === "/api/settings/save" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    const accent = safeString(body?.theme?.accent, 20);
    state.settings.theme ||= { accent:"#00e5ff" };
    if(accent) state.settings.theme.accent = accent;
    if(body.features && typeof body.features === "object"){
      state.settings.features = {
        shop: !!body.features.shop,
        intel: !!body.features.intel,
        notifications: !!body.features.notifications
      };
    }
    saveState(state);
    return json(res, 200, {ok:true});
  }

  if(p === "/api/settings/dmkey" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    const key = safeString(body.dmKey, 80);
    if(!key || key.length < 4) return json(res, 400, {ok:false, error:"Key too short"});
    state.settings.dmKey = key;
    saveState(state);
    return json(res, 200, {ok:true});
  }

  if(p === "/api/settings/export" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    return json(res, 200, {ok:true, state});
  }

  if(p === "/api/settings/import" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    if(!body || !body.state) return json(res, 400, {ok:false, error:"Missing state"});
    state = migrateState(body.state);
    // enforce env dm key
    state.settings.dmKey = state.settings.dmKey || DM_KEY;
    saveState(state);
    return json(res, 200, {ok:true});
  }

  if(p === "/api/settings/reset" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    state = structuredCloneSafe(DEFAULT_STATE);
    state.settings.dmKey = DM_KEY; // env
    saveState(state);
    return json(res, 200, {ok:true});
  }


  if(p === "/favicon.ico"){
    res.writeHead(204, {"Cache-Control":"no-store"});
    return res.end();
  }

  return text(res, 404, "Not found");
});

(async ()=>{
  try{ await initDb(); } catch(_){ /* ignore */ }
  state = await loadState();
  server.listen(PORT, ()=>console.log("Veilwatch OS listening on", PORT));
})();
