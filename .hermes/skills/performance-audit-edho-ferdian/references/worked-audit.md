# Worked Audit — measure, fix, re-measure (with numbers)

Three slow things from one app, each taken through the loop. The point is
the evidence trail: a baseline, one change, the same measurement again.
Numbers are illustrative; your report uses the ones you measure.

## Case A — "Halaman produk lama kebukanya" (web frontend)

### Baseline

```bash
npx --yes lighthouse https://staging.example.com/produk/kopi --preset=desktop --output=json --output-path=./lh-before.json --quiet
npx --yes lighthouse https://staging.example.com/produk/kopi --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate --output=json --output-path=./lh-before-mobile.json --quiet
node -e 'const r=require("./lh-before-mobile.json").audits;for(const k of ["largest-contentful-paint","total-blocking-time","cumulative-layout-shift"])console.log(k, r[k].displayValue)'
```

```text
largest-contentful-paint 4.8 s
total-blocking-time 620 ms
cumulative-layout-shift 0.21
```

### Diagnose

- LCP element = hero image (Lighthouse "largest-contentful-paint-element"):
  2.1 MB JPEG, not preloaded, lazy-loaded.
- TBT: bundle analysis shows a 310 KB chart library on a page with no
  chart.

```bash
ANALYZE=true npm run build      # @next/bundle-analyzer
```

- CLS: reviews widget loads late and pushes content down.

### Fix (one at a time, re-measure after each)

```tsx
<Image src={hero} alt="Kopi Arabika Gayo" priority sizes="(max-width: 768px) 100vw, 50vw" />   // was loading="lazy", 2.1 MB JPEG
const PriceChart = dynamic(() => import("./PriceChart"), { ssr: false });                       // only on /statistik
<div className="min-h-[320px]"><Reviews /></div>                                                // reserve space
```

### Re-measure (same command, same settings, median of 3 runs)

| Metric (mobile) | Before | After |
|---|---|---|
| LCP | 4.8 s | 2.1 s |
| TBT | 620 ms | 180 ms |
| CLS | 0.21 | 0.02 |

## Case B — "Laporan penjualan lemot" (database)

### Baseline

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT date_trunc('day', created_at) AS day, sum(total)
FROM sales
WHERE store_id = 7 AND created_at >= now() - interval '30 days'
GROUP BY 1 ORDER BY 1;
```

```text
Seq Scan on sales  (rows=1,820,442 removed by filter)  ... actual time=0.03..1840.21
Execution Time: 1912.4 ms
```

### Fix

```sql
CREATE INDEX CONCURRENTLY sales_store_created_idx ON sales (store_id, created_at) INCLUDE (total);
ANALYZE sales;
```

(`CONCURRENTLY` avoids locking writes; ship it as a migration, see
`data-layer-patterns-edho-ferdian`.)

### Re-measure

```text
Index Only Scan using sales_store_created_idx ... actual time=0.04..11.8
Execution Time: 14.9 ms
```

1,912 ms → 15 ms. Also check the endpoint end to end (API p95 from logs
or a load test), since the query is only part of it.

## Case C — "API kadang lambat banget" (backend)

### Baseline

```bash
npx --yes autocannon -c 20 -d 30 http://localhost:3000/api/orders
```

```text
Latency p50 42 ms · p97.5 1,240 ms · p99 2,310 ms · 380 req/s
```

Spikes, not a uniformly slow path → suspect event-loop blocking.

```bash
node --cpu-prof --cpu-prof-dir=./prof dist/server.js   # run the load again, stop the server
# open the .cpuprofile in Chrome DevTools → Performance, or:
npx --yes 0x dist/server.js
```

Flame graph: `bcrypt.hashSync` inside the login route and a
`JSON.parse` of a 4 MB settings blob on every request.

### Fix

```ts
const hash = await bcrypt.hash(password, 12);          // async: off the event loop (was hashSync)
const settings = await cache.getOrSet("settings", loadSettings, { ttl: 60 });   // parse once a minute, not per request
```

### Re-measure

| | Before | After |
|---|---|---|
| p50 | 42 ms | 38 ms |
| p99 | 2,310 ms | 96 ms |
| Throughput | 380 req/s | 1,150 req/s |

## Memory leak (Node) — how to prove one

```bash
node --inspect dist/server.js
# Chrome → chrome://inspect → Memory → heap snapshot (A); run load 5 min; snapshot (B); compare A→B
```

A real leak: retained size of one constructor grows with each load cycle
and doesn't drop after `global.gc()` (`node --expose-gc`). Common cause: a
module-level `Map` cache with no eviction, or listeners added per request.

## Report (format from `audit-output-format.md`)

```markdown
| # | Symptom | Measured cause | Fix | Before → After | Evidence |
|---|---|---|---|---|---|
| A1 | Product page slow on mobile | 2.1 MB lazy hero = LCP | priority + responsive sizes | LCP 4.8 → 2.1 s | lh-before/after-mobile.json |
| B1 | Sales report 2 s | seq scan on sales | composite index | 1,912 → 15 ms | EXPLAIN before/after |
| C1 | API p99 spikes | sync bcrypt + per-request JSON parse | async hash, cached settings | p99 2,310 → 96 ms | autocannon runs, flame graph |
```

Never report an improvement measured once on a laptop as the result —
median of several runs, same environment, and say what wasn't measured.
