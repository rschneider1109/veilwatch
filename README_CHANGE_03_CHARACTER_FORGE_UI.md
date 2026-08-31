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
