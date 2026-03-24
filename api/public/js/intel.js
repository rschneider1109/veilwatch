// intel.js — clue/intel rendering + actions

// Player-side filters
["intelSearch","intelTag","intelDistrict"].forEach(id=>{
  const el = document.getElementById(id);
  if(el) el.oninput = ()=>{ if(typeof renderIntelPlayer==="function") renderIntelPlayer(); };
});
const intelClear = document.getElementById("intelClearFilters");
if(intelClear) intelClear.onclick = ()=>{
  const a=document.getElementById("intelSearch"); if(a) a.value="";
  const b=document.getElementById("intelTag"); if(b) b.value="";
  const c=document.getElementById("intelDistrict"); if(c) c.value="";
  if(typeof renderIntelPlayer==="function") renderIntelPlayer();
};

function renderIntelPlayer(){
  const st = window.__STATE || {};
  const feat = (st.settings?.features) || { shop:true, intel:true };
  const dis = document.getElementById("intelDisabledMsg");
  if(dis) dis.classList.toggle("hidden", !!feat.intel);
  if(!feat.intel) return;

  const intelBody = document.getElementById("intelBody");
  const alertBody = document.getElementById("intelAlertBody");
  const recap = document.getElementById("intelRecap");
  const reqBody = document.getElementById("playerReqBody");
  if(!intelBody || !alertBody || !recap || !reqBody) return;

  if(!recap.dataset.vwInit){
    recap.innerHTML = '<p class="muted">Session recaps will appear here (DM-written).</p>';
    recap.dataset.vwInit = "1";
  }

  const q = (document.getElementById("intelSearch")?.value || "").toLowerCase().trim();
  const tag = (document.getElementById("intelTag")?.value || "").toLowerCase().trim();
  const dist = (document.getElementById("intelDistrict")?.value || "").toLowerCase().trim();

  const clueItems = Array.isArray(st.clues) ? st.clues : (st.clues?.items || st.clues?.active || []);
  const clues = (clueItems || []).filter(c=>String(c.visibility||"hidden")==="revealed");
  const dmAlerts = (st.notifications?.items || []).filter(n=>String(n.audience||"dm") === "players" && String(n.from||"") === "DM");
  const recaps = (st.sessionRecaps?.items || []).filter(r=>String(r.visibility||"players") === "players");
  const filtered = clues.filter(c=>{
    const hay = (c.title||"") + " " + (c.details||"") + " " + ((c.tags||[]).join?.(",")||"") + " " + (c.district||"");
    if(q && !hay.toLowerCase().includes(q)) return false;
    if(tag && !(c.tags||[]).some(t=>String(t).toLowerCase().includes(tag))) return false;
    if(dist && !String(c.district||"").toLowerCase().includes(dist)) return false;
    return true;
  });

  alertBody.innerHTML = "";
  if(!dmAlerts.length){
    alertBody.innerHTML = '<tr><td colspan="4" class="mini">No DM alerts yet.</td></tr>';
  }else{
    dmAlerts.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).forEach(n=>{
      const tr=document.createElement("tr");
      tr.innerHTML = "<td>"+n.id+"</td><td>"+esc(n.type||"")+"</td><td>"+esc(n.detail||"")+"</td><td>"+esc(n.notes||"")+"</td>";
      alertBody.appendChild(tr);
    });
  }

  const rec = [...recaps].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,5);
  recap.innerHTML = rec.length
    ? rec.map(r=>{
        const rid = Number(r.id||0);
        return '<div class="card" style="margin-bottom:8px;">'+
          '<button class="btn" type="button" data-recap-open="'+rid+'" style="width:100%;justify-content:space-between;text-align:left;">'+
            '<span><strong>'+esc(r.title||"Session Recap")+'</strong> <span class="badge">'+esc(r.date||"")+'</span></span>'+
            '<span class="mini">View</span>'+
          '</button>'+
        '</div>';
      }).join("")
    : '<div class="mini" style="opacity:.85">No session recaps yet.</div>';
  recap.querySelectorAll('[data-recap-open]').forEach(btn=>{
    btn.onclick = ()=>{
      const id = Number(btn.getAttribute('data-recap-open')||0);
      const item = recaps.find(r=>Number(r.id||0)===id);
      if(item) openRecapViewer(item);
    };
  });

  intelBody.innerHTML = "";
  if(!filtered.length){
    intelBody.innerHTML = '<tr><td colspan="5" class="mini">No matching revealed clues.</td></tr>';
  }else{
    filtered.sort((a,b)=>(b.revealedAt||0)-(a.revealedAt||0)).forEach(c=>{
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td>"+esc(c.title||"")+"</td>" +
        "<td>"+esc((c.tags||[]).join(", "))+"</td>" +
        "<td>"+esc(c.district||"")+"</td>" +
        "<td>"+esc(c.date||"")+"</td>" +
        "<td>"+esc(c.details||"")+"</td>";
      intelBody.appendChild(tr);
    });
  }

  // player requests (notifications from this player)
  const mine = (st.notifications?.items || []).filter(n=>String(n.from||"")===String(SESSION.username||SESSION.name||"") && String(n.audience||"dm") !== "players");
  reqBody.innerHTML = "";
  if(!mine.length){
    reqBody.innerHTML = '<tr><td colspan="5" class="mini">No requests yet.</td></tr>';
  }else{
    mine.slice().sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0) || (b.id-a.id)).forEach(n=>{
      const tr=document.createElement("tr");
      const statusText = String(n.archived ? ((n.status||"open")+" (archived)") : (n.status||"open"));
      tr.innerHTML = "<td>"+n.id+"</td><td>"+esc(n.type)+"</td><td>"+esc(n.detail)+"</td><td>"+esc(statusText)+"</td><td>"+esc(n.notes||"")+"</td>";
      reqBody.appendChild(tr);
    });
  }
}
window.renderIntelPlayer = renderIntelPlayer;

function renderIntelDM(){
  const st = window.__STATE || {};
  const feat = (st.settings?.features) || { shop:true, intel:true };
  if(!feat.intel) return;
  if(SESSION.role !== "dm") return;

  const body = document.getElementById("clueBody");
  if(!body) return;
  body.innerHTML = "";

  const items = (st.clues?.items || []);
  if(!items.length){
    body.innerHTML = '<tr><td colspan="7" class="mini">No active clues yet.</td></tr>';
    return;
  }

  items.slice().sort((a,b)=>(b.id||0)-(a.id||0)).forEach(cl=>{
    const tr=document.createElement("tr");
    tr.innerHTML =
      "<td>"+cl.id+"</td>" +
      "<td>"+esc(cl.title||"")+"</td>" +
      "<td>"+esc(cl.visibility||"hidden")+"</td>" +
      "<td>"+esc((cl.tags||[]).join(", "))+"</td>" +
      "<td>"+esc(cl.district||"")+"</td>" +
      "<td>"+esc(cl.date||"")+"</td>" +
      "<td></td>";

    const td = tr.lastChild;
    td.innerHTML =
      '<button class="btn smallbtn">Edit</button> '+
      '<button class="btn smallbtn">Reveal</button> '+
      '<button class="btn smallbtn">Hide</button> '+
      '<button class="btn smallbtn">Archive</button> <button class="btn smallbtn">Delete</button>';

    const [bEdit,bRev,bHide,bArc,bDel] = td.querySelectorAll("button");

    bEdit.onclick = async ()=>{
      const result = await vwModalForm({
        title:"Edit Clue",
        fields:[
          {key:"title",label:"Title",value:cl.title||"",placeholder:"Clue title"},
          {key:"details",label:"Details",value:cl.details||"",placeholder:"Details", type:"textarea"},
          {key:"source",label:"Source",value:cl.source||"",placeholder:"Source"},
          {key:"tags",label:"Tags (comma)",value:(cl.tags||[]).join(", "),placeholder:"tag1, tag2"},
          {key:"district",label:"District",value:cl.district||"",placeholder:"Cock & Dagger"},
          {key:"date",label:"Date",value:cl.date||"",placeholder:"YYYY-MM-DD"}
        ],
        okText:"Save"
      });
      if(!result) return;
      const payload = {
        id: cl.id,
        title: result.title,
        details: result.details,
        source: result.source,
        tags: (result.tags||"").split(",").map(s=>s.trim()).filter(Boolean),
        district: result.district,
        date: result.date
      };
      const res = await api("/api/clues/update",{method:"POST",body:JSON.stringify(payload)});
      if(res.ok){ toast("Clue saved"); await refreshAll(); } else toast(res.error||"Failed");
    };

    bRev.onclick = async ()=>{
      const res = await api("/api/clues/visibility",{method:"POST",body:JSON.stringify({id:cl.id, visibility:"revealed"})});
      if(res.ok){ toast("Revealed"); await refreshAll(); } else toast(res.error||"Failed");
    };

    bHide.onclick = async ()=>{
      const res = await api("/api/clues/visibility",{method:"POST",body:JSON.stringify({id:cl.id, visibility:"hidden"})});
      if(res.ok){ toast("Hidden"); await refreshAll(); } else toast(res.error||"Failed");
    };

    bArc.onclick = async ()=>{
      const res = await api("/api/clues/archive",{method:"POST",body:JSON.stringify({id:cl.id})});
      if(res.ok){
        toast("Archived (moved to Archived tab)");
        await refreshAll();
        const ab=document.querySelector('#dmPanels button[data-itab="archived"]');
        if(ab) ab.click();
      } else toast(res.error||"Failed");
    };

    if(bDel){
      bDel.onclick = async ()=>{
        const ok = await vwModalConfirm({
          title: "Delete Clue",
          message: 'Delete clue #' + cl.id + ' "' + (cl.title||"") + '"? This cannot be undone.'
        });
        if(!ok) return;
        const res = await api("/api/clues/delete", {method:"POST", body:JSON.stringify({id: cl.id})});
        if(res.ok){ toast("Deleted"); await refreshAll(); }
        else toast(res.error || "Failed");
      };
    }

    body.appendChild(tr);
  });
}
window.renderIntelDM = renderIntelDM;

// New clue (DM)
document.getElementById("newClueBtn")?.addEventListener("click", async ()=>{
  if(SESSION.role !== "dm") return;
  const result = await vwModalForm({
    title:"New Clue",
    fields:[
      {key:"title",label:"Title",value:"",placeholder:"Clue title"},
      {key:"details",label:"Details",value:"",placeholder:"Details",type:"textarea"},
      {key:"source",label:"Source",value:"",placeholder:"Source"},
      {key:"tags",label:"Tags (comma)",value:"",placeholder:"tag1, tag2"},
      {key:"district",label:"District",value:"",placeholder:"Cock & Dagger"},
      {key:"date",label:"Date",value:"",placeholder:"YYYY-MM-DD"}
    ],
    okText:"Create"
  });
  if(!result || !result.title) return;

  const payload = {
    title: result.title,
    details: result.details,
    source: result.source,
    tags: (result.tags||"").split(",").map(s=>s.trim()).filter(Boolean),
    district: result.district,
    date: result.date
  };
  const res = await api("/api/clues/create",{method:"POST",body:JSON.stringify(payload)});
  if(res.ok){ toast("Clue created"); await refreshAll(); }
  else toast(res.error||"Failed");
});


function openRecapViewer(recap){
  const modal = document.getElementById("vwModal");
  const titleEl = document.getElementById("vwModalTitle");
  const bodyEl = document.getElementById("vwModalBody");
  const okBtn = document.getElementById("vwModalOk");
  const cancelBtn = document.getElementById("vwModalCancel");
  if(!modal || !titleEl || !bodyEl || !okBtn || !cancelBtn) return;

  titleEl.textContent = recap.title || "Session Recap";
  bodyEl.innerHTML =
    '<div class="mini" style="margin-bottom:10px;opacity:.85">'+esc(recap.date||"")+'</div>'+
    '<div style="white-space:pre-wrap;line-height:1.5">'+esc(recap.summary||"")+'</div>';

  cancelBtn.textContent = 'Close';
  okBtn.classList.add('hidden');

  function close(){
    modal.style.display = 'none';
    okBtn.classList.remove('hidden');
    okBtn.onclick = null;
    cancelBtn.onclick = null;
    modal.onclick = null;
    if(typeof vwSetModalOpen === 'function') vwSetModalOpen(false);
  }

  cancelBtn.onclick = close;
  modal.onclick = (e)=>{ if(e.target === modal) close(); };
  if(typeof vwSetModalOpen === 'function') vwSetModalOpen(true);
  modal.style.display = 'flex';
}


function renderDMRequests(){
  if(SESSION.role !== "dm") return;
  const st = window.__STATE || {};
  const body = document.getElementById("dmReqBody");
  if(!body) return;
  const items = (st.notifications?.items || [])
    .filter(n=>String(n.from||"") !== "DM" && String(n.audience||"dm") !== "players" && !n.archived)
    .slice()
    .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0) || (b.id||0)-(a.id||0));
  body.innerHTML = "";
  if(!items.length){
    body.innerHTML = '<tr><td colspan="7" class="mini">No active player requests.</td></tr>';
    return;
  }

  const statusOpts = ["open","pending","approved","denied","completed"];
  items.forEach(n=>{
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td>'+n.id+'</td>'+
      '<td>'+esc(n.from||"")+'</td>'+
      '<td>'+esc(n.type||"")+'</td>'+
      '<td>'+esc(n.detail||"")+'</td>'+
      '<td></td>'+
      '<td></td>'+
      '<td></td>';

    const tdStatus = tr.children[4];
    const sel = document.createElement("select");
    sel.className = "input";
    sel.style.minWidth = "120px";
    statusOpts.forEach(s=>{
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      if(String(n.status||"open") === s) opt.selected = true;
      sel.appendChild(opt);
    });
    tdStatus.appendChild(sel);

    const tdNotes = tr.children[5];
    const notes = document.createElement("input");
    notes.className = "input";
    notes.value = String(n.notes||"");
    notes.placeholder = "DM notes";
    notes.style.minWidth = "180px";
    tdNotes.appendChild(notes);

    const tdActions = tr.children[6];
    tdActions.innerHTML = '<button class="btn smallbtn">Save</button> <button class="btn smallbtn">Approve</button> <button class="btn smallbtn">Deny</button> <button class="btn smallbtn">Archive</button>';
    const [saveBtn, approveBtn, denyBtn, archiveBtn] = tdActions.querySelectorAll("button");

    async function persist(msg){
      n.status = sel.value;
      n.notes = notes.value || "";
      n.updatedAt = Date.now();
      const res = await api("/api/notifications/save", {method:"POST", body:JSON.stringify({notifications: st.notifications})});
      if(res.ok){ toast(msg||"Saved"); await refreshAll(); } else toast(res.error || "Failed");
    }

    saveBtn.onclick = ()=>persist("Request saved");
    approveBtn.onclick = ()=>{ sel.value = "approved"; persist("Request approved"); };
    denyBtn.onclick = ()=>{ sel.value = "denied"; persist("Request denied"); };
    archiveBtn.onclick = async ()=>{
      n.status = sel.value;
      n.notes = notes.value || "";
      n.archived = true;
      n.archivedAt = Date.now();
      n.updatedAt = Date.now();
      const res = await api("/api/notifications/save", {method:"POST", body:JSON.stringify({notifications: st.notifications})});
      if(res.ok){
        toast("Request archived");
        await refreshAll();
        const ab=document.querySelector('#dmPanels button[data-itab="archived"]');
        if(ab) ab.click();
      } else toast(res.error || "Failed");
    };

    body.appendChild(tr);
  });
}
window.renderDMRequests = renderDMRequests;

document.getElementById("playerNewRequestBtn")?.addEventListener("click", async ()=>{
  if(SESSION.role === "dm") return;
  const result = await vwModalForm({
    title:"New Request",
    fields:[
      {key:"type",label:"Type",type:"select",value:"General",options:["Loot Claim","Purchase / Requisition","Action Approval","Intel Inquiry","Character Correction","General"]},
      {key:"detail",label:"Detail",value:"",placeholder:"What do you need from the DM?",type:"textarea"}
    ],
    okText:"Send"
  });
  if(!result || !String(result.detail||"").trim()) return;
  const payload = {
    type: result.type || "General",
    detail: result.detail || "",
    audience: "dm",
    notes: ""
  };
  const res = await api("/api/notify", {method:"POST", body:JSON.stringify(payload)});
  if(res.ok){ toast("Request sent"); await refreshAll(); } else toast(res.error || "Failed");
});

function renderDMRecaps(){
  if(SESSION.role !== "dm") return;
  const st = window.__STATE || {};
  const recapBody = document.getElementById("recapBody");
  if(!recapBody) return;
  const items = st.sessionRecaps?.items || [];
  recapBody.innerHTML = "";
  if(!items.length){
    recapBody.innerHTML = '<tr><td colspan="6" class="mini">No session recaps yet.</td></tr>';
    return;
  }
  items.slice().sort((a,b)=>(b.id||0)-(a.id||0)).forEach(r=>{
    const tr=document.createElement("tr");
    tr.innerHTML = "<td>"+r.id+"</td><td>"+esc(r.title||"")+"</td><td>"+esc(r.date||"")+"</td><td>"+esc(r.visibility||"players")+"</td><td>"+esc(r.summary||"")+"</td><td></td>";
    const td = tr.lastChild;
    const editBtn = document.createElement('button');
    editBtn.className = 'btn smallbtn';
    editBtn.textContent = 'Edit';
    editBtn.onclick = async ()=>{
      const result = await vwModalForm({
        title:"Edit Session Recap",
        fields:[
          {key:"title",label:"Title",value:r.title||"Session Recap",placeholder:"Session title"},
          {key:"date",label:"Date",value:r.date||"",placeholder:"YYYY-MM-DD"},
          {key:"summary",label:"Summary",value:r.summary||"",placeholder:"What happened?",type:"textarea"},
          {key:"visibility",label:"Visibility",value:r.visibility||"players",placeholder:"players or dm"}
        ],
        okText:"Save"
      });
      if(!result) return;
      const payload = { id:r.id, title: result.title, date: result.date, summary: result.summary, visibility: (result.visibility||"players").toLowerCase() === "dm" ? "dm" : "players" };
      const res = await api("/api/recaps/update", { method:"POST", body: JSON.stringify(payload) });
      if(res.ok){ toast("Recap saved"); await refreshAll(); } else toast(res.error || "Failed");
    };
    const delBtn = document.createElement('button');
    delBtn.className = 'btn smallbtn';
    delBtn.textContent = 'Delete';
    delBtn.onclick = async ()=>{
      const ok = await vwModalConfirm({
        title: 'Delete Session Recap',
        message: 'Delete recap #'+r.id+' "'+(r.title||'')+'"? This cannot be undone.'
      });
      if(!ok) return;
      const res = await api('/api/recaps/delete', { method:'POST', body: JSON.stringify({ id:r.id }) });
      if(res.ok){ toast('Recap deleted'); await refreshAll(); } else toast(res.error || 'Failed');
    };
    td.appendChild(editBtn);
    td.appendChild(document.createTextNode(' '));
    td.appendChild(delBtn);
    recapBody.appendChild(tr);
  });
}
window.renderDMRecaps = renderDMRecaps;

document.getElementById("dmNewRecapBtn")?.addEventListener("click", async ()=>{
  if(SESSION.role !== "dm") return;
  const result = await vwModalForm({
    title:"New Session Recap",
    fields:[
      {key:"title",label:"Title",value:"Session Recap",placeholder:"Session title"},
      {key:"date",label:"Date",value:"",placeholder:"YYYY-MM-DD"},
      {key:"summary",label:"Summary",value:"",placeholder:"What happened?",type:"textarea"},
      {key:"visibility",label:"Visibility",value:"players",placeholder:"players or dm"}
    ],
    okText:"Create"
  });
  if(!result) return;
  const payload = { title: result.title, date: result.date, summary: result.summary, visibility: (result.visibility||"players").toLowerCase() === "dm" ? "dm" : "players" };
  const res = await api("/api/recaps/create", { method:"POST", body: JSON.stringify(payload) });
  if(res.ok){ toast("Recap created"); await refreshAll(); } else toast(res.error || "Failed");
});
