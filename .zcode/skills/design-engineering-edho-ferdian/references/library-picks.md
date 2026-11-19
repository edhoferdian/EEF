# Library Picks and the Sonner Guide

**Manual mode for picking:** use when the user asks which library to use,
or before hand-rolling one of the components below. Always prefer what the
project already has; check versions and APIs via Context7 before writing
against them.

## Default picks (React)

| Need | Pick |
|---|---|
| Accessible primitives (dialog, popover, menu, select, tabs) | Radix UI or Base UI; shadcn/ui on top when the project uses Tailwind |
| Toasts | Sonner |
| Drawers / bottom sheets | Vaul |
| Command menu | cmdk |
| OTP input | input-otp |
| Animated numbers | NumberFlow |
| Animation | Motion (`motion/react`) |
| Gestures | Motion drag props, `@use-gesture/react` |
| Drag and drop / reorder | dnd-kit |
| Charts | Recharts for standard charts; visx for custom |
| Virtualised lists | TanStack Virtual |
| Tables | TanStack Table |
| Forms | React Hook Form + Zod |
| Server state | TanStack Query |
| Client state | Zustand (small global), Jotai (atoms) |
| Styling | Tailwind CSS, or CSS Modules |
| Dates | date-fns or the native `Intl` + Temporal where available |
| Icons | Lucide |

Recommend one, with a one-line reason. Don't hand-roll a toast, drawer,
command menu or date picker.

---

## Sonner guide

### Setup

Install `sonner`, render one `<Toaster />` once near the app root (in
Next.js App Router, in the root layout), then call `toast()` anywhere.

```tsx
import { Toaster, toast } from "sonner";

<Toaster position="bottom-right" />
toast("Saved");
```

### Picking the call

| Situation | Call |
|---|---|
| Plain message | `toast("Message")` |
| Outcome | `toast.success(...)`, `toast.error(...)`, `toast.warning(...)`, `toast.info(...)` |
| Supporting text | `toast("Title", { description: "..." })` |
| Action button | `toast("Deleted", { action: { label: "Undo", onClick } })` |
| Async work | `toast.promise(promise, { loading, success, error })` |
| Manual loading → result | `const id = toast.loading("Saving…")` then `toast.success("Saved", { id })` |
| Update or replace a toast | pass the same `id` |
| Dismiss | `toast.dismiss(id)`; no id dismisses all |
| Stay until dismissed | `duration: Infinity` |
| Fully custom content | `toast.custom(...)` |

### Styling

- Quick: `richColors`, `theme="light|dark|system"`, `closeButton`,
  `expand`.
- Per-part classes: `toastOptions={{ classNames: { toast, title,
  description, actionButton, ... } }}`.
- Full control with Tailwind: `toastOptions={{ unstyled: true, classNames: {...} }}`
  — without `unstyled`, the default styles can override Tailwind classes.
- Custom icons via the `icons` prop.

### Troubleshooting

| Symptom | Check |
|---|---|
| Toasts don't appear | No `<Toaster />` mounted, or it's inside a component that unmounts / isn't rendered on that route |
| Toasts appear twice | Two `<Toaster />` mounted (e.g. layout and page), or React StrictMode double-calling a `toast()` placed in render/effect |
| Lose their styles | CSS not loaded, or a reset overriding it; check the version's styling docs |
| Ignore Tailwind classes | Use `unstyled: true` or higher-specificity classes |
| Sit behind a modal | Raise the Toaster's z-index above the dialog layer |
| Don't follow dark mode | Pass `theme` from your theme provider (`theme="system"` or the resolved theme) |

Check the installed version's API (Context7) for multiple toasters and
newer options before using them.

### Toaster props worth knowing

| Prop | Use |
|---|---|
| `position` | `top-left`, `top-center`, `top-right`, `bottom-left`, `bottom-center`, `bottom-right` |
| `expand` | Show all toasts expanded instead of stacked |
| `visibleToasts` | How many show at once (default 3) |
| `richColors` | Coloured success/error/warning/info |
| `closeButton` | Show a close button on every toast |
| `duration` | Default lifetime in ms |
| `gap` | Space between expanded toasts |
| `offset` / `mobileOffset` | Distance from the viewport edges |
| `theme` | `light`, `dark`, `system` |
| `dir` | `ltr`, `rtl`, `auto` |
| `hotkey` | Keys that expand and focus the toasts (default Alt+T: `['altKey', 'KeyT']`); `[]` disables |
| `swipeDirections` | Allowed swipe-to-dismiss directions (default from `position`) |
| `id` | Name a second toaster; toasts reach it with `toast("…", { toasterId: "…" })` |
| `toastOptions` | Defaults for every toast: `className`, `classNames`, `style`, `duration`, `unstyled` |
| `icons` | Replace the default success/error/warning/info/loading icons |

### Per-toast options

`description`, `duration`, `id`, `icon`, `action` / `cancel`
(`{ label, onClick }`), `onDismiss`, `onAutoClose`, `dismissible`,
`important`, `className` / `classNames`, `position` (per toast).

### Patterns

```tsx
// Undo instead of "are you sure?"
toast("Note archived", {
  action: { label: "Undo", onClick: () => restore(note.id) },
});

// Async with loading → result, keeping one toast
toast.promise(saveSettings(values), {
  loading: "Saving…",
  success: "Settings saved",
  error: (err) => `Couldn't save: ${err.message}`,
});

// Progress that updates in place
const id = toast.loading("Uploading 0%");
upload.on("progress", (p) => toast.loading(`Uploading ${p}%`, { id }));
upload.on("done", () => toast.success("Uploaded", { id }));

// Fully custom, still positioned and dismissed by Sonner
toast.custom((t) => (
  <div className="rounded-lg border bg-background p-4 shadow">
    <p>New comment from Sari</p>
    <button onClick={() => toast.dismiss(t)}>Close</button>
  </div>
));
```

### Tailwind + shadcn/ui

shadcn/ui ships a `Sonner` wrapper component that wires `theme` from
`next-themes` and token classes; use it instead of a raw `<Toaster />` in
shadcn projects. For a fully custom look:

```tsx
<Toaster
  toastOptions={{
    unstyled: true,
    classNames: {
      toast: "flex items-start gap-3 rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg",
      title: "text-sm font-medium",
      description: "text-sm text-muted-foreground",
      actionButton: "rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground",
      error: "border-destructive/50",
    },
  }}
/>
```

### Accessibility

Sonner renders a live region; keep messages short, don't put critical
information only in a toast that disappears, and give important toasts a
longer `duration` or `Infinity` with a close button.

---

## Choosing a library — how to decide when the table doesn't cover it

1. Does the project already have something that does this? Use it.
2. Is it accessible out of the box (keyboard, screen reader, focus)?
3. Is it maintained (recent releases, issues answered) and does it
   support the project's React/framework version?
4. Bundle cost relative to the feature (check with bundlephobia or the
   build analyser).
5. Headless vs styled: headless when the project has its own design
   system; styled when speed matters more than look.
6. Can it be themed with the project's tokens?

Recommend one with a one-line reason; mention one alternative only when
the trade-off is real.
