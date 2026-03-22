// notifications.js — DM notifications UI + client-side attention/alerts

window.VW_ALERTS = window.VW_ALERTS || {
  enabled: false,
  permission: "default",
  unseenCount: 0,
  lastTitle: document.title,
  initialized: false,
  prev: { dmOpenIds: [], revealedIds: [] },
  seenRevealedIds: [],
  audioContext: null
};
window.VW_INTEL_UNSEEN = window.VW_INTEL_UNSEEN || { armed: false };

(function initAlertPrefs(){
  try{
    const saved = JSON.parse(localStorage.getItem("vw_alert_prefs") || "{}");
    window.VW_ALERTS.enabled = !!saved.enabled;
  }catch(e){}
  try{
    if(typeof Notification !== "undefined") window.VW_ALERTS.permission = Notification.permission || "default";
  }catch(e){}
})();

function vwPersistAlertPrefs(){
  try{
    localStorage.setItem("vw_alert_prefs", JSON.stringify({ enabled: !!window.VW_ALERTS.enabled }));
  }catch(e){}
}

function vwUpdateAlertToggleUi(){
  const btn = document.getElementById("alertToggleBtn");
  if(!btn) return;
  const enabled = !!window.VW_ALERTS.enabled;
  btn.textContent = enabled ? "Alerts On" : "Enable Alerts";
  btn.classList.toggle("vw-alerts-live", enabled);
  btn.classList.toggle("vw-alerts-hot", !!window.VW_ALERTS.unseenCount);
  const perm = window.VW_ALERTS.permission || "default";
  let label = enabled ? "Sound, flash, and device alerts armed." : "Click once to arm sound/device alerts.";
  if(enabled && perm === "denied") label = "Sound/flash armed. Browser notifications are blocked by this browser setting.";
  btn.title = label;
}

async function vwEnsureAudio(){
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return false;
    window.VW_ALERTS.audioContext ||= new Ctx();
    if(window.VW_ALERTS.audioContext.state === "suspended"){
      await window.VW_ALERTS.audioContext.resume();
    }
    return window.VW_ALERTS.audioContext.state === "running";
  }catch(e){
    return false;
  }
}

async function vwEnableAlerts(){
  window.VW_ALERTS.enabled = true;
  await vwEnsureAudio();
  try{
    if(typeof Notification !== "undefined"){
      if(Notification.permission === "default") {
        window.VW_ALERTS.permission = await Notification.requestPermission();
      } else {
        window.VW_ALERTS.permission = Notification.permission;
      }
    }
  }catch(e){}
  vwPersistAlertPrefs();
  vwUpdateAlertToggleUi();
  toast("Alerts enabled");
}
window.vwEnableAlerts = vwEnableAlerts;

function vwFlashViewport(){
  document.body.classList.remove("vw-alert-flash");
  void document.body.offsetWidth;
  document.body.classList.add("vw-alert-flash");
  clearTimeout(vwFlashViewport.__t);
  vwFlashViewport.__t = setTimeout(()=>document.body.classList.remove("vw-alert-flash"), 1550);
}

function vwPlayAlertTone(kind){
  if(!window.VW_ALERTS.enabled || !window.VW_ALERTS.audioContext) return;
  const ctx = window.VW_ALERTS.audioContext;
  try{
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind === "urgent" ? "square" : "sine";
    osc.frequency.setValueAtTime(kind === "urgent" ? 960 : 720, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "urgent" ? 0.28 : 0.18));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (kind === "urgent" ? 0.3 : 0.2));
  }catch(e){}
}

function vwSendBrowserAlert(title, body){
  if(!window.VW_ALERTS.enabled) return;
  try{
    if(typeof Notification === "undefined") return;
    if(Notification.permission !== "granted") return;
    new Notification(title || "Veilwatch Alert", { body: body || "New intel received." });
  }catch(e){}
}

function vwVibrate(pattern){
  if(!window.VW_ALERTS.enabled) return;
  try{
    if("vibrate" in navigator) navigator.vibrate(pattern || [120, 70, 120]);
  }catch(e){}
}

function vwSetIntelAttention(count){
  const badge = document.getElementById("intelNavBadge");
  const btn = document.getElementById("intelTabBtn");
  const safeCount = Math.max(0, Number(count || 0));
  window.VW_ALERTS.unseenCount = safeCount;

  if(badge){
    badge.textContent = safeCount > 99 ? "99+" : String(safeCount || 0);
    badge.classList.toggle("hidden", safeCount <= 0);
  }
  if(btn) btn.classList.toggle("nav-has-alert", safeCount > 0);

  const base = window.VW_ALERTS.lastTitle || "Veilwatch OS";
  document.title = safeCount > 0 ? "[" + safeCount + "] " + base : base;
  vwUpdateAlertToggleUi();
}

function vwGetAlertSnapshot(st){
  st ||= window.__STATE || {};
  const notifications = (st.notifications?.items || []);
  const dmOpenIds = notifications
    .filter(n=>String(n.status||"open") !== "resolved")
    .map(n=>String(n.id))
    .sort();
  const revealedIds = (st.clues?.items || [])
    .filter(c=>String(c.visibility||"hidden") === "revealed")
    .map(c=>String(c.id))
    .sort();
  return { dmOpenIds, revealedIds };
}

function vwSyncSeenBaseline(){
  const snap = vwGetAlertSnapshot(window.__STATE || {});
  window.VW_ALERTS.prev = snap;
  window.VW_ALERTS.initialized = true;
  const isIntelOpen = (document.querySelector('.nav .btn.active')?.dataset?.tab || "home") === "intel";
  if(isIntelOpen){
    window.VW_ALERTS.seenRevealedIds = snap.revealedIds.slice();
  }
  const count = SESSION.role === "dm"
    ? snap.dmOpenIds.length
    : (isIntelOpen ? 0 : snap.revealedIds.filter(id=>!(window.VW_ALERTS.seenRevealedIds||[]).includes(id)).length);
  vwSetIntelAttention(count);
}
window.vwSyncSeenBaseline = vwSyncSeenBaseline;

function vwAcknowledgeIntel(){
  const st = window.__STATE || {};
  const snap = vwGetAlertSnapshot(st);
  window.VW_ALERTS.prev.revealedIds = snap.revealedIds.slice();
  window.VW_ALERTS.seenRevealedIds = snap.revealedIds.slice();
  vwSetIntelAttention(SESSION.role === "dm" ? snap.dmOpenIds.length : 0);
}
window.vwAcknowledgeIntel = vwAcknowledgeIntel;

function vwComputeUnseen(){
  const st = window.__STATE || {};
  const snap = vwGetAlertSnapshot(st);

  if(!window.VW_ALERTS.initialized){
    window.VW_ALERTS.prev = snap;
    window.VW_ALERTS.initialized = true;
    vwSetIntelAttention(0);
    return;
  }

  const prevReveal = new Set(window.VW_ALERTS.prev.revealedIds || []);
  const prevDmOpen = new Set(window.VW_ALERTS.prev.dmOpenIds || []);

  const newRevealed = snap.revealedIds.filter(id=>!prevReveal.has(id));
  const newDmOpen = snap.dmOpenIds.filter(id=>!prevDmOpen.has(id));

  const intelTabOpen = (document.querySelector('.nav .btn.active')?.dataset?.tab || "home") === "intel";
  if(intelTabOpen && SESSION.role !== "dm"){
    window.VW_ALERTS.seenRevealedIds = snap.revealedIds.slice();
  }

  const seenRevealed = new Set(window.VW_ALERTS.seenRevealedIds || []);
  const unseenPlayerIntel = intelTabOpen && SESSION.role !== "dm"
    ? 0
    : snap.revealedIds.filter(id=>!seenRevealed.has(id)).length;
  const badgeCount = SESSION.role === "dm" ? snap.dmOpenIds.length : unseenPlayerIntel;
  vwSetIntelAttention(badgeCount);

  const shouldPingPlayer = SESSION.role !== "dm" && newRevealed.length > 0;
  const shouldPingDm = SESSION.role === "dm" && newDmOpen.length > 0;

  if(shouldPingPlayer || shouldPingDm){
    const kind = (shouldPingDm ? "urgent" : "intel");
    const body = shouldPingDm
      ? (newDmOpen.length + " new player notification" + (newDmOpen.length === 1 ? "" : "s"))
      : (newRevealed.length + " new clue" + (newRevealed.length === 1 ? "" : "s") + " revealed");

    vwFlashViewport();
    vwPlayAlertTone(kind);
    if(document.hidden){
      vwSendBrowserAlert("Veilwatch Alert", body);
      vwVibrate(kind === "urgent" ? [180,80,180,80,180] : [120,70,120]);
    }
  }

  window.VW_ALERTS.prev = snap;
}
window.vwComputeUnseen = vwComputeUnseen;

function initAlertUiOnce(){
  if(initAlertUiOnce.__done) return;
  initAlertUiOnce.__done = true;

  const btn = document.getElementById("alertToggleBtn");
  if(btn){
    btn.addEventListener("click", async ()=>{
      if(!window.VW_ALERTS.enabled){
        await vwEnableAlerts();
      }else{
        await vwEnsureAudio();
        toast("Alerts already enabled");
        vwUpdateAlertToggleUi();
      }
    });
  }

  ["pointerdown","keydown","touchstart"].forEach(evt=>{
    window.addEventListener(evt, ()=>{ if(window.VW_ALERTS.enabled) vwEnsureAudio(); }, { passive:true, once:false });
  });

  document.addEventListener("visibilitychange", ()=>{
    if(!document.hidden){
      if((document.querySelector('.nav .btn.active')?.dataset?.tab || "home") === "intel") vwAcknowledgeIntel();
      vwUpdateAlertToggleUi();
    }
  });

  if(window.VW_ALERTS.enabled){
    vwEnsureAudio();
  }
  vwUpdateAlertToggleUi();
}
initAlertUiOnce();

function renderDM(){
  if(SESSION.role!=="dm") return;
  const st=window.__STATE||{};
  const nb=document.getElementById("notifBody");
  if(!nb) return;
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
  const clearBtn = document.getElementById("clearResolvedBtn");
  if(clearBtn) clearBtn.onclick=async ()=>{
    st.notifications.items = (st.notifications.items||[]).filter(x=>x.status!=="resolved");
    await api("/api/notifications/save",{method:"POST",body:JSON.stringify({notifications: st.notifications})});
    toast("Cleared"); await refreshAll();
  };

  const ab=document.getElementById("archBody");
  if(!ab) return;
  ab.innerHTML="";
  (st.clues?.archived||[]).forEach((c)=>{
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
    }
    ab.appendChild(tr);
  });
}
window.renderDM = renderDM;

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

window.initAlertUiOnce = initAlertUiOnce;
