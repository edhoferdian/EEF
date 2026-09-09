# Conditional Lens — Accessibility

**Activation.** This lens runs only when Phase 0 detects the review scope
touches UI/component/frontend code — JSX/TSX, Vue/Svelte components, HTML
templates, or a native UI layer (SwiftUI, Jetpack Compose, etc.). If the
scope is backend-only, skip this file entirely.

**Goal.** Every reviewed UI surface should be Perceivable, Operable,
Understandable, and Robust (POUR) — usable by people relying on screen
readers, keyboard/switch navigation, voice control, or who need more time,
more contrast, or a larger target to interact reliably. This lens targets
**WCAG 2.2 Level AA**.

**Code placement.** Findings from this lens use their own `A11Y-##` codes
(below) rather than folding into CQ/SEC/PERF — accessibility issues aren't a
natural fit for any of those four domains and deserve to be visibly grouped.

---

## A11Y checklist (WCAG 2.2 AA, POUR-organized)

### Perceivable

- **A11Y-01 Text alternatives** — all non-text content (images, icons,
  icon-only buttons) has an equivalent text alternative (`alt`, `aria-label`,
  or visually-hidden text).
- **A11Y-02 Contrast** — text meets 4.5:1 contrast; UI components and
  meaningful graphics meet 3:1.
- **A11Y-03 Reflow** — content remains functional and doesn't require 2D
  scrolling when zoomed to 400% / reflowed to a narrow viewport.
- **A11Y-04 Color-only information** — information isn't conveyed by color
  alone (e.g. a form error shown only as a red border, a status shown only
  as a colored dot with no label/icon/text).

### Operable

- **A11Y-05 Keyboard accessible** — every interactive element is reachable
  and operable via keyboard alone (no mouse-only handlers).
- **A11Y-06 Focus order & visibility** — focus order is logical (matches
  visual/reading order); focus indicators are visible with sufficient
  contrast; **SC 2.4.11 Focus Not Obscured** — a focused element must not be
  entirely hidden by other content (sticky headers, cookie banners).
- **A11Y-07 Target size** — interactive elements are at least 24×24 CSS
  pixels, or have sufficient spacing from adjacent targets — **SC 2.5.8
  Target Size (Minimum)**.
- **A11Y-08 Pointer gestures** — any drag or multipoint gesture has a
  single-pointer alternative.
- **A11Y-09 No keyboard traps** — a user who tabs into a component (modal,
  menu) can tab back out of it.

### Understandable

- **A11Y-10 Predictable** — navigation and component identification are
  consistent across the app/site.
- **A11Y-11 Input assistance** — form errors are clearly identified with a
  suggestion for how to fix them, not just a color change or a generic
  "invalid" message.
- **A11Y-12 Redundant entry** — **SC 3.3.7** — the user isn't asked to
  re-enter the same information twice within one process (e.g. re-typing an
  address already captured earlier in the same flow) unless there's an
  essential reason (e.g. re-entering a password for confirmation).
- **A11Y-13 Heading order** — headings don't skip levels (an `h2` directly to
  an `h4`) in a way that breaks screen-reader document-outline navigation.

### Robust

- **A11Y-14 Name/Role/Value** — custom interactive elements (a `div`
  behaving as a button, a custom dropdown) expose the correct ARIA role,
  accessible name, and state so assistive tech can identify and operate them.
- **A11Y-15 Status messages** — dynamic content changes (form submission
  result, live-updating counters, toast notifications) are announced via
  `aria-live` or an equivalent, not silently updated in the DOM.

---

## Cross-platform equivalents

When the reviewed surface is native rather than web, the same criteria apply
through different attributes. Do not skip this lens because the code is not JSX.

| Feature | Web (HTML/ARIA) | iOS (SwiftUI) | Android (Compose) |
|---|---|---|---|
| Primary label | `aria-label` / `<label>` | `.accessibilityLabel()` | `contentDescription` |
| Secondary hint | `aria-describedby` | `.accessibilityHint()` | `semantics { stateDescription }` |
| Action role | `role="button"` | `.accessibilityAddTraits(.isButton)` | `semantics { role = Role.Button }` |
| Live updates | `aria-live="polite"` | `.accessibilityLiveRegion(.polite)` | `semantics { liveRegion = LiveRegionMode.Polite }` |

**Target size differs by platform.** A11Y-07's 24×24 CSS px is the web floor
(WCAG 2.2 SC 2.5.8). Native platform guidance is stricter — 44×44 pt on iOS,
48×48 dp on Android. Judge a native surface against its platform figure, not
the web one.

---

## Anti-pattern table

| Anti-pattern | Why it fails |
|---|---|
| `div`/`span` with `onClick` and no keyboard handler or `role` | Not reachable or operable by keyboard/screen-reader users — clicking is the only way in. |
| Unlabeled form inputs | A screen reader announces nothing meaningful for the field; users can't tell what to enter. |
| Missing `alt` text (or `alt=""` on meaningful images) | Screen reader either skips genuinely informative content or reads a raw filename. |
| External link opened in a new tab without `rel="noopener"` | `window.opener` lets the new page access and redirect the opening page (tabnabbing) — this is also a SEC finding, cross-reference SEC-01. |
| Heading order skips (e.g. `h2` → `h4`) | Breaks screen-reader users' ability to navigate the page by heading outline. |
| Color-only status/error indication | Colorblind users and anyone on a low-contrast/grayscale display get no signal at all. |
| "Click here" / "Read more" link text with no context | Screen-reader users often navigate by pulling a list of links out of context; non-descriptive text is meaningless in that list. |
| Fixed-size containers that clip content on zoom/reflow | Breaks SC 1.4.10 (Reflow) — content becomes inaccessible at higher zoom levels needed by low-vision users. |
| Auto-playing media with sound | Distracting or disorienting for users with cognitive disabilities; can drown out screen-reader audio. |
| Icon-only button with no accessible name | Invisible to screen readers — announced as "button" with no indication of what it does. |
| `alt` text starting with "Image of…" / "Picture of…" | The role "image" is already announced — the prefix is redundant noise on every single image. |
| Modal that traps focus but has no `Escape` / close route | Focus containment without an escape route is a keyboard trap (SC 2.1.2) — A11Y-09, not a fix for it. |

---

## Severity guidance

- 🔴 **CRITICAL** — a core user flow (checkout, sign-up, primary CTA) is
  completely unreachable by keyboard or screen reader.
- 🟠 **HIGH** — a keyboard trap; a missing accessible name on a primary
  action button; contrast failure on body text; color-only error indication
  on a form that blocks submission.
- 🟡 **MEDIUM** — target size below minimum on a secondary action; heading
  order skip; redundant entry in a multi-step flow.
- 🔵 **LOW** — missing `rel="noopener"` on a low-risk external link; minor
  focus-order oddity that doesn't block completion.
- ⚪ **INFO** — a stylistic suggestion (e.g. slightly better link text) with
  no functional accessibility barrier.
