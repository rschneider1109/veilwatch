// Veilwatch Full Character Forge v2.0 MakeHuman foundation
(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const title=v=>String(v||"").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
  let manifest=null;
  const DEFAULT={
    frame:"masculine",chest:"pectoral",anatomy:"penis_testes",age:"25_35",
    height:50,mass:50,bodyFat:35,muscle:45,shoulders:50,chestVolume:50,waist:50,hips:50,glutes:50,armSize:50,legSize:50,
    neckSize:50,torsoLength:50,armLength:50,legLength:50,handSize:50,footSize:50,
    breastSize:35,breastProjection:35,penisLength:50,penisGirth:50,testesSize:50,vulvaProminence:50,
    faceWidth:50,jawWidth:50,jawAngle:50,chinWidth:50,chinProjection:50,cheekboneHeight:50,cheekboneWidth:50,noseWidth:50,noseLength:50,noseProjection:50,eyeSpacing:50,eyeSize:50,browHeight:50,lipFullness:50,mouthWidth:50,earSize:50,
    expressionIntensity:100,browStyle:"natural",piercing:"none",faceScar:"none",
    bodyHair:"none",bodyHairColor:"inherit",bodyScar:"none",tattoo:"none",
    clothing:{
      baseLayer:"boxer_briefs",top:"plain_tshirt",outerwear:"none",bottoms:"jeans_straight",onePiece:"none",socks:"crew_socks",shoes:"sneakers",gloves:"none",headwear:"none",eyewear:"none",neck:"none",belt:"civilian_belt",vest:"none",back:"none",
      color:"charcoal",
      colors:{baseLayer:"charcoal",top:"charcoal",outerwear:"black",bottoms:"navy",onePiece:"charcoal",shoes:"black",gear:"black"}
    },
    cuffArm:"left",weaponPreview:"none",weaponCarry:"back",
    cybernetics:{eye:"none",eyeSide:"right",temple:"none",templeSide:"right",ear:"none",earSide:"right",jaw:"none",jawSide:"right",neck:"none",leftArm:"none",rightArm:"none",leftLeg:"none",rightLeg:"none",torso:"none"},
    animation:"Idle",showAnatomy:false
  };
  const clone=o=>JSON.parse(JSON.stringify(o||{}));
  function bridge(){ return window.VeilwatchForgeBridge; }
  function forge(){
    const d=bridge()?.getDraft?.()||{};
    const raw=d.forge||{};
    const f=Object.assign(clone(DEFAULT),clone(raw));
    f.clothing=Object.assign({},DEFAULT.clothing,raw.clothing||{});
    f.clothing.colors=Object.assign({},DEFAULT.clothing.colors,raw.clothing?.colors||{});
    f.cybernetics=Object.assign({},DEFAULT.cybernetics,raw.cybernetics||{});
    return f;
  }
  function merge(a,b){ const out=clone(a); for(const [k,v] of Object.entries(b||{})){ if(v&&typeof v==='object'&&!Array.isArray(v)&&out[k]&&typeof out[k]==='object'&&!Array.isArray(out[k])) out[k]=merge(out[k],v); else out[k]=v; } return out; }
  function patch(part){ const d=forge(); const next=merge(d,part); bridge()?.patchAppearance?.({forge:next,bodyType:next.frame==='feminine'?'female':'male'}); }
  function sel(label,key,items,value){ return `<label>${label}<select data-ff-key="${key}">${(items||[]).map(x=>`<option value="${x}" ${x===value?'selected':''}>${title(x)}</option>`).join('')}</select></label>`; }
  function range(label,key,value){ const v=Number.isFinite(Number(value))?Number(value):50; return `<label class="ff-range"><span>${label}<b data-ff-value="${key}">${v}</b></span><input type="range" min="0" max="100" value="${v}" data-ff-range="${key}"></label>`; }
  function section(titleText,html){ return `<div class="ff-section"><div class="projection-option-heading">${titleText}</div>${html}</div>`; }
  function weaponOptions(){ const w=window.VW_CHAR_CATALOG?.weapons||{}; const rows=[['none','None']]; Object.values(w).flat().forEach(x=>rows.push([x.id,x.name])); return rows; }
  function render(){
    if(!manifest||!bridge()) return;
    const f=forge();
    const body=$('projectionFullForgeBody');
    if(body) body.innerHTML=
      section('Body Foundation',`<div class="projection-form-grid projection-forge-two-col">${sel('Frame','frame',manifest.body.frames,f.frame)}${sel('Chest','chest',manifest.body.chest,f.chest)}${sel('Anatomy','anatomy',manifest.body.anatomy,f.anatomy)}${sel('Visual Age','age',manifest.body.age,f.age)}</div>`)+
      section('Core Proportions',`<div class="ff-range-grid">${['height','mass','bodyFat','muscle','shoulders','chestVolume','waist','hips','glutes','armSize','legSize'].map(k=>range(title(k),k,f[k])).join('')}</div>`)+
      section('Limb & Frame Proportions',`<div class="ff-range-grid">${['neckSize','torsoLength','armLength','legLength','handSize','footSize'].map(k=>range(title(k),k,f[k])).join('')}</div>`)+
      section('Adult Anatomy',`<div class="ff-range-grid">${f.chest==='breasts'?[range('Breast Size','breastSize',f.breastSize),range('Breast Projection','breastProjection',f.breastProjection)].join(''):''}${f.anatomy==='penis_testes'?[range('Genital Length','penisLength',f.penisLength),range('Genital Girth','penisGirth',f.penisGirth),range('Testes Size','testesSize',f.testesSize)].join(''):range('External Anatomy','vulvaProminence',f.vulvaProminence)}</div><label class="ff-check"><input type="checkbox" data-ff-check="showAnatomy" ${f.showAnatomy?'checked':''}/> Anatomy preview (adult characters only)</label>`)+
      section('Body Details',`<div class="projection-form-grid projection-forge-two-col">${sel('Body Hair','bodyHair',manifest.body.bodyHair,f.bodyHair)}${sel('Body Hair Color','bodyHairColor',manifest.body.details?.bodyHairColor||[],f.bodyHairColor)}${sel('Body Scar','bodyScar',manifest.body.details?.bodyScars||[],f.bodyScar)}${sel('Tattoo','tattoo',manifest.body.details?.tattoos||[],f.tattoo)}</div>`);

    const face=$('projectionFullForgeFace');
    if(face) face.innerHTML=
      section('Eyebrows & Expression',`<div class="projection-form-grid projection-forge-two-col">${sel('Brow Style','browStyle',Object.keys(manifest.brows||{}),f.browStyle)}</div><div class="ff-range-grid">${range('Expression Intensity','expressionIntensity',f.expressionIntensity)}</div>`)+
      section('Face Structure',`<div class="ff-range-grid">${(manifest.face?.morphs||[]).map(k=>range(title(k),k,f[k])).join('')}</div>`)+
      section('Face Details',`<div class="projection-form-grid projection-forge-two-col">${sel('Piercing','piercing',manifest.face?.piercings||[],f.piercing)}${sel('Face Scar','faceScar',manifest.face?.faceScars||[],f.faceScar)}</div>`);

    const hair=$('projectionFullForgeHair');
    if(hair) hair.innerHTML='<div class="mini">MakeHuman HM08 is now the character foundation. The uploaded MakeHuman hair packs are being connected through the native asset pipeline instead of forcing old Vitruvian-fitted meshes onto the new body.</div>';

    const c=$('projectionFullForgeClothing');
    if(c){
      const cl=f.clothing; const keys=['baseLayer','top','outerwear','bottoms','onePiece','socks','shoes','gloves','headwear','eyewear','neck','belt','vest','back'];
      const colors=cl.colors||{};
      c.innerHTML=section('Wardrobe',`<div class="projection-form-grid projection-forge-two-col">${keys.map(k=>sel(title(k),`clothing.${k}`,manifest.clothing[k]||[],cl[k])).join('')}</div>`)+
        section('Garment Colors',`<div class="projection-form-grid projection-forge-two-col">${(manifest.clothing.colorSlots||[]).map(k=>sel(`${title(k)} Color`,`clothing.colors.${k}`,manifest.clothing.colors||[],colors[k]||cl.color||'charcoal')).join('')}</div>`);
    }

    const e=$('projectionFullForgeEquipment');
    if(e){ const wp=weaponOptions(); e.innerHTML=
      section('Required Veilwatch Cuff',`<div class="projection-form-grid">${sel('Cuff Arm','cuffArm',manifest.equipment.cuff.arms,f.cuffArm)}</div><div class="ff-required">AUTO-EQUIPPED · REQUIRED · NON-REMOVABLE</div>`)+
      section('Weapon Preview',`<div class="projection-form-grid projection-forge-two-col"><label>Weapon<select data-ff-key="weaponPreview">${wp.map(([id,n])=>`<option value="${id}" ${id===f.weaponPreview?'selected':''}>${n}</option>`).join('')}</select></label>${sel('Carry Position','weaponCarry',manifest.equipment.carry,f.weaponCarry)}</div><div class="mini">Every current Veilwatch weapon ID has a visual model or bundled fallback.</div>`);
    }

    const cy=$('projectionFullForgeCybernetics');
    if(cy){ const x=f.cybernetics; const sideKeys=manifest.cyberneticsSides||{}; cy.innerHTML=
      section('Augmentation',`<div class="projection-form-grid projection-forge-two-col">${Object.keys(manifest.cybernetics||{}).map(k=>sel(title(k),`cybernetics.${k}`,manifest.cybernetics[k],x[k])).join('')}</div>`)+
      section('Head / Face Side',`<div class="projection-form-grid projection-forge-two-col">${Object.keys(sideKeys).map(k=>sel(`${title(k)} Side`,`cybernetics.${k}Side`,sideKeys[k],x[`${k}Side`]||'right')).join('')}</div>`);
    }

    const a=$('projectionFullForgeAnimation');
    if(a) a.innerHTML=section('Animation Clip',`<div class="projection-form-grid">${sel('Preview','animation',manifest.animations,f.animation)}</div><div class="mini">Uses the MakeHuman Mixamo-compatible skeleton and the CC0 Universal Animation Library. Legacy Vitruvian is retained only as a load fallback.</div>`);
    wire();
  }
  function setPath(obj,path,val){ const parts=path.split('.'); let o=obj; while(parts.length>1){ const k=parts.shift(); o[k]=o[k]||{}; o=o[k]; } o[parts[0]]=val; }
  function wire(){
    document.querySelectorAll('[data-ff-key]').forEach(el=>{ el.onchange=()=>{ const p={}; setPath(p,el.dataset.ffKey,el.value); patch(p); render(); }; });
    document.querySelectorAll('[data-ff-range]').forEach(el=>{ el.oninput=()=>{ const k=el.dataset.ffRange; const b=document.querySelector(`[data-ff-value="${k}"]`); if(b)b.textContent=el.value; patch({[k]:Number(el.value)}); }; });
    document.querySelectorAll('[data-ff-check]').forEach(el=>{ el.onchange=()=>patch({[el.dataset.ffCheck]:!!el.checked}); });
  }
  async function init(){
    try{ manifest=await fetch('/assets/characters/character_forge_manifest.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(String(r.status));return r.json();}); }
    catch(e){ console.error('Full Forge manifest failed',e); return; }
    render();
    window.addEventListener('veilwatch:projection3d-ready',()=>setTimeout(render,50));
    document.addEventListener('click',e=>{ if(e.target?.dataset?.ctab==='projection') setTimeout(render,50); });
  }
  window.VeilwatchFullForge={render,forge,patch};
  window.addEventListener('DOMContentLoaded',()=>{ setTimeout(init,50); let last=''; setInterval(()=>{ const id=bridge()?.currentCharacter?.()?.id||''; if(id!==last){last=id; if(manifest) render();} },700); });
})();
