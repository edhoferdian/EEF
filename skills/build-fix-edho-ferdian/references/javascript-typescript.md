# JavaScript / TypeScript — build & compile lens

This file merges general JS/TS build-error diagnostics with React-specific
build diagnostics into one file because both cover the same JS/TS/Node/
bundler runtime with overlapping scope; keeping them separate would just
duplicate the tsconfig and dependency-duplication material.

Scope: TypeScript type errors, JavaScript/JSX/TSX compile errors, bundler
configuration failures (Vite/Next.js/Rsbuild/CRA/webpack/Parcel/Bun),
hydration mismatches, and Next.js App Router server/client boundary errors.

## Build-system detection ladder

Run in order, stop at the first match — strongest signal (config file) over
weak signal (folder convention):

```bash
test -f next.config.js -o -f next.config.ts -o -f next.config.mjs   # Next.js
test -f vite.config.js -o -f vite.config.ts -o -f vite.config.mjs   # Vite
test -f rsbuild.config.js -o -f rsbuild.config.ts                   # Rsbuild
grep -l "react-scripts" package.json                                # CRA
test -f webpack.config.js -o -f webpack.config.ts                   # webpack
{ test -f .parcelrc || grep -q '"parcel"' package.json; }          # Parcel
{ test -f bunfig.toml && grep -q '"bun"' package.json; }           # Bun
```

## Diagnostic commands

```bash
# Type errors, independent of the bundler
npx tsc --noEmit --pretty
npx tsc --noEmit --pretty --incremental false   # force full re-check, no cache

# Respect what the project actually has configured — try these before a
# raw bundler invocation
npm run build --if-present
pnpm build 2>/dev/null
yarn build 2>/dev/null
bun run build 2>/dev/null

# Bundler-specific, once detected above
next build                          # Next.js
vite build                          # Vite
react-scripts build                 # CRA
webpack --mode=production           # webpack
parcel build src/index.html         # Parcel
bun build ./src/index.tsx --outdir=dist

# Lint (only as a supporting signal, never the primary build gate)
npx eslint . --ext .ts,.tsx,.js,.jsx
```

## Resolution workflow

```
1. Run build             -> capture full error output, unedited
2. Identify the layer     -> TypeScript / bundler config / runtime / hydration
3. Read affected file     -> understand context before editing
4. Apply minimal fix      -> only what the error demands
5. Re-run build           -> verify; a NEW error is a fresh diagnosis
6. Run tests if present   -> confirm the fix didn't regress behavior
```

## Common TypeScript / type-system errors

| Error | Cause | Fix |
|---|---|---|
| `implicitly has an 'any' type` | Missing type annotation, usually on a parameter or destructured value | Add the explicit type annotation |
| `Object is possibly 'undefined'` | Access on a value the type system can't prove is present | Optional chaining `?.`, or a narrowing `if` guard before the access |
| `Property 'X' does not exist on type 'Y'` | Missing interface/type field, or accessing a narrower type than the runtime shape | Add the field to the interface, or use an optional `?:` if it's genuinely sometimes absent |
| `Cannot find module 'X' or its corresponding type declarations` | tsconfig path alias not resolved, package not installed, or wrong relative import path | Check `tsconfig.json` `paths`, run the package manager's install, or correct the import path — check all three before picking one |
| `Type 'X' is not assignable to type 'Y'` | Value shape mismatch | Parse/convert the value to the expected type, or correct the target type if it was too narrow |
| Generic constraint failure (`Type 'X' does not satisfy the constraint`) | Type argument doesn't meet a generic's `extends` bound | Add/adjust the `extends { ... }` constraint, or pass a type argument that satisfies it |
| `Hook called conditionally` / `React Hook "X" is called conditionally` | A hook is called inside an `if`/loop/early return | Move the hook call to the unconditional top level of the component/hook, gate the *logic inside it* instead |
| `'await' expression is only allowed within an async function` | Missing `async` on the enclosing function | Add `async` to the function signature |

## JSX / TSX compile

| Error | Cause | Fix |
|---|---|---|
| `'React' is not defined` | Old JSX transform expects `import React from 'react'` | Set `"jsx": "react-jsx"` in `tsconfig.json` for the new transform, or add the import back for the legacy transform |
| `Cannot find module 'react' or its corresponding type declarations` | Missing `@types/react`/`@types/react-dom` | Install the matching `@types/*` packages |
| `JSX element type 'X' does not have any construct or call signatures` | Component prop type mismatch | Confirm the import is actually the component, not a default-vs-named mismatch |
| `Module '"react"' has no exported member 'X'` | `@types/react` major doesn't match installed `react` major | Align the `@types/react` major to the installed `react` major |
| `Unexpected token '<'` | No JSX loader/transformer configured for the bundler | Add `@vitejs/plugin-react` (Vite), `babel-loader` + `@babel/preset-react` (webpack), or the framework's equivalent |
| `JSX must have one parent element` | Adjacent JSX siblings with no wrapper | Wrap in a fragment `<>...</>` |

## tsconfig / JSX-transform matrix mismatches

| Symptom | Fix |
|---|---|
| `"jsx"` unset | Set `"jsx": "react-jsx"` for React 17+, `"react"` for the legacy transform |
| `"esModuleInterop"` missing | Add `"esModuleInterop": true` when anything does `import React from 'react'` |
| `"moduleResolution"` outdated | Set `"moduleResolution": "bundler"` for Vite/Next 13+ |
| Path aliases not resolving at build time even though the IDE resolves them | Sync `tsconfig.json` `paths` with the bundler's own alias config — `vite-tsconfig-paths` for Vite, `resolve.alias` for webpack, automatic for Next.js |

## "Cannot find module" — the three real causes

Don't guess which one applies — check in this order, cheapest first:

1. **tsconfig path alias not mirrored in the bundler config** — the IDE
   resolves it via `tsconfig.json` `paths` but the bundler doesn't know
   about the alias.
2. **Package genuinely not installed** — check `node_modules` and the
   lockfile, not just `package.json` (a `package.json` entry with no
   matching install is still this failure mode).
3. **Wrong relative import path** — case-sensitivity mismatch (fails on
   Linux CI, passes locally on a case-insensitive filesystem), wrong
   `../` depth, or a moved/renamed file the import wasn't updated for.

## Bundler-specific

### Vite

- Missing `@vitejs/plugin-react` in the `plugins` array of `vite.config.ts`
- `optimizeDeps.include` needed for CJS-only dependencies that Vite's
  dependency pre-bundler doesn't detect automatically
- `define: { 'process.env.NODE_ENV': '"production"' }` needed for libraries
  written assuming a Node-style `process.env`

**`vite build` does not type-check.**
Vite transpiles TypeScript but never runs the type checker — a build can
succeed and ship type errors silently. If the project has neither
`vite-plugin-checker` configured nor a separate `tsc --noEmit` step in CI,
that absence is itself a finding worth flagging on its own — the same shape
as flagging a missing `eslint-plugin-react-hooks` configuration elsewhere in
this ecosystem's lenses: the gap is invisible until something ships broken,
so call it out proactively rather than waiting for a type error to surface
as a runtime bug.

### Next.js App Router

| Error | Cause | Fix |
|---|---|---|
| `You're importing a component that needs useState` (or another client hook) in a Server Component | Hook used without the client boundary declared | Add `"use client"` as the file's first line, or move the hook into a Client Component child |
| `Module not found: Can't resolve 'fs'` in a file the client bundle includes | Server-only module (`fs`, `path`, DB clients) leaked into client-bundled code | Remove the server-only import from the client-bundled file, or move that logic into a Server Component / Route Handler |
| `Error: Functions cannot be passed directly to Client Components` | A plain function prop crossed the server→client boundary | Wrap it as a Server Action (`"use server"`) and pass that instead |
| Build succeeds but a `server-only` import error appears at runtime | `server-only` package correctly caught a leak | Same fix as the `fs` row — move the import server-side |

**Middleware file rename (Next.js 16+).** Next.js 16 renamed the root middleware file from
`middleware.ts` to `proxy.ts`. On a Next.js 16+ project, a `proxy.ts` at the
project root is correct and intentional — **do not flag it as a misnamed or
missing middleware file**, and do not "fix" it by renaming it back to
`middleware.ts`; that rename silently breaks middleware execution on Next
16+ with no build error to catch it. Check the installed Next.js major
before applying either convention.

**Turbopack vs webpack.** Turbopack is the Next.js 16 dev default
(`next dev`), with incremental file-system caching under `.next/cache` that
makes restarts much faster. If a build failure looks Turbopack-specific
(reproduces only under the default dev command, references a Turbopack
internal, or clears up when the cache is wiped), `next dev --webpack` is the
escape hatch to confirm whether the failure is Turbopack-specific before
digging further — not a general fallback to reach for by default.

### webpack

- Missing `babel-loader` rule for `.jsx`/`.tsx`
- `resolve.extensions` missing `.tsx`/`.jsx`
- `IgnorePlugin` regex too broad, silently dropping a needed module
- Source-map plugin misconfigured, causing an out-of-memory build

### CRA (Create React App)

CRA is unmaintained — if the project has room to move, recommend migrating
to Vite or Next.js rather than continuing to patch it. For an existing CRA
build:

- `react-scripts` version drift against the installed `react` major
- Missing `browserslist` field/env, causing transform-target mismatches
- Custom webpack via `craco`/`react-app-rewired` silently shadowing CRA's
  own defaults

### Parcel / esbuild / Bun

Same detection-then-diagnostic-command approach as above — run the
project's own build script first (`parcel build`, `bun build`, or the
`package.json` script), read the actual error, don't assume it's
JSX-transform-shaped just because the others usually are.

## Hydration-mismatch taxonomy

Root cause is always: server-rendered HTML differs from what the client
renders on first paint. Distinct causes, check in this order:

1. **Non-deterministic values evaluated during render** — `Date.now()`,
   `Math.random()`, `new Date().toLocaleString()` (locale/timezone differs
   server vs. client). Fix: compute in `useEffect` and render a stable
   placeholder on first pass.
2. **Browser-only API access during render** — `window`, `document`,
   `localStorage`, `navigator`. Fix: gate trivial reads with
   `typeof window !== 'undefined'`, move stateful reads into `useEffect`.
3. **CSS-in-JS without SSR wiring** — `styled-components` needs
   `ServerStyleSheet`, Emotion needs `extractCritical`; missing either
   causes a flash/mismatch on class names.
4. **Invalid HTML nesting** — `<div>` inside `<p>`, `<a>` inside `<a>`.
   Browsers silently auto-correct this during parsing, so the DOM the
   browser builds differs from what React expects to reconcile against.
5. **User-agent-dependent content rendered on the server** — anything
   branching on `navigator.userAgent` or viewport size during the initial
   render. Fix: move the branch into `useEffect` so it only runs client-side.

## Duplicate-React-instance "Invalid hook call"

```bash
npm ls react            # should show exactly ONE resolved version
npm ls @types/react      # check this aligns with the installed react major
npm dedupe               # consolidate duplicates first, cheapest fix
```

If a library throws on hook usage with no obvious conditional-hook cause in
your own code, assume duplicated React before anything else — `npm ls react`
confirms or rules it out in one command. Fix with `resolutions`/`overrides`
in `package.json` to force a single resolved copy. When upgrading is the
real fix, upgrade `react` and `react-dom` **together, as a pair, matching
majors** — never bump one without the other.

## Tailwind / PostCSS pipeline

- Missing entries in `tailwind.config.js`'s `content` array → styles compile
  to nothing, no error, just missing CSS (check this first when "the build
  passes but styles are missing")
- `@tailwind base; @tailwind components; @tailwind utilities;` missing from
  the CSS entry file
- PostCSS plugin order: `tailwindcss` must run before `autoprefixer`

## Cache-clear recovery

Try in this order — cheapest first, and **do not run the last one silently**:

```bash
# 1. Clear bundler/framework cache only
rm -rf .next/cache .vite node_modules/.cache && npm run build

# 2. Auto-fix what ESLint can fix on its own
npx eslint . --fix

# 3. LAST RESORT — ask the user first, never run this unprompted:
#    it deletes and reinstalls the entire dependency tree, which can mask
#    or introduce version drift the user didn't ask for.
rm -rf node_modules package-lock.json && npm install
```

## Angular / Nx

Scope: Angular compiler/build failures and Nx monorepo build
issues, layered on top of the general TypeScript diagnostics above (an
Angular build failure is still a `tsc`-shaped failure underneath — check the
generic TypeScript table first, then this section for what's Angular- or
Nx-specific).

### Angular ↔ TypeScript version matrix

`ng build` fails outright — not just with a lint warning — when the
installed TypeScript version falls outside the range `@angular/compiler-cli`
declares as a peer dependency for that Angular major. Angular has shipped a
new major roughly every 6 months with each one bumping its supported
TypeScript ceiling, so **do not rely on memorized version numbers** — they
drift every Angular release. Confirm the exact supported range for the
installed Angular version with:

```bash
npm view @angular/compiler-cli@<installed-angular-version> peerDependencies
# or, once node_modules exists:
cat node_modules/@angular/compiler-cli/package.json | grep -A3 peerDependencies
ng version   # prints the resolved Angular + TypeScript versions side by side
```

Typical symptom when the pair is mismatched:

```
This version of CLI is only compatible with Angular versions ...
Error: Version mismatch: TypeScript X.X.X is not supported by the Angular
compiler; supported versions are Y.Y.Y - Z.Z.Z.
```

Fix: install a TypeScript version inside the declared peer range (`npm
install typescript@"<range>"`), or upgrade Angular to a major that supports
the TypeScript version already in use — never silently downgrade or upgrade
either package without checking the peer-range compatibility first, since a
mismatched pair can also produce confusing *downstream* type errors that
look unrelated to versioning.

### NG0203 — injection context error

```
NullInjectorError / NG0203: inject() must be called from an injection context
```

Cause: `inject()` (or a DI-consuming API built on it) called from a method
body, callback, `setTimeout`, promise `.then()`, or any code path executing
after the constructor/field-initializer phase has completed for that
component/service/directive/pipe. This is a **runtime** error, not always a
compile-time one — `ng build` may succeed and the app can still throw
NG0203 the first time the offending code path executes.

Fix, in order of preference:
1. Move the `inject()` call to a field initializer or the constructor body.
2. If the dependency is genuinely needed later, inject an `Injector` at
   construction time and use `runInInjectionContext(injector, () =>
   inject(X))` at the point of use.
3. For a reusable utility function meant to be called only from injection
   context, guard it with `assertInInjectionContext()` so misuse fails with
   a clear message instead of a generic NG0203.

See `language-code-review-edho-ferdian/references/angular.md` for the
review-time (not just build-fix) version of this same criterion.

### Standalone-vs-NgModule import mismatch

```
Error: NG0304: 'app-my-component' is not a known element
Component X is standalone, and cannot be declared in an NgModule.
Directive/pipe X is not standalone and cannot be imported directly into a
standalone component.
```

Two directions this fails:
- A standalone component/directive/pipe imported into an `@NgModule`'s
  `declarations` array (standalone types go in `imports`, never
  `declarations`).
- A non-standalone (declared-in-a-module) component imported directly into a
  standalone component's `imports` array — it must be imported via the
  `NgModule` that declares it instead, or that component needs to be
  converted to standalone first.

Fix: check whether the failing type is standalone (`standalone: true`, or no
`standalone` flag on Angular 17+ where it's the default) and place it in the
correct array (`imports` for standalone, the owning `NgModule`'s
`declarations`/`exports` otherwise).

### "Cannot determine module for class"

```
Error: Cannot determine the module for class MyComponent in .../my.component.ts!
Add MyComponent to the NgModule to fix this error.
```

Usually one of:
1. The component is declared in an `NgModule` that itself was never
   imported anywhere reachable from the bootstrap module/route tree —
   check the module import chain, not just the immediate module.
2. The component is standalone but something (often a test's
   `TestBed.configureTestingModule`) is trying to declare it the
   NgModule way — standalone components go in `imports`, not
   `declarations`, in a `TestBed` config too.
3. A stale Angular Language Service / IDE cache reporting an error that
   `ng build`/`ng test` doesn't actually reproduce — reproduce via the CLI
   before trusting an IDE-only error.

### Nx cache — stale build/test results

Nx aggressively caches task outputs (`build`, `lint`, `test`) keyed by a
hash of inputs. A stale or corrupted cache entry can make `nx affected`
report success (or an unrelated failure) against code that has since
changed in a way the hash didn't capture (e.g. an env var or a file outside
the declared inputs).

```bash
npx nx reset              # clears the local Nx cache and daemon state
npx nx run-many -t build --skip-nx-cache   # force a cache-bypassed run to compare
npx nx affected -t lint,test               # standard CI-equivalent gate — run before trusting a green local build
```

Reach for `nx reset` when: a fix was applied but `nx affected` still reports
the old failure, or a build passes locally but fails in CI with no code
difference — cache staleness is the first thing to rule out before assuming
a real environment difference. Don't reach for it reflexively on every
failure; it clears legitimate caching benefits too.

## Anti-suppression reminders specific to this stack

- Never add `@ts-ignore`/`@ts-expect-error` without an inline comment
  explaining exactly why it's a false positive, and never as a blanket
  file-level `// @ts-nocheck`.
- Never widen a type to `any` just to silence an error — narrow the real
  type or add the missing guard instead.
- Never disable an ESLint rule project-wide to clear one warning; scope any
  necessary disable to the single line with a comment.
