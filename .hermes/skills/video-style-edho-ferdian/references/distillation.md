# Distillation — reference footage → style pack

## 1. Pack layout

```text
stylepacks/<genre>/
  grade.json     colour statistics per luminance zone (below)
  cadence.json   every detected shot boundary + the derived length distribution
  look.cube      33³ LUT — a normalising grade for new material
  spec.json      text description for a generative model, grounded in the numbers
  grounding.txt  the measured facts that were given to the VLM
  stills/        full-resolution frames from the longest shots (conditioning images)
  plates/        overlay elements lifted onto black for screen blending
  props/         optional generated 3D meshes
  pack.json      manifest: sources, tool versions, timestamps, parameters
```

The numeric part (grade, cadence, LUT, stills, plates) must be offline and
deterministic — no network, no keys — so a pack can be regenerated rather
than backed up. Only the text spec needs a model call.

## 2. Measure colour per luminance zone

Colour identity usually lives in one tonal band. A single global a\*/b\*
offset cannot represent split-toning, so measure chroma inside L\* zones,
e.g. edges `[0, 15, 35, 55, 75, 100]`.

A real signature looks like: violet in the low mids (a\* ≈ +25, b\* ≈ −17 at
L\* ≈ 25) and near-neutral at both ends. Reporting only the darkest and
brightest zones would call that "uniform" — **always print the full zone
curve.**

## 3. Robust statistics

- **Median + MAD, never mean + std** for chroma. Chroma in real reels is
  strongly right-skewed; a mean can sit at twice the median, and a LUT built
  from it pushes colour several times harder than the footage warrants.
- **Contrast = std(L\*)**, not white minus black — the range is ~100 on
  nearly any footage and tells you nothing.
- **Background share** = fraction of pixels below L\* 10. No moment of the
  distribution sees it: a grade can hit mean, std and chroma while lifting
  the blacks into grey mud. Record it as a first-class target.

## 4. Mask the interface before measuring

Screen-recorded references carry static furniture — letterbox bars, status
bars, like buttons, captions — which pollute the statistics (bars inflate
shadows, a red heart drags a\* toward magenta). Temporal variance separates
moving footage from static overlays without hand-tuned crops. (Animated UI
such as a pulsing heart defeats variance; see `application.md` §5 for the
median-frame edge method that catches it.)

## 5. Cadence with an adaptive threshold

The right shot-detector threshold depends on the material: hard-cut action
footage separates at a high threshold, moody footage hides its cuts below
it.

1. Sweep descending thresholds in **one decode pass** (share the frame
   statistics across thresholds; re-decoding per threshold turns seconds into
   minutes on 60 fps sources).
2. Take the **highest** threshold that still recovers ≥ 90 % of the shots the
   most sensitive setting finds — biased toward real cuts over noise.
3. Reject any threshold implying an absurd rate (> 100 cuts/min); continuous
   camera moves trip detectors every frame.

Store the whole distribution, not only the mean: an edit that matches the
mean but not the variance reads completely differently.

## 6. Overlay plates are assets, not screenshots

A still is a whole frame; a **plate** is the reference's graphic vocabulary
(flares, streaks, glitch fragments) lifted onto black so it screen-blends
without keying.

- **Select by percentile, not absolute thresholds.** On a bright reference an
  absolute "bright and saturated" rule selects most of the frame — including
  faces. Take roughly the top 3 % of energy and **reject any plate covering
  more than ~22 % of the frame.**
- **Rank by separation, not brightness.** Score `p99.5(energy) /
  median(energy)`; a black frame with one intense flare is the signature, a
  washed-out bright frame is not.
- **Mask first** — burnt-in titles are bright, saturated and high-contrast,
  and would otherwise become a perfect plate of someone else's title card.

## 7. Grounding the text spec

Give the measurements to the VLM in its system prompt before asking for a
description. Ungrounded, VLMs routinely call a strongly cast reel "neutral".

Ban hedging words (`varied`, `mixed`, `dynamic`, `some`, `often`, `neutral`,
`or`) — a model cannot render "varied lighting". Enforce the ban **in code**:
re-ask the offending field, keep the least-hedged answer after N attempts
instead of failing the run. Tell the user the caveat: once grounded in the
measurements, the spec is no longer an independent check on them.

## 8. LUT baking pitfalls

- A LUT encodes only a **per-pixel RGB function**. Reduce anything
  distribution-dependent (histogram matching, percentile anchors) to
  constants before baking, or you end up measuring the uniform LUT grid
  instead of footage.
- Some Lab→RGB conversions clamp internally, so an out-of-gamut check built
  on them always reports 0 %. Convert Lab → linear sRGB yourself to measure
  gamut excursion honestly.
- Use an **offset** chroma transfer, not affine: affine divides by the source
  spread and overshoots, even flipping the sign of a channel.
- Gamut compression can multiply runtime for no accuracy gain — make it
  opt-in.

## 9. Anti-patterns

| Don't | Why |
|---|---|
| Tune on synthetic test footage | Real footage overturns conclusions drawn from it |
| Trust a single error metric | Low MAE has coexisted with visibly broken frames |
| Mean/std for chroma | Skew makes the grade far too strong |
| Compare only extreme zones | Both ends are near-neutral by construction |
| Describe the look in words and stop | The spec carries content; the pack carries colour |
