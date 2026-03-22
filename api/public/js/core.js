// core.js — shared utilities, auth bootstrap, tab switching, and refreshAll()

// ---- Modal helpers ----
// Keep page from scrolling behind the modal (especially important now that the modal body scrolls).
let __vwPrevBodyOverflow = null;
function vwSetModalOpen(isOpen){
  if(isOpen){
    if(__vwPrevBodyOverflow === null) __vwPrevBodyOverflow = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";
    return;
  }
  if(__vwPrevBodyOverflow !== null){
    document.body.style.overflow = __vwPrevBodyOverflow;
    __vwPrevBodyOverflow = null;
  }
}

function vwModalBaseSetup(title, okText, cancelText){
  const modal = document.getElementById("vwModal");
  const mTitle = document.getElementById("vwModalTitle");
  const mBody  = document.getElementById("vwModalBody");
  const btnOk  = document.getElementById("vwModalOk");
  const btnCan = document.getElementById("vwModalCancel");

  // Clear any leftover wizard Back button from previous modal usage
  try{ document.getElementById("vwModalBack")?.remove(); }catch(e){}

  mTitle.textContent = title || "Modal";
  btnOk.textContent = okText || "OK";
  btnCan.textContent = cancelText || "Cancel";

  // When reusing the modal, always start at the top.
  try{ mBody.scrollTop = 0; }catch(e){}

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
      vwSetModalOpen(false);
      resolve(val);
    }

    ui.btnOk.onclick = ()=>close(input.value);
    ui.btnCan.onclick = ()=>close(null);
    ui.modal.onclick = (e)=>{ if(e.target === ui.modal) close(null); };

    vwSetModalOpen(true);
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
      vwSetModalOpen(false);
      resolve(val);
    }

    ui.btnOk.onclick = ()=>close(true);
    ui.btnCan.onclick = ()=>close(false);
    ui.modal.onclick = (e)=>{ if(e.target === ui.modal) close(false); };

    vwSetModalOpen(true);
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
      if(type === "static"){
        return (
          '<div style="margin-bottom:10px">' +
            '<div class="mini" style="margin-bottom:6px;opacity:.9">'+label+'</div>' +
            '<div class="input" data-key="'+key+'" style="width:100%;opacity:.95;pointer-events:none">'+value+'</div>' +
          '</div>'
        );
      }
      if(type === "select"){
        const raw = Array.isArray(f.options) ? f.options : [];
        const selected = String(f.value ?? "");

        function normOne(o){
          if(typeof o === "string") return { value:o, label:o };
          return { value: String(o.value ?? o.label ?? ""), label: String(o.label ?? o.value ?? "") };
        }

        const flat = [];
        const groups = [];

        raw.forEach(o=>{
          if(o && typeof o === "object" && !Array.isArray(o) && ("group" in o) && Array.isArray(o.options)){
            const gLabel = String(o.group ?? "");
            const gOpts = (o.options||[]).map(normOne);
            groups.push({ label:gLabel, opts:gOpts });
          }else{
            flat.push(normOne(o));
          }
        });

        let firstValue = null;
        const flatHtml = flat.map((o,i)=>{
          if(firstValue===null) firstValue = o.value;
          const v = String(o.value).replace(/"/g,"&quot;");
          const lab = String(o.label);
          const sel = (selected && selected===o.value) ? " selected" : (!selected && i===0 ? " selected" : "");
          return `<option value="${v}"${sel}>${lab}</option>`;
        }).join("");

        const groupsHtml = groups.map(g=>{
          const inner = g.opts.map((o,i)=>{
            const v = String(o.value).replace(/"/g,"&quot;");
            const lab = String(o.label);
            const sel = (selected && selected===o.value) ? " selected" : (!selected && !flat.length && firstValue===null && i===0 ? " selected" : "");
            return `<option value="${v}"${sel}>${lab}</option>`;
          }).join("");
          const glab = String(g.label).replace(/"/g,"&quot;");
          return `<optgroup label="${glab}">${inner}</optgroup>`;
        }).join("");

        const optionsHtml = flatHtml + groupsHtml;

        return (
          '<div style="margin-bottom:10px">' +
            '<div class="mini" style="margin-bottom:6px;opacity:.9">'+label+'</div>' +
            '<select class="input" data-key="'+key+'" style="width:100%">' +
              optionsHtml +
            '</select>' +
          '</div>'
        );
      }
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
      vwSetModalOpen(false);
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

    vwSetModalOpen(true);
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

// ---- Intel / alert attention state ----
window.VW_ALERTS = window.VW_ALERTS || {
  armed:false,
  audioUnlocked:false,
  audioCtx:null,
  seenPlayerClueIds:[],
  seenDmNotifIds:[],
  unseenIntelIds:[]
};

function vwGetIntelButton(){
  return document.querySelector('.nav .btn[data-tab="intel"]');
}

function vwGetAlertItemsFromState(st){
  const state = st || window.__STATE || {};
  if(SESSION.role === "dm"){
    return (state.notifications?.items || []).filter(n=>String(n.status||"open") === "open").map(n=>({ id:'n:'+n.id, label:n.type||'Notification' }));
  }
  const clueItems = Array.isArray(state.clues) ? state.clues : (state.clues?.items || state.clues?.active || []);
  return clueItems.filter(c=>String(c.visibility||"hidden")==="revealed").map(c=>({ id:'c:'+c.id, label:c.title||'Clue' }));
}

function vwUpdateIntelBadge(){
  const badge = document.getElementById('intelUnreadBadge');
  const btn = vwGetIntelButton();
  const count = (window.VW_ALERTS?.unseenIntelIds || []).length;
  if(badge){
    badge.textContent = String(count);
    badge.classList.toggle('hidden', !count);
  }
  if(btn) btn.classList.toggle('intel-tab-attn', !!count);
}

function vwFlashIntelAlert(){
  const flash = document.getElementById('vwAlertFlash');
  if(!flash) return;
  flash.classList.remove('vw-alert-flash');
  void flash.offsetWidth;
  flash.classList.add('vw-alert-flash');
}

function vwUnlockAlertAudio(){
  try{
    if(window.VW_ALERTS.audioUnlocked) return true;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return false;
    const ctx = window.VW_ALERTS.audioCtx || new Ctx();
    window.VW_ALERTS.audioCtx = ctx;
    if(ctx.state === 'suspended' && typeof ctx.resume === 'function') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 660;
    gain.gain.value = 0.0001;
    osc.connect(gain); gain.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    osc.stop(now + 0.01);
    window.VW_ALERTS.audioUnlocked = true;
    return true;
  }catch(e){
    return false;
  }
}

function vwPlayIntelAlert(){
  try{
    const ctx = window.VW_ALERTS.audioCtx;
    if(!window.VW_ALERTS.audioUnlocked || !ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(740, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }catch(e){}
}

function vwMaybeSystemNotify(newItems){
  if(!newItems || !newItems.length || document.visibilityState === 'visible') return;
  try{
    if('Notification' in window && Notification.permission === 'granted'){
      const title = SESSION.role === 'dm' ? 'Veilwatch notification' : 'Veilwatch intel';
      const body = newItems.length === 1 ? (newItems[0].label || 'New alert') : (newItems.length + ' new alerts');
      new Notification(title, { body });
    }
  }catch(e){}
}

function vwRunIntelAlertEffects(newItems){
  if(!newItems || !newItems.length) return;
  vwFlashIntelAlert();
  vwPlayIntelAlert();
  try{ if('vibrate' in navigator) navigator.vibrate([180, 90, 180]); }catch(e){}
  vwMaybeSystemNotify(newItems);
}

function vwSyncSeenBaseline(st){
  const items = vwGetAlertItemsFromState(st);
  const ids = items.map(x=>x.id);
  if(SESSION.role === 'dm') window.VW_ALERTS.seenDmNotifIds = ids.slice();
  else window.VW_ALERTS.seenPlayerClueIds = ids.slice();
  window.VW_ALERTS.unseenIntelIds = [];
  vwUpdateIntelBadge();
}

function vwComputeUnseen(st, opts){
  const options = opts || {};
  const items = vwGetAlertItemsFromState(st);
  const ids = items.map(x=>x.id);
  const prev = SESSION.role === 'dm' ? (window.VW_ALERTS.seenDmNotifIds || []) : (window.VW_ALERTS.seenPlayerClueIds || []);
  const unseen = (window.VW_ALERTS.unseenIntelIds || []).filter(id=>ids.includes(id));
  const newItems = items.filter(x=>!prev.includes(x.id) && !unseen.includes(x.id));
  if(newItems.length){
    window.VW_ALERTS.unseenIntelIds = unseen.concat(newItems.map(x=>x.id));
    if(!options.silent) vwRunIntelAlertEffects(newItems);
  }else{
    window.VW_ALERTS.unseenIntelIds = unseen;
  }
  if(SESSION.role === 'dm') window.VW_ALERTS.seenDmNotifIds = ids.slice();
  else window.VW_ALERTS.seenPlayerClueIds = ids.slice();
  if(vwGetActiveTopTab && vwGetActiveTopTab() === 'intel') window.VW_ALERTS.unseenIntelIds = [];
  vwUpdateIntelBadge();
}

function vwAcknowledgeIntel(){
  window.VW_ALERTS.unseenIntelIds = [];
  vwUpdateIntelBadge();
}

window.vwSyncSeenBaseline = vwSyncSeenBaseline;
window.vwComputeUnseen = vwComputeUnseen;
window.vwAcknowledgeIntel = vwAcknowledgeIntel;
window.vwUnlockAlertAudio = vwUnlockAlertAudio;

// ---- API helper ----
async function api(pathname, opts){
  opts ||= {};
  opts.method ||= "GET";
  opts.headers ||= {};
  opts.headers["Content-Type"] ||= "application/json";
  if((opts.method || "GET").toUpperCase() === "GET"){
    opts.cache = "no-store";
  }
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
  const delCharBtn = document.getElementById("deleteCharBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if(dmPanels) dmPanels.classList.toggle("hidden", SESSION.role !== "dm");
  if(playerIntel) playerIntel.classList.toggle("hidden", SESSION.role === "dm");
  if(dmShopRow) dmShopRow.classList.toggle("hidden", SESSION.role !== "dm");
  if(editShopBtn) editShopBtn.classList.toggle("hidden", SESSION.role !== "dm");
  if(settingsTabBtn) settingsTabBtn.classList.toggle("hidden", SESSION.role !== "dm");
  if(tabSettings) tabSettings.classList.toggle("hidden", SESSION.role !== "dm");
  if(imp) imp.classList.toggle("hidden", SESSION.role !== "dm");
  if(delCharBtn) delCharBtn.classList.toggle("hidden", SESSION.role !== "dm");
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
async function renderTabs(tab){
  const currentTab = document.querySelector(".nav .btn.active")?.dataset?.tab || "home";

  // Flush pending character-sheet autosaves before leaving the Character tab.
  if(currentTab === "character" && tab !== "character"){
    try{
      if(typeof vwFlushCharAutosave === "function") await vwFlushCharAutosave();
    }catch(e){}
  }

  const tabs = ["home","character","intel","shop","settings"];
  tabs.forEach(t=>{
    const el = document.getElementById("tab-"+t);
    if(el) el.classList.toggle("hidden", t !== tab);
  });
  document.querySelectorAll(".nav .btn").forEach(b=>b.classList.toggle("active", b.dataset.tab === tab));

  // Refresh character-linked views after a tab switch so the persistent pills/cards
  // redraw from the most recent local/server state.
  try{
    if(typeof renderDMActiveParty === "function") renderDMActiveParty();
    if(typeof vwUpdateCharSummaryRow === "function") vwUpdateCharSummaryRow();
  }catch(e){}

  // Render the newly active tab immediately from the latest in-memory state.
  try{
    if(tab === "home"){
      if(typeof renderDM === "function") renderDM();
      if(typeof renderDMActiveParty === "function") renderDMActiveParty();
    } else if(tab === "character"){
      if(typeof renderCharacter === "function") renderCharacter();
      if(typeof renderSheet === "function") renderSheet();
    } else if(tab === "intel"){
      if(typeof vwAcknowledgeIntel === "function") vwAcknowledgeIntel();
      if(typeof renderIntelDM === "function") renderIntelDM();
      if(typeof renderIntelPlayer === "function") renderIntelPlayer();
      if(typeof renderDM === "function") renderDM();
    } else if(tab === "shop"){
      if(typeof renderShop === "function") renderShop();
    } else if(tab === "settings"){
      if(typeof renderSettings === "function") renderSettings();
    }
  }catch(e){}
}
window.renderTabs = renderTabs;

// nav + goto
document.querySelectorAll(".nav .btn").forEach(b=>b.onclick=()=>{ void renderTabs(b.dataset.tab); });
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{ void renderTabs(b.dataset.go); });

// character sub-tabs (supports create-mode bar + sheet-mode bar)
document.querySelectorAll("[data-ctab]").forEach(b=>b.onclick=()=>{
  const bar = b.closest("#createCtabBar,#sheetCtabBar") || document;
  bar.querySelectorAll("[data-ctab]").forEach(x=>x.classList.toggle("active", x===b));

  const a  = document.getElementById("ctab-actions");
  const i  = document.getElementById("ctab-inventory");
  const ab = document.getElementById("ctab-abilities");
  const sp = document.getElementById("ctab-spells");
  const s  = document.getElementById("ctab-sheet");
  const bg = document.getElementById("ctab-background");
  const tr = document.getElementById("ctab-traits");
  const nt = document.getElementById("ctab-notes");

  if(a)  a.classList.toggle("hidden", b.dataset.ctab !== "actions");
  if(i)  i.classList.toggle("hidden", b.dataset.ctab !== "inventory");
  if(ab) ab.classList.toggle("hidden", b.dataset.ctab !== "abilities");
  if(sp) sp.classList.toggle("hidden", b.dataset.ctab !== "spells");
  if(s)  s.classList.toggle("hidden", b.dataset.ctab !== "sheet");
  if(bg) bg.classList.toggle("hidden", b.dataset.ctab !== "background");
  if(tr) tr.classList.toggle("hidden", b.dataset.ctab !== "traits");
  if(nt) nt.classList.toggle("hidden", b.dataset.ctab !== "notes");
  const sf = document.getElementById("sheetOnlyFooter");
  if(sf) sf.classList.toggle("hidden", b.dataset.ctab !== "sheet");
  try{ window.SESSION = window.SESSION || {}; SESSION.activeCtab = b.dataset.ctab; }catch(e){}
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

  const authForm = document.getElementById("authForm");

  async function primeAlertsFromUserAction(){
    try{ vwUnlockAlertAudio(); }catch(e){}
    try{ if("Notification" in window && Notification.permission === "default") Notification.requestPermission(); }catch(e){}
  }

  if(loginBtn) loginBtn.onclick = async ()=>{ await primeAlertsFromUserAction(); await doAuth("/api/auth/login"); };
  if(regBtn) regBtn.onclick = async ()=>{ await primeAlertsFromUserAction(); await doAuth("/api/auth/register"); };
  if(authForm) authForm.addEventListener("submit", async (e)=>{ e.preventDefault(); await primeAlertsFromUserAction(); await doAuth("/api/auth/login"); });

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

  // intel / alert baseline
  if(!window.VW_ALERTS.armed){
    try{ vwSyncSeenBaseline(st); window.VW_ALERTS.armed = true; }catch(e){}
  }else{
    try{ vwComputeUnseen(st, { silent:false }); }catch(e){}
  }

  // Start stream/poller if available
  if(typeof vwStartStream === "function") vwStartStream();
  if(typeof vwStartFallbackPoller === "function") vwStartFallbackPoller();

  // characters dropdown
  const sel = document.getElementById("charSel");
  if(sel){
    sel.innerHTML = "";
    (st.characters || []).forEach(c=>{
      const o = document.createElement("option");
      o.value = c.id; o.textContent = c.name;
      sel.appendChild(o);
    });
    if(!SESSION.activeCharId && (st.characters || []).length) SESSION.activeCharId = st.characters[0].id;
    if(SESSION.activeCharId) sel.value = SESSION.activeCharId;
    sel.onchange = ()=>{
      SESSION.activeCharId = sel.value;
      if(typeof renderCharacter === "function") renderCharacter();
      if(typeof renderSheet === "function") renderSheet();
    };
  }

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