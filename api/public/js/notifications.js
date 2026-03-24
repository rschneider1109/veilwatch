// notifications.js — DM notifications, player requests, and archived request rendering

function isPlayerRequest(n){
  if(!n) return false;
  const from = String(n.from || "");
  const audience = String(n.audience || "dm");
  return from !== "DM" && audience !== "players";
}
function isDmAlert(n){
  if(!n) return false;
  const from = String(n.from || "");
  const audience = String(n.audience || "dm");
  return from === "DM" || audience === "players";
}

async function saveNotificationsState(st, msg){
  const res = await api("/api/notifications/save",{method:"POST",body:JSON.stringify({notifications: st.notifications})});
  if(res.ok){ if(msg) toast(msg); await refreshAll(); }
  else toast(res.error||"Failed");
  return res;
}

function renderDM(){
  if(SESSION.role!=="dm") return;
  const st=window.__STATE||{};
  const nb=document.getElementById("notifBody");
  if(!nb) return;
  nb.innerHTML="";
  const alerts = (st.notifications?.items||[])
    .filter(n=>isDmAlert(n) && !n.archived)
    .slice()
    .sort((a,b)=>(b.id||0)-(a.id||0));
  if(!alerts.length){
    nb.innerHTML = '<tr><td colspan="7" class="mini">No notifications yet.</td></tr>';
  }else{
    alerts.forEach(n=>{
      const tr=document.createElement("tr");
      tr.innerHTML = '<td>'+n.id+'</td><td>'+esc(n.type||"")+'</td><td>'+esc(n.detail||"")+'</td><td>'+esc(n.from||"")+'</td><td>'+esc(n.status||"open")+'</td><td>'+esc(n.notes||"")+'</td><td></td>';
      const td=tr.lastChild;
      td.innerHTML = '<button class="btn smallbtn">Resolve</button>';
      td.querySelector("button").onclick=async ()=>{
        n.status="resolved";
        await saveNotificationsState(st, "Resolved");
      };
      nb.appendChild(tr);
    });
  }

  const clearBtn = document.getElementById("clearResolvedBtn");
  if(clearBtn) clearBtn.onclick=async ()=>{
    st.notifications ||= { nextId: 1, items: [] };
    st.notifications.items = (st.notifications.items||[]).filter(x=>!(isDmAlert(x) && x.status==="resolved" && !x.archived));
    await saveNotificationsState(st, "Cleared");
  };

  const ab=document.getElementById("archBody");
  if(ab){
    ab.innerHTML="";
    const archivedClues = (st.clues?.archived||[]);
    if(!archivedClues.length){
      ab.innerHTML = '<tr><td colspan="3" class="mini">No archived clues.</td></tr>';
    }else{
      archivedClues.forEach((c)=>{
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
  }

  if(typeof renderDMRequests === "function") renderDMRequests();
  if(typeof renderDMArchivedRequests === "function") renderDMArchivedRequests();
}
window.renderDM = renderDM;

function renderDMRequests(){
  if(SESSION.role !== "dm") return;
  const st = window.__STATE || {};
  const body = document.getElementById("dmReqBody");
  if(!body) return;
  const items = (st.notifications?.items || [])
    .filter(n=>isPlayerRequest(n) && !n.archived && !n.dmDeleted)
    .slice()
    .sort((a,b)=>(b.id||0)-(a.id||0));
  body.innerHTML = "";
  if(!items.length){
    body.innerHTML = '<tr><td colspan="7" class="mini">No active requests.</td></tr>';
    return;
  }
  items.forEach(n=>{
    const tr=document.createElement("tr");
    tr.innerHTML = '<td>'+n.id+'</td><td>'+esc(n.from||"")+'</td><td>'+esc(n.type||"")+'</td><td>'+esc(n.detail||"")+'</td><td></td><td></td><td></td>';
    const statusTd = tr.children[4];
    const notesTd = tr.children[5];
    const actionsTd = tr.children[6];
    statusTd.innerHTML = '<select class="input" style="min-width:120px"><option value="open">open</option><option value="pending">pending</option><option value="approved">approved</option><option value="denied">denied</option><option value="completed">completed</option></select>';
    const sel = statusTd.querySelector('select');
    sel.value = String(n.status||'open');
    notesTd.innerHTML = '<input class="input" placeholder="DM notes" style="min-width:180px" />';
    const notesInput = notesTd.querySelector('input');
    notesInput.value = n.notes || '';
    actionsTd.innerHTML = '<button class="btn smallbtn">Save</button> <button class="btn smallbtn">Approve</button> <button class="btn smallbtn">Deny</button> <button class="btn smallbtn">Archive</button>';
    const [saveBtn, approveBtn, denyBtn, archiveBtn] = actionsTd.querySelectorAll('button');

    saveBtn.onclick = async ()=>{
      n.status = sel.value || 'open';
      n.notes = notesInput.value || '';
      n.updatedAt = Date.now();
      await saveNotificationsState(st, 'Request saved');
    };
    approveBtn.onclick = async ()=>{
      n.status = 'approved';
      n.notes = notesInput.value || n.notes || '';
      n.updatedAt = Date.now();
      await saveNotificationsState(st, 'Approved');
    };
    denyBtn.onclick = async ()=>{
      n.status = 'denied';
      n.notes = notesInput.value || n.notes || '';
      n.updatedAt = Date.now();
      await saveNotificationsState(st, 'Denied');
    };
    archiveBtn.onclick = async (e)=>{
      e.preventDefault();
      e.stopPropagation();
      n.status = sel.value || n.status || 'open';
      n.notes = notesInput.value || n.notes || '';
      n.archived = true;
      n.archivedAt = Date.now();
      n.updatedAt = Date.now();
      await saveNotificationsState(st, 'Archived');
    };
    body.appendChild(tr);
  });
}
window.renderDMRequests = renderDMRequests;

function renderDMArchivedRequests(){
  if(SESSION.role !== "dm") return;
  const st = window.__STATE || {};
  const body = document.getElementById("archReqBody");
  if(!body) return;
  const archived = (st.notifications?.items || [])
    .filter(n=>isPlayerRequest(n) && !!n.archived && !n.dmDeleted)
    .slice()
    .sort((a,b)=>(b.archivedAt||0)-(a.archivedAt||0) || (b.id||0)-(a.id||0));
  body.innerHTML = "";
  if(!archived.length){
    body.innerHTML = '<tr><td colspan="7" class="mini">No archived requests.</td></tr>';
    return;
  }
  archived.forEach(n=>{
    const tr=document.createElement("tr");
    tr.innerHTML = '<td>'+n.id+'</td><td>'+esc(n.from||"")+'</td><td>'+esc(n.type||"")+'</td><td>'+esc(n.detail||"")+'</td><td>'+esc(n.status||"open")+'</td><td>'+esc(n.notes||"")+'</td><td></td>';
    const td = tr.lastChild;
    td.innerHTML = '<button class="btn smallbtn">Restore</button> <button class="btn smallbtn">Delete</button>';
    const [restoreBtn, deleteBtn] = td.querySelectorAll('button');
    restoreBtn.onclick = async ()=>{
      n.archived = false;
      delete n.archivedAt;
      n.updatedAt = Date.now();
      await saveNotificationsState(st, 'Request restored');
    };
    deleteBtn.onclick = async ()=>{
      const ok = await vwModalConfirm({
        title: 'Delete Request',
        message: 'Remove archived request #' + n.id + ' from the DM archive view only? Player request history will remain.'
      });
      if(!ok) return;
      n.dmDeleted = true;
      n.dmDeletedAt = Date.now();
      n.updatedAt = Date.now();
      await saveNotificationsState(st, 'Removed from DM archive');
    };
    body.appendChild(tr);
  });
}
window.renderDMArchivedRequests = renderDMArchivedRequests;

document.getElementById("dmNewNotifBtn")?.addEventListener("click", async ()=>{
  if(SESSION.role!=="dm") return;
  const result = await vwModalForm({
    title:"New Notification",
    fields:[
      {key:"type",label:"Type",value:"Mission Update",placeholder:"request/intel/mission/etc"},
      {key:"detail",label:"Detail",value:"",placeholder:"What is this about?", type:"textarea"},
      {key:"audience",label:"Audience",value:"players",type:"select",options:[{value:"players",label:"Players"},{value:"dm",label:"DM Only"}]},
      {key:"notes",label:"DM Notes (optional)",value:"",placeholder:"Approved, delivered next session",type:"textarea"}
    ],
    okText:"Send"
  });
  if(!result) return;
  const payload = {
    type:result.type,
    detail:result.detail,
    from:"DM",
    audience: (result.audience||"players").toLowerCase() === "dm" ? "dm" : "players",
    notes:result.notes
  };
  const res = await api("/api/notify",{method:"POST",body:JSON.stringify(payload)});
  if(res.ok){ toast("Sent"); await refreshAll(); } else toast(res.error||"Failed");
});

document.getElementById("playerNewRequestBtn")?.addEventListener("click", async ()=>{
  if(SESSION.role === "dm") return;
  const result = await vwModalForm({
    title:"New Request",
    fields:[
      {key:"type",label:"Request Type",value:"General",type:"select",options:[
        {value:"Loot Claim",label:"Loot Claim"},
        {value:"Purchase / Requisition",label:"Purchase / Requisition"},
        {value:"Action Approval",label:"Action Approval"},
        {value:"Intel Inquiry",label:"Intel Inquiry"},
        {value:"Character Correction",label:"Character Correction"},
        {value:"General",label:"General"}
      ]},
      {key:"detail",label:"Details",value:"",placeholder:"What are you asking the DM for?",type:"textarea"}
    ],
    okText:"Send Request"
  });
  if(!result || !String(result.detail||'').trim()) return;
  const payload = {
    type: result.type || 'General',
    detail: result.detail || '',
    from: SESSION.username || SESSION.name || 'Player',
    audience: 'dm',
    notes: ''
  };
  const res = await api('/api/notify',{method:'POST', body: JSON.stringify(payload)});
  if(res.ok){ toast('Request sent'); await refreshAll(); } else toast(res.error||'Failed');
});
