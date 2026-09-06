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
