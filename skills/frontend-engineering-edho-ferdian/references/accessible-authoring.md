# Authoring Guide — Building Accessible React UI

Adapted from ECC `frontend-a11y`, fetched 2026-09-04.

**Pairing.** `code-review-edho-ferdian/references/accessibility-lens.md` is the
*compliance* side — WCAG 2.2 AA criteria, A11Y-01..15 findings, severities. This
file is the *authoring* side: the concrete React patterns that make code pass
that lens the first time. Same subject, opposite direction; the duplication is
intentional and each stays in its own skill's voice.

Keyboard handling for composite widgets and focus trap/restoration live in
`composition-and-ux.md` — not repeated here.

## Forms — the highest-yield area

Disconnected labels and orphaned error text are the two issues that dominate
real a11y review findings.

### Label connection

```tsx
// BAD — no programmatic association
<label>Email</label>
<input type="email" />

// GOOD
<label htmlFor="email">Email</label>
<input id="email" type="email" />
```

### Required fields

A visual asterisk conveys nothing to a screen reader. Hide it from the
accessibility tree and mark the field properly:

```tsx
<label htmlFor="email">Email <span aria-hidden="true">*</span></label>
<input id="email" type="email" required aria-required="true" />
```

### Error messages

Three attributes work together — link it, mark it invalid, announce it:

```tsx
<input
  id="email"
  type="email"
  aria-describedby={error ? "email-error" : undefined}
  aria-invalid={!!error}
/>
{error && <span id="email-error" role="alert">{error}</span>}
```

Set `aria-describedby` to `undefined` (not an id pointing at nothing) when
there is no error — a dangling reference reads as a broken description.

Also: `noValidate` on the `<form>` when you handle validation yourself, and
correct `autoComplete` values (`email`, `current-password`, `new-password`) —
they are an accessibility feature for motor and cognitive load, not just a
convenience.

## ARIA — only when native semantics run out

Wrong ARIA is worse than no ARIA. Reach for the native element first
(`<button>`, `<nav>`, `<main>`, `<ul>`, `<dialog>`); it brings role, keyboard
behavior, and focus handling for free.

| Attribute | Use when |
|---|---|
| `aria-label` | Inline string label, no visible label exists (icon-only button) |
| `aria-labelledby` | A visible label element already exists — reference its id |
| `aria-describedby` | Supplementary description beyond the label (warnings, hints, errors) |
| `aria-live="polite"` | Status that can wait for the user to finish their action |
| `aria-live="assertive"` | Urgent errors only — it interrupts |
| `aria-expanded` + `aria-controls` | Disclosure: accordion, dropdown trigger, menu button |

```tsx
export function StatusMessage({ message, isError }: { message: string; isError?: boolean }) {
  return (
    <div role="status" aria-live={isError ? "assertive" : "polite"} aria-atomic="true">
      {message}
    </div>
  )
}
```

```tsx
export function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const contentId = useId()          // useId, not a hand-rolled counter — SSR-stable
  return (
    <div>
      <button aria-expanded={isOpen} aria-controls={contentId} onClick={() => setIsOpen(v => !v)}>
        {title}
      </button>
      <div id={contentId} hidden={!isOpen}>{children}</div>
    </div>
  )
}
```

`useId()` matters here specifically: hand-generated ids differ between server
and client render and break both hydration and the ARIA reference.

## Images and icons

- Informative image → descriptive `alt`. Never start it with "Image of" /
  "Picture of" — the role is already announced.
- Purely decorative image → `alt=""` (empty, present) so it is skipped.
- Icon inside a labelled button → `aria-hidden="true"` on the SVG, label on the
  button.
- Icon-only button → `aria-label` on the button, always.

## Reduced motion at authoring time

Every animation you author needs its reduced-motion path decided in the same
edit, not retrofitted. Implementation lives in `motion-system.md` §3; the
authoring rule is simply: if you wrote `initial`/`animate`, you also wrote the
reduced branch.

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| `<div onClick>` as a button | `<button>`, or `role="button"` + `tabIndex={0}` + Enter/Space handler |
| Placeholder used as the label | Real `<label htmlFor>`; placeholder is a hint, not a name |
| Error shown only by a red border | `role="alert"` text + `aria-invalid` |
| `aria-label` on an element that already has visible label text | `aria-labelledby` referencing it |
| `aria-live="assertive"` on routine status | `polite` — assertive is for urgent errors |
| Icon-only button with no accessible name | `aria-label` |
| `tabIndex` > 0 | Fix DOM order instead; positive tabindex breaks natural focus order |

## Checklist

- [ ] Every input has a programmatically associated label
- [ ] Errors are linked with `aria-describedby` + `aria-invalid` + `role="alert"`
- [ ] Interactive elements are native, or fully role+keyboard emulated
- [ ] Dynamic regions announce via `aria-live` / `role="status"`
- [ ] All ids in ARIA references come from `useId()`
- [ ] Decorative images are `alt=""`; decorative SVGs are `aria-hidden`
- [ ] Every icon-only control has an accessible name
- [ ] No positive `tabIndex` anywhere
