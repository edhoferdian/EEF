---
trigger: model_decision
description: "Capture the look and pacing of reference videos as measurements, then reproduce them: distill references into a style pack (colour grade per luminance zone baked to a 3D LUT, cut rhythm as a shot-length distribution, overlay plates, hero stills, a grounded text spec), then generate or gather footage, grade it to the pack, cut it at the measured cadence, composite overlays, and verify the result numerically before handing an editable timeline to Resolve or another NLE. Use when the user says \"tiru look video ini\", \"samakan grading\", \"bikin video dengan gaya referensi\", \"capture the vibe\", \"LUT dari referensi\", \"cut rhythm\", \"supplement footage\", or wants AI-generated clips cut into a real edit."
---

# Video Style — Edho Ferdian Mode

Two phases with one interface between them — the **style pack**:

1. **Distill** — measure reference footage into a pack.
   `references/distillation.md`.
2. **Apply** — generate or collect footage, grade and cut it against the
   pack, verify, hand off. `references/application.md`.

## The principle everything else follows

**Prompting cannot deliver a grade; measurement can.** In practice,
escalating colour instructions to a video model barely move the result
toward a measured target, while a deterministic grade computed from the
references lands on it in one pass at no generation cost. So:

- the generative model supplies **content, motion, framing and lighting
  structure**;
- the pack supplies **colour and rhythm**.

Generation prompts therefore contain no colour language at all — say
"Colour: none. Render neutral. Grading is applied afterwards." — and keep
*what happens* (the brief) separate from *how it looks* (the style steer),
or style words turn into objects ("teal" becomes a teal prop).

## Non-negotiables

- **Paid provider calls are opt-in per run.** Every stage must have a dry run
  that exercises plans, prompts, track layout and manifests without
  credentials or spending. A live run needs the user's explicit go-ahead and
  its own opt-in switch, not just an API key in the environment.
- **An ambiguous provider timeout is not retried as a new paid job.** Check
  the provider's request log first.
- **Verify numerically before claiming the look matches** — distribution
  shape, not only averages (`application.md` §6). A good-looking MAE has
  shipped visibly broken frames.
- **One genre, one pack.** Never silently reuse one look's measurements for
  another. A measured zero is data; distinguish it from a missing field.
- **Rights.** Reference footage and anything lifted from it (stills, plates)
  may be someone else's work; confirm the user may use it before minting
  assets, and never ship another app's UI or someone's burnt-in titles.
- **A render is not a saved project or creative approval.** Keep source
  assets and versioned project checkpoints; report what was actually saved.

## Tooling

No code ships with this skill; the references specify the method precisely
enough to implement per project. Typical stack: `ffmpeg` (decode, cut,
composite, re-encode), OpenCV + NumPy (Lab statistics, masks, plates),
PySceneDetect (shot boundaries), a LUT writer (`.cube`), optionally Blender
(3D props) and a VLM for the text spec. Resolve current library and provider
APIs live before writing against them — model IDs, endpoints and prices
drift monthly.

## References

- `references/distillation.md` — pack layout, the measurements that matter
  (zone chroma, median/MAD, contrast, background share), interface masking,
  adaptive cadence detection, overlay plates, grounding a VLM, LUT baking
  pitfalls.
- `references/application.md` — generating takes not shots, cutting rules,
  grading rules, overlays as elements, removing borrowed UI, the 3D branch,
  numeric verification, and NLE/Blender handoff.

## External docs (fixed — see skill-authoring-edho-ferdian's canonical contract)

Before calling a video/image/3D generation provider, PySceneDetect, or the
Resolve scripting API, resolve its current interface live (Context7 or the
provider's model page) — never from memory. Full contract:
`skill-authoring-edho-ferdian` §9.

## Surgical changes (fixed — see skill-authoring-edho-ferdian's canonical contract)

When adjusting an existing pipeline, change only the stage the task names;
do not re-measure a cached pack or re-render untouched shots as a side
effect. Full contract: `skill-authoring-edho-ferdian` §10.

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract)

Communication to the user in Bahasa Indonesia; code, comments, prompts to
generation models, and generated files in English — fixed, never ask. Full
contract: `skill-authoring-edho-ferdian` §7.
