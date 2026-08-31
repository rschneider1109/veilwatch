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
