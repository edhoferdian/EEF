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
