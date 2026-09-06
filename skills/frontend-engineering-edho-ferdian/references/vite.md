# Authoring Guide — Vite Configuration

Adapted from ECC `vite-patterns`, fetched 2026-09-04. A short Turbopack
configuration note at the end is adapted from ECC `nextjs-turbopack`, fetched
2026-09-04.

**Scope note.** Two items from `vite-patterns` are deliberately **not**
repeated here because a parallel session folded them into other skills as
review-checkable/security items: the `VITE_` env-var leakage boundary and the
`loadEnv('')` trap (→ `security-review-edho-ferdian`), and the "`vite build`
does not type-check" gap (→ `build-fix-edho-ferdian`). This file covers the
rest of `vite-patterns` — the configuration and authoring material.

---

## How Vite works (context for the config decisions below)

- **Dev mode** serves source files as native ESM — no bundling. Transforms
  happen on-demand per module request, which is why cold starts are fast and
  HMR is precise.
- **Build mode** uses Rolldown (v7+) or Rollup (v5–v6) to bundle for
  production with tree-shaking, code-splitting, and Oxc-based minification.
- **Dependency pre-bundling** converts CJS/UMD deps to ESM once via esbuild
  and caches the result under `node_modules/.vite`, so subsequent starts
  skip the work.
- **Plugins share one interface across dev and build** — the same plugin
  object drives both the dev server's on-demand transforms and the
  production pipeline.

## Plugin ecosystem — reach for these before writing your own

| Plugin | Purpose | When to use |
|---|---|---|
| `@vitejs/plugin-react-swc` | React HMR + Fast Refresh via SWC | Default for React apps (faster than the Babel variant) |
| `@vitejs/plugin-react` | React HMR + Fast Refresh via Babel | Only if you need Babel plugins (Emotion, MobX decorators) |
| `@vitejs/plugin-vue` | Vue 3 SFC support | Vue apps |
| `vite-tsconfig-paths` | Honors `tsconfig.json` `paths` aliases | Any time you already have aliases in `tsconfig.json` — don't hand-roll `resolve.alias` entries that duplicate them |
| `vite-plugin-dts` | Emits `.d.ts` files in library mode | Publishing TypeScript libraries |
| `vite-plugin-svgr` | Imports SVGs as React components | React apps using SVGs as components |
| `rollup-plugin-visualizer` | Bundle treemap/sunburst report | Periodic bundle-size audits (use `enforce: 'post'`) |
| `vite-plugin-pwa` | Zero-config PWA + Workbox | Offline-capable apps |
| `vite-plugin-inspect` | Inspect the transform pipeline | Debugging why a plugin is slow or transforming unexpectedly |

Design decision: authoring a custom plugin is rare — most needs are already
covered by the table above. When you do need one, start it inline in
`vite.config.ts` and only extract to its own file/package once it's reused
in a second project.

```typescript
// vite.config.ts — minimal inline plugin
function myPlugin(): Plugin {
  return {
    name: 'my-plugin',          // required, must be unique
    enforce: 'pre',              // 'pre' | 'post' (optional)
    apply: 'build',              // 'build' | 'serve' (optional)
    transform(code, id) {
      if (!id.endsWith('.custom')) return
      return { code: transformCustom(code), map: null }
    },
  }
}
```

Key hooks when authoring one: `transform` (modify source), `resolveId` +
`load` (virtual modules — use the `\0` prefix convention, e.g. `resolveId`
returns `'\0virtual:my-id'` so other plugins skip it while user code imports
`'virtual:my-id'`), `transformIndexHtml` (inject into HTML),
`configureServer` (add dev middleware).

### `hotUpdate` replaces `handleHotUpdate` in Vite 7+

If you're authoring a plugin with custom HMR behavior, use the `hotUpdate`
hook — `handleHotUpdate` is deprecated as of Vite 7. Design new plugins
against `hotUpdate` directly rather than starting from older examples that
still use `handleHotUpdate`; don't port the old hook name into new plugin
code even if a reference tutorial still shows it.

## HMR for vanilla modules

Framework plugins handle HMR automatically for components. Reach for
`import.meta.hot` directly only when building custom state stores, dev
tools, or framework-agnostic utilities that need to persist state across
updates:

```typescript
// src/store.ts — manual HMR for a vanilla module
if (import.meta.hot) {
  // Persist state across updates (must MUTATE, never reassign .data)
  import.meta.hot.data.count = import.meta.hot.data.count ?? 0

  // Cleanup side effects before the module is replaced
  import.meta.hot.dispose((data) => clearInterval(data.intervalId))

  import.meta.hot.accept()
}
```

Design it to mutate `import.meta.hot.data` properties, not reassign the
object itself — reassignment loses the persisted state on the next update.
All `import.meta.hot` code is tree-shaken out of production builds
automatically, so no build-time guard is needed around it.

## Server proxy setup

```typescript
// vite.config.ts
server: {
  proxy: {
    '/foo': 'http://localhost:4567',                    // string shorthand

    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,                               // needed for virtual-hosted backends
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
}
```

Add `ws: true` to a route's config object when proxying WebSocket traffic
through the same route.

## `server.host: true` for Docker and containers

Vite binds to `localhost` by default, which is unreachable from outside a
container. Set this up from the start of any containerized dev workflow
rather than debugging "why can't I reach the dev server" later:

```typescript
// vite.config.ts
server: {
  host: true,                    // bind 0.0.0.0
  hmr: { clientPort: 3000 },     // set when the dev server sits behind a reverse proxy
}
```

## Monorepo file access — `server.fs.allow`

Vite restricts file serving to the project root by default. In a monorepo,
packages outside that root (a shared UI library, shared types) get blocked
with a "not in allowed dir" error the first time you import from them.
Configure this proactively when setting up a new package in a monorepo,
rather than reactively once the error appears:

```typescript
// vite.config.ts
server: {
  fs: {
    allow: ['..'],   // allow the parent directory (workspace root)
  },
}
```

Prefer the narrowest path that covers the actual shared packages you import
from over a blanket `['/']` — `fs.allow` exists as a guardrail against
serving arbitrary filesystem paths to the dev server, so widen it only as
far as the monorepo layout actually requires.

## `server.warmup` — pre-transform hot-path routes

`server.warmup.clientFiles` pre-transforms known hot entry points before the
browser requests them, eliminating the cold-load request waterfall on large
apps. Design this in for any app where the entry point pulls in a
predictable, expensive chain of route files:

```typescript
// vite.config.ts
server: {
  warmup: {
    clientFiles: ['./src/main.tsx', './src/routes/**/*.tsx'],
  },
}
```

Include the app's actual first-navigation routes here, not just the entry
file — the goal is to warm the files a real user's first page load will
request, not just the bootstrap module.

## `vite --profile` for diagnosing a slow dev server

When `vite dev` feels slow to start or to hot-reload, don't guess at the
cause — profile it:

```bash
vite --profile
# interact with the app to trigger the slow behavior, then press p+enter
# to save a .cpuprofile
```

Load the resulting `.cpuprofile` in [Speedscope](https://www.speedscope.app)
to see which plugin hook is eating time — usually `buildStart`, `config`, or
`configResolved` in a community plugin. This is the diagnostic step to reach
for before reflexively disabling plugins one at a time to find the slow one.

## Library mode — the peer-dependency externalization footgun

When publishing an npm package with `build.lib`, two things need deciding
up front, not discovered after a consumer reports a bug:

1. **Types are not emitted by default** — add `vite-plugin-dts`, or run
   `tsc --emitDeclarationOnly` as a separate step in your publish pipeline.
2. **Every peer dependency must be explicitly externalized.** Anything not
   listed in `rolldownOptions.external` gets bundled straight into your
   library's output. For a UI library depending on `react`, this means the
   library ships its own copy of React inside its bundle — a consumer app
   then ends up with two React runtimes (their own, plus the one bundled
   into your library), which breaks hooks, context, and anything relying on
   a single React instance (`Invalid hook call` is the typical symptom).

```typescript
// vite.config.ts
build: {
  lib: {
    entry: 'src/index.ts',
    formats: ['es', 'cjs'],
    fileName: (format) => `my-lib.${format}.js`,
  },
  rolldownOptions: {
    external: ['react', 'react-dom', 'react/jsx-runtime'],  // every peer dep
  },
}
```

Design rule: whenever you add a new `peerDependencies` entry to the package,
add the matching entry to `external` in the same change — treat these two
lists as one thing that must stay in sync, not two independent edits.

## Mitigating stale chunks after a deploy

New builds produce new content-hashed chunk filenames. A user with an
already-open tab that later triggers a dynamic `import()` (route-based code
splitting, a lazy-loaded component) will request the *old* filename — which
no longer exists once a new deploy has replaced `dist/`. Vite has no
built-in fix; design one of these into the app's deploy/runtime setup ahead
of time:

- **Keep the previous deploy's `dist/assets/` files live** for a deployment
  window (a few hours to a few days, depending on how long sessions stay
  open) so old chunk requests still resolve during the overlap.
- **Catch the dynamic-import failure in your router** and force a full page
  reload when it happens — most routers' lazy-loading APIs let you wrap the
  `import()` call or hook into its rejection; on catching a "failed to fetch
  dynamically imported module" error, do `window.location.reload()` rather
  than showing a broken route.

Pick at least one of these before the first production deploy of an app with
code-splitting — retrofitting it after users start hitting the error in the
wild is strictly worse than designing it in from the start.

## Manual chunking for vendor bundles

```typescript
// vite.config.ts — build.rolldownOptions
build: {
  rolldownOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom'],
        'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-popover'],
      },
    },
  },
}
```

Group by actual co-change/co-use patterns (framework runtime, a UI kit used
app-wide), not by splitting every `node_modules` package into its own chunk
— that produces hundreds of tiny files and more request overhead than it
saves.

## Environment variable loading order (for authoring `.env` setups)

Vite loads `.env`, `.env.local`, `.env.[mode]`, and `.env.[mode].local` in
that order, with later files overriding earlier ones. Design new env setups
around this convention directly: put anything mode-specific in
`.env.[mode]`, and anything local-only/secret in a `.local` variant (already
gitignored by Vite's default scaffold). See `security-review-edho-ferdian`
for the `VITE_` prefix security boundary and the `loadEnv('')` trap — this
file only covers the loading/authoring mechanics, not the security rule.

## Quick reference

| Pattern | When to use |
|---|---|
| `defineConfig` | Always — provides type inference |
| `vite-tsconfig-paths` | Instead of hand-rolled `resolve.alias` entries |
| `optimizeDeps.include` | CJS deps causing interop issues |
| `server.proxy` | Route API requests to a backend in dev |
| `server.host: true` | Docker, containers, remote access |
| `server.fs.allow` | Monorepo packages outside the project root |
| `server.warmup.clientFiles` | Pre-transform hot-path routes |
| `build.lib` + `rolldownOptions.external` | Publishing npm packages |
| `manualChunks` (object form) | Vendor bundle splitting |
| `vite --profile` | Diagnose a slow dev server |
| `hotUpdate` | Custom HMR in a plugin (Vite 7+; not `handleHotUpdate`) |

---

## Turbopack (Next.js) — a different bundler, brief configuration note

*Adapted from ECC `nextjs-turbopack`, fetched 2026-09-04.*

Turbopack is Next.js's own Rust-based bundler, not Vite — it's included here
because Next.js projects often ask the same "how do I configure my dev
build tool" question this file answers for Vite projects. Beyond the two
items already covered elsewhere (the `middleware.ts` → `proxy.ts` rename in
Next.js 16+, and Turbopack being the dev default from Next.js 16), the
configuration-relevant points worth knowing when setting up a Next.js
16+ project:

- **File-system caching is on by default** and needs no configuration for
  basic use — restarts reuse previous work (cache typically under `.next`),
  which is most of why cold starts are faster than webpack's. If a restart
  feels slow, check that nothing in your setup is clearing `.next` between
  runs (a broad `clean` script, an aggressive CI cache-bust) before assuming
  Turbopack itself is slow.
- **Escape hatch if a plugin/loader is webpack-only:** run dev with
  `--webpack` (flag name varies by exact Next.js release — check the docs
  for the version in use) rather than blocking the whole team on a
  Turbopack-incompatible dependency. Treat this as temporary — track
  removing the flag once the blocking dependency adds Turbopack support.
- **Bundle Analyzer (Next.js 16.1+)** ships an experimental analyzer for
  inspecting production output and finding heavy dependencies — enable it
  via the experimental config flag documented for your exact Next.js
  version rather than reaching for a third-party bundle-visualizer plugin
  first, since the built-in one is already wired to Next.js's own output.

## Related

- `security-review-edho-ferdian/references/*` — `VITE_` prefix boundary,
  `loadEnv('')` trap, and other env/secret handling rules for Vite projects.
- `build-fix-edho-ferdian` — the `vite build` type-checking gap and other
  build-failure resolution.
