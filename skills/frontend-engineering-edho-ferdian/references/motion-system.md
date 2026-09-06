# Authoring Guide — Motion System (React / Next.js)

Adapted from ECC `motion-foundations`, `motion-patterns`, and `motion-advanced`,
fetched 2026-09-04. ECC's fourth motion skill, `motion-ui`, was ~85% duplicate of
those three and is not ported separately — its three genuinely additive pieces
(the `AnimatePresence` mode table, the `deviceMemory` low-end heuristic, and the
QA checklist) are folded in below.

**Scope.** This file replaces the short animation section that used to live in
`composition-and-ux.md`. That file now covers focus and interaction craft only.

**This is authoring, not review.** It answers "how do I build this animation" —
not "is this animation a defect." Motion problems found while reviewing existing
code belong to `code-review-edho-ferdian` (PERF domain for jank, the
accessibility lens for reduced-motion violations).

---

## 1. The gate — should this animate at all?

Motion must do at least one of these, or it gets removed:

- guide attention
- communicate state
- preserve spatial continuity

**Responsiveness outranks smoothness.** A 60fps animation that adds input delay
is worse than no animation. Decorative motion with no UX job is not a style
preference to debate — it is dead weight to delete.

Turn animation off entirely when:

| Condition | Why |
|---|---|
| `prefers-reduced-motion: reduce` | Non-negotiable — see §3 |
| Low-end device **and** the animation is non-essential | Frame budget is better spent on input latency |
| Element is offscreen and will never enter the viewport | Pure waste |
| The animation is decorative | It failed the gate above |

## 2. Tokens and springs — no inline numbers

Every duration, easing, distance, scale, and spring config comes from one shared
module. A hardcoded `transition={{ duration: 0.4 }}` in a component file is the
single most common way a motion system drifts into inconsistency.

```ts
// lib/motion-tokens.ts
export const motionTokens = {
  duration: { instant: 0.08, fast: 0.18, normal: 0.35, slow: 0.6, crawl: 1.0 },
  easing: {
    smooth: [0.22, 1, 0.36, 1],
    sharp:  [0.4, 0, 0.2, 1],
    bounce: [0.34, 1.56, 0.64, 1],
    linear: [0, 0, 1, 1],
  },
  distance: { xs: 4, sm: 8, md: 16, lg: 24, xl: 48 },
  scale: { subtle: 0.98, press: 0.95, pop: 1.04 },
} as const

export const springs = {
  snappy:  { type: "spring", stiffness: 300, damping: 30 },
  gentle:  { type: "spring", stiffness: 120, damping: 14 },
  bouncy:  { type: "spring", stiffness: 400, damping: 10 },
  instant: { type: "spring", stiffness: 600, damping: 35 },
  release: { type: "spring", stiffness: 200, damping: 20, restDelta: 0.001 },
} as const
```

Picking a value:

| Duration token | Use for | Spring preset | Use for |
|---|---|---|---|
| `instant` | Tooltip, focus ring, badge | `snappy` | Default UI — buttons, chips, nav |
| `fast` | Button feedback, icon swap | `gentle` | Cards, modals, panels landing |
| `normal` | Modal open, card expand | `bouncy` | Playful — empty state, onboarding |
| `slow` | Hero entrance, page transition | `instant` | Tooltip, popover, dropdown |
| `crawl` | Deliberate storytelling only | `release` | Drag release (natural physics) |

## 3. Accessibility and device adaptation

Priority order, highest first:

1. `prefers-reduced-motion: reduce` — **all transforms off**. Opacity-only fade
   at ≤0.2s is the one permitted fallback.
2. Low-end device — shorten durations, drop non-essential animation.
3. Design preference — everything else.

Motion must degrade without causing layout shift or losing orientation. "Reduced
motion" means *less movement*, not *element disappears instantly*.

```ts
// lib/motion-config.ts
// deviceMemory only exists on Chrome/Android; undefined elsewhere is treated as
// capable, with a core-count fallback so Safari/Firefox on weak hardware still
// gets caught. (This is the corrected heuristic from ECC motion-ui; the
// core-count-only version in motion-foundations misclassifies modern Macs.)
export const isLowEnd = () =>
  typeof navigator !== "undefined" &&
  ((navigator as any).deviceMemory !== undefined
    ? (navigator as any).deviceMemory <= 2
    : navigator.hardwareConcurrency <= 4)

export const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

export const shouldAnimate = ({ essential = false } = {}) =>
  !prefersReduced() && (essential || !isLowEnd())
```

```tsx
// hooks/use-safe-motion.ts
"use client"
import { useReducedMotion } from "motion/react"

export function useSafeMotion(fullY = 16) {
  const reduce = useReducedMotion()
  return {
    initial: { opacity: 0, y: reduce ? 0 : fullY },
    animate: { opacity: 1, y: 0 },
    exit:    { opacity: 0, y: reduce ? 0 : -fullY },
  }
}
```

Never read `window` or `navigator` at module level — always guard with
`typeof … !== "undefined"`, or SSR throws before the page ever renders.

## 4. SSR / hydration safety (Next.js App Router)

**Rule: `initial` must match what the server actually rendered.** If the server
emits `opacity: 1` and the client's `initial` says `opacity: 0`, React logs a
hydration mismatch and the first frame flashes.

```tsx
"use client"
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])

<motion.div initial={{ opacity: mounted ? 0 : 1 }} animate={{ opacity: 1 }} />
```

Also required: `"use client"` on every file importing from `motion/react`.

**Import discipline.** Use `motion/react` (package `motion`). `framer-motion` is
the legacy path. Never mix them in one tree — the two ship separate schedulers
and separate `AnimatePresence` contexts, so exit animations silently stop
coordinating across the boundary. Check with
`grep -E '"motion"|"framer-motion"' package.json`.

## 5. Pattern catalogue

### The `AnimatePresence` contract

Three things must all be true or the exit animation silently never fires:

1. `AnimatePresence` wraps the conditional
2. the direct child has a `key`
3. the child has an `exit` prop

Always define `exit` in the same edit as `initial` + `animate` — an exit added
later is an exit that was designed against a different mental model.

### Choose `mode` explicitly

The default (`"sync"`) overlaps enter and exit, which is wrong for most UI.

| `mode` | Use for |
|---|---|
| `"wait"` | Modals, toasts, page transitions — exit finishes before enter starts |
| `"sync"` | Crossfade carousels, stacked notifications — overlap is intentional |
| `"popLayout"` | Lists, tabs, dismissible cards — exiting item leaves flow immediately, the rest reflow |

### Which pattern for which situation

| Situation | Pattern |
|---|---|
| Element appears / disappears | `AnimatePresence` + `exit` |
| List loading in sequence | Stagger variants, `staggerChildren` 0.05–0.10s |
| Route change | Page-transition wrapper, `mode="wait"` |
| Element changes size in place | `layout` prop (small subtrees only) |
| Same element moves across contexts | `layoutId` (unique per mounted instance) |
| Element enters on scroll | `whileInView` + `viewport={{ once: true }}` |
| Value tied to scroll position | `useScroll` + `useTransform` |

Stagger outside 0.05–0.10s is a mistake in both directions: below feels
mechanical, above feels sluggish. Scroll reveals that re-fire on scroll-out are
distracting, not informative — hence `once: true`.

### `layout` has a size limit

`layout` reconciles positions by measuring then transforming. On a full-viewport
container or a subtree of more than ~5 children / deep nesting, that measurement
cost shows up as visible jank and CLS. Use explicit `x`/`y` transforms, CSS
grid/flex transitions, or `layoutId` on specific children instead.

### Never animate layout properties

`width`, `height`, `top`, `left`, `margin`, `padding` are banned from `animate`.
They force layout recalculation every frame. Use `transform` (`x`/`y`/`scale`)
and `opacity`, which run on the compositor. For an accordion, animate
`max-height` with `overflow: hidden`, or measure and animate to a concrete pixel
value — never `height: auto`.

### Modal — motion plus the four non-negotiables

Any animated modal must also have: focus trap, `Escape` close, scroll lock,
`role="dialog"` + `aria-modal="true"`. Animate the overlay (fade) and the panel
(fade **plus** scale/translate) as two coordinated layers — a panel that only
fades reads as flat rather than arriving.

```tsx
"use client"
import { motion, AnimatePresence } from "motion/react"
import { motionTokens, springs } from "@/lib/motion-tokens"

// call site: <AnimatePresence mode="wait">{open && <Modal key="modal" />}</AnimatePresence>
export function Modal({ onClose }: { onClose: () => void }) {
  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/50"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog" aria-modal="true"
        initial={{ opacity: 0, scale: motionTokens.scale.press, y: motionTokens.distance.sm }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: motionTokens.scale.press, y: motionTokens.distance.sm }}
        transition={springs.gentle}
      />
    </>
  )
}
```

Focus trap, restoration, and scroll lock implementations live in
`composition-and-ux.md` — build the interaction there first, then wrap it in the
motion above.

## 6. Advanced — drag, gestures, imperative sequences

| Scenario | API |
|---|---|
| Drag with physics on release | `drag` + `dragTransition: springs.release` |
| Drag-to-reorder list | `Reorder.Group` + `Reorder.Item` |
| Dismiss / swipe | `drag="x"`\|`"y"` + `onDragEnd` offset **and** velocity check |
| Value smoothed over time (cursor follower) | `useSpring` |
| Value derived from another, no re-render | `useTransform` |
| Multi-step sequence | `useAnimate` with `async/await` |
| SVG draw-on | `pathLength` 0 → 1 |
| SVG morph | `d` tween — **requires equal path command counts**, otherwise it snaps |
| Circular progress | `strokeDashoffset` tween |

```tsx
// Swipe / dismiss — never infer intent from velocity alone
const OFFSET_THRESHOLD = 50
const VELOCITY_THRESHOLD = 300

<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  onDragEnd={(_, info) => {
    if (info.offset.x >  OFFSET_THRESHOLD || info.velocity.x >  VELOCITY_THRESHOLD) onSwipeRight()
    if (info.offset.x < -OFFSET_THRESHOLD || info.velocity.x < -VELOCITY_THRESHOLD) onSwipeLeft()
  }}
/>
```

Rules that bite in practice:

- `useMotionValue` / `useSpring` are SSR-safe and do **not** cause hydration
  errors — prefer them over state for per-frame values.
- `useAnimate`'s scope ref must be attached to a mounted element; calling
  `animate()` before mount fails silently.
- Infinite animations must pause when `document.visibilityState === "hidden"`.
  A background tab burning GPU is a battery bug, not an animation.
- Every `addEventListener` in a custom motion hook needs its `removeEventListener`
  in the effect's cleanup return.
- Test drag on a real touch device. `drag` works on both, but threshold and feel
  do not transfer from mouse.

## 7. QA checklist before calling motion work done

- [ ] No CLS introduced by any animation
- [ ] Keyboard still works throughout; focus trapped in modals
- [ ] `role="dialog"` / `aria-modal="true"` present on dialogs
- [ ] Reduced motion respected in **both** JS (`useReducedMotion`) and CSS
- [ ] No hydration warnings in the Next.js console
- [ ] Animations stop cleanly on unmount (no leaked RAF/listeners)
- [ ] `mode` set explicitly at every `AnimatePresence` call site
- [ ] No inline durations/easings/spring configs — all from `motion-tokens`
- [ ] Nothing animating `width`/`height`/`top`/`left`

## 8. Anti-pattern table

| Anti-pattern | Fix |
|---|---|
| `import { motion } from "framer-motion"` alongside `motion/react` | Pick one; `motion/react` for new work |
| `initial={{ opacity: 0 }}` on an SSR'd component | Mount guard (§4) |
| Skipping the reduced-motion check | `useSafeMotion` |
| `animate={{ width: "100%" }}` | `scaleX` |
| Inline `transition={{ duration: 0.4 }}` | `motionTokens.duration.normal` |
| Inline `{ stiffness: 300, damping: 30 }` | `springs.snappy` |
| Missing `"use client"` | Add it |
| `navigator.hardwareConcurrency` at module level | `typeof navigator !== "undefined"` guard |
| `layout` on a full-viewport container | Explicit transforms / `layoutId` on children |
| `AnimatePresence` without `mode` | Choose from the table in §5 |
| Infinite animation with no state to communicate | Delete it |

## Related

- `references/composition-and-ux.md` — focus trap, focus restoration, keyboard
  handling that these animations wrap.
- `references/ui-polish.md` — CSS-transition-level motion craft (press states,
  icon cross-fades, transition scope) for cases that do not need `motion/react`.
- `code-review-edho-ferdian/references/accessibility-lens.md` — auditing
  reduced-motion and CLS compliance after the fact.
