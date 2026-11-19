# Design Flow — which reference, in what order

Use when the user isn't sure what they need, or asks for the workflow.
Recommend **one** reference (or one short sequence), say why in a
sentence, and name what comes next. Don't recite the whole map.

## Main flow: idea → ship

1. **Unsure how it should look or feel?** Build options:
   `prototype-variants.md` (manual), then promote the winner.
2. **Build it.**
   - Needs a dependency (toast, drawer, command menu, drag and drop,
     charts)? `library-picks.md` first.
   - One animation → `motion-foundations.md` (+ `motion-recipes.md`).
   - Several elements moving together → `choreography.md`.
   - Finger-driven → `gestures.md`.
   - React Native / Expo → `expo-motion.md`.
   - Interaction finish and details → `interface-polish.md`.
3. **Try to break it.**
   - Worst-case data → `break-ui.md`.
   - Motion review → `motion-review.md` (manual).
   - On a phone as a web app → `mobile-web-native.md`.
   - Drops frames → `animation-performance.md`.
4. **Keep what you learned.** `learn-taste.md` (manual) at the end of the
   session turns design corrections into rules.

## Upkeep on an existing codebase

`motion-audit.md`, three modes:
- Motion is **bad** across the app → Improve (audit + plans, read-only).
- App feels **static** → Find opportunities (read-only proposals).
- App feels **slow / over-animated** → Remove (edits, subtract only).

## Knowledge, not a process

- Naming an effect → `motion-vocabulary.md`.
- Modern Swift → `swift-authoring.md`.

## Common requests

| User says | Read |
|---|---|
| "Animasikan ini" / "animate this" | `motion-foundations.md` |
| "Munculnya satu-satu" / "one after another" | `choreography.md` |
| "Gak ngikutin jari" / "doesn't follow my finger" | `gestures.md` |
| "Patah-patah" / "janky" | `animation-performance.md` |
| "Animasinya udah bener belum?" | `motion-review.md` |
| "Bikin app-nya terasa lebih enak" | `motion-audit.md` (Improve) |
| "Apa yang bisa dianimasikan?" | `motion-audit.md` (Find) |
| "Kebanyakan animasi" | `motion-audit.md` (Remove) |
| "Kasih beberapa versi" | `prototype-variants.md` |
| "Pakai library apa?" | `library-picks.md` |
| "Di HP rasanya aneh" | `mobile-web-native.md` |
| "Coba data terburuk" | `break-ui.md` |
| "Efek ini namanya apa?" | `motion-vocabulary.md` |
| "Jangan ulangi kesalahan itu" | `learn-taste.md` |
