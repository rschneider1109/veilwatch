const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

function rebuildChunkedAsset({ partsDir, partPrefix, outputFile }){
  if(fs.existsSync(outputFile)) return;
  if(!fs.existsSync(partsDir)) return;

  const parts = fs.readdirSync(partsDir)
    .filter(name => name.startsWith(partPrefix))
    .sort();

  if(!parts.length) return;

  fs.mkdirSync(path.dirname(outputFile), { recursive:true });
  const out = fs.openSync(outputFile, "w");
  try{
    for(const name of parts){
      const data = fs.readFileSync(path.join(partsDir, name));
      fs.writeSync(out, data);
    }
  } finally {
    fs.closeSync(out);
  }

  console.log(`Rebuilt chunked asset: ${outputFile} from ${parts.length} parts.`);
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

async function ensureVitruvianTextures(){
  const destDir = path.join("public", "assets", "characters", "textures", "vitruvian");
  fs.mkdirSync(destDir, { recursive:true });

  const base = "https://raw.githubusercontent.com/ibrews/VitruvianGodot/main/godot_project";
  const files = [
    "vit_body_bc.png",
    "vit_body_n.png",
    "vit_body_rough.png",
    "vit_fabric_n.png",
    "vit_face_bc.png",
    "vit_face_n.png",
    "vit_face_rough.png",
    "vit_hair_diffuse.png",
    "vit_hair_normal.png",
    "vit_hair_opacity.png",
    "vit_iris.png",
    "vit_mouth.png",
    "vit_sclera.png"
  ];

  for(const name of files){
    const out = path.join(destDir, name);
    if(fs.existsSync(out) && fs.statSync(out).size > 1024) continue;
    const url = `${base}/${name}`;
    console.log(`Fetching Vitruvian texture: ${name}`);
    const data = await fetchWithRetry(url);
    fs.writeFileSync(out, data);
  }

  console.log(`Vitruvian texture set ready: ${files.length} files.`);
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


async function ensureQuaterniusAnimationAssets(){
  const destDir = path.join("public", "assets", "characters", "animations", "quaternius");
  fs.mkdirSync(destDir, { recursive:true });

  // Quaternius Universal Animation Library 1/2 are CC0. These GLB mirrors
  // are downloaded during the Docker build so the large animation libraries
  // do not have to live in the GitHub source tree. The native Vitruvian clips
  // remain a runtime fallback if the mirror is temporarily unavailable.
  const assets = [
    ["UAL1_Standard.glb", "https://raw.githubusercontent.com/richardanaya/metaverse-avatar/master/anims/UAL1_Standard.glb"],
    ["UAL2_Standard.glb", "https://raw.githubusercontent.com/richardanaya/metaverse-avatar/master/anims/UAL2_Standard.glb"]
  ];

  for(const [name, url] of assets){
    const out = path.join(destDir, name);
    if(fs.existsSync(out) && fs.statSync(out).size > 1024) continue;
    try{
      console.log(`Fetching CC0 Quaternius animation library: ${name}`);
      const data = await fetchWithRetry(url, 3);
      fs.writeFileSync(out, data);
    }catch(err){
      console.warn(`Quaternius animation library unavailable (${name}); native Vitruvian clips will remain available:`, err?.message || err);
    }
  }
}

async function main(){
  rebuildChunkedAsset({
    partsDir: path.join("public", "assets", "characters", "bases", "chunks"),
    partPrefix: "vitruvian_body.glb.part",
    outputFile: path.join("public", "assets", "characters", "bases", "vitruvian_body.glb")
  });
  rebuildChunkedAsset({
    partsDir: path.join("public", "assets", "characters", "bases", "chunks"),
    partPrefix: "vitruvian_head.glb.part",
    outputFile: path.join("public", "assets", "characters", "bases", "vitruvian_head.glb")
  });
  rebuildChunkedAsset({
    partsDir: path.join("public", "assets", "characters", "hair", "chunks"),
    partPrefix: "vitruvian_hair_rigged.glb.part",
    outputFile: path.join("public", "assets", "characters", "hair", "vitruvian_hair_rigged.glb")
  });

  await ensureVitruvianTextures();
  await ensureFpsWeaponAssets();
  await ensureQuaterniusAnimationAssets();

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
