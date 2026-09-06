# Language Lens — Vue / Nuxt

Adapted from ECC `vue-patterns` and `nuxt4-patterns`, fetched 2026-09-06.

**FOLD-M.** Kelompok 1 lanjutan: konten sedang, plausibel dari sumber ECC,
tapi **belum ada bukti proyek Vue/Nuxt aktif** di workspace Edho saat ini —
beda dari lens React (FOLD-P) yang sudah dipakai pada proyek nyata di
ekosistem ini. Perlakukan file ini sebagai lens siap-pakai begitu proyek
Vue/Nuxt muncul, bukan sebagai sesuatu yang sudah tervalidasi lapangan.

**One file, not two.** Nuxt 4 is folded into this same file as a
sub-section, not a separate `nuxt.md`, because ECC's own `vue-patterns`
skill already treats Nuxt as "vanilla Vue plus SSR specifics" (~85%
conceptual overlap: Composition API, reactivity, Pinia, component
architecture all apply unchanged) — splitting it would duplicate most of
§1–8 below for a thin SSR-only delta. This mirrors how `python-django.md`
requires `python.md` rather than restating Python idiom, except here the
overlap is large enough that one file with an explicit sub-section is more
honest than a "Requires" pointer to a near-identical sibling file.

**Detect.** `package.json` present and its dependencies (`dependencies` or
`devDependencies`) include `vue`. If `nuxt` is also present, load the
"Nuxt-specific" sub-section (§9) in addition to the base Vue sections —
same file, no extra load step.

**Boundary — read before flagging anything.** Generic injection, generic
secret handling, generic function-length/nesting/magic-number checks, and
generic N+1 detection are **already owned by `references/review-checklist.md`**
in the general skill. This lens adds only what is specific to **Vue 3's
reactivity system, Composition API conventions, and Nuxt's SSR/data-fetching
model** — the class of bug where the code runs, looks reasonable, and is
still wrong because of how Vue's reactivity proxy or Nuxt's server/client
boundary actually works.

**Code placement.** Findings land as **CQ-13 (Vue/Nuxt reactivity & SSR
anti-patterns)** in the general report. `v-html` with unsanitized user
content is a security finding (XSS) — route it to Domain 2 (SEC) directly,
not CQ-13, following the same split React's lens already uses for
`dangerouslySetInnerHTML`.

---

## Ground-truth commands

```bash
npx vue-tsc --noEmit            # type-checks .vue files, catches prop/emit type mismatches
npx eslint . --ext .vue,.ts,.js # catches most reactivity/template lint-detectable findings
npx vitest run                  # component/unit tests
npx playwright test             # E2E, if configured
npm run build                   # Nuxt: catches hydration-relevant build-time errors, not runtime mismatches
```

Hydration mismatches specifically are **not** reliably caught by any static
command above — they surface at runtime as a console warning
(`Hydration node mismatch`) or a visibly different first paint. A hydration
finding based on reading the code (e.g. `Date.now()` in a template) is a
valid [Medium confidence] flag; only cap it at [High confidence] if you (or
the user) actually reproduced the console warning, per the general skill's
Phase 2 rule.

---

## Lens criteria

### HIGH

- **Destructuring `defineProps()` directly (pre-Vue-3.5), or destructuring
  a `reactive()` object anywhere** — `const { count } = defineProps<...>()`
  (old Vue) or `const { x, y } = someReactiveObject` captures a plain,
  non-reactive snapshot at destructure time; the variable never updates
  again even though the source does. Fix: access via `props.count`, wrap
  with `toRefs(reactiveObj)`, or (Vue 3.5+, `defineProps` only) confirm the
  project's Vue version genuinely supports reactive props destructure
  before treating it as fine. **CQ-13.**
- **`ref` vs `reactive` misuse** — `reactive()` used for a value that gets
  wholesale-replaced (`state = { ...newState }` breaks reactivity because
  it reassigns the binding, not the tracked object) instead of `ref()`; or
  `ref()` used for a large nested object accessed by non-`.value` habit
  throughout the codebase, causing repeated `.value` bugs. The rule of
  thumb: `ref()` when the whole value may be replaced, `reactive()` only
  when the object's identity is stable and its properties mutate in place.
  **CQ-13.**
- **Watcher with no cleanup for an async or subscription side effect** — a
  `watch()` callback that starts a `fetch`, `setTimeout`, or subscription
  without cancelling the previous one when the watched value changes again
  before the callback finishes, causing a race where a stale response
  overwrites a newer one. Fix: `onWatcherCleanup()` (Vue 3.5+) or the
  watcher's own `onCleanup` callback parameter with an `AbortController`.
  **CQ-13.**
- **Direct prop mutation** — assigning to a prop inside the child component
  (`props.value = x` or, worse, mutating a nested object/array on a prop
  in place) instead of emitting an event for the parent to act on. Violates
  Vue's one-way data flow and makes state changes untraceable to their
  source. Fix: `emit('update:x', newValue)` / `defineModel()`. **CQ-13.**
- **`v-for` with `:key="index"`** on a list that can reorder, filter, or
  have items inserted/removed — Vue's diffing algorithm reuses DOM nodes by
  key, so an index key causes stale component state (form inputs showing
  the wrong value) to attach to the wrong item after a reorder. Use a
  stable identifier from the data. **CQ-13.**

### MEDIUM

- **`v-if` and `v-for` on the same element** — execution order between them
  is a documented footgun (in Vue 3, `v-if` has higher precedence, but
  relying on that instead of expressing intent clearly is still confusing).
  Prefer a computed filtered array feeding a plain `v-for`. **CQ-13.**
- **Options API used in new code in an otherwise-Composition-API
  codebase** — not wrong per se, but inconsistent; flag only when the rest
  of the codebase has clearly standardized on `<script setup>`.
- **Composable with module-scope mutable state** shared across every
  component instance that calls it, instead of state created fresh inside
  the composable function body — causes cross-component state bleed unless
  that sharing is the explicit intent (a singleton store composable), which
  should be documented if so. **CQ-13.**
- **Missing `t.Helper()`-equivalent discipline in Vue Test Utils tests** —
  N/A directly, but the analogous gap is asserting on internal component
  state (`wrapper.vm.someInternalRef`) instead of rendered output or
  emitted events — couples the test to implementation details Vue doesn't
  guarantee are stable. **Testing note, not CQ-13.**
- **`<KeepAlive>` without a `:max`** on a view set that can grow unbounded
  (e.g. cached per dynamic route param) — unbounded component cache growth.
  **CQ-13.**

---

## Nuxt-specific sub-section (§9)

**Load alongside the base sections above whenever `nuxt` is a dependency —
same file, this is not a separate lens.**

### HIGH

- **Non-deterministic value rendered into SSR-rendered template state** —
  `Date.now()`, `Math.random()`, a browser-only API (`window`,
  `localStorage`) read directly into state that affects the first-render
  markup, without gating behind `onMounted()`, `import.meta.client`,
  `<ClientOnly>`, or a `.client.vue` component. Causes a hydration mismatch
  because the server and client render different output for the same
  state. **CQ-13.**
- **Top-level `$fetch()` used for page data that should be SSR-hydrated**
  instead of `useFetch()`/`useAsyncData()` — `$fetch` alone doesn't forward
  server-fetched data into the Nuxt payload, so the client re-fetches on
  hydration (duplicate request, and a flash of loading state that
  server-rendering was supposed to avoid). **CQ-13.**
- **`useAsyncData()` handler with a side effect** (mutating global state,
  firing analytics) instead of being a pure fetcher — the handler can run
  during both SSR and hydration, so a side effect can fire twice. **CQ-13.**

### MEDIUM

- **`useRoute()`/`useFetch()` imported from `vue-router`/manually instead
  of using Nuxt's auto-imported composables** — the auto-imported versions
  are SSR-aware; the vanilla Vue Router one is not guaranteed to behave
  identically across the server/client boundary in a Nuxt app.
- **`route.fullPath` (or any URL-fragment-derived value) driving
  SSR-rendered markup** — URL fragments (`#section`) are client-only and
  not available during SSR, creating a mismatch.
- **Missing `key` on `useAsyncData()`** when the same fetcher shape is
  called from multiple places — without a stable key, Nuxt can't dedupe
  concurrent identical requests or reliably cache/refresh the right entry.
- **`ssr: false` used as a default fix for a hydration mismatch** instead
  of finding and fixing the actual non-deterministic value — an escape
  hatch for genuinely browser-only sections, not a blanket workaround.
- **Heavy, non-critical component not lazy-loaded** — a below-the-fold or
  rarely-shown component (modal, recommendations panel) imported eagerly
  instead of via the `Lazy` prefix or `hydrate-on-visible`, inflating the
  initial bundle/hydration cost for content most visits never see.

---

## False-positive traps

- Destructuring `defineProps()` is safe and intentional on Vue 3.5+ where
  the project's `package.json` pins `vue: "^3.5"` or newer — check the
  actual version before flagging; this became a supported pattern, not a
  bug, as of that release.
- `reactive()` reassignment inside the *same* composable/component that
  owns it, done via `Object.assign(state, newState)` (mutates properties in
  place rather than replacing the binding) is the *correct* way to bulk-
  update a `reactive()` object — not a finding.
- A watcher with no cleanup is not a finding if the side effect it starts
  is synchronous and can't race with a subsequent invocation (e.g. a
  synchronous local computation, not a fetch or timer).
- `v-for` with `:key="index"` on a list that is provably append-only and
  never reordered/filtered/spliced (a live log tail, for example) is a
  low-severity nit, not HIGH — cap at MEDIUM and say why.
- `ssr: false` on an `/admin/**` route-rule block, or another route group
  that is deliberately, permanently client-only by design (not a mismatch
  workaround), is the intended use of that route rule — not a finding.

## Escalate to general domain when…

- `v-html` renders content that is not provably sanitized — that's a
  Domain 2 (SEC) finding (XSS), not CQ-13; state it there.
- The finding is about test coverage or test *quality* beyond Vue-specific
  mechanics — Domain 5 (`test-quality-lens.md`).
- A performance claim about bundle size or render cost needs profiling
  evidence (Lighthouse, `vite-bundle-visualizer`, Vue DevTools timeline) to
  confirm — escalate to `performance-audit-edho-ferdian` rather than
  asserting from code reading alone.
