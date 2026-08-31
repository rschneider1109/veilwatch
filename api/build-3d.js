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
