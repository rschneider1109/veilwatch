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

  function echoAppearance(c){
    const ap = c?.sheet?.appearance || null;
    if(!ap) return "No appearance telemetry yet.";
    const parts = [
      ["Type", ap.characterType],
      ["Body", ap.bodyType],
      ["Height", ap.height],
      ["Build", ap.build],
      ["Hair", [ap.hairStyle, ap.hairColor].filter(Boolean).join(" / ")],
      ["Top", ap.top],
      ["Outerwear", ap.outerwear],
      ["Bottoms", ap.bottoms],
      ["Uniform", ap.uniformPreset]
    ].filter(([,v])=>String(v||"").trim());
    if(!parts.length) return "Appearance telemetry exists but has no filled values.";
    return parts.map(([k,v])=>`<span><b>${safe(k)}</b>${safe(titleCase(v))}</span>`).join("");
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
      if(readout) readout.innerHTML = ["TYPE","SCALE","POSTURE","MODEL"].map(k=>`<div><b>${k}</b><span>—</span></div>`).join("");
      if(echo) echo.textContent = "Select or create a character to initialize projection data.";
      return;
    }

    const p = getProjection(c);
    if(title) title.textContent = p.name || `${c.name} Projection`;
    if(status){
      const hasModel = !!String(p.modelUrl || "").trim();
      status.textContent = hasModel ? "MODEL LINKED" : "HOLO PREVIEW";
      status.classList.toggle("linked", hasModel);
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
      const modelText = String(p.modelUrl || "").trim() ? "LINKED" : "PREVIEW";
      readout.innerHTML = `
        <div><b>TYPE</b><span>${safe(titleCase(p.silhouette || "agent"))}</span></div>
        <div><b>SCALE</b><span>${safe(titleCase(p.scale || "average"))}</span></div>
        <div><b>POSTURE</b><span>${safe(titleCase(p.posture || "neutral"))}</span></div>
        <div><b>MODEL</b><span>${safe(modelText)}</span></div>
      `;
    }
    if(echo) echo.innerHTML = echoAppearance(c);
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
    const status = $("projectionBayStatus");
    if(status){
      const hasModel = !!getField("projectionModelUrl").trim();
      status.textContent = hasModel ? "MODEL LINKED" : "HOLO PREVIEW";
      status.classList.toggle("linked", hasModel);
    }
  }

  function wireProjectionBay(){
    $("projectionSaveBtn")?.addEventListener("click", ()=>saveProjection());
    $("projectionSyncAppearanceBtn")?.addEventListener("click", syncFromAppearance);
    $("projectionClearBtn")?.addEventListener("click", async ()=>{
      setField("projectionModelUrl", "");
      await saveProjection({ modelUrl:"" });
    });
    ["projectionSilhouette","projectionScale","projectionPosture","projectionSignal","projectionModelUrl"].forEach(id=>{
      $(id)?.addEventListener("input", renderLivePreviewFromFields);
      $(id)?.addEventListener("change", renderLivePreviewFromFields);
    });
  }

  window.renderProjectionBay = renderProjectionBay;
  window.vwSaveProjectionBay = saveProjection;
  window.addEventListener("DOMContentLoaded", ()=>{
    wireProjectionBay();
    renderProjectionBay();
  });
})();
