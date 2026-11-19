# Motion Recipes — common web components

Concrete starting points. Curves are the tokens from
`motion-foundations.md`. Adapt to the project's existing tokens and
component library; never paste a recipe over an existing pattern.

## Button press

```css
.button {
  transition: transform 140ms var(--ease-out), background-color 140ms var(--ease-out);
}
.button:active { transform: scale(0.97); }
```

No press scale on large surfaces (cards, rows) — use a background change.

## Popover / dropdown / menu

```css
.popover {
  transform-origin: var(--radix-popover-content-transform-origin); /* or the lib's equivalent */
  animation: pop-in 180ms var(--ease-out);
}
.popover[data-state="closed"] { animation: pop-out 130ms var(--ease-out); }
@keyframes pop-in  { from { opacity: 0; transform: scale(0.96); } }
@keyframes pop-out { to   { opacity: 0; transform: scale(0.97); } }
```

Menus opened from the keyboard or many times per minute can skip the
scale and fade only, or not animate at all.

## Tooltip

First tooltip after a delay (~500 ms); once one is open, moving to the
next trigger shows it instantly with no animation. Fade only, ≤ 120 ms.

## Dialog

Overlay fades (200 ms). Content fades and scales from `0.96` to `1` around
the centre (220 ms ease-out). Exit 150 ms. Focus moves into the dialog
when it opens and back to the trigger when it closes.

## Toast

Enter from the stack edge with translate + opacity (~250 ms ease-out);
exit faster. Stacked toasts scale down slightly and peek behind the front
one; hovering the stack expands it. Swipe to dismiss follows the finger
(see `gestures.md`). Prefer a toast library over hand-rolling
(`library-picks.md`).

## Accordion / collapsible

Animating `height: auto` needs either the library's measured CSS variable
(e.g. `--radix-collapsible-content-height`), `grid-template-rows: 0fr → 1fr`,
or Motion's `animate={{ height: "auto" }}`. Keep it short (200 ms); content
fades in slightly after the height starts.

```css
.collapsible { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 220ms var(--ease-out); }
.collapsible[data-open] { grid-template-rows: 1fr; }
.collapsible > div { overflow: hidden; }
```

## Tabs / segmented control indicator

One indicator element that moves between tabs (Motion `layoutId`, or a
transform computed from the active tab's offset). Do not fade one
underline out and another in.

## List item add / remove

Removed item fades and shrinks; siblings close the gap with a layout
animation (`layout` in Motion). Added item: height opens first, then the
content fades in. See `choreography.md` for ordering.

## Skeleton → content

Crossfade (150–200 ms). The skeleton must have the final layout's size so
nothing jumps when content arrives. Shimmer is linear and slow (1.5–2 s).

## Number change

`tabular-nums`, then either an instant swap or a short vertical roll per
digit. Never animate a number the user is typing.

## Copy-to-clipboard confirmation

Icon swaps to a check with a quick scale + blur crossfade (~150 ms), stays
for ~1.5 s, swaps back. Keep the button the same width.

## Page / route transitions

Optional and short. A crossfade or a small translate (8–16 px) is plenty.
Use the View Transitions API where supported; never block navigation on
an animation finishing.

## Loading button

Keep the button's width fixed; swap the label for a spinner with a
crossfade. Disable it while loading.
