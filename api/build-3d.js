const esbuild = require("esbuild");

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
