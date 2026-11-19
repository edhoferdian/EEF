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
