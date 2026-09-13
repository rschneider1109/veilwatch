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

  const animationRoot=path.join(characterRoot,"animations","quaternius");
  const animationFile=path.join(animationRoot,"UAL1_Standard.glb");
  const basisFile=path.join(animationRoot,"UAL1_makehuman_basis.json");
  if(!fs.existsSync(animationFile) || fs.statSync(animationFile).size < 1024*1024){
    throw new Error(`Missing local Quaternius animation library: ${animationFile}`);
  }
  if(!fs.existsSync(basisFile)) throw new Error(`Missing canonical UAL1/MakeHuman rig basis: ${basisFile}`);

  const glb=readGlbJson(animationFile);
  const nodeNames=(glb.nodes||[]).map(x=>x.name||"");
  const animationNames=(glb.animations||[]).map(x=>x.name||"");
  const manifest=JSON.parse(fs.readFileSync(path.join(characterRoot,"character_forge_manifest.json"),"utf8"));
  const expectedAnimations=(manifest.animations||[]).map(x=>x.id);
  const missingAnimations=expectedAnimations.filter(x=>!animationNames.includes(x));
  const extraAnimations=animationNames.filter(x=>!expectedAnimations.includes(x));
  if(expectedAnimations.length!==43 || animationNames.length!==43 || missingAnimations.length || extraAnimations.length){
    throw new Error(`UAL1 animation catalog mismatch (${animationNames.length} GLB / ${expectedAnimations.length} manifest; missing=${missingAnimations.join(",")}; extra=${extraAnimations.join(",")})`);
  }

  const basis=JSON.parse(fs.readFileSync(basisFile,"utf8"));
  const basisBones=basis.bones||{};
  const rig=JSON.parse(fs.readFileSync(path.join(characterRoot,"makehuman","runtime","rig.mixamo.json"),"utf8"));
  const rigBoneNames=Object.keys(rig.bones||{});
  if(Object.keys(basisBones).length!==52 || rigBoneNames.length!==52){
    throw new Error(`Canonical animation basis incomplete (${Object.keys(basisBones).length} basis bones / ${rigBoneNames.length} rig bones)`);
  }
  for(const name of rigBoneNames){
    const row=basisBones[name];
    if(!row || !nodeNames.includes(row.source) || !Array.isArray(row.restLocalQuaternion) || row.restLocalQuaternion.length!==4){
      throw new Error(`Canonical animation basis missing/invalid for ${name}`);
    }
  }

  // Direct local-track transfer is only valid when the mapped source and target
  // hierarchies are isomorphic. Verify that contract during the Docker build so
  // a future asset change cannot silently reintroduce twisted limbs.
  const mappedSourceToTarget=new Map(Object.entries(basisBones).map(([target,row])=>[row.source,target]));
  const sourceParents=new Map();
  for(let i=0;i<(glb.nodes||[]).length;i++){
    for(const child of glb.nodes[i].children||[]) sourceParents.set(glb.nodes[child]?.name||"",glb.nodes[i]?.name||"");
  }
  for(const [target,row] of Object.entries(basisBones)){
    let sourceParent=sourceParents.get(row.source)||"";
    while(sourceParent && !mappedSourceToTarget.has(sourceParent)) sourceParent=sourceParents.get(sourceParent)||"";
    const expectedParent=mappedSourceToTarget.get(sourceParent)||"";
    const actualParent=String(rig.bones?.[target]?.parent||"");
    if(expectedParent!==actualParent){
      throw new Error(`UAL1/MakeHuman hierarchy mismatch for ${target}: expected parent ${expectedParent||"<root>"}, got ${actualParent||"<root>"}`);
    }
  }

  for(const animation of glb.animations||[]){
    const rotations=new Set();
    let hasPelvisTranslation=false;
    for(const channel of animation.channels||[]){
      const nodeName=glb.nodes?.[channel.target?.node]?.name||"";
      if(channel.target?.path==="rotation") rotations.add(nodeName);
      if(nodeName==="pelvis" && channel.target?.path==="translation") hasPelvisTranslation=true;
    }
    const missingBasisTracks=Object.values(basisBones).map(x=>x.source).filter(x=>!rotations.has(x));
    if(missingBasisTracks.length || !hasPelvisTranslation){
      throw new Error(`Animation ${animation.name} cannot drive canonical MakeHuman rig (missing rotations=${missingBasisTracks.join(",")}, pelvisTranslation=${hasPelvisTranslation})`);
    }
  }

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

  console.log(`Section 5 runtime ready: 43 canonical/validated local animation clips, 52 mapped MakeHuman bones, ${(poseCatalog.poses||[]).length} poses, ${(facialCatalog.faceUnits||[]).length} faceunits, ${(facialCatalog.visemes||[]).length} visemes, ${(weaponCatalog.weapons||[]).length} Quaternius weapons.`);
}

async function main(){
  ensureMakeHumanRuntimeData();
  ensureMakeHumanAppearanceData();
  await ensureFpsWeaponAssets();
  ensureSection5RuntimeData();

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
