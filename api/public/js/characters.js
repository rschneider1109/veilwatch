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


// --- Autosave (discord-like live updates) ---
let __vwCharSaveTimer = null;
let __vwCharSaveInFlight = false;
let __vwCharSaveQueued = false;
let __vwCharLastSaveAt = 0;

function vwSetSaveMini(text){
  const el = document.getElementById("saveMini");
  if(el) el.textContent = text;
}

async function vwFlushCharAutosave(){
  const c = (typeof getChar==="function") ? getChar() : null;
  if(!c || !c.id) return;

  if(__vwCharSaveInFlight){ __vwCharSaveQueued = true; return; }
  __vwCharSaveInFlight = true;
  __vwCharSaveQueued = false;

  try{
    const patch = { sheet: c.sheet };
    const res = await api("/api/character/patch", { method:"POST", body: JSON.stringify({ charId: c.id, patch }) });
    if(res && res.ok){
      __vwCharLastSaveAt = Date.now();
      vwSetSaveMini("Saved " + new Date(__vwCharLastSaveAt).toLocaleTimeString());
    }else{
      vwSetSaveMini("Save error");
    }
  }catch(e){
    vwSetSaveMini("Save error");
  }finally{
    __vwCharSaveInFlight = false;
    if(__vwCharSaveQueued) vwFlushCharAutosave();
  }
}

function vwScheduleCharAutosave(){
  const c = (typeof getChar==="function") ? getChar() : null;
  if(!c || !c.id) return;

  vwSetSaveMini("Saving...");
  try{ clearTimeout(__vwCharSaveTimer); }catch(e){}
  __vwCharSaveTimer = setTimeout(()=>{ vwFlushCharAutosave(); }, 650);
}

// One-time wiring for sheet inputs. These fields exist in both Home quick-sheet and Character sheet.
let __vwSheetWired = false;
function vwWireSheetAutosave(){
  if(__vwSheetWired) return;
  __vwSheetWired = true;

  const map = [
    ["hpCur",  ["vitals","hpCur"]],
    ["hpMax",  ["vitals","hpMax"]],
    ["hpTemp", ["vitals","hpTemp"]],
    ["acVal",  ["vitals","ac"]],
    ["initVal",["vitals","init"]],
    ["spdVal", ["vitals","speed"]],
    ["cashVal",["money","cash"]],
    ["bankVal",["money","bank"]],
    ["statSTR",["stats","STR"]],
    ["statDEX",["stats","DEX"]],
    ["statCON",["stats","CON"]],
    ["statINT",["stats","INT"]],
    ["statWIS",["stats","WIS"]],
    ["statCHA",["stats","CHA"]],
    ["notesBio",["notes"]]
  ];

  function ensureSheet(c){
    c.sheet ||= {};
    c.sheet.vitals ||= { hpCur:"", hpMax:"", hpTemp:"", ac:"", init:"", speed:"" };
    c.sheet.money  ||= { cash:"", bank:"" };
    c.sheet.stats  ||= { STR:"",DEX:"",CON:"",INT:"",WIS:"",CHA:"" };
    c.sheet.conditions ||= [];
    if(typeof c.sheet.notes !== "string") c.sheet.notes = String(c.sheet.notes||"");
  }

  function setPath(c, pathArr, value){
    if(pathArr.length===1){
      c.sheet[pathArr[0]] = value;
      return;
    }
    const [root, key] = pathArr;
    c.sheet[root] ||= {};
    c.sheet[root][key] = value;
  }

  map.forEach(([id, pathArr])=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener("input", ()=>{
      const c = getChar(); if(!c) return;
      ensureSheet(c);
      setPath(c, pathArr, el.value);
      vwScheduleCharAutosave();
    });
  });
}

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
      if(typeof vwScheduleCharAutosave==="function") vwScheduleCharAutosave();
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
  if(typeof vwFlushCharAutosave==="function") await vwFlushCharAutosave();
  toast("Saved");
  await refreshAll();
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



// --- DM Active Party (Home screen) ---
function renderDMActiveParty(){
  const panel=document.getElementById("dmActivePartyPanel");
  if(!panel) return;

  panel.classList.toggle("hidden", SESSION.role!=="dm");
  if(SESSION.role!=="dm") return;

  const st = window.__STATE || {};
  const chars = Array.isArray(st.characters) ? st.characters : [];
  const active = Array.isArray(st.activeParty) ? st.activeParty : [];

  // Populate add dropdown
  const addSel = document.getElementById("dmActiveAddSel");
  if(addSel){
    const opts = ['<option value="">Select character…</option>']
      .concat(chars.map(c=>'<option value="'+String(c.id).replace(/"/g,'&quot;')+'">'+esc(c.name)+'</option>'));
    addSel.innerHTML = opts.join("");
  }

  const cardsHost = document.getElementById("dmActivePartyCards");
  if(!cardsHost) return;

  if(active.length===0){
    cardsHost.innerHTML = '<div class="card" style="grid-column:span 12;"><div class="mini">No active characters yet.</div></div>';
    return;
  }

  cardsHost.innerHTML = "";
  active.forEach(entry=>{
    const c = chars.find(x=>x.id===entry.charId);
    if(!c) return;

    const v = (c.sheet && c.sheet.vitals) ? c.sheet.vitals : {};
    const s = (c.sheet && c.sheet.stats) ? c.sheet.stats : {};
    const hp = (v.hpCur||"") + "/" + (v.hpMax||"");
    const ac = (v.ac||"");
    const init = (entry.initiative===0 || entry.initiative) ? entry.initiative : "";

    const card = document.createElement("div");
    card.className = "card";
    card.style.gridColumn = "span 4";

    card.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px;">
        <div>
          <div style="font-weight:700;">${esc(c.name)}</div>
          <div class="mini">${esc(entry.playerLabel||"")}</div>
        </div>
        <button class="btn smallbtn" data-act="open">Open Sheet</button>
      </div>
      <hr/>
      <div class="row" style="gap:10px;flex-wrap:wrap;">
        <div class="pill">HP: ${esc(hp)}</div>
        <div class="pill">AC: ${esc(ac)}</div>
        <div style="min-width:120px;">
          <div class="mini" style="margin-bottom:6px;">Init</div>
          <input class="input" data-act="init" value="${String(init).replace(/"/g,'&quot;')}" placeholder="--" style="width:120px;"/>
        </div>
      </div>
      <div class="grid" style="grid-template-columns:repeat(6,1fr);gap:8px;margin-top:10px;">
        <div class="pill">STR ${esc(s.STR||"")}</div>
        <div class="pill">DEX ${esc(s.DEX||"")}</div>
        <div class="pill">CON ${esc(s.CON||"")}</div>
        <div class="pill">INT ${esc(s.INT||"")}</div>
        <div class="pill">WIS ${esc(s.WIS||"")}</div>
        <div class="pill">CHA ${esc(s.CHA||"")}</div>
      </div>
      <div class="row" style="margin-top:10px;justify-content:space-between;">
        <button class="btn smallbtn" data-act="remove">Remove</button>
      </div>
    `;

    const btnOpen = card.querySelector('button[data-act="open"]');
    btnOpen.onclick = async ()=>{
      SESSION.activeCharId = c.id;
      // Jump to Character tab + Sheet
      document.querySelectorAll(".nav .btn").forEach(b=>b.classList.toggle("active", b.dataset.tab==="character"));
      document.querySelectorAll("main section").forEach(sec=>sec.classList.toggle("hidden", sec.id!=="tab-character"));
      // Switch character sub-tab to sheet
      document.querySelectorAll('[data-ctab]').forEach(b=>b.classList.toggle("active", b.dataset.ctab==="sheet"));
      document.getElementById("ctab-actions").classList.toggle("hidden", true);
      document.getElementById("ctab-inventory").classList.toggle("hidden", true);
      document.getElementById("ctab-sheet").classList.toggle("hidden", false);
      await refreshAll();
    };

    const initEl = card.querySelector('input[data-act="init"]');
    initEl.onchange = async ()=>{
      const res = await api("/api/dm/activeParty/initiative", { method:"POST", body: JSON.stringify({ charId: c.id, initiative: initEl.value })});
      if(!res.ok) toast(res.error||"Failed");
    };

    const btnRemove = card.querySelector('button[data-act="remove"]');
    btnRemove.onclick = async ()=>{
      const res = await api("/api/dm/activeParty/remove", { method:"POST", body: JSON.stringify({ charId: c.id })});
      if(res.ok) await refreshAll();
      else toast(res.error||"Failed");
    };

    cardsHost.appendChild(card);
  });
}

(async function wireDmActivePartyButtons(){
  try{
    const addBtn = document.getElementById("dmActiveAddBtn");
    const clearBtn = document.getElementById("dmActiveClearBtn");

    if(addBtn){
      addBtn.onclick = async ()=>{
        if(SESSION.role!=="dm") return;
        const sel = document.getElementById("dmActiveAddSel");
        const labelEl = document.getElementById("dmActivePlayerLabel");
        const charId = sel ? sel.value : "";
        if(!charId){ toast("Pick a character"); return; }
        const playerLabel = labelEl ? labelEl.value : "";
        const res = await api("/api/dm/activeParty/add",{method:"POST",body:JSON.stringify({charId, playerLabel})});
        if(res.ok){ if(labelEl) labelEl.value=""; await refreshAll(); }
        else toast(res.error||"Failed");
      };
    }

    if(clearBtn){
      clearBtn.onclick = async ()=>{
        if(SESSION.role!=="dm") return;
        const ok = await vwModalConfirm({ title:"Clear Active", message:"Remove all active characters?" });
        if(!ok) return;
        const st = window.__STATE || {};
        const active = Array.isArray(st.activeParty) ? st.activeParty : [];
        for(const e of active){
          await api("/api/dm/activeParty/remove",{method:"POST",body:JSON.stringify({charId:e.charId})});
        }
        await refreshAll();
      };
    }
  }catch(e){}
})();

// --- Import Player (DM) ---
(async function wireImportPlayer(){
  try{
    const btn = document.getElementById("importPlayerBtn");
    if(!btn) return;
    btn.onclick = async ()=>{
      if(SESSION.role!=="dm") return;
      const name = await vwModalInput({ title:"Import Player", label:"Character name", placeholder:"e.g., Mara Kincaid" });
      if(!name) return;

      const usersRes = await api("/api/dm/users");
      const all = (usersRes && usersRes.ok && Array.isArray(usersRes.users)) ? usersRes.users : [];
      const playerNames = all.filter(u=>u.role!=="dm").map(u=>u.username).sort();
      const tip = playerNames.length ? ("Available players: " + playerNames.join(", ")) : "No player accounts yet (leave blank).";
      const ownerName = await vwModalInput({ title:"Assign Account", label:"Assign to username (optional)", placeholder: tip });
      let ownerUserId = null;
      if(ownerName && ownerName.trim()){
        const found = all.find(u => String(u.username).toLowerCase() === String(ownerName).trim().toLowerCase());
        if(!found){ toast("User not found"); return; }
        ownerUserId = found.id;
      }

      const created = await api("/api/character/new",{method:"POST",body:JSON.stringify({name, ownerUserId})});
      if(!created.ok){ toast(created.error||"Failed"); return; }

      const add = await vwModalConfirm({ title:"Add to Active?", message:"Add this character to the Active list?" });
      if(add){
        await api("/api/dm/activeParty/add",{method:"POST",body:JSON.stringify({charId: created.id, playerLabel: ownerName||""})});
      }

      SESSION.activeCharId = created.id;
      toast("Imported");
      await refreshAll();
    };
  }catch(e){}
})();

// Wire autosave inputs once the DOM exists.
try{ vwWireSheetAutosave(); }catch(e){}
