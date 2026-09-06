# Veilwatch Character Forge v1.0

This build replaces the incremental Character Forge work with the integrated v1 system.

## Included
- Adult-human-only body system with masculine/feminine frame controls
- Independent chest and genital anatomy selection
- Live body proportion and structural face morph controls
- Skin tones, realistic iris/pupil rendering, eyebrow styles, hair colors, facial hair
- 12 hairstyle choices including the original Vitruvian bob and separate fitted Veilwatch meshes
- Body hair, scars, tattoos, piercings, and facial scars
- Large modular wardrobe catalog with per-category colors and fitted runtime garments
- Required Veilwatch Projection Cuff, auto-equipped with left/right forearm selection
- Full current 26-item Veilwatch weapon catalog with local visual GLBs and carry sockets
- Modular eye/head/arm/leg/torso cybernetics
- Native and external CC0 animation support with runtime retargeting
- Save/load through the existing character appearance object
- GitHub-safe chunked Vitruvian source assets reconstructed during Docker build

## Runtime build
`npm run build:3d` reconstructs the chunked Vitruvian body/head/hair models, acquires the existing Vitruvian PBR texture set, attempts to acquire optional CC0 animation/weapon enhancement libraries, and bundles the Three.js renderer.

The locally bundled Veilwatch hair, brow, facial-hair, anatomy, cuff, cybernetic, and weapon assets do not depend on those optional downloads.

## QA performed before packaging
- JavaScript syntax checks passed for public JS, renderer source, app.js, and build-3d.js
- Character Forge JSON manifests parse successfully
- No duplicate HTML IDs
- 69 bundled GLB files have valid glTF 2.0 binary headers
- All manifest-referenced local assets exist
- 26 local weapon GLBs correspond to the 26 current Veilwatch weapon IDs
- No GitHub source file exceeds 5 MiB; large Vitruvian GLBs are stored as chunks

The first Docker/browser deploy should be treated as the visual QA pass for fit, clipping, positioning, and artistic tuning.
