const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function ensureMakeHumanRuntimeData(){
  const root = path.join("public", "assets", "characters", "makehuman", "runtime");
  const required = [
    "base.obj",
    "basemesh_vertex_groups.json",
    "hm08_config.json",
    "rig.mixamo.json",
    "weights.mixamo.json.gz",
    "target_manifest.json"
  ];
  for(const name of required){
    const fp = path.join(root, name);
    if(!fs.existsSync(fp) || fs.statSync(fp).size < 16){
      throw new Error(`Missing MakeHuman runtime file: ${fp}`);
    }
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(root, "target_manifest.json"), "utf8"));
  const targets = new Set();
  for(const pair of Object.values(manifest.pairs || {})) for(const rel of pair) targets.add(rel);
  for(const pair of Object.values(manifest.breastCup || {})) for(const rel of pair) targets.add(rel);
  const macro = manifest.macro || {};
  for(const gender of macro.genders || []) for(const age of macro.ages || []){
    for(const muscle of macro.muscle || []) for(const weight of macro.weight || []){
      targets.add(String(macro.pattern || "")
        .replace("{gender}", gender)
        .replace("{age}", age)
        .replace("{muscle}", muscle)
        .replace("{weight}", weight));
    }
  }
  for(const rel of targets){
    const fp = path.join(root, "targets", rel);
    if(!fs.existsSync(fp)) throw new Error(`Missing MakeHuman target: ${rel}`);
  }

  const rig = JSON.parse(fs.readFileSync(path.join(root, "rig.mixamo.json"), "utf8"));
  const weights = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, "weights.mixamo.json.gz"))).toString("utf8"));
  const rigBones = Object.keys(rig.bones || {});
  const weightBones = Object.keys(weights.weights || {});
  if(!rigBones.length || rigBones.length !== weightBones.length){
    throw new Error(`MakeHuman Mixamo rig/weight mismatch (${rigBones.length} rig bones, ${weightBones.length} weight bones)`);
  }
  console.log(`MakeHuman runtime ready: ${rigBones.length} bones, ${targets.size} target files.`);
}

function ensureMakeHumanAppearanceData(){
  const root = path.join("public", "assets", "characters", "makehuman");
  const libraryCatalogPath = path.join(root, "library", "catalog.json");
  const surfaceCatalogPath = path.join(root, "surfaces", "catalog.json");
  if(!fs.existsSync(libraryCatalogPath)) throw new Error(`Missing MakeHuman appearance catalog: ${libraryCatalogPath}`);
  if(!fs.existsSync(surfaceCatalogPath)) throw new Error(`Missing MakeHuman surface catalog: ${surfaceCatalogPath}`);

  const library = JSON.parse(fs.readFileSync(libraryCatalogPath, "utf8"));
  const requiredCounts = { hair:35, facialHair:9, brows:14, eyelashes:5, baseLayer:58, top:42, bottoms:45, onePiece:64, socks:4, shoes:59, gloves:9, headwear:39, eyewear:15, neck:45, vest:3, back:10 };
  for(const [category, minimum] of Object.entries(requiredCounts)){
    const count = (library.categories?.[category] || []).length;
    if(count < minimum) throw new Error(`MakeHuman ${category} catalog incomplete (${count}/${minimum})`);
  }
  for(const row of library.packs || []){
    const fp = path.join(root, "library", "packs", row.file);
    if(!fs.existsSync(fp)) throw new Error(`Missing MakeHuman appearance pack: ${row.file}`);
    if(fs.statSync(fp).size > 10 * 1024 * 1024) throw new Error(`MakeHuman appearance pack too large for stable browser loading: ${row.file}`);
    const parsed = JSON.parse(zlib.gunzipSync(fs.readFileSync(fp)).toString("utf8"));
    if(!(parsed.assets || []).length) throw new Error(`Empty MakeHuman appearance pack: ${row.file}`);
  }

  const surfaces = JSON.parse(fs.readFileSync(surfaceCatalogPath, "utf8"));
  const surfaceRows = Object.values(surfaces.surfaces || {});
  const skins = surfaceRows.filter(x => x.kind === "skin").length;
  const eyes = surfaceRows.filter(x => x.kind === "eye").length;
  if(skins < 50 || eyes < 20) throw new Error(`MakeHuman surface catalog incomplete (${skins} skins, ${eyes} eyes)`);
  for(const file of new Set(surfaceRows.map(x => x.pack).filter(Boolean))){
    const fp = path.join(root, "surfaces", "packs", file);
    if(!fs.existsSync(fp)) throw new Error(`Missing MakeHuman surface pack: ${file}`);
    const parsed = JSON.parse(zlib.gunzipSync(fs.readFileSync(fp)).toString("utf8"));
    if(!(parsed.surfaces || []).length) throw new Error(`Empty MakeHuman surface pack: ${file}`);
  }
  console.log(`MakeHuman appearance/wardrobe ready: ${requiredCounts.hair} hair, ${requiredCounts.facialHair} facial hair, ${requiredCounts.brows} brows, ${requiredCounts.eyelashes} lashes, ${requiredCounts.top} tops, ${requiredCounts.bottoms} bottoms, ${requiredCounts.onePiece} dresses/suits, ${requiredCounts.baseLayer} base layers, ${requiredCounts.socks} socks, ${requiredCounts.shoes} shoes, ${requiredCounts.gloves} gloves, ${requiredCounts.headwear} headwear, ${requiredCounts.eyewear} eyewear, ${requiredCounts.neck} jewelry, ${requiredCounts.vest} vests/rigs, ${requiredCounts.back} carried gear, ${skins} skins, ${eyes} eye materials.`);
}


function ensureMakeHumanWardrobeManifestAlignment(){
  const root = path.join("public", "assets", "characters", "makehuman");
  const catalog = JSON.parse(fs.readFileSync(path.join(root, "library", "catalog.json"), "utf8"));
  const manifestPath = path.join("public", "assets", "characters", "character_forge_manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const slots = ["baseLayer","top","bottoms","onePiece","socks","shoes","gloves","headwear","eyewear","neck","vest","back"];
  let checked = 0;
  for(const slot of slots){
    for(const row of manifest.clothing?.[slot] || []){
      const id=String(typeof row === "string" ? row : row?.id || "");
      if(!id || id === "none") continue;
      const nativeRow=catalog.assets?.[id];
      if(!nativeRow) throw new Error(`Character Forge wardrobe option missing from native catalog: ${slot} -> ${id}`);
      if(String(nativeRow.category||"") !== slot) throw new Error(`Character Forge wardrobe category mismatch: ${slot} -> ${id} (${nativeRow.category})`);
      checked++;
    }
  }
  if(checked < 390) throw new Error(`Character Forge wardrobe manifest unexpectedly small (${checked} native options)`);
  console.log(`Character Forge wardrobe alignment ready: ${checked} selectable native assets resolve to their runtime catalog slots.`);
}

function ensureMakeHumanWardrobeIntegrity(){
  const root = path.join("public", "assets", "characters", "makehuman");
  const runtimeRoot = path.join(root, "runtime");
  const catalogPath = path.join(root, "library", "catalog.json");
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

  // The native MHCLO mapping references vertices in HM08 base.obj. Validate the
  // entire wardrobe during Docker build so one malformed community asset cannot
  // crash the Character Forge later during a long browser session.
  const baseObj = fs.readFileSync(path.join(runtimeRoot, "base.obj"), "utf8");
  let baseVertexCount = 0;
  for(const line of baseObj.split(/\r?\n/)) if(line.startsWith("v ")) baseVertexCount++;
  if(baseVertexCount < 10000) throw new Error(`Unexpected MakeHuman base vertex count: ${baseVertexCount}`);

  const packCache = new Map();
  const getPack = (file)=>{
    if(packCache.has(file)) return packCache.get(file);
    const fp = path.join(root, "library", "packs", file);
    const parsed = JSON.parse(zlib.gunzipSync(fs.readFileSync(fp)).toString("utf8"));
    if((parsed.failures || []).length) throw new Error(`MakeHuman pack contains conversion failures: ${file}`);
    const map = new Map((parsed.assets || []).map(asset=>[asset.id, asset]));
    packCache.set(file, map);
    return map;
  };

  const wearableCategories = new Set(["baseLayer","top","bottoms","onePiece","socks","shoes","gloves","headwear","eyewear","neck","vest","back"]);
  let checked = 0;
  let mappedVertices = 0;
  let triangles = 0;
  let extrapolatedMappings = 0;

  for(const [id,row] of Object.entries(catalog.assets || {})){
    if(!wearableCategories.has(row.category)) continue;
    const asset = getPack(row.pack).get(id);
    if(!asset) throw new Error(`Wardrobe catalog asset missing from pack: ${id} -> ${row.pack}`);
    const mapping = asset.mapping || [];
    const geometry = asset.geometry || {};
    const uv = geometry.uvs || [];
    const tri = geometry.triangles || [];
    const declared = Number(geometry.vertexCount ?? mapping.length);
    if(!mapping.length || mapping.length !== declared) throw new Error(`Wardrobe mapping/vertex mismatch: ${id}`);
    if(tri.length < 6 || tri.length % 6 !== 0) throw new Error(`Wardrobe triangle stream invalid: ${id}`);

    for(let i=0;i<mapping.length;i++){
      const m=mapping[i];
      if(!Array.isArray(m) || m.length < 9) throw new Error(`Wardrobe MHCLO mapping invalid: ${id} vertex ${i}`);
      for(let k=0;k<3;k++){
        const vi=Number(m[k]);
        if(!Number.isInteger(vi) || vi<0 || vi>=baseVertexCount) throw new Error(`Wardrobe base vertex out of range: ${id} -> ${vi}`);
      }
      for(let k=3;k<9;k++) if(!Number.isFinite(Number(m[k]))) throw new Error(`Wardrobe mapping contains non-finite value: ${id}`);
      const bary=[Number(m[3]),Number(m[4]),Number(m[5])];
      const barySum=bary[0]+bary[1]+bary[2];
      if(Math.abs(barySum-1)>0.02) throw new Error(`Wardrobe barycentric mapping does not sum to 1: ${id} vertex ${i} -> ${barySum}`);
      if(bary.some(w=>w<0 || w>1)) extrapolatedMappings++;
    }

    for(let i=0;i<tri.length;i+=2){
      const vi=Number(tri[i]);
      const ti=Number(tri[i+1]);
      if(!Number.isInteger(vi) || vi<0 || vi>=mapping.length) throw new Error(`Wardrobe triangle vertex out of range: ${id}`);
      if(ti>=0 && (!Number.isInteger(ti) || ti*2+1>=uv.length)) throw new Error(`Wardrobe UV index out of range: ${id}`);
    }

    for(const viRaw of asset.delete || []){
      const vi=Number(viRaw);
      if(!Number.isInteger(vi) || vi<0 || vi>=baseVertexCount) throw new Error(`Wardrobe delete_verts index out of range: ${id} -> ${vi}`);
    }

    const zDepth=Number(asset.mhclo?.z_depth ?? 50);
    if(!Number.isFinite(zDepth) || zDepth<0 || zDepth>100) throw new Error(`Wardrobe z_depth invalid: ${id} -> ${zDepth}`);
    checked++;
    mappedVertices += mapping.length;
    triangles += tri.length/6;
  }

  if(checked < 390) throw new Error(`MakeHuman wardrobe unexpectedly small (${checked} assets)`);
  console.log(`MakeHuman wardrobe integrity ready: ${checked} wearables, ${mappedVertices} fitted vertices, ${triangles} triangles, ${extrapolatedMappings} authored extrapolated mappings validated against ${baseVertexCount} HM08 vertices.`);
}

async function fetchWithRetry(url, tries=4){
  let lastErr = null;
  for(let attempt=1; attempt<=tries; attempt++){
    try{
      const res = await fetch(url, { redirect:"follow" });
      if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return Buffer.from(await res.arrayBuffer());
    }catch(err){
      lastErr = err;
      if(attempt < tries){
        await new Promise(r=>setTimeout(r, 700 * attempt));
      }
    }
  }
  throw lastErr;
}

async function ensureFpsWeaponAssets(){
  const destDir = path.join("public", "assets", "characters", "weapons", "fps_cc0");
  fs.mkdirSync(destDir, { recursive:true });

  const families = {
    West: [
      "Pistol_Compact_West.glb", "Pistol_Full_West.glb",
      "Rifle_Assault_West.glb", "Rifle_Battle_West.glb",
      "SMG_Compact_West.glb", "SMG_Full_West.glb",
      "Shotgun_Auto_West.glb", "Shotgun_Pump_West.glb",
      "Sniper_Material_West.glb", "Sniper_Rifle_West.glb"
    ],
    East: [
      "Pistol_Compact_East.glb", "Pistol_Full_East.glb",
      "Rifle_Assault_East.glb", "Rifle_Battle_East.glb",
      "SMG_Compact_East.glb", "SMG_Full_East.glb",
      "Shotgun_Auto_East.glb", "Shotgun_Pump_East.glb",
      "Sniper_Material_East.glb", "Sniper_Rifle_East.glb"
    ]
  };

  for(const [side, names] of Object.entries(families)){
    const folder = side === "West" ? "flat_guns_west/Flat%20Guns%20West" : "flat_guns_east/Flat%20Guns%20East";
    for(const name of names){
      const out = path.join(destDir, name);
      if(fs.existsSync(out) && fs.statSync(out).size > 1024) continue;
      const url = `https://raw.githubusercontent.com/petroulacl/fps-asset-kit/main/weapons/${folder}/GLB/${name}`;
      try{
        console.log(`Fetching CC0 weapon asset: ${name}`);
        const data = await fetchWithRetry(url, 3);
        fs.writeFileSync(out, data);
      }catch(err){
        // Weapon models are an enhancement. The runtime has procedural fallbacks
        // for every Veilwatch weapon ID, so a temporary upstream outage must not
        // prevent the whole Veilwatch image from building.
        console.warn(`CC0 weapon asset unavailable (${name}); runtime fallback will be used:`, err?.message || err);
      }
    }
  }
}



function readGlbJson(file){
  const data=fs.readFileSync(file);
  if(data.length<20 || data.readUInt32LE(0)!==0x46546c67) throw new Error(`Invalid GLB: ${file}`);
  let offset=12;
  while(offset+8<=data.length){
    const length=data.readUInt32LE(offset);
    const type=data.readUInt32LE(offset+4);
    offset+=8;
    if(type===0x4e4f534a){
      return JSON.parse(data.subarray(offset,offset+length).toString("utf8").replace(/\0+$/,""));
    }
    offset+=length;
  }
  throw new Error(`GLB JSON chunk missing: ${file}`);
}

function ensureSection5RuntimeData(){
  const characterRoot=path.join("public","assets","characters");

  // Animation playback is intentionally parked in this stability build.
  // Keep source animation assets in the repository for later offline/native
  // MakeHuman conversion, but do not make Docker deployment depend on them.

  const weaponRoot=path.join(characterRoot,"weapons","quaternius_fbx");
  const weaponCatalogPath=path.join(weaponRoot,"catalog.json");
  if(!fs.existsSync(weaponCatalogPath)) throw new Error(`Missing Quaternius weapon catalog: ${weaponCatalogPath}`);
  const weaponCatalog=JSON.parse(fs.readFileSync(weaponCatalogPath,"utf8"));
  if((weaponCatalog.weapons||[]).length < 46) throw new Error(`Quaternius weapon catalog incomplete (${(weaponCatalog.weapons||[]).length}/46)`);
  for(const row of weaponCatalog.weapons||[]){
    const fp=path.join(weaponRoot,row.file);
    if(!fs.existsSync(fp) || fs.statSync(fp).size < 512) throw new Error(`Missing Quaternius FBX weapon: ${row.file}`);
  }

  const facialRoot=path.join(characterRoot,"makehuman","facial");
  const facialCatalogPath=path.join(facialRoot,"catalog.json");
  const facialPackPath=path.join(facialRoot,"facial_targets.vwpack.json.gz");
  if(!fs.existsSync(facialCatalogPath) || !fs.existsSync(facialPackPath)) throw new Error("Missing MakeHuman facial runtime data");
  const facialCatalog=JSON.parse(fs.readFileSync(facialCatalogPath,"utf8"));
  if((facialCatalog.faceUnits||[]).length < 52 || (facialCatalog.visemes||[]).length < 37){
    throw new Error(`MakeHuman facial catalog incomplete (${(facialCatalog.faceUnits||[]).length} faceunits, ${(facialCatalog.visemes||[]).length} visemes)`);
  }
  const facialPack=JSON.parse(zlib.gunzipSync(fs.readFileSync(facialPackPath)).toString("utf8"));
  if(Object.keys(facialPack.targets||{}).length < 89) throw new Error(`MakeHuman facial target pack incomplete (${Object.keys(facialPack.targets||{}).length}/89)`);

  const poseRoot=path.join(characterRoot,"makehuman","poses");
  const poseCatalogPath=path.join(poseRoot,"catalog.json");
  if(!fs.existsSync(poseCatalogPath)) throw new Error(`Missing MakeHuman pose catalog: ${poseCatalogPath}`);
  const poseCatalog=JSON.parse(fs.readFileSync(poseCatalogPath,"utf8"));
  if((poseCatalog.poses||[]).length < 81) throw new Error(`MakeHuman pose catalog incomplete (${(poseCatalog.poses||[]).length}/81)`);
  for(const file of new Set((poseCatalog.poses||[]).map(x=>x.pack).filter(Boolean))){
    const fp=path.join(poseRoot,"packs",file);
    if(!fs.existsSync(fp)) throw new Error(`Missing MakeHuman pose pack: ${file}`);
    const parsed=JSON.parse(zlib.gunzipSync(fs.readFileSync(fp)).toString("utf8"));
    if(!(parsed.poses||[]).length) throw new Error(`Empty MakeHuman pose pack: ${file}`);
  }

  console.log(`Section 5 runtime ready (animations parked): ${(poseCatalog.poses||[]).length} poses, ${(facialCatalog.faceUnits||[]).length} faceunits, ${(facialCatalog.visemes||[]).length} visemes, ${(weaponCatalog.weapons||[]).length} Quaternius weapons.`);
}


function ensureSection7EquipmentRuntimeData(){
  const characterRoot=path.join("public","assets","characters");
  const manifestPath=path.join(characterRoot,"character_forge_manifest.json");
  const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));

  const cuff=manifest.equipment?.cuff||{};
  if(cuff.required!==true) throw new Error("Veilwatch projection cuff must remain required");
  const cuffArms=new Set(cuff.arms||[]);
  if(!cuffArms.has("left") || !cuffArms.has("right") || cuffArms.size!==2){
    throw new Error(`Projection cuff arm selector invalid: ${JSON.stringify(cuff.arms||[])}`);
  }
  if(!String(cuff.asset||"").startsWith("procedural://veilwatch_projection_cuff_")){
    throw new Error(`Projection cuff manifest no longer points at the locked procedural design: ${cuff.asset}`);
  }

  const expectedCarry=["right_hand","left_hand","right_hip","left_hip","back","chest"];
  const carry=new Set(manifest.equipment?.carry||[]);
  for(const id of expectedCarry) if(!carry.has(id)) throw new Error(`Missing equipment carry socket: ${id}`);

  const belts=(manifest.clothing?.belt||[]).map(x=>String(typeof x==="string"?x:x?.id||"")).filter(x=>x&&x!=="none");
  if(belts.length<5) throw new Error(`Load-bearing belt catalog incomplete (${belts.length}/5)`);

  const cyberRoot=path.join(characterRoot,"cybernetics","veilwatch_original");
  const cyberFiles=[
    "synthetic_eye.glb","camera_eye.glb","temple_port.glb","ear_comms.glb","jaw_plate.glb",
    "neck_port.glb","chest_interface.glb","spine_interface.glb","cyber_hand.glb","cyber_forearm.glb",
    "full_cyber_arm.glb","cyber_foot.glb","cyber_lower_leg.glb","full_cyber_leg.glb"
  ];
  for(const file of cyberFiles){
    const fp=path.join(cyberRoot,file);
    if(!fs.existsSync(fp) || fs.statSync(fp).size<512) throw new Error(`Missing cybernetic equipment asset: ${file}`);
  }

  const catalogPath=path.resolve("public","js","veilwatch_catalog.js");
  delete require.cache[catalogPath];
  const charCatalog=require(catalogPath);
  const veilwatchWeapons=Object.values(charCatalog.weapons||{}).flat().filter(x=>x?.id);
  if(veilwatchWeapons.length<26) throw new Error(`Veilwatch weapon catalog incomplete (${veilwatchWeapons.length}/26)`);
  const localWeaponRoot=path.join(characterRoot,"weapons","veilwatch_local");
  for(const row of veilwatchWeapons){
    const fp=path.join(localWeaponRoot,`${row.id}.glb`);
    if(!fs.existsSync(fp) || fs.statSync(fp).size<512) throw new Error(`Missing bundled Veilwatch weapon model: ${row.id}.glb`);
  }

  const qRoot=path.join(characterRoot,"weapons","quaternius_fbx");
  const qCatalog=JSON.parse(fs.readFileSync(path.join(qRoot,"catalog.json"),"utf8"));
  const qById=new Map((qCatalog.weapons||[]).map(row=>[String(row.id),row]));
  const nativeWeapons=(manifest.nativeWeapons||[]).filter(row=>row?.id&&row.id!=="none");
  if(nativeWeapons.length<46) throw new Error(`Character Forge armory manifest incomplete (${nativeWeapons.length}/46)`);
  for(const row of nativeWeapons){
    const q=qById.get(String(row.id));
    if(!q) throw new Error(`Character Forge weapon missing from Quaternius catalog: ${row.id}`);
    const fp=path.join(qRoot,q.file);
    if(!fs.existsSync(fp) || fs.statSync(fp).size<512) throw new Error(`Character Forge weapon file missing: ${q.file}`);
  }

  const cyberChoices=Object.values(manifest.cybernetics||{}).flat().filter(x=>x&&x!=="none");
  if(cyberChoices.length<24) throw new Error(`Cybernetic selector manifest unexpectedly small (${cyberChoices.length})`);
  console.log(`Section 7 equipment runtime ready: required cuff, ${belts.length} belts, ${veilwatchWeapons.length} Veilwatch weapons, ${nativeWeapons.length} armory weapons, ${cyberFiles.length} cybernetic GLBs, ${expectedCarry.length} carry sockets.`);
}

async function main(){
  ensureMakeHumanRuntimeData();
  ensureMakeHumanAppearanceData();
  ensureMakeHumanWardrobeManifestAlignment();
  ensureMakeHumanWardrobeIntegrity();
  await ensureFpsWeaponAssets();
  ensureSection5RuntimeData();
  ensureSection7EquipmentRuntimeData();

  await esbuild.build({
    entryPoints: ["src/3d/projection_renderer.mjs"],
    bundle: true,
    minify: true,
    sourcemap: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    outfile: "public/js/projection_renderer.bundle.js",
    legalComments: "eof"
  });

  console.log("Veilwatch 3D projection bundle built.");
}

main().catch((err)=>{
  console.error(err);
  process.exit(1);
});
