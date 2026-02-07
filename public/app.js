const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = parseInt(process.env.PORT || "8080", 10);
const DATA_DIR = "/app/data";
const STATE_PATH = path.join(DATA_DIR, "state.json");

function ensureDir(p){ try{ fs.mkdirSync(p,{recursive:true}); } catch(e){} }

const DEFAULT_STATE = {
  settings: { dmKey: "VEILWATCHDM", theme: { accent: "#00e5ff" } },
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
  characters: [] // no example character
};

function loadState(){
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
    st.shops ||= DEFAULT_STATE.shops;
    st.notifications ||= DEFAULT_STATE.notifications;
    st.clues ||= DEFAULT_STATE.clues;
    saveState(st);
    return st;
  } catch(e){
    // if corrupted, back it up and reset
    try{ fs.copyFileSync(STATE_PATH, STATE_PATH + ".corrupt.bak"); } catch(_){}
    fs.writeFileSync(STATE_PATH, JSON.stringify(DEFAULT_STATE, null, 2), "utf8");
    return structuredClone(DEFAULT_STATE);
  }
}
function saveState(st){
  ensureDir(DATA_DIR);
  fs.writeFileSync(STATE_PATH, JSON.stringify(st, null, 2), "utf8");
}

let state = loadState();

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
          <thead><tr><th>CATEGORY</th><th>EQUIPMENT NAME</th><th>WEIGHT</th><th>QTY</th><th>COST ($)</th><th>NOTES</th></tr></thead>
          <tbody id="invBody"></tbody>
        </table>
        <button class="btn smallbtn" id="addInvBtn" style="margin-top:10px;">Add Inventory Item</button>
      </div>
    </div>
  </section>

  <section id="tab-intel" class="hidden">
    <div class="panel">
      <div class="row">
        <div class="pill">DM Tools</div>
        <div class="mini">Notifications + Archived Clues appear when logged in as DM.</div>
      </div>
      <hr/>
      <div id="dmPanels" class="hidden">
        <div class="row" style="margin-bottom:10px;">
          <button class="btn active" data-itab="notifications">Notifications</button>
          <button class="btn" data-itab="archived">Archived Clues</button>
        </div>
        <div id="itab-notifications">
          <table>
            <thead><tr><th>ID</th><th>TYPE</th><th>DETAIL</th><th>FROM</th><th>STATUS</th><th></th></tr></thead>
            <tbody id="notifBody"></tbody>
          </table>
          <button class="btn smallbtn" id="clearResolvedBtn" style="margin-top:10px;">Clear Resolved</button>
        </div>
        <div id="itab-archived" class="hidden">
          <table>
            <thead><tr><th>CLUE</th><th>NOTES</th><th></th></tr></thead>
            <tbody id="archBody"></tbody>
          </table>
        </div>
      </div>
      <div id="playerIntel">
        <div class="mini">Player Intel panel coming next (clues, recap, etc.)</div>
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
</main>

<div class="toast" id="toast"></div>

<script>
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
}
function api(path, opts={}){
  opts.headers ||= {};
  opts.headers["Content-Type"]="application/json";
  if(SESSION.role==="dm" && SESSION.dmKey) opts.headers["X-DM-Key"]=SESSION.dmKey;
  return fetch(path, opts).then(r=>r.json());
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
  ["home","character","intel","shop"].forEach(t=>{
    document.getElementById("tab-"+t).classList.toggle("hidden", t!==tab);
  });
}
document.querySelectorAll(".nav .btn").forEach(b=>b.onclick=()=>renderTabs(b.dataset.tab));
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>renderTabs(b.dataset.go));

document.querySelectorAll("[data-ctab]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("[data-ctab]").forEach(x=>x.classList.toggle("active", x===b));
  document.getElementById("ctab-actions").classList.toggle("hidden", b.dataset.ctab!=="actions");
  document.getElementById("ctab-inventory").classList.toggle("hidden", b.dataset.ctab!=="inventory");
});

document.querySelectorAll("[data-itab]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("[data-itab]").forEach(x=>x.classList.toggle("active", x===b));
  document.getElementById("itab-notifications").classList.toggle("hidden", b.dataset.itab!=="notifications");
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
  };
  document.getElementById("loginPlayerBtn").onclick=async ()=>{
    const name=document.getElementById("whoName").value.trim()||"Player";
    SESSION.role="player"; SESSION.name=name;
    document.getElementById("whoPill").textContent="Player: "+name;
    document.getElementById("loginOverlay").style.display="none";
    setRoleUI();
    await refreshAll();
  };
}
loginInit();

async function refreshAll(){
  const st = await api("/api/state");
  window.__STATE = st;
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
  renderCharacter();
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
    invBody.innerHTML = '<tr><td colspan="6" class="mini">No character.</td></tr>';
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
      '<td><input class="input" value="'+esc(it.notes||"")+'" data-k="notes"/></td>';
    tr.querySelectorAll("input").forEach(inp=>{
      inp.onchange=async ()=>{
        const k=inp.dataset.k;
        c.inventory[idx][k]=inp.value;
        await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
        document.getElementById("saveMini").textContent="Saved";
      };
    });
    invBody.appendChild(tr);
  });
}

document.getElementById("addInvBtn").onclick=async ()=>{
  const c=getChar(); if(!c){ toast("Create character first"); return; }
  c.inventory ||= [];
  c.inventory.push({category:"",name:"",weight:"",qty:"1",cost:"",notes:""});
  await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
  toast("Added inventory row"); await refreshAll();
};

document.getElementById("newCharBtn").onclick=async ()=>{
  const name=prompt("Character name?");
  if(!name) return;
  const res = await api("/api/character/new",{method:"POST",body:JSON.stringify({name})});
  if(res.ok){ SESSION.activeCharId=res.id; toast("Character created"); await refreshAll(); }
};

function renderShop(){
  const st=window.__STATE||{};
  const shops=st.shops||{};
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
    const n=prompt("Shop name?");
    if(!n) return;
    const id=("s_"+Math.random().toString(36).slice(2,8));
    shops.list ||= [];
    shops.list.push({id,name:n,items:[]});
    shops.activeShopId=id;
    await api("/api/shops/save",{method:"POST",body:JSON.stringify({shops})});
    toast("Shop created"); await refreshAll();
  };
  document.getElementById("editShopBtn").onclick = async ()=>{
    if(SESSION.role!=="dm") return;
    const curr=(shops.list||[]).find(s=>s.id===shops.activeShopId);
    if(!curr) return;
    const n=prompt("Rename shop:", curr.name);
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
      editBtn.onclick=async ()=>{
        const name=prompt("Item name:", it.name)||it.name;
        const category=prompt("Category:", it.category||"")||it.category||"";
        const cost=prompt("Cost:", it.cost||"")||it.cost||"";
        const weight=prompt("Weight:", it.weight||"")||it.weight||"";
        const notes=prompt("Notes:", it.notes||"")||it.notes||"";
        const stock=prompt("Stock (∞ or number):", it.stock||"∞")||it.stock||"∞";
        Object.assign(it,{name,category,cost,weight,notes,stock});
        await api("/api/shops/save",{method:"POST",body:JSON.stringify({shops})});
        toast("Item saved"); await refreshAll();
      };
      delBtn.onclick=async ()=>{
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
    tr.querySelector("#addShopItemBtn").onclick=async ()=>{
      const name=prompt("Item name?");
      if(!name) return;
      const category=prompt("Category (Ammo/Gear/Medical/etc):","Gear")||"Gear";
      const cost=prompt("Cost:", "0")||"0";
      const weight=prompt("Weight:", "1")||"1";
      const notes=prompt("Notes:", "")||"";
      const stock=prompt("Stock (∞ or number):","∞")||"∞";
      shop.items ||= [];
      shop.items.push({id:"i_"+Math.random().toString(36).slice(2,8), name, category, cost, weight, notes, stock});
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
    tr.innerHTML = '<td>'+n.id+'</td><td>'+esc(n.type)+'</td><td>'+esc(n.detail)+'</td><td>'+esc(n.from)+'</td><td>'+esc(n.status)+'</td><td></td>';
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
    tr.innerHTML = '<td>'+esc(c.title||"Clue")+'</td><td>'+esc(c.notes||"")+'</td><td><button class="btn smallbtn">Restore</button></td>';
    tr.querySelector("button").onclick=async ()=>{
      st.clues.archived.splice(idx,1);
      await api("/api/clues/save",{method:"POST",body:JSON.stringify({clues: st.clues})});
      toast("Restored (removed from archive)"); await refreshAll();
    };
    ab.appendChild(tr);
  });
}

// initial refresh will occur after login
</script>
</body>
</html>`;

const server = http.createServer(async (req,res)=>{
  const parsed = url.parse(req.url, true);
  const p = parsed.pathname || "/";
  if(p === "/" || p === "/index.html"){
    return text(res, 200, INDEX_HTML, "text/html; charset=utf-8");
  }

  // API
  if(p === "/api/state" && req.method==="GET"){
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
    state.notifications.items.push({ id, type: body.type||"Request", detail: body.detail||"", from: body.from||"", status:"open" });
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

  if(p === "/api/clues/save" && req.method==="POST"){
    if(!isDM(req)) return json(res, 403, {ok:false, error:"DM only"});
    const body = JSON.parse(await readBody(req) || "{}");
    state.clues = body.clues;
    saveState(state);
    return json(res, 200, {ok:true});
  }

  return text(res, 404, "Not found");
});

server.listen(PORT, ()=>console.log("Veilwatch OS listening on", PORT));