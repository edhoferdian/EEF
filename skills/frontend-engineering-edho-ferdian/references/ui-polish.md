# Authoring Guide — Interface Polish (design-engineering details)

Adapted from ECC `make-interfaces-feel-better`, fetched 2026-09-04.

The small details that compound into an interface feeling finished. Use this
when the UI "works" but reads as flat, cramped, jumpy, or generic — and when
building controls, cards, lists, navigation, forms, or toolbars for the first
time.

Unlike `motion-system.md` (which needs `motion/react`), everything here is plain
CSS and applies to any stack.

## Concentric radius

For nested rounded surfaces that sit close together:

```text
outer radius = inner radius + padding
```

If the padding is large, stop applying the formula and treat the layers as
separate surfaces instead. The goal is optical coherence, not formula worship.

## Optical alignment

Geometric centering is not visual centering. Play triangles, arrows, stars, and
other asymmetric icons need a small offset to look centered. Fix it in the SVG
when you own the asset; otherwise nudge with a pixel-level margin/padding.

## Borders vs shadows

Borders separate and carry focus rings. Layered shadows create depth for cards,
buttons, dropdowns, and popovers. Shadows must be transparent and subtle enough
to survive on any background — a shadow tuned only for white will smear on dark.

## Text wrapping and numerals

- `text-wrap: balance` on headings and short titles.
- `text-wrap: pretty` on short-to-medium body text, captions, descriptions, list
  items.
- Neither on long prose, code, or preformatted content.
- `font-variant-numeric: tabular-nums` on counters, timers, prices, tables, and
  any number that updates in place — otherwise the layout jitters every tick.

## Font smoothing

On macOS, apply at the root layout when the project does not already:

```css
html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
```

## Image outlines

Images usually need a subtle inset outline so their edges do not dissolve into
the surface behind them. Keep it neutral black/white alpha — never tinted with
the brand palette.

```css
img { outline: 1px solid rgba(0,0,0,0.1); outline-offset: -1px; }
@media (prefers-color-scheme: dark) { img { outline-color: rgba(255,255,255,0.1); } }
```

## CSS motion craft

Use **CSS transitions** for interactive state changes — they can retarget when
the user changes intent mid-motion. Reserve `@keyframes` for staged one-shot
entrances and loading sequences.

Defaults that hold up:

- Enter: opacity + small `translateY`, optionally a slight blur.
- Exit: shorter and quieter than enter — around 150ms.
- Press: `scale(0.96)` for tactile buttons, with a way to disable it where the
  movement distracts.
- Icon swaps: cross-fade with opacity + scale + blur, never an instant
  visibility toggle.

### Transition scope

**Never `transition: all`.** Name the properties that actually change:

```css
.button {
  transition-property: transform, background-color, box-shadow;
  transition-duration: 150ms;
  transition-timing-function: ease-out;
}
```

Use `will-change` only to fix first-frame stutter, and only on
compositor-friendly properties (`transform`, `opacity`, `filter`). Never
`will-change: all` — it forces layers the browser then has to manage forever.

## Hit areas

Interactive controls need at least a 40×40px hit area, ideally 44×44px where the
layout allows. Expand with a pseudo-element when the visible icon is smaller —
and check that expanded hit areas do not overlap each other, which produces
clicks that land on the wrong control.

> Compliance floor vs. craft target: `accessibility-lens.md` A11Y-07 enforces
> the WCAG 2.2 minimum of 24×24 CSS px. That is the floor below which a finding
> is raised; 44×44 is the target you should be authoring toward.

## Reporting a polish pass

When the user asked for a polish pass (not a review), report concrete
before/after rows and omit principles you checked but did not change:

| Principle | Before | After |
|---|---|---|
| Concentric radius | Same radius on parent and child | Parent radius accounts for padding |
| Tabular numbers | Counter shifts as digits change | Counter uses `tabular-nums` |
| Transition scope | `transition: all` | Explicit transition properties |

Include file paths and property names when they are not obvious from the
snippet. This is a change log, not a findings report — no severities, no
confidence labels (see the relationship contract in this skill's `SKILL.md`).

## Checklist

- [ ] Nested rounded elements are optically coherent
- [ ] Asymmetric icons are visually, not just geometrically, centered
- [ ] Borders and shadows are each used for the right reason
- [ ] Headings and short text avoid awkward wrapping
- [ ] Updating numbers use tabular numerals
- [ ] Images carry a neutral outline where they need one
- [ ] Enter and exit are split, subtle, and interruptible
- [ ] Buttons have a tactile active state without exaggerated motion
- [ ] `transition: all` and `will-change: all` are absent
- [ ] Small controls still have usable hit areas that do not overlap
