# Choreography — several things moving at once

Use when more than one element animates in response to the same event:
staggered lists, hero entrances, a view swap inside a container, multi-step
flows, an item leaving while its siblings close the gap, icon + background
+ label morphing together.

## The rule: one lead, few followers, the rest still

A group reads as one motion when the eye has a single thing to follow.
Before writing code, answer:

1. **What leads?** The element the user caused or must notice.
2. **What follows, and how far behind?** Followers support the lead.
3. **What stays still?** Most things. Stillness is what makes the moving
   part legible. Remove motion from anything that doesn't need it.

If you cannot name the lead, there is too much moving.

## Timing between elements

- **Overlap, don't queue.** Followers start before the lead finishes
  (typically 30–60 % into it). Strict one-after-another feels slow.
- **Total time stays bounded.** A group should complete in roughly the
  time of one normal animation plus a little — about 400–500 ms for
  frequent UI. Long chains make an interface feel slow to open.
- **Stagger small.** 20–50 ms between list items. Cap the number of
  staggered items (e.g. the first 6–10); the rest appear with the last.
- **Same curve family** for the whole group, so it reads as one gesture.

## Patterns

**Staggered list entrance.** Each item fades + translates 4–8 px. Stagger
30 ms, cap at ~8 items. Only on first appearance, never on every re-render
or filter change.

**Hero entrance.** Headline leads, supporting text follows by ~80 ms, CTA
last. Background and imagery either fade once or stay still.

**View swap inside a container.** Decide if old and new overlap:
- Crossfade in place (both visible briefly) for related content.
- Old exits, then new enters (`AnimatePresence mode="wait"`) when they are
  unrelated — but keep the exit very short, or the wait reads as lag.
- `mode="popLayout"` when the container must reflow immediately.
Animate the container's height so the swap doesn't jump.

**Item leaving, siblings closing the gap.** The leaving item fades and
shrinks first; siblings move up once it has mostly gone (layout animation).
Never let siblings jump instantly.

**Multi-step flow.** Direction matters: forward slides one way, back the
other. Carry shared elements (title, progress) across steps unchanged.

**Morph between rich states** (icon + background + lines). Animate shared
properties of one element where possible (`layoutId`), crossfade only what
truly differs, and use a short blur to hide the crossover.

**Items flying into a target** (add to cart, drop into folder). Move a
clone along a short arc, shrink it, then give the target a small
acknowledgement (scale pulse). Keep it under ~500 ms total.

## React / Motion notes

- `AnimatePresence` for exits; keys must be stable.
- `layout` / `layoutId` for position and size changes; wrap related layout
  animations in `LayoutGroup`.
- `useAnimate` for imperative sequences; `stagger()` for delays.
- Variants with `staggerChildren` / `delayChildren` keep timing in one
  place instead of per-child delays.

## Smells

- Every element has its own delay (`i * 0.1`) and the result feels
  mechanical.
- The container, its children and the background all animate on open —
  "too much going on".
- Opening takes over half a second because animations wait on each other.
- The same entrance replays every time state changes.
