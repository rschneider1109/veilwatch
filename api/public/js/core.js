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
// --- Intel indicator safety stubs (prevents runtime errors if blocks move during patching) ---
if(typeof window.VW_INTEL_UNSEEN === "undefined"){
  window.VW_INTEL_UNSEEN = { count: 0, seenIds: new Set(), armed: false };
}
if(typeof window.vwGetRevealedClueIds !== "function"){
  window.vwGetRevealedClueIds = ()=>{
    const st = window.__STATE || {};
    const items = (st.clues?.items || []);
    return items
      .filter(c=>String(c.visibility||"hidden")==="revealed")
      .map(c=>Number(c.id||0))
      .filter(Boolean);
  };
}
if(typeof window.vwUpdateIntelIndicator !== "function"){
  window.vwUpdateIntelIndicator = ()=>{};
}
if(typeof window.vwSyncSeenBaseline !== "function"){
  window.vwSyncSeenBaseline = ()=>{
    window.VW_INTEL_UNSEEN.seenIds = new Set(window.vwGetRevealedClueIds());
    window.VW_INTEL_UNSEEN.count = 0;
    window.vwUpdateIntelIndicator();
  };
}
if(typeof window.vwComputeUnseen !== "function"){
  window.vwComputeUnseen = ()=>{};
}
if(typeof window.vwAcknowledgeIntel !== "function"){
  window.vwAcknowledgeIntel = ()=>{ window.vwSyncSeenBaseline(); };
}
// --- end stubs ---

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
    if(typeof vwAcknowledgeIntel==='function') vwAcknowledgeIntel();
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
  const dmKeyInput=document.getElementById("dmKey");
  const dmBtn=document.getElementById("loginBtn");
  const playerBtn=document.getElementById("loginPlayerBtn");

  function applyRoleUI(){
    const isDM = roleSel && roleSel.value==="dm";
    if(dmRow) dmRow.classList.toggle("hidden", !isDM);
    // If the old "player button row" doesn't exist in this build, don't crash.
    if(playerRow) playerRow.classList.toggle("hidden", isDM);
    // Make the primary button work either way (prevents "can't login" even if UI doesn't toggle perfectly)
    if(dmBtn) dmBtn.textContent = isDM ? "Login" : "Continue";
    if(dmKeyInput) dmKeyInput.disabled = !isDM;
    if(dmKeyInput && !isDM) dmKeyInput.value = "";
  }
  if(roleSel) roleSel.onchange=applyRoleUI;
  applyRoleUI();

  async function finishLogin(role, name, dmKey){
    SESSION.role=role;
    SESSION.name=name;
    SESSION.dmKey=dmKey||"";
    document.getElementById("whoPill").textContent = (role==="dm" ? "DM: " : "Player: ") + name;
    document.getElementById("loginOverlay").style.display="none";
    setRoleUI();
    await refreshAll();
    if(typeof vwStartStream==="function" && SESSION && SESSION.role) vwStartStream();
    if(typeof vwStartFallbackPoller==="function") vwStartFallbackPoller();
  }

  // Primary button: DM login if role=dm, otherwise Player login.
  if(dmBtn){
    dmBtn.onclick=async ()=>{
      const role = (roleSel && roleSel.value) || "player";
      const name=(document.getElementById("whoName").value.trim() || (role==="dm" ? "DM" : "Player"));
      if(role==="dm"){
        const key=document.getElementById("dmKey").value.trim();
        const res = await api("/api/dm/login",{method:"POST",body:JSON.stringify({name, key})});
        if(!res.ok){ toast(res.error||"Denied"); return; }
        await finishLogin("dm", name, key);
      } else {
        await finishLogin("player", name, "");
      }
    };
  }

  // If a separate player button exists, wire it too (optional).
  if(playerBtn){
    playerBtn.onclick=async ()=>{
      const name=document.getElementById("whoName").value.trim()||"Player";
      await finishLogin("player", name, "");
    };
  }
}
loginInit();

async function refreshAll(){
  const st = await api("/api/state");
  window.__STATE = st;
  // intel indicator baseline
  if(window.VW_INTEL_UNSEEN && !window.VW_INTEL_UNSEEN.armed){ vwSyncSeenBaseline(); window.VW_INTEL_UNSEEN.armed = true; }
  else { if(typeof vwComputeUnseen==='function') vwComputeUnseen(); }
  if(typeof vwStartStream==="function" && SESSION && SESSION.role) vwStartStream();
    if(typeof vwStartFallbackPoller==="function") vwStartFallbackPoller();
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

