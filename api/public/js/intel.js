// Intel filters (player)
["intelSearch","intelTag","intelDistrict"].forEach(id=>{
  const el=document.getElementById(id);
  if(el) el.oninput=()=>renderIntelPlayer();
});
const intelClear=document.getElementById("intelClearFilters");
if(intelClear) intelClear.onclick=()=>{
  document.getElementById("intelSearch").value="";
  document.getElementById("intelTag").value="";
  document.getElementById("intelDistrict").value="";
  renderIntelPlayer();
};

async function refreshAll(){
  const st = await api("/api/state");
  window.__STATE = st;
  // intel indicator baseline
  if(window.VW_INTEL_UNSEEN && !window.VW_INTEL_UNSEEN.armed){ vwSyncSeenBaseline(); window.VW_INTEL_UNSEEN.armed = true; }
  else { if(typeof vwComputeUnseen==='function') vwComputeUnseen(); }
  if(typeof vwStartStream==="function" && SESSION && SESSION.role) vwStartStream();
    if(typeof vwStartFallbackPoller==="function") vwStartFallbackPoller();
  // characters
  const sel=document.getElementById("charSel");
  sel.innerHTML = "";
  (st.characters||[]).forEach(c=>{
    const o=document.createElement("option"); o.value=c.id; o.textContent=c.name;
    sel.appendChild(o);
  });
  if(!SESSION.activeCharId && st.characters?.length) SESSION.activeCharId = st.characters[0].id;
  if(SESSION.activeCharId){
    sel.value = SESSION.activeCharId;
  }
  sel.onchange=()=>{ SESSION.activeCharId=sel.value; renderCharacter(); };
  document.getElementById("activeCharMini").textContent = SESSION.activeCharId ? (st.characters.find(c=>c.id===SESSION.activeCharId)?.name || "Unknown") : "None selected";
  // shop
  renderShop();
  // DM panels
  renderDM();
  if(typeof renderIntelDM==='function') renderIntelDM();
  if(typeof renderIntelPlayer==='function') renderIntelPlayer();
  renderCharacter();
  if(typeof renderSheet==='function') renderSheet();
  if(typeof renderSettings==='function') renderSettings();
}

function getChar(){
  const st=window.__STATE||{};
  return (st.characters||[]).find(c=>c.id===SESSION.activeCharId);
}
function renderCharacter(){
  const c=getChar();
  const weapBody=document.getElementById("weapBody");
  const invBody=document.getElementById("invBody");
  weapBody.innerHTML=""; invBody.innerHTML="";
  if(!c){
    weapBody.innerHTML = '<tr><td colspan="5" class="mini">No character. Click New Character.</td></tr>';
    invBody.innerHTML = '<tr><td colspan="7" class="mini">No character.</td></tr>';
    return;
  }
  // weapons rows
  (c.weapons||[]).forEach(w=>{
    const tr=document.createElement("tr");
    tr.innerHTML = '<td>'+esc(w.name)+'</td><td>'+esc(w.range||"")+'</td><td>'+esc(w.hit||"")+'</td><td>'+esc(w.damage||"")+'</td><td><button class="btn smallbtn">Remove</button></td>';
    tr.querySelector("button").onclick=async ()=>{
      c.weapons = c.weapons.filter(x=>x.id!==w.id);
      await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
      toast("Removed weapon"); await refreshAll();
    };
    weapBody.appendChild(tr);
    if(w.ammo){
      const tr2=document.createElement("tr");
      tr2.innerHTML = '<td colspan="5" class="mini">Ammo: '+esc(w.ammo.type)+' | Starting '+esc(w.ammo.starting)+' | Current '+esc(w.ammo.current)+' | Mags '+esc(w.ammo.mags||"—")+'</td>';
      weapBody.appendChild(tr2);
    }
  });
  // inventory rows
  (c.inventory||[]).forEach((it,idx)=>{
    const tr=document.createElement("tr");
    tr.innerHTML =
      '<td><input class="input" value="'+esc(it.category||"")+'" data-k="category"/></td>'+
      '<td><input class="input" value="'+esc(it.name||"")+'" data-k="name"/></td>'+
      '<td><input class="input" value="'+esc(it.weight||"")+'" data-k="weight"/></td>'+
      '<td><input class="input" value="'+esc(it.qty||"")+'" data-k="qty"/></td>'+
      '<td><input class="input" value="'+esc(it.cost||"")+'" data-k="cost"/></td>'+
      '<td><input class="input" value="'+esc(it.notes||"")+'" data-k="notes"/></td>'+
      '<td><button class="btn smallbtn">Del</button></td>';
    tr.querySelectorAll("input").forEach(inp=>{
      inp.onchange=async ()=>{
        const k=inp.dataset.k;
        c.inventory[idx][k]=inp.value;
        await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
        document.getElementById("saveMini").textContent="Saved";
      };
    });
    tr.querySelector('button').onclick = async ()=>{
      c.inventory.splice(idx,1);
      await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
      toast("Removed item"); await refreshAll();
    };
    invBody.appendChild(tr);
  });
}

const CONDITIONS = ["bleeding","blinded","charmed","deafened","frightened","grappled","incapacitated","invisible","paralyzed","poisoned","prone","restrained","stunned","unconscious","exhaustion"];

function renderSheet(){
  const sheetHost = document.getElementById("sheetHost") || document.getElementById("sheet") || document.getElementById("sheetPanel");
  if(!sheetHost) return;
  const c=getChar();
  if(!c) return;

  c.sheet ||= {};
  c.sheet.vitals ||= { hpCur:"", hpMax:"", hpTemp:"", ac:"", init:"", speed:"" };
  c.sheet.money  ||= { cash:"", bank:"" };
  c.sheet.stats  ||= { STR:"",DEX:"",CON:"",INT:"",WIS:"",CHA:"" };
  c.sheet.conditions ||= [];
  c.sheet.notes ||= "";

  const v=c.sheet.vitals;
  document.getElementById("hpCur").value = v.hpCur ?? "";
  document.getElementById("hpMax").value = v.hpMax ?? "";
  document.getElementById("hpTemp").value = v.hpTemp ?? "";
  document.getElementById("acVal").value = v.ac ?? "";
  document.getElementById("initVal").value = v.init ?? "";
  document.getElementById("spdVal").value = v.speed ?? "";

  document.getElementById("cashVal").value = (c.sheet.money.cash ?? "");
  document.getElementById("bankVal").value = (c.sheet.money.bank ?? "");

  document.getElementById("statSTR").value = (c.sheet.stats.STR ?? "");
  document.getElementById("statDEX").value = (c.sheet.stats.DEX ?? "");
  document.getElementById("statCON").value = (c.sheet.stats.CON ?? "");
  document.getElementById("statINT").value = (c.sheet.stats.INT ?? "");
  document.getElementById("statWIS").value = (c.sheet.stats.WIS ?? "");
  document.getElementById("statCHA").value = (c.sheet.stats.CHA ?? "");

  document.getElementById("notesBio").value = (c.sheet.notes ?? "");

  // conditions
  const row=document.getElementById("condRow");
  row.innerHTML="";
  const active = new Set((c.sheet.conditions||[]).map(x=>String(x).toLowerCase()));
  CONDITIONS.forEach(name=>{
    const id="cond_"+name;
    const lab=document.createElement("label");
    lab.className="row";
    lab.style.gap="6px";
    lab.innerHTML = '<input type="checkbox" id="'+id+'"/> <span class="mini">'+name+'</span>';
    const cb=lab.querySelector("input");
    cb.checked = active.has(name);
    cb.onchange=()=>{
      if(cb.checked) active.add(name); else active.delete(name);
      c.sheet.conditions = Array.from(active);
    };
    row.appendChild(lab);
  });

  // DM-only buttons
  document.getElementById("dupCharBtn").classList.toggle("hidden", SESSION.role!=="dm");
  document.getElementById("delCharBtn").classList.toggle("hidden", SESSION.role!=="dm");
}
window.renderSheet = renderSheet;

document.getElementById("saveSheetBtn").onclick = async ()=>{
  const c=getChar(); if(!c){ toast("No character"); return; }
  c.sheet ||= {};
  c.sheet.vitals = {
    hpCur: document.getElementById("hpCur").value.trim(),
    hpMax: document.getElementById("hpMax").value.trim(),
    hpTemp: document.getElementById("hpTemp").value.trim(),
    ac: document.getElementById("acVal").value.trim(),
    init: document.getElementById("initVal").value.trim(),
    speed: document.getElementById("spdVal").value.trim()
  };
  c.sheet.money = {
    cash: document.getElementById("cashVal").value.trim(),
    bank: document.getElementById("bankVal").value.trim()
  };
  c.sheet.stats = {
    STR: document.getElementById("statSTR").value.trim(),
    DEX: document.getElementById("statDEX").value.trim(),
    CON: document.getElementById("statCON").value.trim(),
    INT: document.getElementById("statINT").value.trim(),
    WIS: document.getElementById("statWIS").value.trim(),
    CHA: document.getElementById("statCHA").value.trim()
  };
  c.sheet.notes = document.getElementById("notesBio").value;
  await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
  toast("Sheet saved"); await refreshAll();
};

document.getElementById("dupCharBtn").onclick = async ()=>{
  if(SESSION.role!=="dm") return;
  const c=getChar(); if(!c) return;
  const name = await vwModalInput({ title:"Duplicate Character", label:"New name", value: c.name + " (Copy)" });
  if(!name) return;
  const res = await api("/api/character/duplicate",{method:"POST",body:JSON.stringify({charId:c.id, name})});
  if(res.ok){ SESSION.activeCharId=res.id; toast("Duplicated"); await refreshAll(); }
  else toast(res.error||"Failed");
};

document.getElementById("delCharBtn").onclick = async ()=>{
  if(SESSION.role!=="dm") return;
  const c=getChar(); if(!c) return;
  const ok = await vwModalConfirm({ title:"Delete Character", message:'Delete "' + c.name + '"? This cannot be undone.' });
  if(!ok) return;
  const res = await api("/api/character/delete",{method:"POST",body:JSON.stringify({charId:c.id})});
  if(res.ok){ SESSION.activeCharId=null; toast("Deleted"); await refreshAll(); }
  else toast(res.error||"Failed");
};

function renderIntelPlayer(){
  const st=window.__STATE||{};
  const feat=(st.settings?.features)||{shop:true,intel:true};
  const dis=document.getElementById("intelDisabledMsg");
  if(dis) dis.classList.toggle("hidden", !!feat.intel);
  if(!feat.intel) return;
  const intelBody=document.getElementById("intelBody");
  const recap=document.getElementById("intelRecap");
  const reqBody=document.getElementById("playerReqBody");
  if(!intelBody || !recap || !reqBody) return;
  

// Session Recaps (player) — DM-written only (no auto event feed)
recap.innerHTML =
  '<div class="row"><div class="pill">Session Recaps</div><div class="mini">DM-written summaries only.</div></div>' +
  '<p class="muted">No recaps yet.</p>';

if(!recap.dataset.vwInit){
    recap.innerHTML = '<p class="muted">Session recaps will appear here (DM-written). Clue reveals won\'t spam this panel.</p>';
    recap.dataset.vwInit = "1";
  }

  const q=(document.getElementById("intelSearch").value||"").toLowerCase().trim();
  const tag=(document.getElementById("intelTag").value||"").toLowerCase().trim();
  const dist=(document.getElementById("intelDistrict").value||"").toLowerCase().trim();

  const clueItems = Array.isArray(st.clues) ? st.clues : (st.clues?.items || st.clues?.active || []);
  const clues = (clueItems||[]).filter(c=>String(c.visibility||"hidden")==="revealed");
  const filtered = clues.filter(c=>{
    const hay = (c.title||"")+" "+(c.details||"")+" "+(c.tags||"").join?.(",")+" "+(c.district||"");
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

  intelBody.innerHTML="";
  if(!filtered.length){
    intelBody.innerHTML = '<tr><td colspan="5" class="mini">No matching revealed clues.</td></tr>';
  } else {
    filtered.sort((a,b)=>(b.revealedAt||0)-(a.revealedAt||0)).forEach(c=>{
      const tr=document.createElement("tr");
      tr.innerHTML =
        '<td>'+esc(c.title||"")+'</td>'+
        '<td>'+esc((c.tags||[]).join(", "))+'</td>'+
        '<td>'+esc(c.district||"")+'</td>'+
        '<td>'+esc(c.date||"")+'</td>'+
        '<td>'+esc(c.details||"")+'</td>';
      intelBody.appendChild(tr);
    });
  }

  // player requests (notifications from this player)
  const mine = (st.notifications?.items||[]).filter(n=>String(n.from||"")===String(SESSION.name||""));
  reqBody.innerHTML="";
  if(!mine.length){
    reqBody.innerHTML = '<tr><td colspan="5" class="mini">No requests yet.</td></tr>';
  } else {
    mine.slice().sort((a,b)=>b.id-a.id).forEach(n=>{
      const tr=document.createElement("tr");
      tr.innerHTML = '<td>'+n.id+'</td><td>'+esc(n.type)+'</td><td>'+esc(n.detail)+'</td><td>'+esc(n.status)+'</td><td>'+esc(n.notes||"")+'</td>';
      reqBody.appendChild(tr);
    });
  }
}
window.renderIntelPlayer = renderIntelPlayer;


function renderIntelDM(){
  const st=window.__STATE||{};
  const feat=(st.settings?.features)||{shop:true,intel:true};
  if(!feat.intel) return;
  if(SESSION.role!=="dm") return;
  const body=document.getElementById("clueBody");
  if(!body) return;
  body.innerHTML="";
  const items = (st.clues?.items||[]);
  if(!items.length){
    body.innerHTML = '<tr><td colspan="7" class="mini">No active clues yet.</td></tr>';
    return;
  }
  items.slice().sort((a,b)=>(b.id||0)-(a.id||0)).forEach(cl=>{
    const tr=document.createElement("tr");
    tr.innerHTML =
      '<td>'+cl.id+'</td>'+
      '<td>'+esc(cl.title||"")+'</td>'+
      '<td>'+esc(cl.visibility||"hidden")+'</td>'+
      '<td>'+esc((cl.tags||[]).join(", "))+'</td>'+
      '<td>'+esc(cl.district||"")+'</td>'+
      '<td>'+esc(cl.date||"")+'</td>'+
      '<td></td>';
    const td=tr.lastChild;
    td.innerHTML =
      '<button class="btn smallbtn">Edit</button> '+
      '<button class="btn smallbtn">Reveal</button> '+
      '<button class="btn smallbtn">Hide</button> '+
      '<button class="btn smallbtn">Archive</button> <button class="btn smallbtn">Delete</button>';
    const [bEdit,bRev,bHide,bArc,bDel]=td.querySelectorAll("button");

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
      if(res.ok){ toast("Archived (moved to Archived tab)"); await refreshAll();
        const ab=document.querySelector('#dmPanels button[data-itab="archived"]'); if(ab) ab.click();
      } else toast(res.error||"Failed");
    };

bDel && (bDel.onclick = async ()=>{
  const ok = await vwModalConfirm({
    title: "Delete Clue",
    message: 'Delete clue #' + cl.id + ' "' + (cl.title||"") + '"? This cannot be undone.'
  });
  if(!ok) return;
  const res = await api("/api/clues/delete", {method:"POST", body:JSON.stringify({id: cl.id})});
  if(res.ok){ toast("Deleted"); await refreshAll(); }
  else toast(res.error || "Failed");
});

    body.appendChild(tr);
  });
}
window.renderIntelDM = renderIntelDM;

document.getElementById("addInvBtn").onclick=async ()=>{
  const c=getChar(); if(!c){ toast("Create character first"); return; }
  c.inventory ||= [];
  c.inventory.push({category:"",name:"",weight:"",qty:"1",cost:"",notes:""});
  await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
  toast("Added inventory row"); await refreshAll();
};

document.getElementById("newCharBtn").onclick = async () => {
  const name = await vwModalInput({
    title: "New Character",
    label: "Character name",
    placeholder: "e.g. Mara Kincaid"
  });
  if (!name) return;

  const res = await api("/api/character/new", {
    method: "POST",
    body: JSON.stringify({ name })
  });

  if (res.ok) {
    SESSION.activeCharId = res.id;
    toast("Character created");
    await refreshAll();
    if(typeof vwStartStream==="function" && SESSION && SESSION.role) vwStartStream();
    if(typeof vwStartFallbackPoller==="function") vwStartFallbackPoller();
  } else {
    toast(res.error || "Failed to create character");
  }
};



document.getElementById("newClueBtn")?.addEventListener("click", async ()=>{
  if(SESSION.role!=="dm") return;
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
  if(res.ok){ toast("Clue created"); await refreshAll(); } else toast(res.error||"Failed");
});

