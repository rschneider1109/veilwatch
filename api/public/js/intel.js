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
  const recap = document.getElementById("intelRecap");
  const reqBody = document.getElementById("playerReqBody");
  if(!intelBody || !recap || !reqBody) return;

  // Session Recaps (player) — DM-written only (no auto event feed)
  if(!recap.dataset.vwInit){
    recap.innerHTML = '<p class="muted">Session recaps will appear here (DM-written). Clue reveals won&#39;t spam this panel.</p>';
    recap.dataset.vwInit = "1";
  }

  const q = (document.getElementById("intelSearch")?.value || "").toLowerCase().trim();
  const tag = (document.getElementById("intelTag")?.value || "").toLowerCase().trim();
  const dist = (document.getElementById("intelDistrict")?.value || "").toLowerCase().trim();

  const clueItems = Array.isArray(st.clues) ? st.clues : (st.clues?.items || st.clues?.active || []);
  const clues = (clueItems || []).filter(c=>String(c.visibility||"hidden")==="revealed");
  const filtered = clues.filter(c=>{
    const hay = (c.title||"") + " " + (c.details||"") + " " + ((c.tags||[]).join?.(",")||"") + " " + (c.district||"");
    if(q && !hay.toLowerCase().includes(q)) return false;
    if(tag && !(c.tags||[]).some(t=>String(t).toLowerCase().includes(tag))) return false;
    if(dist && !String(c.district||"").toLowerCase().includes(dist)) return false;
    return true;
  });

  // recap: last 5 by revealedAt
  const rec = [...clues].sort((a,b)=>(b.revealedAt||0)-(a.revealedAt||0)).slice(0,5);
  recap.innerHTML = rec.length
    ? rec.map(c=>'<div>• <b>'+esc(c.title||"Clue")+'</b> <span class="badge">'+esc(c.district||"")+'</span></div>').join("")
    : '<div class="mini" style="opacity:.85">No revealed clues yet.</div>';

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
  const mine = (st.notifications?.items || []).filter(n=>String(n.from||"")===String(SESSION.username||SESSION.name||""));
  reqBody.innerHTML = "";
  if(!mine.length){
    reqBody.innerHTML = '<tr><td colspan="5" class="mini">No requests yet.</td></tr>';
  }else{
    mine.slice().sort((a,b)=>b.id-a.id).forEach(n=>{
      const tr=document.createElement("tr");
      tr.innerHTML = "<td>"+n.id+"</td><td>"+esc(n.type)+"</td><td>"+esc(n.detail)+"</td><td>"+esc(n.status)+"</td><td>"+esc(n.notes||"")+"</td>";
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
