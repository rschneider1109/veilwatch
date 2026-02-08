
function vwGetCatalog(){ return window.VW_CHAR_CATALOG || null; }

function vwClassLabel(classId){
  const cat = vwGetCatalog();
  const c = (cat?.classes||[]).find(x=>x.id===classId);
  return c ? c.name : (classId||"—");
}
function vwSubclassLabel(classId, subclassId){
  const cat = vwGetCatalog();
  const arr = (cat?.subclassesByClass||{})[classId] || [];
  const s = arr.find(x=>x.id===subclassId);
  return s ? s.name : (subclassId||"—");
}
function vwFindWeapon(weaponId){
  const cat = vwGetCatalog();
  if(!cat) return null;
  const groups = cat.weapons || {};
  for(const g of Object.keys(groups)){
    const arr = groups[g] || [];
    const w = arr.find(x=>x.id===weaponId);
    if(w) return {group:g, def:w};
  }
  return null;
}
function vwWeaponToRow(weaponId){
  const found = vwFindWeapon(weaponId);
  const id = (crypto.randomUUID?.() || ("w_"+Math.random().toString(16).slice(2)));
  if(!found) return { id, name: weaponId, range:"", hit:"", damage:"" };
  const def = found.def;
  const row = { id, name: def.name, range:"", hit:"", damage:"" };
  if(def.ammoModel){
    row.ammo = { model:def.ammoModel, type:def.ammoTypeDefault||"", starting:"FULL", current:"FULL", mags:(def.ammoModel==="mag"?"2 spare (empty)":"—") };
  }
  if(def.restricted) row.restricted = true;
  return row;
}
function vwItemsToInventory(items){
  const cat = vwGetCatalog();
  const by = cat?.inventoryItemsByCategory || {};
  const map = {};
  Object.keys(by).forEach(k=>(by[k]||[]).forEach(n=>map[n]=k));
  return (items||[]).map(name=>({ category: map[name]||"Gear", name, weight:"", qty:"1", cost:"", notes:"" }));
}

async function vwNewCharacterWizard(){
  const cat = vwGetCatalog();
  if(!cat){ toast("Catalog not loaded. Check /js/veilwatch_catalog.js"); return null; }

  // Step 1: Identity + Class
  const step1 = await vwModalForm({
    title:"New Character (1/4) — Identity",
    okText:"Next",
    fields:[
      { key:"name", label:"Character Name", placeholder:"e.g. Mara Kincaid" },
      { key:"classId", label:"Class", type:"select", options: cat.classes.map(c=>({value:c.id,label:`${c.name} (${c.mapsTo})`})) },
      { key:"background", label:"Background", placeholder:"e.g. Ex-EMS, Street Artist, Former Fed..." }
    ]
  });
  if(!step1) return null;
  const name = String(step1.name||"").trim();
  const classId = String(step1.classId||"").trim();
  if(!name){ toast("Name required"); return null; }

  // Step 2: Subclass + Stats/Vitals
  const subs = (cat.subclassesByClass||{})[classId] || [];
  const step2 = await vwModalForm({
    title:"New Character (2/4) — Build",
    okText:"Next",
    fields:[
      { key:"subclassId", label:"Subclass", type:"select", options: [{value:"",label:"—"}].concat(subs.map(s=>({value:s.id,label:`${s.name} (${s.mapsTo})`})) ) },
      { key:"STR", label:"STR", placeholder:"10" },
      { key:"DEX", label:"DEX", placeholder:"10" },
      { key:"CON", label:"CON", placeholder:"10" },
      { key:"INT", label:"INT", placeholder:"10" },
      { key:"WIS", label:"WIS", placeholder:"10" },
      { key:"CHA", label:"CHA", placeholder:"10" },
      { key:"hpMax", label:"HP Max", placeholder:"10" },
      { key:"ac", label:"AC", placeholder:"10" },
      { key:"speed", label:"Speed", placeholder:"30" }
    ]
  });
  if(!step2) return null;

  // Step 3: Starter Pack
  const packs = cat.starterPacks || {};
  const step3 = await vwModalForm({
    title:"New Character (3/4) — Starter Pack",
    okText:"Next",
    fields:[
      { key:"packType", label:"Pack Type", type:"select", options:[
        {value:"recommended",label:"Recommended Starter Pack"},
        {value:"class",label:"Class Starter Pack"},
        {value:"scratch",label:"Scratch / No Pack"}
      ]},
      { key:"sidearm", label:"Sidearm (only for Scratch)", type:"select", options:(cat.weapons.sidearms||[]).map(w=>({value:w.id,label:w.name})) },
      { key:"primary", label:"Primary (only for Scratch)", type:"select", options:(cat.weapons.primaries||[]).map(w=>({value:w.id,label:w.name})) }
    ]
  });
  if(!step3) return null;
  const packType = String(step3.packType||"recommended");
  let kitName = "";
  let sidearmId = "";
  let primaryId = "";
  let packItems = [];

  if(packType==="recommended" && packs.recommended){
    kitName = packs.recommended.name || "Recommended Starter Pack";
    sidearmId = packs.recommended.sidearm;
    primaryId = packs.recommended.primary;
    packItems = packs.recommended.items || [];
  }else if(packType==="class"){
    kitName = "Class Starter Pack";
    const by = (packs.byClass||{})[classId];
    if(by){
      sidearmId = by.sidearm;
      primaryId = by.primary;
      packItems = by.items || [];
    }else if(packs.recommended){
      kitName = packs.recommended.name || "Recommended Starter Pack";
      sidearmId = packs.recommended.sidearm;
      primaryId = packs.recommended.primary;
      packItems = packs.recommended.items || [];
    }
  }else{
    kitName = "Scratch / No Pack";
    sidearmId = String(step3.sidearm||"").trim();
    primaryId = String(step3.primary||"").trim();
  }

  // enforce 1 sidearm + 1 primary
  const s = vwFindWeapon(sidearmId);
  const p = vwFindWeapon(primaryId);
  if(!s || s.group!=="sidearms"){ toast("Starter packs require 1 Sidearm."); return null; }
  if(!p || p.group!=="primaries"){ toast("Starter packs require 1 Primary."); return null; }

  // Step 4: Notes
  const step4 = await vwModalForm({
    title:"New Character (4/4) — Notes",
    okText:"Create",
    fields:[{ key:"notes", label:"Bio / Notes", type:"textarea", placeholder:"Short bio, hooks, session notes…" }]
  });
  if(step4===null) return null;

  // create minimal then save full
  const res = await api("/api/character/new", { method:"POST", body: JSON.stringify({ name }) });
  if(!(res && res.ok)){ toast((res && res.error) ? res.error : "Failed to create character"); return null; }

  const newChar = {
    id: res.id,
    name,
    weapons: [ vwWeaponToRow(sidearmId), vwWeaponToRow(primaryId) ],
    abilities: [],
    spells: [],
    inventory: vwItemsToInventory(packItems),
    sheet: {
      profile: { classId, subclassId: String(step2.subclassId||""), background: String(step1.background||""), kit: kitName, packType },
      vitals: { hpCur:"", hpMax:String(step2.hpMax||""), hpTemp:"", ac:String(step2.ac||""), init:"", speed:String(step2.speed||"") },
      money: { cash:"", bank:"" },
      stats: { STR:String(step2.STR||""), DEX:String(step2.DEX||""), CON:String(step2.CON||""), INT:String(step2.INT||""), WIS:String(step2.WIS||""), CHA:String(step2.CHA||"") },
      conditions: [],
      notes: String(step4.notes||"")
    }
  };

  const sres = await api("/api/character/save", { method:"POST", body: JSON.stringify({ charId:newChar.id, character:newChar }) });
  if(!(sres && sres.ok)){ toast((sres && sres.error)? sres.error : "Created, but failed to save details"); }

  return newChar.id;
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

  // abilities rows
  const abilBody=document.getElementById("abilBody");
  if(abilBody){
    abilBody.innerHTML="";
    (c.abilities||[]).forEach(a=>{
      const tr=document.createElement("tr");
      tr.innerHTML = '<td>'+esc(a.name||"")+'</td><td>'+esc(a.type||"")+'</td><td>'+esc(a.hit||"")+'</td><td>'+esc(a.effect||"")+'</td><td><button class="btn smallbtn">Remove</button></td>';
      tr.querySelector('button').onclick=async ()=>{
        c.abilities = (c.abilities||[]).filter(x=>x.id!==a.id);
        await api('/api/character/save',{method:'POST',body:JSON.stringify({charId:c.id, character:c})});
        toast('Removed ability'); await refreshAll();
      };
      abilBody.appendChild(tr);
    });
  }

  // spells rows
  const spellBody=document.getElementById("spellBody");
  if(spellBody){
    spellBody.innerHTML="";
    (c.spells||[]).forEach(s=>{
      const tr=document.createElement("tr");
      tr.innerHTML = '<td>'+esc(s.name||"")+'</td><td>'+esc(s.level||"")+'</td><td>'+esc(s.cast||"")+'</td><td>'+esc(s.effect||"")+'</td><td><button class="btn smallbtn">Remove</button></td>';
      tr.querySelector('button').onclick=async ()=>{
        c.spells = (c.spells||[]).filter(x=>x.id!==s.id);
        await api('/api/character/save',{method:'POST',body:JSON.stringify({charId:c.id, character:c})});
        toast('Removed spell'); await refreshAll();
      };
      spellBody.appendChild(tr);
    });
  }

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
    // NOTE: core attributes (STR/DEX/...) are set at creation and read-only on the sheet.

    ["hpCur",  ["vitals","hpCur"]],
    ["hpMax",  ["vitals","hpMax"]],
    ["hpTemp", ["vitals","hpTemp"]],
    ["acVal",  ["vitals","ac"]],
    ["initVal",["vitals","init"]],
    ["spdVal", ["vitals","speed"]],
    ["cashVal",["money","cash"]],
    ["bankVal",["money","bank"]],    ["notesBio",["notes"]]
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

  // profile (class/subclass/background/kit)
  const prof = (c.sheet.profile || {});
  const elC = document.getElementById("profClass"); if(elC) elC.value = vwClassLabel(prof.classId) || "—";
  const elS = document.getElementById("profSubclass"); if(elS) elS.value = vwSubclassLabel(prof.classId, prof.subclassId) || "—";
  const elB = document.getElementById("profBackground"); if(elB) elB.value = prof.background || "—";
  const elK = document.getElementById("profKit"); if(elK) elK.value = prof.kit || "—";

  // lock stats on the sheet (set at creation)
  ["statSTR","statDEX","statCON","statINT","statWIS","statCHA"].forEach((id)=>{
    const el = document.getElementById(id);
    if(el){ el.disabled = true; el.classList.add("readonly"); }
  });

  document.getElementById("notesBio").value = (c.sheet.notes ?? "");

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
  document.getElementById("delCharBtn").classList.toggle("hidden", SESSION.role!=="dm");
}
window.renderSheet = renderSheet;

document.getElementById("saveSheetBtn").onclick = async ()=>{
  const c=getChar(); if(!c){ toast("No character"); return; }
  if(typeof vwFlushCharAutosave==="function") await vwFlushCharAutosave();
  toast("Saved");
  await refreshAll();
};


// --- Duplicate Character (DM) ---
document.getElementById("dupCharBtn")?.addEventListener("click", async ()=>{
  if(SESSION.role!=="dm") return;
  const c = (typeof getChar==="function") ? getChar() : null;
  if(!c){ toast("No character selected"); return; }
  const name = await vwModalInput({ title:"Duplicate Character", label:"New name", value: (c.name||"Character") + " (Copy)" });
  if(!name) return;
  const res = await api("/api/character/duplicate", { method:"POST", body: JSON.stringify({ charId: c.id, name }) });
  if(res && res.ok){
    SESSION.activeCharId = res.id;
    toast("Character duplicated");
    await refreshAll();
  }else{
    toast((res && res.error) ? res.error : "Failed to duplicate");
  }
});

// Minimal DM Active Party renderer (no tap-to-edit yet).
function renderDMActiveParty(){
  try{
    if(SESSION.role!=="dm") return;
    const host = document.getElementById("dmActivePartyCards");
    if(!host) return;
    const st = window.__STATE || {};
    const active = Array.isArray(st.activeParty) ? st.activeParty : [];
    const chars = Array.isArray(st.characters) ? st.characters : [];
    host.innerHTML = "";
    for(const entry of active){
      const c = chars.find(x=>x.id===entry.charId);
      if(!c) continue;
      const card = document.createElement("div");
      card.className = "card";
      const v = (c.sheet && c.sheet.vitals) ? c.sheet.vitals : {};
      const s = (c.sheet && c.sheet.stats) ? c.sheet.stats : {};
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
          <div class="pill">HP: ${esc(v.hpCur??"--")}/${esc(v.hpMax??"--")}</div>
          <div class="pill">AC: ${esc(v.ac??"--")}</div>
          <div class="pill">Init: ${esc((entry.initiative===0||entry.initiative)?String(entry.initiative):"--")}</div>
        </div>
        <div class="grid" style="grid-template-columns:repeat(6,1fr);gap:8px;margin-top:10px;">
          <div class="pill">STR ${esc(s.STR||"--")}</div>
          <div class="pill">DEX ${esc(s.DEX||"--")}</div>
          <div class="pill">CON ${esc(s.CON||"--")}</div>
          <div class="pill">INT ${esc(s.INT||"--")}</div>
          <div class="pill">WIS ${esc(s.WIS||"--")}</div>
          <div class="pill">CHA ${esc(s.CHA||"--")}</div>
        </div>
        <div class="row" style="margin-top:10px;justify-content:space-between;">
          <button class="btn smallbtn" data-act="remove">Remove</button>
        </div>
      `;
      card.querySelector('button[data-act="open"]')?.addEventListener("click", async ()=>{
        SESSION.activeCharId = c.id;
        try{ renderTabs("character"); }catch(_){ }
        await refreshAll();
      });
      card.querySelector('button[data-act="remove"]')?.addEventListener("click", async ()=>{
        const res = await api("/api/dm/activeParty/remove", { method:"POST", body: JSON.stringify({ charId: c.id })});
        if(res && res.ok) await refreshAll();
        else toast((res && res.error) ? res.error : "Failed");
      });
      host.appendChild(card);
    }
  }catch(_){ }
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
      if(!created || !created.ok){ toast((created && created.error) ? created.error : "Failed"); return; }

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

// --- New Character Wizard ---
document.getElementById("newCharBtn")?.addEventListener("click", async ()=>{
  const id = await vwNewCharacterWizard();
  if(!id) return;
  SESSION.activeCharId = id;
  toast("Character created");
  await refreshAll();
});

// --- Add buttons (catalog assisted) ---
document.getElementById("addWeaponBtn")?.addEventListener("click", async ()=>{
  const c=getChar(); if(!c){ toast("No character"); return; }
  const cat=vwGetCatalog(); if(!cat){ toast("Catalog not loaded"); return; }
  const all = (cat.weapons.sidearms||[]).concat(cat.weapons.primaries||[]).concat(cat.weapons.nonlethal||[]).concat(cat.weapons.melee||[]);
  const pick = await vwModalForm({
    title:"Add Weapon",
    okText:"Add",
    fields:[{ key:"weaponId", label:"Weapon", type:"select", options: all.map(w=>({value:w.id,label:w.name})) }]
  });
  if(!pick) return;
  const wid = String(pick.weaponId||"").trim();
  c.weapons ||= [];
  c.weapons.push(vwWeaponToRow(wid));
  await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
  toast("Weapon added"); await refreshAll();
});

document.getElementById("addAbilityBtn")?.addEventListener("click", async ()=>{
  const c=getChar(); if(!c){ toast("No character"); return; }
  const out = await vwModalForm({
    title:"Add Ability",
    okText:"Add",
    fields:[
      {key:"name",label:"Ability Name",placeholder:"e.g. Adrenal Spike"},
      {key:"type",label:"Type",placeholder:"passive / active / reaction"},
      {key:"hit",label:"Hit/DC",placeholder:"—"},
      {key:"effect",label:"Effect",placeholder:"Describe the effect"}
    ]
  });
  if(!out) return;
  c.abilities ||= [];
  c.abilities.push({ id:(crypto.randomUUID?.()||("a_"+Math.random().toString(16).slice(2))), name:out.name||"", type:out.type||"", hit:out.hit||"", effect:out.effect||"" });
  await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
  toast("Ability added"); await refreshAll();
});

document.getElementById("addSpellBtn")?.addEventListener("click", async ()=>{
  const c=getChar(); if(!c){ toast("No character"); return; }
  const out = await vwModalForm({
    title:"Add Spell",
    okText:"Add",
    fields:[
      {key:"name",label:"Spell Name",placeholder:"e.g. Ghost Signal"},
      {key:"level",label:"Level",placeholder:"0-9"},
      {key:"cast",label:"Cast",placeholder:"action / bonus / reaction"},
      {key:"effect",label:"Effect",placeholder:"Describe the effect"}
    ]
  });
  if(!out) return;
  c.spells ||= [];
  c.spells.push({ id:(crypto.randomUUID?.()||("s_"+Math.random().toString(16).slice(2))), name:out.name||"", level:out.level||"", cast:out.cast||"", effect:out.effect||"" });
  await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
  toast("Spell added"); await refreshAll();
});

document.getElementById("addInvFromCatalogBtn")?.addEventListener("click", async ()=>{
  const c=getChar(); if(!c){ toast("No character"); return; }
  const cat=vwGetCatalog(); if(!cat){ toast("Catalog not loaded"); return; }
  const cats = Object.keys(cat.inventoryItemsByCategory||{});
  if(cats.length===0){ toast("No inventory catalog items"); return; }
  const chooseCat = await vwModalForm({
    title:"Add From Catalog",
    okText:"Next",
    fields:[{ key:"cat", label:"Category", type:"select", options: cats.map(x=>({value:x,label:x})) }]
  });
  if(!chooseCat) return;
  const itemNames = (cat.inventoryItemsByCategory||{})[chooseCat.cat] || [];
  const chooseItem = await vwModalForm({
    title:"Add From Catalog",
    okText:"Add",
    fields:[{ key:"name", label:"Item", type:"select", options: itemNames.map(n=>({value:n,label:n})) },{key:"qty",label:"Qty",placeholder:"1"}]
  });
  if(!chooseItem) return;
  c.inventory ||= [];
  c.inventory.push({ category: chooseCat.cat, name: chooseItem.name, weight:"", qty: chooseItem.qty||"1", cost:"", notes:"" });
  await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
  toast("Item added"); await refreshAll();
});