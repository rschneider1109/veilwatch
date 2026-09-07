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
