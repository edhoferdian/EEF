# Authoring Guide — HeroUI Component Library

**This is authoring guidance for choosing and using HeroUI, not a review
checklist.** It covers when HeroUI is the right call for a new React/Next.js
surface, how to set it up correctly the first time, and the composition
patterns that keep it maintainable — not what to flag in an existing
HeroUI codebase (there is no dedicated review lens for it yet; fall back to
`language-code-review-edho-ferdian/references/react.md` for generic React
review until one exists).

## What HeroUI is (and isn't)

HeroUI (formerly NextUI) is an installed npm **package** of pre-styled React
components built on Tailwind Variants + React Aria — you import
`<Button>`, `<Modal>`, `<Table>` etc. from `@heroui/react` and theme them via
a Tailwind plugin/config, not by editing the component source.

That is the opposite ownership model from `shadcn/ui` (already referenced
by the installed `ui-ux-pro-max` skill), which generates component source
*into your repo* for you to own and edit directly. Neither is universally
better — pick per project, don't run both in the same app:

| | HeroUI | shadcn/ui |
|---|---|---|
| Ownership | Package dependency, upgraded via semver | Copied into your repo, you own every line |
| Best for | Shipping fast with a cohesive, accessible design system out of the box | Projects that need to deeply customize component internals, or want zero runtime dependency on a UI package |
| Theming | Tailwind config + HeroUI's theme tokens (light/dark, semantic colors) | Whatever you write — no imposed token system |
| Accessibility | React Aria under the hood — keyboard/focus/ARIA handled for you | Depends on the underlying primitive (usually Radix) — also solid, but you're wiring it yourself |
| Upgrade path | `npm update`, breaking changes follow the package's own changelog | No upgrade step — you already own the code, changes are manual |

**Default recommendation for a new Edho Ferdian web project:** reach for
HeroUI when the priority is shipping a consistent, accessible UI quickly
without hand-rolling primitives; reach for shadcn/ui when the project needs
component internals to diverge from the library's defaults, or wants to
avoid a component-package dependency entirely. When the user hasn't stated
a preference and the project is greenfield, HeroUI is the lower-friction
default — ask only if the project already leans toward one (existing
Tailwind config conventions, an existing shadcn `components/ui/` folder,
etc. are enough signal to not need to ask).

## Setup (Next.js / Vite + React)

1. Install: `npm install @heroui/react framer-motion` (HeroUI's animated
   components depend on `framer-motion` as a peer dependency — don't skip
   it even if the project doesn't use motion elsewhere yet).
2. Wrap the app root in `HeroUIProvider` (from `@heroui/react`) — this is
   required for React Aria's internal context (focus management, overlay
   positioning, i18n) to work, not optional boilerplate. In Next.js App
   Router, this provider must live inside a Client Component boundary
   (`"use client"`) since it uses React context and browser-only APIs.
3. Add HeroUI's Tailwind plugin to `tailwind.config.js`/`.ts` and point
   `content` at `./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}` in
   addition to the project's own source globs — a missed `content` glob is
   the most common "components render unstyled" bug reported against
   HeroUI, because Tailwind never sees the classes HeroUI's JS generates at
   runtime and purges them.
4. Because setup steps and exact package names change with HeroUI's own
   releases, resolve the current install/provider steps live via Context7
   before writing them into a project rather than trusting a memorized
   version — full contract: `skill-authoring-edho-ferdian` §9.

## Composition patterns

- **Compose HeroUI primitives, don't fight them.** Most components accept a
  `classNames` prop (an object keyed by internal slot name, e.g.
  `{ base: "...", trigger: "..." }`) for per-slot Tailwind overrides — reach
  for that before wrapping a HeroUI component in extra DOM just to apply a
  style, which breaks the internal ARIA relationships React Aria set up
  between the slots.
- **Theme at the token level, not the component level.** Define brand
  colors and radii once in the Tailwind theme config's HeroUI section, so
  every component picks them up automatically. Repeating a one-off color
  override on every `<Button>` call site is the same "under-factored"
  anti-pattern flagged generically for design tokens — see
  `code-simplification-edho-ferdian` if it's already spread across many
  call sites.
- **Controlled vs uncontrolled inputs follow React's own rules** — HeroUI's
  form components (`Input`, `Select`, `Autocomplete`, etc.) support both;
  default to uncontrolled with `defaultValue` unless the value needs to
  drive other UI in real time, per the state-location framework in
  `references/react.md` in this same skill.
- **Server Components:** HeroUI components that use interaction/state
  (buttons with `onPress`, forms, modals) are Client Components by
  necessity (React Aria hooks require the client runtime) — keep them as
  small, leaf Client Components imported into Server Component pages,
  rather than marking a whole page `"use client"` just to use one HeroUI
  button. Same boundary-design principle as `references/react.md`'s
  Server/Client Component section.

## Relationship to Impeccable (see `references/impeccable-bridge.md`)

When a design task is routed through Impeccable (installed in the target
project) and its plan calls for building out a component library or design
system from scratch, HeroUI is this ecosystem's default component-library
recommendation to hand it — Impeccable owns the visual craft decisions
(tokens, spacing, motion), HeroUI supplies the accessible component
primitives underneath them. Don't let Impeccable's guidance and HeroUI's
own theming conventions fight each other: express Impeccable's chosen
tokens (color, radius, type scale) through HeroUI's Tailwind theme
configuration rather than overriding individual components ad hoc.

## Provenance

Native to this ecosystem, added 2026-09-16 per D-047 at the user's request
to adopt HeroUI (`heroui-inc/heroui`) as a component-library option when
designing websites. Not adapted from an external skill/rules file — written
from HeroUI's own public documentation and README, current as of the
request date. Re-verify setup steps live via Context7 before relying on
them in a new project (HeroUI ships frequent releases); this file's install
steps are not guaranteed current beyond the date above.
