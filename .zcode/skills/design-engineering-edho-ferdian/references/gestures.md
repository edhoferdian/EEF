# Gestures — drag, swipe, sheets

Use when the user's finger or pointer drives the motion: drawers and
bottom sheets, swipe-to-dismiss toasts and cards, drag-to-reorder,
pull-to-refresh, hold-to-confirm, carousels.

## Use a library first

Hand-rolled drawers are weeks of edge cases (momentum, focus trap, scroll
locking, nested scroll, keyboard, reduced motion). Default picks:

- Bottom sheet / drawer → Vaul (React), or the component library's drawer.
- Drag-to-reorder → dnd-kit.
- General drag/pan → Motion's drag props, or `@use-gesture/react`.

Hand-roll only when no library fits; then follow every rule below.

## Rules for anything the finger drives

1. **Track 1:1.** While dragging, the element is exactly under the finger.
   No easing, no transition during the drag — write the position directly
   (transform on a ref or a motion value), never through React state.
2. **Capture the pointer.** `setPointerCapture` on pointerdown so the drag
   continues when the pointer leaves the element.
3. **Carry velocity into the release.** On release, decide using both
   distance and velocity: a fast short flick dismisses, a slow long drag
   that stops before the threshold snaps back. Hand the release velocity to
   a spring so motion continues smoothly instead of restarting.
4. **Interruptible.** The user can grab the element mid-animation; it stops
   where it is and follows the finger again.
5. **Resistance at the edges.** Past a limit, move less than the finger
   (rubber-banding, e.g. `offset * 0.3` or a log curve) instead of a hard
   stop.
6. **Snap points.** Choose the target snap from projected position
   (current + velocity × a small time constant), not current position only.
7. **Linked visuals follow progress.** The overlay opacity, background
   scale or icon progress is a function of drag progress, not a separate
   animation.
8. **Threshold for intent.** Don't start a drag until the pointer moves a
   few pixels, so taps and clicks still work; decide the axis early and
   lock to it.
9. **`touch-action`.** Set `touch-action: none` (or `pan-y` / `pan-x` for
   one-axis gestures) on the draggable so the browser doesn't scroll
   instead.
10. **Keyboard and screen reader path.** Every gesture has a non-gesture
    equivalent: a close button, arrow keys for reorder, Escape for sheets.

## Sheets and drawers

- Enter with the drawer curve (`--ease-drawer`), ~400 ms.
- Dismiss by drag down past ~25–30 % of height or a fast downward flick.
- When the sheet's content scrolls, dragging only starts when the content
  is at its top.
- Lock background scroll; trap focus; return focus on close.
- Respect safe areas at the bottom (`env(safe-area-inset-bottom)`).

## Swipe-to-dismiss (toasts, cards)

Follow the finger on the dismiss axis, fade as it travels, dismiss on
distance or velocity, otherwise spring back. Resist the opposite direction.

## Hold-to-confirm

Progress fills linearly while held (it represents time); releasing early
reverses quickly with ease-out; completion gives a clear confirmation
(and haptics on mobile where available).

## Pull-to-refresh

Resist the pull, show progress tied to distance, trigger past a threshold,
hold a loading state, then return with a spring. Don't fight the browser's
own pull-to-refresh: `overscroll-behavior-y: contain` where you replace it.

## Symptoms → cause

| Symptom | Likely cause |
|---|---|
| Lags behind the finger | Position goes through state/re-render, or a CSS transition is active during drag |
| Jumps on release | Release animation starts from a stale value or ignores velocity |
| Can't catch it mid-animation | Keyframes or a non-interruptible tween; use a spring on a motion value |
| Page scrolls instead of dragging | Missing `touch-action` |
| Clicks stop working | No movement threshold before starting the drag |

## Code — pointer-events drag with velocity (vanilla, framework-agnostic)

```ts
type Opts = { el: HTMLElement; axis: "x" | "y"; onRelease: (pos: number, velocity: number) => void };

export function draggable({ el, axis, onRelease }: Opts) {
  let start = 0, offset = 0, pos = 0, dragging = false, decided = false;
  const samples: { t: number; p: number }[] = [];

  el.style.touchAction = axis === "y" ? "pan-x" : "pan-y"; // let the other axis scroll

  el.addEventListener("pointerdown", (e) => {
    dragging = true; decided = false;
    start = axis === "x" ? e.clientX : e.clientY;
    offset = pos;
    samples.length = 0;
    el.style.transition = "none";                    // never ease while the finger drives
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const p = axis === "x" ? e.clientX : e.clientY;
    if (!decided && Math.abs(p - start) < 6) return;  // intent threshold keeps clicks working
    decided = true;
    pos = offset + (p - start);
    samples.push({ t: e.timeStamp, p: pos });
    if (samples.length > 5) samples.shift();
    el.style.transform = axis === "x" ? `translate3d(${pos}px,0,0)` : `translate3d(0,${pos}px,0)`;
  });

  const end = () => {
    if (!dragging) return;
    dragging = false;
    const a = samples[0], b = samples[samples.length - 1];
    const velocity = a && b && b.t > a.t ? (b.p - a.p) / (b.t - a.t) : 0; // px per ms over the last few events
    onRelease(pos, velocity);
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}
```

Velocity comes from the last ~50–100 ms of movement, not the whole drag.
On release, animate with a spring seeded by that velocity (Motion's
`animate(el, { y: target }, { type: "spring", velocity })`), or a CSS
transition with the drawer curve when velocity can be ignored.

## Code — Motion drag with snap and dismiss

```tsx
function Sheet({ onClose }: { onClose: () => void }) {
  const y = useMotionValue(0);
  const overlayOpacity = useTransform(y, [0, 400], [0.4, 0]);  // linked visual follows progress

  return (
    <>
      <motion.div className="overlay" style={{ opacity: overlayOpacity }} onClick={onClose} />
      <motion.div
        className="sheet"
        drag="y"
        style={{ y }}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.9 }}        // resist upward, follow downward
        dragMomentum={false}
        onDragEnd={(_, info) => {
          const shouldClose = info.offset.y > 140 || info.velocity.y > 600; // distance OR flick
          if (shouldClose) onClose();
          else animate(y, 0, { type: "spring", visualDuration: 0.3, bounce: 0, velocity: info.velocity.y });
        }}
      />
    </>
  );
}
```

## Snap point selection

```ts
function pickSnap(position: number, velocity: number, snaps: number[], lookaheadMs = 180) {
  const projected = position + velocity * lookaheadMs;   // where it would coast to
  return snaps.reduce((best, s) => (Math.abs(s - projected) < Math.abs(best - projected) ? s : best));
}
```

## Rubber-band past the edge

```ts
// Asymptotic resistance: easy at first, never more than `limit` px.
const rubberband = (overshoot: number, limit: number, c = 0.55) =>
  (1 - 1 / ((Math.abs(overshoot) * c) / limit + 1)) * limit * Math.sign(overshoot);
```

## Drag to reorder

- dnd-kit (`@dnd-kit/sortable`) for lists and grids: keyboard sensor,
  screen-reader announcements, auto-scroll, collision strategies built in.
- Lift on pick-up: scale ~1.02 and a deeper shadow; siblings move with a
  short layout transition (150–200 ms) as the item passes.
- Drop with a quick settle into the slot; no bounce.
- Provide "Move up / Move down" actions for keyboard and screen readers.

## Carousels

- Native scroll + CSS scroll snap first (`scroll-snap-type: x mandatory`,
  `scroll-snap-align: start`); it gets momentum and accessibility free.
- JS carousels (Embla) when you need loops, autoplay or synced thumbnails;
  keep `touch-action: pan-y` so vertical page scroll still works.
- Never hijack vertical scroll to move a horizontal carousel.
