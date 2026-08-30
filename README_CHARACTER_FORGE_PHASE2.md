# Veilwatch Character Forge — Phase 2

This build upgrades the Projection Bay from the Phase 1 cyan mannequin to a realistic bundled Vitruvian-based standard body.

## What changed

- Added bundled realistic character assets:
  - `api/public/assets/characters/bases/vitruvian_body.glb`
  - `api/public/assets/characters/bases/vitruvian_head.glb`
  - `api/public/assets/characters/hair/vitruvian_hair_rigged.glb`
- Updated the 3D projection renderer to load the bundled Vitruvian character by default when no custom model link is set.
- Kept support for custom `.glb`, `.gltf`, and `.vrm` model paths through the existing Model Link / Asset Path field.
- Attached the separate head and hair assets to the body rig at runtime.
- Applied appearance-driven material styling for:
  - skin tone
  - hair color
  - eye color
  - shirt color
  - pants color
  - shoe color
- If Hair Style is set to `Bald`, the bundled hair model is hidden.
- Replaced deprecated `THREE.Clock` usage with an internal frame timer.
- Projection Bay status/readout now treat the bundled character as the default `STANDARD BODY` instead of a preview placeholder.

## Important notes

- This phase does **not** add body morph sliders yet.
- The bundled GLB files do **not** include the full body morph set from the source `.blend`; this phase focuses on getting the realistic character fully integrated into Veilwatch first.
- The standard body still works even if the Model Link / Asset Path field is blank.
- If a custom model fails to load, Veilwatch falls back to the cyan prototype mannequin.

## Deploy flow

1. Replace the repo contents with this build in GitHub.
2. Commit/push.
3. Redeploy Docker.
4. Open a character and go to the Projection tab.

Expected result:
- You should see a realistic standard body in the holographic Projection Bay.
- Changing appearance fields such as skin tone, eye color, hair color, top, bottoms, and shoes should influence the bundled character styling after syncing/saving and reopening the Projection tab.
