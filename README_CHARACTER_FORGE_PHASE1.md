# Veilwatch Character Forge - Phase 1

## Goal
Replace the CSS-only Projection Bay mannequin with a real browser 3D renderer without redesigning the existing Veilwatch layout.

## What changed

### 3D renderer
- Added `api/src/3d/projection_renderer.mjs`.
- Uses Three.js for WebGL rendering.
- Uses OrbitControls for mouse/touch rotation and wheel/pinch zoom.
- Uses GLTFLoader for `.glb` and `.gltf` files.
- Registers `@pixiv/three-vrm` so `.vrm` avatars can also be loaded.
- Plays the first embedded animation automatically, preferring an animation with `idle` in its name.
- Uses an internal procedural humanoid when no model path is configured, so the feature can be tested before a permanent character asset is selected.

### Projection Bay integration
- The existing hologram chamber, rings, grid, scan line, controls, and saved projection data remain in place.
- The old CSS mannequin inside `#projectionAvatar` was replaced by a WebGL viewport.
- Existing Scale, Posture, and Signal controls now update the 3D renderer.
- Model Link / Asset Path now loads a real model when the field changes.
- If loading fails, Veilwatch falls back to the prototype humanoid instead of leaving the chamber blank.

### Model asset folders
Added:
- `api/public/assets/characters/bases/`
- `api/public/assets/characters/animations/`
- `api/public/assets/characters/clothing/`
- `api/public/assets/characters/hair/`
- `api/public/assets/characters/equipment/`

Example model path:

`/assets/characters/bases/my-character.glb`

### Docker/build changes
- Added Three.js `0.185.1`.
- Added `@pixiv/three-vrm` `3.5.5`.
- Added esbuild `0.28.2`.
- Docker now runs `npm run build:3d` during image creation and produces `public/js/projection_renderer.bundle.js`.

### Static file support
`app.js` now sends appropriate content types for:
- `.glb`
- `.gltf`
- `.vrm`
- `.bin`

## How to test
1. Rebuild/redeploy the `veilwatch_app` Docker image.
2. Open Veilwatch.
3. Select a character.
4. Open **Character > Projection**.
5. You should see the built-in 3D prototype humanoid.
6. Drag the character with the mouse to rotate it.
7. Use the mouse wheel to zoom.
8. Change Scale, Posture, or Signal State and confirm the live view responds.

## Testing an external model
Put a redistribute-safe `.glb`, `.gltf`, or `.vrm` file under `api/public/assets/characters/bases/` before rebuilding the container.

For example:

`api/public/assets/characters/bases/test-character.glb`

Then enter this into **Model Link / Asset Path**:

`/assets/characters/bases/test-character.glb`

Move focus out of the field to trigger the load, then save the Projection profile.

## Next phase
After this renderer is confirmed working, Phase 2 should add the real Veilwatch base humanoid and the first appearance sliders. Do not build the full clothing/anatomy system until the base rig and morph-target pipeline are proven.
