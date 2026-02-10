
/** 
 * Add Inventory Item (dropdown)
 * Uses catalog inventoryItemsByCategory if available; otherwise falls back to manual entry.
 */
async function vwAddInventoryItemDropdown() {
  const c = getChar();
  if (!c) return toast("Create/select a character first");

  const cat = (window.vwGetCatalog ? window.vwGetCatalog() : (window.VW_CHAR_CATALOG || window.VEILWATCH_CATALOG));
  const groups =
    cat?.inventoryItemsByCategory ||
    cat?.inventory_items_by_category ||
    cat?.inventoryByCategory ||
    null;

  const categories = groups ? Object.keys(groups) : ["General"];
  const safeCats = categories.length ? categories : ["General"];

  if (typeof vwModalForm !== "function") {
    // hard fallback: just add an empty row
    c.inventory = c.inventory || [];
    c.inventory.push({ category:"", name:"", qty:"1", notes:"" });
    await saveChar(c);
    await refreshAll?.();
    return;
  }

  // Step 1: choose category
  const step1 = await vwModalForm({
    title: "Add Inventory Item",
    okText: "Next",
    fields: [
      { key:"category", label:"Category", type:"select", options: safeCats.map(x=>({ value:x, label:x })) }
    ]
  });
  if (!step1) return;

  const items = groups ? (groups[step1.category] || []) : [];
  const itemOptions = items.length ? items.map(n=>({ value:n, label:n })) : [{ value:"", label:"(type item name)" }];

  // Step 2: choose item + qty
  const step2 = await vwModalForm({
    title: "Add Inventory Item",
    okText: "Add",
    fields: [
      ...(items.length
        ? [{ key:"name", label:"Item", type:"select", options: itemOptions }]
        : [{ key:"name", label:"Item", placeholder:"Item name" }]),
      { key:"qty", label:"Qty", placeholder:"1" },
      { key:"notes", label:"Notes", placeholder:"Optional" }
    ]
  });
  if (!step2) return;

  c.inventory = c.inventory || [];
  c.inventory.push({
    category: step1.category || "",
    name: step2.name || "",
    qty: step2.qty || "1",
    notes: step2.notes || ""
  });

  await saveChar(c);
  await refreshAll?.();
  toast("Inventory item added");
}
function getChar(){
  const st=window.__STATE||{};
  return (st.characters||[]).find(c=>c.id===SESSION.activeCharId);
}

async function saveChar(character){
  // Wrapper used in multiple flows
  return api("/api/character/save",{
    method:"POST",
    body: JSON.stringify(character)
  });
}

// Starter-kit recommendations by class (UI ordering only)
const VW_KIT_RECOMMEND_BY_CLASS = {
  "Professor": ["research_kit","electronics_repair_kit","battery_pack"],
  "Priest": ["medkit_field","trauma_kit","radio_earpiece"],
  "Soldier": ["weapon_maintenance_kit","radio_earpiece","flashlight"],
  "Thief": ["lockpick_kit","disguise_kit","flashlight"],
  "Rockstar": ["performance_gear","radio_earpiece","battery_pack"],
  "Occultist": ["ritual_kit","battery_pack"],
  "Inventor": ["electronics_repair_kit","hacker_kit","battery_pack"],
  "Bouncer": ["flashlight","radio_earpiece"],
  "Park Ranger": ["field_survival_kit","binoculars","flashlight"],
  "Martial Artist": ["field_survival_kit","flashlight"],
  "Detective": ["evidence_kit","forensics_kit","binoculars"],
  "Hunter": ["field_survival_kit","weapon_maintenance_kit","binoculars"],
  "Gifted": ["ritual_kit","battery_pack"]
};



function vwGetCatalog(){
  return window.VW_CHAR_CATALOG || window.VEILWATCH_CATALOG || null;
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

  // abilities rows
  const abBody = document.getElementById("abilityBody");
  if(abBody){
    abBody.innerHTML="";
    (c.abilities||[]).forEach((ab,idx)=>{
      const tr=document.createElement("tr");
      tr.innerHTML =
        '<td>'+esc(ab.name||"")+'</td>'+
        '<td>'+esc(ab.type||"")+'</td>'+
        '<td>'+esc(ab.hit||"")+'</td>'+
        '<td class="mini" style="max-width:520px;">'+esc(ab.effect||ab.summary||"")+'</td>'+
        '<td>'+esc(ab.cooldown||"")+'</td>'+
        '<td><button class="btn smallbtn">Remove</button></td>';
      tr.querySelector('button').onclick=async ()=>{
        c.abilities.splice(idx,1);
        await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
        toast("Removed ability"); await refreshAll();
      };
      abBody.appendChild(tr);
    });
    if(!(c.abilities||[]).length){
      abBody.innerHTML = '<tr><td colspan="6" class="mini">No abilities yet.</td></tr>';
    }
  }

  // spells rows
  const spBody = document.getElementById("spellBody");
  if(spBody){
    spBody.innerHTML="";
    (c.spells||[]).forEach((sp,idx)=>{
      const tr=document.createElement("tr");
      tr.innerHTML =
        '<td>'+esc(sp.modernName||sp.name||"")+'</td>'+
        '<td>'+esc(sp.tier ?? sp.level ?? "")+'</td>'+
        '<td>'+esc(sp.castTime||sp.cast||"")+'</td>'+
        '<td>'+esc(sp.concentration?"Yes":"")+'</td>'+
        '<td class="mini" style="max-width:520px;">'+esc(sp.summary||sp.description||"")+'</td>'+
        '<td><button class="btn smallbtn">Remove</button></td>';
      tr.querySelector('button').onclick=async ()=>{
        c.spells.splice(idx,1);
        await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
        toast("Removed spell"); await refreshAll();
      };
      spBody.appendChild(tr);
    });
    if(!(c.spells||[]).length){
      spBody.innerHTML = '<tr><td colspan="6" class="mini">No spells yet.</td></tr>';
    }
  }
}

window.CONDITIONS = window.CONDITIONS || ["bleeding","blinded","charmed","deafened","frightened","grappled","incapacitated","invisible","paralyzed","poisoned","prone","restrained","stunned","unconscious","exhaustion"];
const CONDITIONS = window.CONDITIONS;


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
    ["notesText",["notes"]]
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
      // Keep the always-visible summary pills in sync while the user types.
      try{ if(typeof vwUpdateCharSummaryRow === "function") vwUpdateCharSummaryRow(); }catch(e){}
      vwScheduleCharAutosave();
    });
  });
}

function renderSheet(){
  // Sheet fields live directly in the DOM (ctab-sheet), so don't gate rendering on legacy host containers.
  const ctab = document.getElementById("ctab-sheet");
  if(!ctab) return;
  const c=getChar();
  if(!c) return;

  c.sheet ||= {};
  c.sheet.vitals ||= { hpCur:"", hpMax:"", hpTemp:"", ac:"", init:"", speed:"" };
  c.sheet.money  ||= { cash:"", bank:"" };
  c.sheet.stats  ||= { STR:"",DEX:"",CON:"",INT:"",WIS:"",CHA:"" };
  c.sheet.conditions ||= [];
  c.sheet.background ||= "";
  c.sheet.traits ||= "";
  c.sheet.notes ||= "";

  const v=c.sheet.vitals;
  document.getElementById("hpCur").value = v.hpCur ?? "";
  document.getElementById("hpMax").value = v.hpMax ?? "";
  document.getElementById("hpTemp").value = v.hpTemp ?? "";
  document.getElementById("acVal").value = v.ac ?? "";
  document.getElementById("initVal").value = v.init ?? "";
  document.getElementById("spdVal").value = v.speed ?? "";

// Extended text fields
const bgEl = document.getElementById("bgText");
if(bgEl) bgEl.value = c.sheet.background ?? "";
const trEl = document.getElementById("traitsText");
if(trEl) trEl.value = c.sheet.traits ?? "";
const ntEl = document.getElementById("notesText");
if(ntEl) ntEl.value = c.sheet.notes ?? "";

  document.getElementById("cashVal").value = (c.sheet.money.cash ?? "");
  document.getElementById("bankVal").value = (c.sheet.money.bank ?? "");

  document.getElementById("statSTR").value = (c.sheet.stats.STR ?? "");
  document.getElementById("statDEX").value = (c.sheet.stats.DEX ?? "");
  document.getElementById("statCON").value = (c.sheet.stats.CON ?? "");
  document.getElementById("statINT").value = (c.sheet.stats.INT ?? "");
  document.getElementById("statWIS").value = (c.sheet.stats.WIS ?? "");
  document.getElementById("statCHA").value = (c.sheet.stats.CHA ?? "");

  document.getElementById("notesText") && (document.getElementById("notesText").value = (c.sheet.notes ?? ""));

  // conditions
  const row=document.getElementById("condRow");
  if(!row) return;
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
  document.getElementById("delCharBtn").classList.toggle("hidden", !(SESSION.role==="dm" || (SESSION.role==="player" && c && c.ownerUserId===SESSION.userId)));
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
  const c=getChar(); if(!c) return;
  const canDelete = (SESSION.role==="dm") || (SESSION.role==="player" && c.ownerUserId===SESSION.userId);
  if(!canDelete){ toast("You can only delete your own character"); return; }
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
    // Prefer the Active Party's initiative if explicitly set; otherwise fall back to the character sheet's Init.
    const sheetInit = (v.init===0 || v.init) ? v.init : "";
    const init = (entry.initiative===0 || entry.initiative) ? entry.initiative : sheetInit;

        const card = document.createElement("div");
    card.className = "card";
    card.style.gridColumn = "span 4";

    // ---- Tap-to-edit helpers (DM only) ----
    function pillEditNumber(pill, opts){
      opts ||= {};
      const label = opts.label || "";
      const value = (opts.value===0 || opts.value) ? String(opts.value) : "";
      const placeholder = opts.placeholder || "--";
      const minW = opts.minWidth || 56;

      if(pill.dataset.editing==="1") return;
      pill.dataset.editing="1";

      const original = pill.innerHTML;
      const input = document.createElement("input");
      input.className = "input";
      input.value = value;
      input.placeholder = placeholder;
      input.style.width = minW + "px";
      input.style.padding = "6px 8px";
      input.style.borderRadius = "10px";

      pill.innerHTML = "";
      if(label){
        const sp = document.createElement("span");
        sp.className = "mini";
        sp.style.opacity = "0.9";
        sp.textContent = label + " ";
        pill.appendChild(sp);
      }
      pill.appendChild(input);

      function cancel(){
        pill.dataset.editing="0";
        pill.innerHTML = original;
      }

      input.addEventListener("keydown",(e)=>{
        if(e.key==="Enter"){ e.preventDefault(); input.blur(); }
        if(e.key==="Escape"){ e.preventDefault(); cancel(); }
      });

      input.addEventListener("blur", async ()=>{
        const newVal = input.value;
        pill.dataset.editing="0";
        try{
          if(typeof opts.onSave === "function"){
            const ok = await opts.onSave(newVal);
            if(!ok) return cancel();
          }
        }catch(_){
          return cancel();
        }
      });

      setTimeout(()=>input.focus(), 0);
      input.select();
    }

    function pillEditHP(pill, opts){
      opts ||= {};
      const cur = String(opts.cur ?? "");
      const max = String(opts.max ?? "");
      if(pill.dataset.editing==="1") return;
      pill.dataset.editing="1";
      const original = pill.innerHTML;

      const inCur = document.createElement("input");
      inCur.className="input";
      inCur.value = cur;
      inCur.placeholder="cur";
      inCur.style.width="56px";
      inCur.style.padding="6px 8px";
      inCur.style.borderRadius="10px";

      const inMax = document.createElement("input");
      inMax.className="input";
      inMax.value = max;
      inMax.placeholder="max";
      inMax.style.width="56px";
      inMax.style.padding="6px 8px";
      inMax.style.borderRadius="10px";

      const slash = document.createElement("span");
      slash.className="mini";
      slash.style.opacity="0.9";
      slash.textContent=" / ";

      pill.innerHTML="";
      const sp = document.createElement("span");
      sp.className="mini";
      sp.style.opacity="0.9";
      sp.textContent="HP ";
      pill.appendChild(sp);
      pill.appendChild(inCur);
      pill.appendChild(slash);
      pill.appendChild(inMax);

      let t = null;
      async function commit(){
        clearTimeout(t);
        const vCur = inCur.value;
        const vMax = inMax.value;
        try{
          if(typeof opts.onSave === "function"){
            const ok = await opts.onSave(vCur, vMax);
            if(!ok){
              pill.dataset.editing="0";
              pill.innerHTML = original;
            }
          }
        }catch(_){
          pill.dataset.editing="0";
          pill.innerHTML = original;
        }
      }

      function scheduleCommit(){
        clearTimeout(t);
        t = setTimeout(()=>commit(), 300);
      }

      function cancel(){
        clearTimeout(t);
        pill.dataset.editing="0";
        pill.innerHTML = original;
      }

      [inCur,inMax].forEach(inp=>{
        inp.addEventListener("input", scheduleCommit);
        inp.addEventListener("keydown",(e)=>{
          if(e.key==="Enter"){ e.preventDefault(); inp.blur(); commit(); }
          if(e.key==="Escape"){ e.preventDefault(); cancel(); }
        });
        inp.addEventListener("blur", scheduleCommit);
      });

      setTimeout(()=>inCur.focus(), 0);
      inCur.select();
    }

    function upsertCharInState(updatedChar){
      const st = window.__STATE || {};
      st.characters ||= [];
      const idx = st.characters.findIndex(x=>x.id===updatedChar.id);
      if(idx>=0) st.characters[idx] = updatedChar;
      else st.characters.push(updatedChar);
      window.__STATE = st;
    }

    async function patchCharSheet(patch){
      const res = await api("/api/character/patch", { method:"POST", body: JSON.stringify({ charId: c.id, patch }) });
      if(res && res.ok && res.character){
        upsertCharInState(res.character);
        // refresh local views if this is also the selected character
        try{
          if(SESSION.activeCharId === c.id){
            if(typeof renderCharacter==="function") renderCharacter();
            if(typeof renderSheet==="function") renderSheet();
          }
        }catch(_){}
        // re-render the active party cards so everything stays consistent
        try{ renderDMActiveParty(); }catch(_){}
        return true;
      }
      toast((res && res.error) ? res.error : "Save failed");
      return false;
    }

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
        <div class="pill vwTapEdit" data-k="hp">HP: ${esc(hp)}</div>
        <div class="pill vwTapEdit" data-k="ac">AC: ${esc(ac||"--")}</div>
        <div class="pill vwTapEdit" data-k="init">Init: ${esc(String((init===0 || init) ? init : "--"))}</div>
      </div>
      <div class="grid" style="grid-template-columns:repeat(6,1fr);gap:8px;margin-top:10px;">
        <div class="pill vwTapEdit" data-k="STR">STR ${esc(s.STR||"--")}</div>
        <div class="pill vwTapEdit" data-k="DEX">DEX ${esc(s.DEX||"--")}</div>
        <div class="pill vwTapEdit" data-k="CON">CON ${esc(s.CON||"--")}</div>
        <div class="pill vwTapEdit" data-k="INT">INT ${esc(s.INT||"--")}</div>
        <div class="pill vwTapEdit" data-k="WIS">WIS ${esc(s.WIS||"--")}</div>
        <div class="pill vwTapEdit" data-k="CHA">CHA ${esc(s.CHA||"--")}</div>
      </div>
      <div class="row" style="margin-top:10px;justify-content:space-between;">
        <button class="btn smallbtn" data-act="remove">Remove</button>
      </div>
    `;

    const btnOpen = card.querySelector('button[data-act="open"]');
    btnOpen.onclick = async ()=>{
      SESSION.activeCharId = c.id;
      renderTabs("character");
      // Switch character sub-tab to sheet
      document.querySelectorAll('[data-ctab]').forEach(b=>b.classList.toggle("active", b.dataset.ctab==="sheet"));
      document.getElementById("ctab-actions")?.classList.toggle("hidden", true);
      document.getElementById("ctab-inventory")?.classList.toggle("hidden", true);
      document.getElementById("ctab-sheet")?.classList.toggle("hidden", false);
      await refreshAll();
    };

    // Tap-to-edit wiring
    card.querySelectorAll(".vwTapEdit").forEach(pill=>{
      pill.addEventListener("click",(e)=>{
        e.preventDefault(); e.stopPropagation();

        const k = pill.dataset.k;

        if(k === "hp"){
          const v = (c.sheet && c.sheet.vitals) ? c.sheet.vitals : {};
          pillEditHP(pill, {
            cur: v.hpCur ?? "",
            max: v.hpMax ?? "",
            onSave: async (hpCur, hpMax)=>{
              c.sheet ||= {}; c.sheet.vitals ||= {};
              c.sheet.vitals.hpCur = hpCur;
              c.sheet.vitals.hpMax = hpMax;
              return await patchCharSheet({ sheet: { vitals: { hpCur, hpMax } } });
            }
          });
          return;
        }

        if(k === "ac"){
          const v = (c.sheet && c.sheet.vitals) ? c.sheet.vitals : {};
          pillEditNumber(pill, {
            label: "AC",
            value: v.ac ?? "",
            minWidth: 56,
            onSave: async (ac)=>{
              c.sheet ||= {}; c.sheet.vitals ||= {};
              c.sheet.vitals.ac = ac;
              return await patchCharSheet({ sheet: { vitals: { ac } } });
            }
          });
          return;
        }

        if(k === "init"){
          pillEditNumber(pill, {
            label: "Init",
            // Use the same resolved init used by the card display (activeParty override, else sheet).
            value: (init===0 || init) ? init : "",
            minWidth: 72,
            onSave: async (initiative)=>{
              const res = await api("/api/dm/activeParty/initiative", { method:"POST", body: JSON.stringify({ charId: c.id, initiative })});
              if(res && res.ok){
                const raw = String(initiative ?? "").trim();
                const newInit = (raw==="") ? "" : (Number.isFinite(Number(raw)) ? Number(raw) : raw);

                // update local state (activeParty + character sheet) so all UI locations update immediately
                const st = window.__STATE || {};
                st.activeParty ||= [];
                const ix = st.activeParty.findIndex(x=>x.charId===c.id);
                if(ix>=0) st.activeParty[ix].initiative = newInit;

                st.characters ||= [];
                const cx = st.characters.findIndex(x=>x.id===c.id);
                if(cx>=0){
                  st.characters[cx].sheet ||= {};
                  st.characters[cx].sheet.vitals ||= {};
                  st.characters[cx].sheet.vitals.init = newInit;
                }

                window.__STATE = st;

                try{ if(SESSION.activeCharId === c.id){ renderSheet(); vwUpdateCharSummaryRow(); } }catch(_){ }
                try{ renderDMActiveParty(); }catch(_){ }
                return true;
              }
              toast((res && res.error) ? res.error : "Failed");
              return false;
            }
          });
          return;
        }

        // Abilities
        if(["STR","DEX","CON","INT","WIS","CHA"].includes(k)){
          const curVal = (c.sheet && c.sheet.stats) ? (c.sheet.stats[k] ?? "") : "";
          pillEditNumber(pill, {
            label: k,
            value: curVal,
            minWidth: 56,
            onSave: async (val)=>{
              c.sheet ||= {}; c.sheet.stats ||= {};
              c.sheet.stats[k] = val;
              const patch = { sheet: { stats: { [k]: val } } };
              return await patchCharSheet(patch);
            }
          });
          return;
        }
      });
    });

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


// ---- Buttons: add inventory row + new character (kept here so intel.js stays intel-only) ----

// ============================
// Character Tab: Button Wiring
// ============================

async function vwSaveChar(c){
  const res = await api("/api/character/save", { method:"POST", body: JSON.stringify({ charId: c.id, character: c }) });
  if(!res || !res.ok) throw new Error(res?.error || "Save failed");
  return res;
}

function vwHasModal(){
  return (typeof vwModalForm === "function") && (typeof vwModalInput === "function" || true);
}


document.getElementById("newCharBtn")?.addEventListener("click", async ()=>{
  try{
    const cat = vwGetCatalog();
    if(!cat){ toast("Catalog not loaded"); return; }
    if(typeof vwModalBaseSetup !== "function"){ toast("Modal not available"); return; }

    const classes = Array.isArray(cat.classes) ? cat.classes : [];
    const classOpts = classes.map(x=>({ value:x.id, label:x.name }));
    if(!classOpts.length){ toast("No classes in catalog"); return; }

    // Precompute weapon lookup by id
    const weaponBuckets = cat?.weapons || {};
    const allWeapons = []
      .concat(weaponBuckets.sidearms||[])
      .concat(weaponBuckets.primaries||[])
      .concat(weaponBuckets.nonlethal||[])
      .concat(weaponBuckets.melee||[])
      .concat(weaponBuckets.heavy_restricted||[]);
    const weaponById = {};
    allWeapons.forEach(w=>{ if(w && w.id) weaponById[w.id] = w; });

    const backgrounds = Array.isArray(cat.backgrounds) ? cat.backgrounds : [];
    const bgOpts = backgrounds
      .map(b=>({ value:(b.id||b.name||""), label:(b.name||b.id||"") }))
      .filter(o=>o.value);

    // Kits (optional)
    const kitsById = (cat && cat.kits && cat.kits.byId) ? cat.kits.byId : {};
    const kitOptGroups = (classId)=>{
      const className = (classes.find(x=>x.id===classId)?.name) || "";
      const recIds = VW_KIT_RECOMMEND_BY_CLASS[className] || [];
      const recSet = new Set(recIds);

      const recOpts = recIds
        .filter(id => kitsById[id])
        .map(id=>{
          const k = kitsById[id];
          return { value:k.id, label:(k.name + (k.category ? " ("+k.category+")" : "")) };
        });

      const otherOpts = Object.values(kitsById)
        .filter(k => !recSet.has(k.id))
        .map(k=>({ value:k.id, label:(k.name + (k.category ? " ("+k.category+")" : "")) }))
        .sort((a,b)=>a.label.localeCompare(b.label));

      return [
        { value:"", label:"None" },
        { group:"Recommended", options: recOpts },
        { group:"All Kits", options: otherOpts }
      ];
    };

    // Talent + Spell pickers (search + click-to-add)
    const allTalents = Array.isArray(cat.talents) ? cat.talents : [];
    const allSpells  = Array.isArray(cat.spells) ? cat.spells : [];
    const spellcasting = cat.spellcasting || {};
    const casterCfg = spellcasting.casters || {};

    function isCasterClass(classId){ return !!casterCfg[classId]; }

    function maxSpellTierFor(classId, level){
      const cfg = casterCfg[classId];
      if(!cfg) return -1;
      const prog = cfg.progression; // "full" or "half"
      const lvl = Math.max(1, Math.min(20, Number(level||1)));

      if(prog === "half"){
        let maxTier = 0;
        const map = spellcasting.halfCasterTierUnlocks || {};
        Object.keys(map).forEach(t=>{
          const tier = Number(t);
          const req = Number(map[t]);
          if(lvl >= req) maxTier = Math.max(maxTier, tier);
        });
        return maxTier;
      }

      let maxTier = 0;
      const map = spellcasting.fullCasterTierUnlocks || {};
      Object.keys(map).forEach(t=>{
        const tier = Number(t);
        const req = Number(map[t]);
        if(lvl >= req) maxTier = Math.max(maxTier, tier);
      });
      return maxTier;
    }


const result = await new Promise((resolve)=>{
  const ui = vwModalBaseSetup("Character Creation", "Next", "Cancel");

  // Add a Back button to the footer (modal has only OK + Cancel by default)
  let btnBack = document.getElementById("vwModalBack");
  if(!btnBack){
    btnBack = document.createElement("button");
    btnBack.id = "vwModalBack";
    btnBack.textContent = "Back";
    btnBack.style.padding = "10px 14px";
    btnBack.style.borderRadius = "12px";
    btnBack.style.border = "1px solid #2b3a4d";
    btnBack.style.background = "transparent";
    btnBack.style.color = "#e9f1ff";
    btnBack.style.cursor = "pointer";
    // Insert Back before Cancel
    ui.btnCan.parentElement.insertBefore(btnBack, ui.btnCan);
  }

  // Wizard state
  let step = 1;
  const state = {
    name: "",
    level: 3,
    classId: "",
    subclassId: "",
    backgroundId: "",
    species: "",
    traits: "",
    notes: "",
    // gear
    starterPackSel: "recommended",
    kitId: "",
    cash: "0",
    bank: "0",
    weapons: [],           // editable rows
    invExtra: [],          // custom inventory rows
    // stats + vitals
    stats: { STR:"", DEX:"", CON:"", INT:"", WIS:"", CHA:"" },
    vitals: { hpMax:"", ac:"", init:"", speed:"" },
    // picks
    selectedTalents: [],
    selectedSpells: []
  };

  // Convenience
  function qs(id){ return document.getElementById(id); }

  // ---------- Build UI (all steps live in DOM; we swap visibility) ----------
  ui.mBody.innerHTML = `
    <div class="mini" id="vwWizardStepLabel" style="opacity:.9;margin-bottom:10px;">
      Step 1 of 5
    </div>

    <div id="vwWizardSteps">

      <!-- Step 1 -->
      <div class="vwStep" data-step="1">
        <div class="mini" style="opacity:.85;margin-bottom:10px;">
          Name + Class first. This is your “D&amp;D Beyond” creation flow; the Character tab becomes your finished sheet.
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <div class="mini" style="margin-bottom:6px;opacity:.9">Character Name</div>
            <input id="vwCreateName" class="input" placeholder="e.g., Bob" />
          </div>
          <div>
            <div class="mini" style="margin-bottom:6px;opacity:.9">Starting Level</div>
            <input id="vwCreateLevel" class="input" value="3" />
          </div>
        </div>

        <div style="margin-top:10px;">
          <div class="mini" style="margin-bottom:6px;opacity:.9">Class</div>
          <select id="vwCreateClass" class="input" style="width:100%"></select>
        </div>
      </div>

      <!-- Step 2 -->
      <div class="vwStep" data-step="2" style="display:none;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <div class="mini" style="margin-bottom:6px;opacity:.9">Subclass</div>
            <select id="vwCreateSubclass" class="input" style="width:100%"></select>
          </div>
          <div>
            <div class="mini" style="margin-bottom:6px;opacity:.9">Background</div>
            <select id="vwCreateBackground" class="input" style="width:100%"></select>
          </div>
        </div>

        <div style="margin-top:14px;">
          <div style="font-weight:800;margin-bottom:8px;">Traits & Notes</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <div class="mini" style="margin-bottom:6px;opacity:.9">Traits</div>
              <textarea id="vwCreateTraits" class="input" style="min-height:120px"></textarea>
            </div>
            <div>
              <div class="mini" style="margin-bottom:6px;opacity:.9">Notes</div>
              <textarea id="vwCreateNotes" class="input" style="min-height:120px"></textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 3 -->
      <div class="vwStep" data-step="3" style="display:none;">
        <div style="margin-bottom:10px;">
          <div class="mini" style="margin-bottom:6px;opacity:.9">Species</div>
          <input id="vwCreateSpecies" class="input" placeholder="e.g., Human / Elf / Synth / etc." />
        </div>

        <div style="padding-top:12px;border-top:1px solid #2b3a4d;">
          <div style="font-weight:800;margin-bottom:8px;">Abilities (Talents)</div>
          <div class="mini" style="opacity:.8;margin-bottom:8px;">Search and add talents available to your class at your starting level.</div>
          <input id="vwCreateTalentSearch" class="input" placeholder="Search talents…" />
          <div id="vwCreateTalentResults" style="margin-top:8px;max-height:240px;overflow:auto;padding-right:6px;"></div>

          <div style="margin-top:10px;">
            <div class="mini" style="opacity:.8;margin-bottom:6px;">Selected</div>
            <div id="vwCreateSelectedTalents"></div>
          </div>
        </div>

        <div id="vwCreateSpellsBlock" style="margin-top:14px;padding-top:12px;border-top:1px solid #2b3a4d;">
          <div style="font-weight:800;margin-bottom:8px;">Spells</div>
          <div class="mini" style="opacity:.8;margin-bottom:8px;">Search and add spells (filtered by your class, level, and tier unlocks).</div>
          <input id="vwCreateSpellSearch" class="input" placeholder="Search spells…" />
          <div id="vwCreateSpellResults" style="margin-top:8px;max-height:260px;overflow:auto;padding-right:6px;"></div>

          <div style="margin-top:10px;">
            <div class="mini" style="opacity:.8;margin-bottom:6px;">Selected</div>
            <div id="vwCreateSelectedSpells"></div>
          </div>
        </div>
      </div>

      <!-- Step 4 -->
      <div class="vwStep" data-step="4" style="display:none;">
        <div style="font-weight:800;margin-bottom:8px;">Weapons & Gear</div>
        <div class="mini" style="opacity:.8;margin-bottom:10px;">
          Choose a Starter Pack (auto adds 1 sidearm + 1 primary), optionally add a Kit, then add any extra gear.
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <div class="mini" style="margin-bottom:6px;opacity:.9">Starter Pack</div>
            <select id="vwCreateStarterPack" class="input" style="width:100%"></select>
          </div>
          <div>
            <div class="mini" style="margin-bottom:6px;opacity:.9">Starter Kit</div>
            <select id="vwCreateKit" class="input" style="width:100%"></select>
          </div>
        </div>

        <div id="vwCreateGearPreview" class="mini" style="opacity:.85;margin-top:10px;"></div>

        <div style="margin-top:14px;padding-top:12px;border-top:1px solid #2b3a4d;">
          <div style="font-weight:800;margin-bottom:8px;">Starting Money</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div><div class="mini" style="opacity:.8;margin-bottom:4px;">Cash</div><input id="vwCreateCash" class="input" placeholder="0" /></div>
            <div><div class="mini" style="opacity:.8;margin-bottom:4px;">Bank</div><input id="vwCreateBank" class="input" placeholder="0" /></div>
          </div>
        </div>

        <div style="margin-top:14px;padding-top:12px;border-top:1px solid #2b3a4d;">
          <div style="font-weight:800;margin-bottom:8px;">Weapons</div>
          <div class="mini" style="opacity:.8;margin-bottom:8px;">Starter Pack weapons will appear here. Edit details or add custom weapons.</div>
          <div id="vwCreateWeapons"></div>
          <button id="vwCreateAddWeapon" class="btn smallbtn" style="margin-top:10px;">Add Weapon</button>
        </div>

        <div style="margin-top:14px;padding-top:12px;border-top:1px solid #2b3a4d;">
          <div style="font-weight:800;margin-bottom:8px;">Possessions & Inventory</div>
          <div class="mini" style="opacity:.8;margin-bottom:8px;">Kit and starter items are auto-added. Add extra items you want to start with.</div>
          <div id="vwCreateInvAuto" class="mini" style="opacity:.85"></div>

          <div id="vwCreateInvExtra" style="margin-top:10px;"></div>
          <button id="vwCreateAddInv" class="btn smallbtn" style="margin-top:10px;">Add Inventory Item</button>
        </div>
      </div>

      <!-- Step 5 -->
      <div class="vwStep" data-step="5" style="display:none;">
        <div style="font-weight:800;margin-bottom:8px;">Ability Scores</div>
        <div class="mini" style="opacity:.8;margin-bottom:10px;">Set STR/DEX/CON/INT/WIS/CHA here (these are treated as creation-locked).</div>

        <div style="display:grid;grid-template-columns:repeat(6, 1fr);gap:8px;">
          ${["STR","DEX","CON","INT","WIS","CHA"].map(k=>`
            <div>
              <div class="mini" style="opacity:.8;margin-bottom:4px;">${k}</div>
              <input id="vwCreateStat_${k}" class="input" placeholder="10" />
            </div>
          `).join("")}
        </div>

        <div style="margin-top:14px;padding-top:12px;border-top:1px solid #2b3a4d;">
          <div style="font-weight:800;margin-bottom:8px;">Vitals</div>
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:8px;">
            <div><div class="mini" style="opacity:.8;margin-bottom:4px;">HP Max</div><input id="vwCreateHpMax" class="input" placeholder="32" /></div>
            <div><div class="mini" style="opacity:.8;margin-bottom:4px;">AC</div><input id="vwCreateAC" class="input" placeholder="14" /></div>
            <div><div class="mini" style="opacity:.8;margin-bottom:4px;">Init</div><input id="vwCreateInit" class="input" placeholder="+2" /></div>
            <div><div class="mini" style="opacity:.8;margin-bottom:4px;">Speed</div><input id="vwCreateSpeed" class="input" placeholder="30" /></div>
          </div>
        </div>

        <div class="mini" style="opacity:.8;margin-top:12px;">
          When you click <b>Create</b>, this character becomes “sheet-only” and is meant to be played from the Character tab.
        </div>
      </div>

    </div>
  `;

  // ---------- Populate selects from catalog ----------
  const cat = vwGetCatalog();
  const classes = Array.isArray(cat.classes) ? cat.classes : [];
  const classOpts = classes.map(x=>({ value:x.id, label:x.name }));
  if(!classOpts.length){ toast("No classes in catalog"); resolve(null); return; }

  // Precompute weapon lookup by id (name + ammo defaults)
  const weaponBuckets = cat?.weapons || {};
  const allWeapons = []
    .concat(weaponBuckets.sidearms||[])
    .concat(weaponBuckets.primaries||[])
    .concat(weaponBuckets.nonlethal||[])
    .concat(weaponBuckets.melee||[])
    .concat(weaponBuckets.heavy_restricted||[]);
  const weaponById = {};
  allWeapons.forEach(w=>{ if(w && w.id) weaponById[w.id] = w; });

  const backgrounds = Array.isArray(cat.backgrounds) ? cat.backgrounds : [];
  const bgOpts = backgrounds
    .map(b=>({ value:(b.id||b.name||""), label:(b.name||b.id||"") }))
    .filter(o=>o.value);

  // Kits
  const kitsById = (cat && cat.kits && cat.kits.byId) ? cat.kits.byId : {};
  const kitOptGroups = (classId)=>{
    const className = (classes.find(x=>x.id===classId)?.name) || "";
    const recIds = VW_KIT_RECOMMEND_BY_CLASS[className] || [];
    const recSet = new Set(recIds);

    const recOpts = recIds
      .filter(id => kitsById[id])
      .map(id=>{
        const k = kitsById[id];
        return { value:k.id, label:(k.name + (k.category ? " ("+k.category+")" : "")) };
      });

    const otherOpts = Object.values(kitsById)
      .filter(k => !recSet.has(k.id))
      .map(k=>({ value:k.id, label:(k.name + (k.category ? " ("+k.category+")" : "")) }))
      .sort((a,b)=>a.label.localeCompare(b.label));

    return [
      { value:"", label:"None" },
      { group:"Recommended", options: recOpts },
      { group:"All Kits", options: otherOpts }
    ];
  };

  // Talents + Spells
  const allTalents = Array.isArray(cat.talents) ? cat.talents : [];
  const allSpells  = Array.isArray(cat.spells) ? cat.spells : [];
  const spellcasting = cat.spellcasting || {};
  const casterCfg = spellcasting.casters || {};
  function isCasterClass(classId){ return !!casterCfg[classId]; }
  function maxSpellTierFor(classId, level){
    const cfg = casterCfg[classId];
    if(!cfg) return -1;
    const prog = cfg.progression;
    const lvl = Math.max(1, Math.min(20, Number(level||1)));

    if(prog === "half"){
      let maxTier = 0;
      const map = spellcasting.halfCasterTierUnlocks || {};
      Object.keys(map).forEach(t=>{
        const tier = Number(t);
        const req = Number(map[t]);
        if(lvl >= req) maxTier = Math.max(maxTier, tier);
      });
      return maxTier;
    }

    let maxTier = 0;
    const map = spellcasting.fullCasterTierUnlocks || {};
    Object.keys(map).forEach(t=>{
      const tier = Number(t);
      const req = Number(map[t]);
      if(lvl >= req) maxTier = Math.max(maxTier, tier);
    });
    return maxTier;
  }

  // ---------- Step helpers ----------
  function showStep(n){
    step = n;
    ui.mBody.scrollTop = 0;
    qs("vwWizardStepLabel").textContent = `Step ${step} of 5`;

    document.querySelectorAll(".vwStep").forEach(el=>{
      el.style.display = (Number(el.getAttribute("data-step")) === step) ? "block" : "none";
    });

    // Footer buttons
    btnBack.style.display = (step === 1) ? "none" : "inline-block";
    ui.btnOk.textContent = (step === 5) ? "Create" : "Next";
  }

  function getClassId(){ return String(qs("vwCreateClass")?.value || state.classId || ""); }
  function getLevel(){ return Number(String(qs("vwCreateLevel")?.value || state.level || 3).trim() || 3); }

  function rebuildSubclass(){
    const classId = getClassId();
    const subs = (cat && cat.subclassesByClass && Array.isArray(cat.subclassesByClass[classId]))
      ? cat.subclassesByClass[classId]
      : [];
    const subSel = qs("vwCreateSubclass");
    if(!subSel) return;
    const opts = [{ value:"", label:"None" }].concat(subs.map(x=>({ value:x.id, label:x.name })));
    subSel.innerHTML = opts.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");
    if(state.subclassId){ subSel.value = state.subclassId; }
  }

  function rebuildStarterPack(){
    const classId = getClassId();
    const packs = cat?.starterPacks || {};
    const rec = packs.recommended ? [{ value:"recommended", label:(packs.recommended.name || "Recommended Starter Pack") }] : [];
    const byClass = (packs.byClass && packs.byClass[classId]) ? [{ value:"class", label:"Class Starter Pack" }] : [];
    const opts = [{ value:"none", label:"None / I will add manually" }].concat(rec).concat(byClass);

    const sel = qs("vwCreateStarterPack");
    if(!sel) return;
    sel.innerHTML = opts.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");
    // preserve prior selection if possible
    const preferred = state.starterPackSel || (rec.length ? "recommended" : (byClass.length ? "class" : "none"));
    sel.value = opts.some(o=>o.value===preferred) ? preferred : (rec.length ? "recommended" : (byClass.length ? "class" : "none"));
  }

  function rebuildKit(){
    const classId = getClassId();
    const sel = qs("vwCreateKit");
    if(!sel) return;
    const groups = kitOptGroups(classId);

    let html = "";
    groups.forEach(g=>{
      if(g.group){
        const inner = (g.options||[]).map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");
        html += `<optgroup label="${esc(g.group)}">${inner}</optgroup>`;
      }else{
        html += `<option value="${esc(g.value)}">${esc(g.label)}</option>`;
      }
    });
    sel.innerHTML = html;
    if(state.kitId) sel.value = state.kitId;
  }

  function computeAutoGear(){
    const classId = getClassId();
    const packs = cat?.starterPacks || {};
    const packSel = String(qs("vwCreateStarterPack")?.value || state.starterPackSel || "none");
    let pack = null;
    if(packSel === "recommended") pack = packs.recommended || null;
    if(packSel === "class") pack = (packs.byClass && packs.byClass[classId]) ? packs.byClass[classId] : null;

    const kitId = String(qs("vwCreateKit")?.value || state.kitId || "");
    const kit = kitId ? kitsById[kitId] : null;

    // Weapons: ensure starter weapons exist (editable)
    const nextWeapons = [];
    function ensureWeapon(wid){
      if(!wid) return;
      const def = weaponById[wid];
      const baseName = def?.name || wid;
      const ammoModel = def?.ammoModel || "";
      const ammoType = def?.ammoTypeDefault || "";
      // preserve existing edits if already present
      const existing = state.weapons.find(w => String(w.id||"")===String(wid)) || state.weapons.find(w => String(w.name||"")===String(baseName));
      if(existing){
        nextWeapons.push(existing);
        return;
      }
      nextWeapons.push({
        id: def?.id || wid,
        name: baseName,
        range: "",
        hit: "",
        damage: "",
        ammo: ammoType ? { type: ammoType, starting: "", current: "", mags: "" } : null
      });
    }
    if(pack){
      ensureWeapon(pack.sidearm);
      ensureWeapon(pack.primary);
    }
    // Also include any existing custom weapons not part of starter pack
    state.weapons.forEach(w=>{
      const isStarter = pack && (String(w.id||"")===String(pack.sidearm) || String(w.id||"")===String(pack.primary));
      if(!isStarter){
        // keep customs
        nextWeapons.push(w);
      }
    });
    state.weapons = nextWeapons;

    // Auto inventory (read-only display + included in payload)
    const invAuto = [];
    if(pack){
      (pack.items||[]).forEach(itemName=>{
        invAuto.push({
          id: "inv_"+Math.random().toString(36).slice(2,9),
          category: "Starter Pack",
          name: String(itemName),
          weight: "",
          qty: "1",
          cost: "",
          notes: (pack.name || (packSel==="class" ? "Class Starter Pack" : "Starter Pack"))
        });
      });
    }
    if(kit && Array.isArray(kit.items)){
      kit.items.forEach(itemName=>{
        invAuto.push({
          id: "inv_"+Math.random().toString(36).slice(2,9),
          category: kit.category || "Kit",
          name: String(itemName),
          weight: "",
          qty: "1",
          cost: "",
          notes: kit.name || ""
        });
      });
    }

    // Gear preview
    const parts = [];
    if(pack){
      const s = pack.sidearm ? (weaponById[pack.sidearm]?.name || pack.sidearm) : "";
      const pr = pack.primary ? (weaponById[pack.primary]?.name || pack.primary) : "";
      parts.push(`<b>Starter Pack</b>: ${esc(s)} + ${esc(pr)}${Array.isArray(pack.items)&&pack.items.length?(" • "+esc(pack.items.join(", "))):""}`);
    }else{
      parts.push(`<b>Starter Pack</b>: None`);
    }
    if(kit){
      parts.push(`<b>Kit</b>: ${esc(kit.name||kit.id)}${Array.isArray(kit.items)&&kit.items.length?(" • "+esc(kit.items.join(", "))):""}`);
    }else{
      parts.push(`<b>Kit</b>: None`);
    }
    const host = qs("vwCreateGearPreview");
    if(host) host.innerHTML = parts.join("<br/>");

    // Auto inventory display
    const autoHost = qs("vwCreateInvAuto");
    if(autoHost){
      if(!invAuto.length){
        autoHost.innerHTML = '<div style="opacity:.7">Auto-added: none</div>';
      }else{
        autoHost.innerHTML = '<div style="opacity:.85;margin-bottom:6px;"><b>Auto-added</b></div>' + invAuto.map(it=>`• ${esc(it.name)} <span style="opacity:.7">(${esc(it.category)})</span>`).join("<br/>");
      }
    }

    return { packSel, kitId, invAuto };
  }

  function renderWeapons(){
    const host = qs("vwCreateWeapons");
    if(!host) return;

    if(!state.weapons.length){
      host.innerHTML = '<div class="mini" style="opacity:.7">No weapons yet.</div>';
      return;
    }

    host.innerHTML = state.weapons.map((w,idx)=>{
      const hasAmmo = !!w.ammo;
      return `
        <div style="margin:10px 0;padding:10px;border:1px solid #2b3a4d;border-radius:14px;background:rgba(0,0,0,.12);">
          <div style="display:flex;gap:10px;align-items:center;">
            <div style="flex:1;font-weight:800">${esc(w.name||"Weapon")}</div>
            <button class="btn smallbtn" data-del-weap="${idx}">Remove</button>
          </div>

          <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:8px;margin-top:10px;">
            <div>
              <div class="mini" style="opacity:.8;margin-bottom:4px;">Name</div>
              <input class="input" data-wk="name" data-idx="${idx}" value="${esc(w.name||"")}" />
            </div>
            <div>
              <div class="mini" style="opacity:.8;margin-bottom:4px;">Range</div>
              <input class="input" data-wk="range" data-idx="${idx}" value="${esc(w.range||"")}" placeholder="e.g., 30 ft" />
            </div>
            <div>
              <div class="mini" style="opacity:.8;margin-bottom:4px;">Hit / DC</div>
              <input class="input" data-wk="hit" data-idx="${idx}" value="${esc(w.hit||"")}" placeholder="+5" />
            </div>
            <div>
              <div class="mini" style="opacity:.8;margin-bottom:4px;">Damage</div>
              <input class="input" data-wk="damage" data-idx="${idx}" value="${esc(w.damage||"")}" placeholder="2d6" />
            </div>
          </div>

          ${hasAmmo ? `
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-top:10px;">
            <div>
              <div class="mini" style="opacity:.8;margin-bottom:4px;">Ammo Type</div>
              <input class="input" data-wammo="type" data-idx="${idx}" value="${esc(w.ammo.type||"")}" />
            </div>
            <div>
              <div class="mini" style="opacity:.8;margin-bottom:4px;">Starting</div>
              <input class="input" data-wammo="starting" data-idx="${idx}" value="${esc(w.ammo.starting||"")}" placeholder="full / 30 / etc" />
            </div>
            <div>
              <div class="mini" style="opacity:.8;margin-bottom:4px;">Current</div>
              <input class="input" data-wammo="current" data-idx="${idx}" value="${esc(w.ammo.current||"")}" placeholder="30" />
            </div>
            <div>
              <div class="mini" style="opacity:.8;margin-bottom:4px;">Mags</div>
              <input class="input" data-wammo="mags" data-idx="${idx}" value="${esc(w.ammo.mags||"")}" placeholder="2" />
            </div>
          </div>
          ` : `
          <div class="mini" style="opacity:.7;margin-top:10px;">(No ammo tracking on this weapon)</div>
          `}
        </div>
      `;
    }).join("");

    // wire input changes
    host.querySelectorAll("input[data-wk]").forEach(inp=>{
      inp.oninput = ()=>{
        const idx = Number(inp.getAttribute("data-idx"));
        const k = inp.getAttribute("data-wk");
        state.weapons[idx][k] = inp.value;
      };
    });

    host.querySelectorAll("input[data-wammo]").forEach(inp=>{
      inp.oninput = ()=>{
        const idx = Number(inp.getAttribute("data-idx"));
        const k = inp.getAttribute("data-wammo");
        state.weapons[idx].ammo = state.weapons[idx].ammo || {};
        state.weapons[idx].ammo[k] = inp.value;
      };
    });

    host.querySelectorAll("[data-del-weap]").forEach(btn=>{
      btn.onclick = ()=>{
        const idx = Number(btn.getAttribute("data-del-weap"));
        state.weapons.splice(idx,1);
        renderWeapons();
      };
    });
  }

  function renderInvExtra(){
    const host = qs("vwCreateInvExtra");
    if(!host) return;

    if(!state.invExtra.length){
      host.innerHTML = '<div class="mini" style="opacity:.7">No extra items.</div>';
      return;
    }

    host.innerHTML = state.invExtra.map((it,idx)=>`
      <div style="display:grid;grid-template-columns:1fr 2fr .8fr 1.2fr auto;gap:8px;align-items:end;margin:10px 0;">
        <div>
          <div class="mini" style="opacity:.8;margin-bottom:4px;">Category</div>
          <input class="input" data-ik="category" data-idx="${idx}" value="${esc(it.category||"")}" />
        </div>
        <div>
          <div class="mini" style="opacity:.8;margin-bottom:4px;">Item</div>
          <input class="input" data-ik="name" data-idx="${idx}" value="${esc(it.name||"")}" placeholder="e.g., Rope, Laptop, Medkit" />
        </div>
        <div>
          <div class="mini" style="opacity:.8;margin-bottom:4px;">Qty</div>
          <input class="input" data-ik="qty" data-idx="${idx}" value="${esc(it.qty||"1")}" />
        </div>
        <div>
          <div class="mini" style="opacity:.8;margin-bottom:4px;">Notes</div>
          <input class="input" data-ik="notes" data-idx="${idx}" value="${esc(it.notes||"")}" />
        </div>
        <button class="btn smallbtn" data-del-inv="${idx}">Del</button>
      </div>
    `).join("");

    host.querySelectorAll("input[data-ik]").forEach(inp=>{
      inp.oninput = ()=>{
        const idx = Number(inp.getAttribute("data-idx"));
        const k = inp.getAttribute("data-ik");
        state.invExtra[idx][k] = inp.value;
      };
    });

    host.querySelectorAll("[data-del-inv]").forEach(btn=>{
      btn.onclick = ()=>{
        const idx = Number(btn.getAttribute("data-del-inv"));
        state.invExtra.splice(idx,1);
        renderInvExtra();
      };
    });
  }

  function renderSelected(kind){
    if(kind === "talents"){
      const host = qs("vwCreateSelectedTalents");
      if(!host) return;
      if(!state.selectedTalents.length){
        host.innerHTML = '<div class="mini" style="opacity:.7">No talents selected.</div>';
        return;
      }
      host.innerHTML = state.selectedTalents.map(t=>`
        <div style="display:flex;gap:8px;align-items:flex-start;margin:8px 0;padding:8px;border:1px solid #2b3a4d;border-radius:12px;background:rgba(255,255,255,.02);">
          <div style="flex:1">
            <div style="font-weight:700">${esc(t.name||"")}</div>
            <div class="mini" style="opacity:.8">${esc((t.tags||[]).join(", "))}${t.minLevel?(" • min Lv "+t.minLevel):""}</div>
          </div>
          <button class="btn smallbtn" data-del-talent="${esc(String(t.id||t.name||""))}">Remove</button>
        </div>
      `).join("");
      host.querySelectorAll("[data-del-talent]").forEach(btn=>{
        btn.onclick = ()=>{
          const id = btn.getAttribute("data-del-talent") || "";
          state.selectedTalents = state.selectedTalents.filter(x => String(x.id||x.name) !== String(id));
          renderSelected("talents");
          rerenderTalentResults();
        };
      });
    }

    if(kind === "spells"){
      const host = qs("vwCreateSelectedSpells");
      if(!host) return;
      if(!state.selectedSpells.length){
        host.innerHTML = '<div class="mini" style="opacity:.7">No spells selected.</div>';
        return;
      }
      host.innerHTML = state.selectedSpells.map(s=>`
        <div style="display:flex;gap:8px;align-items:flex-start;margin:8px 0;padding:8px;border:1px solid #2b3a4d;border-radius:12px;background:rgba(255,255,255,.02);">
          <div style="flex:1">
            <div style="font-weight:700">${esc(s.modernName||s.name||"")}</div>
            <div class="mini" style="opacity:.8">Tier ${esc(s.tier ?? "")}${s.cast?(" • "+esc(s.cast)):""}${s.concentration?(" • Concentration"):""}</div>
          </div>
          <button class="btn smallbtn" data-del-spell="${esc(String(s.id||s.modernName||s.name||""))}">Remove</button>
        </div>
      `).join("");
      host.querySelectorAll("[data-del-spell]").forEach(btn=>{
        btn.onclick = ()=>{
          const id = btn.getAttribute("data-del-spell") || "";
          state.selectedSpells = state.selectedSpells.filter(x => String(x.id||x.modernName||x.name) !== String(id));
          renderSelected("spells");
          rerenderSpellResults();
        };
      });
    }
  }

  // Talent results
  function rerenderTalentResults(){
    const talentQ = qs("vwCreateTalentSearch");
    const talentRes = qs("vwCreateTalentResults");
    if(!talentQ || !talentRes) return;

    const classId = getClassId();
    const level = getLevel();
    const needle = String(talentQ.value||"").trim().toLowerCase();

    const pool = allTalents.filter(t=>{
      const okClass = !t.classId || t.classId === classId;
      const okLevel = !t.minLevel || Number(t.minLevel) <= level;
      return okClass && okLevel;
    });

    const filtered = needle
      ? pool.filter(t=>{
          const hay = (t.name+" "+(t.description||"")+" "+(t.tags||[]).join(" ")).toLowerCase();
          return hay.includes(needle);
        })
      : pool;

    const top = filtered.slice(0, 30);
    talentRes.innerHTML = top.map(t=>{
      const tid = String(t.id||t.name||"");
      const already = state.selectedTalents.some(x=>String(x.id||x.name)===tid);
      return `
        <div style="display:flex;gap:8px;align-items:center;margin:6px 0;padding:8px;border:1px solid #2b3a4d;border-radius:12px;background:rgba(0,0,0,.15);">
          <div style="flex:1">
            <div style="font-weight:700">${esc(t.name||"")}</div>
            <div class="mini" style="opacity:.75">${esc((t.tags||[]).join(", "))}${t.minLevel?(" • min Lv "+t.minLevel):""}</div>
          </div>
          <button class="btn smallbtn" data-add-talent="${esc(tid)}" ${already?"disabled":""}>Add</button>
        </div>
      `;
    }).join("") || '<div class="mini" style="opacity:.7">No matches.</div>';

    talentRes.querySelectorAll("[data-add-talent]").forEach(btn=>{
      btn.onclick = ()=>{
        const id = btn.getAttribute("data-add-talent");
        const t = allTalents.find(x=>String(x.id||x.name)===String(id));
        if(!t) return;
        const tid = String(t.id||t.name||"");
        if(state.selectedTalents.some(x=>String(x.id||x.name)===tid)) return;
        state.selectedTalents.push(t);
        renderSelected("talents");
        rerenderTalentResults();
      };
    });
  }

  // Spell results
  function rerenderSpellResults(){
    const spellQ = qs("vwCreateSpellSearch");
    const spellRes = qs("vwCreateSpellResults");
    if(!spellQ || !spellRes) return;

    const classId = getClassId();
    const level = getLevel();
    const needle = String(spellQ.value||"").trim().toLowerCase();
    const maxTier = maxSpellTierFor(classId, level);

    const pool = allSpells.filter(s=>{
      const okClass = Array.isArray(s.classIds) ? s.classIds.includes(classId) : true;
      const okLevel = !s.minLevel || Number(s.minLevel) <= level;
      const okTier = (maxTier >= 0) ? (Number(s.tier ?? s.level ?? 0) <= maxTier) : true;
      return okClass && okLevel && okTier;
    });

    const filtered = needle
      ? pool.filter(s=>{
          const hay = ((s.modernName||s.name||"")+" "+(s.effect||s.summary||s.description||"")+" "+(s.tags||[]).join(" ")).toLowerCase();
          return hay.includes(needle);
        })
      : pool;

    const top = filtered.slice(0, 40);
    spellRes.innerHTML = top.map(s=>{
      const sid = String(s.id||s.modernName||s.name||"");
      const already = state.selectedSpells.some(x=>String(x.id||x.modernName||x.name)===sid);
      return `
        <div style="display:flex;gap:8px;align-items:center;margin:6px 0;padding:8px;border:1px solid #2b3a4d;border-radius:12px;background:rgba(0,0,0,.15);">
          <div style="flex:1">
            <div style="font-weight:700">${esc(s.modernName||s.name||"")}</div>
            <div class="mini" style="opacity:.75">Tier ${esc(s.tier ?? "")}${s.cast?(" • "+esc(s.cast)):""}${s.concentration?(" • Concentration"):""}</div>
          </div>
          <button class="btn smallbtn" data-add-spell="${esc(sid)}" ${already?"disabled":""}>Add</button>
        </div>
      `;
    }).join("") || '<div class="mini" style="opacity:.7">No matches.</div>';

    spellRes.querySelectorAll("[data-add-spell]").forEach(btn=>{
      btn.onclick = ()=>{
        const id = btn.getAttribute("data-add-spell");
        const s = allSpells.find(x=>String(x.id||x.modernName||x.name)===String(id));
        if(!s) return;
        const sid = String(s.id||s.modernName||s.name||"");
        if(state.selectedSpells.some(x=>String(x.id||x.modernName||x.name)===sid)) return;
        state.selectedSpells.push(s);
        renderSelected("spells");
        rerenderSpellResults();
      };
    });
  }

  function toggleSpellsBlock(){
    const block = qs("vwCreateSpellsBlock");
    if(block) block.style.display = isCasterClass(getClassId()) ? "block" : "none";
  }

  // ---------- Initial values + wiring ----------
  // Step 1: class options
  const classSel = qs("vwCreateClass");
  classSel.innerHTML = classOpts.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");
  classSel.value = classes[0]?.id || "";
  state.classId = classSel.value;

  // Step 2: backgrounds
  const bgSel = qs("vwCreateBackground");
  bgSel.innerHTML = (bgOpts.length ? bgOpts : [{value:"",label:"(none)"}])
    .map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");
  if(bgOpts[0]?.value) bgSel.value = bgOpts[0].value;

  rebuildSubclass();

  // Step 4: packs/kits
  rebuildStarterPack();
  rebuildKit();
  computeAutoGear();
  renderWeapons();
  renderInvExtra();

  // Step 3: picks
  renderSelected("talents");
  renderSelected("spells");
  rerenderTalentResults();
  rerenderSpellResults();
  toggleSpellsBlock();

  // Wiring changes
  classSel.addEventListener("change", ()=>{
    state.classId = classSel.value;
    state.subclassId = "";
    state.selectedTalents = [];
    state.selectedSpells = [];
    rebuildSubclass();
    rebuildStarterPack();
    rebuildKit();
    computeAutoGear();
    renderWeapons();
    renderInvExtra();
    renderSelected("talents");
    renderSelected("spells");
    rerenderTalentResults();
    rerenderSpellResults();
    toggleSpellsBlock();
  });

  qs("vwCreateLevel")?.addEventListener("change", ()=>{
    state.level = getLevel();
    rerenderTalentResults();
    rerenderSpellResults();
    toggleSpellsBlock();
  });

  qs("vwCreateStarterPack")?.addEventListener("change", ()=>{
    state.starterPackSel = String(qs("vwCreateStarterPack")?.value||"none");
    computeAutoGear();
    renderWeapons();
  });

  qs("vwCreateKit")?.addEventListener("change", ()=>{
    state.kitId = String(qs("vwCreateKit")?.value||"");
    computeAutoGear();
  });

  qs("vwCreateTalentSearch") && (qs("vwCreateTalentSearch").oninput = rerenderTalentResults);
  qs("vwCreateSpellSearch") && (qs("vwCreateSpellSearch").oninput = rerenderSpellResults);

  qs("vwCreateAddWeapon")?.addEventListener("click", (e)=>{
    e.preventDefault();
    state.weapons.push({
      id: "custom_"+Math.random().toString(36).slice(2,9),
      name: "",
      range: "",
      hit: "",
      damage: "",
      ammo: null
    });
    renderWeapons();
  });

  qs("vwCreateAddInv")?.addEventListener("click", (e)=>{
    e.preventDefault();
    state.invExtra.push({ category:"General", name:"", qty:"1", notes:"" });
    renderInvExtra();
  });

  // ---------- Validation + persistence per step ----------
  function validateStep(n){
    if(n === 1){
      const name = String(qs("vwCreateName")?.value||"").trim();
      const classId = getClassId();
      const level = getLevel();

      if(!name){ toast("Name is required"); return false; }
      if(!classId){ toast("Class is required"); return false; }

      state.name = name;
      state.classId = classId;
      state.level = level;
      return true;
    }

    if(n === 2){
      const subclassId = String(qs("vwCreateSubclass")?.value||"");
      const bgId = String(qs("vwCreateBackground")?.value||"");
      const traits = String(qs("vwCreateTraits")?.value||"").trim();
      const notes = String(qs("vwCreateNotes")?.value||"").trim();

      const bgObj = backgrounds.find(b=>String(b.id||b.name)===bgId) || null;
      const bgName = (bgObj?.name || bgId || "");

      if(!bgName){ toast("Background is required"); return false; }

      state.subclassId = subclassId;
      state.backgroundId = bgId;
      state.traits = traits;
      state.notes = notes;
      return true;
    }

    if(n === 3){
      const species = String(qs("vwCreateSpecies")?.value||"").trim();
      if(!species){ toast("Species is required"); return false; }
      state.species = species;

      // ensure spell block rules
      toggleSpellsBlock();
      return true;
    }

    if(n === 4){
      state.cash = String(qs("vwCreateCash")?.value||"0").trim() || "0";
      state.bank = String(qs("vwCreateBank")?.value||"0").trim() || "0";
      state.starterPackSel = String(qs("vwCreateStarterPack")?.value||state.starterPackSel||"none");
      state.kitId = String(qs("vwCreateKit")?.value||state.kitId||"");
      // weapons + invExtra are already kept live
      return true;
    }

    if(n === 5){
      // Stats
      const stats = {};
      ["STR","DEX","CON","INT","WIS","CHA"].forEach(k=>{
        stats[k] = String(qs("vwCreateStat_"+k)?.value||"").trim();
      });
      const missingStat = Object.keys(stats).find(k=>!stats[k]);
      if(missingStat){ toast("Set "+missingStat); return false; }

      const hpMax = String(qs("vwCreateHpMax")?.value||"").trim();
      const ac = String(qs("vwCreateAC")?.value||"").trim();
      const init = String(qs("vwCreateInit")?.value||"").trim();
      const speed = String(qs("vwCreateSpeed")?.value||"").trim();

      if(!hpMax){ toast("Set HP Max"); return false; }
      if(!ac){ toast("Set AC"); return false; }
      if(!speed){ toast("Set Speed"); return false; }

      state.stats = stats;
      state.vitals = { hpMax, ac, init, speed };
      return true;
    }

    return true;
  }

  // ---------- Close ----------
  function close(val){
    ui.modal.style.display = "none";
    ui.btnOk.onclick = null;
    ui.btnCan.onclick = null;
    btnBack.onclick = null;
    try{ btnBack.remove(); }catch(e){}
    ui.modal.onclick = null;
    vwSetModalOpen(false);
    resolve(val);
  }

  // Cancel
  ui.btnCan.onclick = ()=>close(null);
  ui.modal.onclick = (e)=>{ if(e.target === ui.modal) close(null); };

  // Back
  btnBack.onclick = ()=>{
    if(step > 1){
      showStep(step - 1);
    }
  };

  // Next / Create
  ui.btnOk.onclick = async ()=>{
    if(!validateStep(step)) return;

    if(step < 5){
      showStep(step + 1);
      return;
    }

    // Step 5: Create payload
    const classId = state.classId;
    const subclassId = state.subclassId ? state.subclassId : null;
    const level = state.level;

    const bgId = state.backgroundId;
    const bgObj = backgrounds.find(b=>String(b.id||b.name)===bgId) || null;
    const bgName = (bgObj?.name || bgId || "");

    // Auto gear (starter pack + kit)
    const { invAuto } = computeAutoGear();

    // Inventory final
    const invExtra = (state.invExtra||[]).filter(it => (it.name||"").trim());
    const inventory = invAuto.concat(invExtra.map(it=>({
      id: it.id || ("inv_"+Math.random().toString(36).slice(2,9)),
      category: it.category || "General",
      name: String(it.name||""),
      weight: "",
      qty: String(it.qty||"1"),
      cost: "",
      notes: String(it.notes||"")
    })));

    // Weapons final
    const weapons = (state.weapons||[]).filter(w => (w.name||"").trim()).map(w=>({
      id: w.id || ("weap_"+Math.random().toString(36).slice(2,9)),
      name: String(w.name||""),
      range: String(w.range||""),
      hit: String(w.hit||""),
      damage: String(w.damage||""),
      ammo: w.ammo ? {
        type: String(w.ammo.type||""),
        starting: String(w.ammo.starting||""),
        current: String(w.ammo.current||""),
        mags: String(w.ammo.mags||"")
      } : null
    }));

    // Kits list
    const kits = [];
    if(state.kitId) kits.push(state.kitId);

    // Abilities from talents
    const abilities = (state.selectedTalents||[]).map(t=>({
      id: t.id,
      name: t.name || "",
      type: "Talent",
      hit: "",
      effect: t.description || "",
      cooldown: ""
    }));

    // Spells (filtered)
    const spells = (state.selectedSpells||[])
      .filter(s=>{
        if(!isCasterClass(classId)) return false;
        const maxTier = maxSpellTierFor(classId, level);
        const tier = Number(s.tier ?? s.level ?? 0);
        if(maxTier >= 0 && tier > maxTier) return false;
        if(Array.isArray(s.classIds) && !s.classIds.includes(classId)) return false;
        if(s.minLevel && Number(s.minLevel) > level) return false;
        return true;
      })
      .map(s=>({
        id: s.id,
        modernName: s.modernName || s.name || "",
        tier: (s.tier ?? s.level ?? ""),
        castTime: s.castTime || s.cast || "",
        concentration: !!s.concentration,
        summary: s.summary || s.description || s.effect || ""
      }));

    const sheet = {
      vitals: { hpCur: state.vitals.hpMax, hpMax: state.vitals.hpMax, hpTemp: "", ac: state.vitals.ac, init: state.vitals.init, speed: state.vitals.speed },
      money:  { cash: state.cash, bank: state.bank },
      stats: state.stats,
      conditions: [],
      background: bgName,
      species: state.species,
      traits: state.traits,
      notes: state.notes
    };

    ui.btnOk.textContent = "Creating…";
    ui.btnOk.disabled = true;
    btnBack.disabled = true;
    ui.btnCan.disabled = true;

    try{
      const res = await api("/api/character/new", {
        method: "POST",
        body: JSON.stringify({
          name: state.name,
          classId,
          subclassId,
          level,
          setupComplete: true,
          kits,
          weapons,
          inventory,
          abilities,
          spells,
          sheet
        })
      });

      if(!(res && res.ok)){
        ui.btnOk.textContent = "Create";
        ui.btnOk.disabled = false;
        btnBack.disabled = false;
        ui.btnCan.disabled = false;
        toast(res?.error || "Failed to create character");
        return;
      }

      window.SESSION = window.SESSION || {};
      SESSION.activeCharId = res.id;
      SESSION.activeCtab = "sheet";

      close(true);
      toast("Character created");
      await refreshAll();
      vwRestoreCtab();
    }catch(err){
      console.error(err);
      ui.btnOk.textContent = "Create";
      ui.btnOk.disabled = false;
      btnBack.disabled = false;
      ui.btnCan.disabled = false;
      toast("Failed to create character");
    }
  };

  vwSetModalOpen(true);
  ui.modal.style.display = "flex";
  showStep(1);
  setTimeout(()=>qs("vwCreateName")?.focus(), 50);
});



    if(!result) return;

  }catch(e){
    console.error(e);
    toast("Failed to open character creation");
  }
});

document.getElementById("deleteCharBtn")?.addEventListener("click", async ()=>{
  try{
    const c = (typeof getChar==="function") ? getChar() : null;
    if(!c){ toast("Select a character first"); return; }
    const canDelete = (SESSION.role==="dm") || (SESSION.userId && c.ownerUserId===SESSION.userId);
    if(!canDelete){ toast("Only the owner (or DM) can delete"); return; }
    if(typeof vwModalConfirm === "function"){
      const ok = await vwModalConfirm({
        title: "Delete Character",
        message: "This permanently deletes " + (c.name||"this character") + ".\n\nContinue?",
        okText: "Delete",
        cancelText: "Cancel"
      });
      if(!ok) return;
    }else{
      if(!confirm("Delete "+(c.name||"this character")+"?")) return;
    }

    const res = await api("/api/character/delete", { method:"POST", body: JSON.stringify({ charId: c.id }) });
    if(res && res.ok){
      toast("Character deleted");
      // pick next available character
      const st = await api("/api/state");
      const list = st.characters || [];
      SESSION.activeCharId = list.length ? list[0].id : null;
      await refreshAll();
    }else{
      toast(res?.error || "Delete failed");
    }
  }catch(e){
    console.error(e);
    toast("Delete failed");
  }
});

document.getElementById("addInvBtn")?.addEventListener("click", async ()=>{
  const c = getChar();
  if(!c){ toast("Create character first"); return; }

  const cat = (typeof vwGetCatalog==="function") ? vwGetCatalog() : (window.VW_CHAR_CATALOG || window.VEILWATCH_CATALOG);
  const groups =
    cat?.inventoryItemsByCategory ||
    cat?.inventory_items_by_category ||
    cat?.inventoryByCategory ||
    null;

  const categories = groups ? Object.keys(groups) : [];
  const safeCats = categories.length ? categories : ["General"];

  if(typeof vwModalForm !== "function"){
    // fallback: old behavior
    c.inventory ||= [];
    c.inventory.push({category:"",name:"",weight:"",qty:"1",cost:"",notes:""});
    const res = await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
    if(res && res.ok){ toast("Added inventory row"); await refreshAll(); }
    else toast(res.error||"Failed");
    return;
  }

  // Step 1: choose category
  const step1 = await vwModalForm({
    title: "Add Inventory Item",
    okText: "Next",
    fields: [
      { key:"category", label:"Category", type:"select", options: safeCats.map(x=>({ value:x, label:x })) }
    ]
  });
  if(!step1) return;

  const items = groups ? (groups[step1.category] || []) : [];
  const hasItems = Array.isArray(items) && items.length;

  // Step 2: choose item + details
  const step2 = await vwModalForm({
    title: "Add Inventory Item",
    okText: "Add",
    fields: [
      ...(hasItems
        ? [{ key:"name", label:"Item", type:"select", options: items.map(n=>({ value:n, label:n })) }]
        : [{ key:"name", label:"Item", placeholder:"Item name" }]),
      { key:"qty", label:"Qty", placeholder:"1" },
      { key:"weight", label:"Weight", placeholder:"" },
      { key:"cost", label:"Cost ($)", placeholder:"" },
      { key:"notes", label:"Notes", placeholder:"Optional" }
    ]
  });
  if(!step2) return;

  c.inventory ||= [];
  c.inventory.push({
    category: step1.category || "",
    name: step2.name || "",
    weight: step2.weight || "",
    qty: step2.qty || "1",
    cost: step2.cost || "",
    notes: step2.notes || ""
  });

  const res = await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
  if(res && res.ok){ toast("Inventory item added"); await refreshAll(); }
  else toast(res?.error || "Failed");
});

document.getElementById("addInvFromCatalogBtn")?.addEventListener("click", async ()=>{
  try{
    const c = (typeof getChar==="function") ? getChar() : null;
    if(!c){ toast("Create character first"); return; }

    const cat = (typeof vwGetCatalog==="function") ? vwGetCatalog() : (window.VW_CHAR_CATALOG || window.VEILWATCH_CATALOG);
    const groups = cat?.inventoryItemsByCategory || cat?.inventory_items_by_category || cat?.inventoryByCategory;
    if(!groups){ toast("Catalog not loaded"); return; }

    const categories = Object.keys(groups||{});
    if(!categories.length){ toast("Catalog has no inventory"); return; }
    if(typeof vwModalForm !== "function"){ toast("Modal not available"); return; }

    const step1 = await vwModalForm({
      title: "Add From Catalog",
      okText: "Next",
      fields: [{ key:"category", label:"Category", type:"select", options: categories.map(x=>({value:x,label:x})) }]
    });
    if(!step1) return;

    const items = (groups[step1.category] || []);
    if(!items.length){ toast("No items in that category"); return; }

    const step2 = await vwModalForm({
      title: "Add From Catalog",
      okText: "Add",
      fields: [
        { key:"name", label:"Item", type:"select", options: items.map(n=>({value:n,label:n})) },
        { key:"qty", label:"Qty", placeholder:"1" }
      ]
    });
    if(!step2) return;

    c.inventory ||= [];
    c.inventory.push({ category: step1.category, name: step2.name, weight:"", qty: step2.qty || "1", cost:"", notes:"" });
    await vwSaveChar(c);
    toast("Item added");
    await refreshAll();
  }catch(e){
    console.error(e);
    toast("Failed to add from catalog");
  }
});


// ---- Character mode (Creation vs Sheet-only) ----
function vwIsSetupComplete(c){
  // If field missing (legacy), treat as complete so existing characters aren't forced back into creation flow.
  return c && (c.setupComplete !== false);
}

function vwRestoreCtab(){
  try{
    window.SESSION = window.SESSION || {};
    const desired = SESSION.activeCtab || "sheet";
    const bar = document.getElementById("sheetCtabBar") || document;
    const btn = bar.querySelector(`[data-ctab="${desired}"]`) || bar.querySelector('[data-ctab="sheet"]');
    if(btn) btn.click();
  }catch(e){}
}

function vwUpdateCharacterModeUI(){
  const sheetBar = document.getElementById("sheetCtabBar");
  const createBar = document.getElementById("createCtabBar");
  if(sheetBar) sheetBar.classList.remove("hidden");
  if(createBar) createBar.classList.add("hidden");
  const cb = document.getElementById("creationBlock");
  if(cb) cb.classList.add("hidden");
}

function vwUpdateCharSummaryRow(){
  const row = document.getElementById("charSummaryRow");
  if(!row) return;

  const c = (typeof getChar==="function") ? getChar() : null;
  const st = window.__STATE || {};
  const cat = (typeof vwGetCatalog==="function") ? vwGetCatalog() : (window.VW_CHAR_CATALOG || window.VEILWATCH_CATALOG);

  const set = (id, val)=>{
    const el = document.getElementById(id);
    if(el) el.textContent = val;
  };

  if(!c){
    set("charSummaryPlayer", "Player: —");
    set("charSummaryClass", "Class: —");
    set("charSummarySubclass", "Subclass: —");
    set("charSummaryHP", "HP: —");
    set("charSummaryAC", "AC: —");
    set("charSummaryInit", "Init: —");
    set("charSummarySpeed", "Speed: —");
    set("charSummaryMoney", "Money: —");
    return;
  }

  // Player / owner
  let ownerName = "—";
  try{
    const u = (st.users||[]).find(x=>x.id===c.ownerUserId);
    ownerName = u?.name || u?.username || u?.email || ownerName;
  }catch(e){}
  if(!ownerName || ownerName==="—"){
    try{ ownerName = SESSION?.username || SESSION?.userId || "—"; }catch(e){}
  }

  // Class + Subclass names from catalog when possible
  const classes = Array.isArray(cat?.classes) ? cat.classes : [];
  const className = classes.find(x=>x.id===c.classId)?.name || c.className || c.classId || "—";

  let subclassName = c.subclassId || c.subclassName || "—";
  try{
    const subsBy = cat?.subclassesByClass || {};
    const list = Array.isArray(subsBy?.[c.classId]) ? subsBy[c.classId] : (Array.isArray(cat?.subclasses) ? cat.subclasses : []);
    const sub = (list||[]).find(s=>s.id===c.subclassId);
    if(sub) subclassName = sub.name || sub.id || subclassName;
  }catch(e){}

  // Vitals + money (read-only display)
  const v = (c.sheet && c.sheet.vitals) ? c.sheet.vitals : {};
  const hpCur = (v.hpCur ?? "");
  const hpMax = (v.hpMax ?? "");
  const hpTxt = (hpCur!=="" || hpMax!=="") ? `HP: ${hpCur || "—"} / ${hpMax || "—"}` : "HP: —";
  const acTxt = (v.ac ?? "")!=="" ? `AC: ${v.ac}` : "AC: —";
  const initTxt = (v.init ?? "")!=="" ? `Init: ${v.init}` : "Init: —";
  const speedTxt = (v.speed ?? "")!=="" ? `Speed: ${v.speed}` : "Speed: —";

  const m = (c.sheet && c.sheet.money) ? c.sheet.money : {};
  const cash = (m.cash ?? "");
  const bank = (m.bank ?? "");
  const moneyTxt = (cash!=="" || bank!=="") ? `Money: $${cash || "0"} / $${bank || "0"}` : "Money: —";

  set("charSummaryPlayer", `Player: ${ownerName}`);
  set("charSummaryClass", `Class: ${className}`);
  set("charSummarySubclass", `Subclass: ${subclassName || "—"}`);
  set("charSummaryHP", hpTxt);
  set("charSummaryAC", acTxt);
  set("charSummaryInit", initTxt);
  set("charSummarySpeed", speedTxt);
  set("charSummaryMoney", moneyTxt);
}


// Helper: replace node to clear old/bad listeners
function vwRebindButton(id, handler){
  const old = document.getElementById(id);
  if(!old) return null;
  const fresh = old.cloneNode(true);
  old.parentNode.replaceChild(fresh, old);
  fresh.addEventListener("click", handler);
  return fresh;
}

// ---- Fix/Bind Abilities + Spells + Weapons + Save text tabs ----
vwRebindButton("addWeaponBtn", async ()=>{
  try{
    const c = getChar();
    if(!c){ toast("Create character first"); return; }
    const cat = vwGetCatalog ? vwGetCatalog() : (window.VW_CHAR_CATALOG || window.VEILWATCH_CATALOG);
    const w = cat?.weapons || {};
    const buckets = [
      ["Sidearms", w.sidearms || []],
      ["Primaries", w.primaries || []],
      ["Nonlethal", w.nonlethal || []],
      ["Melee", w.melee || []],
      ["Heavy (restricted)", w.heavy_restricted || []],
    ];
    const opts = [{ value:"__custom__", label:"(Custom Weapon…)" }];
    buckets.forEach(([label, list])=>{
      (list||[]).forEach(it=>{
        const nm = it.name || it;
        const id = it.id ? `id:${it.id}` : `name:${nm}`;
        opts.push({ value:id, label:`${label}: ${nm}` });
      });
    });
    if(opts.length<=1){ toast("Catalog has no weapons"); return; }
    if(typeof vwModalForm !== "function"){ toast("Modal not available"); return; }

    const pick = await vwModalForm({
      title: "Add Weapon",
      okText: "Next",
      fields: [{ key:"pick", label:"Weapon", type:"select", options: opts }]
    });
    if(!pick) return;

    let weapon = { name:"", range:"", hit:"", dmg:"" };

    if(pick.pick === "__custom__"){
      const det = await vwModalForm({
        title:"Custom Weapon",
        okText:"Add",
        fields:[
          { key:"name", label:"Weapon Name" },
          { key:"range", label:"Range", placeholder:"e.g., 30/120" },
          { key:"hit", label:"Hit/DC", placeholder:"e.g., +5 / DC 14" },
          { key:"dmg", label:"Damage", placeholder:"e.g., 1d8+3" },
          { key:"notes", label:"Notes", placeholder:"Optional" },
        ]
      });
      if(!det) return;
      weapon = { name:det.name||"", range:det.range||"", hit:det.hit||"", dmg:det.dmg||"", notes:det.notes||"" };
    }else{
      const val = pick.pick;
      let chosen = null;
      buckets.forEach(([_, list])=>{
        (list||[]).forEach(it=>{
          const nm = it.name || it;
          const id = it.id ? `id:${it.id}` : `name:${nm}`;
          if(id === val) chosen = it;
        });
      });
      weapon.name = chosen?.name || (typeof chosen==="string" ? chosen : "");
      weapon.ammoModel = chosen?.ammoModel || "";
      weapon.ammoType  = chosen?.ammoTypeDefault || "";
    }

    c.weapons ||= [];
    c.weapons.push(weapon);

    const res = await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
    if(res && res.ok){ toast("Weapon added"); await refreshAll(); }
    else toast(res?.error || "Failed");
  }catch(e){ console.error(e); toast("Failed"); }
});

vwRebindButton("addAbilityBtn", async ()=>{
  try{
    const c = getChar();
    if(!c){ toast("Create character first"); return; }
    const cat = vwGetCatalog ? vwGetCatalog() : (window.VW_CHAR_CATALOG || window.VEILWATCH_CATALOG);
    const list = (cat?.abilities || []).slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));
    if(typeof vwModalForm !== "function"){ toast("Modal not available"); return; }

    const pick = await vwModalForm({
      title: "Add Ability",
      okText: "Next",
      fields: [{
        key:"aid",
        label:"Ability",
        type:"select",
        options: [{ value:"__custom__", label:"(Custom Ability…)" }].concat(list.map(a=>({ value:a.id||a.name, label:a.name })))
      }]
    });
    if(!pick) return;

    let ab = { name:"", type:"", hit:"", effect:"", cooldown:"" };

    if(pick.aid === "__custom__"){
      const det = await vwModalForm({
        title:"Custom Ability",
        okText:"Add",
        fields:[
          { key:"name", label:"Name" },
          { key:"type", label:"Type", placeholder:"active / passive" },
          { key:"hit", label:"Hit/DC", placeholder:"Optional" },
          { key:"effect", label:"Effect" },
          { key:"cooldown", label:"Cooldown", placeholder:"short rest / long rest / -"},
        ]
      });
      if(!det) return;
      ab = { name:det.name||"", type:det.type||"", hit:det.hit||"", effect:det.effect||"", cooldown:det.cooldown||"" };
    }else{
      const found = list.find(a=>(a.id||a.name)===pick.aid) || null;
      if(!found){ toast("Ability not found"); return; }
      ab = { name:found.name||"", type:found.type||"", hit:found.hit||"", effect:found.effect||found.summary||"", cooldown:found.cooldown||"" };
    }

    c.abilities ||= [];
    c.abilities.push(ab);

    const res = await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
    if(res && res.ok){ toast("Ability added"); await refreshAll(); }
    else toast(res?.error || "Failed");
  }catch(e){ console.error(e); toast("Failed"); }
});

vwRebindButton("addSpellBtn", async ()=>{
  try{
    const c = getChar();
    if(!c){ toast("Create character first"); return; }
    const cat = vwGetCatalog ? vwGetCatalog() : (window.VW_CHAR_CATALOG || window.VEILWATCH_CATALOG);
    const list = (cat?.spells || []).slice().sort((a,b)=>String(a.modernName||a.name||"").localeCompare(String(b.modernName||b.name||"")));
    if(typeof vwModalForm !== "function"){ toast("Modal not available"); return; }

    const pick = await vwModalForm({
      title: "Add Spell",
      okText: "Next",
      fields: [{
        key:"sid",
        label:"Spell",
        type:"select",
        options: [{ value:"__custom__", label:"(Custom Spell…)" }].concat(list.map(s=>({ value:s.id||s.modernName||s.name, label:(s.modernName||s.name) })))
      }]
    });
    if(!pick) return;

    let sp = { modernName:"", tier:"", castTime:"", concentration:false, summary:"" };

    if(pick.sid === "__custom__"){
      const det = await vwModalForm({
        title:"Custom Spell",
        okText:"Add",
        fields:[
          { key:"name", label:"Name" },
          { key:"tier", label:"Tier", placeholder:"0-8" },
          { key:"castTime", label:"Cast Time", placeholder:"Action / Bonus / Reaction" },
          { key:"concentration", label:"Concentration", type:"select", options:[{value:"",label:"No"},{value:"yes",label:"Yes"}] },
          { key:"summary", label:"Summary" },
        ]
      });
      if(!det) return;
      sp = { modernName:det.name||"", tier:det.tier||"", castTime:det.castTime||"", concentration:(det.concentration==="yes"), summary:det.summary||"" };
    }else{
      const found = list.find(s=>(s.id||s.modernName||s.name)===pick.sid) || null;
      if(!found){ toast("Spell not found"); return; }
      sp = {
        id: found.id,
        modernName: found.modernName || found.name || "",
        tier: (found.tier ?? found.level ?? ""),
        castTime: found.castTime || found.cast || "",
        concentration: !!found.concentration,
        summary: found.summary || found.description || ""
      };
    }

    c.spells ||= [];
    c.spells.push(sp);

    const res = await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
    if(res && res.ok){ toast("Spell added"); await refreshAll(); }
    else toast(res?.error || "Failed");
  }catch(e){ console.error(e); toast("Failed"); }
});

// Save handlers for Background / Traits / Notes
vwRebindButton("saveBgBtn", async ()=>{
  const c=getChar(); if(!c) return;
  c.sheet ||= {};
  c.sheet.background = document.getElementById("bgText")?.value || "";
  const res = await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
  if(res && res.ok){ toast("Saved"); await refreshAll(); } else toast(res?.error||"Failed");
});
vwRebindButton("saveTraitsBtn", async ()=>{
  const c=getChar(); if(!c) return;
  c.sheet ||= {};
  c.sheet.traits = document.getElementById("traitsText")?.value || "";
  const res = await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
  if(res && res.ok){ toast("Saved"); await refreshAll(); } else toast(res?.error||"Failed");
});
vwRebindButton("saveNotesBtn", async ()=>{
  const c=getChar(); if(!c) return;
  c.sheet ||= {};
  c.sheet.notes = document.getElementById("notesText")?.value || "";
  const res = await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
  if(res && res.ok){ toast("Saved"); await refreshAll(); } else toast(res?.error||"Failed");
});

// Finish Creation
vwRebindButton("finishCharBtn", async ()=>{
  const c=getChar(); if(!c) return;
  c.setupComplete = true;
  const res = await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
  if(res && res.ok){
    toast("Character created");
    await refreshAll();
    vwUpdateCharacterModeUI();
  } else toast(res?.error||"Failed");
});

// Ensure mode UI is updated whenever we render
const __vw_old_renderCharacter = (typeof renderCharacter === "function") ? renderCharacter : null;
renderCharacter = window.renderCharacter = function(){
  if(__vw_old_renderCharacter) __vw_old_renderCharacter();
  try{ vwUpdateCharacterModeUI(); vwUpdateCharSummaryRow(); }catch(e){}
};
const __vw_old_renderSheet = (typeof renderSheet === "function") ? renderSheet : null;
renderSheet = window.renderSheet = function(){
  if(__vw_old_renderSheet) __vw_old_renderSheet();
  try{ vwUpdateCharacterModeUI(); vwUpdateCharSummaryRow(); }catch(e){}
};

function vwGetCatalog(){
  return window.VW_CHAR_CATALOG || window.VEILWATCH_CATALOG || null;
}
function vwFillSelect(sel, options, placeholder){
  if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = placeholder || "Select...";
  sel.appendChild(ph);
  (options||[]).forEach(o=>{
    const opt=document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    sel.appendChild(opt);
  });
  if(cur && [...sel.options].some(o=>o.value===cur)) sel.value = cur;
}

