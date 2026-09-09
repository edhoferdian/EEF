# Language Lens — React / JSX / TSX

**Detect.** `package.json` present with `react` or `react-dom` in
`dependencies` or `devDependencies`. Applies to `.jsx`/`.tsx` files and React
component logic in the review scope.

**Boundary — read before flagging anything.** Generic TypeScript type safety
(`any` abuse, unsafe `as` casts, strict-null violations), generic async
correctness (unhandled promise rejections, floating promises), generic
function-length/nesting/magic-number checks, and generic secret/injection
handling are **already owned by `references/review-checklist.md`** in the
general skill (CQ/SEC domains) — do not re-flag them here. This lens only
adds what is specific to **React's execution model**: hooks, the
reconciler/render cycle, and Server/Client Component boundaries.

**Accessibility cross-reference.** The general skill already has a full
`references/accessibility-lens.md` (WCAG 2.2 AA, `A11Y-##` codes) that
activates automatically for any UI/component scope, React included. Do
**not** duplicate its checklist here (labels, `alt` text, contrast, keyboard
reachability, ARIA, heading order — all already covered there). This lens
adds only the two React-specific interaction items that lens doesn't own
because they're React mechanics, not general accessibility knowledge:
`key={index}` corrupting focus/state on reorder, and
`dangerouslySetInnerHTML` as a security surface (SEC, not A11Y). If you spot
a plain accessibility issue while reviewing React code, file it under
`A11Y-##` via that lens, not here.

**Code placement.** Findings land as **CQ-10 (React anti-patterns)** or
**PERF-08 (React render performance)** in the general report — pick the
domain that matches the finding's nature, same as the database lens does for
PERF-07/SEC-04. **React-specific security items (SEC-08) have moved to
`security-review-edho-ferdian/references/language-specific.md` §React** —
this file no longer holds its own copy; see that file for
`dangerouslySetInnerHTML`, scheme validation on `href`/`src`, Server Action
validation/auth, client-bundle secret leaks (`NEXT_PUBLIC_*` etc.), token
storage, and Server/Client Component data-exposure findings. Load that file
(or delegate to the skill directly) when reviewing security.

---

## Ground-truth commands

```bash
npx eslint . --ext .tsx,.jsx                                        # confirm eslint-plugin-react-hooks is configured
npx eslint . --ext .tsx,.jsx --rule 'react-hooks/exhaustive-deps: error'
npx eslint . --rule 'jsx-a11y/alt-text: error' --rule 'jsx-a11y/anchor-is-valid: error'  # feeds accessibility-lens, not this file
npm run typecheck --if-present
tsc --noEmit -p <tsconfig>                                           # fallback if no typecheck script
npx prettier --check .
npm audit                                                            # supply-chain, general SEC domain
```

If `eslint-plugin-react-hooks` is missing or disabled in the project's
ESLint config, that absence is itself a HIGH finding (CQ-10) — hook-rule
violations that the linter would normally catch are now invisible to CI.

---

## Lens criteria

### CRITICAL

- **Conditional or early-return hook call.** A hook (`useState`, `useEffect`,
  etc.) inside `if`/`for`/`&&`/a ternary, or after an early `return` — breaks
  React's fixed call-order assumption. Flag even if `eslint-plugin-
  react-hooks` should catch it; the linter being disabled doesn't make the
  bug not exist. **CQ-10.**
- **Hook called outside a component or custom hook** — e.g. `useState` used
  inside a plain utility function. **CQ-10.**
- **Direct state mutation** — `state.push(x)` or `obj.foo = 1` followed by
  `setObj(obj)`. Mutating in place means the reference is unchanged, so React
  (and any `React.memo` child relying on `===`) never re-renders. **CQ-10.**

**React-specific security CRITICALs** (`dangerouslySetInnerHTML` with
unsanitized input, unvalidated `href`/`src` schemes, Server Action
validation/authorization gaps) moved to `security-review-edho-ferdian/
references/language-specific.md` §React — not duplicated here.

### HIGH

- **Missing or lying dependency array.** A reactive value read inside
  `useEffect`/`useMemo`/`useCallback` but absent from the dependency array —
  causes stale reads. Every `// eslint-disable-next-line
  react-hooks/exhaustive-deps` without an adjacent comment justifying it is a
  finding on its own. **CQ-10.**
- **Effect used to derive state that render should compute directly** —
  `setX(computed(props.y))` inside `useEffect([props.y])` instead of just
  computing `computed(props.y)` during render. Causes an extra render and a
  visible flash of stale state. **CQ-10.**
- **Effect missing cleanup** — subscriptions, `setInterval`, event listeners,
  or `fetch` calls with no `AbortController`, left running after unmount or
  after the effect re-fires. **CQ-10.**
- **Stale closure** — an async handler or `setInterval` callback captures a
  value from an earlier render that has since changed; fix is a functional
  state updater or a ref, not just adding the value to deps (which may
  re-create the interval instead). **CQ-10.**
- **`key={index}` on a dynamically reordered/filtered/inserted list** —
  React reuses DOM nodes and component state by key; an index key attaches
  state (input values, focus, animation) to the wrong row when the list
  changes shape. Use a stable identifier from the data. **CQ-10.**
- **`"use client"` propagation** — a client-marked file imports a whole
  subtree of components that didn't need to become client components,
  inflating the client bundle and losing server-only guarantees for
  everything it pulls in.
- **Client Component importing and rendering a Server Component directly**
  (`import ServerWidget from './ServerWidget'` inside a `"use client"` file,
  then `<ServerWidget />`) — distinct from the propagation item above: this is
  a structural boundary violation, not just a bundle-size cost. A Client
  Component's module graph runs on the client, so a Server Component can only
  cross that boundary pre-rendered, passed down via `children`/props
  composition from a Server Component parent. Direct import either fails to
  compile or silently forces the "server" component to be treated as client
  code, losing its server-only guarantees entirely. **CQ-10.**
- **Error Boundary relied on to catch event-handler or async errors** —
  `componentDidCatch`/`getDerivedStateFromError` (or a library boundary built
  on them) only catches errors thrown during rendering, lifecycle methods,
  and constructors. An error thrown inside an `onClick` handler, inside a
  `.then()`/`async` callback, in a `setTimeout`, or during SSR is invisible to
  the nearest boundary and will surface as an unhandled rejection or crash
  the process instead. Flag this as a **false-safety claim** when a component
  visibly depends on a boundary for these cases (e.g. an async submit handler
  with no local `try`/`catch`, "the ErrorBoundary will catch it" in a comment)
  — the boundary provides no protection there. **CQ-10, MEDIUM.**
- **`useEffect` + `fetch` for application data fetching** — manually wiring
  `useEffect(() => { fetch(...).then(setData) }, [dep])` for data the app
  depends on to render. This has no cache, no request de-duplication, no
  retry, and no Suspense integration, and is prone to race conditions on
  rapid re-render/re-mount (an earlier in-flight request can resolve after a
  later one and overwrite fresher state, since nothing cancels or sequences
  them). Recommend a proper data-fetching library (React Query/TanStack
  Query, SWR, RTK Query) or, on React 19+, the `use()` hook with a Suspense
  boundary instead. **CQ-10, HIGH.**

**React-specific security HIGHs** (client-bundle secret leaks via
`NEXT_PUBLIC_*`/`VITE_*`/`REACT_APP_*`, tokens in `localStorage`/
`sessionStorage`, server-only imports inside a Client Component, sensitive
full-record props passed Server→Client) moved to `security-review-edho-
ferdian/references/language-specific.md` §React — not duplicated here.

### MEDIUM

- **Over-memoization without a measured win** — `useMemo`/`useCallback`
  wrapping a cheap computation, or wrapping a value whose deps change on
  almost every render anyway, so the memoization buys nothing but adds a
  dependency-array maintenance burden.
- **New object/function literal passed inline as a prop to a memoized
  child** — defeats `React.memo` on that child every render, since the new
  reference always fails the shallow-equality check. Wrap the value in
  `useMemo`/`useCallback` at the parent instead, or lift it out of render.
- **Missing virtualization for large lists** — 50+ rendered items with
  non-trivial row content, scrolling poorly; recommend
  `react-window`/`react-virtual` or equivalent.
- **Heavy synchronous work in render with no `useMemo`** — parsing, sorting,
  or regex compilation repeated on every render for a value that doesn't
  change every render.
- **`useContext` for a high-frequency-changing value** — every consumer
  re-renders on every update; split the context or move to a store with
  selective subscriptions.
- **`useEffect` chain** — an effect sets state, which triggers another
  effect, which sets more state. Consolidate or derive during render instead
  of chaining effects.
- **Initializing state from a prop with no `key` reset** — the component
  doesn't reset when the prop changes because `useState(initialProp)` only
  reads the initial value once; fix with a `key={propValue}` on the parent or
  an explicit effect-driven reset.
- **Hand-rolled pending/error/optimistic-update state in new code (React 19+
  projects)** — manually tracking `isPending`/`isSubmitting` booleans, error
  state, and a manual optimistic-then-revert update around a form action or
  mutation, when `useActionState` (pending + error + result in one hook) or
  `useOptimistic` (optimistic value with automatic revert on failure) covers
  the same need with less state-machine surface to get wrong. Only applies
  where the project has already adopted React 19 — don't flag it as missing
  on an React 18 codebase.

---

### PERF-08 — React-specific performance

*Portions adapted from Vercel Labs `react-best-practices` (MIT).*

- **Barrel-import first-load cost** — `import { Button } from
  '@/components'` where `components/index.ts` re-exports the entire module
  graph, instead of `import { Button } from '@/components/Button'`. Even
  though only one named export is used, bundlers that don't tree-shake
  through the barrel (or dev-mode/non-optimized builds) pull in every module
  the index file re-exports, inflating the first-load bundle for a page that
  needed one component. Flag when the barrel is large (many re-exports) and
  the import site uses only a small subset. **PERF-08, MEDIUM.**
- **Sequential `await`s for independent data** — `const a = await
  fetchA(); const b = await fetchB();` when `fetchB` doesn't depend on `a` —
  an avoidable waterfall. Fix with `const [a, b] = await Promise.all([
  fetchA(), fetchB() ])`. **PERF-08, HIGH** when the calls are genuinely
  independent (verify neither awaited value is used as an input to the next
  call before flagging).
- **Manual `useMemo`/`useCallback` in a codebase that has adopted the React
  Compiler** — once a project has the React Compiler enabled (check
  `babel-plugin-react-compiler` / the `reactCompiler` config in
  `next.config.js`/`vite.config.js`), manual memoization becomes redundant
  work the compiler already does automatically, and can occasionally be
  counter-productive (a stale manual dependency array silently disagreeing
  with the compiler's own analysis). **Downgrade findings about missing
  `useMemo`/`useCallback` to review-only/INFO in Compiler-enabled projects —
  do not flag them as HIGH/MEDIUM defects.** Existing manual memoization
  found during review is not itself a defect either; note it as safe to
  remove opportunistically, not a required fix. Same caveat, carried for the
  measurement-backed audit lens, in `performance-audit-edho-ferdian/
  references/react-nextjs.md`.
- **Manual debouncing for expensive re-renders instead of
  `useDeferredValue`/`startTransition`** — a hand-rolled `setTimeout`/
  `lodash.debounce` wrapper around a state setter to avoid re-rendering an
  expensive tree on every keystroke, where React's own concurrent APIs
  (`useDeferredValue` on the derived value, or `startTransition` around the
  state update) achieve the same goal without a fixed artificial delay and
  without a manually-managed timer to clean up. Prefer the built-in pattern
  when the codebase already targets React 18+.
- **Subscribing to an external mutable store via `useEffect` + `useState`**
  — `useEffect(() => store.subscribe(() => setState(store.getState())),
  [])` can "tear": under concurrent rendering React may show inconsistent
  values for the same store across different parts of the tree during a
  single render. `useSyncExternalStore` is the correct primitive for
  subscribing to external state and avoids this class of bug.

---

## False-positive traps

- A `useEffect` with an "incomplete" dependency array that has an explicit,
  commented `eslint-disable` explaining *why* the omitted value is
  intentionally excluded (e.g. deliberately running only on mount) is a
  documented exception, not a finding — check the Reflection gate above.
- `useMemo`/`useCallback` around a value passed to a **non-memoized** child
  is not "wasted" if the value is also a dependency of another hook further
  down — the memoization prevents re-running *that* hook, not the render.
  Trace the actual consumer before flagging over-memoization.
- Class components in files you are not otherwise modifying are not a
  finding — "convert to function component" only applies when the file is
  already being changed for another reason (see the general skill's
  scope-of-change discipline).
- **Don't reflexively flag "should use Context/global store."** Apply this
  state-location decision tree before suggesting a bigger hammer than the
  code needs — reaching for the wrong rung of the ladder is its own false
  positive:
  1. **Component-local (`useState`/`useReducer`)** — default. Nothing wrong
     with local state just because a sibling might theoretically want it
     later (YAGNI).
  2. **Lift to the nearest common parent** — only when a *second*, already-
     existing component genuinely needs the same state right now, not
     speculatively.
  3. **Context** — only once prop drilling actually crosses **3+ levels** of
     components that don't themselves use the value (pure pass-through). One
     or two levels of prop drilling is not a Context finding.
  4. **External store (Redux/Zustand/Jotai/etc.)** — only when the state
     must persist across route changes/navigation, or is genuinely shared
     across otherwise-unrelated component subtrees that Context can't
     reasonably wrap. Reaching for a store below this threshold is itself
     the anti-pattern (unnecessary indirection, re-render fan-out).
  Flag a violation of this ladder in either direction — prop-drilling past
  3+ levels with no Context, *or* Context/store reached for at a lower rung
  than the ladder justifies.

**React-specific security false-positive traps** (`dangerouslySetInnerHTML`
sanitized upstream, Server Action auth via `cookies()`/`headers()` without a
named helper) moved to `security-review-edho-ferdian/references/
language-specific.md` §React — not duplicated here.

## Escalate to general domain when…

- A finding is about **TypeScript type safety** unrelated to React's runtime
  behavior (an `any` in a prop type, an unsafe cast) — that belongs to the
  general skill's Domain 1 (CQ) type-hint checks, not this lens.
- A finding is about **generic async correctness** (an unhandled promise
  rejection with no React involvement) — general Domain 1/2, not this lens.
- A finding is a **plain accessibility violation** with no React-specific
  mechanism behind it (missing `alt`, unlabeled input, contrast) — route to
  `references/accessibility-lens.md`'s `A11Y-##` codes instead of duplicating
  it here.
- A PERF finding needs actual measurement (profiler output, bundle-size
  diff, Lighthouse score) to confirm rather than static reading — escalate to
  `performance-audit-edho-ferdian` per the general skill's PERF escalation
  rule, same as any other performance claim that needs real numbers.
