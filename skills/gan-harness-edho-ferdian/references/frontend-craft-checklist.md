# Frontend craft checklist — catching AI-slop

This is the shared reference the Evaluate phase applies during **Step 3C
(Design audit)** and the Generate phase skims during **"Avoiding AI-slop —
quick reference"**. It backs the `design` and `craft` components of the
weighted rubric (`design*0.3 + craft*0.3 + originality*0.2 +
functionality*0.2` — see `references/evaluate-phase.md`). Nothing here is
generic "make it look nice" advice — every item names a concrete pattern to
catch and a concrete alternative to check for instead.

**Use this both ways**: the Generate phase self-checks against it before
calling an iteration done; the Evaluate phase scores against it and cites the
specific item number/name when marking an issue, not a vague "looks
AI-generated."

## Why this exists

A generated UI can be functionally correct and still read as obviously
AI-made. That gap is what the `design` and `craft` axes exist to catch — and
what a lenient evaluator tends to wave through because "it works." The
patterns below are the recurring tells. None of them are hard to fix
individually; the failure mode is leaving all of them in place at once
because no single one seemed worth stopping for.

## 1. Generic visual defaults (the "design" axis)

> **Remediation target**: `frontend-engineering-edho-ferdian/references/
> design-direction.md` — §1-2 (picking a direction, anti-patterns) and §4
> (AI-slop detection, the four-of-ten gate) cover exactly the failure modes
> below from the authoring side. When scoring an item here as Critical/Major,
> point the Generate phase at that file's matching section instead of just
> the score.

### 1.1 Gradient backgrounds as a default choice
- **Generic**: a purple-to-blue or teal-to-pink gradient (`#667eea` →
  `#764ba2` is the single most recognizable offender) slapped on a hero
  section, a CTA button, or the page background with no relationship to the
  product's content or palette.
- **Acceptable**: a gradient that uses colors from the spec's actual
  palette, is subtle (low contrast between stops, or used only as a texture
  accent), and appears because it serves a specific visual goal — not
  because it's the fastest way to make a flat section "feel designed."
- **Check**: does removing the gradient change anything about how the
  product reads, or was it decoration with no connection to brand/content?

### 1.2 Uncustomized component-library theming
- **Generic**: shadcn/ui, Material UI, Bootstrap, or Chakra components used
  with their out-of-the-box color tokens, default border radius, default
  font stack, and default spacing scale — visibly identifiable as "the
  library's demo site" rather than this product.
- **Acceptable**: the library's *structure* (accessible primitives, focus
  management, composition patterns) is kept, but its design tokens
  (`--primary`, `--radius`, font family, spacing scale) are overridden to
  match the spec's design direction.
- **Check**: could you swap this screen into the component library's own
  documentation site without anyone noticing? If yes, theming wasn't done.

### 1.3 Stock hero sections
- **Generic**: "Welcome to [App Name]" as an `<h1>`, a generic subhead like
  "The best way to manage your [thing]," and a single centered CTA button —
  the exact shape of a thousand SaaS templates.
- **Acceptable**: hero copy that's specific to what this product actually
  does or who it's for, laid out with a structure that reflects a real
  layout decision (asymmetry, a real product screenshot/illustration doing
  work, secondary content that isn't just filler).
- **Check**: does the headline say anything that would be false for a
  different, unrelated product if you swapped the app name? If it's still
  true, it's generic.

### 1.4 Placeholder stock imagery
- **Generic**: Unsplash/Pexels-style generic lifestyle photography, generic
  icon-font icon sets used at default size/weight/color with no relation to
  content, or obviously-placeholder avatar images (identical grey circles,
  identical default silhouettes) left in a "finished" state.
- **Acceptable**: illustration/photography that's either sourced with
  intent (matches subject matter, consistent style across the app) or
  replaced with something generated/drawn for this product; if placeholders
  are unavoidable for a fast prototype, they're visually distinct enough to
  not be mistaken for real content and are called out as such in the
  generator-state file.

### 1.5 Uniform card grids for non-uniform content
- **Generic**: every content type — a blog post, a product, a user profile,
  a notification — rendered as an identical card: image on top, title,
  two-line description, one button, repeated in a grid regardless of
  whether the content actually has that shape.
- **Acceptable**: card layout reflects what the content actually is —
  different content types get different information density, and a single
  card type is used only when the underlying content really is uniform
  (e.g., a product catalog).
- **Check**: pick two different content types on the page — do their cards
  differ in anything beyond the text inside them?

## 2. Interaction states (the "craft" axis — this is the section most often skipped)

> **Remediation target**: `frontend-engineering-edho-ferdian/references/
> ui-polish.md` (CSS-level hover/active/transition-scope/hit-area craft),
> `composition-and-ux.md` (keyboard navigation, focus trapping/restoration —
> the Focus row and the "Keyboard navigation" bullet below), and
> `accessible-authoring.md` (the Error and Focus rows — form error messages,
> ARIA, reduced motion). Same pairing as §1: this section scores the gap,
> those files show how to close it.

Every interactive element needs a defined answer for **each** of these
states. "It works when I click it" only covers one of seven. Score an
element down for *every* missing state, not just the first one found.

| State | What "handled" means | Generic/missing version |
|---|---|---|
| **Default** | Matches the design system's resting visual language | — |
| **Hover** | A real, deliberate visual change (color shift, elevation, underline, icon reveal) distinct from default | Browser default outline only, or literally no visible change |
| **Focus** | A visible, high-contrast focus ring or equivalent — keyboard users must be able to tell where they are | `outline: none` with nothing substituted (an accessibility failure, not just a polish gap) |
| **Active/pressed** | A distinct pressed state (scale-down, darker shade, inset shadow) confirming the click registered | Identical to hover, or no feedback at all |
| **Disabled** | Visually distinct (reduced opacity/desaturation) *and* actually non-interactive (no click handler firing, no focus stop) | Looks enabled but silently does nothing, or looks disabled but is still clickable |
| **Loading** | A real async-in-progress indicator (spinner, skeleton, disabled+label change) that appears for actions that take real time | Instant state jump with no indicator, so the UI looks broken during any real latency |
| **Empty** | A designed empty state: explains what would be here, why it's empty, and offers a next action (not just silence) | A blank container, a bare "No data" string, or a broken layout because the component assumed content would always exist |
| **Error** | Specific to what happened (validation message tied to the field, a real failure reason) and tells the user what to do next | A generic "Something went wrong" toast/banner with no detail and no recovery action |

Additional interaction checks beyond the table:
- **Keyboard navigation**: Tab order is logical, Enter/Space activate
  controls, Escape closes overlays/modals, focus is trapped inside an open
  modal and restored to the trigger element on close.
- **Form validation timing**: state explicitly whether validation is
  inline-as-you-type, on-blur, or on-submit — and confirm it matches what
  the interaction actually needs (e.g., password strength should be
  inline; email format is usually fine on-blur).
- **Repeated/rapid actions**: double-clicking a submit button doesn't fire
  two submissions; rapid toggling doesn't desync visual state from actual
  state.

## 3. Consistency checks

> **Remediation target**: `frontend-engineering-edho-ferdian/references/
> design-direction.md` §3 (the 10-dimension visual-consistency self-audit —
> color, typography, spacing, component, responsive, dark mode, animation,
> a11y, density, polish map near 1:1 onto the bullets below) and
> `motion-system.md` §2 (tokens/springs instead of inline numbers, for the
> animation-consistency case).

- **Color**: the same semantic color (e.g., "destructive") renders
  identically everywhere it's used — not a different red on the delete
  button than on the error banner.
- **Typography hierarchy**: heading levels are visually distinct and used
  in document order (no `<h1>` styled smaller than an `<h3>` elsewhere), body
  text and captions have a clear, consistent size/weight relationship.
- **Spacing**: padding/margin values come from a scale (e.g., 4/8/12/16/24/32),
  not arbitrary one-off pixel values scattered per component.
- **Border radius**: one radius scale used consistently — not `4px` on one
  card and `12px` on a visually identical sibling.
- **Responsive behavior**: check 375px, 768px, and 1440px explicitly (per
  `references/evaluate-phase.md` Step 3C) — look for overflow, orphaned
  single-column-in-a-three-column-grid elements, and touch targets that
  shrink below ~44px on mobile.

## 4. Originality signal (separate axis, but craft-adjacent)

> **Remediation target**: `frontend-engineering-edho-ferdian/references/
> design-direction.md` §1 ("pick a direction before writing CSS" — purpose/
> audience/tone/memorable-detail/constraints) and §4's four-of-ten gate,
> which is the authoring-side version of the originality bar below.

- Does the layout make a specific decision beyond "centered column of
  cards," or is it the default shape any prompt to any generator would
  produce?
- Does the copy sound like it was written for this product, or could it be
  pasted into a competitor's landing page unchanged?
- Is there at least one deliberate visual choice (a distinctive type
  pairing, an unusual but functional layout, a real illustration/motif) that
  a screenshot of this app couldn't be mistaken for a generic template?

## How to use this during evaluation

When writing a Critical/Major/Minor issue in the feedback file (see
`references/evaluate-phase.md` Step 5), cite the specific item from this
checklist (e.g., "1.2 — shadcn defaults untouched: buttons still use the
default `--primary` blue, not the spec's `#1A5D3A`") rather than a vague
"design feels generic." That's what keeps feedback actionable instead of
just critical.
