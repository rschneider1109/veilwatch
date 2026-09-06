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
