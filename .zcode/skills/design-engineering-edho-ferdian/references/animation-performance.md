# Animation Performance — staying inside the frame budget

Use when an animation is janky, choppy or drops frames, when choosing what
to animate on performance grounds, or before reaching for `will-change`.
Smoothness is part of the design: the same motion at 30 fps feels broken.

Measurement belongs to `performance-audit-edho-ferdian` (profile, fix,
re-measure). This file supplies the motion-specific causes and fixes.
Never claim a frame-rate improvement you didn't measure.

## The budget

60 Hz = 16.7 ms per frame, 120 Hz = 8.3 ms, shared by script, style,
layout, paint and composite. An animation is cheap when each frame only
needs the compositor.

## Cost by property

| Cost | Properties |
|---|---|
| Composite only (cheap) | `transform`, `opacity` (and `filter` on promoted layers, in moderation) |
| Paint | `background-color`, `color`, `box-shadow`, `border-radius`, `clip-path` (varies), `filter: blur` |
| Layout (expensive) | `width`, `height`, `top`, `left`, `margin`, `padding`, `font-size`, anything that changes geometry |

Move with `translate`, resize with `scale` (counter-scale children if
needed, or use Motion's `layout`), fade with `opacity`.

## Main thread vs compositor

- CSS transitions/animations and the Web Animations API on `transform`
  and `opacity` can run on the compositor, so they stay smooth while
  JavaScript is busy.
- JS-driven animation (requestAnimationFrame, many Motion props) runs on
  the main thread and stutters when the page is busy (hydration, data
  parsing, big renders). If the page will be busy while it animates,
  prefer CSS/WAAPI. In Motion, animating `transform` as a string or via
  the hardware-accelerated path keeps it off the main thread — check the
  installed version's docs; older versions animated independent `x`/`y`
  on the main thread.

## React specifics

- Never put a per-frame value in React state. Write to
  `ref.current.style` or a CSS variable, or use motion values.
- Memoise heavy children of an animating parent so the animation doesn't
  re-render them.
- Long lists that animate or scroll: virtualise (render only what's
  visible).

## Expensive effects

- `filter: blur()` and `backdrop-filter` cost grows with radius and area.
  Keep animated blur small (single-digit to low-teens px) and on small
  elements. Large blurred backgrounds: render once, don't animate the blur.
- Big `box-shadow` changes repaint; animate the opacity of a pseudo-element
  that holds the shadow instead.
- Animating `clip-path` is fine for simple shapes; profile complex paths.

## `will-change`

A promise to the browser, with a memory cost per layer. Add it only when
you see a real problem (e.g. a 1 px shift or a flicker as an animation
starts), only on the elements that animate, and remove it when idle if the
element is long-lived. Never `will-change: transform` on everything.

## Layout thrash

Reading layout (`getBoundingClientRect`, `offsetHeight`) after writing
styles in the same frame forces synchronous layout. Batch reads, then
writes; or use FLIP (measure first/last, animate the transform between).

## Diagnose in this order

1. Which property animates? Layout properties → switch to transform.
2. Is it JS-driven while the main thread is busy? → compositor path.
3. Does React re-render each frame? → refs / motion values.
4. Is a large area repainting (blur, shadow, gradient)? → shrink or cache.
5. Too many layers or `will-change` everywhere? → remove.
6. Record a Performance trace; look for long tasks, layout and paint in
   the animation's frames. Then fix and record again.

## Cheatsheet

| Problem | Fix |
|---|---|
| Stutters | Animate `transform`/`opacity`, not `width`/`top` |
| Long list scrolls slowly | Virtualise |
| Blur is heavy | Keep animated blur small, or don't animate it |
| Random properties animate | No `transition: all`; list properties |
| Re-renders every frame | Write to a ref / CSS variable |
| 1 px shift when motion starts | `will-change: transform` on that element only |
