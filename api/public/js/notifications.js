// notifications.js — DM notifications UI + archived request rendering

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
      tr.innerHTML = '<td>'+n.id+'</td><td>'+esc(n.type)+'</td><td>'+esc(n.detail)+'</td><td>'+esc(n.from)+'</td><td>'+esc(n.status)+'</td><td>'+esc(n.notes||"")+'</td><td></td>';
      const td=tr.lastChild;
      td.innerHTML = '<button class="btn smallbtn">Resolve</button>';
      td.querySelector("button").onclick=async ()=>{
        n.status="resolved";
        const res = await api("/api/notifications/save",{method:"POST",body:JSON.stringify({notifications: st.notifications})});
        if(res.ok){ toast("Resolved"); await refreshAll(); } else toast(res.error||"Failed");
      };
      nb.appendChild(tr);
    });
  }

  const clearBtn = document.getElementById("clearResolvedBtn");
  if(clearBtn) clearBtn.onclick=async ()=>{
    st.notifications.items = (st.notifications.items||[]).filter(x=>!(isDmAlert(x) && x.status==="resolved" && !x.archived));
    const res = await api("/api/notifications/save",{method:"POST",body:JSON.stringify({notifications: st.notifications})});
    if(res.ok){ toast("Cleared"); await refreshAll(); } else toast(res.error||"Failed");
  };

  const ab=document.getElementById("archBody");
  if(!ab) return;
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
  if(typeof renderDMArchivedRequests === "function") renderDMArchivedRequests();
}
window.renderDM = renderDM;

function renderDMArchivedRequests(){
  if(SESSION.role !== "dm") return;
  const st = window.__STATE || {};
  const body = document.getElementById("archReqBody");
  if(!body) return;
  const archived = (st.notifications?.items || [])
    .filter(n=>isPlayerRequest(n) && !!n.archived)
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
    td.innerHTML = '<button class="btn smallbtn">Restore</button>';
    td.querySelector('button').onclick = async ()=>{
      n.archived = false;
      delete n.archivedAt;
      const res = await api("/api/notifications/save",{method:"POST",body:JSON.stringify({notifications: st.notifications})});
      if(res.ok){ toast("Request restored"); await refreshAll(); } else toast(res.error||"Failed");
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
      {key:"detail",label:"Detail",value:"",placeholder:"What is this about?"},
      {key:"audience",label:"Audience",value:"players",placeholder:"players or dm"},
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
