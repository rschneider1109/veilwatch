// core.js — shared utilities, auth bootstrap, tab switching, and refreshAll()

// ---- Modal helpers ----
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
      resolve(val);
    }

    ui.btnOk.onclick = ()=>close(input.value);
    ui.btnCan.onclick = ()=>close(null);
    ui.modal.onclick = (e)=>{ if(e.target === ui.modal) close(null); };

    ui.modal.style.display = "flex";
    setTimeout(()=>input.focus(), 30);
  });
}

function vwModalConfirm(opts){
  opts ||= {};
  const title = opts.title || "Confirm";
  const message = opts.message || "Are you sure?";
  const okText = opts.okText || "Confirm";
  const cancelText = opts.cancelText || "Cancel";

  return new Promise((resolve)=>{
    const ui = vwModalBaseSetup(title, okText, cancelText);
    ui.mBody.innerHTML = '<div style="opacity:.95;line-height:1.4">'+message+"</div>";

    function close(val){
      ui.modal.style.display = "none";
      ui.btnOk.onclick = null;
      ui.btnCan.onclick = null;
      ui.modal.onclick = null;
      resolve(val);
    }

    ui.btnOk.onclick = ()=>close(true);
    ui.btnCan.onclick = ()=>close(false);
    ui.modal.onclick = (e)=>{ if(e.target === ui.modal) close(false); };

    ui.modal.style.display = "flex";
  });
}

function vwModalForm(opts){
  opts ||= {};
  const title = opts.title || "Form";
  const fields = Array.isArray(opts.fields) ? opts.fields : [];
  const okText = opts.okText || "Save";
  const cancelText = opts.cancelText || "Cancel";

  return new Promise((resolve)=>{
    const ui = vwModalBaseSetup(title, okText, cancelText);

    ui.mBody.innerHTML = fields.map(f=>{
      const key = f.key;
      const label = f.label || key;
      const placeholder = String(f.placeholder || "").replace(/"/g, "&quot;");
      const value = String(f.value ?? "");
      const type = f.type || "text";
      if(type === "textarea"){
        return (
          '<div style="margin-bottom:10px">' +
            '<div class="mini" style="margin-bottom:6px;opacity:.9">'+label+'</div>' +
            '<textarea data-key="'+key+'" placeholder="'+placeholder+'" ' +
              'style="width:100%;min-height:110px;padding:10px;border-radius:12px;border:1px solid #2b3a4d;' +
              'background:rgba(255,255,255,.03);color:#e9f1ff;outline:none;resize:vertical;">' +
              value.replace(/</g,"&lt;") +
            '</textarea>' +
          '</div>'
        );
      }
      return (
        '<div style="margin-bottom:10px">' +
          '<div class="mini" style="margin-bottom:6px;opacity:.9">'+label+'</div>' +
          '<input class="input" data-key="'+key+'" value="'+value.replace(/"/g,"&quot;")+'" placeholder="'+placeholder+'"/>' +
        '</div>'
      );
    }).join("");

    function close(val){
      ui.modal.style.display = "none";
      ui.btnOk.onclick = null;
      ui.btnCan.onclick = null;
      ui.modal.onclick = null;
      resolve(val);
    }

    ui.btnOk.onclick = ()=>{
      const out = {};
      ui.mBody.querySelectorAll("[data-key]").forEach(el=>{
        out[el.dataset.key] = el.value;
      });
      close(out);
    };
    ui.btnCan.onclick = ()=>close(null);
    ui.modal.onclick = (e)=>{ if(e.target === ui.modal) close(null); };

    ui.modal.style.display = "flex";
  });
}

window.vwModalInput = vwModalInput;
window.vwModalConfirm = vwModalConfirm;
window.vwModalForm = vwModalForm;

// ---- small utilities ----
function esc(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}
window.esc = esc;

function toast(msg){
  const t = document.getElementById("toast");
  if(!t) return;
  t.textContent = String(msg||"");
  t.classList.add("show");
  clearTimeout(toast.__t);
  toast.__t = setTimeout(()=>t.classList.remove("show"), 2200);
}
window.toast = toast;

// ---- global session + state ----
window.__STATE = window.__STATE || {};
window.SESSION = window.SESSION || { role:null, username:null, userId:null, dmKey:null, activeCharId:null, sessionStart:Date.now() };
const SESSION = window.SESSION;

// ---- Character visibility helpers (player-first) ----
window.__VW_DM_USERS = window.__VW_DM_USERS || { map:null, at:0 };

async function vwGetDMUserMap(){
  if(SESSION.role !== "dm") return null;
  const now = Date.now();
  if(window.__VW_DM_USERS.map && (now - window.__VW_DM_USERS.at) < 60000){
    return window.__VW_DM_USERS.map;
  }
  try{
    const res = await api("/api/dm/users");
    if(res && res.ok && Array.isArray(res.users)){
      const m = {};
      res.users.forEach(u=>{ m[String(u.id)] = u.username || ("User "+u.id); });
      window.__VW_DM_USERS = { map:m, at:now };
      return m;
    }
  }catch(e){}
  return window.__VW_DM_USERS.map;
}

function vwVisibleCharacters(st){
  const all = Array.isArray(st.characters) ? st.characters : [];
  if(SESSION.role === "dm") return all;
  // Player: only show owned characters.
  return all.filter(c => String(c.ownerUserId||"") === String(SESSION.userId||""));
}

async function vwHydrateCharacterSelect(st){
  const sel = document.getElementById("charSel");
  if(!sel) return;

  const vis = vwVisibleCharacters(st);
  const activeWas = SESSION.activeCharId;

  // If current selection isn't visible anymore, fall back.
  if(activeWas && !vis.some(c=>String(c.id)===String(activeWas))){
    SESSION.activeCharId = vis.length ? vis[0].id : null;
  }
  if(!SESSION.activeCharId && vis.length) SESSION.activeCharId = vis[0].id;

  sel.innerHTML = "";

  if(SESSION.role === "dm"){
    const userMap = await vwGetDMUserMap() || {};
    const byOwner = {};
    const unassigned = [];
    vis.forEach(c=>{
      const oid = c.ownerUserId ? String(c.ownerUserId) : "";
      if(!oid) unassigned.push(c);
      else (byOwner[oid] ||= []).push(c);
    });

    const ownerIds = Object.keys(byOwner).sort((a,b)=>{
      const an = (userMap[a]||"").toLowerCase();
      const bn = (userMap[b]||"").toLowerCase();
      return an.localeCompare(bn);
    });

    ownerIds.forEach(oid=>{
      const g = document.createElement("optgroup");
      g.label = userMap[oid] || ("User " + oid);
      (byOwner[oid]||[]).slice().sort((a,b)=>(a.name||"").localeCompare(b.name||"")).forEach(c=>{
        const o = document.createElement("option");
        o.value = c.id; o.textContent = c.name || ("Character " + c.id);
        g.appendChild(o);
      });
      sel.appendChild(g);
    });

    if(unassigned.length){
      const g = document.createElement("optgroup");
      g.label = "Unassigned";
      unassigned.slice().sort((a,b)=>(a.name||"").localeCompare(b.name||"")).forEach(c=>{
        const o = document.createElement("option");
        o.value = c.id; o.textContent = c.name || ("Character " + c.id);
        g.appendChild(o);
      });
      sel.appendChild(g);
    }
  }else{
    vis.slice().sort((a,b)=>(a.name||"").localeCompare(b.name||"")).forEach(c=>{
      const o = document.createElement("option");
      o.value = c.id; o.textContent = c.name || ("Character " + c.id);
      sel.appendChild(o);
    });
  }

  if(SESSION.activeCharId) sel.value = SESSION.activeCharId;

  sel.onchange = ()=>{
    SESSION.activeCharId = sel.value || null;
    if(typeof renderCharacter === "function") renderCharacter();
    if(typeof renderSheet === "function") renderSheet();
  };
}
window.vwHydrateCharacterSelect = vwHydrateCharacterSelect;


// ---- Intel indicator safety stubs (prevents runtime errors if blocks move) ----
if(typeof window.vwSyncSeenBaseline !== "function") window.vwSyncSeenBaseline = ()=>{};
if(typeof window.vwComputeUnseen !== "function") window.vwComputeUnseen = ()=>{};
if(typeof window.vwAcknowledgeIntel !== "function") window.vwAcknowledgeIntel = ()=>{};

// ---- API helper ----
async function api(pathname, opts){
  opts ||= {};
  opts.method ||= "GET";
  opts.headers ||= {};
  opts.headers["Content-Type"] ||= "application/json";
  // DM header (server also supports cookie sessions; header is optional)
  if(SESSION.role === "dm" && SESSION.dmKey) opts.headers["X-DM-Key"] = SESSION.dmKey;

  const res = await fetch(pathname, opts);
  let data = null;
  const ct = (res.headers.get("content-type")||"").toLowerCase();
  try{
    data = ct.includes("application/json") ? await res.json() : await res.text();
  }catch(e){
    data = null;
  }
  if(typeof data === "object" && data !== null){
    return data;
  }
  // normalize non-json responses
  return { ok: res.ok, status: res.status, text: data };
}
window.api = api;

// ---- UI role toggles ----
function setRoleUI(){
  const dmPanels = document.getElementById("dmPanels");
  const playerIntel = document.getElementById("playerIntel");
  const dmShopRow = document.getElementById("dmShopRow");
  const editShopBtn = document.getElementById("editShopBtn");
  const settingsTabBtn = document.getElementById("settingsTabBtn");
  const tabSettings = document.getElementById("tab-settings");
  const imp = document.getElementById("importPlayerBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if(dmPanels) dmPanels.classList.toggle("hidden", SESSION.role !== "dm");
  if(playerIntel) playerIntel.classList.toggle("hidden", SESSION.role === "dm");
  if(dmShopRow) dmShopRow.classList.toggle("hidden", SESSION.role !== "dm");
  if(editShopBtn) editShopBtn.classList.toggle("hidden", SESSION.role !== "dm");
  if(settingsTabBtn) settingsTabBtn.classList.toggle("hidden", SESSION.role !== "dm");
  if(tabSettings) tabSettings.classList.toggle("hidden", SESSION.role !== "dm");
  if(imp) imp.classList.toggle("hidden", SESSION.role !== "dm");
  if(logoutBtn) logoutBtn.classList.toggle("hidden", !SESSION.role);

  // Who pill
  const who = document.getElementById("whoPill");
  if(who){
    if(!SESSION.role) who.textContent = "Not logged in";
    else who.textContent = (SESSION.role === "dm" ? "DM: " : "Player: ") + (SESSION.username || "");
  }
}
window.setRoleUI = setRoleUI;

// ---- Tabs ----
function renderTabs(tab){
  const tabs = ["home","character","intel","shop","settings"];
  tabs.forEach(t=>{
    const el = document.getElementById("tab-"+t);
    if(el) el.classList.toggle("hidden", t !== tab);
  });
  document.querySelectorAll(".nav .btn").forEach(b=>b.classList.toggle("active", b.dataset.tab === tab));

  // When switching to Intel, render immediately + acknowledge
  if(tab === "intel"){
    if(typeof vwAcknowledgeIntel === "function") vwAcknowledgeIntel();
    setTimeout(()=>{
      if(typeof renderIntelDM === "function") renderIntelDM();
      if(typeof renderIntelPlayer === "function") renderIntelPlayer();
    }, 0);
  }
}
window.renderTabs = renderTabs;

// nav + goto
document.querySelectorAll(".nav .btn").forEach(b=>b.onclick=()=>renderTabs(b.dataset.tab));
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>renderTabs(b.dataset.go));

// character sub-tabs
document.querySelectorAll("[data-ctab]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("[data-ctab]").forEach(x=>x.classList.toggle("active", x===b));
  const a = document.getElementById("ctab-actions");
  const i = document.getElementById("ctab-inventory");
  const s = document.getElementById("ctab-sheet");
  if(a) a.classList.toggle("hidden", b.dataset.ctab !== "actions");
  if(i) i.classList.toggle("hidden", b.dataset.ctab !== "inventory");
  if(s) s.classList.toggle("hidden", b.dataset.ctab !== "sheet");
});

// intel sub-tabs (DM)
document.querySelectorAll("[data-itab]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("[data-itab]").forEach(x=>x.classList.toggle("active", x===b));
  const n = document.getElementById("itab-notifications");
  const c = document.getElementById("itab-clues");
  const a = document.getElementById("itab-archived");
  if(n) n.classList.toggle("hidden", b.dataset.itab !== "notifications");
  if(c) c.classList.toggle("hidden", b.dataset.itab !== "clues");
  if(a) a.classList.toggle("hidden", b.dataset.itab !== "archived");
});

// ---- Auth bootstrap ----
function authInit(){
  const overlay = document.getElementById("loginOverlay");
  const userEl  = document.getElementById("authUser");
  const passEl  = document.getElementById("authPass");
  const loginBtn= document.getElementById("loginBtn");
  const regBtn  = document.getElementById("registerBtn");
  const hint    = document.getElementById("authHint");
  const logoutBtn = document.getElementById("logoutBtn");

  async function hydrateSession(){
    try{
      const me = await api("/api/auth/me", { method:"GET", headers:{} });
      if(me && me.loggedIn && me.user){
        SESSION.role = me.user.role;
        SESSION.username = me.user.username;
        SESSION.userId = me.user.id;
        SESSION.activeCharId = me.user.activeCharId || SESSION.activeCharId || null;

        if(overlay) overlay.style.display = "none";
        setRoleUI();

        await refreshAll();
        if(typeof vwStartStream === "function") vwStartStream();
        if(typeof vwStartFallbackPoller === "function") vwStartFallbackPoller();
        return true;
      }
    }catch(e){}
    return false;
  }

  async function doAuth(path){
    const username = (userEl && userEl.value ? userEl.value : "").trim();
    const password = (passEl && passEl.value ? passEl.value : "");
    if(!username || !password){
      toast("Enter username + password");
      return;
    }
    const res = await api(path, { method:"POST", body: JSON.stringify({ username, password }) });
    if(!res || !res.ok){
      toast((res && res.error) ? res.error : "Denied");
      return;
    }
    await hydrateSession();
  }

  if(loginBtn) loginBtn.onclick = ()=>doAuth("/api/auth/login");
  if(regBtn) regBtn.onclick = ()=>doAuth("/api/auth/register");

  if(logoutBtn) logoutBtn.onclick = async ()=>{
    try{ await api("/api/auth/logout", { method:"POST", body: JSON.stringify({}) }); }catch(e){}
    SESSION.role = null; SESSION.username = null; SESSION.userId = null; SESSION.activeCharId = null;
    if(overlay) overlay.style.display = "flex";
    setRoleUI();
  };

  // Enter triggers login
  if(passEl){
    passEl.addEventListener("keydown",(e)=>{
      if(e.key === "Enter") doAuth("/api/auth/login");
    });
  }

  hydrateSession().then((ok)=>{
    if(!ok){
      if(overlay) overlay.style.display = "flex";
      if(hint) hint.textContent = "Login or create an account. First account becomes DM automatically.";
      setRoleUI();
    }
  });
}

// ---- State refresh ----
async function refreshAll(){
  if(!SESSION || !SESSION.role) return;

  const st = await api("/api/state");
  window.__STATE = st || {};

  // intel indicator baseline
  if(window.VW_INTEL_UNSEEN && !window.VW_INTEL_UNSEEN.armed){
    try{ vwSyncSeenBaseline(); window.VW_INTEL_UNSEEN.armed = true; }catch(e){}
  }else{
    try{ vwComputeUnseen(); }catch(e){}
  }

  // Start stream/poller if available
  if(typeof vwStartStream === "function") vwStartStream();
  if(typeof vwStartFallbackPoller === "function") vwStartFallbackPoller();

  // characters (player-first): DM sees grouped; players see only theirs
  try{ await vwHydrateCharacterSelect(st); }catch(e){}

  const mini = document.getElementById("activeCharMini");
  const mini = document.getElementById("activeCharMini");
  if(mini){
    const nm = SESSION.activeCharId ? (st.characters || []).find(c=>c.id===SESSION.activeCharId)?.name : null;
    mini.textContent = nm || "None selected";
  }

  // feature renders
  if(typeof renderShop === "function") renderShop();
  if(typeof renderDM === "function") renderDM();
  if(typeof renderDMActiveParty === "function") renderDMActiveParty();
  if(typeof renderIntelDM === "function") renderIntelDM();
  if(typeof renderIntelPlayer === "function") renderIntelPlayer();
  if(typeof renderCharacter === "function") renderCharacter();
  if(typeof renderSheet === "function") renderSheet();
  if(typeof renderSettings === "function") renderSettings();
}
window.refreshAll = refreshAll;

// Kick things off
authInit();
