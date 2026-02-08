// ---- Character creation catalog (edit freely) ----
const VW_CHAR_CATALOG = {
  rulesets: [
    { id:"veilwatch_ops", name:"Veilwatch Ops" },
    { id:"dnd_core", name:"D&D Core" }
  ],
  classes: {
    veilwatch_ops: [
      { id:"operator", name:"Operator", subclasses:["Assault","Recon","Breacher"] },
      { id:"medic", name:"Medic", subclasses:["Trauma Surgeon","Field Paramedic","Combat Doc"] },
      { id:"tech", name:"Tech", subclasses:["Hacker","Engineer","Drone Wrangler"] },
      { id:"face", name:"Face", subclasses:["Fixer","Con Artist","Diplomat"] },
      { id:"mystic", name:"Mystic", subclasses:["Seer","Wardbinder","Void-Touched"] },
      { id:"heavy", name:"Heavy", subclasses:["Gunner","Shield","Demolitions"] }
    ],
    dnd_core: [
      { id:"barbarian", name:"Barbarian", subclasses:["Berserker","Totem","Zealot"] },
      { id:"bard", name:"Bard", subclasses:["Lore","Valor","Glamour"] },
      { id:"cleric", name:"Cleric", subclasses:["Life","War","Trickery"] },
      { id:"druid", name:"Druid", subclasses:["Land","Moon","Spores"] },
      { id:"fighter", name:"Fighter", subclasses:["Champion","Battle Master","Eldritch Knight"] },
      { id:"monk", name:"Monk", subclasses:["Open Hand","Shadow","Kensei"] },
      { id:"paladin", name:"Paladin", subclasses:["Devotion","Vengeance","Ancients"] },
      { id:"ranger", name:"Ranger", subclasses:["Hunter","Beast Master","Gloom Stalker"] },
      { id:"rogue", name:"Rogue", subclasses:["Thief","Assassin","Arcane Trickster"] },
      { id:"sorcerer", name:"Sorcerer", subclasses:["Draconic","Wild","Shadow"] },
      { id:"warlock", name:"Warlock", subclasses:["Fiend","Great Old One","Hexblade"] },
      { id:"wizard", name:"Wizard", subclasses:["Evocation","Illusion","Necromancy"] }
    ]
  },
  backgrounds: {
    veilwatch_ops: [
      "ECHO Operative","Street Runner","Corporate Defector","Underground Medic","Rift Researcher","Dockside Brawler","Data Courier","Ex-Cop","Fixer","Cult Escapee"
    ],
    dnd_core: [
      "Acolyte","Charlatan","Criminal","Entertainer","Folk Hero","Guild Artisan","Hermit","Noble","Outlander","Sage","Soldier","Urchin"
    ]
  },
  kits: {
    veilwatch_ops: [
      {
        id:"field_ops",
        name:"Field Ops Kit",
        inventory:[
          {category:"Kit", name:"Field pack", weight:"", qty:"1", cost:"", notes:"Basic gear, tape, rope, flashlight"},
          {category:"Tools", name:"Multitool", weight:"", qty:"1", cost:"", notes:""},
          {category:"Consumable", name:"Ration bar", weight:"", qty:"6", cost:"", notes:""},
          {category:"Consumable", name:"Water bottle", weight:"", qty:"2", cost:"", notes:""}
        ]
      },
      {
        id:"med_kit",
        name:"Medic Kit",
        inventory:[
          {category:"Kit", name:"Med kit", weight:"", qty:"1", cost:"", notes:"Bandages, disinfectant, wraps"},
          {category:"Consumable", name:"Painkiller tabs", weight:"", qty:"10", cost:"", notes:""},
          {category:"Tool", name:"Trauma shears", weight:"", qty:"1", cost:"", notes:""}
        ]
      },
      {
        id:"hacker_kit",
        name:"Hacker Kit",
        inventory:[
          {category:"Kit", name:"Hacker rig", weight:"", qty:"1", cost:"", notes:"Tablet, cables, adapters"},
          {category:"Tool", name:"Lock bypass set", weight:"", qty:"1", cost:"", notes:""},
          {category:"Consumable", name:"Spare batteries", weight:"", qty:"6", cost:"", notes:""}
        ]
      }
    ],
    dnd_core: [
      {
        id:"adventurers_pack",
        name:"Adventurer's Pack",
        inventory:[
          {category:"Gear", name:"Backpack", weight:"", qty:"1", cost:"", notes:""},
          {category:"Gear", name:"Bedroll", weight:"", qty:"1", cost:"", notes:""},
          {category:"Gear", name:"Rations", weight:"", qty:"10", cost:"", notes:""},
          {category:"Gear", name:"Waterskin", weight:"", qty:"1", cost:"", notes:""},
          {category:"Tools", name:"Tinderbox", weight:"", qty:"1", cost:"", notes:""},
          {category:"Gear", name:"Torch", weight:"", qty:"10", cost:"", notes:""},
          {category:"Gear", name:"Rope (50 ft)", weight:"", qty:"1", cost:"", notes:""}
        ]
      },
      {
        id:"explorers_pack",
        name:"Explorer's Pack",
        inventory:[
          {category:"Gear", name:"Backpack", weight:"", qty:"1", cost:"", notes:""},
          {category:"Gear", name:"Bedroll", weight:"", qty:"1", cost:"", notes:""},
          {category:"Gear", name:"Mess kit", weight:"", qty:"1", cost:"", notes:""},
          {category:"Gear", name:"Rations", weight:"", qty:"10", cost:"", notes:""},
          {category:"Gear", name:"Waterskin", weight:"", qty:"1", cost:"", notes:""},
          {category:"Gear", name:"Rope (50 ft)", weight:"", qty:"1", cost:"", notes:""}
        ]
      }
    ]
  },
  weapons: {
    veilwatch_ops: [
      { name:"Sidearm", range:"30 ft", hit:"+", damage:"1d6", ammo:{type:"9mm", starting:"45", current:"45", mags:"3"} },
      { name:"SMG", range:"60 ft", hit:"+", damage:"1d8", ammo:{type:"9mm", starting:"90", current:"90", mags:"3"} },
      { name:"Rifle", range:"150 ft", hit:"+", damage:"1d10", ammo:{type:"5.56", starting:"120", current:"120", mags:"4"} },
      { name:"Shotgun", range:"30 ft", hit:"+", damage:"1d10", ammo:{type:"12ga", starting:"30", current:"30", mags:"—"} },
      { name:"Combat Knife", range:"Melee", hit:"+", damage:"1d4", ammo:null },
      { name:"Taser", range:"15 ft", hit:"+", damage:"Stun", ammo:{type:"cartridge", starting:"2", current:"2", mags:"—"} }
    ],
    dnd_core: [
      { name:"Dagger", range:"20/60", hit:"+", damage:"1d4", ammo:null },
      { name:"Shortsword", range:"Melee", hit:"+", damage:"1d6", ammo:null },
      { name:"Longsword", range:"Melee", hit:"+", damage:"1d8", ammo:null },
      { name:"Greatsword", range:"Melee", hit:"+", damage:"2d6", ammo:null },
      { name:"Shortbow", range:"80/320", hit:"+", damage:"1d6", ammo:{type:"arrows", starting:"20", current:"20", mags:"—"} },
      { name:"Longbow", range:"150/600", hit:"+", damage:"1d8", ammo:{type:"arrows", starting:"20", current:"20", mags:"—"} },
      { name:"Light Crossbow", range:"80/320", hit:"+", damage:"1d8", ammo:{type:"bolts", starting:"20", current:"20", mags:"—"} },
      { name:"Quarterstaff", range:"Melee", hit:"+", damage:"1d6", ammo:null }
    ]
  },
  starterPowers: {
    veilwatch_ops: {
      operator:["Suppressive Fire","Breach & Clear","Adrenal Surge"],
      medic:["Stabilize","Field Triage","Revive Protocol"],
      tech:["Quick Hack","Overclock","Drone Ping"],
      face:["Silver Tongue","Get a Contact","Distraction"],
      mystic:["Sense Rift","Ward Sigil","Echo Whisper"],
      heavy:["Covering Fire","Brace","Shock Charge"]
    },
    dnd_core: {
      barbarian:["Rage"],
      bard:["Bardic Inspiration"],
      cleric:["Channel Divinity"],
      druid:["Wild Shape"],
      fighter:["Second Wind"],
      monk:["Ki"],
      paladin:["Divine Sense","Lay on Hands"],
      ranger:["Favored Enemy"],
      rogue:["Sneak Attack"],
      sorcerer:["Sorcery Points"],
      warlock:["Pact Magic"],
      wizard:["Arcane Recovery"]
    }
  },
  starterSpells: {
    dnd_core: {
      cleric:["Cure Wounds","Guiding Bolt","Bless","Sanctuary"],
      druid:["Goodberry","Entangle","Healing Word","Faerie Fire"],
      bard:["Healing Word","Dissonant Whispers","Charm Person","Faerie Fire"],
      sorcerer:["Magic Missile","Shield","Chromatic Orb","Sleep"],
      warlock:["Hex","Armor of Agathys","Eldritch Blast","Witch Bolt"],
      wizard:["Magic Missile","Shield","Sleep","Detect Magic"]
    },
    veilwatch_ops: {
      mystic:["Ward","Pulse","Blink Step","Null Field"]
    }
  }
};

function vwId(prefix){
  prefix ||= "id";
  return prefix + "_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function vwClampInt(x, minV, maxV){
  const n = parseInt(String(x), 10);
  if(Number.isNaN(n)) return minV;
  return Math.max(minV, Math.min(maxV, n));
}

function vwGetRulesetClasses(rulesetId){
  return (VW_CHAR_CATALOG.classes[rulesetId] || []).slice();
}
function vwGetBackgrounds(rulesetId){
  return (VW_CHAR_CATALOG.backgrounds[rulesetId] || []).slice();
}
function vwGetKits(rulesetId){
  return (VW_CHAR_CATALOG.kits[rulesetId] || []).slice();
}
function vwGetWeapons(rulesetId){
  return (VW_CHAR_CATALOG.weapons[rulesetId] || []).slice();
}

async function vwNewCharacterWizard(){
  const ui = vwModalBaseSetup("New Character", "Next", "Cancel");

  const state = {
    step: 0,
    ruleset: (VW_CHAR_CATALOG.rulesets[0]?.id || "veilwatch_ops"),
    name: "",
    level: 1,
    pronouns: "",
    classId: "",
    subclass: "",
    background: "",
    stats: { STR:10, DEX:10, CON:10, INT:10, WIS:10, CHA:10 },
    vitals: { hpMax:10, hpCur:10, hpTemp:"", ac:10, init:"+0", speed:30 },
    kitId: "",
    weaponNames: [],
    powers: [],
    spells: [],
    bio: ""
  };

  function close(val){
    ui.modal.style.display = "none";
    ui.btnOk.onclick = null;
    ui.btnCan.onclick = null;
    ui.modal.onclick = null;
    resolvePromise(val);
  }

  let resolvePromise;
  const p = new Promise((resolve)=>{ resolvePromise = resolve; });

  function optionHTML(items, selected, placeholder){
    const ph = placeholder ? '<option value="">'+esc(placeholder)+'</option>' : '';
    return ph + items.map(it=>{
      const val = typeof it === "string" ? it : it.id;
      const label = typeof it === "string" ? it : it.name;
      const sel = (String(val) === String(selected)) ? " selected" : "";
      return '<option value="'+esc(val)+'"'+sel+'>'+esc(label)+'</option>';
    }).join("");
  }

  function render(){
    const rulesets = VW_CHAR_CATALOG.rulesets;
    const classes = vwGetRulesetClasses(state.ruleset);
    const backgrounds = vwGetBackgrounds(state.ruleset);
    const kits = vwGetKits(state.ruleset);
    const weapons = vwGetWeapons(state.ruleset);

    const cls = classes.find(c=>c.id===state.classId) || classes[0] || null;
    if(!state.classId && cls) state.classId = cls.id;
    const subclasses = (cls && Array.isArray(cls.subclasses)) ? cls.subclasses : [];
    if(!state.subclass && subclasses.length) state.subclass = subclasses[0];

    const starterPowers = (VW_CHAR_CATALOG.starterPowers[state.ruleset]||{})[state.classId] || [];
    const starterSpells = (VW_CHAR_CATALOG.starterSpells[state.ruleset]||{})[state.classId] || [];
    const derivedPowers = starterPowers.slice();
    const derivedSpells = starterSpells.slice();

    ui.mBody.innerHTML = "";

    // stepper
    const stepper = document.createElement("div");
    stepper.className = "mini";
    stepper.style.opacity = ".9";
    stepper.style.marginBottom = "10px";
    stepper.innerHTML = 'Step <b>'+(state.step+1)+'</b> of <b>5</b>';
    ui.mBody.appendChild(stepper);

    // body
    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gap = "10px";
    ui.mBody.appendChild(wrap);

    if(state.step === 0){
      ui.btnOk.textContent = "Next";
      wrap.innerHTML =
        '<div class="row" style="gap:10px;flex-wrap:wrap;">' +
          '<div style="flex:1;min-width:220px;">' +
            '<div class="mini" style="margin-bottom:6px;">Ruleset</div>' +
            '<select id="nc_ruleset" style="width:100%;">'+ optionHTML(rulesets, state.ruleset) +'</select>' +
          '</div>' +
          '<div style="width:120px;">' +
            '<div class="mini" style="margin-bottom:6px;">Level</div>' +
            '<input id="nc_level" class="input" value="'+esc(state.level)+'" style="width:100%;"/>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<div class="mini" style="margin-bottom:6px;">Character name</div>' +
          '<input id="nc_name" class="input" placeholder="e.g. Mara Kincaid" value="'+esc(state.name)+'" style="width:100%;"/>' +
        '</div>' +
        '<div>' +
          '<div class="mini" style="margin-bottom:6px;">Pronouns (optional)</div>' +
          '<input id="nc_pronouns" class="input" placeholder="e.g. she/her" value="'+esc(state.pronouns)+'" style="width:100%;"/>' +
        '</div>' +
        '<div class="mini" style="opacity:.8;line-height:1.35;">This wizard sets creation-only attributes, background, starter kit, weapons, and starter powers/spells. Sheet stats become read-only after creation.</div>';

      document.getElementById("nc_ruleset").onchange = (e)=>{ state.ruleset = e.target.value; state.classId=""; state.subclass=""; state.background=""; state.kitId=""; state.weaponNames=[]; state.powers=[]; state.spells=[]; render(); };
      document.getElementById("nc_level").oninput = (e)=>{ state.level = vwClampInt(e.target.value, 1, 20); };
      document.getElementById("nc_name").oninput = (e)=>{ state.name = e.target.value; };
      document.getElementById("nc_pronouns").oninput = (e)=>{ state.pronouns = e.target.value; };

    } else if(state.step === 1){
      ui.btnOk.textContent = "Next";
      wrap.innerHTML =
        '<div class="row" style="gap:10px;flex-wrap:wrap;">' +
          '<div style="flex:1;min-width:220px;">' +
            '<div class="mini" style="margin-bottom:6px;">Class</div>' +
            '<select id="nc_class" style="width:100%;">'+ optionHTML(classes, state.classId, "Select class") +'</select>' +
          '</div>' +
          '<div style="flex:1;min-width:220px;">' +
            '<div class="mini" style="margin-bottom:6px;">Subclass</div>' +
            '<select id="nc_subclass" style="width:100%;">'+ optionHTML(subclasses, state.subclass, "Select subclass") +'</select>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<div class="mini" style="margin-bottom:6px;">Background</div>' +
          '<select id="nc_bg" style="width:100%;">'+ optionHTML(backgrounds, state.background, "Select background") +'</select>' +
        '</div>' +
        '<div class="mini" style="opacity:.8;line-height:1.35;">Background text goes to Notes/Bio by default. We can later split Background into its own tab.</div>';

      document.getElementById("nc_class").onchange = (e)=>{ state.classId = e.target.value; state.subclass=""; render(); };
      document.getElementById("nc_subclass").onchange = (e)=>{ state.subclass = e.target.value; };
      document.getElementById("nc_bg").onchange = (e)=>{ state.background = e.target.value; };

    } else if(state.step === 2){
      ui.btnOk.textContent = "Next";
      const s = state.stats;
      wrap.innerHTML =
        '<div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end;">' +
          '<button class="btn smallbtn" id="nc_stdArray">Standard Array</button>' +
          '<button class="btn smallbtn" id="nc_reset10">Reset to 10s</button>' +
          '<div class="mini" style="opacity:.8;">Set attributes here; they lock after creation.</div>' +
        '</div>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap;">' +
          '<div style="width:90px;"><div class="mini" style="margin-bottom:6px;">STR</div><input id="nc_STR" class="input" value="'+esc(s.STR)+'" style="width:100%;"/></div>' +
          '<div style="width:90px;"><div class="mini" style="margin-bottom:6px;">DEX</div><input id="nc_DEX" class="input" value="'+esc(s.DEX)+'" style="width:100%;"/></div>' +
          '<div style="width:90px;"><div class="mini" style="margin-bottom:6px;">CON</div><input id="nc_CON" class="input" value="'+esc(s.CON)+'" style="width:100%;"/></div>' +
          '<div style="width:90px;"><div class="mini" style="margin-bottom:6px;">INT</div><input id="nc_INT" class="input" value="'+esc(s.INT)+'" style="width:100%;"/></div>' +
          '<div style="width:90px;"><div class="mini" style="margin-bottom:6px;">WIS</div><input id="nc_WIS" class="input" value="'+esc(s.WIS)+'" style="width:100%;"/></div>' +
          '<div style="width:90px;"><div class="mini" style="margin-bottom:6px;">CHA</div><input id="nc_CHA" class="input" value="'+esc(s.CHA)+'" style="width:100%;"/></div>' +
        '</div>' +
        '<hr/>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end;">' +
          '<div style="width:130px;"><div class="mini" style="margin-bottom:6px;">HP Max</div><input id="nc_hpMax" class="input" value="'+esc(state.vitals.hpMax)+'" style="width:100%;"/></div>' +
          '<div style="width:110px;"><div class="mini" style="margin-bottom:6px;">AC</div><input id="nc_ac" class="input" value="'+esc(state.vitals.ac)+'" style="width:100%;"/></div>' +
          '<div style="width:130px;"><div class="mini" style="margin-bottom:6px;">Speed</div><input id="nc_speed" class="input" value="'+esc(state.vitals.speed)+'" style="width:100%;"/></div>' +
        '</div>';

      document.getElementById("nc_stdArray").onclick = ()=>{
        state.stats = { STR:15, DEX:14, CON:13, INT:12, WIS:10, CHA:8 };
        render();
      };
      document.getElementById("nc_reset10").onclick = ()=>{
        state.stats = { STR:10, DEX:10, CON:10, INT:10, WIS:10, CHA:10 };
        render();
      };
      ["STR","DEX","CON","INT","WIS","CHA"].forEach(k=>{
        document.getElementById("nc_"+k).oninput = (e)=>{ state.stats[k] = vwClampInt(e.target.value, 1, 30); };
      });
      document.getElementById("nc_hpMax").oninput = (e)=>{ state.vitals.hpMax = vwClampInt(e.target.value, 1, 999); state.vitals.hpCur = state.vitals.hpMax; };
      document.getElementById("nc_ac").oninput = (e)=>{ state.vitals.ac = vwClampInt(e.target.value, 0, 99); };
      document.getElementById("nc_speed").oninput = (e)=>{ state.vitals.speed = vwClampInt(e.target.value, 0, 999); };

    } else if(state.step === 3){
      ui.btnOk.textContent = "Next";
      const kitOpts = kits.map(k=>({id:k.id,name:k.name}));
      wrap.innerHTML =
        '<div>' +
          '<div class="mini" style="margin-bottom:6px;">Starter Kit</div>' +
          '<select id="nc_kit" style="width:100%;">'+ optionHTML(kitOpts, state.kitId, "Select kit") +'</select>' +
        '</div>' +
        '<div>' +
          '<div class="mini" style="margin-bottom:6px;">Starting Weapons</div>' +
          '<div id="nc_weaponList" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;"></div>' +
        '</div>' +
        '<hr/>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap;">' +
          '<div style="flex:1;min-width:220px;">' +
            '<div class="mini" style="margin-bottom:6px;">Starter Powers</div>' +
            '<div id="nc_powerList" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;"></div>' +
          '</div>' +
          '<div style="flex:1;min-width:220px;">' +
            '<div class="mini" style="margin-bottom:6px;">Starter Spells</div>' +
            '<div id="nc_spellList" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;"></div>' +
          '</div>' +
        '</div>' +
        '<div class="mini" style="opacity:.8;line-height:1.35;">Powers/spells here are starter suggestions. You can add custom ones later in the Actions tab once we add an Abilities table.</div>';

      document.getElementById("nc_kit").onchange = (e)=>{ state.kitId = e.target.value; };

      const weaponHost = document.getElementById("nc_weaponList");
      weaponHost.innerHTML="";
      weapons.forEach(w=>{
        const key = w.name;
        const checked = state.weaponNames.includes(key);
        const lab = document.createElement("label");
        lab.className="row";
        lab.style.gap="8px";
        lab.innerHTML = '<input type="checkbox" '+(checked?"checked":"")+'/> <span class="mini">'+esc(w.name)+'</span>';
        lab.querySelector("input").onchange = (e)=>{
          if(e.target.checked){ if(!state.weaponNames.includes(key)) state.weaponNames.push(key); }
          else state.weaponNames = state.weaponNames.filter(x=>x!==key);
        };
        weaponHost.appendChild(lab);
      });

      const powerHost = document.getElementById("nc_powerList");
      powerHost.innerHTML="";
      derivedPowers.forEach(pw=>{
        const checked = state.powers.includes(pw) || state.powers.length===0; // default select all
        if(state.powers.length===0) state.powers = derivedPowers.slice();
        const lab=document.createElement("label");
        lab.className="row";
        lab.style.gap="8px";
        lab.innerHTML = '<input type="checkbox" '+(checked?"checked":"")+'/> <span class="mini">'+esc(pw)+'</span>';
        lab.querySelector("input").onchange=(e)=>{
          if(e.target.checked){ if(!state.powers.includes(pw)) state.powers.push(pw); }
          else state.powers = state.powers.filter(x=>x!==pw);
        };
        powerHost.appendChild(lab);
      });

      const spellHost = document.getElementById("nc_spellList");
      spellHost.innerHTML="";
      derivedSpells.forEach(sp=>{
        const checked = state.spells.includes(sp) || state.spells.length===0;
        if(state.spells.length===0) state.spells = derivedSpells.slice();
        const lab=document.createElement("label");
        lab.className="row";
        lab.style.gap="8px";
        lab.innerHTML = '<input type="checkbox" '+(checked?"checked":"")+'/> <span class="mini">'+esc(sp)+'</span>';
        lab.querySelector("input").onchange=(e)=>{
          if(e.target.checked){ if(!state.spells.includes(sp)) state.spells.push(sp); }
          else state.spells = state.spells.filter(x=>x!==sp);
        };
        spellHost.appendChild(lab);
      });

    } else if(state.step === 4){
      ui.btnOk.textContent = "Create";
      // summarize + bio
      const kit = kits.find(k=>k.id===state.kitId) || null;
      const weaponObjs = weapons.filter(w=>state.weaponNames.includes(w.name));
      wrap.innerHTML =
        '<div class="mini" style="opacity:.9;line-height:1.5;">' +
          '<div><b>Name:</b> '+esc(state.name||"—")+'</div>' +
          '<div><b>Ruleset:</b> '+esc((rulesets.find(r=>r.id===state.ruleset)||{}).name||state.ruleset)+'</div>' +
          '<div><b>Class:</b> '+esc((cls?cls.name:state.classId)||"—")+' / '+esc(state.subclass||"—")+'</div>' +
          '<div><b>Background:</b> '+esc(state.background||"—")+'</div>' +
          '<div><b>Kit:</b> '+esc(kit?kit.name:"—")+'</div>' +
          '<div><b>Weapons:</b> '+esc(weaponObjs.map(w=>w.name).join(", ")||"—")+'</div>' +
          '<div><b>Powers:</b> '+esc((state.powers||[]).join(", ")||"—")+'</div>' +
          '<div><b>Spells:</b> '+esc((state.spells||[]).join(", ")||"—")+'</div>' +
        '</div>' +
        '<hr/>' +
        '<div>' +
          '<div class="mini" style="margin-bottom:6px;">Background / Bio</div>' +
          '<textarea id="nc_bio" class="input" style="width:100%;min-height:120px;resize:vertical;" placeholder="Paste your background here...">'+esc(state.bio || (state.background ? ("Background: "+state.background+"\n") : ""))+'</textarea>' +
        '</div>' +
        '<div class="mini" style="opacity:.8;line-height:1.35;">Creation sets attributes, class, and starting loadout. After creation, attribute scores are read-only and should only change via DM tools (if you enable them later).</div>';

      document.getElementById("nc_bio").oninput = (e)=>{ state.bio = e.target.value; };
    }

    // footer: back button
    let back = document.getElementById("nc_backBtn");
    if(!back){
      back = document.createElement("button");
      back.id = "nc_backBtn";
      back.className = "btn smallbtn";
      back.textContent = "Back";
      back.style.marginRight = "auto";
      // insert before cancel/ok via DOM
      ui.btnCan.parentElement.insertBefore(back, ui.btnCan);
    }
    back.style.display = (state.step===0) ? "none" : "inline-flex";
    back.onclick = ()=>{ state.step = Math.max(0, state.step-1); render(); };
  }

  ui.btnCan.onclick = ()=>{ ui.modal.style.display="none"; resolvePromise(null); };
  ui.modal.onclick = (e)=>{ if(e.target === ui.modal){ ui.modal.style.display="none"; resolvePromise(null);} };

  ui.btnOk.onclick = async ()=>{
    if(state.step < 4){
      if(state.step === 0 && !String(state.name||"").trim()){
        toast("Name is required");
        return;
      }
      state.step += 1;
      render();
      return;
    }

    // create
    if(!String(state.name||"").trim()){
      toast("Name is required");
      return;
    }

    const rulesetId = state.ruleset;
    const classes = vwGetRulesetClasses(rulesetId);
    const cls = classes.find(c=>c.id===state.classId) || classes[0] || null;
    const kits = vwGetKits(rulesetId);
    const kit = kits.find(k=>k.id===state.kitId) || null;
    const weapons = vwGetWeapons(rulesetId);
    const weaponObjs = weapons.filter(w=>state.weaponNames.includes(w.name));

    ui.btnOk.disabled = true;
    ui.btnOk.textContent = "Creating...";

    const createRes = await api("/api/character/new", { method:"POST", body: JSON.stringify({ name: state.name }) });
    if(!(createRes && createRes.ok)){
      ui.btnOk.disabled = false;
      ui.btnOk.textContent = "Create";
      toast((createRes && createRes.error) ? createRes.error : "Failed to create character");
      return;
    }

    const charId = createRes.id;

    const character = {
      id: charId,
      name: state.name,
      weapons: weaponObjs.map(w=>({
        id: vwId("w"),
        name: w.name,
        range: w.range || "",
        hit: w.hit || "",
        damage: w.damage || "",
        ammo: w.ammo ? { ...w.ammo } : null
      })),
      inventory: (kit && Array.isArray(kit.inventory)) ? kit.inventory.map(it=>({ ...it })) : [],
      abilities: (state.powers||[]).map(x=>({ id: vwId("ab"), name: x, notes:"" })),
      spells: (state.spells||[]).map(x=>({ id: vwId("sp"), name: x, notes:"" })),
      sheet: {
        vitals: {
          hpCur: String(state.vitals.hpMax ?? ""),
          hpMax: String(state.vitals.hpMax ?? ""),
          hpTemp: String(state.vitals.hpTemp ?? ""),
          ac: String(state.vitals.ac ?? ""),
          init: String(state.vitals.init ?? ""),
          speed: String(state.vitals.speed ?? "")
        },
        money: { cash:"", bank:"" },
        stats: {
          STR: String(state.stats.STR ?? ""),
          DEX: String(state.stats.DEX ?? ""),
          CON: String(state.stats.CON ?? ""),
          INT: String(state.stats.INT ?? ""),
          WIS: String(state.stats.WIS ?? ""),
          CHA: String(state.stats.CHA ?? "")
        },
        conditions: [],
        notes: state.bio || "",
        profile: {
          ruleset: rulesetId,
          level: state.level,
          pronouns: state.pronouns || "",
          class: cls ? cls.name : state.classId,
          classId: state.classId,
          subclass: state.subclass || "",
          background: state.background || ""
        }
      }
    };

    const saveRes = await api("/api/character/save", { method:"POST", body: JSON.stringify({ charId, character }) });
    if(!(saveRes && saveRes.ok)){
      // Still proceed; at minimum the char exists. But tell user.
      toast((saveRes && saveRes.error) ? ("Created, but failed to save sheet: " + saveRes.error) : "Created, but failed to save sheet");
    }else{
      toast("Character created");
    }

    ui.modal.style.display = "none";
    SESSION.activeCharId = charId;
    await refreshAll();
    resolvePromise(charId);
  };

  ui.modal.style.display = "flex";
  render();
  return p;
}

function getChar(){
  const st=window.__STATE||{};
  return (st.characters||[]).find(c=>c.id===SESSION.activeCharId);
}
function renderCharacter(){
  const c=getChar();
  const weapBody=document.getElementById("weapBody");
  const invBody=document.getElementById("invBody");
  const abilBody=document.getElementById("abilBody");
  const spellBody=document.getElementById("spellBody");
  if(weapBody) weapBody.innerHTML="";
  if(invBody) invBody.innerHTML="";
  if(abilBody) abilBody.innerHTML="";
  if(spellBody) spellBody.innerHTML="";
  if(!c){
    if(weapBody) weapBody.innerHTML = '<tr><td colspan="5" class="mini">No character. Click New Character.</td></tr>';
    if(invBody) invBody.innerHTML = '<tr><td colspan="7" class="mini">No character.</td></tr>';
    if(abilBody) abilBody.innerHTML = '<tr><td colspan="3" class="mini">No character.</td></tr>';
    if(spellBody) spellBody.innerHTML = '<tr><td colspan="3" class="mini">No character.</td></tr>';
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

  // abilities rows (optional)
  if(abilBody){
    (c.abilities||[]).forEach(ab=>{
      const tr=document.createElement("tr");
      tr.innerHTML =
        '<td>'+esc(ab.name||"")+'</td>'+
        '<td><input class="input" value="'+esc(ab.notes||"")+'" data-k="notes" style="width:100%;"/></td>'+
        '<td><button class="btn smallbtn">Del</button></td>';
      tr.querySelector("input").onchange=async (e)=>{
        ab.notes = e.target.value;
        await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
        toast("Saved"); await refreshAll();
      };
      tr.querySelector("button").onclick=async ()=>{
        c.abilities = (c.abilities||[]).filter(x=>x.id!==ab.id);
        await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
        toast("Removed ability"); await refreshAll();
      };
      abilBody.appendChild(tr);
    });
    if(!(c.abilities||[]).length){
      abilBody.innerHTML = '<tr><td colspan="3" class="mini">No abilities yet.</td></tr>';
    }
  }

  // spells rows (optional)
  if(spellBody){
    (c.spells||[]).forEach(sp=>{
      const tr=document.createElement("tr");
      tr.innerHTML =
        '<td>'+esc(sp.name||"")+'</td>'+
        '<td><input class="input" value="'+esc(sp.notes||"")+'" data-k="notes" style="width:100%;"/></td>'+
        '<td><button class="btn smallbtn">Del</button></td>';
      tr.querySelector("input").onchange=async (e)=>{
        sp.notes = e.target.value;
        await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
        toast("Saved"); await refreshAll();
      };
      tr.querySelector("button").onclick=async ()=>{
        c.spells = (c.spells||[]).filter(x=>x.id!==sp.id);
        await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
        toast("Removed spell"); await refreshAll();
      };
      spellBody.appendChild(tr);
    });
    if(!(c.spells||[]).length){
      spellBody.innerHTML = '<tr><td colspan="3" class="mini">No spells yet.</td></tr>';
    }
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
  // Attributes are set during creation and are read-only in the live sheet.
  ["statSTR","statDEX","statCON","statINT","statWIS","statCHA"].forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.disabled = true;
    el.setAttribute("data-locked","1");
    el.title = "Set at character creation";
    el.classList.add("vwLockedField");
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
document.getElementById("addInvBtn")?.addEventListener("click", async ()=>{
  const c = (typeof getChar==="function") ? getChar() : null;
  if(!c){ toast("Create character first"); return; }
  c.inventory ||= [];
  c.inventory.push({category:"",name:"",weight:"",qty:"1",cost:"",notes:""});
  const res = await api("/api/character/save",{method:"POST",body:JSON.stringify({charId:c.id, character:c})});
  if(res && res.ok){ toast("Added inventory row"); await refreshAll(); }
  else toast(res.error||"Failed");
});

document.getElementById("newCharBtn")?.addEventListener("click", async ()=>{
  await vwNewCharacterWizard();
});
