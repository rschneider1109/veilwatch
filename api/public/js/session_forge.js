// session_forge.js — Links the official Session Clock record to the Recap system.
// Front-end only: uses existing /api/session-clock/* and /api/recaps/* endpoints.

function vwSessionLogs(){
  const box = window.__STATE?.sessionClockLog || { items:[] };
  return Array.isArray(box) ? box : (Array.isArray(box.items) ? box.items : []);
}
window.vwSessionLogs = vwSessionLogs;

function vwSessionRecaps(){
  const box = window.__STATE?.sessionRecaps || { items:[] };
  return Array.isArray(box) ? box : (Array.isArray(box.items) ? box.items : []);
}
window.vwSessionRecaps = vwSessionRecaps;

function vwGetSessionLogById(id){
  return vwSessionLogs().find(r=>Number(r.id || 0) === Number(id || 0)) || null;
}
window.vwGetSessionLogById = vwGetSessionLogById;

function vwGetSessionRecapForLog(logId){
  const lid = Number(logId || 0);
  if(!lid) return null;
  return vwSessionRecaps()
    .slice()
    .sort((a,b)=>Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0))
    .find(r=>Number(r.sessionLogId || 0) === lid) || null;
}
window.vwGetSessionRecapForLog = vwGetSessionRecapForLog;

function vwSessionLogSelectOptions(includeNone=true){
  const logs = vwSessionLogs().slice().sort((a,b)=>Number(b.endedAt || 0) - Number(a.endedAt || 0));
  const opts = [];
  if(includeNone) opts.push({ value:"", label:"No linked session" });
  logs.forEach(l=>{
    const title = l.title || ("Session " + l.id);
    const when = (typeof vwFormatDateTime === "function") ? vwFormatDateTime(l.endedAt) : "";
    opts.push({ value:String(l.id), label:"#" + l.id + " • " + title + (when ? " • " + when : "") });
  });
  return opts;
}
window.vwSessionLogSelectOptions = vwSessionLogSelectOptions;

function vwSessionLogMetaForPayload(sessionLogId){
  const log = vwGetSessionLogById(sessionLogId);
  if(!log) return { sessionLogId:null, sessionTitle:"", sessionEndedAt:null };
  return {
    sessionLogId:Number(log.id || 0) || null,
    sessionTitle:String(log.title || ("Session " + log.id)).slice(0,140),
    sessionEndedAt:Number(log.endedAt || 0) || null
  };
}
window.vwSessionLogMetaForPayload = vwSessionLogMetaForPayload;

function vwSessionLogNeedsRecap(log){
  if(!log) return false;
  return !vwGetSessionRecapForLog(log.id);
}
window.vwSessionLogNeedsRecap = vwSessionLogNeedsRecap;

function vwSessionRecordMessage(log){
  const linked = vwGetSessionRecapForLog(log.id);
  const ended = (typeof vwFormatDateTime === "function") ? vwFormatDateTime(log.endedAt) : (log.endedAt || "--");
  const started = (typeof vwFormatDateTime === "function") ? vwFormatDateTime(log.startedAt) : (log.startedAt || "--");
  const duration = (typeof vwFormatDuration === "function") ? vwFormatDuration(log.durationMs || 0) : String(log.durationMs || "--");
  const notes = esc(log.notes || "No official notes recorded.").replace(/\n/g,"<br>");
  const recap = linked
    ? '<span class="session-linked-note">Linked to recap #' + esc(linked.id) + ': ' + esc(linked.title || 'Session Recap') + '</span>'
    : '<span class="session-due-note">No linked recap yet.</span>';
  return ''+
    '<div class="session-record-modal">'+
      '<div class="session-record-grid">'+
        '<div><span>ID</span><b>#'+esc(log.id)+'</b></div>'+
        '<div><span>Duration</span><b>'+esc(duration)+'</b></div>'+
        '<div><span>Started</span><b>'+esc(started)+'</b></div>'+
        '<div><span>Ended</span><b>'+esc(ended)+'</b></div>'+
      '</div>'+
      '<div class="session-record-block"><span>Record Title</span><b>'+esc(log.title || 'Session')+'</b></div>'+
      '<div class="session-record-block"><span>Recap Link</span><b>'+recap+'</b></div>'+
      '<div class="session-record-block"><span>Official DM Notes</span><p>'+notes+'</p></div>'+
      '<div class="session-record-actions">'+
        '<button class="btn smallbtn" type="button" id="vwRecordEditNotesBtn">Edit Notes</button>'+
        '<button class="btn smallbtn '+(linked?'session-linked':'session-due')+'" type="button" id="vwRecordForgeBtn">'+(linked?'Update Recap':'Create Recap')+'</button>'+
      '</div>'+
    '</div>';
}

function vwOpenSessionRecord(id){
  if(SESSION.role !== "dm") return;
  const log = vwGetSessionLogById(id);
  if(!log){ toast("Session record not found"); return; }
  return new Promise((resolve)=>{
    const ui = vwModalBaseSetup("Session Record", "Close", "Cancel");
    ui.btnCan.style.display = "none";
    ui.mBody.innerHTML = vwSessionRecordMessage(log);

    const close = ()=>{
      ui.modal.style.display = "none";
      ui.btnOk.onclick = null;
      ui.btnCan.onclick = null;
      ui.modal.onclick = null;
      ui.btnCan.style.display = "";
      vwSetModalOpen(false);
      resolve(true);
    };
    ui.btnOk.onclick = close;
    ui.modal.onclick = (e)=>{ if(e.target === ui.modal) close(); };
    ui.mBody.querySelector("#vwRecordEditNotesBtn")?.addEventListener("click", async()=>{
      close();
      await vwEditSessionClockLog(log.id);
    });
    ui.mBody.querySelector("#vwRecordForgeBtn")?.addEventListener("click", async()=>{
      close();
      await vwOpenSessionRecapForge(log.id);
    });

    vwSetModalOpen(true);
    ui.modal.style.display = "flex";
  });
}
window.vwOpenSessionRecord = vwOpenSessionRecord;

async function vwOpenSessionRecapForge(logId){
  if(SESSION.role !== "dm") return;
  const log = vwGetSessionLogById(logId);
  if(!log){ toast("Session record not found"); return; }

  const existing = vwGetSessionRecapForLog(log.id);
  const duration = (typeof vwFormatDuration === "function") ? vwFormatDuration(log.durationMs || 0) : "";
  const ended = (typeof vwFormatDateTime === "function") ? vwFormatDateTime(log.endedAt) : "";
  const defaultSummary = existing?.summary || "";
  const defaultDmNotes = existing?.dmNotes || (log.notes || "");

  const result = await vwModalForm({
    title: existing ? "Update Recap Forge" : "Session Recap Forge",
    okText: existing ? "Update Recap" : "Create Recap",
    cancelText:"Cancel",
    fields:[
      {key:"session", label:"Source Session", type:"static", value:"#" + log.id + " • " + (log.title || "Session") + " • " + duration + (ended ? " • " + ended : "")},
      {key:"title", label:"Recap Title", value:existing?.title || log.title || ("Session " + log.id), placeholder:"Session title"},
      {key:"summary", label:"Player-Facing Recap", type:"textarea", value:defaultSummary, placeholder:"What the players should remember. Keep rulings and permanent facts here, not buried in chat."},
      {key:"dmNotes", label:"DM-Only Continuity Notes", type:"textarea", value:defaultDmNotes, placeholder:"Private continuity: secrets, consequences, NPC moves, unfinished threads."},
      {key:"visibility", label:"Visibility", value:existing?.visibility || "players", type:"select", options:[{value:"players", label:"Visible to Players"}, {value:"dm", label:"DM Only"}]},
      {key:"pinned", label:"Pinned", value:existing ? (existing.pinned ? "yes" : "no") : "yes", type:"select", options:[{value:"yes", label:"Yes"}, {value:"no", label:"No"}]}
    ]
  });
  if(!result || !String(result.title || "").trim()) return;

  const payload = {
    title:result.title,
    summary:result.summary,
    dmNotes:result.dmNotes,
    visibility:result.visibility,
    pinned:String(result.pinned || "no") === "yes",
    ...vwSessionLogMetaForPayload(log.id)
  };
  if(existing) payload.id = existing.id;

  const res = await api(existing ? "/api/recaps/update" : "/api/recaps/create", { method:"POST", body:JSON.stringify(payload) });
  if(res && res.ok){
    toast(existing ? "Linked recap updated" : "Linked recap created");
    await refreshAll();
    try{ document.querySelector('[data-itab="recaps"]')?.click(); }catch(e){}
  }else{
    toast(res?.error || "Could not save recap");
  }
}
window.vwOpenSessionRecapForge = vwOpenSessionRecapForge;

function vwOpenRecapSessionRecord(recapId){
  const recap = vwSessionRecaps().find(r=>Number(r.id || 0) === Number(recapId || 0));
  if(!recap || !recap.sessionLogId){ toast("No linked session record"); return; }
  return vwOpenSessionRecord(recap.sessionLogId);
}
window.vwOpenRecapSessionRecord = vwOpenRecapSessionRecord;
