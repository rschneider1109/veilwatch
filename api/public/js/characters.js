
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
    const init = (entry.initiative===0 || entry.initiative) ? entry.initiative : "";

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
        <div class="pill vwTapEdit" data-k="init">Init: ${esc(String(init||"--"))}</div>
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
            value: (entry.initiative===0 || entry.initiative) ? entry.initiative : "",
            minWidth: 72,
            onSave: async (initiative)=>{
              const res = await api("/api/dm/activeParty/initiative", { method:"POST", body: JSON.stringify({ charId: c.id, initiative })});
              if(res && res.ok){
                // update local state
                const st = window.__STATE || {};
                st.activeParty ||= [];
                const ix = st.activeParty.findIndex(x=>x.charId===c.id);
                if(ix>=0) st.activeParty[ix].initiative = initiative;
                window.__STATE = st;
                try{ renderDMActiveParty(); }catch(_){}
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
    const classes = (cat && Array.isArray(cat.classes)) ? cat.classes : [];
    const classOpts = classes.map(x=>({ value:x.id, label:x.name }));

    const step1 = (typeof vwModalForm === "function")
      ? await vwModalForm({
          title: "Create Character",
          okText: "Next",
          fields: [
            { key:"name", label:"Character Name", placeholder:"e.g., Rob S" },
            { key:"classId", label:"Class", type:"select", options: classOpts }
          ]
        })
      : null;

    if(!step1) return;

    const name = String(step1.name || "").trim();
    const classId = step1.classId || "";

    if(!name){ toast("Name is required"); return; }
    if(!classId){ toast("Class is required"); return; }

    const subs = (cat && cat.subclassesByClass && Array.isArray(cat.subclassesByClass[classId]))
      ? cat.subclassesByClass[classId]
      : [];
    const subOpts = [{ value:"", label:"None" }].concat(subs.map(x=>({ value:x.id, label:x.name })));

    const kitsById = (cat && cat.kits && cat.kits.byId) ? cat.kits.byId : {};
    const kitOpts = [{ value:"", label:"None" }].concat(
      Object.values(kitsById)
        .map(k=>({ value:k.id, label:(k.name + (k.category ? " ("+k.category+")" : "")) }))
        .sort((a,b)=>a.label.localeCompare(b.label))
    );

    const step2 = await vwModalForm({
      title: "Create Character",
      okText: "Create",
      fields: [
        { key:"subclassId", label:"Subclass", type:"select", options: subOpts },
        { key:"kitId", label:"Starter Kit", type:"select", options: kitOpts }
      ]
    });
    if(!step2) return;

    const res = await api("/api/character/new",{method:"POST",body:JSON.stringify({name, classId, subclassId: step2.subclassId||null})});
    if(!(res && res.ok)){ toast(res?.error || "Failed to create character"); return; }

    window.SESSION = window.SESSION || {};
    SESSION.activeCharId = res.id;
    SESSION.activeCtab = "sheet";

    await refreshAll();

    let c = getChar();
    if(!c){ toast("Character created, but could not load"); return; }

    c.classId = classId;
    c.subclassId = step2.subclassId || null;
    c.kits = Array.isArray(c.kits) ? c.kits : [];
    c.setupComplete = true;

    const kitId = step2.kitId || "";
    if(kitId){
      if(!c.kits.includes(kitId)) c.kits.push(kitId);
      const kit = kitsById[kitId];
      if(kit && Array.isArray(kit.items)){
        c.inventory = Array.isArray(c.inventory) ? c.inventory : [];
        kit.items.forEach(itemName=>{
          c.inventory.push({
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
    }

    await saveChar(c);
    toast("Character created");
    await refreshAll();
    vwRestoreCtab();
  }catch(e){
    console.error(e);
    toast("Failed to create character");
  }
});

document.getElementById("deleteCharBtn")?.addEventListener("click", async ()=>{
  try{
    if(!(window.SESSION && (SESSION.role==="dm" || (SESSION.userId && c && c.ownerUserId===SESSION.userId)))){ toast("Only the owner (or DM) can delete"); return; }
    const c = (typeof getChar==="function") ? getChar() : null;
    if(!c){ toast("Select a character first"); return; }

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
  try{ vwUpdateCharacterModeUI(); }catch(e){}
};
const __vw_old_renderSheet = (typeof renderSheet === "function") ? renderSheet : null;
renderSheet = window.renderSheet = function(){
  if(__vw_old_renderSheet) __vw_old_renderSheet();
  try{ vwUpdateCharacterModeUI(); }catch(e){}
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

