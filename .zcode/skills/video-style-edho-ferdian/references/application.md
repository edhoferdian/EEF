# Application — style pack → finished, verified edit

Pipeline: distill (cached) → optional 3D props → generate or gather takes →
grade → cut → composite overlays → verify → export timeline + handoff notes.
Cache every stage so iterating on a brief never re-measures the references.

## 1. Generate takes, not shots

"Match the cadence" read literally means one generation per shot — which is
wasteful and incoherent. A reference averaging ~0.8 s per shot against a
provider's ~4 s minimum clip turns a 10 s piece into a dozen calls, ~20 %
usage of the generated seconds, and a dozen unrelated clips.

Editors roll a longer take and cut inside it. Group consecutive shots into
~5 s takes: a quarter of the calls, most of the generated footage used, and
neighbouring shots that belong together because they came from one take.
Tell the model the shape you need:

> "Filmed as ONE continuous take with no hard cuts inside it. It will be cut
> into 6 pieces of roughly 0.8 s, so framing, subject and light must keep
> changing throughout — any 0.8 s window has to stand alone as a shot."

Prompt rules: no colour words (the pack grades), separate brief from style
steer, and prefer local checkable rules ("backgrounds pure black and unlit;
subjects blowing toward white") over global adjectives ("extreme contrast").

Existing completed takes can go straight into grading and cutting with no
provider calls at all.

## 2. Cutting rules

- **Re-encode; never stream-copy.** Stream copy can only cut on keyframes,
  which rounds sub-second boundaries to the GOP and destroys the rhythm.
- **Supplementing existing footage: cut on its own shot boundaries.** Slicing
  a base video into contiguous pieces and playing them in order simply
  reassembles the original — every "cut" lands mid-shot and disappears.
  Detect its real boundaries and take every Nth shot so consecutive picks are
  guaranteed discontinuous.
- **Sample shot lengths from the reference distribution**, not its mean, so
  the edit inherits rhythm variance.
- A requested duration is a best-effort cadence target. Do not duplicate or
  pad clips to hit it; record requested vs actual length in the manifest and
  flag differences of a frame or more.

## 3. Grading rules

- With the clip in hand, **direct measurement beats the baked LUT**: measure
  it, match tone, apply zone chroma.
- **Anchor tone; don't CDF-match** when the clip's histogram is unlike the
  reference's. Forcing a mostly-black generated clip onto a busy reference
  histogram lifts the background out of black while MAE and contrast still
  look excellent. Default to anchored tone.
- Grade in small batches (single-digit frame counts); large batches have
  been OOM-killed.
- `look.cube` is a normalising LUT for *new* material. Shots already graded
  by this pipeline must not have it applied again.

## 4. Overlays are elements, not washes

- **Tighten each plate to its alpha bounding box first**, which takes it from
  a few percent of frame to a controllable element.
- **Choose by coverage:** diffuse plates (< ~10 % after tightening) work
  full-frame at low opacity; concentrated ones are scaled to ~35–70 % of
  frame width and placed.
- **Vary position, scale and rotation per shot from a seeded RNG** —
  reproducible, but never the same mark twice. One plate in one spot every
  Nth shot reads as a watermark.
- Compute element geometry in code, not in ffmpeg filter expressions; `pad`
  rejects negative offsets and cannot shrink, so an off-frame element kills
  the whole filtergraph.
- Composite locally with ffmpeg. Hosted "compose" endpoints may accept only
  one video track, and at least one took keyframe times in milliseconds
  without saying so — seconds produced a video 1000× too short.

## 5. Borrowed footage carries someone else's UI

The worst defect in a delivered cut: another app's like button, view counter
and comment bubble, because base footage was a screen recording.

Temporal variance does **not** catch it — UI chrome animates (a pulsing
heart, a ticking counter), so it looks like content. Use the temporal
**median** instead: moving footage averages into mush with little edge
energy, while chrome stays at fixed coordinates with sharp edges. Sobel
energy on the median frame is high on chrome and low on content.

- Trim past the innermost high-energy line in each outer band, not inward
  from the edge — outer lines are often flat letterbox with zero energy,
  with the chrome sitting just inside them.
- Portrait source in a landscape cut: **scale to cover, don't pad.** Padding
  leaves most of the frame as bars and poisons the background-share metric.

## 6. Verify, then believe

Compute against the **pack's** targets (not the source clip's):

| Check | What |
|---|---|
| background | share of frame below L\* 10 vs the pack figure |
| chroma error | per-zone a\*/b\* error using the **median**, matching how targets were measured |
| contrast, black point, white point | vs pack |
| banding | empty L\* histogram bins **between occupied bins** (total empty bins misfires on dark clips) |
| cadence | detected mean *and spread* of shot length vs reference |

Units trap: OpenCV's Lab encoding changes with dtype — float32 gives L\*
0–100 and signed a\*/b\*; uint8 gives L\* 0–255 and a\*/b\* offset by 128.
Mixing them reports chroma errors in the hundreds.

## 7. The 3D branch (optional)

- Generate a clean single-object plate from text first; reference stills
  (collages, several subjects, burnt-in graphics) make poor mesh inputs.
- Multi-view image-to-3D APIs often take **named per-angle fields** (front,
  back, left, …) rather than a list; inventing a list field can silently
  degrade to single-view. A wrong angle label is worse than omitting a view.
- Read the mesh from the response **by key** (e.g. the GLB field), never by
  position — preview PNGs sit alongside it.
- Request PBR maps; retopologise before anyone edits or rigs the mesh; keep
  the original textured mesh as the source and the retopology as a named
  derivative.
- Hosted generation APIs may not render 3D back to video; render locally
  (Blender if available, a lightweight software rasteriser otherwise) and the
  turntable becomes ordinary footage for the rest of the pipeline.
- In Blender: black world with transparent film, key plus rim light with the
  rim colour taken from the pack's strongest chroma zone, view transform
  **Standard** (not AgX/Filmic), and no grading inside Blender.

## 8. Handoff to an editor

- **Always ship an editable timeline beside the MP4** — FCPXML and/or a
  CMX3600 EDL referencing the individual graded shot files. Keep those shot
  files; the timeline points at them.
- Validate the export: clip offsets equal the running sum of prior durations,
  every reference resolves, every media path exists, total length matches the
  MP4. A timeline that imports but drifts is worse than one that fails.
- Set the project frame rate **before** importing; some NLEs lock it at first
  timeline creation and silently conform the cadence.
- Include a handoff note with the measured targets: zone chroma table,
  cadence distribution including its variance, and an explicit "do not" list
  (e.g. do not apply `look.cube` to the delivered, already-graded shots).
- Scripting an NLE (e.g. Resolve overlays): verify the host's API constants
  and source-range conventions on that version, check placements after
  appending, then save the project and inspect the actual render before
  reporting delivery.

## 9. Anti-patterns

| Don't | Why |
|---|---|
| One generation per shot | Few percent efficiency, incoherent shots |
| Colour words in the prompt | Measured not to work; fights the neutral base the grade expects |
| Stream-copy cuts | Keyframe-only boundaries |
| Cut a base video contiguously | Reassembles the original |
| Ship on one error metric | Add background share and distribution checks |
| Deliver only a flattened MP4 | Nobody can re-cut or re-grade it |
