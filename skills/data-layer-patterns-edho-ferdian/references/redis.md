# Redis — Design-Time Setup & Patterns

Adapted from ECC `redis-patterns`, fetched 2026-09-04.

Redis is an in-memory data structure store. Individual commands are atomic
on a single instance; multi-step workflows need a Lua script, a
`MULTI`/`EXEC` transaction, or a pipeline to stay atomic. Design the access
pattern before picking a data structure — see the cheat sheet below.

## Data structure cheat sheet

| Use case | Structure | Example key |
|---|---|---|
| Simple cache | String | `product:123` |
| User session | Hash | `session:abc` |
| Leaderboard | Sorted Set | `scores:weekly` |
| Unique visitors | Set | `visitors:2024-01-01` |
| Activity feed | List | `feed:user:456` |
| Event stream | Stream | `events:orders` |
| Counters / rate limits | String (`INCR`) | `ratelimit:user:123` |
| Bloom filter / approx unique count | HyperLogLog | `hll:pageviews` |

## Cache invalidation strategies — pick one deliberately

This is the single most consequential decision when adding a cache. Don't
default to "TTL and hope" without considering whether staleness is actually
acceptable for this data.

**TTL-based (lazy expiry).** Simplest option — set a TTL, let the cache
entry expire, next read repopulates it (cache-aside):

```python
def get_product(product_id: int):
    cached = r.get(f"product:{product_id}")
    if cached:
        return json.loads(cached)
    product = db.query("SELECT * FROM products WHERE id = %s", product_id)
    r.setex(f"product:{product_id}", 3600, json.dumps(product))
    return product
```

Use when: staleness up to the TTL window is acceptable, and the write path
doesn't need to be aware of the cache at all. This is the right default for
most read-heavy, tolerant-of-staleness data.

**Explicit invalidation (tag-based).** The write path actively deletes or
marks stale the cache entries it affects, rather than waiting for TTL:

```python
def invalidate_category(category_id: int):
    tag = f"tag:category:{category_id}"
    keys = r.smembers(tag)
    if keys:
        r.delete(*keys)
    r.delete(tag)
```

Use when: staleness is not acceptable even for a short window (pricing,
inventory counts near zero, permissions) — but this couples every write
path to the cache's key structure, so it only pays off when the coupling is
manageable (a handful of write paths, not dozens).

**Write-through.** The write path updates the cache in the same operation
as the database write, so the cache is never stale between writes:

```python
def update_product(product_id, data):
    db.execute("UPDATE products SET ... WHERE id = %s", product_id)
    r.setex(f"product:{product_id}", 3600, json.dumps(data))
```

Use when: reads immediately after a write must see the new value, and the
write volume is low enough that the extra cache write per DB write isn't a
bottleneck. Combine with a TTL anyway as a safety net against a cache write
that silently fails to run.

**Decide at design time**, not as an afterthought: which strategy, what TTL
(see table below), and — for explicit invalidation — which write paths are
now responsible for firing it. Write that responsibility down; a forgotten
invalidation call is invisible until the stale-data bug reaches production.

### TTL guidance

| Data type | Suggested TTL |
|---|---|
| User session | 24h |
| API response cache | 5–15 min |
| Rate limit window | Match the window size |
| Short-lived tokens | 5–10 min |
| Leaderboard | 1h–24h |
| Static/reference data | 1h–1 week |

**Always set a TTL, even under explicit invalidation.** A key without a TTL
that's relying entirely on an invalidation call to be deleted will
accumulate indefinitely the moment that call is missed once — TTL is the
backstop, not a substitute for the primary strategy.

## Redis as a queue vs. a dedicated queue system

Redis can serve as a lightweight queue via Lists (`LPUSH`/`BRPOP`) or, with
delivery guarantees, via **Streams** with consumer groups:

```python
# Producer
def emit(stream: str, event: dict):
    r.xadd(stream, event, maxlen=10000)  # cap stream length

# Consumer group — at-least-once delivery
def consume(stream, group, consumer):
    while True:
        messages = r.xreadgroup(group, consumer, {stream: '>'}, count=10, block=2000)
        for _, entries in (messages or []):
            for msg_id, data in entries:
                process(data)
                r.xack(stream, group, msg_id)
```

**When Redis Streams is the right call:** the team is already running
Redis, the message volume and retention needs are modest, and the delivery
guarantees Streams offers (consumer groups, replay from an offset,
at-least-once) cover the actual requirement.

**When to reach for a dedicated queue system instead** (SQS, RabbitMQ,
Kafka, a managed job queue): the team needs long-term durability guarantees
beyond what an in-memory store backed by RDB/AOF snapshots comfortably
provides, dead-letter queue handling, cross-region delivery, exactly-once
semantics, or the queue is expected to become a first-class piece of
infrastructure rather than a convenience riding on an existing cache. Redis
Streams is a genuinely good choice for a moderate at-least-once queue; it is
the wrong choice when the queue's durability and delivery requirements are
the primary system requirement rather than a secondary one.

Plain Pub/Sub (no Streams) has **no persistence at all** — a subscriber that
isn't connected when a message publishes loses it permanently. Only use
Pub/Sub for genuinely fire-and-forget broadcast (e.g. "invalidate this local
in-process cache on other instances"), never for anything that must be
processed reliably.

## Connection pooling

```python
from redis import ConnectionPool, Redis

pool = ConnectionPool(
    host='localhost', port=6379, db=0,
    max_connections=20,
    decode_responses=True,
    socket_connect_timeout=2,
    socket_timeout=2,
)
r = Redis(connection_pool=pool)
```

Size `max_connections` to the workload, not a default — the same
serverless-instance-multiplication problem as `references/prisma.md`
applies here: each function instance in a serverless deployment gets its
own pool, so a generous per-instance limit multiplied by instance count can
exhaust the Redis server's own connection ceiling. For multi-node
availability, use Sentinel or Cluster mode rather than a single instance
with no failover — decide this at setup, since migrating from a single
instance to Cluster later means a full re-key of hash-tagged keys.

## Anti-patterns to avoid from the start

| Anti-pattern | Problem | Fix |
|---|---|---|
| `KEYS *` in production | Blocks the server — O(N), single-threaded | Use `SCAN` with a cursor instead |
| Keys with no TTL | Memory grows unbounded until eviction or OOM | Always set a TTL (see above) |
| Unbounded key growth (e.g. one key per user forever) | Same failure mode as missing TTL, just slower | Cap collection sizes (`maxlen` on streams, expiring old keys) or shard by time window |
| Storing large blobs (>100KB) in a string value | Slow serialization, memory pressure, blocks other clients | Store a reference and fetch the blob from object storage |
| Single Redis instance for cache **and** queue **and** session store | No isolation — a queue backlog can evict cache entries under `allkeys-lru` | Separate logical DBs or separate instances per concern |
| No cache-miss stampede protection | A cold cache under load sends every concurrent request to the database at once | Use a lock-based or probabilistic-early-expiry guard (see below) |

**Cache miss stampede prevention** — decide this at setup for any
high-traffic cache-aside path, not after the first incident:

```python
def get_with_lock(key, fetch_fn, ttl=300):
    cached = r.get(key)
    if cached:
        return json.loads(cached)
    with _lock_for(key):
        cached = r.get(key)  # re-check after acquiring the lock
        if cached:
            return json.loads(cached)
        value = fetch_fn()
        r.setex(key, ttl, json.dumps(value))
        return value
```

For multi-process deployments, use a distributed lock (`SET NX PX` +
token-checked release) rather than an in-process lock — an in-process lock
only protects against stampede within a single process.

## Related

- `references/postgres.md` — when a materialized view is the better tool
  than a cache for an expensive read
- `references/prisma.md` — the same connection-pool-per-instance problem in
  serverless, on the database side
