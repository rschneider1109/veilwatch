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
