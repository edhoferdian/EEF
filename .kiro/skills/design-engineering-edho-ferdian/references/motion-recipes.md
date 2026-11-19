# Motion Recipes — common web components

Concrete starting points. Curves and durations are the tokens from
`motion-foundations.md`. Adapt to the project's existing tokens and
component library; never paste a recipe over an existing pattern. React
examples use Motion (`motion/react`); check the installed version's API.

```css
:root {
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --dur-press: 120ms;
  --dur-small: 180ms;
  --dur-medium: 240ms;
  --dur-large: 320ms;
}
```

```ts
// motion.ts — the same tokens for Motion
export const ease = { out: [0.22, 1, 0.36, 1], inOut: [0.65, 0, 0.35, 1], drawer: [0.32, 0.72, 0, 1] } as const;
export const spring = { ui: { type: "spring", visualDuration: 0.3, bounce: 0 }, snappy: { type: "spring", visualDuration: 0.22, bounce: 0 } } as const;
```

---

## 1. Button press

```css
.button {
  transition: transform var(--dur-press) var(--ease-out),
              background-color var(--dur-press) var(--ease-out);
}
.button:active { transform: scale(0.97); }
```

No press scale on large surfaces (cards, full-width rows) — use a
background change. Don't scale buttons that sit in dense toolbars used
constantly; a background change is enough there too.

## 2. Popover / dropdown / menu (Radix-style data attributes)

```css
.popover {
  transform-origin: var(--radix-popover-content-transform-origin);
}
.popover[data-state="open"]   { animation: pop-in var(--dur-small) var(--ease-out); }
.popover[data-state="closed"] { animation: pop-out 130ms var(--ease-out); }

@keyframes pop-in  { from { opacity: 0; transform: scale(0.96); } }
@keyframes pop-out { to   { opacity: 0; transform: scale(0.97); } }

/* Direction-aware nudge: comes from the trigger side */
.popover[data-side="bottom"] { --dy: -4px; }
.popover[data-side="top"]    { --dy: 4px; }
```

- Base UI exposes `--transform-origin`; Floating UI gives `placement` to
  derive it. Every popover must grow from its trigger.
- A menu opened many times per minute (editor toolbars, right-click
  menus): fade only, ~100 ms, or no animation at all.
- Keyboard-opened menus can skip animation entirely.

## 3. Tooltip with "warm-up"

```tsx
<Tooltip.Provider delayDuration={500} skipDelayDuration={300}>
  {/* first tooltip waits 500 ms; moving to a neighbour within 300 ms shows it instantly */}
</Tooltip.Provider>
```

```css
.tooltip[data-state="delayed-open"] { animation: fade-in 120ms var(--ease-out); }
.tooltip[data-state="instant-open"] { animation: none; }
```

## 4. Dialog

```css
.overlay[data-state="open"]  { animation: fade-in 200ms var(--ease-out); }
.overlay[data-state="closed"]{ animation: fade-out 150ms var(--ease-out); }

.dialog[data-state="open"]   { animation: dialog-in 220ms var(--ease-out); }
.dialog[data-state="closed"] { animation: dialog-out 150ms var(--ease-out); }

@keyframes dialog-in  { from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); } }
@keyframes dialog-out { to   { opacity: 0; transform: translate(-50%, -49%) scale(0.98); } }
```

Focus moves into the dialog on open, back to the trigger on close. The
page behind doesn't scroll.

## 5. Toast stack

Prefer Sonner (`library-picks.md`). When building one:

```tsx
<AnimatePresence initial={false}>
  {toasts.map((t, i) => (
    <motion.li
      key={t.id}
      layout
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 - i * 0.04 }}   // stacked toasts shrink slightly
      exit={{ opacity: 0, y: 12, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, ease: ease.out }}
      style={{ zIndex: toasts.length - i }}
    />
  ))}
</AnimatePresence>
```

Hovering the stack expands it (each toast moves to its own slot); swipe
to dismiss follows the finger (`gestures.md`); pause auto-dismiss timers
while hovered or while the window is hidden.

## 6. Accordion / collapsible

Three options, in order of preference:

```css
/* A. Library-measured height variable (Radix) */
.content[data-state="open"]   { animation: open 220ms var(--ease-out); }
.content[data-state="closed"] { animation: close 180ms var(--ease-out); }
@keyframes open  { from { height: 0; } to { height: var(--radix-accordion-content-height); } }
@keyframes close { from { height: var(--radix-accordion-content-height); } to { height: 0; } }

/* B. Pure CSS with grid rows */
.collapsible { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 220ms var(--ease-out); }
.collapsible[data-open] { grid-template-rows: 1fr; }
.collapsible > .inner { overflow: hidden; }

/* C. interpolate-size where supported */
:root { interpolate-size: allow-keywords; }
details::details-content { height: 0; overflow: clip; transition: height 220ms var(--ease-out), content-visibility 220ms allow-discrete; }
details[open]::details-content { height: auto; }
```

```tsx
// D. Motion
<motion.div initial={false} animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
  transition={{ height: { duration: 0.22, ease: ease.out }, opacity: { duration: 0.15, delay: open ? 0.05 : 0 } }}
  style={{ overflow: "hidden" }} />
```

Content fades in slightly after the height starts opening; on close,
opacity leads.

## 7. Tabs / segmented control indicator

```tsx
{tabs.map((tab) => (
  <button key={tab.id} onClick={() => setActive(tab.id)} className="relative">
    {active === tab.id && (
      <motion.span layoutId="tab-indicator" className="absolute inset-0 rounded-md bg-muted"
        transition={spring.snappy} />
    )}
    <span className="relative">{tab.label}</span>
  </button>
))}
```

One element moves between tabs. When a group of tabs appears more than
once on a page, wrap each in `<LayoutGroup id="…">` so `layoutId`s don't
collide.

## 8. List add / remove

```tsx
<ul>
  <AnimatePresence initial={false}>
    {items.map((item) => (
      <motion.li
        key={item.id}
        layout
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
        transition={{ duration: 0.22, ease: ease.out }}
      />
    ))}
  </AnimatePresence>
</ul>
```

Order of operations is in `choreography.md` §"Item leaving". Don't animate
the list when it is filtered or sorted by the user many times in a row —
reorder instantly or with a very short layout animation.

## 9. Number change

```css
.value { font-variant-numeric: tabular-nums; }
```

```tsx
<AnimatePresence mode="popLayout" initial={false}>
  <motion.span key={value}
    initial={{ y: "60%", opacity: 0, filter: "blur(2px)" }}
    animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
    exit={{ y: "-60%", opacity: 0, filter: "blur(2px)" }}
    transition={{ duration: 0.2, ease: ease.out }}>
    {formatted}
  </motion.span>
</AnimatePresence>
```

For per-digit rolling, NumberFlow handles locale formatting and digit
transitions. Never animate a number while the user types it, or values in
a table that refresh constantly.

## 10. Icon swap (copy → check, play → pause)

```tsx
<AnimatePresence mode="popLayout" initial={false}>
  <motion.span key={copied ? "check" : "copy"}
    initial={{ opacity: 0, scale: 0.8, filter: "blur(3px)" }}
    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
    exit={{ opacity: 0, scale: 0.8, filter: "blur(3px)" }}
    transition={{ duration: 0.15, ease: ease.out }}>
    {copied ? <Check /> : <Copy />}
  </motion.span>
</AnimatePresence>
```

Reset after ~1.5 s. The button keeps its size.

## 11. Loading button

```tsx
<button disabled={pending} className="relative min-w-[8rem]">
  <span style={{ opacity: pending ? 0 : 1, transition: "opacity 120ms" }}>Save</span>
  {pending && <Spinner className="absolute inset-0 m-auto" />}
</button>
```

Width stays fixed (label kept in layout, just hidden). Show the spinner
only if the action takes longer than ~300 ms to avoid a flash.

## 12. Skeleton → content

```css
.skeleton {
  background: linear-gradient(90deg, var(--sk) 0%, var(--sk-hi) 50%, var(--sk) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.6s linear infinite;
}
@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
```

Crossfade to content (150–200 ms). The skeleton must match the content's
dimensions so nothing shifts.

## 13. Hover card / preview

Open delay ~400–700 ms (intentional hover), close delay ~200 ms (so the
pointer can travel into it). Fade + scale 0.97 → 1 from the trigger side,
150 ms. Never on touch.

## 14. Page / route transitions — View Transitions API

```css
@view-transition { navigation: auto; }               /* cross-document (MPA) */
::view-transition-old(root) { animation: 120ms var(--ease-out) both fade-out; }
::view-transition-new(root) { animation: 180ms var(--ease-out) both fade-in; }

.product-image { view-transition-name: product-hero; } /* shared element between pages */
```

```ts
// Same-document (SPA) update
if (document.startViewTransition) document.startViewTransition(() => updateDOM());
else updateDOM();
```

Keep them short and optional; never block navigation on an animation.
Disable under reduced motion.

## 15. Drawer / sheet (web)

Use Vaul or the component library's drawer. CSS for the enter itself:

```css
.drawer[data-state="open"]   { animation: drawer-in 400ms var(--ease-drawer); }
.drawer[data-state="closed"] { animation: drawer-out 260ms var(--ease-drawer); }
@keyframes drawer-in  { from { transform: translateY(100%); } }
@keyframes drawer-out { to   { transform: translateY(100%); } }
```

Drag behaviour is in `gestures.md`.

## 16. Command palette

Opens instantly or with a ≤ 100 ms fade. Results update with no
animation. This is the most frequently used surface in many apps; motion
here is a cost, not a feature.

## 17. Text reveal (marketing / hero only)

```tsx
<motion.h1 initial="hidden" animate="show"
  variants={{ show: { transition: { staggerChildren: 0.03 } } }}>
  {words.map((w, i) => (
    <motion.span key={i} className="inline-block"
      variants={{ hidden: { opacity: 0, y: 8, filter: "blur(4px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)" } }}
      transition={{ duration: 0.35, ease: ease.out }}>
      {w}&nbsp;
    </motion.span>
  ))}
</motion.h1>
```

Once per page load, never in app UI, and keep the text accessible (screen
readers get the full heading — split visually only).

## 18. Scroll-driven reveal (CSS only)

```css
@supports (animation-timeline: view()) {
  .reveal {
    animation: reveal linear both;
    animation-timeline: view();
    animation-range: entry 0% entry 40%;
  }
}
@keyframes reveal { from { opacity: 0; transform: translateY(16px); } }
```

Runs off the main thread. Use sparingly; content must be readable
without it.
