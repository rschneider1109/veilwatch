// notifications.js — DM notifications UI only

function renderDM(){
  if(SESSION.role!=="dm") return;
  const st=window.__STATE||{};
  const nb=document.getElementById("notifBody");
  if(!nb) return;
  nb.innerHTML="";
  (st.notifications?.items||[]).slice().sort((a,b)=>(b.id||0)-(a.id||0)).forEach(n=>{
    const tr=document.createElement("tr");
    const audience = String(n.audience||"dm");
    const kind = String(n.kind||"notification");
    tr.innerHTML = '<td>'+n.id+'</td><td>'+esc(n.type)+'</td><td>'+esc(n.detail)+'</td><td>'+esc(n.from)+'</td><td>'+esc(audience === "players" ? "Players" : "DM")+'</td><td>'+esc(kind)+'</td><td>'+esc(n.status||"open")+'</td><td>'+esc(n.notes||"")+'</td><td></td>';
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

  const recapBody = document.getElementById("dmRecapBody");
  if(recapBody){
    recapBody.innerHTML = "";
    const recaps = (st.sessionRecaps?.items||[]).slice().sort((a,b)=>(b.id||0)-(a.id||0));
    if(!recaps.length){
      recapBody.innerHTML = '<tr><td colspan="4" class="mini">No session recaps yet.</td></tr>';
    }else{
      recaps.forEach(r=>{
        const tr=document.createElement("tr");
        tr.innerHTML = '<td>'+esc(r.id)+'</td><td>'+esc(r.title||"")+'</td><td>'+esc(r.date||"")+'</td><td></td>';
        const td=tr.lastChild;
        td.innerHTML = '<button class="btn smallbtn">Edit</button> <button class="btn smallbtn">Delete</button>';
        const [editBtn, delBtn] = td.querySelectorAll('button');
        editBtn.onclick = async ()=>{
          const result = await vwModalForm({
            title:"Edit Session Recap",
            fields:[
              {key:"title",label:"Title",value:r.title||"",placeholder:"Session 3 Recap"},
              {key:"date",label:"Date",value:r.date||"",placeholder:"YYYY-MM-DD"},
              {key:"body",label:"Body",value:r.body||"",placeholder:"Summary for players",type:"textarea"}
            ],
            okText:"Save"
          });
          if(!result) return;
          r.title = result.title || "";
          r.date = result.date || "";
          r.body = result.body || "";
          await api('/api/recaps/save',{method:'POST',body:JSON.stringify({sessionRecaps: st.sessionRecaps})});
          toast('Recap saved'); await refreshAll();
        };
        delBtn.onclick = async ()=>{
          const ok = await vwModalConfirm({ title:'Delete Recap', message:'Delete recap "'+esc(r.title||'')+'"?' });
          if(!ok) return;
          st.sessionRecaps.items = (st.sessionRecaps.items||[]).filter(x=>x.id!==r.id);
          await api('/api/recaps/save',{method:'POST',body:JSON.stringify({sessionRecaps: st.sessionRecaps})});
          toast('Deleted'); await refreshAll();
        };
        recapBody.appendChild(tr);
      });
    }
  }

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
      {key:"detail",label:"Detail",value:"",placeholder:"What is this about?", type:"textarea"},
      {key:"audience",label:"Send To",value:"players",type:"select",options:[{value:"players",label:"Players"},{value:"dm",label:"DM Only"}]},
      {key:"notes",label:"DM Notes (optional)",value:"",placeholder:"Internal notes",type:"textarea"}
    ],
    okText:"Send"
  });
  if(!result) return;
  const res = await api("/api/notify",{method:"POST",body:JSON.stringify({type:result.type, detail:result.detail, from:"DM", notes:result.notes, audience: result.audience || 'players', kind:'notification'})});
  if(res.ok){ toast("Sent"); await refreshAll(); } else toast(res.error||"Failed");
});

document.getElementById("dmNewRecapBtn")?.addEventListener("click", async ()=>{
  if(SESSION.role!=="dm") return;
  const st = window.__STATE || {};
  st.sessionRecaps ||= { nextId:1, items:[] };
  const result = await vwModalForm({
    title:"New Session Recap",
    fields:[
      {key:"title",label:"Title",value:"",placeholder:"Session 3 Recap"},
      {key:"date",label:"Date",value:"",placeholder:"YYYY-MM-DD"},
      {key:"body",label:"Body",value:"",placeholder:"Summary for players",type:"textarea"}
    ],
    okText:"Save"
  });
  if(!result) return;
  const id = Number(st.sessionRecaps.nextId || 1);
  st.sessionRecaps.nextId = id + 1;
  st.sessionRecaps.items.push({ id, title: result.title || '', date: result.date || '', body: result.body || '', createdAt: Date.now() });
  const res = await api('/api/recaps/save',{method:'POST',body:JSON.stringify({sessionRecaps: st.sessionRecaps})});
  if(res.ok){ toast('Recap saved'); await refreshAll(); } else toast(res.error||'Failed');
});
