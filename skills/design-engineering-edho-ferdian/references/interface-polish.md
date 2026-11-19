# Interface Polish — the details that make UI feel finished

Use when building or reviewing a component's interactions and finish, and
no narrower reference fits. Pairs with `frontend-engineering-edho-ferdian`'s
`ui-polish.md` (CSS basics); this file goes further into feel.

## Principles

1. **Responsiveness beats richness.** Feedback within ~100 ms of every
   input matters more than any animation.
2. **Spatial consistency.** Things live somewhere. They come from and go
   back to the same place; navigation directions stay consistent.
3. **Restraint.** Every extra effect costs attention. Add a detail only if
   the user would miss it.
4. **Physical believability.** Motion with momentum, objects that don't
   pop out of nothing, surfaces that layer with depth.
5. **Invisible when right.** Good polish is noticed only when absent.

## Interaction states

Every interactive element has: default, hover (pointer devices only),
focus-visible (clear ring, not removed), active/pressed, disabled, and
where relevant loading and selected. Missing pressed feedback is the most
common gap.

- Hover styles inside `@media (hover: hover) and (pointer: fine)`.
- Pressed: `scale(0.97)` or a darker background, instant on press.
- Focus ring: visible, offset, matching the radius.
- Hit area at least 40–44 px even when the visual is smaller (padding or a
  pseudo-element).

## Overlays

- Popovers grow from their trigger; modals from the centre.
- Tooltips: delayed first, instant for neighbours, never hold essential
  information, never on touch-only UI.
- Close on Escape and outside click; return focus to the trigger.
- Keep overlays inside the viewport (collision handling) — use a
  positioning library.

## Typography

- Body line length ~60–75 characters (`max-width: 65ch`).
- Large headings: tighter tracking (around `-0.01em` to `-0.03em`) and
  tighter leading (1.1–1.2). Small text: slightly looser tracking.
- Body leading 1.4–1.6.
- `font-variant-numeric: tabular-nums` for numbers that change or align in
  columns.
- Use the font's optical sizes when available (`font-optical-sizing: auto`).
- `text-wrap: balance` for headings, `text-wrap: pretty` for paragraphs.

## Depth and materials

- Layering: background → surface → raised → overlay, each step slightly
  lighter (dark mode) or with a stronger shadow (light mode).
- Prefer soft, layered shadows or a hairline border over one heavy
  shadow. In dark mode, borders and lightness carry depth; shadows barely
  show.
- Translucent materials (`backdrop-filter: blur()` + semi-transparent
  background) for chrome that floats over content: toolbars, sheets,
  menus. Keep them legible — add saturation and enough opacity behind
  text.
- Nested rounded corners: outer radius = inner radius + padding.

## Content details

- Relative time ("5 minutes ago") for recent events; switch to an absolute
  date after about a week.
- Pluralise properly (`Intl.PluralRules`), never "1 members".
- Format numbers and dates with `Intl` for the user's locale.
- Truncate deliberately: decide per field whether to truncate the end,
  the middle (file names, emails), or wrap. Show the full value on hover
  or focus.
- Avatars and icons: `flex-shrink: 0` so they never squish.
- Empty states say what goes here and how to add it.

## Visual craft

- Gradients that fade to transparent need extra colour stops along an
  ease curve, or the edge shows.
- Optical alignment: icons with asymmetric shapes (play, arrows) need a
  small offset to look centred.
- Consistent spacing scale; consistent radius scale; one accent colour.
- Images: reserve their aspect ratio so nothing shifts on load.

## Cheatsheet

| Problem | Fix |
|---|---|
| Old timestamps read "340 days ago" | Absolute date after a week |
| Numbers jitter when they change | `tabular-nums` |
| Large headings look loose | Tighter tracking, e.g. `-0.02em` |
| Body text is tiring | `max-width: 65ch` |
| Button feels dead | `scale(0.97)` on `:active` |
| Avatar squished | `flex-shrink: 0` |
| Gradient fade has an edge | Eased gradient stops |
| Crossfade looks messy | Short `blur(2px)` during it |
| Dropdown feels sluggish | ease-out under 250 ms |
| Popover grows from wrong spot | `transform-origin` at the trigger |
| "1 members" | `Intl.PluralRules` |
