# Motion Foundations — the decisions behind every animation

Use this file whenever you add, change or judge a single animation on the
web. Make the decisions in this order; an earlier answer can cancel the
rest.

## 1. Should it move at all?

Motion earns its place only if it does one of these:

| Job | Example |
|---|---|
| Explains where something came from or went | A popover growing out of its trigger |
| Confirms an action happened | A button pressing in, a checkmark drawing |
| Keeps the user oriented during a change | A list item sliding out while siblings close the gap |
| Signals state the user must notice | A failed field shaking once |

No job → no animation. "It looks nice" is not a job.

**Frequency decides the budget.** Count how often a user sees it:

| Seen | Budget |
|---|---|
| Hundreds of times a day (command palette, keyboard shortcut, list navigation, typing) | None. Instant. |
| Many times a session (menus, tabs, toggles, hovers) | Tiny: 100–200 ms, small distances |
| A few times a session (dialogs, sheets, toasts) | Normal: 200–350 ms |
| Rarely (onboarding, first run, empty state, celebration) | Room for personality |

**Keyboard-triggered actions never animate their result.** A user who
pressed a key wants the outcome now.

## 2. Pick the tool

| Situation | Tool |
|---|---|
| Hover, press, simple state change between two values | CSS `transition` |
| A sequence that plays once on mount, loops, or has keyframes | CSS `@keyframes` (or Web Animations API from JS) |
| Enter/exit of conditionally rendered React elements, layout changes, shared elements | Motion (`motion/react`) — `AnimatePresence`, `layout`, `layoutId` |
| Gesture-driven, interruptible, velocity-aware | Springs (Motion, or a gesture lib) |
| A value updated every frame from input (scroll, pointer) | Write to a ref / CSS variable, never React state |

Prefer CSS transitions for interactive state: a transition retargets from
its current value when interrupted, a keyframe animation restarts.

Before adding a dependency, use what the project already has. Check the
installed version and its docs (Context7) before writing against its API.

## 3. Pick the properties

Animate `transform` (translate, scale, rotate) and `opacity`. Add `filter`
or `clip-path` only when needed and check the cost
(`animation-performance.md`). Never animate `width`, `height`, `top`,
`left`, `margin` or `padding` for motion — each frame re-runs layout.

Never write `transition: all`. List the exact properties.

Scale from a believable size: enter at `scale(0.95)`–`scale(0.97)` with
opacity, not from `scale(0)`. Growing out of a single point looks fake.

## 4. Pick the curve

Define curves as tokens once, then reuse them:

```css
:root {
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);      /* entering, responding */
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);   /* moving between two on-screen positions */
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);   /* sheets and drawers */
}
```

- **Entering or reacting to the user → ease-out.** Fast start = feels
  responsive.
- **Moving something already on screen → ease-in-out.**
- **ease-in on UI is almost always wrong.** It delays the first frames,
  exactly when the user is watching. The only fair use is something leaving
  the screen for good, and even then a short ease-out usually reads better.
- **linear** only for continuous motion with no start or end: spinners,
  marquees, progress driven by time.
- The built-in `ease`, `ease-out` keywords are weak; use the tokens.

If the project already has curve tokens, use them. A second, parallel set
of curves is a defect.

**Springs** when motion is interruptible or gesture-driven, because a spring
keeps the current velocity when retargeted. Default to a critically damped
or slightly underdamped spring (no visible wobble) for UI; save bounce for
playful, rare moments.

## 5. Pick the duration

| Element | Duration |
|---|---|
| Press / hover feedback | 100–160 ms |
| Small popovers, tooltips, dropdowns | 150–220 ms |
| Dialogs, toasts, panels | 200–300 ms |
| Sheets and drawers | 300–450 ms (drawer curve) |
| Page-level transitions | ≤ 400 ms |

Keep UI motion under ~300 ms unless distance is large. **Exits run faster
than entrances** (about 70–80 % of the enter time): the user has already
decided.

Tooltips: delay the first one (~400–600 ms), then show neighbours
instantly while the user is scanning a toolbar.

## 6. Origin and direction

- A popover scales from its trigger: set `transform-origin` to the side
  that touches the trigger (Radix and Base UI expose a CSS variable for it).
  Modals stay centred.
- Things enter from where they live: a sheet from its edge, a toast from
  its stack, a submenu from its parent row.
- Keep direction consistent: if "next" slides left, "back" slides right.

## 7. Interruption

Every animation must survive being interrupted mid-way: a menu closed
before it finished opening, a toggle flipped twice fast. Test it. Use
transitions or springs for anything the user can reverse; avoid keyframes
that restart from zero.

## 8. Exit

Decide the exit explicitly — it is not the enter played backwards by
default. Usually: shorter, less distance, opacity leads. Conditionally
rendered React elements need `AnimatePresence` (or equivalent) or they
vanish without an exit.

## 9. Reduced motion

Respect `prefers-reduced-motion: reduce`. Do not just delete motion:
replace movement (translate, scale, parallax) with an opacity fade or an
instant change, and keep feedback that carries meaning.

```css
@media (prefers-reduced-motion: reduce) {
  .panel { transition: opacity 150ms var(--ease-out); transform: none; }
}
```

In Motion, `useReducedMotion()` or `<MotionConfig reducedMotion="user">`.

## 10. Small details that sell it

- Press feedback: `transform: scale(0.97)` on `:active`, ~120 ms.
- A tiny `filter: blur(2px)` during a crossfade hides the moment two states
  overlap.
- Hover effects only on devices that hover:
  `@media (hover: hover) and (pointer: fine)`.
- Skip the enter animation on first page load where it would replay on
  every navigation (`initial={false}`).
- Numbers that change: `font-variant-numeric: tabular-nums` so the layout
  does not jitter.
