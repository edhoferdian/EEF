# React / Next.js performance reference — measurement-requiring patterns

Portions adapted from Vercel Labs react-best-practices (MIT), via ECC
react-performance, fetched 2026-09-04.

Sibling to `references/web-frontend.md` — that file already covers Core Web
Vitals budgets, general algorithmic complexity, the base React re-render
patterns (`useCallback`/`useMemo`/stable keys), basic bundle-analyzer tooling,
heap-snapshot diffing, and Lighthouse CI gating. This file adds the
React/Next.js-specific content from `react-performance` that isn't already
there: request waterfalls, RSC-era data-fetching patterns, and a few newer
React APIs. As with the rest of this skill, these are measurement-requiring
findings — confirm with a profiler trace, a network waterfall, or a
bundle-size diff before treating any of them as a real regression, not a
static-reading guess.

---

## Request-waterfall patterns

The #1 category from `react-performance`: every sequential `await` on
independent data adds a full network round-trip to the critical path.
Confirm with a network waterfall (DevTools Network tab, or your APM's trace
view) before flagging — a waterfall that's genuinely serial by necessity
(step 2 needs step 1's result) is not this finding.

```ts
// BAD — sequential, no dependency between the two calls
const user = await getUser(id);
const posts = await getPosts(id);

// GOOD — Promise.all for independent work
const [user, posts] = await Promise.all([getUser(id), getPosts(id)]);
```

**Defer await until it's actually used.**

```ts
// BAD — awaits before deciding whether the value is even needed
const user = await getUser(id);
if (mode === "guest") return renderGuest();
return renderUser(user);

// GOOD — cheap sync check first, await only on the path that needs it
if (mode === "guest") return renderGuest();
const user = await getUser(id);
return renderUser(user);
```

**Start early, await late — for partial dependencies.**

```ts
// GOOD — kick off every promise immediately, await only when each result
// is actually needed, so independent work overlaps in flight
const userP = getUser(id);
const postsP = getPosts(id);
const profile = await getProfile(id);
if (profile.private) return null;
const [user, posts] = await Promise.all([userP, postsP]);
```

**RSC parallel data-fetching via component composition.** A single Server
Component with two sibling `await`s runs them sequentially even if they're
independent — React doesn't parallelize awaits inside one component body.
Splitting the fetches into sibling child components lets React's renderer
run them in parallel instead:

```tsx
// BAD — sibling awaits inside one component run sequentially
export default async function Page() {
  const user = await getUser();
  const cart = await getCart();
  return <View user={user} cart={cart} />;
}

// GOOD — split into children; React renders them in parallel
export default async function Page() {
  return (
    <View>
      <UserSection />
      <CartSection />
    </View>
  );
}
```

---

## Barrel-import cost on first-load JS

A barrel `index.ts` that re-exports an entire module graph forces the
bundler to walk (and, in dev-mode or non-tree-shaking builds, ship) every
re-exported module — even when the import site only uses one named export.

```ts
// BAD — pulls in the whole components module graph
import { Button } from "@/components";

// GOOD — direct import, only this one file is loaded
import { Button } from "@/components/Button";
```

Confirm with a bundle-size diff (`source-map-explorer` / `webpack-bundle-
analyzer`, per `references/web-frontend.md`'s Bundle optimization section)
before flagging as a real cost — Next.js 13.5+'s `optimizePackageImports`
config automates this for listed packages, so check that config before
recommending a manual rewrite.

---

## Request-level memoization: `React.cache()` vs a manual LRU / `unstable_cache`

Two different caching problems, easy to conflate:

- **`React.cache()`** dedupes calls **within a single request/render pass**.
  If three Server Components in the same render each call `getUser(id)`
  wrapped in `cache()`, that's one DB query, not three. Use it for
  per-request deduplication of the same lookup called from multiple places.

  ```ts
  import { cache } from "react";
  export const getUser = cache(async (id: string) => {
    return db.user.findUnique({ where: { id } });
  });
  ```

- **A manual LRU cache, or Next.js `unstable_cache`,** is for data that does
  **not** change per request — config, lookup tables, anything safe to reuse
  **across** requests. `React.cache()` does not help here; it resets every
  request. Reaching for `React.cache()` on cross-request-stable data (or the
  reverse — an LRU/`unstable_cache` wrapper on data that's genuinely
  per-request) is the finding: match the caching primitive to whether the
  data varies within a request or across requests.

---

## Next.js `after()` for non-blocking post-response work

Work that doesn't need to complete before the response is sent — logging,
cache warming, analytics — can run after the response via Next.js 15+'s
`after()`, instead of `await`-ing it inline and adding it to the user-facing
latency:

```ts
import { after } from "next/server";

export async function GET() {
  const data = await getData();
  after(() => logAnalytics(data));   // runs after the response is sent
  return Response.json(data);
}
```

Flag inline `await logAnalytics(data)` (or any non-blocking side-effect
awaited before `return`) ahead of the response as a candidate for `after()`
once the project's Next.js version supports it.

---

## `content-visibility: auto` for long off-screen lists

```css
.row { content-visibility: auto; contain-intrinsic-size: auto 80px; }
```

Tells the browser to skip layout/paint work for rows currently off-screen —
a major win for lists with hundreds of rows, cheaper than manual
virtualization for cases where exact scroll-position tracking isn't needed.
`contain-intrinsic-size` should approximate the row's real rendered height,
or scrollbar sizing will be visibly wrong.

---

## `<Activity>` for show/hide instead of mount/unmount

React 19 introduces `<Activity mode="visible" | "hidden">`, which keeps a
subtree's component state and effects alive while hidden, instead of the
unmount/remount cost of conditionally rendering the tree. Useful for tabs,
accordions, or any UI that's toggled frequently enough that repeated
mount/unmount (losing scroll position, form state, or expensive-to-rebuild
child state each time) is itself the performance problem. Only applies on
React 19+ — verify the installed React major before recommending it.

---

## `useDeferredValue` / `startTransition` for expensive re-renders

Prefer React's built-in concurrent APIs over a hand-rolled debounce when the
goal is "don't re-render an expensive tree on every keystroke":

```tsx
// BAD — hand-rolled debounce with a manually-managed timer
const [query, setQuery] = useState("");
useEffect(() => {
  const t = setTimeout(() => setDeferredQuery(query), 200);
  return () => clearTimeout(t);
}, [query]);

// GOOD — useDeferredValue, no timer to manage, no fixed artificial delay
const deferredQuery = useDeferredValue(query);
const results = useMemo(() => expensiveSearch(deferredQuery), [deferredQuery]);
```

`startTransition` is the sibling API for marking a state update itself as
low-priority (rather than deferring a derived value):

```tsx
const [pending, startTransition] = useTransition();
startTransition(() => setFilters(newFilters));
```

Prefer either over a `setTimeout`/`lodash.debounce` wrapper on a state
setter once the codebase already targets React 18+.

---

## React Compiler caveat — downgrade, don't flag, manual memoization

Once a project has adopted the React Compiler (check for
`babel-plugin-react-compiler` or a `reactCompiler` config entry in
`next.config.js`/`vite.config.js`), manual `useMemo`/`useCallback`
optimization becomes work the compiler already does automatically.

**In a Compiler-enabled project, downgrade any "missing `useMemo`/
`useCallback`" finding to review-only / informational — do not raise it as a
HIGH or MEDIUM missing-optimization defect.** Existing manual memoization
found during review is not a defect either; note it as safe to remove
opportunistically, not a required fix. A stale manual dependency array can
occasionally disagree with the compiler's own analysis, which is worth a
mention, but the absence of manual memoization is no longer itself a
finding once the compiler is doing that job.

This caveat is cross-referenced from `language-code-review-edho-ferdian/
references/react.md`'s PERF-08 section, which carries the same rule for the
static-review lens; this file carries it for the measurement-backed audit
lens.

---

## Stacks planned

None — this file is React/Next.js-specific and sits alongside
`web-frontend.md` rather than a per-stack roadmap.
