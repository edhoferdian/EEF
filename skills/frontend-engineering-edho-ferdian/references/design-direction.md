# Authoring Guide — Design Direction & Visual Consistency

Adapted from ECC `frontend-design-direction` and `design-system`, fetched
2026-09-04. ECC's `frontend-design-direction` is itself a salvage of community
PR #1659 (`linus707`); ECC deliberately does not rebundle Anthropic's canonical
`frontend-design` skill, and neither does this ecosystem — if that upstream
skill is wanted it gets installed on its own.

`design-system`'s Mode 1 (codebase token extraction) is not ported: its value
was in a CLI-shaped workflow with browser-MCP competitor research that does not
survive the port. Its Mode 2 (visual audit) and Mode 3 (AI-slop detection) are
kept below because they are checklists, not tooling.

## 1. Pick a direction before writing CSS

Answer these five before the first line of markup:

1. **Purpose** — what job does this interface do?
2. **Audience** — who repeats this workflow daily, and what do they scan first?
3. **Tone** — utilitarian, editorial, playful, industrial, refined, technical,
   dense, calm. Name it explicitly; "clean and modern" is not a direction.
4. **Memorable detail** — the one idea that makes the result feel intentional.
5. **Constraints** — framework, existing design system, accessibility,
   performance, responsiveness.

**Match the direction to the domain.** A SaaS operations tool should be dense,
quiet, and scannable. A portfolio, launch page, or editorial piece can be
expressive. Forcing a landing-page composition onto a tool someone uses for
six hours a day is the most common direction failure.

## 2. Implementation guidance

- Build the actual usable experience as the first screen, unless the user
  explicitly asked for marketing copy.
- Reuse the project's existing components, tokens, icon library, and routing
  before introducing a new visual system.
- Prefer contextual typography and spacing over a generic oversized hero.
- Keep palettes multi-dimensional — a UI dominated by one hue family reads as a
  template.
- Put the direction in CSS variables / existing tokens so it stays coherent
  across states rather than being retyped per component.
- Design responsive constraints explicitly: grids, aspect ratios, min/max sizes,
  toolbars, and fixed-format controls must not shift when a label grows or a
  hover state appears.
- Use motion sparingly and deliberately — high-signal transitions that clarify
  state, not decoration. See `motion-system.md` §1 for the gate.
- Verify text fit at both mobile and desktop. Long labels must wrap or resize
  cleanly, never overflow.

### Anti-patterns

- Purple gradients, decorative blobs, oversized cards, vague hero copy,
  stock-like atmospheric media.
- Cards inside cards.
- One decorative style applied everywhere when the domain calls for restraint.
- Hiding the primary product/tool/workflow behind generic marketing sections.
- Adding a dependency for a single design flourish.
- Describing the UI's features inside the UI when the controls speak for
  themselves.

## 3. Visual consistency self-audit (10 dimensions)

Score 0–10 each, with a specific example and a `file:line` fix for anything
below 7. Run this *on your own work before handing it over*, or when the user
says the UI looks off but cannot name why.

| # | Dimension | Failing looks like |
|---|---|---|
| 1 | Color consistency | Random hex values instead of the palette |
| 2 | Typography hierarchy | No clear h1 > h2 > h3 > body > caption |
| 3 | Spacing rhythm | Arbitrary values instead of a 4/8/16 scale |
| 4 | Component consistency | Similar elements that do not look similar |
| 5 | Responsive behavior | Breaks or reflows badly at a breakpoint |
| 6 | Dark mode | Half-done — some surfaces themed, some not |
| 7 | Animation | Gratuitous rather than purposeful |
| 8 | Accessibility | Contrast, focus states, touch targets |
| 9 | Information density | Cluttered, or empty and unscannable |
| 10 | Polish | Missing hover, transition, loading, or empty states |

> **Why this is not a `code-review-edho-ferdian` lens.** It produces a *score
> across dimensions*, not findings with CRITICAL/HIGH/MEDIUM/LOW severity and
> confidence labels. Feeding a 10-dimension rubric into that skill would break
> its output contract. Dimensions 8 and 10 do have review counterparts: hard
> a11y failures belong to `accessibility-lens.md` (A11Y-01..15), and missing
> loading/empty/error states belong to the CQ domain. Everything else here is
> taste, and taste stays in the authoring skill.

## 4. AI-slop detection

Signals that a UI was generated rather than designed. Any two or more of these
together is a rewrite signal, not a tweak signal:

- Gratuitous gradients on everything
- Purple-to-blue defaults
- Glassmorphism cards with no purpose
- Rounded corners on things that should not be rounded
- Animation on every scroll event
- Centered hero text over a stock gradient
- A personality-free sans-serif stack

### The four-of-ten gate

Every meaningful frontend surface should demonstrate at least four of:
scale-contrast hierarchy; intentional (non-uniform) spacing rhythm; depth via
overlap/shadow/surface/motion; typography with a real pairing strategy; colour
used semantically rather than decoratively; designed hover/focus/active states;
grid-breaking editorial or bento composition where it fits; texture or
atmosphere where it fits; motion that clarifies flow; data visualisation
treated as part of the design system.

Fewer than four, and the surface is a default with a palette applied — which
is the failure this section exists to catch.

*(adapted from ECC rules/web/design-quality.md, fetched 2026-09-06)*

## 5. Review checklist before handing off

- [ ] The first viewport immediately communicates the product, workflow, or object
- [ ] Visual hierarchy supports scanning and repeated use
- [ ] Typography fits its container and does not overlap neighbours
- [ ] Colors have contrast and do not collapse into one note
- [ ] Icons used for familiar tool actions where available
- [ ] Boards, grids, toolbars, controls, tiles, counters have stable dimensions
- [ ] Assets carry subject matter instead of acting as filler
- [ ] Motion improves orientation and does not mask sluggishness
- [ ] The result matches the repo's existing frontend conventions, or departs
      for a stated reason
