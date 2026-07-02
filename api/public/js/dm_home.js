// dm_home.js — DM Home Intelligence Rail
// Aggregates existing state into a live command surface without adding backend dependencies.

window.VW_DM_HOME = window.VW_DM_HOME || { wired:false };

function vwHomeFmtTime(ts){
  if(!ts) return "--";
  try{ return new Date(Number(ts)).toLocaleString([], { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" }); }
  catch(e){ return "--"; }
}

function vwHomeAge(ts){
  const n = Number(ts || 0);
  if(!n) return "";
  const diff = Math.max(0, Date.now() - n);
  const mins = Math.floor(diff / 60000);
  if(mins < 1) return "just now";
  if(mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if(hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  return days + "d ago";
}

function vwHomeGetNotifications(st){
  return Array.isArray(st?.notifications?.items) ? st.notifications.items : [];
}

function vwHomeGetClues(st){
  return Array.isArray(st?.clues?.items) ? st.clues.items : [];
}

function vwHomeGetArchivedClues(st){
  return Array.isArray(st?.clues?.archived) ? st.clues.archived : [];
}

function vwHomeGetRecaps(st){
  const box = st?.sessionRecaps || { items:[] };
  return Array.isArray(box) ? box : (Array.isArray(box.items) ? box.items : []);
}

function vwHomeGetThreads(st){
  return Array.isArray(st?.chat?.threads) ? st.chat.threads : [];
}

function vwHomeGetMessages(st){
  return Array.isArray(st?.chat?.messages) ? st.chat.messages : [];
}

function vwHomeIsPlayerRequest(n){
  if(typeof isPlayerRequest === "function") return isPlayerRequest(n);
  const from = String(n?.from || "");
  const audience = String(n?.audience || "dm");
  return from !== "DM" && audience !== "players";
}

function vwHomeIsDmBroadcast(n){
  const from = String(n?.from || "");
  const audience = String(n?.audience || "dm");
  return from === "DM" && audience === "players";
}

function vwHomeSortedByTime(items){
  return (items || []).slice().sort((a,b)=>Number(b.ts || b.updatedAt || b.createdAt || b.id || 0) - Number(a.ts || a.updatedAt || a.createdAt || a.id || 0));
}

function vwHomeThreadTitle(st, threadId){
  const t = vwHomeGetThreads(st).find(x=>String(x.id) === String(threadId));
  return t ? (t.title || "Chat") : "Chat";
}

function vwHomeBuildAttention(st){
  const out = [];
  const active = Array.isArray(st.activeParty) ? st.activeParty : [];
  const notifications = vwHomeGetNotifications(st);
  const requests = notifications
    .filter(n=>vwHomeIsPlayerRequest(n) && !n.archived && !n.dmDeleted)
    .filter(n=>!["completed","denied"].includes(String(n.status || "open").toLowerCase()))
    .sort((a,b)=>Number(b.updatedAt || b.createdAt || b.id || 0) - Number(a.updatedAt || a.createdAt || a.id || 0));

  requests.forEach(n=>out.push({
    severity: String(n.status || "open") === "open" ? "hot" : "warn",
    title: (n.from || "Player") + " needs DM",
    meta: (n.type || "Request") + " • " + (n.status || "open"),
    detail: n.detail || "Player request awaiting review.",
    ts: n.updatedAt || n.createdAt || n.id,
    action:"requests"
  }));

  const dmOnlyAlerts = notifications
    .filter(n=>!vwHomeIsPlayerRequest(n) && !n.archived && String(n.status || "open") === "open")
    .filter(n=>String(n.audience || "dm") === "dm")
    .sort((a,b)=>Number(b.updatedAt || b.createdAt || b.id || 0) - Number(a.updatedAt || a.createdAt || a.id || 0));
  dmOnlyAlerts.forEach(n=>out.push({
    severity:"warn",
    title:n.type || "Open DM note",
    meta:"Notification • " + vwHomeAge(n.updatedAt || n.createdAt),
    detail:n.detail || "Open DM notification.",
    ts:n.updatedAt || n.createdAt || n.id,
    action:"notifications"
  }));

  const messages = vwHomeGetMessages(st).filter(m=>!m.deleted);
  const byThread = new Map();
  messages.forEach(m=>{
    const arr = byThread.get(m.threadId) || [];
    arr.push(m);
    byThread.set(m.threadId, arr);
  });
  byThread.forEach((msgs, threadId)=>{
    const sorted = msgs.slice().sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0));
    const last = sorted[sorted.length - 1];
    const lastDm = sorted.filter(m=>String(m.fromRole||"") === "dm").slice(-1)[0];
    if(last && String(last.fromRole || "") !== "dm" && Number(last.createdAt || 0) > Number(lastDm?.createdAt || 0)){
      out.push({
        severity:"hot",
        title:"Unanswered transmission",
        meta:(last.fromName || "Player") + " • " + vwHomeThreadTitle(st, threadId),
        detail:last.body || "Player message awaiting response.",
        ts:last.createdAt,
        action:"chat"
      });
    }
  });

  if(!active.length){
    out.push({
      severity:"warn",
      title:"No active party set",
      meta:"Table setup",
      detail:"Add the player characters who are actually at the table.",
      ts:Date.now() - 1,
      action:"character"
    });
  }

  const sc = st.sessionClock || {};
  const elapsed = (typeof vwGetSessionClockElapsedMs === "function") ? vwGetSessionClockElapsedMs() : Number(sc.accumulatedMs || 0);
  if(!sc.running && elapsed > 0){
    out.push({
      severity:"watch",
      title:"Clock paused with time on record",
      meta:(typeof vwFormatDuration === "function" ? vwFormatDuration(elapsed) : "Session clock"),
      detail:"Resume or end the session when the official record is ready.",
      ts:Date.now() - 2,
      action:"clock"
    });
  }

  return vwHomeSortedByTime(out).slice(0,6);
}

function vwHomeBuildLastBroadcast(st){
  const candidates = [];
  vwHomeGetNotifications(st).filter(n=>vwHomeIsDmBroadcast(n) && !n.archived).forEach(n=>candidates.push({
    kind:"DM Alert",
    title:n.type || "Player alert",
    detail:n.detail || "",
    ts:n.updatedAt || n.createdAt || n.id,
    action:"notifications"
  }));

  vwHomeGetRecaps(st).filter(r=>String(r.visibility || "players") === "players").forEach(r=>candidates.push({
    kind:r.pinned ? "Pinned Recap" : "Session Recap",
    title:r.title || "Session Recap",
    detail:r.summary || "",
    ts:r.updatedAt || r.createdAt || r.id,
    action:"recaps"
  }));

  vwHomeGetMessages(st).filter(m=>!m.deleted && String(m.fromRole || "") === "dm").forEach(m=>candidates.push({
    kind:"Chat Transmission",
    title:vwHomeThreadTitle(st, m.threadId),
    detail:m.body || "",
    ts:m.createdAt || m.updatedAt || m.id,
    action:"chat"
  }));

  return vwHomeSortedByTime(candidates)[0] || null;
}

function vwHomeBuildActivity(st){
  const rows = [];
  vwHomeGetMessages(st).filter(m=>!m.deleted).forEach(m=>rows.push({
    icon:String(m.fromRole||"") === "dm" ? "DM" : "PL",
    title:(m.fromName || (m.fromRole === "dm" ? "DM" : "Player")) + " sent chat",
    meta:vwHomeThreadTitle(st, m.threadId) + " • " + vwHomeAge(m.createdAt),
    detail:m.body || "",
    ts:m.createdAt,
    action:"chat"
  }));

  vwHomeGetNotifications(st).filter(n=>!n.archived).forEach(n=>rows.push({
    icon:vwHomeIsPlayerRequest(n) ? "RQ" : "NT",
    title:vwHomeIsPlayerRequest(n) ? ((n.from || "Player") + " request") : (n.type || "Notification"),
    meta:(n.status || "open") + " • " + vwHomeAge(n.updatedAt || n.createdAt),
    detail:n.detail || "",
    ts:n.updatedAt || n.createdAt || n.id,
    action:vwHomeIsPlayerRequest(n) ? "requests" : "notifications"
  }));

  vwHomeGetClues(st).forEach(c=>rows.push({
    icon:String(c.visibility || "hidden") === "revealed" ? "RV" : "CL",
    title:c.title || "Clue",
    meta:(c.visibility || "hidden") + (c.district ? " • " + c.district : ""),
    detail:c.details || "",
    ts:c.updatedAt || c.revealedAt || c.createdAt || c.id,
    action:"clues"
  }));

  vwHomeGetRecaps(st).forEach(r=>rows.push({
    icon:"RC",
    title:r.title || "Session Recap",
    meta:(r.visibility || "players") + " • " + vwHomeAge(r.updatedAt || r.createdAt),
    detail:r.summary || r.dmNotes || "",
    ts:r.updatedAt || r.createdAt || r.id,
    action:"recaps"
  }));

  (st.sessionClockLog?.items || []).forEach(l=>rows.push({
    icon:"SE",
    title:l.title || "Session logged",
    meta:(typeof vwFormatDuration === "function" ? vwFormatDuration(l.durationMs || 0) : "Session") + " • " + vwHomeAge(l.endedAt),
    detail:l.notes || "Session archive entry.",
    ts:l.endedAt || l.updatedAt || l.id,
    action:"clock-log"
  }));

  return vwHomeSortedByTime(rows).slice(0,5);
}

function vwHomeMakeQueueItem(item){
  const div = document.createElement("button");
  div.type = "button";
  div.className = "dm-rail-item " + (item.severity || "watch");
  div.dataset.dmHomeAction = item.action || "";
  div.innerHTML = "<span class=\"dm-rail-sev\"></span><span><b></b><em></em><small></small></span>";
  div.querySelector(".dm-rail-sev").textContent = item.severity === "hot" ? "!" : item.severity === "warn" ? "△" : "•";
  div.querySelector("b").textContent = item.title || "Attention item";
  div.querySelector("em").textContent = item.meta || "";
  div.querySelector("small").textContent = item.detail || "";
  return div;
}

function vwHomeMakeActivityItem(item){
  const div = document.createElement("button");
  div.type = "button";
  div.className = "dm-rail-item compact";
  div.dataset.dmHomeAction = item.action || "";
  div.innerHTML = "<span class=\"dm-rail-tag\"></span><span><b></b><em></em><small></small></span>";
  div.querySelector(".dm-rail-tag").textContent = item.icon || "•";
  div.querySelector("b").textContent = item.title || "Activity";
  div.querySelector("em").textContent = item.meta || "";
  div.querySelector("small").textContent = item.detail || "";
  return div;
}

function vwHomeWireRailActions(root){
  if(!root || root.dataset.wired === "1") return;
  root.dataset.wired = "1";
  root.addEventListener("click", async (e)=>{
    const btn = e.target.closest("[data-dm-home-action]");
    if(!btn) return;
    const action = btn.dataset.dmHomeAction;
    if(!action) return;
    e.preventDefault();
    await vwHomeRunAction(action);
  });
}

async function vwHomeRunAction(action){
  if(action === "character") return renderTabs("character");
  if(action === "shop") return renderTabs("shop");
  if(action === "chat") return renderTabs("chat");
  if(action === "clock") return document.getElementById("sessionClockStartBtn")?.click();
  if(action === "clock-log") return renderTabs("home");
  if(action === "new-alert") return document.getElementById("dmNewNotifBtn")?.click();
  if(action === "new-recap"){
    await renderTabs("intel");
    setTimeout(()=>{ document.querySelector('[data-itab="recaps"]')?.click(); document.getElementById("dmNewRecapBtn")?.click(); }, 60);
    return;
  }
  const intelMap = {
    notifications:"notifications",
    requests:"requests",
    clues:"clues",
    recaps:"recaps",
    archived:"archived"
  };
  if(intelMap[action]){
    await renderTabs("intel");
    setTimeout(()=>document.querySelector('[data-itab="' + intelMap[action] + '"]')?.click(), 40);
  }
}

function renderDMHomeIntelligenceRail(){
  const root = document.getElementById("dmHomeIntelRail");
  if(!root) return;
  root.classList.toggle("hidden", SESSION.role !== "dm");
  if(SESSION.role !== "dm") return;
  vwHomeWireRailActions(root);

  const st = window.__STATE || {};
  const chars = Array.isArray(st.characters) ? st.characters : [];
  const active = Array.isArray(st.activeParty) ? st.activeParty : [];
  const notifications = vwHomeGetNotifications(st);
  const openRequests = notifications.filter(n=>vwHomeIsPlayerRequest(n) && !n.archived && !n.dmDeleted && !["completed","denied"].includes(String(n.status || "open").toLowerCase()));
  const openAlerts = notifications.filter(n=>!vwHomeIsPlayerRequest(n) && !n.archived && String(n.status || "open") === "open");
  const clues = vwHomeGetClues(st);
  const revealed = clues.filter(c=>String(c.visibility || "hidden") === "revealed");
  const hidden = clues.filter(c=>String(c.visibility || "hidden") !== "revealed");
  const recaps = vwHomeGetRecaps(st);
  const health = document.getElementById("dmHomeHealthGrid");
  const status = document.getElementById("dmHomeRailStatus");
  const sc = st.sessionClock || {};
  const needs = vwHomeBuildAttention(st);

  if(status){
    const hot = needs.filter(x=>x.severity === "hot").length;
    status.textContent = hot ? ("ATTN " + hot) : (sc.running ? "LIVE" : "STANDBY");
    status.classList.toggle("hot", !!hot);
    status.classList.toggle("live", !hot && !!sc.running);
  }

  const chips = document.getElementById("dmHomeOverviewChips");
  if(chips){
    const sessionTxt = sc.running ? "Running" : "Break";
    chips.innerHTML = [
      { n:active.length, label:"Active" },
      { n:openRequests.length + openAlerts.length, label:"Needs DM" },
      { n:revealed.length + "/" + hidden.length, label:"Intel R/H" },
      { n:chars.length, label:"Roster" },
      { n:recaps.length, label:"Recaps" },
      { n:sessionTxt, label:"Session" }
    ].map(x=>'<div class="dm-rail-chip"><b>'+esc(x.n)+'</b><span>'+esc(x.label)+'</span></div>').join("");
  }

  const needsHost = document.getElementById("dmHomeNeedsList");
  if(needsHost){
    needsHost.innerHTML = "";
    if(!needs.length){
      needsHost.innerHTML = '<div class="dm-rail-empty">No active DM attention items. The table is quiet.</div>';
    }else{
      needs.forEach(item=>needsHost.appendChild(vwHomeMakeQueueItem(item)));
    }
  }

  const last = vwHomeBuildLastBroadcast(st);
  const lastHost = document.getElementById("dmHomeLastBroadcast");
  if(lastHost){
    if(!last){
      lastHost.innerHTML = '<div class="dm-rail-empty">No player-facing broadcast yet.</div>';
    }else{
      lastHost.innerHTML = ''+
        '<button class="dm-broadcast-card" type="button" data-dm-home-action="'+esc(last.action || '')+'">'+
          '<b>'+esc(last.kind || 'Broadcast')+'</b>'+ 
          '<span>'+esc(last.title || '')+'</span>'+ 
          '<small>'+esc((last.detail || '').slice(0,180))+(String(last.detail || '').length > 180 ? '…' : '')+'</small>'+ 
          '<em>'+esc(vwHomeAge(last.ts))+'</em>'+ 
        '</button>';
    }
  }

  const activityHost = document.getElementById("dmHomeActivityList");
  if(activityHost){
    const activity = vwHomeBuildActivity(st);
    activityHost.innerHTML = "";
    if(!activity.length){
      activityHost.innerHTML = '<div class="dm-rail-empty">No activity recorded yet.</div>';
    }else{
      activity.forEach(item=>activityHost.appendChild(vwHomeMakeActivityItem(item)));
    }
  }

  if(health){
    const feat = (st.settings && st.settings.features) || {};
    const shops = st.shops || {};
    const activeShop = (shops.list || []).find(s=>String(s.id) === String(shops.activeShopId));
    const h = [
      { label:"Save", value:"OK", good:true },
      { label:"Clock", value:sc.running ? "LIVE" : "READY", good:!!sc.running },
      { label:"Shop", value:shops.enabled ? "LIVE" : "OFF", good:!!shops.enabled, action:"shop" },
      { label:"Intel", value:feat.intel === false ? "OFF" : "ON", good:feat.intel !== false, action:"clues" },
      { label:"Chat", value:vwHomeGetThreads(st).length ? "ON" : "IDLE", good:vwHomeGetThreads(st).length > 0, action:"chat" },
      { label:"Supply", value:activeShop ? activeShop.name : "NONE", good:!!activeShop, action:"shop" }
    ];
    health.innerHTML = h.map(x=>'<button class="dm-health-pill '+(x.good?'good':'warn')+'" type="button" data-dm-home-action="'+esc(x.action||'')+'"><span>'+esc(x.label)+'</span><b>'+esc(x.value)+'</b></button>').join("");
  }
}
window.renderDMHomeIntelligenceRail = renderDMHomeIntelligenceRail;

// Periodic repaint keeps relative times and session health fresh without waiting for a state push.
setInterval(()=>{ try{ renderDMHomeIntelligenceRail(); }catch(e){} }, 5000);
