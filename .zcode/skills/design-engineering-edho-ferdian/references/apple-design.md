# Apple-Style Design and Fluid Motion, for the Web

Use when the target feel is "like iOS / macOS": fluid gestures, physical
motion, layered translucent materials, careful typography. Each principle
comes with how to build it in a browser. Pairs with `gestures.md`
(mechanics) and `interface-polish.md` (details).

## 1. The foundations

**Responsiveness.** The interface reacts on the first frame of input, not
when the gesture completes. A button darkens on touch-down; a sheet starts
following on the first pixel of drag.

**Direct manipulation.** What the finger moves, moves exactly with the
finger. No easing, no lag, no "catching up". The content is the control.

**Continuity.** Nothing teleports. An element that changes state travels
from where it was to where it goes, so the user never has to re-find it.
Opening an app grows it out of its icon; closing shrinks it back into the
same icon.

**Spatial consistency.** Everything has a place in an imagined space. If a
view arrives from the right, going back sends it to the right. If a sheet
comes from below, dismissing pushes it down. A consistent map lets users
predict without thinking.

**Interruptibility and redirection.** Every animation can be grabbed,
reversed or redirected mid-flight, and it continues from its current
position and velocity — never restarts.

**Feedback.** Every action is acknowledged: visually (state change),
spatially (motion), and on devices that support it, tactilely.

**Deference and restraint.** The UI steps back so content leads: quiet
chrome, few colors, motion only where it carries meaning. Polish is the
absence of anything that distracts.

## 2. Motion that feels physical

### Springs described by feel, not physics

Describe a spring with two numbers that designers can reason about:

- **Response** — roughly how long it takes to get most of the way there
  (e.g. 0.3–0.5 s for UI).
- **Damping ratio** — 1.0 = no overshoot (critically damped, the default
  for UI); 0.8–0.9 = a hint of life; below ~0.7 = visibly bouncy (rare,
  playful moments).

Motion's `transition={{ type: "spring", visualDuration: 0.35, bounce: 0 }}`
maps to the same idea (`bounce: 0` ≈ damping ratio 1). Use the same two or
three springs across the product.

### Momentum and projection

When a fling ends, decide where the object goes by **projecting** its
resting point from the release velocity, the way scroll deceleration does:

```js
// Scroll-like deceleration: rate per millisecond close to 1 = long glide.
const DECELERATION = 0.998;
function project(velocityPxPerMs, rate = DECELERATION) {
  return (velocityPxPerMs / 1000) * rate / (1 - rate);
}
const target = nearestSnap(currentPosition + project(releaseVelocity));
```

Then animate to that target with a spring that starts at the release
velocity. Small, fast flicks still reach far snap points; slow drags settle
where they are.

### Rubber-banding

Past an edge, the content keeps moving but with growing resistance, and
returns with a spring when released:

```js
// d = dimension of the container, c ≈ 0.55 (iOS-like resistance)
function rubberband(overshoot, d, c = 0.55) {
  return (1 - 1 / ((overshoot * c) / d + 1)) * d;
}
```

The curve is ~linear for small overshoots and asymptotically limited, so
the user can never drag the content far away.

### Hand-off from gesture to animation

1. During the drag: position = finger position (plus rubber-band at the
   edges).
2. On release: read velocity, project the target, pick the snap point.
3. Animate with a spring seeded with that velocity.
4. If touched again: stop the spring where it is and go back to step 1.

### Motion vocabulary in Apple interfaces

- Elements **scale down slightly when pressed** (≈0.95–0.97) and spring
  back.
- Context menus **lift** the item (scale up, shadow deepens, background
  blurs).
- Modals and sheets **push the presenting view back** a little (slight
  scale-down, rounded corners appear) to show depth.
- Swipes **reveal** actions that stay attached to the content.
- Toggles and selections use quick springs with no overshoot.

## 3. Materials and depth

Layers communicate hierarchy: content at the back, controls floating above
it on translucent materials that let colour through but keep text legible.

**Material scale** (from most see-through to most opaque): ultra-thin,
thin, regular, thick. Thicker material for denser text; thinner for chrome
over imagery.

```css
.material-regular {
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 0.5px solid color-mix(in srgb, var(--text) 10%, transparent);
}
@media (prefers-reduced-transparency: reduce) {
  .material-regular { background: var(--surface); backdrop-filter: none; }
}
```

- `saturate()` keeps colours behind the glass vivid instead of grey.
- A hairline border (0.5 px on high-DPI) separates glass from glass.
- **Vibrancy**: text and icons on materials use slightly translucent
  colours that pick up the background, but primary text stays high
  contrast.
- Respect "reduce transparency" with a solid fallback.
- Blur is expensive; keep it on fixed-size chrome, not on large scrolling
  surfaces or many stacked layers (`animation-performance.md`).

**Elevation.** Shadows are soft and large-radius with low opacity, often
two layers (a tight contact shadow plus a wide ambient one). In dark mode,
depth comes from lighter surfaces rather than shadows.

```css
--shadow-raised: 0 1px 2px rgb(0 0 0 / 0.06), 0 4px 16px rgb(0 0 0 / 0.08);
--shadow-overlay: 0 2px 6px rgb(0 0 0 / 0.08), 0 16px 48px rgb(0 0 0 / 0.18);
```

**Continuous corners.** Apple's rounded rectangles use a smoothed corner
curve (a "squircle") rather than a circular arc. On the web, a plain
`border-radius` is the default; for hero surfaces, an SVG mask or the
`corner-shape: squircle` property where supported gets closer. Nested
corners stay concentric: outer radius = inner radius + padding.

## 4. Typography

- **Optical sizes.** System fonts switch design by size: a "Text" cut
  below ~20 pt (looser spacing, sturdier shapes) and a "Display" cut above
  (tighter, finer). On the web, `font-optical-sizing: auto` with a variable
  font that has an `opsz` axis does this automatically. With
  `-apple-system`/`system-ui` it happens for free on Apple devices.
- **Tracking varies with size.** Small text gets slightly positive
  tracking, large text increasingly negative. A practical web scale:

  | Size | Tracking |
  |---|---|
  | 11–13 px | +0.01em |
  | 14–17 px | 0 to -0.01em |
  | 20–28 px | -0.015em |
  | 32–48 px | -0.02em |
  | 56 px+ | -0.025em to -0.03em |

- **Leading tightens as size grows**: body ~1.4–1.5, titles ~1.1–1.2.
- **Hierarchy by weight and size, not colour alone.** Two or three weights
  (regular, semibold, bold) are enough.
- **Dynamic Type.** Respect the user's text size: use `rem`, never lock
  font sizes in px for body text, and test at 200 % zoom.
- Numbers in tables and counters use tabular figures.

## 5. Layout and touch

- Minimum hit target 44 × 44 pt, even when the visible control is smaller.
- Comfortable margins (16–20 pt on phones) and consistent spacing steps.
- Primary actions within thumb reach on mobile (bottom of the screen).
- Respect safe areas.
- Clear hierarchy: one primary action per view.

## 6. Accessibility as part of the design

- **Reduce Motion**: replace slides, zooms and parallax with crossfades;
  keep meaning.
- **Reduce Transparency**: solid materials.
- **Increase Contrast**: stronger borders and text (`prefers-contrast: more`).
- **Larger text**: layouts reflow; nothing truncates essential content.
- Every gesture has a visible alternative (button, menu item).

## 7. Checklist — does it feel "Apple"?

- [ ] Responds on touch-down, not on release.
- [ ] Dragged things stay under the finger and can be caught mid-motion.
- [ ] Releases carry momentum; snapping uses projection.
- [ ] Edges rubber-band instead of hard-stopping.
- [ ] Springs, not fixed tweens, for anything interruptible; no bounce on
      everyday UI.
- [ ] Spatial story is consistent: things return the way they came.
- [ ] Chrome is translucent over content with a solid fallback.
- [ ] Typography uses optical sizing and size-dependent tracking.
- [ ] Reduced motion / transparency / contrast all respected.
