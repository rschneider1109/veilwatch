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

let __vwES = null;
let __vwStreamLastMsg = 0;
let __vwStreamBackoff = 1000;
  if(typeof vwStartFallbackPoller==="function") vwStartFallbackPoller();

function vwStartStream(){
  if(!SESSION || !SESSION.role) return;
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
    try{ __vwES.close(); }catch(e){}
    __vwES = null;
    const wait = Math.min(__vwStreamBackoff, 15000);
    __vwStreamBackoff = Math.min(__vwStreamBackoff * 2, 15000);
    setTimeout(()=>{ vwStartStream(); }, wait);
  };
}

var __vwPollTimer = null;
function vwStartFallbackPoller(){
  try{ if(typeof __vwPollTimer === 'undefined') __vwPollTimer = null; }catch(e){}

  if(__vwPollTimer) return;
  __vwPollTimer = setInterval(async ()=>{
    try{
      if(!SESSION || !SESSION.role) return;
      // If SSE is healthy, do nothing.
      const now = Date.now();
      const slack = document.hidden ? 60000 : 15000;
      if(__vwES && (now - __vwStreamLastMsg) < slack) return;

      const st = await api("/api/state");
      window.__STATE = st;
      if(typeof vwComputeUnseen==="function") vwComputeUnseen();
      if(typeof renderIntelPlayer==="function") renderIntelPlayer();
      if(typeof renderIntelDM==="function") renderIntelDM();
    }catch(e){}
  }, 5000);
}

// Watchdog: if we haven't heard anything for a while, restart the stream.
setInterval(()=>{
  if(!SESSION || !SESSION.role) return;
  const now = Date.now();
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
});

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
  const sheetHost = document.getElementById("sheetHost") || document.getElementById("sheet") || document.getElementById("sheetPanel");
  if(!sheetHost) return;
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
  const recap=document.getElementById("intelRecap");
  const reqBody=document.getElementById("playerReqBody");
  if(!intelBody || !recap || !reqBody) return;
  

// Session Recaps (player) — DM-written only (no auto event feed)
recap.innerHTML =
  '<div class="row"><div class="pill">Session Recaps</div><div class="mini">DM-written summaries only.</div></div>' +
  '<p class="muted">No recaps yet.</p>';

if(!recap.dataset.vwInit){
    recap.innerHTML = '<p class="muted">Session recaps will appear here (DM-written). Clue reveals won\'t spam this panel.</p>';
    recap.dataset.vwInit = "1";
  }

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
    if(typeof vwStartFallbackPoller==="function") vwStartFallbackPoller();
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
    const res = await api("/api/settings/save",{method:"POST",body:JSON.stringify({dmKey:nk})});
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
