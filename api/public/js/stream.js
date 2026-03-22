let __vwES = null;
let __vwStreamLastMsg = 0;
let __vwStreamBackoff = 1000;
let __vwPollTimer = null;
let __vwSyncInFlight = null;
let __vwSyncQueued = false;
let __vwLastStateSig = "";

function vwStateSignature(st){
  try{
    return JSON.stringify(st || {});
  }catch(e){
    return String(Date.now());
  }
}

function vwGetActiveTopTab(){
  return document.querySelector(".nav .btn.active")?.dataset?.tab || "home";
}

function vwRenderRealtimeViews(forceAll){
  try{
    if(typeof vwComputeUnseen === "function") vwComputeUnseen();
  }catch(e){}

  // Always refresh shared character-linked surfaces.
  try{
    if(typeof renderDMActiveParty === "function") renderDMActiveParty();
  }catch(e){}
  try{
    if(typeof vwUpdateCharSummaryRow === "function") vwUpdateCharSummaryRow();
  }catch(e){}

  const activeTab = vwGetActiveTopTab();
  const renderTab = forceAll ? "all" : activeTab;

  try{
    if(renderTab === "all" || renderTab === "home"){
      if(typeof renderDM === "function") renderDM();
    }
  }catch(e){}

  try{
    if(renderTab === "all" || renderTab === "character"){
      if(typeof renderCharacter === "function") renderCharacter();
      if(typeof renderSheet === "function") renderSheet();
    }
  }catch(e){}

  try{
    if(renderTab === "all" || renderTab === "intel"){
      if(typeof renderIntelDM === "function") renderIntelDM();
      if(typeof renderDMRecaps === "function") renderDMRecaps();
      if(typeof renderIntelPlayer === "function") renderIntelPlayer();
    }
  }catch(e){}

  try{
    if(renderTab === "all" || renderTab === "shop"){
      if(typeof renderShop === "function") renderShop();
    }
  }catch(e){}

  try{
    if(renderTab === "all" || renderTab === "settings"){
      if(typeof renderSettings === "function") renderSettings();
    }
  }catch(e){}
}

async function vwSyncRealtimeState(reason = "poll", forceRender = false){
  if(!SESSION || !SESSION.role) return;

  if(__vwSyncInFlight){
    __vwSyncQueued = true;
    return __vwSyncInFlight;
  }

  __vwSyncInFlight = (async ()=>{
    try{
      const st = await api("/api/state?_ts=" + Date.now());
      if(!st || st.ok === false) return;

      window.__STATE = st;
      const sig = vwStateSignature(st);
      const changed = forceRender || sig !== __vwLastStateSig;
      __vwLastStateSig = sig;

      if(changed){
        try{ if(window.VW_ALERTS?.armed) vwComputeUnseen(st, { silent:false }); }catch(e){}
        vwRenderRealtimeViews(forceRender);
      }
    }catch(e){
      // swallow, poller/watchdog will retry
    }finally{
      __vwSyncInFlight = null;
      if(__vwSyncQueued){
        __vwSyncQueued = false;
        vwSyncRealtimeState("queued", false);
      }
    }
  })();

  return __vwSyncInFlight;
}

function vwStartStream(){
  if(!SESSION || !SESSION.role) return;

  try{
    if(__vwES){
      __vwES.close();
      __vwES = null;
    }
  }catch(e){}

  const qs = (SESSION.role === "dm" && SESSION.dmKey) ? ("?k=" + encodeURIComponent(SESSION.dmKey)) : "";

  try{
    __vwES = new EventSource("/api/stream" + qs);
  }catch(e){
    __vwES = null;
    return;
  }

  __vwStreamLastMsg = Date.now();
  __vwStreamBackoff = 1000;

  __vwES.addEventListener("hello", ()=>{
    __vwStreamLastMsg = Date.now();
    vwSyncRealtimeState("hello", true);
  });

  __vwES.addEventListener("update", ()=>{
    __vwStreamLastMsg = Date.now();
    vwSyncRealtimeState("update", false);
  });

  __vwES.onerror = ()=>{
    try{
      if(__vwES) __vwES.close();
    }catch(e){}
    __vwES = null;

    const wait = Math.min(__vwStreamBackoff, 15000);
    __vwStreamBackoff = Math.min(__vwStreamBackoff * 2, 15000);
    setTimeout(()=>{
      if(SESSION && SESSION.role) vwStartStream();
    }, wait);
  };
}

function vwStartFallbackPoller(){
  if(__vwPollTimer) return;

  __vwPollTimer = setInterval(async ()=>{
    try{
      if(!SESSION || !SESSION.role) return;

      const now = Date.now();
      const slack = document.hidden ? 60000 : 15000;
      const streamHealthy = !!(__vwES && (now - __vwStreamLastMsg) < slack);

      if(streamHealthy) return;
      await vwSyncRealtimeState("poll", false);
    }catch(e){}
  }, 2000);
}

setInterval(()=>{
  if(!SESSION || !SESSION.role) return;

  const now = Date.now();
  const slack = document.hidden ? 60000 : 20000;

  if(__vwES && (now - __vwStreamLastMsg) > slack){
    try{
      __vwES.close();
    }catch(e){}
    __vwES = null;
    vwStartStream();
    return;
  }

  if(!__vwES){
    vwStartStream();
  }
}, 5000);

document.addEventListener("visibilitychange", ()=>{
  if(!document.hidden && SESSION && SESSION.role){
    vwStartStream();
    vwSyncRealtimeState("visible", true);
  }
});

window.addEventListener("online", ()=>{
  if(SESSION && SESSION.role){
    vwStartStream();
    vwSyncRealtimeState("online", true);
  }
});

window.vwStartStream = vwStartStream;
window.vwStartFallbackPoller = vwStartFallbackPoller;
window.vwSyncRealtimeState = vwSyncRealtimeState;
