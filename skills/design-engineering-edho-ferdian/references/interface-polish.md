# Interface Polish — the details that make UI feel finished

Use when building or reviewing a component's interactions and finish, and
no narrower reference fits. Pairs with `frontend-engineering-edho-ferdian`'s
`ui-polish.md` (CSS basics). For the Apple-style feel (materials, physical
motion, typography scale) see `apple-design.md`; for motion values see
`motion-foundations.md`.

## Principles

1. **Responsiveness beats richness.** Feedback within ~100 ms of every
   input matters more than any animation. Optimistic UI where the action
   almost always succeeds.
2. **Spatial consistency.** Things live somewhere. They come from and go
   back to the same place; navigation directions stay consistent.
3. **Restraint.** Every extra effect costs attention. Add a detail only if
   the user would miss it.
4. **Physical believability.** Momentum, layering, nothing appearing from
   a point.
5. **Invisible when right.** Good polish is noticed only when it's
   missing.
6. **Taste is a set of decisions you can explain.** For every detail, be
   able to say what problem it solves for the user.

## Interaction states — every control, every state

| State | Rule |
|---|---|
| Default | Clearly reads as interactive (shape, colour, cursor) |
| Hover | Pointer devices only (`@media (hover: hover) and (pointer: fine)`); subtle; 100–150 ms transition, instant on leave is fine |
| Focus-visible | Always visible, 2 px ring with offset, follows the radius; never `outline: none` without a replacement |
| Active / pressed | Instant on press: `scale(0.97)` for buttons, darker background for rows |
| Disabled | Lower contrast, `cursor: not-allowed`, still readable; explain why via tooltip/helper text when it isn't obvious |
| Loading | Keep width fixed, show spinner/progress, prevent double submit |
| Selected / current | Distinct from hover and focus at the same time |
| Error | Colour + icon + text (never colour alone) |

```css
.btn {
  transition: background-color 120ms var(--ease-out), transform 120ms var(--ease-out);
}
.btn:active { transform: scale(0.97); }
.btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
@media (hover: hover) and (pointer: fine) {
  .btn:hover { background: var(--btn-hover); }
}
```

Hit area ≥ 40–44 px even when the visual is smaller:

```css
.icon-btn { position: relative; }
.icon-btn::after { content: ""; position: absolute; inset: -8px; }
```

## Buttons

- One primary action per view; secondary actions visually quieter.
- Labels are verbs that say what happens ("Save changes", not "OK").
- Icon + label beats icon-only; icon-only needs `aria-label` and a tooltip.
- Destructive actions use the danger colour only on the final confirm,
  not on the button that opens the dialog.
- Don't change the button's width when its label or state changes
  (min-width or a stable grid cell).

## Inputs and forms

- Labels always visible (placeholders are hints, not labels).
- Inline validation on blur, not on every keystroke; clear it as soon as
  the value becomes valid.
- Error text says how to fix it ("Use at least 8 characters"), placed
  under the field, linked with `aria-describedby`.
- Correct `type`, `inputmode`, `autocomplete`; 16 px font on mobile to
  avoid zoom.
- Submit button shows progress; disable only while submitting, not before
  the form is valid (let users discover what's missing).
- Preserve input on error; never clear a form the user filled.
- Focus the first invalid field after a failed submit.

## Menus, popovers, tooltips

- Popovers grow from their trigger (`transform-origin` at the trigger
  side); modals from the centre.
- Menus open on click (not hover) for anything with actions; submenus
  open on hover with a short delay and a safe triangle so the pointer can
  travel diagonally.
- Full keyboard support: arrows, Home/End, typeahead, Escape, Enter.
- Tooltips: delayed first (~500 ms), instant for neighbours, never hold
  essential information, never on touch-only UI.
- Close on Escape and outside click; return focus to the trigger.
- Use a positioning library for collision handling; never let an overlay
  render off-screen.

## Dialogs and sheets

- Use a dialog only when the task must interrupt; otherwise inline or a
  side panel.
- Trap focus; first focus on the first meaningful control (or the dialog
  title for read-only content).
- Destructive confirms state the consequence ("Delete 3 files? This can't
  be undone.") and name the button after the action.
- Don't stack dialogs on dialogs.
- Mobile: sheets from the bottom with drag to dismiss (`gestures.md`).

## Lists, tables, data

- Align numbers right, text left; tabular figures for numeric columns.
- Sticky header for long tables; zebra striping only when rows are wide.
- Row hover highlight on pointer devices; whole row clickable if it
  navigates (with a real link inside for accessibility).
- Truncate per column deliberately; full value on hover/focus.
- Sorting/filtering keeps scroll position and shows the active state.
- Don't animate data that is being read (numbers re-animating on refresh).

## Loading, empty, error

- **Loading:** skeletons with the final layout's dimensions for content;
  spinners only for actions. No spinner for anything under ~300 ms (delay
  showing it).
- **Empty:** say what will appear here and give the action that fills it.
  First-run empty states can have personality; filter-empty states should
  offer "clear filters".
- **Error:** what happened, in plain language, and what to do next (retry,
  contact, go back). Keep the user's work.
- **Partial:** show what loaded; mark what failed.

## Feedback and notifications

- Inline confirmation near the thing that changed beats a toast.
- Toasts for background results and undo; one line, an action at most;
  don't stack more than three.
- Undo instead of "Are you sure?" for reversible actions.
- Copy-to-clipboard: swap the icon to a check for ~1.5 s, keep the width.

## Typography

- Body line length ~60–75 characters (`max-width: 65ch`).
- Size-dependent tracking: large headings tighter (−0.01 to −0.03 em),
  small text slightly looser. Table in `apple-design.md` §4.
- Leading: body 1.4–1.6, headings 1.1–1.2.
- `font-variant-numeric: tabular-nums` for changing or aligned numbers.
- `font-optical-sizing: auto` with variable fonts that support it.
- `text-wrap: balance` for headings, `text-wrap: pretty` for paragraphs.
- Avoid orphans in headings; avoid ALL CAPS for long text (and add
  letter-spacing when you use it for short labels).

## Colour, contrast, dark mode

- Contrast: 4.5:1 for body text, 3:1 for large text and UI boundaries.
- Build colours as tokens with semantic names (`--text-muted`,
  `--surface-raised`), not raw hex in components.
- Dark mode is not inverted light mode: surfaces get lighter as they rise,
  shadows weaken, saturated colours are toned down, pure black/white
  avoided for large areas.
- One accent colour; status colours (success, warning, danger) used only
  for status.
- Respect `prefers-color-scheme`, and let users override it.

## Depth and materials

- Layering: background → surface → raised → overlay.
- Soft, layered shadows or a hairline border instead of one heavy shadow.
- Translucent chrome (`backdrop-filter: blur() saturate()`) for toolbars,
  menus and sheets over content; solid fallback for reduced transparency.
- Nested rounded corners stay concentric: outer = inner + padding.

## Content details

- Relative time for recent events ("5 minutes ago"); absolute date after
  about a week; full timestamp on hover.
- Pluralise properly (`Intl.PluralRules`), never "1 members".
- Format numbers, currency and dates with `Intl` for the user's locale.
- Truncate deliberately: end for titles, middle for file names and emails.
- Avatars and icons: `flex-shrink: 0`; fixed square size; fallback
  initials with readable contrast.
- Images reserve their aspect ratio (`aspect-ratio`, width/height
  attributes) so nothing shifts on load.
- Microcopy: specific, short, human. Error messages never blame the user.

## Visual craft

- Gradients fading to transparent need extra colour stops along an ease
  curve, or the edge shows:

  ```css
  background: linear-gradient(to bottom,
    rgb(0 0 0 / 0) 0%, rgb(0 0 0 / 0.03) 20%, rgb(0 0 0 / 0.1) 45%,
    rgb(0 0 0 / 0.25) 70%, rgb(0 0 0 / 0.45) 100%);
  ```

- Optical alignment: asymmetric icons (play, arrows, chevrons) need a 1–2
  px nudge to look centred; text next to icons often needs a baseline
  adjustment.
- Consistent spacing scale (4/8-based), radius scale, icon set, stroke
  width.
- Borders at 1 px on low-DPI, hairline (0.5 px) on high-DPI where the
  design calls for it.
- A short `filter: blur(2px)` during a crossfade hides the overlap of two
  states.

## Performance as polish

- Interactions must not wait on the network for visual feedback.
- Avoid layout shift: reserve space for images, ads, async content.
- Fonts: `font-display: swap` with metric-matched fallbacks to avoid
  reflow.
- Long lists virtualised; heavy components lazy-loaded below the fold.

## Cheatsheet

| Problem | Fix |
|---|---|
| Old timestamps read "340 days ago" | Absolute date after a week |
| Numbers jitter when they change | `tabular-nums` |
| Large headings look loose | Tighter tracking, e.g. `-0.02em` |
| Body text is tiring | `max-width: 65ch`, line-height 1.5 |
| Button feels dead | `scale(0.97)` on `:active` |
| Hover sticks after tapping on phones | Hover inside `(hover: hover) and (pointer: fine)` |
| Avatar squished | `flex-shrink: 0` |
| Gradient fade has an edge | Eased gradient stops |
| Crossfade looks messy | Short `blur(2px)` during it |
| Dropdown feels sluggish | ease-out, under 250 ms |
| Popover grows from wrong spot | `transform-origin` at the trigger |
| "1 members" | `Intl.PluralRules` |
| Button width jumps when loading | Fixed min-width, spinner replaces label |
| Focus ring missing | `:focus-visible` outline with offset |
| Content jumps when images load | `aspect-ratio` / width + height |
