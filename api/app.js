const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const crypto = require("crypto");

// structuredClone polyfill (Node < 17)
if(typeof globalThis.structuredClone !== "function"){
  globalThis.structuredClone = (obj)=>JSON.parse(JSON.stringify(obj));
}

const mysql = require("mysql2/promise");
const CATALOG_V2 = require(path.join(__dirname, "public", "js", "veilwatch_catalog_v2.js"));

const DM_KEY = process.env.VEILWATCH_DM_KEY || "VEILWATCHDM";
const DB_HOST = process.env.MYSQL_HOST || "";
const DB_PORT = parseInt(process.env.MYSQL_PORT || "3306", 10);
const DB_NAME = process.env.MYSQL_DATABASE || "veilwatch";
const DB_USER = process.env.MYSQL_USER || "veilwatch";
const DB_PASSWORD = process.env.MYSQL_PASSWORD || "veilwatch_pw";

let pool = null;

// -----------------------------
// MariaDB / MySQL state + users store
// -----------------------------
async function initDb(){
  if(!DB_HOST) return;
  const maxTries = 30;
  const delayMs = 2000;
  for(let attempt=1; attempt<=maxTries; attempt++){
    try{
      pool = mysql.createPool({
        host: DB_HOST,
        port: DB_PORT,
        database: DB_NAME,
        user: DB_USER,
        password: DB_PASSWORD,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });
      await pool.query(`
        CREATE TABLE IF NOT EXISTS vw_state (
          id VARCHAR(64) NOT NULL PRIMARY KEY,
          state_json LONGTEXT NOT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS vw_users (
          id VARCHAR(64) NOT NULL PRIMARY KEY,
          username VARCHAR(32) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(16) NOT NULL DEFAULT 'player',
          temp_password VARCHAR(255) DEFAULT NULL,
          must_change_password TINYINT(1) NOT NULL DEFAULT 0,
          active_char_id VARCHAR(64) NULL,
          created_at BIGINT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS vw_inventory_items (
          id VARCHAR(64) NOT NULL PRIMARY KEY,
          name VARCHAR(128) NOT NULL UNIQUE,
          category VARCHAR(64) NOT NULL DEFAULT 'Misc',
          default_weight VARCHAR(32) DEFAULT NULL,
          default_cost DECIMAL(10,2) DEFAULT NULL,
          default_notes TEXT DEFAULT NULL,
          ammo_type VARCHAR(64) DEFAULT NULL,
          default_qty INT NOT NULL DEFAULT 1,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          sort_order INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_vw_inventory_items_category (category),
          INDEX idx_vw_inventory_items_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS vw_inventory_items_custom (
          id VARCHAR(64) NOT NULL PRIMARY KEY,
          name VARCHAR(128) NOT NULL UNIQUE,
          category VARCHAR(64) NOT NULL DEFAULT 'Misc',
          default_weight VARCHAR(32) DEFAULT NULL,
          default_cost DECIMAL(10,2) DEFAULT NULL,
          default_notes TEXT DEFAULT NULL,
          ammo_type VARCHAR(64) DEFAULT NULL,
          default_qty INT NOT NULL DEFAULT 1,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          sort_order INT NOT NULL DEFAULT 0,
          created_by VARCHAR(64) DEFAULT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_vw_inventory_items_custom_category (category),
          INDEX idx_vw_inventory_items_custom_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      await dbEnsureInventoryCatalogSchema();
      await dbSeedInventoryCatalog();
      return;
    } catch(e){
      try{ if(pool) await pool.end(); } catch(_){}
      pool = null;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function dbGetState(){
  if(!pool) return null;
  const [rows] = await pool.query("SELECT state_json FROM vw_state WHERE id = ? LIMIT 1", ["main"]);
  if(!rows?.[0]?.state_json) return null;
  return JSON.parse(rows[0].state_json);
}

async function dbSaveState(st){
  if(!pool) return;
  await pool.query(
    "INSERT INTO vw_state (id, state_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = CURRENT_TIMESTAMP",
    ["main", JSON.stringify(st)]
  );
}

async function dbLoadUsers(){
  if(!pool) return null;
  const [rows] = await pool.query(`
    SELECT id, username, password, role, temp_password, must_change_password, active_char_id, created_at
    FROM vw_users
    ORDER BY created_at ASC, username ASC
  `);
  return rows.map(r => ({
    id: r.id,
    username: r.username,
    password: r.password,
    role: r.role,
    tempPassword: r.temp_password || null,
    mustChangePassword: !!r.must_change_password,
    activeCharId: r.active_char_id || null,
    createdAt: Number(r.created_at || 0)
  }));
}

async function dbSaveUsers(list){
  if(!pool) return;
  const conn = await pool.getConnection();
  try{
    await conn.beginTransaction();
    await conn.query("DELETE FROM vw_users");
    for(const u of list){
      await conn.query(
        `INSERT INTO vw_users (id, username, password, role, temp_password, must_change_password, active_char_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          u.id,
          u.username,
          u.password || "",
          u.role || "player",
          u.tempPassword || null,
          u.mustChangePassword ? 1 : 0,
          u.activeCharId || null,
          Number(u.createdAt || Date.now())
        ]
      );
    }
    await conn.commit();
  } catch(e){
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function dbColumnExists(tableName, columnName){
  if(!pool) return false;
  const [rows] = await pool.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  return Array.isArray(rows) && rows.length > 0;
}

async function dbEnsureColumn(tableName, columnName, ddl){
  if(!pool) return;
  if(await dbColumnExists(tableName, columnName)) return;
  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${ddl}`);
}

async function dbEnsureInventoryCatalogSchema(){
  if(!pool) return;
  await dbEnsureColumn("vw_inventory_items", "default_qty", "INT NOT NULL DEFAULT 1 AFTER ammo_type");
  await dbEnsureColumn("vw_inventory_items_custom", "default_qty", "INT NOT NULL DEFAULT 1 AFTER ammo_type");
  await dbEnsureColumn("vw_inventory_items_custom", "created_by", "VARCHAR(64) DEFAULT NULL AFTER sort_order");
}

function slugifyInventoryId(name){
  return "inv_" + String(name||"").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0,48);
}

function buildInventoryCatalogSeed(){
  const groups = CATALOG_V2?.inventoryItemsByCategory || {};
  const defaultsByName = new Map();
  for(const shop of (DEFAULT_STATE?.shops?.list || [])){
    for(const it of (shop.items || [])){
      defaultsByName.set(String(it.name||"").trim().toLowerCase(), {
        default_cost: (it.cost ?? null),
        default_weight: (it.weight ?? ""),
        default_notes: (it.notes ?? ""),
        default_qty: (it.qty ?? it.default_qty ?? 1)
      });
    }
  }
  const rows = [];
  let sortOrder = 0;
  for(const [category, items] of Object.entries(groups)){
    for(const rawName of (items || [])){
      const name = String(rawName || "").trim();
      if(!name) continue;
      const key = name.toLowerCase();
      const defaults = defaultsByName.get(key) || {};
      const ammoType = category === "Ammo" ? name.replace(/\s*ammo\s*\(box\)/i, "").trim() : null;
      rows.push({
        id: slugifyInventoryId(name),
        name,
        category: String(category || "Misc"),
        default_weight: defaults.default_weight ?? "",
        default_cost: (defaults.default_cost === undefined ? null : defaults.default_cost),
        default_notes: defaults.default_notes ?? "",
        ammo_type: ammoType || null,
        default_qty: Math.max(1, parseInt(defaults.default_qty ?? 1, 10) || 1),
        is_active: 1,
        sort_order: sortOrder++
      });
    }
  }
  return rows;
}

async function dbSeedInventoryCatalog(){
  if(!pool) return;
  const [rows] = await pool.query("SELECT COUNT(*) AS cnt FROM vw_inventory_items");
  const count = Number(rows?.[0]?.cnt || 0);
  if(count > 0) return;
  const seed = buildInventoryCatalogSeed();
  for(const item of seed){
    await pool.query(
      `INSERT INTO vw_inventory_items
       (id, name, category, default_weight, default_cost, default_notes, ammo_type, default_qty, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.name,
        item.category,
        item.default_weight || null,
        item.default_cost,
        item.default_notes || null,
        item.ammo_type || null,
        Math.max(1, parseInt(item.default_qty ?? 1, 10) || 1),
        item.is_active ? 1 : 0,
        Number(item.sort_order || 0)
      ]
    );
  }
}

async function dbListInventoryCatalog(){
  if(!pool) return buildInventoryCatalogSeed();
  const [officialRows] = await pool.query(`
    SELECT id, name, category, default_weight, default_cost, default_notes, ammo_type, default_qty, is_active, sort_order
    FROM vw_inventory_items
    WHERE is_active = 1
  `);
  const [customRows] = await pool.query(`
    SELECT id, name, category, default_weight, default_cost, default_notes, ammo_type, default_qty, is_active, sort_order, created_by
    FROM vw_inventory_items_custom
    WHERE is_active = 1
  `);

  const mapRow = (r, source) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    default_weight: r.default_weight ?? "",
    default_cost: (r.default_cost == null ? "" : Number(r.default_cost)),
    default_notes: r.default_notes ?? "",
    ammo_type: r.ammo_type ?? "",
    default_qty: Math.max(1, parseInt(r.default_qty ?? 1, 10) || 1),
    is_active: !!r.is_active,
    sort_order: Number(r.sort_order || 0),
    source,
    is_custom: source === "custom",
    created_by: ("created_by" in r) ? (r.created_by ?? "") : ""
  });

  return []
    .concat((officialRows || []).map(r => mapRow(r, "official")))
    .concat((customRows || []).map(r => mapRow(r, "custom")))
    .sort((a,b)=> String(a.category||"").localeCompare(String(b.category||"")) || Number(a.sort_order||0)-Number(b.sort_order||0) || String(a.name||"").localeCompare(String(b.name||"")));
}

async function dbUpsertInventoryCatalogItem(item, opts = {}){
  if(!pool) return { ok:false, error:"Database not configured" };
  const table = opts.table === "custom" ? "vw_inventory_items_custom" : "vw_inventory_items";
  const name = String(item?.name || "").trim();
  if(!name) return { ok:false, error:"Item name required" };
  const category = String(item?.category || "Misc").trim() || "Misc";
  const costRaw = item?.default_cost;
  const cost = (costRaw === "" || costRaw === null || costRaw === undefined) ? null : Number(costRaw);
  const defaultQty = Math.max(1, parseInt(item?.default_qty ?? 1, 10) || 1);

  if(table === "vw_inventory_items_custom"){
    await pool.query(
      `INSERT INTO vw_inventory_items_custom
       (id, name, category, default_weight, default_cost, default_notes, ammo_type, default_qty, is_active, sort_order, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         category = VALUES(category),
         default_weight = VALUES(default_weight),
         default_cost = VALUES(default_cost),
         default_notes = VALUES(default_notes),
         ammo_type = VALUES(ammo_type),
         default_qty = VALUES(default_qty),
         is_active = VALUES(is_active),
         sort_order = VALUES(sort_order),
         created_by = COALESCE(vw_inventory_items_custom.created_by, VALUES(created_by)),
         updated_at = CURRENT_TIMESTAMP`,
      [
        item.id || slugifyInventoryId(`custom_${name}`),
        name,
        category,
        (item?.default_weight ?? "") || null,
        (Number.isFinite(cost) ? cost : null),
        (item?.default_notes ?? "") || null,
        (item?.ammo_type ?? "") || null,
        defaultQty,
        item?.is_active === false ? 0 : 1,
        Number(item?.sort_order || 0),
        opts.createdBy || null
      ]
    );
    return { ok:true };
  }

  await pool.query(
    `INSERT INTO vw_inventory_items
     (id, name, category, default_weight, default_cost, default_notes, ammo_type, default_qty, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       category = VALUES(category),
       default_weight = VALUES(default_weight),
       default_cost = VALUES(default_cost),
       default_notes = VALUES(default_notes),
       ammo_type = VALUES(ammo_type),
       default_qty = VALUES(default_qty),
       is_active = VALUES(is_active),
       sort_order = VALUES(sort_order),
       updated_at = CURRENT_TIMESTAMP`,
    [
      item.id || slugifyInventoryId(name),
      name,
      category,
      (item?.default_weight ?? "") || null,
      (Number.isFinite(cost) ? cost : null),
      (item?.default_notes ?? "") || null,
      (item?.ammo_type ?? "") || null,
      defaultQty,
      item?.is_active === false ? 0 : 1,
      Number(item?.sort_order || 0)
    ]
  );
  return { ok:true };
}

// -----------------------------
// Persistence paths
// -----------------------------
const PORT = parseInt(process.env.PORT || "8080", 10);
// Data directory for persistent files (state/users).
// - In Docker, set VEILWATCH_DATA_DIR=/app/data and mount that path as a volume.
// - In local dev, default to ./api/data
const DATA_DIR = process.env.VEILWATCH_DATA_DIR || path.join(__dirname, "data");
const STATE_PATH = path.join(DATA_DIR, "state.json");
const USERS_PATH = path.join(DATA_DIR, "users.json");

function ensureDir(p){ try{ fs.mkdirSync(p,{recursive:true}); } catch(e){} }

// -----------------------------
// Default state
// -----------------------------
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
  characters: [],
  activeParty: [] // DM-controlled "who is currently being played"
};

function normalizeCluesShape(st){
  st.clues ||= structuredClone(DEFAULT_STATE.clues);
  if(Array.isArray(st.clues)){
    st.clues = {
      nextId: (st.clues.reduce((mx,c)=>Math.max(mx, Number(c.id||0)),0) + 1) || 1,
      items: st.clues,
      archived: []
    };
  }
  st.clues.nextId ||= 1;
  st.clues.items ||= [];
  st.clues.archived ||= [];
  return st;
}

function normalizeFeatures(st){
  if(!st.settings) st.settings = {};
  if(!st.settings.features) st.settings.features = {};
  st.settings.features.intel = true;
  st.settings.features.shop = true;
  return st;
}

function normalizeCharacters(st){
  st.characters ||= [];
  st.activeParty ||= [];
  // Minimal per-character normalization
  for(const c of st.characters){
    c.id ||= ("c_" + Math.random().toString(36).slice(2,10));
    c.ownerUserId = (typeof c.ownerUserId === "undefined") ? null : c.ownerUserId;
    c.updatedAt ||= Date.now();
    c.version ||= 1;
    c.weapons ||= [];
    c.inventory ||= [];
    c.sheet ||= {};
    c.sheet.vitals ||= { hpCur:"", hpMax:"", hpTemp:"", ac:"", init:"", speed:"" };
    c.sheet.money  ||= { cash:"", bank:"" };
    c.sheet.stats  ||= { STR:"",DEX:"",CON:"",INT:"",WIS:"",CHA:"" };
    c.sheet.conditions ||= [];
    c.sheet.notes ||= "";
  }
  // Remove example characters if any
  st.characters = st.characters.filter(c => !String(c?.name||"").toLowerCase().includes("example"));
  // Active party: drop missing char refs
  const existing = new Set(st.characters.map(c=>c.id));
  st.activeParty = (st.activeParty||[]).filter(e => existing.has(e.charId));
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
    st.settings ||= DEFAULT_STATE.settings;
    st.settings.dmKey ||= DEFAULT_STATE.settings.dmKey;
    st.settings.features ||= DEFAULT_STATE.settings.features;
    st.shops ||= DEFAULT_STATE.shops;
    st.notifications ||= DEFAULT_STATE.notifications;
    st.clues ||= DEFAULT_STATE.clues;
    normalizeCluesShape(st);
    normalizeFeatures(st);
    normalizeCharacters(st);
    fileSaveState(st);
    return st;
  } catch(e){
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
  try{
    const fromDb = await dbGetState();
    if(fromDb){
      fromDb.settings ||= {};
      fromDb.settings.dmKey = DM_KEY;
      fromDb.settings.features ||= DEFAULT_STATE.settings.features;
      fromDb.shops ||= DEFAULT_STATE.shops;
      fromDb.notifications ||= DEFAULT_STATE.notifications;
      fromDb.clues ||= DEFAULT_STATE.clues;
      normalizeCluesShape(fromDb);
      normalizeFeatures(fromDb);
      normalizeCharacters(fromDb);
      fileSaveState(fromDb);
      return fromDb;
    }
  } catch(_){}

  const st = fileLoadState();
  dbSaveState(st).catch(()=>{});
  return st;
}

function saveState(st){
  try{ normalizeFeatures(st); normalizeCluesShape(st); normalizeCharacters(st); }catch(e){}
  fileSaveState(st);
  dbSaveState(st).catch(()=>{});
  try{ sseBroadcast({ type: "state.tick", ts: Date.now() }); }catch(e){}
}

// -----------------------------
// Users + Sessions (MariaDB/MySQL primary, file backup)
// -----------------------------
let users = [];
function fileLoadUsers(){
  ensureDir(DATA_DIR);
  if(!fs.existsSync(USERS_PATH)){
    fs.writeFileSync(USERS_PATH, JSON.stringify({ users: [] }, null, 2), "utf8");
    return [];
  }
  try{
    const raw = fs.readFileSync(USERS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed.users) ? parsed.users : [];
    return list.map(u => ({
      id: u.id,
      username: u.username,
      password: u.password || "",
      role: u.role || "player",
      tempPassword: u.tempPassword || null,
      mustChangePassword: !!u.mustChangePassword,
      activeCharId: u.activeCharId || null,
      createdAt: Number(u.createdAt || 0)
    }));
  } catch(e){
    try{ fs.copyFileSync(USERS_PATH, USERS_PATH + ".corrupt.bak"); } catch(_){}
    fs.writeFileSync(USERS_PATH, JSON.stringify({ users: [] }, null, 2), "utf8");
    return [];
  }
}
function fileSaveUsers(list = users){
  ensureDir(DATA_DIR);
  fs.writeFileSync(USERS_PATH, JSON.stringify({ users: list }, null, 2), "utf8");
}
async function loadUsers(){
  try{
    const fromDb = await dbLoadUsers();
    if(Array.isArray(fromDb) && fromDb.length){
      fileSaveUsers(fromDb);
      return fromDb;
    }
  } catch(_){}
  const fromFile = fileLoadUsers();
  try{ await dbSaveUsers(fromFile); } catch(_){}
  return fromFile;
}
function saveUsers(list = users){
  users = list;
  fileSaveUsers(list);
  dbSaveUsers(list).catch(()=>{});
}

function normUsername(u){
  return String(u||"").trim().toLowerCase().replace(/\s+/g,"_").slice(0,32);
}
function makeId(prefix="u"){
  return prefix + "_" + crypto.randomBytes(8).toString("hex");
}
function findUserByUsername(username){
  const u = normUsername(username);
  return users.find(x => x.username === u) || null;
}
function publicUser(u){
  return { id: u.id, username: u.username, role: u.role, activeCharId: u.activeCharId ?? null, createdAt: u.createdAt };
}

const SESSIONS = new Map(); // token -> { userId, createdAt }
const SESSION_COOKIE = "vw_session";

function parseCookies(req){
  const hdr = req.headers.cookie || "";
  const out = {};
  hdr.split(";").forEach(part=>{
    const i = part.indexOf("=");
    if(i < 0) return;
    const k = part.slice(0,i).trim();
    const v = decodeURIComponent(part.slice(i+1).trim());
    if(k) out[k] = v;
  });
  return out;
}
function setCookie(res, name, value, opts={}){
  const parts = [];
  parts.push(`${name}=${encodeURIComponent(value)}`);
  parts.push(`Path=/`);
  parts.push(`SameSite=Lax`);
  if(opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  if(opts.httpOnly !== false) parts.push(`HttpOnly`);
  if(opts.secure) parts.push(`Secure`);
  res.setHeader("Set-Cookie", parts.join("; "));
}

function getUserFromReq(req){
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if(!token) return null;
  const sess = SESSIONS.get(token);
  if(!sess) return null;
  const u = users.find(x => x.id === sess.userId);
  return u || null;
}

function isDM(req, user){
  // DM if logged-in role dm OR legacy header key matches
  if(user && user.role === "dm") return true;
  const key = req.headers["x-dm-key"] || "";
  return key && key === state.settings.dmKey;
}

// -----------------------------
// SSE
// -----------------------------
const SSE_CLIENTS = new Set();

function sseSend(res, event, data){
  try{
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }catch(e){}
}

function sseBroadcast(payload){
  const data = payload || { ts: Date.now() };
  for(const client of Array.from(SSE_CLIENTS)){
    if(client.res.writableEnded){ SSE_CLIENTS.delete(client); continue; }
    // Role-aware delivery (players don't receive DM-only traffic)
    if(client.role !== "dm" && data?.scope === "dm") continue;
    sseSend(client.res, "update", data);
  }
}

const SSE_KEEPALIVE_MS = 20000;
setInterval(()=>{
  for(const client of Array.from(SSE_CLIENTS)){
    try{
      if(client.res.writableEnded){ SSE_CLIENTS.delete(client); continue; }
      client.res.write(`: ping ${Date.now()}\n\n`);
    }catch(e){
      SSE_CLIENTS.delete(client);
    }
  }
}, SSE_KEEPALIVE_MS);

// -----------------------------
// HTTP helpers
// -----------------------------
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


function normalizeInitiativeValue(raw){
  const s = String(raw ?? "").trim();
  if(s === "") return "";
  const n = Number(s);
  return Number.isFinite(n) ? n : s;
}

function syncCharacterInitiativeAndActiveParty(character, activeParty){
  if(!character || typeof character !== "object") return;
  character.sheet ||= {};
  character.sheet.vitals ||= { hpCur:"", hpMax:"", hpTemp:"", ac:"", init:"", speed:"" };

  const nextInit = normalizeInitiativeValue(character.sheet?.vitals?.init);
  character.sheet.vitals.init = nextInit;

  if(!Array.isArray(activeParty)) return;
  const entry = activeParty.find(x => x && x.charId === character.id);
  if(entry) entry.initiative = nextInit;
}

function deepMerge(target, patch){
  if(patch === null || patch === undefined) return target;
  if(typeof patch !== "object" || Array.isArray(patch)) return patch;
  if(typeof target !== "object" || target === null || Array.isArray(target)) target = {};
  for(const [k,v] of Object.entries(patch)){
    if(v && typeof v === "object" && !Array.isArray(v)){
      target[k] = deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

// -----------------------------
// Static /public
// -----------------------------
function loadIndexHtml(){
  try{
    return fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");
  }catch(e){
    console.warn("Veilwatch OS: public/index.html not found. Did you copy the /public folder into the container image?");
    return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Veilwatch OS - Missing public/</title></head><body style="font-family:system-ui;background:#0b0f14;color:#d9e2ef;padding:32px">
<h1>Missing /public folder in container</h1>
<p>Your server is running, but the UI files are not present inside the Docker image.</p>
</body></html>`;
  }
}
let INDEX_HTML = loadIndexHtml();

function servePublic(req, res, pathname){
  if(req.method !== "GET") return false;
  const pubRoot = path.join(__dirname, "public");
  if(pathname === "/" || pathname === "/index.html"){
    return text(res, 200, INDEX_HTML, "text/html; charset=utf-8"), true;
  }
  if(pathname === "/favicon.ico"){
    res.writeHead(204, {"Cache-Control":"no-store"});
    res.end();
    return true;
  }
  if(!pathname.startsWith("/api/") && !pathname.startsWith("/ws")){
    const safePath = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
    const filePath = path.join(pubRoot, safePath);
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
          res.end(buf);
          return true;
        }
      }catch(e){
        // fallthrough
      }
    }
  }
  return false;
}

// -----------------------------
// Server
// -----------------------------
let state = normalizeCharacters(normalizeFeatures(structuredClone(DEFAULT_STATE)));
users = [];

const server = http.createServer(async (req,res)=>{
  const parsed = url.parse(req.url, true);
  const p = parsed.pathname || "/";

  // Reload index in case user hot-swaps public files (dev convenience)
  if(p === "/index.html" && req.method === "GET"){
    INDEX_HTML = loadIndexHtml();
  }

  // static
  if(servePublic(req, res, p)) return;

  const user = getUserFromReq(req);
  const dm = isDM(req, user);

  // -------------------------
  // Auth
  // -------------------------
  if(p === "/api/auth/me" && req.method === "GET"){
    if(!user) return json(res, 200, { loggedIn:false });
    return json(res, 200, { loggedIn:true, user: publicUser(user) });
  }

  if(p === "/api/auth/register" && req.method === "POST"){
    const body = JSON.parse(await readBody(req) || "{}");
    const username = normUsername(body.username);
    const password = String(body.password||"");
    if(username.length < 3) return json(res, 200, { ok:false, error:"Username must be at least 3 chars" });
    if(password.length < 6) return json(res, 200, { ok:false, error:"Password must be at least 6 chars" });
    if(findUserByUsername(username)) return json(res, 200, { ok:false, error:"Username already exists" });

    const role = (users.length === 0) ? "dm" : "player";
    const u = {
      id: makeId("u"),
      username,
      password,
      role,
      tempPassword: null,
      mustChangePassword: false,
      createdAt: Date.now(),
      activeCharId: null
    };
    users.push(u);
    saveUsers(users);

    // auto-login
    const token = crypto.randomBytes(24).toString("hex");
    SESSIONS.set(token, { userId: u.id, createdAt: Date.now() });
    setCookie(res, SESSION_COOKIE, token, { maxAge: 60*60*24*30 });

    return json(res, 200, { ok:true, user: publicUser(u) });
  }

  if(p === "/api/auth/login" && req.method === "POST"){
    const body = JSON.parse(await readBody(req) || "{}");
    const username = normUsername(body.username);
    const password = String(body.password||"");
    const u = findUserByUsername(username);
    if(!u){
      return json(res, 200, { ok:false, error:"Invalid username or password" });
    }

    const mainMatch = password === String(u.password || "");
    const tempMatch = !!u.tempPassword && password === String(u.tempPassword || "");

    if(!mainMatch && !tempMatch){
      return json(res, 200, { ok:false, error:"Invalid username or password" });
    }

    const token = crypto.randomBytes(24).toString("hex");
    SESSIONS.set(token, { userId: u.id, createdAt: Date.now() });
    setCookie(res, SESSION_COOKIE, token, { maxAge: 60*60*24*30 });
    return json(res, 200, {
      ok:true,
      user: publicUser(u),
      mustChangePassword: !!u.mustChangePassword || tempMatch
    });
  }

  if(p === "/api/auth/logout" && req.method === "POST"){
    const cookies = parseCookies(req);
    const token = cookies[SESSION_COOKIE];
    if(token) SESSIONS.delete(token);
    setCookie(res, SESSION_COOKIE, "", { maxAge: 0 });
    return json(res, 200, { ok:true });
  }

  if(p === "/api/auth/change-password" && req.method === "POST"){
    if(!user) return json(res, 401, { ok:false, error:"Login required" });

    const body = JSON.parse(await readBody(req) || "{}");
    const newPassword = String(body.newPassword || "");
    if(newPassword.length < 6){
      return json(res, 200, { ok:false, error:"Password must be at least 6 chars" });
    }

    user.password = newPassword;
    user.tempPassword = null;
    user.mustChangePassword = false;
    saveUsers(users);

    return json(res, 200, { ok:true });
  }

  // Legacy DM key login remains for backwards compatibility
  if(p === "/api/dm/login" && req.method==="POST"){
    const body = JSON.parse(await readBody(req) || "{}");
    if(String(body.key||"") !== state.settings.dmKey){
      return json(res, 200, {ok:false, error:"Invalid DM passkey"});
    }
    return json(res, 200, {ok:true});
  }

  // -------------------------
  // SSE stream
  // -------------------------
  if(p === "/api/stream" && req.method==="GET"){
    // EventSource sends cookies automatically; use that for role. Fallback to ?k=dmKey.
    const k = (parsed.query||{}).k || "";
    const role = (user && user.role) ? user.role : ((k && k === state.settings.dmKey) ? "dm" : "player");

    res.writeHead(200, {
      "Content-Type":"text/event-stream",
      "Cache-Control":"no-cache, no-transform",
      "Connection":"keep-alive",
      "X-Accel-Buffering":"no"
    });
    res.write("\n");

    const client = { res, role, started: Date.now() };
    SSE_CLIENTS.add(client);

    sseSend(res, "hello", { ts: Date.now(), role });
    sseSend(res, "update", { ts: Date.now(), type: "state.tick" });

    req.on("close", ()=>{ SSE_CLIENTS.delete(client); });
    return;
  }

  // -------------------------
  // State
  // -------------------------
  if(p === "/api/state" && req.method==="GET"){
    normalizeCluesShape(state);
    normalizeCharacters(state);

    if(!dm){
      const safe = structuredClone(state);
      // strip dmKey
      if(safe.settings){
        safe.settings = { theme: safe.settings.theme, features: safe.settings.features || DEFAULT_STATE.settings.features };
      }
      // players only receive revealed clues
      if(safe.clues){
        safe.clues.items = (safe.clues.items||[]).filter(c=>String(c.visibility||"hidden")==="revealed");
        safe.clues.archived = [];
      }
      // hide notifications from players
      safe.notifications = { nextId: 1, items: [] };

      // character visibility: only owned characters (if logged in) else none
      if(user && user.role === "player"){
        safe.characters = (safe.characters||[]).filter(c=>c.ownerUserId === user.id);
      } else {
        safe.characters = [];
      }
      // activeParty is DM-only
      safe.activeParty = [];
      return json(res, 200, safe);
    }

    return json(res, 200, state);
  }



  // -------------------------
  // State export/import/reset (DM only)
  // -------------------------
  if(p === "/api/state/export" && req.method==="GET"){
    if(!dm) return json(res, 403, { ok:false, error:"DM only" });
    // Return as plain text so the UI can show it in a copy box
    return text(res, 200, JSON.stringify(state, null, 2), "application/json");
  }

  if(p === "/api/state/import" && req.method==="POST"){
    if(!dm) return json(res, 403, { ok:false, error:"DM only" });
    let body = {};
    try{ body = JSON.parse(await readBody(req) || "{}"); }catch(e){ body = {}; }
    const raw = body.json;
    if(!raw) return json(res, 200, { ok:false, error:"Missing json" });
    let incoming = null;
    try{
      incoming = (typeof raw === "string") ? JSON.parse(raw) : raw;
    }catch(e){
      return json(res, 200, { ok:false, error:"Invalid JSON" });
    }

    // Preserve/lock DM key rules
    const existingKey = state?.settings?.dmKey || DM_KEY;
    incoming.settings ||= {};
    if(process.env.VEILWATCH_DM_KEY){
      incoming.settings.dmKey = DM_KEY;
    }else{
      incoming.settings.dmKey ||= existingKey;
    }

    // Ensure required shapes
    incoming.settings.features ||= DEFAULT_STATE.settings.features;
    incoming.shops ||= DEFAULT_STATE.shops;
    incoming.notifications ||= DEFAULT_STATE.notifications;
    incoming.clues ||= DEFAULT_STATE.clues;
    normalizeCluesShape(incoming);
    normalizeFeatures(incoming);
    normalizeCharacters(incoming);

    state = incoming;
    saveState(state);
    sseBroadcast({ ts: Date.now(), type:"state.import", scope:"dm" });
    return json(res, 200, { ok:true });
  }

  if(p === "/api/state/reset" && req.method==="POST"){
    if(!dm) return json(res, 403, { ok:false, error:"DM only" });
    const existingKey = state?.settings?.dmKey || DM_KEY;
    state = structuredClone(DEFAULT_STATE);
    if(process.env.VEILWATCH_DM_KEY){
      state.settings.dmKey = DM_KEY;
    }else{
      state.settings.dmKey = existingKey;
    }
    saveState(state);
    sseBroadcast({ ts: Date.now(), type:"state.reset", scope:"dm" });
    return json(res, 200, { ok:true });
  }

  // -------------------------
  // DM: user list for assignment dropdown
  // -------------------------
  if(p === "/api/dm/users" && req.method === "GET"){
    if(!dm) return json(res, 403, { ok:false, error:"DM only" });
    return json(res, 200, { ok:true, users: users.map(publicUser) });
  }

  // -------------------------
  // Inventory Catalog
  // -------------------------
  if(p === "/api/catalog/inventory" && req.method === "GET"){
    try{
      const items = await dbListInventoryCatalog();
      const byCategory = {};
      for(const item of items){
        (byCategory[item.category] ||= []).push(item);
      }
      return json(res, 200, { ok:true, items, byCategory });
    }catch(e){
      console.error("inventory catalog list failed", e);
      return json(res, 500, { ok:false, error:"Failed to load inventory catalog" });
    }
  }

  if(p === "/api/catalog/inventory/save" && req.method === "POST"){
    if(!dm) return json(res, 403, { ok:false, error:"DM only" });
    try{
      const body = JSON.parse(await readBody(req) || "{}");
      const items = Array.isArray(body.items) ? body.items : [];
      for(const item of items){
        const result = await dbUpsertInventoryCatalogItem(item);
        if(!result.ok) return json(res, 200, result);
      }
      sseBroadcast({ ts: Date.now(), type:"catalog.inventory.tick", scope:"dm" });
      return json(res, 200, { ok:true });
    }catch(e){
      console.error("inventory catalog save failed", e);
      return json(res, 500, { ok:false, error:"Failed to save inventory catalog" });
    }
  }

  if(p === "/api/catalog/inventory/custom/save" && req.method === "POST"){
    if(!dm) return json(res, 403, { ok:false, error:"DM only" });
    try{
      const body = JSON.parse(await readBody(req) || "{}");
      const item = body?.item || null;
      const result = await dbUpsertInventoryCatalogItem(item, { table:"custom", createdBy: user?.id || null });
      if(!result.ok) return json(res, 200, result);
      sseBroadcast({ ts: Date.now(), type:"catalog.inventory.tick", scope:"dm" });
      return json(res, 200, { ok:true });
    }catch(e){
      console.error("custom inventory catalog save failed", e);
      return json(res, 500, { ok:false, error:"Failed to save custom inventory item" });
    }
  }

  // -------------------------
  // Characters
  // -------------------------
  function requireLogin(){
    if(!user) { json(res, 401, { ok:false, error:"Login required" }); return false; }
    return true;
  }

  function getCharIndex(charId){
    return state.characters.findIndex(c => c.id === charId);
  }

  function canEditCharacter(charObj){
    if(dm) return true;
    if(!user) return false;
    return user.role === "player" && charObj.ownerUserId === user.id;
  }

  if(p === "/api/character/new" && req.method==="POST"){
    if(!requireLogin()) return;
    const body = JSON.parse(await readBody(req) || "{}");

    const name = String(body.name||"").trim().slice(0,40) || "Unnamed";
    const id = "c_" + Math.random().toString(36).slice(2,10);

    let ownerUserId = user.id;
    if(dm && body.ownerUserId !== undefined){
      ownerUserId = body.ownerUserId || null;
    }

    // Light sanitizers (everything is ultimately user editable via /character/save anyway)
    const clampArr = (v, max=200)=> Array.isArray(v) ? v.slice(0, max) : [];
    const str = (v, max=400)=> String(v??"").slice(0, max);

    const incomingSheet = (body.sheet && typeof body.sheet==="object") ? body.sheet : {};
    const vit = (incomingSheet.vitals && typeof incomingSheet.vitals==="object") ? incomingSheet.vitals : {};
    const mon = (incomingSheet.money  && typeof incomingSheet.money==="object") ? incomingSheet.money  : {};
    const sts = (incomingSheet.stats  && typeof incomingSheet.stats==="object") ? incomingSheet.stats  : {};

    const sheet = {
      vitals: {
        hpCur: str(vit.hpCur ?? vit.hpMax ?? ""),
        hpMax: str(vit.hpMax ?? ""),
        hpTemp: str(vit.hpTemp ?? ""),
        ac: str(vit.ac ?? ""),
        init: str(vit.init ?? ""),
        speed: str(vit.speed ?? "")
      },
      money: {
        cash: str(mon.cash ?? "", 40),
        bank: str(mon.bank ?? "", 40)
      },
      stats: {
        STR: str(sts.STR ?? "", 10),
        DEX: str(sts.DEX ?? "", 10),
        CON: str(sts.CON ?? "", 10),
        INT: str(sts.INT ?? "", 10),
        WIS: str(sts.WIS ?? "", 10),
        CHA: str(sts.CHA ?? "", 10)
      },
      conditions: clampArr(incomingSheet.conditions, 40).map(x=>str(x, 50)),
      background: str(incomingSheet.background ?? "", 200),
      traits: str(incomingSheet.traits ?? "", 2000),
      notes: str(incomingSheet.notes ?? "", 4000)
    };

    const c = {
      id,
      name,
      ownerUserId,
      setupComplete: (body.setupComplete === undefined) ? true : !!body.setupComplete,
      classId: body.classId || null,
      subclassId: body.subclassId || null,
      level: body.level ?? null,
      kits: clampArr(body.kits, 50).map(x=>str(x, 80)),
      weapons: clampArr(body.weapons, 50),
      inventory: clampArr(body.inventory, 400),
      abilities: clampArr(body.abilities, 200),
      spells: clampArr(body.spells, 300),
      sheet,
      updatedAt: Date.now(),
      version: 1
    };

    state.characters.push(c);
    saveState(state);
    return json(res, 200, { ok:true, id, character: c });
  }

if(p === "/api/character/save" && req.method==="POST"){
    if(!requireLogin()) return;
    const body = JSON.parse(await readBody(req) || "{}");
    const charId = String(body.charId||"");
    const i = getCharIndex(charId);
    if(i<0) return json(res, 404, { ok:false, error:"Not found" });
    const existing = state.characters[i];
    if(!canEditCharacter(existing)) return json(res, 403, { ok:false, error:"Forbidden" });

    const incoming = body.character || {};
    // Preserve owner unless DM sets it
    incoming.ownerUserId = dm ? (incoming.ownerUserId ?? existing.ownerUserId ?? null) : (existing.ownerUserId ?? user.id);
    incoming.id = existing.id;

    incoming.version = Number(existing.version||1) + 1;
    incoming.updatedAt = Date.now();
    state.characters[i] = incoming;
    // Keep all initiative surfaces joined.
    try{ syncCharacterInitiativeAndActiveParty(incoming, state.activeParty); }catch(e){}

    saveState(state);
    return json(res, 200, { ok:true, version: incoming.version, updatedAt: incoming.updatedAt });
  }

  // PATCH-like endpoint used by autosave
  if(p === "/api/character/patch" && req.method==="POST"){
    if(!requireLogin()) return;
    const body = JSON.parse(await readBody(req) || "{}");
    const charId = String(body.charId||"");
    const patch = body.patch || {};
    const i = getCharIndex(charId);
    if(i<0) return json(res, 404, { ok:false, error:"Not found" });
    const existing = state.characters[i];
    if(!canEditCharacter(existing)) return json(res, 403, { ok:false, error:"Forbidden" });

    // merge
    const merged = structuredClone(existing);
    deepMerge(merged, patch);

    merged.id = existing.id;
    merged.ownerUserId = dm ? (merged.ownerUserId ?? existing.ownerUserId ?? null) : (existing.ownerUserId ?? user.id);
    merged.version = Number(existing.version||1) + 1;
    merged.updatedAt = Date.now();

    state.characters[i] = merged;
    // Keep all initiative surfaces joined.
    try{ syncCharacterInitiativeAndActiveParty(merged, state.activeParty); }catch(e){}

    saveState(state);
    return json(res, 200, { ok:true, version: merged.version, updatedAt: merged.updatedAt, character: merged });
  }

  if(p === "/api/character/duplicate" && req.method==="POST"){
    if(!dm) return json(res, 403, { ok:false, error:"DM only" });
    const body = JSON.parse(await readBody(req) || "{}");
    const charId = String(body.charId||"");
    const name = String(body.name||"").trim().slice(0,40) || "Copy";
    const i = getCharIndex(charId);
    if(i<0) return json(res, 404, { ok:false, error:"Not found" });
    const base = state.characters[i];
    const id = "c_" + Math.random().toString(36).slice(2,10);
    const c = structuredClone(base);
    c.id = id;
    c.name = name;
    c.version = 1;
    c.updatedAt = Date.now();
    state.characters.push(c);
    saveState(state);
    return json(res, 200, { ok:true, id });
  }

  if(p === "/api/character/delete" && req.method==="POST"){
  if(!requireLogin()) return;
  const body = JSON.parse(await readBody(req) || "{}");
  const charId = String(body.charId||"");
  const i = getCharIndex(charId);
  if(i<0) return json(res, 404, { ok:false, error:"Not found" });

  const c = state.characters[i];

  // DM can delete anything. Players can delete only their own character.
  const canDelete = dm || (user && user.role === "player" && c.ownerUserId === user.id);
  if(!canDelete) return json(res, 403, { ok:false, error:"Not allowed" });

  state.characters.splice(i,1);
  // remove from active party if present
  state.activeParty = (state.activeParty||[]).filter(e => e.charId !== charId);

  // If the deleting player had this as active, clear it
  if(user && user.activeCharId === charId){
    user.activeCharId = null;
    saveUsers(users);
  }

  saveState(state);
  return json(res, 200, { ok:true });
}
// DM assign owner (import workflow)
  if(p === "/api/dm/character/assign" && req.method === "POST"){
    if(!dm) return json(res, 403, { ok:false, error:"DM only" });
    const body = JSON.parse(await readBody(req) || "{}");
    const charId = String(body.charId||"");
    const ownerUserId = body.ownerUserId || null;
    const i = getCharIndex(charId);
    if(i<0) return json(res, 404, { ok:false, error:"Not found" });
    const c = state.characters[i];
    c.ownerUserId = ownerUserId;
    c.version = Number(c.version||1) + 1;
    c.updatedAt = Date.now();
    saveState(state);
    return json(res, 200, { ok:true });
  }

  // -------------------------
  // DM Active Party
  // -------------------------
  if(p === "/api/dm/activeParty" && req.method === "GET"){
    if(!dm) return json(res, 403, { ok:false, error:"DM only" });
    return json(res, 200, { ok:true, activeParty: state.activeParty || [] });
  }

  if(p === "/api/dm/activeParty/add" && req.method === "POST"){
    if(!dm) return json(res, 403, { ok:false, error:"DM only" });
    const body = JSON.parse(await readBody(req) || "{}");
    const charId = String(body.charId||"");
    const c = state.characters.find(x=>x.id===charId);
    if(!c) return json(res, 404, { ok:false, error:"Character not found" });

    state.activeParty ||= [];
    if(state.activeParty.some(x=>x.charId===charId)){
      return json(res, 200, { ok:true }); // idempotent
    }
    // If initiative isn't supplied, default to the character sheet's Init (modifier).
    let initVal = normalizeInitiativeValue(body.initiative);
    try{
      if(initVal===""){
        initVal = normalizeInitiativeValue(c?.sheet?.vitals?.init);
      }
    }catch(e){}

    state.activeParty.push({
      charId,
      playerLabel: String(body.playerLabel||"").trim().slice(0,40) || "",
      initiative: initVal
    });
    saveState(state);
    return json(res, 200, { ok:true });
  }

  if(p === "/api/dm/activeParty/remove" && req.method === "POST"){
    if(!dm) return json(res, 403, { ok:false, error:"DM only" });
    const body = JSON.parse(await readBody(req) || "{}");
    const charId = String(body.charId||"");
    state.activeParty = (state.activeParty||[]).filter(x=>x.charId!==charId);
    saveState(state);
    return json(res, 200, { ok:true });
  }

  if(p === "/api/dm/activeParty/initiative" && req.method === "POST"){
    if(!dm) return json(res, 403, { ok:false, error:"DM only" });
    const body = JSON.parse(await readBody(req) || "{}");
    const charId = String(body.charId||"");
    const nextInit = normalizeInitiativeValue(body.initiative);
    const entry = (state.activeParty||[]).find(x=>x.charId===charId);
    if(!entry) return json(res, 404, { ok:false, error:"Not found" });
    entry.initiative = nextInit;

    // Keep the character sheet's Init in sync so all UI locations show the same value.
    try{
      const c = state.characters.find(x=>x.id===charId);
      if(c){
        c.sheet ||= {};
        c.sheet.vitals ||= { hpCur:"", hpMax:"", hpTemp:"", ac:"", init:"", speed:"" };
        c.sheet.vitals.init = nextInit;
        c.version = Number(c.version||1) + 1;
        c.updatedAt = Date.now();
      }
    }catch(e){}

    saveState(state);
    return json(res, 200, { ok:true });
  }

  // -------------------------
  // Existing features
  // -------------------------
  if(p === "/api/shops/save" && req.method==="POST"){
    if(!dm) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    state.shops = body.shops;
    saveState(state);
    return json(res, 200, {ok:true});
  }

  if(p === "/api/notify" && req.method==="POST"){
    const body = JSON.parse(await readBody(req) || "{}");
    state.notifications ||= { nextId: 1, items: [] };
    state.notifications.items ||= [];
    state.notifications.nextId ||= 1;
    const id = state.notifications.nextId++;
    state.notifications.items.push({
      id,
      type: String(body.type||"Request").slice(0,80),
      detail: String(body.detail||"").slice(0,4000),
      from: String(body.from||"").slice(0,80),
      audience: String(body.audience||"dm").toLowerCase() === "players" ? "players" : "dm",
      status: String(body.status||"open").slice(0,32) || "open",
      notes: String(body.notes||"").slice(0,4000),
      archived: !!body.archived,
      createdAt: Date.now()
    });
    saveState(state);
    return json(res, 200, {ok:true, id});
  }
  if(p === "/api/notifications/save" && req.method==="POST"){
    if(!dm) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    state.notifications = body.notifications;
    saveState(state);
    return json(res, 200, {ok:true});
  }
  if(p === "/api/notifications/delete" && req.method==="POST"){
    if(!dm) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    const id = Number(body.id||0);
    state.notifications ||= structuredClone(DEFAULT_STATE.notifications);
    state.notifications.items ||= [];
    const before = state.notifications.items.length;
    state.notifications.items = state.notifications.items.filter(n => Number(n.id||0) !== id);
    if(state.notifications.items.length === before) return json(res, 404, {ok:false, error:"Not found"});
    saveState(state);
    return json(res, 200, {ok:true});
  }
  if(p === "/api/settings/save" && req.method==="POST"){
    if(!dm) return json(res, 403, {ok:false, error:"DM only"});
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

  // Clues endpoints (unchanged)
  if(p === "/api/clues/delete" && req.method==="POST"){
    if(!dm) return json(res, 403, {ok:false, error:"DM only"});
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
    if(!dm) return json(res, 403, {ok:false, error:"DM only"});
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
    if(!dm) return json(res, 403, {ok:false, error:"DM only"});
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
    if(!dm) return json(res, 403, {ok:false, error:"DM only"});
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
    if(!dm) return json(res, 403, {ok:false, error:"DM only"});
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
    if(!dm) return json(res, 403, {ok:false, error:"DM only"});
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
    if(!dm) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    state.clues = body.clues;
    saveState(state);
    return json(res, 200, {ok:true});
  }

  return text(res, 404, "Not found");
});

(async ()=>{
  try{ await initDb(); } catch(_){}
  state = await loadState();
  users = await loadUsers();
  server.listen(PORT, ()=>console.log("Veilwatch OS listening on", PORT));
})();
