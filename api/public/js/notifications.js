// notifications.js — DM notifications UI only

function renderDM(){
  if(SESSION.role!=="dm") return;
  const st=window.__STATE||{};
  const nb=document.getElementById("notifBody");
  if(!nb) return;
  nb.innerHTML="";
  (st.notifications?.items||[]).slice().sort((a,b)=>(b.id||0)-(a.id||0)).forEach(n=>{
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

  const clearBtn = document.getElementById("clearResolvedBtn");
  if(clearBtn) clearBtn.onclick=async ()=>{
    st.notifications.items = (st.notifications.items||[]).filter(x=>x.status!=="resolved");
    const res = await api("/api/notifications/save",{method:"POST",body:JSON.stringify({notifications: st.notifications})});
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
