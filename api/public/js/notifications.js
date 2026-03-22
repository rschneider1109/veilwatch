// notifications.js — DM notifications + requests UI

function saveNotificationsState(st){
  return api("/api/notifications/save",{method:"POST",body:JSON.stringify({notifications: st.notifications})});
}

function renderDM(){
  if(SESSION.role!=="dm") return;
  const st=window.__STATE||{};
  const nb=document.getElementById("notifBody");
  if(!nb) return;
  nb.innerHTML="";
  const dmAlerts = (st.notifications?.items||[]).filter(n=>String(n.from||"")==="DM");
  dmAlerts.slice().sort((a,b)=>(b.id||0)-(a.id||0)).forEach(n=>{
    const tr=document.createElement("tr");
    tr.innerHTML = '<td>'+n.id+'</td><td>'+esc(n.type)+'</td><td>'+esc(n.detail)+'</td><td>'+esc(n.from)+'</td><td>'+esc(n.status)+'</td><td>'+esc(n.notes||"")+'</td><td></td>';
    const td=tr.lastChild;
    const resolveBtn = document.createElement("button");
    resolveBtn.className = "btn smallbtn";
    resolveBtn.textContent = "Resolve";
    resolveBtn.onclick=async ()=>{
      n.status="resolved";
      const res = await saveNotificationsState(st);
      if(res.ok){ toast("Resolved"); await refreshAll(); } else toast(res.error||"Failed");
    };
    td.appendChild(resolveBtn);
    nb.appendChild(tr);
  });
  if(!dmAlerts.length){
    nb.innerHTML = '<tr><td colspan="7" class="mini">No DM notifications yet.</td></tr>';
  }

  const clearBtn = document.getElementById("clearResolvedBtn");
  if(clearBtn) clearBtn.onclick=async ()=>{
    st.notifications.items = (st.notifications.items||[]).filter(x=>!(String(x.from||"")==="DM" && x.status==="resolved"));
    const res = await saveNotificationsState(st);
    if(res.ok){ toast("Cleared"); await refreshAll(); } else toast(res.error||"Failed");
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

function renderDMRequests(){
  if(SESSION.role!=="dm") return;
  const st = window.__STATE || {};
  const body = document.getElementById("dmReqBody");
  if(!body) return;
  const requests = (st.notifications?.items||[]).filter(n=>{
    const audience = String(n.audience||"dm");
    const from = String(n.from||"");
    return audience !== "players" && from !== "DM";
  });
  body.innerHTML = "";
  if(!requests.length){
    body.innerHTML = '<tr><td colspan="7" class="mini">No player requests yet.</td></tr>';
    return;
  }
  requests.slice().sort((a,b)=>(b.id||0)-(a.id||0)).forEach(n=>{
    const tr = document.createElement("tr");
    tr.innerHTML = '<td>'+n.id+'</td><td>'+esc(n.from||"")+'</td><td>'+esc(n.type||"")+'</td><td>'+esc(n.detail||"")+'</td><td>'+esc(n.status||"open")+'</td><td>'+esc(n.notes||"")+'</td><td></td>';
    const td = tr.lastChild;

    const reviewBtn = document.createElement("button");
    reviewBtn.className = "btn smallbtn";
    reviewBtn.textContent = "Review";
    reviewBtn.onclick = async ()=>{
      const result = await vwModalForm({
        title:"Review Request #"+n.id,
        fields:[
          {key:"from",label:"Player",type:"static",value:n.from||""},
          {key:"type",label:"Type",type:"static",value:n.type||""},
          {key:"detail",label:"Request Detail",type:"textarea",value:n.detail||""},
          {key:"status",label:"Status",type:"select",value:n.status||"open",options:["open","pending","approved","denied","completed"]},
          {key:"notes",label:"DM Notes",type:"textarea",value:n.notes||"",placeholder:"Notes back to the player"}
        ],
        okText:"Save"
      });
      if(!result) return;
      n.status = result.status || n.status || "open";
      n.notes = result.notes || "";
      const res = await saveNotificationsState(st);
      if(res.ok){ toast("Request updated"); await refreshAll(); }
      else toast(res.error || "Failed");
    };

    const quickApprove = document.createElement("button");
    quickApprove.className = "btn smallbtn";
    quickApprove.textContent = "Approve";
    quickApprove.onclick = async ()=>{
      n.status = "approved";
      const res = await saveNotificationsState(st);
      if(res.ok){ toast("Approved"); await refreshAll(); } else toast(res.error || "Failed");
    };

    const quickDeny = document.createElement("button");
    quickDeny.className = "btn smallbtn";
    quickDeny.textContent = "Deny";
    quickDeny.onclick = async ()=>{
      n.status = "denied";
      const res = await saveNotificationsState(st);
      if(res.ok){ toast("Denied"); await refreshAll(); } else toast(res.error || "Failed");
    };

    td.appendChild(reviewBtn);
    td.appendChild(document.createTextNode(" "));
    td.appendChild(quickApprove);
    td.appendChild(document.createTextNode(" "));
    td.appendChild(quickDeny);
    body.appendChild(tr);
  });
}
window.renderDMRequests = renderDMRequests;

document.getElementById("dmNewNotifBtn")?.addEventListener("click", async ()=>{
  if(SESSION.role!=="dm") return;
  const result = await vwModalForm({
    title:"New Notification",
    fields:[
      {key:"type",label:"Type",value:"Mission Update",placeholder:"request/intel/mission/etc"},
      {key:"detail",label:"Detail",value:"",placeholder:"What is this about?"},
      {key:"audience",label:"Audience",type:"select",value:"players",options:["players","dm"]},
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
