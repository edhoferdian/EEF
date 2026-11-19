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

## Recipes

### Staggered list entrance (first appearance only)

```tsx
const list = { show: { transition: { staggerChildren: 0.03, delayChildren: 0.02 } } };
const item = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } },
};

<motion.ul variants={list} initial="hidden" animate="show">
  {items.slice(0, 8).map((i) => <motion.li key={i.id} variants={item} />)}
  {items.slice(8).map((i) => <li key={i.id} />)}   {/* beyond the cap: no stagger */}
</motion.ul>
```

### Hero entrance with overlap

```tsx
const [scope, animate] = useAnimate();
useEffect(() => {
  animate([
    ["h1", { opacity: [0, 1], y: [12, 0] }, { duration: 0.4, ease: [0.22, 1, 0.36, 1] }],
    ["p", { opacity: [0, 1], y: [8, 0] }, { duration: 0.35, at: "-0.3" }],      // starts while h1 finishes
    [".cta", { opacity: [0, 1], scale: [0.97, 1] }, { duration: 0.3, at: "-0.25" }],
  ]);
}, []);
```

Total ≈ 0.55 s. Background and imagery stay still or fade once.

### View swap inside a container that resizes

```tsx
const [ref, bounds] = useMeasure();      // e.g. react-use-measure
<motion.div animate={{ height: bounds.height }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
  style={{ overflow: "hidden" }}>
  <div ref={ref}>
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div key={view}
        initial={{ opacity: 0, x: dir * 16, filter: "blur(2px)" }}
        animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, x: dir * -16, filter: "blur(2px)" }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>
        {render(view)}
      </motion.div>
    </AnimatePresence>
  </div>
</motion.div>
```

`dir` is +1 for forward, −1 for back, so direction stays spatially
consistent.

### Morph a button into a panel

```tsx
<AnimatePresence>
  {!open ? (
    <motion.button layoutId="composer" style={{ borderRadius: 999 }} onClick={() => setOpen(true)}>
      <motion.span layoutId="composer-label">New note</motion.span>
    </motion.button>
  ) : (
    <motion.div layoutId="composer" style={{ borderRadius: 16 }} className="panel">
      <motion.span layoutId="composer-label">New note</motion.span>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.1 } }}>
        <Editor />
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

The shared shape and label lead; new content fades in after the shape
has mostly arrived. Set `borderRadius` in `style` so Motion corrects it
during the scale.

### Item flying into a target (add to cart)

```ts
async function flyToCart(source: HTMLElement, target: HTMLElement) {
  const a = source.getBoundingClientRect(), b = target.getBoundingClientRect();
  const clone = source.cloneNode(true) as HTMLElement;
  Object.assign(clone.style, { position: "fixed", left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, pointerEvents: "none", zIndex: "1000" });
  document.body.append(clone);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  await clone.animate(
    [{ transform: "translate(0,0) scale(1)", opacity: 1 },
     { transform: `translate(${dx * 0.6}px, ${dy * 0.3 - 40}px) scale(0.6)`, opacity: 1, offset: 0.6 }, // arc
     { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0.4 }],
    { duration: 450, easing: "cubic-bezier(0.65, 0, 0.35, 1)" }
  ).finished;
  clone.remove();
  target.animate([{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }], { duration: 220 });
}
```

Skip the flight under reduced motion; keep the target's count update.

## Timing table

| Group | Lead | Followers start | Stagger | Settles by |
|---|---|---|---|---|
| Menu with items | Panel (150 ms) | With the panel | None or ≤ 15 ms | 200 ms |
| List first load | First item | Immediately | 25–40 ms, cap 8 | ≤ 450 ms |
| Hero | Headline (400 ms) | 30–50 % into the lead | 60–100 ms between blocks | ≤ 700 ms |
| View swap | Outgoing exit (120 ms) | Incoming overlaps | — | ≤ 300 ms |
| Item removed | Item exit (150 ms) | Siblings at ~60 % of exit | — | ≤ 350 ms |
| Morph | Shared shape (250–300 ms) | Content at ~100 ms | — | ≤ 400 ms |
