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
