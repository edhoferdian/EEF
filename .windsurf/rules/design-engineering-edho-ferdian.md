---
trigger: model_decision
description: "Make UI feel right: animation and transitions, gestures and sheets, Expo motion, interaction polish, mobile-web feel, worst-case data tests, design variants, library picks, Swift. Use when building or fixing any tampilan, halaman, landing page or komponen: \"rapikan UI\", \"animasikan ini\", \"animasinya patah-patah\", \"gak ngikutin jari\", \"kebanyakan animasi\", \"di HP rasanya aneh\", \"coba data terburuk\", \"kasih beberapa versi\"."
---

# Design Engineering — Edho Ferdian Mode

The craft layer for how an interface *feels*: motion, interaction, polish,
and the edge cases that break a layout. `frontend-engineering-edho-ferdian`
decides how the code is structured; this skill decides how the result
behaves under the user's hands.

**How to use it:** pick **one** row below, read that reference in full,
and follow it for the task — including its process and output format.
Read a second reference only when the first points to it. Don't load the
whole folder.

## Router

| The user says / needs | Read | Mode |
|---|---|---|
| One animation or transition, "animasikan ini" | `references/motion-foundations.md` (+ `motion-recipes.md`) | auto |
| Several elements move together: stagger, hero entrance, view swap | `references/choreography.md` | auto |
| Drag, swipe, sheets, snap points, "gak ngikutin jari" | `references/gestures.md` | auto |
| Any of the above in React Native / Expo, haptics | `references/expo-motion.md` (+ `expo-recipes.md` for code) | auto |
| Apple-style feel: fluid physical motion, materials, typography | `references/apple-design.md` | auto |
| Janky, stutters, drops frames | `references/animation-performance.md` | auto |
| Polish, interaction states, typography, depth, "rapikan UI" | `references/interface-polish.md` | auto |
| Web app feels wrong on a phone (100vh, hover, zoom, notch) | `references/mobile-web-native.md` | auto |
| Stress-test with worst-case data | `references/break-ui.md` | auto |
| Motion across a codebase: improve, find or remove | `references/motion-audit.md` | auto |
| "Efek ini namanya apa?" | `references/motion-vocabulary.md` | auto |
| Modern Swift, Swift 6 concurrency, native iOS | `references/swift-authoring.md` | auto |
| Strict review of animation code | `references/motion-review.md` | manual |
| "Kasih beberapa versi" — variants behind a live picker | `references/prototype-variants.md` | manual |
| Which library to use; Sonner toasts | `references/library-picks.md` | manual for picking, auto for Sonner help |
| Turn this session's design corrections into rules | `references/learn-taste.md` | manual |
| Unsure which fits | `references/design-flow.md` | — |

**Manual** rows run only when the user asks for them by name or picks one
after you route. For a vague "the motion feels off", ask whether it is
*bad*, *missing* or *too much* motion (→ `motion-audit.md`, Improve / Find
/ Remove).

## Boundaries with the rest of EEF

- **`frontend-engineering-edho-ferdian`** owns React/Next.js structure,
  state, data fetching, Vite and HeroUI, plus short `motion-system.md` /
  `ui-polish.md` guides. For motion and polish craft this skill is the
  deeper source and wins where the two disagree on a value. A new page or
  component usually needs both: structure there, feel here.
- **`code-review-edho-ferdian`** owns general review; `motion-review.md` is
  the motion-only lens it can cite.
- **`performance-audit-edho-ferdian`** owns measuring;
  `animation-performance.md` supplies motion causes and fixes. Claim a
  speedup only after measuring it.
- **`language-code-review-edho-ferdian`** (`references/swift.md`) and
  **`build-fix-edho-ferdian`** own Swift review and build errors;
  `swift-authoring.md` is for writing Swift.

## Fixed rules

- **Inline by default.** Use agents only when the user asks for them.
- **Installs are the user's call.** Propose packages; install only when the
  task is to build in that project, and match the project's package manager.
- **Current docs over memory** for library APIs (Motion, Reanimated, Expo,
  Sonner, Vaul, Swift): `skill-authoring-edho-ferdian` §9.
- **Surgical changes**: `skill-authoring-edho-ferdian` §10.
- **Extend the project's tokens** (curves, durations, spacing). A second,
  parallel set is a defect.

## Hands off to (fixed — see skill-authoring-edho-ferdian §11)

When the work reaches one of these, load that skill with the Skill tool
and follow it — don't write its part from memory.

- Component structure, state or data fetching → `frontend-engineering-edho-ferdian`
- Measuring a frame-rate problem → `performance-audit-edho-ferdian`
- Tests for the UI behaviour → `test-authoring-edho-ferdian`
- A user-journey test of the flow → `e2e-testing-edho-ferdian`
- A full review of the diff → `code-review-edho-ferdian`

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract)

Communication to the user in Bahasa Indonesia; code, comments, plans and
reports in English — fixed, never ask. Full contract:
`skill-authoring-edho-ferdian` §7.
