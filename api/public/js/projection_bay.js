// projection_bay.js — Character Projection Bay / holographic model foundation
(function(){
  "use strict";

  const $ = (id)=>document.getElementById(id);
  const safe = (v)=>String(v ?? "").replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch] || ch));
  const titleCase = (v)=>String(v || "").replace(/[_-]+/g," ").replace(/\b\w/g, c=>c.toUpperCase()).trim();

  const FIELD_IDS = [
    "projectionName",
    "projectionSilhouette",
    "projectionScale",
    "projectionPosture",
    "projectionSignal",
    "projectionModelUrl",
    "projectionNotes"
  ];

  let projectionRenderer = null;
  let last3dModelUrl = null;
  let activeForgeTab = "body";

  function update3dStatus(message, kind){
    const status = $("projectionBayStatus");
    if(!status) return;
    status.textContent = message || "3D CORE ONLINE";
    status.classList.toggle("linked", kind === "linked");
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

  function syncProjection3d(profile, forceModelReload=false, appearanceOverride=null){
    const renderer = ensureProjectionRenderer();
    if(!renderer) return;
    const p = profile || {};
    const appearance = appearanceOverride || currentCharacter()?.sheet?.appearance || null;
    renderer.applyProfile({
      scale: p.scale || "average",
      posture: p.posture || "neutral",
      signal: p.signal || "stable",
      silhouette: p.silhouette || "agent",
      appearance
    });
    const modelUrl = String(p.modelUrl || "").trim();
    if(forceModelReload || modelUrl !== last3dModelUrl){
      last3dModelUrl = modelUrl;
      renderer.load(modelUrl);
    }
  }

  function currentCharacter(){
    try{
      const st = window.__STATE || {};
      const id = window.SESSION?.activeCharId;
      return (st.characters || []).find(c => c.id === id) || null;
    }catch(e){ return null; }
  }

  function projectionDefaults(c){
    const ap = c?.sheet?.appearance || {};
    const body = String(ap.bodyType || "").toLowerCase();
    const build = String(ap.build || "").toLowerCase();
    let silhouette = "agent";
    if(build.includes("heavy") || build.includes("large") || build.includes("muscle")) silhouette = "bruiser";
    if(build.includes("lean") || build.includes("slim") || build.includes("light")) silhouette = "scout";
    if(String(c?.classId || "").toLowerCase().includes("occult") || String(c?.classId || "").toLowerCase().includes("gift")) silhouette = "mystic";
    if(String(c?.classId || "").toLowerCase().includes("priest")) silhouette = "medic";

    let scale = "average";
    const h = String(ap.height || "").toLowerCase();
    if(h.includes("short") || h.includes("compact")) scale = "compact";
    if(h.includes("tall")) scale = "tall";
    if(h.includes("huge") || h.includes("giant")) scale = "huge";

    return {
      name: c?.name ? `${c.name} Projection` : "Unassigned Projection",
      silhouette,
      scale,
      posture: "neutral",
      signal: "stable",
      modelUrl: "",
      notes: body ? `Appearance sync: ${titleCase(body)} ${titleCase(build || "average")}` : ""
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

  function echoAppearance(c){
    const ap = c?.sheet?.appearance || null;
    if(!ap) return "No appearance telemetry yet.";
    return echoPairs([
      ["Type", ap.characterType],
      ["Body", ap.bodyType],
      ["Height", ap.height],
      ["Build", ap.build],
      ["Bust", ap.bust]
    ], "Appearance telemetry exists but has no filled values.");
  }

  function renderForgeTelemetry(c){
    const ap = c?.sheet?.appearance || null;
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
      ["Skin", ap.skinTone],
      ["Eyes", ap.eyeColor],
      ["Face", ap.faceDetail],
      ["Scars", ap.scars]
    ], "No face telemetry yet.");
    if(hair) hair.innerHTML = echoPairs([
      ["Style", ap.hairStyle],
      ["Color", ap.hairColor],
      ["Beard", ap.beardStyle]
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

  function renderProjectionBay(){
    const c = currentCharacter();
    const title = $("projectionBayTitle");
    const status = $("projectionBayStatus");
    const avatar = $("projectionAvatar");
    const readout = $("projectionReadoutGrid");
    const echo = $("projectionAppearanceEcho");

    if(!c){
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
      if(renderer){
        renderer.applyProfile({scale:"average", posture:"neutral", signal:"stable", silhouette:"agent", appearance:null});
      }
      if(status){
        status.textContent = "NO SIGNAL";
        status.classList.remove("linked");
      }
      return;
    }

    const p = getProjection(c);
    if(title) title.textContent = p.name || `${c.name} Projection`;
    if(status){
      const hasModel = !!String(p.modelUrl || "").trim();
      const isStandardBody = !hasModel;
      status.textContent = hasModel ? "MODEL LINKED" : "STANDARD BODY";
      status.classList.toggle("linked", hasModel || isStandardBody);
    }

    setField("projectionName", p.name || "");
    setSelectValue("projectionSilhouette", p.silhouette, "agent");
    setSelectValue("projectionScale", p.scale, "average");
    setSelectValue("projectionPosture", p.posture, "neutral");
    setSelectValue("projectionSignal", p.signal, "stable");
    setField("projectionModelUrl", p.modelUrl || "");
    setField("projectionNotes", p.notes || "");

    if(avatar){
      avatar.dataset.body = p.silhouette || "agent";
      avatar.dataset.scale = p.scale || "average";
      avatar.dataset.state = p.signal || "stable";
      avatar.dataset.posture = p.posture || "neutral";
    }

    if(readout){
      const ap = c?.sheet?.appearance || {};
      const modelText = String(p.modelUrl || "").trim() ? "CUSTOM" : "VITRUVIAN";
      const bodyText = [ap.bodyType, ap.build].filter(Boolean).join(" / ") || p.silhouette || "agent";
      const outfitText = [ap.top, ap.bottoms].filter(Boolean).join(" / ") || "unspecified";
      readout.innerHTML = `
        <div><b>BODY</b><span>${safe(titleCase(bodyText))}</span></div>
        <div><b>OUTFIT</b><span>${safe(titleCase(outfitText))}</span></div>
        <div><b>POSE</b><span>${safe(titleCase(p.posture || "neutral"))}</span></div>
        <div><b>MODEL</b><span>${safe(modelText)}</span></div>
      `;
    }
    if(echo) echo.innerHTML = echoAppearance(c);
    renderForgeTelemetry(c);
    syncProjection3d(p, false, c?.sheet?.appearance || null);
    setForgeTab(activeForgeTab, {camera:false});
  }

  async function saveProjection(patchOnly){
    const c = currentCharacter();
    if(!c){ toast?.("Select a character first"); return; }
    c.sheet ||= {};
    c.sheet.projection ||= {};
    const next = Object.assign({}, getProjection(c), patchOnly || {
      name: getField("projectionName").trim(),
      silhouette: getField("projectionSilhouette") || "agent",
      scale: getField("projectionScale") || "average",
      posture: getField("projectionPosture") || "neutral",
      signal: getField("projectionSignal") || "stable",
      modelUrl: getField("projectionModelUrl").trim(),
      notes: getField("projectionNotes")
    });
    c.sheet.projection = next;
    try{
      const res = await api("/api/character/save", { method:"POST", body: JSON.stringify({ charId:c.id, character:c }) });
      if(res?.ok){
        toast?.("Projection saved");
        await refreshAll?.();
      }else{
        toast?.(res?.error || "Projection save failed");
      }
    }catch(e){
      console.error(e);
      toast?.("Projection save failed");
    }
  }

  function syncFromAppearance(){
    const c = currentCharacter();
    if(!c){ toast?.("Select a character first"); return; }
    const p = projectionDefaults(c);
    setField("projectionName", p.name);
    setSelectValue("projectionSilhouette", p.silhouette, "agent");
    setSelectValue("projectionScale", p.scale, "average");
    setSelectValue("projectionPosture", p.posture, "neutral");
    setSelectValue("projectionSignal", p.signal, "stable");
    setField("projectionNotes", p.notes);
    renderLivePreviewFromFields();
    toast?.("Appearance telemetry synced");
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
    syncProjection3d(liveProfile, false, currentCharacter()?.sheet?.appearance || null);
  }

  function wireProjectionBay(){
    $("projectionSaveBtn")?.addEventListener("click", ()=>saveProjection());
    $("projectionResetCameraBtn")?.addEventListener("click", ()=>ensureProjectionRenderer()?.resetCamera?.());
    document.querySelectorAll("[data-forge-tab]").forEach((btn)=>{
      btn.addEventListener("click", ()=>setForgeTab(btn.dataset.forgeTab));
    });
    $("projectionSyncAppearanceBtn")?.addEventListener("click", syncFromAppearance);
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
      syncProjection3d(profile, true, currentCharacter()?.sheet?.appearance || null);
    });
  }

  window.addEventListener("veilwatch:projection3d-ready", ()=>{
    projectionRenderer = null;
    last3dModelUrl = null;
    renderProjectionBay();
  });

  window.renderProjectionBay = renderProjectionBay;
  window.vwSaveProjectionBay = saveProjection;
  window.addEventListener("DOMContentLoaded", ()=>{
    wireProjectionBay();
    renderProjectionBay();
    setForgeTab(activeForgeTab, {camera:false});
  });
})();
