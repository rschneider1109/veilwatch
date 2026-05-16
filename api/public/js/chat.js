// chat.js — Messenger-style table chat, direct messages, group chats, and floating app-wide messenger

window.VW_CHAT = window.VW_CHAT || {
  activeThreadId: "chat_table",
  miniThreadId: null,
  userCache: null,
  search: "",
  miniOpen: false
};

function vwChatState(){ return (window.__STATE && window.__STATE.chat) ? window.__STATE.chat : { threads:[], messages:[] }; }
function vwChatThreads(){ return Array.isArray(vwChatState().threads) ? vwChatState().threads : []; }
function vwChatMessages(){ return Array.isArray(vwChatState().messages) ? vwChatState().messages : []; }
function vwChatCurrentUserId(){ return String(SESSION?.userId || ""); }
function vwChatIsMine(msg){ return String(msg?.fromUserId || "") === vwChatCurrentUserId(); }
function vwChatCanManageMessage(msg){ return SESSION.role === "dm" || vwChatIsMine(msg); }
function vwChatTime(ts){
  try{ return new Date(Number(ts || Date.now())).toLocaleString([], { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" }); }
  catch(e){ return ""; }
}
function vwChatParticipantLabel(pid){
  pid = String(pid || "");
  if(pid === "all") return "Everyone";
  if(pid === "dm") return "DM";
  if(pid === vwChatCurrentUserId()) return "You";
  const u = (window.VW_CHAT.userCache || []).find(x=>String(x.id) === pid);
  if(u) return u.username;
  return SESSION.role === "dm" ? pid : "Player";
}
function vwChatThreadMeta(thread){
  const parts = Array.isArray(thread?.participantIds) ? thread.participantIds : [];
  if(parts.includes("all")) return "Everyone at the table";
  return parts.map(vwChatParticipantLabel).join(" • ") || "Private chat";
}
function vwChatLatestMessage(threadId){
  const msgs = vwChatMessages().filter(m=>m.threadId === threadId).sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0));
  return msgs.length ? msgs[msgs.length - 1] : null;
}
function vwChatEnsureActiveThread(key){
  const threads = vwChatThreads();
  const prop = key || "activeThreadId";
  if(!threads.length){ window.VW_CHAT[prop] = null; return null; }
  if(!window.VW_CHAT[prop] || !threads.some(t=>t.id === window.VW_CHAT[prop])){
    const table = threads.find(t=>t.id === "chat_table");
    window.VW_CHAT[prop] = (table || threads[0]).id;
  }
  return threads.find(t=>t.id === window.VW_CHAT[prop]) || null;
}

async function vwChatLoadUsers(){
  if(window.VW_CHAT.userCache) return window.VW_CHAT.userCache;
  const res = await api("/api/chat/users");
  window.VW_CHAT.userCache = (res && res.ok && Array.isArray(res.users)) ? res.users : [];
  return window.VW_CHAT.userCache;
}

function renderChat(){
  const root = document.getElementById("tab-chat");
  if(!root) return;
  if(!window.VW_CHAT.userCache && !window.VW_CHAT.loadingUsers){
    window.VW_CHAT.loadingUsers = true;
    vwChatLoadUsers().finally(()=>{ window.VW_CHAT.loadingUsers = false; try{ renderChat(); renderFloatingChat(); }catch(e){} });
  }

  const newThreadBtn = document.getElementById("chatNewThreadBtn");
  const newDmBtn = document.getElementById("chatNewDmBtn");
  const refreshBtn = document.getElementById("chatRefreshBtn");
  const search = document.getElementById("chatSearchInput");
  const sendBtn = document.getElementById("chatSendBtn");
  const composer = document.getElementById("chatComposerInput");
  const editThreadBtn = document.getElementById("chatEditThreadBtn");
  const deleteThreadBtn = document.getElementById("chatDeleteThreadBtn");

  if(newThreadBtn){
    newThreadBtn.classList.remove("hidden");
    newThreadBtn.onclick = ()=>vwChatOpenNewThreadModal();
  }
  if(newDmBtn) newDmBtn.onclick = ()=>vwChatOpenDmThread();
  if(refreshBtn) refreshBtn.onclick = async ()=>{ await refreshAll(); renderChat(); renderFloatingChat(); };
  if(search && !search.__vwChatWired){
    search.__vwChatWired = true;
    search.oninput = ()=>{ window.VW_CHAT.search = search.value || ""; renderChat(); };
  }
  if(sendBtn) sendBtn.onclick = ()=>vwChatSendMessage("full");
  if(composer && !composer.__vwChatWired){
    composer.__vwChatWired = true;
    composer.addEventListener("keydown", (e)=>{
      if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); vwChatSendMessage("full"); }
    });
  }
  if(editThreadBtn) editThreadBtn.onclick = ()=>vwChatEditActiveThread();
  if(deleteThreadBtn) deleteThreadBtn.onclick = ()=>vwChatDeleteActiveThread();

  renderChatThreads();
  renderChatConversation();
  renderFloatingChat();
}
window.renderChat = renderChat;

function renderChatThreads(){
  const list = document.getElementById("chatThreadList");
  if(!list) return;
  const q = String(window.VW_CHAT.search || "").trim().toLowerCase();
  let threads = vwChatThreads().slice().sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));
  if(q){
    threads = threads.filter(t=>String(t.title||"").toLowerCase().includes(q) || vwChatThreadMeta(t).toLowerCase().includes(q));
  }
  if(!threads.length){ list.innerHTML = '<div class="chat-empty">No chats yet.</div>'; return; }
  list.innerHTML = "";
  threads.forEach(thread=>{
    const latest = vwChatLatestMessage(thread.id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chat-thread" + (thread.id === window.VW_CHAT.activeThreadId ? " active" : "");
    btn.onclick = ()=>{ window.VW_CHAT.activeThreadId = thread.id; renderChat(); };
    const title = document.createElement("div"); title.className = "chat-thread-title"; title.textContent = thread.title || "Chat";
    const meta = document.createElement("div"); meta.className = "chat-thread-meta"; meta.textContent = latest ? ((latest.deleted ? "Message deleted" : latest.body).slice(0,80)) : vwChatThreadMeta(thread);
    const time = document.createElement("div"); time.className = "chat-thread-time"; time.textContent = latest ? vwChatTime(latest.createdAt) : vwChatTime(thread.updatedAt || thread.createdAt);
    btn.appendChild(title); btn.appendChild(meta); btn.appendChild(time); list.appendChild(btn);
  });
}

function vwChatRenderMessages(thread, list){
  if(!list) return;
  if(!thread){ list.innerHTML = '<div class="chat-empty">Select or create a conversation.</div>'; return; }
  const msgs = vwChatMessages().filter(m=>m.threadId === thread.id).sort((a,b)=>Number(a.createdAt||0)-Number(b.createdAt||0));
  if(!msgs.length){ list.innerHTML = '<div class="chat-empty">No messages yet. Start the conversation.</div>'; return; }
  list.innerHTML = "";
  msgs.forEach(msg=>{
    const wrap = document.createElement("div"); wrap.className = "chat-msg-row " + (vwChatIsMine(msg) ? "mine" : "theirs");
    const bubble = document.createElement("div"); bubble.className = "chat-bubble " + (msg.fromRole === "dm" ? "dm" : "player");
    const by = document.createElement("div"); by.className = "chat-msg-by"; by.textContent = (msg.fromRole === "dm" ? "DM" : msg.fromName) + " • " + vwChatTime(msg.createdAt) + (msg.edited ? " • edited" : "");
    const body = document.createElement("div"); body.className = "chat-msg-body"; body.textContent = msg.body || "";
    bubble.appendChild(by); bubble.appendChild(body);
    if(!msg.deleted && vwChatCanManageMessage(msg)){
      const actions = document.createElement("div"); actions.className = "chat-msg-actions";
      const edit = document.createElement("button"); edit.className = "btn smallbtn"; edit.type = "button"; edit.textContent = "Edit"; edit.onclick = ()=>vwChatEditMessage(msg);
      const del = document.createElement("button"); del.className = "btn smallbtn dangerbtn"; del.type = "button"; del.textContent = "Delete"; del.onclick = ()=>vwChatDeleteMessage(msg);
      actions.appendChild(edit); actions.appendChild(del); bubble.appendChild(actions);
    }
    wrap.appendChild(bubble); list.appendChild(wrap);
  });
  setTimeout(()=>{ try{ list.scrollTop = list.scrollHeight; }catch(e){} }, 0);
}

function renderChatConversation(){
  const thread = vwChatEnsureActiveThread("activeThreadId");
  const title = document.getElementById("chatActiveTitle");
  const meta = document.getElementById("chatActiveMeta");
  const list = document.getElementById("chatMessageList");
  const composer = document.getElementById("chatComposerInput");
  const sendBtn = document.getElementById("chatSendBtn");
  const dmActions = document.getElementById("chatThreadDmActions");
  if(title) title.textContent = thread ? (thread.title || "Chat") : "Select a chat";
  if(meta) meta.textContent = thread ? vwChatThreadMeta(thread) : "No conversation selected";
  if(dmActions) dmActions.classList.toggle("hidden", !(SESSION.role === "dm" && thread && !thread.locked));
  if(composer) composer.disabled = !thread;
  if(sendBtn) sendBtn.disabled = !thread;
  vwChatRenderMessages(thread, list);
}

async function vwChatSendMessage(mode){
  const isMini = mode === "mini";
  const thread = vwChatEnsureActiveThread(isMini ? "miniThreadId" : "activeThreadId");
  const input = document.getElementById(isMini ? "chatMiniComposerInput" : "chatComposerInput");
  if(!thread || !input) return;
  const body = String(input.value || "").trim();
  if(!body) return toast("Type a message first");
  const res = await api("/api/chat/send", { method:"POST", body:JSON.stringify({ threadId:thread.id, body }) });
  if(res && res.ok){ input.value = ""; await refreshAll(); renderChat(); renderFloatingChat(); }
  else toast((res && res.error) || "Message failed");
}

async function vwChatOpenDmThread(){
  const res = await api("/api/chat/thread/create", { method:"POST", body:JSON.stringify({ type:"dm", toDm:true }) });
  if(res && res.ok && res.thread){
    window.VW_CHAT.activeThreadId = res.thread.id;
    window.VW_CHAT.miniThreadId = res.thread.id;
    await refreshAll(); renderChat(); renderFloatingChat();
  }else toast((res && res.error) || "Could not open DM chat");
}

async function vwChatOpenNewThreadModal(existing){
  const users = await vwChatLoadUsers();
  const playerUsers = users.filter(u=>u.role === "player" && String(u.id) !== vwChatCurrentUserId());
  const ui = vwModalBaseSetup(existing ? "Edit Chat" : "New Chat", existing ? "Save" : "Create", "Cancel");
  const selected = new Set(existing && Array.isArray(existing.participantIds) ? existing.participantIds.map(String) : []);
  const everyoneChecked = selected.has("all");
  ui.mBody.innerHTML = `
    <div class="mini" style="margin-bottom:8px;">Create a direct message or group chat. Players can chat with other players; DM can also create table-wide chats.</div>
    <label class="mini">Chat Title</label>
    <input class="input" id="chatModalTitle" style="width:100%;margin:6px 0 12px 0;" placeholder="Chat title" />
    <label class="row ${SESSION.role === "dm" ? "" : "hidden"}" style="gap:8px;margin-bottom:12px;"><input type="checkbox" id="chatModalEveryone" /> <span>Everyone at the table</span></label>
    <div class="mini" style="margin-bottom:6px;">Players</div>
    <div id="chatModalUsers" class="chat-modal-users"></div>
  `;
  const title = document.getElementById("chatModalTitle");
  const everyone = document.getElementById("chatModalEveryone");
  const userBox = document.getElementById("chatModalUsers");
  if(title) title.value = existing ? (existing.title || "") : "";
  if(everyone) everyone.checked = everyoneChecked;
  if(userBox){
    if(!playerUsers.length) userBox.innerHTML = '<div class="mini">No other player accounts yet.</div>';
    else playerUsers.forEach(u=>{
      const label = document.createElement("label"); label.className = "chat-user-check";
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.value = u.id; cb.checked = selected.has(String(u.id));
      const span = document.createElement("span"); span.textContent = u.username;
      label.appendChild(cb); label.appendChild(span); userBox.appendChild(label);
    });
  }
  function syncChecks(){
    const disabled = !!everyone?.checked;
    userBox?.querySelectorAll('input[type="checkbox"]').forEach(cb=>{ cb.disabled = disabled; });
  }
  if(everyone) everyone.onchange = syncChecks;
  syncChecks();
  const close = (val)=>{ ui.modal.style.display = "none"; ui.btnOk.onclick = null; ui.btnCan.onclick = null; ui.modal.onclick = null; vwSetModalOpen(false); return val; };
  ui.btnCan.onclick = ()=>close(false);
  ui.modal.onclick = (e)=>{ if(e.target === ui.modal) close(false); };
  ui.btnOk.onclick = async ()=>{
    const participantIds = everyone?.checked ? ["all"] : Array.from(userBox?.querySelectorAll('input[type="checkbox"]:checked') || []).map(cb=>cb.value);
    const payload = { title:(title?.value || "").trim(), participantIds, toEveryone: !!everyone?.checked };
    let res;
    if(existing) res = await api("/api/chat/thread/update", { method:"POST", body:JSON.stringify({ threadId:existing.id, ...payload }) });
    else res = await api("/api/chat/thread/create", { method:"POST", body:JSON.stringify(payload) });
    if(res && res.ok){ close(true); if(res.thread){ window.VW_CHAT.activeThreadId = res.thread.id; window.VW_CHAT.miniThreadId = res.thread.id; } await refreshAll(); renderChat(); renderFloatingChat(); }
    else toast((res && res.error) || "Chat save failed");
  };
  vwSetModalOpen(true); ui.modal.style.display = "flex";
}

function vwChatEditActiveThread(){ const thread = vwChatEnsureActiveThread("activeThreadId"); if(thread) vwChatOpenNewThreadModal(thread); }
async function vwChatDeleteActiveThread(){
  const thread = vwChatEnsureActiveThread("activeThreadId");
  if(!thread || thread.locked) return;
  const ok = await vwModalConfirm({ title:"Delete Chat", message:"Delete this chat and all messages inside it?", okText:"Delete" });
  if(!ok) return;
  const res = await api("/api/chat/thread/delete", { method:"POST", body:JSON.stringify({ threadId:thread.id }) });
  if(res && res.ok){ window.VW_CHAT.activeThreadId = "chat_table"; window.VW_CHAT.miniThreadId = "chat_table"; await refreshAll(); renderChat(); renderFloatingChat(); }
  else toast((res && res.error) || "Delete failed");
}
async function vwChatEditMessage(msg){
  const value = await vwModalInput({ title:"Edit Message", label:"Message", value:msg.body || "", okText:"Save" });
  if(value === null) return;
  const res = await api("/api/chat/message/edit", { method:"POST", body:JSON.stringify({ messageId:msg.id, body:value }) });
  if(res && res.ok){ await refreshAll(); renderChat(); renderFloatingChat(); }
  else toast((res && res.error) || "Edit failed");
}
async function vwChatDeleteMessage(msg){
  const ok = await vwModalConfirm({ title:"Delete Message", message:"Delete this message?", okText:"Delete" });
  if(!ok) return;
  const res = await api("/api/chat/message/delete", { method:"POST", body:JSON.stringify({ messageId:msg.id }) });
  if(res && res.ok){ await refreshAll(); renderChat(); renderFloatingChat(); }
  else toast((res && res.error) || "Delete failed");
}

function vwChatEnsureFloatingDom(){
  if(document.getElementById("chatFloatingDock")) return;
  const dock = document.createElement("div");
  dock.id = "chatFloatingDock";
  dock.className = "chat-floating-dock";
  dock.innerHTML = `
    <button class="chat-float-button" id="chatFloatButton" type="button" aria-label="Open messages">
      <span>Messages</span><span class="chat-float-badge hidden" id="chatFloatBadge">0</span>
    </button>
    <div class="chat-float-panel hidden" id="chatFloatPanel">
      <div class="chat-float-head">
        <div><b>Messages</b><div class="mini">Quick chat stays out of the way.</div></div>
        <div class="row" style="gap:6px;"><button class="btn smallbtn" id="chatFloatNewBtn" type="button">New</button><button class="btn smallbtn" id="chatFloatFullBtn" type="button">Open</button></div>
      </div>
      <div class="chat-float-body">
        <div class="chat-float-threads" id="chatFloatThreads"></div>
        <div class="chat-float-convo">
          <div class="chat-float-title" id="chatFloatTitle">Select a chat</div>
          <div class="chat-float-messages" id="chatFloatMessages"></div>
          <div class="chat-float-composer"><textarea id="chatMiniComposerInput" rows="1" placeholder="Message..."></textarea><button class="btn smallbtn" id="chatMiniSendBtn" type="button">Send</button></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dock);
  document.getElementById("chatFloatButton").onclick = ()=>{ window.VW_CHAT.miniOpen = !window.VW_CHAT.miniOpen; renderFloatingChat(); };
  document.getElementById("chatFloatFullBtn").onclick = ()=>{ window.VW_CHAT.miniOpen = false; void renderTabs("chat"); renderFloatingChat(); };
  document.getElementById("chatFloatNewBtn").onclick = ()=>vwChatOpenNewThreadModal();
  document.getElementById("chatMiniSendBtn").onclick = ()=>vwChatSendMessage("mini");
  const miniInput = document.getElementById("chatMiniComposerInput");
  miniInput.addEventListener("keydown", (e)=>{ if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); vwChatSendMessage("mini"); } });
}

function renderFloatingChat(){
  if(!SESSION || !SESSION.userId){ return; }
  vwChatEnsureFloatingDom();
  const panel = document.getElementById("chatFloatPanel");
  const threadsEl = document.getElementById("chatFloatThreads");
  const msgEl = document.getElementById("chatFloatMessages");
  const titleEl = document.getElementById("chatFloatTitle");
  const badge = document.getElementById("chatFloatBadge");
  const navBadge = document.getElementById("chatUnreadBadge");
  if(panel) panel.classList.toggle("hidden", !window.VW_CHAT.miniOpen);

  if(window.VW_CHAT.lastSeen === undefined || window.VW_CHAT.lastSeen === null) window.VW_CHAT.lastSeen = Date.now();
  const unreadCount = vwChatMessages().filter(m=>!vwChatIsMine(m) && Number(m.createdAt||0) > Number(window.VW_CHAT.lastSeen || 0)).length;
  [badge, navBadge].forEach(el=>{ if(!el) return; el.textContent = String(unreadCount); el.classList.toggle("hidden", unreadCount <= 0); });
  if(window.VW_CHAT.miniOpen){ window.VW_CHAT.lastSeen = Date.now(); }

  const threads = vwChatThreads().slice().sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));
  if(threadsEl){
    threadsEl.innerHTML = "";
    if(!threads.length) threadsEl.innerHTML = '<div class="chat-empty">No chats yet.</div>';
    else threads.forEach(t=>{
      const latest = vwChatLatestMessage(t.id);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chat-float-thread" + (t.id === window.VW_CHAT.miniThreadId ? " active" : "");
      b.innerHTML = `<b></b><span></span>`;
      b.querySelector("b").textContent = t.title || "Chat";
      b.querySelector("span").textContent = latest ? (latest.deleted ? "Message deleted" : latest.body).slice(0,42) : vwChatThreadMeta(t);
      b.onclick = ()=>{ window.VW_CHAT.miniThreadId = t.id; renderFloatingChat(); };
      threadsEl.appendChild(b);
    });
  }
  const thread = vwChatEnsureActiveThread("miniThreadId");
  if(titleEl) titleEl.textContent = thread ? (thread.title || "Chat") : "Select a chat";
  vwChatRenderMessages(thread, msgEl);
}
window.renderFloatingChat = renderFloatingChat;
