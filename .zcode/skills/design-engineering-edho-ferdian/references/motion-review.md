# Motion Review — judging animation code

**Manual mode:** run when the user asks for a motion/animation review by
name ("review animasinya", "review-animations", "does this animation feel
right?"). A whole-diff review belongs to `code-review-edho-ferdian`, which
may cite this file for motion findings.

Stance: default to flagging. Approval is earned by the code meeting every
check below, not by the absence of an obvious bug.

## Process

1. **Scope.** List every animated surface in the diff or files: CSS
   transitions/keyframes, Motion components, WAAPI, gesture handlers.
2. **Context.** Find the project's existing curve/duration tokens and
   motion library. Findings must point to these, not invent new values.
3. **Frequency.** Tag each surface by how often a user sees it
   (`motion-foundations.md` §1). High-frequency surfaces get the strictest
   bar.
4. **Check** each surface against the list below.
5. **Report** using the output format. Every finding cites `file:line`,
   what's wrong, why it matters to the user, and the exact fix (value,
   curve, property).

## Checks

**Purpose**
- Has a job (orient, confirm, explain, signal). Decoration on a frequent
  surface → remove.
- Keyboard-triggered result animates → remove.

**Curve**
- `ease-in` on entering or responsive UI → ease-out token.
- Built-in keyword easings where a token exists → token.
- `linear` on anything but continuous/time-based motion.
- Interruptible / gesture-driven motion on a tween instead of a spring.

**Duration**
- Frequent UI above ~200 ms; dialogs above ~300 ms; anything above ~400 ms
  without a large distance.
- Exit as long as or longer than enter.

**Properties**
- Layout properties animated (`width`, `height`, `top`, `left`,
  `margin`).
- `transition: all`.
- Scale from 0, or a scale so small it reads as "appearing from nowhere".

**Origin and direction**
- Popover not growing from its trigger (`transform-origin`).
- Modal growing from a corner.
- Direction inconsistent with navigation.

**Interruption**
- Keyframes on reversible interactions (restart from zero when toggled).
- No exit on conditionally rendered elements (missing `AnimatePresence`).

**Choreography** (`choreography.md`)
- Many elements with independent delays and no clear lead.
- Group takes longer than ~500 ms to settle on a frequent surface.

**Gestures** (`gestures.md`)
- Drag position through React state; transition active during drag; no
  velocity on release; no `touch-action`; no non-gesture alternative.

**Performance** (`animation-performance.md`)
- Per-frame state updates; large animated blur; `will-change` everywhere.

**Accessibility**
- No `prefers-reduced-motion` handling, or reduced motion that deletes
  meaningful feedback instead of replacing movement with a fade.
- Hover effects firing on touch devices.

## Severity

| Level | Meaning |
|---|---|
| **Must fix** | Makes the UI feel slow or broken: ease-in on entrances, animating a keyboard action, layout-property animation that janks, uninterruptible toggles, gestures that lag the finger, missing reduced motion on large movement |
| **Should fix** | Noticeably off: wrong origin, durations too long, exit = enter, tokens bypassed |
| **Consider** | Taste-level improvements with a clear reason |

## Output format

```
## Motion review — <scope>

Verdict: CHANGES REQUESTED | APPROVED

### Must fix
1. `src/Popover.tsx:42` — enters with `ease-in` (300ms). Slow start delays the
   moment the user is looking. Fix: `var(--ease-out)`, 180ms, scale 0.96 → 1.

### Should fix
...

### Consider
...

### Passed
- <surfaces that meet the bar, one line each>
```

APPROVED only when there are no Must-fix or Should-fix findings.

## Standards — target values to cite

Cite these exact values in findings (or the project's own tokens when
they exist). Never "make it faster" without a number.

### Duration by element

| Element | Enter | Exit | Notes |
|---|---|---|---|
| Button press / hover | 100–150 ms | instant–120 ms | press feedback appears on pointer-down |
| Tooltip | 100–150 ms after a 400–700 ms delay | ≤ 100 ms | neighbours instant |
| Dropdown / select / popover | 150–200 ms | 100–150 ms | from trigger origin |
| Context menu | ≤ 120 ms or none | ≤ 100 ms | very frequent |
| Toast | 200–300 ms | 150–200 ms | from its stack edge |
| Dialog | 200–250 ms | 150 ms | centred scale 0.95–0.97 → 1 |
| Drawer / sheet | 300–450 ms | 200–300 ms | drawer curve |
| Accordion | 200–250 ms | 150–200 ms | |
| Page transition | ≤ 300 ms | — | never blocks navigation |
| Skeleton → content | 150–200 ms crossfade | — | |
| Hero / marketing entrance | ≤ 700 ms total | — | once per load |

### Curves

| Use | Curve |
|---|---|
| Entering, responding to input | ease-out — e.g. `cubic-bezier(0.22, 1, 0.36, 1)` |
| Moving on screen, A → B | ease-in-out — e.g. `cubic-bezier(0.65, 0, 0.35, 1)` |
| Sheets, drawers | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Continuous / time-based (spinner, progress, marquee, hold-to-confirm fill) | linear |
| Interruptible, gesture-driven | spring, bounce 0 (damping ratio ≈ 1) |
| Never on UI entrances | ease-in |

### Distances and scales

| Property | Range |
|---|---|
| Enter translate for small elements | 4–8 px |
| Enter translate for panels | 8–16 px (or from the edge for sheets) |
| Enter scale | 0.95–0.98 → 1 |
| Press scale | 0.96–0.98 |
| Lift on drag | 1.02–1.05 |
| Blur during crossfade | 2–4 px |
| Stagger between siblings | 20–50 ms, max ~8 items |

### Frequency → maximum budget

| Seen | Max motion |
|---|---|
| Keyboard-triggered result, typing, list navigation | none |
| Hundreds of times/day | ≤ 120 ms, opacity only |
| Many times/session | ≤ 200 ms, small transform |
| Few times/session | ≤ 300 ms |
| Rare (onboarding, celebration) | room for personality, still interruptible |

### Accessibility

| Check | Pass condition |
|---|---|
| `prefers-reduced-motion` | Movement (translate/scale/parallax/autoplay) replaced by fade or none; meaning kept |
| Autoplaying or looping motion > 5 s | Can be paused (WCAG 2.2.2) |
| Flashing | Never more than 3 flashes per second |
| Hover-only affordances | Also available on focus and touch |
| Focus during transitions | Focus moves to new content and returns on close |

## Review heuristics — what to grep for

| Pattern | Usually means |
|---|---|
| `transition: all`, `transition-all` | Unlisted properties animating |
| `ease-in` (not `ease-in-out`) | Wrong curve on an entrance |
| `animate={{ width` / `height` / `top` / `left` | Layout animation that may jank |
| `duration: 0.5`+ or `500ms`+ on UI | Too slow |
| `scale: 0` / `scale(0)` | Appearing from a point |
| `setState` inside `onDrag`, `requestAnimationFrame`, scroll handlers | Per-frame re-renders |
| `will-change` in global CSS | Layer explosion |
| `@keyframes` on hover/toggle states | Not interruptible |
| No `prefers-reduced-motion` / `useReducedMotion` anywhere | Reduced motion ignored |
| `onAnimationComplete` gating logic | UI waits on motion |
