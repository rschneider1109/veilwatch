// projection_bay.js — Veilwatch Character Forge / Projection Bay
(function(){
  "use strict";

  const $ = (id)=>document.getElementById(id);
  const safe = (v)=>String(v ?? "").replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch] || ch));
  const titleCase = (v)=>String(v || "").replace(/[_-]+/g," ").replace(/\b\w/g, c=>c.toUpperCase()).trim();
  const clone = (obj)=>JSON.parse(JSON.stringify(obj || {}));

  const FIELD_IDS = [
    "projectionName",
    "projectionSilhouette",
    "projectionScale",
    "projectionPosture",
    "projectionSignal",
    "projectionModelUrl",
    "projectionNotes"
  ];

  const FALLBACK_MANIFEST = {
    version:"4.0.0-fallback",
    skinTones:[
      {id:"very_fair",label:"Very Fair",hex:"#F5D9C9"},{id:"fair",label:"Fair",hex:"#EBC7B0"},
      {id:"light",label:"Light",hex:"#DDAF91"},{id:"warm",label:"Warm",hex:"#CC9874"},
      {id:"tan",label:"Tan",hex:"#B67B57"},{id:"olive",label:"Olive",hex:"#9F7655"},
      {id:"medium_brown",label:"Medium Brown",hex:"#875A3D"},{id:"brown",label:"Brown",hex:"#70462F"},
      {id:"dark_brown",label:"Dark Brown",hex:"#543321"},{id:"deep",label:"Deep",hex:"#3A2419"}
    ],
    eyeColors:[
      {id:"brown",label:"Brown",hex:"#5C3924"},{id:"hazel",label:"Hazel",hex:"#806736"},
      {id:"blue",label:"Blue",hex:"#4E86B4"},{id:"green",label:"Green",hex:"#527C58"},
      {id:"gray",label:"Gray",hex:"#8F97A0"},{id:"amber",label:"Amber",hex:"#AA7B30"}
    ],
    hairColors:[
      {id:"black",label:"Black",hex:"#171411"},{id:"dark_brown",label:"Dark Brown",hex:"#34261C"},
      {id:"brown",label:"Brown",hex:"#5B3B26"},{id:"blonde",label:"Blonde",hex:"#CFAF63"},
      {id:"auburn",label:"Auburn",hex:"#7C3D28"},{id:"red",label:"Red",hex:"#9D4021"},
      {id:"gray",label:"Gray",hex:"#808188"},{id:"white",label:"White",hex:"#E7E7E7"}
    ],
    facePresets:[
      {id:"neutral",label:"Neutral",description:"Relaxed resting face",weights:{}},
      {id:"friendly",label:"Friendly",description:"Soft smile",weights:{Smile_Lips_Closed:.32,Happy:.06}},
      {id:"serious",label:"Serious",description:"Firm resting face",weights:{Eyebrows_Frown_Left:.11,Eyebrows_Frown_Right:.11}},
      {id:"focused",label:"Focused",description:"Concentrated gaze",weights:{Thinking:.16,Eyes_Squint:.07}},
      {id:"concerned",label:"Concerned",description:"Mild worry",weights:{Sad:.12}},
      {id:"confident",label:"Confident",description:"Subtle smirk",weights:{Smile_Lips_Closed:.16,Lips_Up_Corner_Wide_Left:.08}}
    ],
    hairStyles:[
      {id:"bald",label:"Bald",kind:"none",description:"No scalp hair"},
      {id:"classic_bob",label:"Classic Bob",kind:"asset",variant:"classic",description:"Vitruvian jaw-length bob"}
    ],
    facialHairStyles:[
      {id:"none",label:"None",kind:"none"},{id:"stubble",label:"Stubble",kind:"procedural",density:.35},
      {id:"trimmed",label:"Trimmed Beard",kind:"procedural",density:.65},{id:"full",label:"Full Beard",kind:"procedural",density:1},
      {id:"mustache",label:"Mustache",kind:"procedural",density:.65},{id:"goatee",label:"Goatee",kind:"procedural",density:.75}
    ],
    aliases:{
      facePresets:{clean:"neutral",sharp:"serious",tired:"concerned",scarred:"serious",weathered:"focused"},
      hairStyles:{short:"classic_bob",buzz:"classic_bob",fade:"classic_bob",long_straight:"classic_bob",wavy:"classic_bob",curly:"classic_bob",bun:"classic_bob",ponytail:"classic_bob",close_crop:"classic_bob",short_bob:"classic_bob",long_bob:"classic_bob",slicked_back:"classic_bob",bald:"bald"}
    }
  };

  let projectionRenderer = null;
  let last3dModelUrl = null;
  let activeForgeTab = "body";
  let assetManifest = FALLBACK_MANIFEST;
  let manifestPromise = null;
  let manifestUiBuilt = false;
  let appearanceDraft = null;
  let appearanceDraftCharId = null;
  let appearanceDirty = false;

  function update3dStatus(message, kind){
    const status = $("projectionBayStatus");
    if(!status) return;
    status.textContent = message || "3D CORE ONLINE";
    status.classList.toggle("linked", kind === "linked");
  }

  async function loadAssetManifest(){
    if(manifestPromise) return manifestPromise;
    manifestPromise = fetch("/assets/characters/character_assets.json", {cache:"no-store"})
      .then((res)=>{
        if(!res.ok) throw new Error(`Character asset manifest ${res.status}`);
        return res.json();
      })
      .then((data)=>{
        if(data && typeof data === "object") assetManifest = data;
        return assetManifest;
      })
      .catch((err)=>{
        console.warn("Veilwatch Character Forge manifest fallback active:", err);
        assetManifest = FALLBACK_MANIFEST;
        return assetManifest;
      });
    return manifestPromise;
  }

  function list(name){
    const value = assetManifest?.[name];
    return Array.isArray(value) ? value : [];
  }

  function entry(name, id, fallbackId){
    const rows = list(name);
    const requested = String(id || "").trim();
    const direct = rows.find(x=>x.id === requested);
    if(direct) return direct;
    const alias = assetManifest?.aliases?.[name]?.[requested];
    if(alias){
      const mapped = rows.find(x=>x.id === alias);
      if(mapped) return mapped;
    }
    return rows.find(x=>x.id === fallbackId) || rows[0] || null;
  }

  function normalizeAppearance(raw){
    const ap = clone(raw);
    const face = entry("facePresets", ap.facePreset || ap.faceDetail, "neutral");
    const hair = entry("hairStyles", ap.hairStyle, "classic_bob");
    const skin = entry("skinTones", ap.skinTone, "warm");
    const eyes = entry("eyeColors", ap.eyeColor, "brown");
    const hairColor = entry("hairColors", ap.hairColor, "dark_brown");
    const beard = entry("facialHairStyles", ap.beardStyle, "none");

    ap.characterType ||= "pc";
    ap.bodyType ||= "male";
    ap.skinTone = skin?.id || "warm";
    ap.eyeColor = eyes?.id || "brown";
    ap.facePreset = face?.id || "neutral";
    ap.faceDetail = ap.facePreset;
    ap.hairStyle = hair?.id || "classic_bob";
    ap.hairColor = hairColor?.id || "dark_brown";
    ap.beardStyle = beard?.id || "none";
    return ap;
  }

  function appearanceRenderHints(ap){
    const appearance = normalizeAppearance(ap);
    const skin = entry("skinTones", appearance.skinTone, "warm");
    const eyes = entry("eyeColors", appearance.eyeColor, "brown");
    const hairColor = entry("hairColors", appearance.hairColor, "dark_brown");
    const face = entry("facePresets", appearance.facePreset, "neutral");
    const hair = entry("hairStyles", appearance.hairStyle, "classic_bob");
    const beard = entry("facialHairStyles", appearance.beardStyle, "none");
    return {
      skinHex: skin?.hex,
      eyeHex: eyes?.hex,
      hairHex: hairColor?.hex,
      faceWeights: clone(face?.weights || {}),
      facePreset: face?.id || "neutral",
      hairStyle: clone(hair || {}),
      facialHairStyle: clone(beard || {})
    };
  }

  function ensureProjectionRenderer(){
    const host = $("projectionAvatar");
    if(!host || !window.VeilwatchProjection3D?.create) return null;
    if(!projectionRenderer){
      projectionRenderer = window.VeilwatchProjection3D.create(host);
      if(!host.dataset.statusWired){
        host.dataset.statusWired = "1";
        host.addEventListener("veilwatch:projection-status", (event)=>{
          const detail = event.detail || {};
          update3dStatus(detail.message, detail.kind);
        });
      }
    }
    return projectionRenderer;
  }

  function currentCharacter(){
    try{
      const st = window.__STATE || {};
      const id = window.SESSION?.activeCharId;
      return (st.characters || []).find(c => c.id === id) || null;
    }catch(e){ return null; }
  }

  function ensureDraft(c){
    if(!c){
      appearanceDraft = null;
      appearanceDraftCharId = null;
      appearanceDirty = false;
      return null;
    }
    if(appearanceDraftCharId !== c.id || !appearanceDraft){
      appearanceDraft = normalizeAppearance(c?.sheet?.appearance || {});
      appearanceDraftCharId = c.id;
      appearanceDirty = false;
    }
    return appearanceDraft;
  }

  function setDirty(value=true){
    appearanceDirty = !!value;
    $("projectionSaveBtn")?.classList.toggle("projection-forge-dirty", appearanceDirty);
    const btn = $("projectionSaveBtn");
    if(btn) btn.textContent = appearanceDirty ? "Save Changes" : "Save";
  }

  function projectionDefaults(c){
    const ap = c?.sheet?.appearance || {};
    const build = String(ap.build || "").toLowerCase();
    let silhouette = "agent";
    if(build.includes("heavy") || build.includes("large") || build.includes("muscle") || build.includes("broad")) silhouette = "bruiser";
    if(build.includes("lean") || build.includes("slim") || build.includes("light")) silhouette = "scout";

    let scale = "average";
    const h = String(ap.height || "").toLowerCase();
    if(h.includes("short") || h.includes("compact") || /^4-/.test(h) || h === "5-0" || h === "5-2") scale = "compact";
    if(h === "6-2" || h === "6-4") scale = "tall";
    if(h === "6-6" || h.includes("huge") || h.includes("giant")) scale = "huge";

    return {
      name: c?.name ? `${c.name} Projection` : "Unassigned Projection",
      silhouette,
      scale,
      posture: "neutral",
      signal: "stable",
      modelUrl: "",
      notes: ap.bodyType ? `Appearance sync: ${titleCase(ap.bodyType)} ${titleCase(ap.build || "average")}` : ""
    };
  }

  function getProjection(c){
    const base = projectionDefaults(c);
    const p = c?.sheet?.projection && typeof c.sheet.projection === "object" ? c.sheet.projection : {};
    return Object.assign({}, base, p);
  }

  function setField(id, value){
    const el = $(id);
    if(el) el.value = value ?? "";
  }

  function getField(id){
    const el = $(id);
    return el ? el.value : "";
  }

  function setSelectValue(id, value, fallback){
    const el = $(id);
    if(!el) return;
    const values = Array.from(el.options || []).map(o=>o.value);
    el.value = values.includes(String(value || "")) ? String(value || "") : fallback;
  }

  function echoPairs(pairs, emptyText){
    const filtered = (pairs || []).filter(([,v])=>String(v ?? "").trim());
    if(!filtered.length) return emptyText || "No telemetry yet.";
    return filtered.map(([k,v])=>`<span><b>${safe(k)}</b>${safe(titleCase(v))}</span>`).join("");
  }

  function echoAppearance(ap){
    if(!ap) return "No appearance telemetry yet.";
    return echoPairs([
      ["Type", ap.characterType],
      ["Body", ap.bodyType],
      ["Height", ap.height],
      ["Build", ap.build],
      ["Skin", entry("skinTones", ap.skinTone, "warm")?.label || ap.skinTone]
    ], "Appearance telemetry exists but has no filled values.");
  }

  function renderForgeTelemetry(ap){
    const face = $("projectionFaceEcho");
    const hair = $("projectionHairEcho");
    const clothing = $("projectionClothingEcho");
    if(!ap){
      if(face) face.textContent = "No face telemetry yet.";
      if(hair) hair.textContent = "No hair telemetry yet.";
      if(clothing) clothing.textContent = "No clothing telemetry yet.";
      return;
    }
    if(face) face.innerHTML = echoPairs([
      ["Preset", entry("facePresets", ap.facePreset || ap.faceDetail, "neutral")?.label],
      ["Eyes", entry("eyeColors", ap.eyeColor, "brown")?.label],
      ["Scars", ap.scars]
    ], "No face telemetry yet.");
    if(hair) hair.innerHTML = echoPairs([
      ["Style", entry("hairStyles", ap.hairStyle, "classic_bob")?.label],
      ["Color", entry("hairColors", ap.hairColor, "dark_brown")?.label],
      ["Facial Hair", entry("facialHairStyles", ap.beardStyle, "none")?.label]
    ], "No hair telemetry yet.");
    if(clothing) clothing.innerHTML = echoPairs([
      ["Top", ap.top],
      ["Outerwear", ap.outerwear],
      ["Bottoms", ap.bottoms],
      ["Shoes", ap.shoes],
      ["Gloves", ap.gloves],
      ["Uniform", ap.uniformPreset]
    ], "No clothing telemetry yet.");
  }

  function buildSwatches(containerId, rows, field, skin=false){
    const host = $(containerId);
    if(!host) return;
    host.innerHTML = rows.map((row)=>`
      <button type="button" class="projection-swatch${skin ? " skin" : ""}" data-appearance-field="${safe(field)}" data-appearance-value="${safe(row.id)}" aria-label="${safe(row.label)}" title="${safe(row.label)}">
        <span class="projection-swatch-dot" style="background:${safe(row.hex || "#777")}"></span>
        <span class="projection-swatch-label">${safe(row.label)}</span>
      </button>
    `).join("");
  }

  function buildChoiceCards(containerId, rows, field){
    const host = $(containerId);
    if(!host) return;
    host.innerHTML = rows.map((row)=>`
      <button type="button" class="projection-choice-card" data-appearance-field="${safe(field)}" data-appearance-value="${safe(row.id)}">
        <b>${safe(row.label)}</b>
        <small>${safe(row.description || "")}</small>
      </button>
    `).join("");
  }

  function buildManifestUI(){
    buildSwatches("projectionSkinToneOptions", list("skinTones"), "skinTone", true);
    buildSwatches("projectionEyeColorOptions", list("eyeColors"), "eyeColor");
    buildSwatches("projectionHairColorOptions", list("hairColors"), "hairColor");
    buildChoiceCards("projectionFacePresetOptions", list("facePresets"), "facePreset");
    buildChoiceCards("projectionHairStyleOptions", list("hairStyles"), "hairStyle");

    const beard = $("projectionBeardStyle");
    if(beard){
      beard.innerHTML = list("facialHairStyles").map(row=>`<option value="${safe(row.id)}">${safe(row.label)}</option>`).join("");
    }

    document.querySelectorAll("[data-appearance-field]").forEach((btn)=>{
      btn.addEventListener("click", ()=>updateDraftField(btn.dataset.appearanceField, btn.dataset.appearanceValue));
    });
    beard?.addEventListener("change", ()=>updateDraftField("beardStyle", beard.value));
    manifestUiBuilt = true;
  }

  function selectManifestUI(ap){
    if(!ap) return;
    document.querySelectorAll("[data-appearance-field]").forEach((btn)=>{
      const field = btn.dataset.appearanceField;
      const active = String(ap[field] || "") === String(btn.dataset.appearanceValue || "");
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    setSelectValue("projectionBeardStyle", ap.beardStyle, "none");
  }

  function updateDraftField(field, value){
    const c = currentCharacter();
    const ap = ensureDraft(c);
    if(!ap) return;
    ap[field] = value;
    if(field === "facePreset") ap.faceDetail = value;
    appearanceDraft = normalizeAppearance(ap);
    setDirty(true);
    selectManifestUI(appearanceDraft);
    renderForgeTelemetry(appearanceDraft);
    const echo = $("projectionAppearanceEcho");
    if(echo) echo.innerHTML = echoAppearance(appearanceDraft);
    renderLivePreviewFromFields();
  }

  function setForgeTab(tabName, options={}){
    const requested = String(tabName || "body").toLowerCase();
    const valid = new Set(["body","face","hair","clothing","animation","advanced"]);
    const next = valid.has(requested) ? requested : "body";
    activeForgeTab = next;
    document.querySelectorAll("[data-forge-tab]").forEach((btn)=>{
      const active = btn.dataset.forgeTab === next;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll("[data-forge-panel]").forEach((panel)=>{
      const active = panel.dataset.forgePanel === next;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });
    if(options.camera !== false){
      ensureProjectionRenderer()?.setView?.(next);
    }
  }

  function syncProjection3d(profile, forceModelReload=false, appearanceOverride=null){
    const renderer = ensureProjectionRenderer();
    if(!renderer) return;
    const p = profile || {};
    const appearance = normalizeAppearance(appearanceOverride || appearanceDraft || currentCharacter()?.sheet?.appearance || {});
    renderer.applyProfile({
      scale: p.scale || "average",
      posture: p.posture || "neutral",
      signal: p.signal || "stable",
      silhouette: p.silhouette || "agent",
      appearance,
      appearanceRender: appearanceRenderHints(appearance)
    });
    const modelUrl = String(p.modelUrl || "").trim();
    if(forceModelReload || modelUrl !== last3dModelUrl){
      last3dModelUrl = modelUrl;
      renderer.load(modelUrl);
    }
  }

  function renderProjectionBay(){
    const c = currentCharacter();
    const title = $("projectionBayTitle");
    const status = $("projectionBayStatus");
    const avatar = $("projectionAvatar");
    const readout = $("projectionReadoutGrid");
    const echo = $("projectionAppearanceEcho");

    if(!c){
      ensureDraft(null);
      if(title) title.textContent = "No Character Selected";
      if(status) status.textContent = "NO SIGNAL";
      FIELD_IDS.forEach(id=>setField(id, ""));
      if(avatar){
        avatar.dataset.body = "agent";
        avatar.dataset.scale = "average";
        avatar.dataset.state = "stable";
        avatar.dataset.posture = "neutral";
      }
      if(readout) readout.innerHTML = ["BODY","OUTFIT","POSE","MODEL"].map(k=>`<div><b>${k}</b><span>—</span></div>`).join("");
      if(echo) echo.textContent = "Select or create a character to initialize projection data.";
      renderForgeTelemetry(null);
      const renderer = ensureProjectionRenderer();
      if(renderer) renderer.applyProfile({scale:"average", posture:"neutral", signal:"stable", silhouette:"agent", appearance:null, appearanceRender:null});
      if(status){ status.textContent = "NO SIGNAL"; status.classList.remove("linked"); }
      setDirty(false);
      return;
    }

    const ap = ensureDraft(c);
    const p = getProjection(c);
    if(title) title.textContent = p.name || `${c.name} Projection`;
    if(status){
      const hasModel = !!String(p.modelUrl || "").trim();
      status.textContent = hasModel ? "MODEL LINKED" : "STANDARD BODY";
      status.classList.add("linked");
    }

    setField("projectionName", p.name || "");
    setSelectValue("projectionSilhouette", p.silhouette, "agent");
    setSelectValue("projectionScale", p.scale, "average");
    setSelectValue("projectionPosture", p.posture, "neutral");
    setSelectValue("projectionSignal", p.signal, "stable");
    setField("projectionModelUrl", p.modelUrl || "");
    setField("projectionNotes", p.notes || "");
    setField("projectionBodyProfile", "Human");

    if(avatar){
      avatar.dataset.body = p.silhouette || "agent";
      avatar.dataset.scale = p.scale || "average";
      avatar.dataset.state = p.signal || "stable";
      avatar.dataset.posture = p.posture || "neutral";
    }

    if(readout){
      const modelText = String(p.modelUrl || "").trim() ? "CUSTOM" : "VITRUVIAN";
      const bodyText = [ap.bodyType, ap.build].filter(Boolean).join(" / ") || "human";
      const outfitText = [ap.top, ap.bottoms].filter(Boolean).join(" / ") || "unspecified";
      readout.innerHTML = `
        <div><b>BODY</b><span>${safe(titleCase(bodyText))}</span></div>
        <div><b>OUTFIT</b><span>${safe(titleCase(outfitText))}</span></div>
        <div><b>POSE</b><span>${safe(titleCase(p.posture || "neutral"))}</span></div>
        <div><b>MODEL</b><span>${safe(modelText)}</span></div>
      `;
    }

    if(echo) echo.innerHTML = echoAppearance(ap);
    renderForgeTelemetry(ap);
    if(manifestUiBuilt) selectManifestUI(ap);
    syncProjection3d(p, false, ap);
    setForgeTab(activeForgeTab, {camera:false});
  }

  async function saveProjection(projectionPatch){
    const c = currentCharacter();
    if(!c){ toast?.("Select a character first"); return; }
    c.sheet ||= {};
    c.sheet.projection ||= {};

    const nextProjection = Object.assign({}, getProjection(c), projectionPatch || {
      name: getField("projectionName").trim(),
      silhouette: getField("projectionSilhouette") || "agent",
      scale: getField("projectionScale") || "average",
      posture: getField("projectionPosture") || "neutral",
      signal: getField("projectionSignal") || "stable",
      modelUrl: getField("projectionModelUrl").trim(),
      notes: getField("projectionNotes")
    });

    c.sheet.projection = nextProjection;
    c.sheet.appearance = normalizeAppearance(appearanceDraft || c.sheet.appearance || {});
    c.sheet.appearance.faceDetail = c.sheet.appearance.facePreset;

    try{
      const res = await api("/api/character/save", { method:"POST", body: JSON.stringify({ charId:c.id, character:c }) });
      if(res?.ok){
        setDirty(false);
        toast?.("Character appearance saved");
        appearanceDraftCharId = null;
        await refreshAll?.();
      }else{
        toast?.(res?.error || "Character save failed");
      }
    }catch(e){
      console.error(e);
      toast?.("Character save failed");
    }
  }

  function resetAppearanceChanges(){
    const c = currentCharacter();
    if(!c){ toast?.("Select a character first"); return; }
    appearanceDraft = normalizeAppearance(c?.sheet?.appearance || {});
    appearanceDraftCharId = c.id;
    setDirty(false);
    selectManifestUI(appearanceDraft);
    renderForgeTelemetry(appearanceDraft);
    if($("projectionAppearanceEcho")) $("projectionAppearanceEcho").innerHTML = echoAppearance(appearanceDraft);
    renderLivePreviewFromFields();
    toast?.("Unsaved appearance changes reset");
  }

  function renderLivePreviewFromFields(){
    const avatar = $("projectionAvatar");
    if(!avatar) return;
    avatar.dataset.body = getField("projectionSilhouette") || "agent";
    avatar.dataset.scale = getField("projectionScale") || "average";
    avatar.dataset.state = getField("projectionSignal") || "stable";
    avatar.dataset.posture = getField("projectionPosture") || "neutral";
    const liveProfile = {
      silhouette: getField("projectionSilhouette") || "agent",
      scale: getField("projectionScale") || "average",
      posture: getField("projectionPosture") || "neutral",
      signal: getField("projectionSignal") || "stable",
      modelUrl: getField("projectionModelUrl").trim()
    };
    syncProjection3d(liveProfile, false, appearanceDraft || currentCharacter()?.sheet?.appearance || null);
  }

  function wireProjectionBay(){
    $("projectionSaveBtn")?.addEventListener("click", ()=>saveProjection());
    $("projectionResetCameraBtn")?.addEventListener("click", ()=>ensureProjectionRenderer()?.resetCamera?.());
    document.querySelectorAll("[data-forge-tab]").forEach((btn)=>{
      btn.addEventListener("click", ()=>setForgeTab(btn.dataset.forgeTab));
    });
    $("projectionSyncAppearanceBtn")?.addEventListener("click", resetAppearanceChanges);
    $("projectionClearBtn")?.addEventListener("click", async ()=>{
      setField("projectionModelUrl", "");
      await saveProjection({ modelUrl:"" });
    });
    ["projectionSilhouette","projectionScale","projectionPosture","projectionSignal"].forEach(id=>{
      $(id)?.addEventListener("input", renderLivePreviewFromFields);
      $(id)?.addEventListener("change", renderLivePreviewFromFields);
    });
    $("projectionModelUrl")?.addEventListener("change", ()=>{
      const profile = {
        silhouette: getField("projectionSilhouette") || "agent",
        scale: getField("projectionScale") || "average",
        posture: getField("projectionPosture") || "neutral",
        signal: getField("projectionSignal") || "stable",
        modelUrl: getField("projectionModelUrl").trim()
      };
      syncProjection3d(profile, true, appearanceDraft || currentCharacter()?.sheet?.appearance || null);
    });
  }

  window.addEventListener("veilwatch:projection3d-ready", ()=>{
    projectionRenderer = null;
    last3dModelUrl = null;
    renderProjectionBay();
  });

  window.renderProjectionBay = renderProjectionBay;
  window.vwSaveProjectionBay = saveProjection;

  window.addEventListener("DOMContentLoaded", async ()=>{
    wireProjectionBay();
    await loadAssetManifest();
    buildManifestUI();
    renderProjectionBay();
    setForgeTab(activeForgeTab, {camera:false});
  });
})();
