
// Veilwatch OS (MariaDB version with readable passwords + temp passwords)

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const crypto = require("crypto");
const mysql = require("mysql2/promise");

// structuredClone polyfill
if(typeof globalThis.structuredClone !== "function"){
  globalThis.structuredClone = (obj)=>JSON.parse(JSON.stringify(obj));
}

const DM_KEY = process.env.VEILWATCH_DM_KEY || "VEILWATCHDM";

const DB_HOST = process.env.MYSQL_HOST || "";
const DB_PORT = parseInt(process.env.MYSQL_PORT || "3306", 10);
const DB_NAME = process.env.MYSQL_DATABASE || "veilwatch";
const DB_USER = process.env.MYSQL_USER || "veilwatch";
const DB_PASSWORD = process.env.MYSQL_PASSWORD || "veilwatch_pw";

let pool = null;

// -----------------------------
// MariaDB initialization
// -----------------------------
async function initDb(){
  if(!DB_HOST) return;

  pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 10
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vw_state (
      id VARCHAR(64) PRIMARY KEY,
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
}


// -----------------------------
// DB helpers
// -----------------------------
async function dbGetState(){
  if(!pool) return null;

  const [rows] = await pool.query(
    "SELECT state_json FROM vw_state WHERE id = ? LIMIT 1",
    ["main"]
  );

  if(!rows?.[0]?.state_json) return null;
  return JSON.parse(rows[0].state_json);
}

async function dbSaveState(st){
  if(!pool) return;

  await pool.query(
    `INSERT INTO vw_state (id, state_json)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       state_json = VALUES(state_json),
       updated_at = CURRENT_TIMESTAMP`,
    ["main", JSON.stringify(st)]
  );
}

async function dbLoadUsers(){
  if(!pool) return null;

  const [rows] = await pool.query(`
    SELECT id, username, password, role, temp_password, must_change_password, active_char_id, created_at
    FROM vw_users
    ORDER BY created_at ASC
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
        `INSERT INTO vw_users
        (id, username, password, role, temp_password, must_change_password, active_char_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          u.id,
          u.username,
          u.password,
          u.role,
          u.tempPassword,
          u.mustChangePassword ? 1 : 0,
          u.activeCharId,
          u.createdAt
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


// -----------------------------
// Helpers
// -----------------------------
function makeId(prefix="u"){
  return prefix + "_" + crypto.randomBytes(6).toString("hex");
}

function normUsername(u){
  return String(u||"").trim().toLowerCase().replace(/\s+/g,"_").slice(0,32);
}


// -----------------------------
// User store
// -----------------------------
let users = [];

async function loadUsers(){
  const dbUsers = await dbLoadUsers();
  if(dbUsers) users = dbUsers;
}

function saveUsers(){
  dbSaveUsers(users).catch(()=>{});
}

function findUserByUsername(username){
  const u = normUsername(username);
  return users.find(x=>x.username === u) || null;
}


// -----------------------------
// HTTP helpers
// -----------------------------
function json(res, code, obj){
  res.writeHead(code, {"Content-Type":"application/json"});
  res.end(JSON.stringify(obj));
}

function readBody(req){
  return new Promise(resolve=>{
    let d="";
    req.on("data",c=>d+=c);
    req.on("end",()=>resolve(d));
  });
}


// -----------------------------
// Server
// -----------------------------
const PORT = parseInt(process.env.PORT || "8080",10);

const server = http.createServer(async (req,res)=>{

  const parsed = url.parse(req.url,true);
  const p = parsed.pathname || "/";

  // Register
  if(p === "/api/auth/register" && req.method==="POST"){

    const body = JSON.parse(await readBody(req)||"{}");
    const username = normUsername(body.username);
    const password = String(body.password||"");

    if(findUserByUsername(username)){
      return json(res,200,{ok:false,error:"User exists"});
    }

    const role = users.length===0 ? "dm":"player";

    const u = {
      id: makeId(),
      username,
      password,
      role,
      tempPassword:null,
      mustChangePassword:false,
      activeCharId:null,
      createdAt: Date.now()
    };

    users.push(u);
    saveUsers();

    return json(res,200,{ok:true,user:u});
  }


  // Login
  if(p === "/api/auth/login" && req.method==="POST"){

    const body = JSON.parse(await readBody(req)||"{}");
    const username = normUsername(body.username);
    const password = String(body.password||"");

    const u = findUserByUsername(username);

    if(!u){
      return json(res,200,{ok:false,error:"Invalid login"});
    }

    const mainMatch = password === u.password;
    const tempMatch = u.tempPassword && password === u.tempPassword;

    if(!mainMatch && !tempMatch){
      return json(res,200,{ok:false,error:"Invalid login"});
    }

    return json(res,200,{
      ok:true,
      user:u,
      mustChangePassword: !!u.mustChangePassword || tempMatch
    });
  }


  res.writeHead(404);
  res.end("Not found");

});


(async ()=>{
  await initDb();
  await loadUsers();
  server.listen(PORT, ()=>console.log("Veilwatch OS listening on",PORT));
})();
