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
