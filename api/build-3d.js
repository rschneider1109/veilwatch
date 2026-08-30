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

  // The chunks only exist to get large assets through normal GitHub uploads.
  // Remove them from the build output after reconstruction.
  for(const name of parts){
    fs.unlinkSync(path.join(partsDir, name));
  }
  try{ fs.rmdirSync(partsDir); }catch(_e){}
}

rebuildChunkedAsset({
  partsDir: path.join("public", "assets", "characters", "hair", "chunks"),
  partPrefix: "vitruvian_hair_rigged.glb.part",
  outputFile: path.join("public", "assets", "characters", "hair", "vitruvian_hair_rigged.glb")
});

esbuild.build({
  entryPoints: ["src/3d/projection_renderer.mjs"],
  bundle: true,
  minify: true,
  sourcemap: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  outfile: "public/js/projection_renderer.bundle.js",
  legalComments: "eof"
}).then(()=>{
  console.log("Veilwatch 3D projection bundle built.");
}).catch((err)=>{
  console.error(err);
  process.exit(1);
});
