# Veilwatch

## Current build status

This repository is the active Veilwatch build. The Character Forge v2 migration now uses a browser-native **MakeHuman HM08 / MPFB 2.0.17 data foundation**. Blender is not required for character creation or normal deployment. Legacy Vitruvian assets remain only as a runtime fallback while the MakeHuman hair, wardrobe, and accessory catalog is migrated.

### Character Forge v2 alpha 1

- MakeHuman HM08 basemesh is loaded directly in the Projection Bay.
- MakeHuman target files drive frame, age, muscle, body-fat, body proportion, and facial sliders.
- The MPFB Mixamo-compatible rig and weights are reconstructed in the browser.
- The required Veilwatch Projection Cuff and weapon previews attach to the MakeHuman skeleton.
- Quaternius Universal Animation Library retargeting remains enabled.
- Existing character data/schema is retained.
- Vitruvian remains a safety fallback if the MakeHuman foundation cannot load.
- MakeHuman-native hair, clothing, equipment, and accessories are the next asset-integration pass.

### Deployment

Use the existing Docker/Portainer workflow. From a checked-out repository:

```text
docker compose up -d --build
```

The web UI is exposed on port `8099`, phpMyAdmin on `8283`, and MariaDB on host port `3406` in the included compose file.

---

## Original repository notes

Veilwatch Editable Repo (no base64 blob)
======================================

What this is
------------
This folder turns your working single-file stack into a normal repo you can edit.

- api/app.js  -> your actual Veilwatch server + UI (was inside APP_GZ_B64)
- api/Dockerfile, api/package.json -> builds the app image
- docker-compose.yml -> runs app + Postgres + Adminer

How to run locally
------------------
docker compose up -d --build

Open:
- http://localhost:8099/           (site)
- http://localhost:8099/api/state  (state)
- http://localhost:8099/api/health (health)
- http://localhost:8282            (Adminer DB UI)

Where to edit
-------------
Edit api/app.js

Then redeploy:
- docker compose up -d --build
or in Portainer: pull latest from GitHub + redeploy.

Veilwatch OS (Phase 2–5 + In-site Modals)
========================================

What you get
------------
Phase 2: Characters (create/select/edit/save, persists)
Phase 3: Shops (DM edit + Player buy adds to inventory + stock)
Phase 4: Notifications (Player requests + DM status)
Phase 5: Clues/Intel (DM reveal/archive; players only see revealed)
UI: Browser gray prompt boxes replaced with an in-site modal + toast.

How to run
----------
docker compose up -d --build

Open:
- http://localhost:8099/
- http://localhost:8099/api/state
- http://localhost:8099/api/health
- http://localhost:8282 (Adminer)

DM login
--------
Use the VEILWATCH_DM_KEY: "VEILWATCHDM"

Notes
-----
If Postgres password changes, delete the db volume or ALTER USER inside Postgres.

---

# Archived project notes

The former scattered README files are preserved below so their history remains searchable in one place.


---

## Source: `README_CHANGE_03_CHARACTER_FORGE_UI.md`

# Change #3 — Character Forge UI

This change redesigns the existing Projection tab into the permanent Veilwatch Character Forge workspace without changing the overall Veilwatch shell or top character-tab layout.

## What changed

- Enlarged the 3D Projection chamber to roughly two-thirds of the available desktop width.
- Reworked the right side into Forge tabs:
  - Body
  - Face
  - Hair
  - Clothing
  - Animation
  - Advanced
- Kept Save and Sync Appearance permanently visible at the top of the Forge panel.
- Moved developer-facing fields into Advanced:
  - Model Codename
  - Model Link / Asset Path
  - Projection Notes
  - Clear Custom Model
- Replaced the old lower debug boxes with a compact live footer:
  - Body
  - Outfit
  - Pose
  - Model
  - Reset Camera
- Split saved Appearance telemetry into the appropriate Forge tabs.
- Added camera view presets:
  - Body: full body
  - Face: close head/shoulders view
  - Hair: close head/hair view
  - Clothing: closer outfit view
  - Animation: full-body view
- The current Vitruvian renderer, materials, rig fixes, animation, custom model support, and GitHub-safe chunked assets are preserved.

## What this change intentionally does not do yet

This is the Character Forge workspace redesign. The Body / Face / Hair / Clothing tabs are prepared for the upcoming morph and modular-asset passes, but this change does not yet export the full source `.blend` morph library into the runtime character.

## Deploy

Upload/merge the repo files into GitHub and redeploy Docker normally.


---

## Source: `README_CHANGE_04_1_EYES_HAIR_FIX.md`

# Veilwatch Change 04.1 — Eyes + Hair Correction

Built from the latest user-supplied GitHub repo snapshot (`veilwatch-main (3)(2).zip`).

## Eye fix

The previous Three.js material setup treated the Vitruvian iris as a simple texture+tint. The source character's look-dev uses a procedural eye treatment, so the iris/pupil detail was effectively disappearing and the eyes read as solid white spots.

Veilwatch now builds its own procedural iris texture at runtime with:
- a visible dark pupil
- a dark limbal ring
- radial iris fibres
- the selected human eye colour
- separate off-white sclera and transparent cornea materials

The texture is cached by eye colour so realtime state refreshes do not rebuild it unnecessarily.

## Hair correction

Only the real Vitruvian Classic Bob asset is retained as an actual hairstyle option. The generated/transformed variants were not valid hairstyles and could float, cover the face, or appear on the torso/back.

Available scalp hair for now:
- Bald
- Classic Bob

Legacy saved styles (`buzz`, `close_crop`, `short_bob`, `long_bob`, `slicked_back`, and previous aliases) normalize to Classic Bob so old characters remain loadable.

## Next hair step

Additional hairstyles should only be added when a real fitted hair mesh/GLB exists for that style.


---

## Source: `README_CHANGE_04_2_EYE_GEOMETRY_FIX.md`

# Change 04.2 — Eye Geometry / Sclera Aperture Fix

This corrects the remaining all-white eye problem in the Vitruvian Character Forge.

## Root cause
The Vitruvian head GLB exports the iris layer slightly behind the front surface of the sclera sphere. The original Vitruvian look-development shader handles this relationship, but a normal opaque Three.js sclera material hides the iris completely.

## Fix
- Adds a generated alpha aperture to the front-center UV region of both sclera materials.
- Keeps the white sclera around the eye intact.
- Reveals the existing Vitruvian iris, pupil texture, eye-back layer, and cornea through the center opening.
- Retains the Change 04.1 selectable eye-color system.
- Does not move or distort the eye geometry.

Expected visual result: visible white sclera surrounding a colored iris with a dark pupil.


---

## Source: `README_CHANGE_04_APPEARANCE_SYSTEM.md`

# Change #4 — Character Appearance System

Change #4 turns the Character Forge appearance tabs into live, saveable controls while
keeping body morphing out of scope until the appearance foundation is stable.

## Included

- Manifest-driven character asset catalog: `api/public/assets/characters/character_assets.json`
- Human-only skin-tone library (10 realistic-range presets)
- Natural eye-color library
- Vitruvian FACS resting-face presets
- Modular starter hair system:
  - Bald
  - Buzz Cut
  - Close Crop
  - Classic Bob
  - Short Bob
  - Long Bob
  - Slicked Back
- Natural hair-color library
- Facial-hair starter system:
  - None
  - Stubble
  - Trimmed Beard
  - Full Beard
  - Mustache
  - Goatee
- Live preview in the Projection / Character Forge viewport
- Save/reload through `sheet.appearance`
- Legacy appearance aliases so existing characters using older values still load cleanly
- Character-creation Step 3 updated to the new appearance values
- JSON static MIME support for the manifest

## Important implementation note

The current VitruvianGodot package ships one realistic card-hair groom. Change #4 uses
that groom for the bob-family variants and adds lightweight procedural close-cut styles
for Buzz Cut and Close Crop. The manifest is intentionally designed so future real GLB
hairstyles can replace or expand these entries without changing the Forge UI.

Likewise, the current head GLB exposes FACS/expression blendshapes rather than the full
structural identity morph set from the source `.blend`. The Face presets in Change #4
are therefore subtle resting-face presets. Structural jaw/nose/cheek/eye/lip morphing
belongs to the later morph pass.

## Deploy

Use the full repo ZIP or apply the Change #4 patch over Change #3, commit to GitHub, then
redeploy the Docker stack normally. Docker still rebuilds the chunked Vitruvian GLBs and
fetches the CC0 Vitruvian texture maps during the image build.


---

## Source: `README_CHARACTER_FORGE_FULL_BUILD.md`

# Veilwatch Character Forge v1 - full build worktree

This worktree expands the Projection Bay into the integrated Veilwatch Character Forge.

Implemented foundation includes:
- realistic adult-human-only character schema
- masculine/feminine frame selection with independent chest and genital anatomy choices
- runtime body-shape deformation for the compact Vitruvian GLB
- separate adult anatomy GLB modules
- required auto-equipped Veilwatch projection cuff with left/right forearm selection
- the complete current Veilwatch weapon catalog mapped to visual assets/fallbacks
- CC0 Quaternius animation library acquisition and runtime retargeting to Vitruvian
- modular clothing/equipment/cybernetic UI and save schema
- corrected Vitruvian eye rendering and hidden unsupported eyeshadow look-dev cards
- GitHub-safe chunking for large Vitruvian source GLBs

Large runtime assets are reconstructed/downloaded during `npm run build:3d` in Docker.
Do not commit the reconstructed Vitruvian GLBs or downloaded Quaternius/weapon build
outputs when working from the browser-safe source tree.


---

## Source: `README_CHARACTER_FORGE_PHASE1.md`

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


---

## Source: `README_CHARACTER_FORGE_PHASE2.md`

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


---

## Source: `README_CHARACTER_FORGE_V1_1_RUNTIME_FIX.md`

# Veilwatch Character Forge v1.1 Runtime Repair

This repair corrects two renderer regressions found during the first full Forge deployment.

## Fixed

- Restores the complete visible character instead of hiding most of the Vitruvian runtime body.
- Wardrobe shells now derive from the matching authored skinned surfaces (`VitShirt`, `VitPants`, `VitShoes`) instead of trying to build full garments from the exposed-skin-only `VitBody` surface.
- The original clothed runtime surfaces remain available as structural fill so removing or layering a garment cannot leave disconnected hands, feet, neck, or torso islands.
- Structural face morphs now extend Vitruvian's existing morph-normal array together with the morph-position array. This prevents the head mesh from corrupting/disappearing while the eye meshes remain visible.
- Existing eye geometry, iris/pupil, hair, cuff, weapons, cybernetics, anatomy preview, animation, and save-data systems remain intact.

## Runtime note

The current compact Vitruvian GLB is a clothed runtime export, not a complete nude-body export. Veilwatch now handles that safely. A future dedicated nude Vitruvian export can replace the structural-fill behavior without changing the Forge schema.


---

## Source: `README_CHARACTER_FORGE_V1_COMPLETE.md`

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


---

## Source: `README_COMMAND_PASS.md`

# VeilWatch Face Reskin v5

This pass does not change logic. It changes command identity and operational language.

Highlights:
- dashboard labels renamed into command-console labels
- top strip now reads like a live command rail
- left navigation uses command terminology
- primary DM work zones renamed to support running the campaign from the screen
- same tabs, same behavior, same backend

Main file to replace:
- api/public/styles.css
- api/public/index.html


---

## Source: `README_DM_HOME_LOCK.md`

# VeilWatch Face Reskin v6

This is the DM-home lock pass.

Acceptance targets:
- Tactical Party Control is now a primary work zone
- Entity Projection Bay is now a primary work zone
- dead center void reduced by making the two command zones dominate the screen
- support modules compressed into secondary positions
- same tabs, same JS hooks, same backend

Changed files:
- api/public/index.html
- api/public/styles.css

Also included:
- login form accessibility warning cleanup by moving username into authForm


---

## Source: `README_LAYOUT_FIX.md`

This is a targeted fix for the broken v4 live layout.

What was wrong:
- The home grid used a 12-column template with 4-column named grid areas.
- That mismatch broke the layout on the live page and caused the giant empty area.

What this fixes:
- correct 4-column desktop grid
- keeps the forge big
- makes Tactical Party much bigger
- keeps support modules on the right
- preserves the v4 hologram styling


---

## Source: `README_RESKIN.md`

# VeilWatch Face Reskin v4

This is a face-only reskin against the existing repo structure.

What changed:
- rebuilt the HUD feel around projected-light hologram cues instead of glassmorphism
- larger, brighter forge chamber with stronger projection bed and emissive silhouette
- much larger Active Characters / Tactical Party work area
- less cramped layout hierarchy for DM use
- stronger telemetry look in overview, notifications, and quick actions
- thinner but still readable command strip
- no backend, JS, routing, or tab logic changes

Primary file to replace in your repo:
- api/public/styles.css

Preview helper:
- api/public/preview.html


---

## Source: `api/public/assets/characters/README.md`

# Veilwatch Character Assets

The Character Forge reads `character_assets.json` as its appearance catalog.

Folders:
- `bases/` — body/head GLB data (stored as GitHub-browser-safe chunks in `chunks/`)
- `hair/` — hair GLB data and future modular hairstyles
- `clothing/` — reserved for Change #5 wardrobe assets
- `animations/` — reserved for the animation-library pass
- `equipment/` — reserved for weapons/gear/cybernetics
- `textures/` — generated/fetched during Docker build where appropriate

The current standard character is the CC0 Vitruvian human. See
`/THIRD_PARTY_LICENSES/VITRUVIAN_NOTICE.txt`.
