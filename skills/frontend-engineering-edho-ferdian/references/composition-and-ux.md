# Authoring Guide — Focus & Interaction Craft

**Scope note.** This content overlaps heavily (roughly 80%) with
`references/react.md` in this skill — composition, hooks, state management,
and data fetching are already covered there and are not repeated here. This file now covers focus management and keyboard
interaction craft only — its former animation/transition content moved to
`references/motion-system.md` (kelompok 5, 2026-09-04), which supersedes it
with a full `motion/react` treatment (tokens, accessibility/device gating,
SSR safety, pattern catalogue, drag/gestures).

**This is UX/interaction craft, not a compliance audit.** It answers "how do
I make this transition feel right" and "how do I make this modal keyboard-
correct while I build it" — not "does this pass WCAG." For the compliance
checklist (contrast ratios, ARIA correctness, label requirements, heading
order), cross-reference `code-review-edho-ferdian/references/
accessibility-lens.md` rather than treating this file as an a11y audit.

---

## Animation and transitions

Motion authoring (tokens, springs, accessibility/device gating, SSR safety,
`AnimatePresence` patterns, drag/gesture, QA checklist) moved to
**`references/motion-system.md`** — this file now covers focus and interaction
craft only.

## Focus management

### Keyboard navigation for composite widgets

Any custom widget that behaves like a native control (a dropdown, a combobox,
a menu, a tab list) needs its own keyboard handling designed in from the
start — the browser gives you this for free with `<select>`/`<button>` but
not for a `div`-based custom widget:

```tsx
export function Dropdown({ options, onSelect }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex(i => Math.min(i + 1, options.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        onSelect(options[activeIndex])
        setIsOpen(false)
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }

  return (
    <div role="combobox" aria-expanded={isOpen} aria-haspopup="listbox" onKeyDown={handleKeyDown}>
      {/* Dropdown implementation */}
    </div>
  )
}
```

Design checklist when building a composite widget like this:

- Arrow keys move the active item **without** moving actual DOM focus for
  single-focus-point widgets (combobox, menu) — track `activeIndex` in state
  and reflect it visually + via `aria-activedescendant`, rather than calling
  `.focus()` on each option.
- `Escape` always closes/cancels, restoring the pre-open state.
- `Enter`/`Space` commits the active selection — decide up front whether
  `Enter` alone is enough or whether you also need `Tab` to commit-and-move,
  since the two are easy to conflate when building the handler.
- The full ARIA/labeling correctness for this pattern (is `combobox` the
  right role, does it need `aria-controls`, etc.) is a compliance question —
  check it against `accessibility-lens.md` once the interaction itself
  works. For the ARIA attributes and form-specific patterns behind this
  keyboard handling, see `references/accessible-authoring.md`.

### Focus trapping in modals

A modal (or any overlay that blocks interaction with the rest of the page)
needs focus contained inside it while open — otherwise `Tab` walks the user
back out into content that's visually hidden behind the overlay:

- On open, move focus to the modal itself or to its first focusable element.
  A `tabIndex={-1}` on the modal container plus a `ref.current?.focus()` in
  an effect lets the container itself receive programmatic focus even though
  it's not naturally focusable.
- While open, intercept `Tab`/`Shift+Tab` at the boundary: if focus would
  leave the last focusable element going forward, wrap it to the first; if
  it would leave the first element going backward, wrap it to the last. Most
  teams reach for a small library (`focus-trap-react`, Radix/Headless UI's
  built-in dialog primitives) for this rather than hand-rolling the boundary
  detection — hand-rolled focus traps are easy to get subtly wrong around
  dynamically-added/removed focusable children.
- `Escape` should close the modal and hand focus back (see restoration,
  below) — design this alongside the trap itself, not as an afterthought.

### Focus restoration after a modal closes

Save what had focus *before* the modal opened, and restore it when the modal
closes — otherwise focus silently drops to `<body>`, which is disorienting
for keyboard and screen-reader users alike:

```tsx
export function Modal({ isOpen, onClose, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      modalRef.current?.focus()
    } else {
      previousFocusRef.current?.focus()
    }
  }, [isOpen])

  return isOpen ? (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      onKeyDown={e => e.key === 'Escape' && onClose()}
    >
      {children}
    </div>
  ) : null
}
```

Design notes:

- Capture `document.activeElement` at the moment the modal opens, not at
  mount time — if the component is always mounted and toggled via a prop
  (as above), the effect re-runs on every `isOpen` change, which is exactly
  what you want here.
- If the triggering element can be unmounted while the modal is open (e.g. a
  row deleted from a list behind the modal), guard the restoration —
  `previousFocusRef.current?.focus()` silently no-ops on a detached element,
  which is the safe default, but consider a fallback focus target (a
  known-stable container) for that case.
- The same open/restore pattern applies to any transient overlay — a
  dropdown menu, a toast with an action button, a slide-over panel — not
  just dialog-role modals.

## Related

- `references/react.md` in this skill — component composition, state
  location, and data-fetching design that these interactions sit on top of.
- `references/motion-system.md` — the animation/transition content that used
  to live in this file.
- `references/accessible-authoring.md` — ARIA and form patterns for the
  widgets built here.
- `code-review-edho-ferdian/references/accessibility-lens.md` — the
  compliance checklist (WCAG criteria, ARIA correctness, contrast, labeling)
  for auditing these same widgets after they're built.
