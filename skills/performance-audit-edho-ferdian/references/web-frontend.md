# Web/frontend performance reference (JS/React/Next)

Adapted from ECC `performance-optimizer`, fetched 2026-09-04. This is the
JS/React/Next-biased content ECC's original agent led with — kept as-is in
substance since it matches Edho's actual stack, restructured into the
measure-then-fix phases of `SKILL.md`.

---

## Core Web Vitals budget

| Metric | Target | Remediation if exceeded |
|--------|--------|--------------------------|
| First Contentful Paint (FCP) | < 1.8s | Optimize the critical rendering path; inline critical CSS; reduce render-blocking resources. |
| Largest Contentful Paint (LCP) | < 2.5s | Lazy-load below-the-fold images; optimize server response time (TTFB); preload the LCP resource; use a CDN for static assets. |
| Time to Interactive (TTI) | < 3.8s | Code-split; reduce total JavaScript shipped; defer non-critical scripts. |
| Cumulative Layout Shift (CLS) | < 0.1 | Reserve space (explicit width/height or aspect-ratio) for images/embeds/ads; avoid inserting content above existing content; avoid layout-triggering animations. |
| Total Blocking Time (TBT) | < 200ms | Break up long tasks (>50ms) into smaller chunks; move heavy work to a Web Worker; defer non-essential JS. |
| Bundle Size (gzipped) | < 200KB | Tree-shake; lazy-load routes/components; replace heavy libraries with lighter alternatives (see Bundle optimization below). |

Measure with `npx lighthouse <url> --view` (interactive) or `--output=json
--output-path=./lighthouse.json` (machine-readable, for a saved baseline and
for CI gating). Use `--preset=desktop` when the target audience is
desktop-majority; otherwise the default mobile throttling profile is the more
representative baseline.

Real-user monitoring, when instrumented, corroborates the lab measurement
above — Lighthouse is a single synthetic run and can miss variance across
real devices/networks:

```typescript
// web-vitals v4 API
import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';

onCLS(reportToAnalytics);
onINP(reportToAnalytics);  // Interaction to Next Paint — supersedes FID
onLCP(reportToAnalytics);
onFCP(reportToAnalytics);
onTTFB(reportToAnalytics);
```

---

## Algorithmic complexity

Bad pattern → better-complexity replacement. Confirm the actual input size
in production before treating any of these as a real bottleneck — an O(n²)
loop over 20 items is not worth touching; the same pattern over 50,000 is.

| Pattern | Complexity | Better alternative |
|---------|------------|---------------------|
| Nested loops scanning the same data | O(n²) | Build a `Map`/`Set` once, then O(1) lookups. |
| Repeated array search (`.find`/`.filter` per item in a loop) | O(n) per search → O(n²) total | Group into a `Map` once outside the loop, then O(1) per lookup. |
| Sorting inside a loop | O(n² log n) | Sort once outside the loop. |
| String concatenation in a loop | O(n²) (due to repeated copies) | Accumulate into an array and `array.join('')` once. |
| Deep-cloning large objects repeatedly | O(n) per clone, paid every iteration | Shallow-copy where sufficient, or use a structural-sharing approach (e.g. `immer`). |
| Recursion without memoization on overlapping subproblems | O(2^n) | Add memoization (a cache keyed by input) or convert to iterative DP. |

```typescript
// BAD: O(n^2) — searching the array inside the loop
for (const user of users) {
  const posts = allPosts.filter(p => p.userId === user.id); // O(n) per user
}

// GOOD: O(n) — group once with a Map
const postsByUser = new Map<number, Post[]>();
for (const post of allPosts) {
  const list = postsByUser.get(post.userId) ?? [];
  list.push(post);
  postsByUser.set(post.userId, list);
}
// O(1) lookup per user from here on
```

### React-specific patterns

```tsx
// BAD: new function identity every render
<Button onClick={() => handleClick(id)}>Submit</Button>
// GOOD: stable callback
const handleButtonClick = useCallback(() => handleClick(id), [handleClick, id]);
<Button onClick={handleButtonClick}>Submit</Button>

// BAD: new object identity every render
<Child style={{ color: 'red' }} />
// GOOD: stable reference
const style = useMemo(() => ({ color: 'red' }), []);
<Child style={style} />

// BAD: expensive computation re-run every render
const sortedItems = items.sort((a, b) => a.name.localeCompare(b.name));
// GOOD: memoized
const sortedItems = useMemo(
  () => [...items].sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);

// BAD: index as key — breaks reconciliation on reorder/insert
{items.map((item, index) => <Item key={index} />)}
// GOOD: stable unique key
{items.map(item => <Item key={item.id} item={item} />)}
```

React measurement checklist before claiming a render issue is fixed: profile
with React DevTools Profiler before and after — count renders and their
duration, don't just apply `useMemo`/`useCallback` everywhere and assume it
helped (an unnecessary `useMemo` on a cheap computation can itself cost more
than it saves).

---

## Bundle optimization

```bash
npx source-map-explorer build/static/js/*.js   # composition of the actual production build
npx webpack-bundle-analyzer                    # interactive treemap
du -sh node_modules/* | sort -hr | head -20     # largest installed packages
```

| Issue | Fix |
|-------|-----|
| Large vendor bundle | Tree-shake; replace with a smaller alternative. |
| Duplicate dependencies (two versions of the same package) | Dedupe via lockfile / resolutions field; extract to a shared module. |
| Unused exports shipped in the bundle | Remove with `dead-code-cleanup-edho-ferdian` (knip), then re-measure. |
| Moment.js | Replace with `date-fns` or `dayjs`. |
| Full `lodash` import | Import only what's used (`lodash/debounce`) or switch to `lodash-es` for tree-shaking. |
| Full icon library import | Import only the specific icons used. |

```javascript
// BAD
import _ from 'lodash';
import moment from 'moment';

// GOOD
import debounce from 'lodash/debounce';
import { format, addDays } from 'date-fns';
```

---

## Heap-snapshot diffing (memory leak detection)

Methodology — comparing two snapshots incorrectly is the most common way
this measurement produces a false conclusion, so follow this order exactly:

1. Load the app to a stable, idle state (no pending network requests,
   animations settled).
2. Open Chrome DevTools → Memory tab → take **Snapshot 1** (the baseline).
3. Perform the suspected-leaking action **multiple times** (not once) —
   e.g. open and close a modal 10 times, navigate to a route and back 10
   times. A single repetition can be masked by normal allocation noise; a
   real leak shows a growing trend across repetitions.
4. Force garbage collection (the trash-can icon in DevTools Memory tab)
   before the second snapshot — otherwise you're measuring uncollected
   garbage, not a leak.
5. Take **Snapshot 2**.
6. In DevTools, select Snapshot 2 and use the **"Comparison"** view against
   Snapshot 1 — this shows objects that were allocated and NOT freed between
   the two snapshots, which is what a real leak looks like (not just "more
   memory used", which can be legitimate caching).
7. Sort by `# Delta` / retained size; look specifically for: detached DOM
   nodes (a strong leak signal — DOM nodes removed from the tree but still
   referenced from JS), event listener counts that grew, and closures
   retaining large objects.

Common source patterns to check once a leak is confirmed by the diff above:

```typescript
// BAD: listener never removed
useEffect(() => {
  window.addEventListener('resize', handleResize);
}, []);
// GOOD
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);

// BAD: timer never cleared
useEffect(() => {
  setInterval(() => pollData(), 1000);
}, []);
// GOOD
useEffect(() => {
  const interval = setInterval(() => pollData(), 1000);
  return () => clearInterval(interval);
}, []);

// BAD: closure captures a large value directly, keeping it alive
const Component = () => {
  const largeData = useLargeData();
  useEffect(() => {
    eventEmitter.on('update', () => console.log(largeData));
  }, [largeData]);
};

// GOOD: ref indirection avoids re-subscribing / re-capturing on every change
const largeDataRef = useRef(largeData);
useEffect(() => { largeDataRef.current = largeData; }, [largeData]);
useEffect(() => {
  const handleUpdate = () => console.log(largeDataRef.current);
  eventEmitter.on('update', handleUpdate);
  return () => eventEmitter.off('update', handleUpdate);
}, []);
```

Node.js side: `node --inspect app.js`, open `chrome://inspect`, same
snapshot-comparison methodology as above.

---

## Lighthouse CI gating

Approach: run Lighthouse against a budget in CI so a regression fails the
build instead of shipping silently.

```bash
npx lighthouse https://your-app.com --output=json --output-path=./lighthouse.json
npx lighthouse https://your-app.com --only-categories=performance
```

```json
// package.json — bundle-size budget enforced separately from Lighthouse's own score
{
  "bundlesize": [
    { "path": "./build/static/js/*.js", "maxSize": "200 kB" }
  ]
}
```

Wire the Core Web Vitals budget table above into a CI assertion (Lighthouse
CI's `assertions` config, or a custom script parsing the JSON output) so a
build fails when a metric regresses past its budget row, not just when the
overall score drops below an arbitrary threshold — the per-metric budget is
more actionable than a single composite score.

---

## Red flags — act immediately, don't wait for a scheduled audit

| Signal | Action |
|--------|--------|
| Bundle > 500KB gzip | Code-split, lazy-load, tree-shake now. |
| LCP > 4s | Optimize the critical path, preload the LCP resource. |
| Memory usage trending upward across repeated actions | Run the heap-snapshot diff methodology above immediately. |
| CPU spikes during a user action | Profile with Chrome DevTools Performance tab, find the long task. |
| A single DB query > 1s | Add an index, optimize the query, or cache the result — cross-reference `database-lens.md`. |
