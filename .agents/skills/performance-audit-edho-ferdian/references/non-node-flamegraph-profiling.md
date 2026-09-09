# Flame-graph profiling for non-Node backends

This skill's existing profiling content (Node `--prof`/`--prof-process`,
heap-snapshot diffing) is JS/React/Next-biased, matching Edho's primary
stack — see `web-frontend.md`. This file covers the same measure-then-fix
discipline for backends written in Python, Go, and Java, plus the general
flame-graph reading skill that transfers across all of them (and to Node's
own flame graphs, for that matter).

Same rule as everywhere else in this skill: never reason about a hot path
from reading the source. Profile it, get a flame graph, read the flame
graph, then fix the widest/tallest thing that's actually a constraint (see
`backend-latency-and-throughput.md`'s constraint-vs-queue section — a wide
frame in a flame graph is a candidate constraint, not automatically the
constraint, if downstream capacity is what's actually limiting throughput).

---

## On-CPU vs. off-CPU (wall-clock) profiling — pick the right one first

This is the single most common way a flame-graph investigation goes wrong:
using an on-CPU profiler to diagnose a problem that is actually time spent
*waiting*, not computing.

- **On-CPU profiling** samples the call stack only while a thread is
  actively running on a CPU core. It shows where CPU cycles are spent —
  correct for diagnosing a compute-bound hot path (a slow serialization
  loop, an inefficient algorithm, excessive JSON parsing). It is **blind to
  time spent blocked**: a thread waiting on a network call, a lock, a mutex,
  disk I/O, or a database round-trip doesn't appear on an on-CPU profile at
  all, because it isn't consuming CPU while it waits.
- **Off-CPU (wall-clock) profiling** captures why a thread is *not* running
  — blocked on I/O, waiting for a lock, sleeping, waiting on a channel/queue.
  This is the one that matters for most backend "it's slow" complaints,
  because most backend latency is I/O-bound (a database query, an upstream
  API call, a lock contested by another goroutine/thread), not CPU-bound.

**Diagnostic tell**: if an on-CPU flame graph shows low total sample count
relative to the wall-clock duration of the slow request (e.g. a request
that took 800ms produced only 40ms of on-CPU samples), the missing ~760ms is
off-CPU time — re-profile with an off-CPU/wall-clock tool instead of
concluding "nothing showed up, must not be a real problem." A profiler that
silently produces a low-information result because it's the wrong kind of
profiler for the problem is a common false-negative trap.

Run both when unsure which regime the problem is in — an on-CPU profile
that's mostly idle-looking is itself the diagnostic signal that the real
answer is in the off-CPU profile.

---

## Reading a flame graph — the shared vocabulary

All flame graphs below (Python, Go, Java) share this visual grammar:

- **Y-axis = stack depth**, not time. The bottom frame is the entry point
  (main, a request handler); each frame stacked above is a function called
  by the one below it.
- **X-axis = sample count / proportion of total time**, alphabetically
  sorted within a frame's children by most tools (not chronological — a
  flame graph is not a timeline; use a different visualization, like a
  trace/waterfall view, if execution order matters).
- **Width of a frame = how much of total profiled time was spent in that
  function or its descendants.** Width is the number that matters most —
  a function occupying 40% of the graph's width is a real target regardless
  of how deep it sits.
- Color is usually meaningless (often randomized or hashed by function name
  for visual distinction) unless the specific tool's legend says otherwise
  — never read significance into color on a generic flame graph.

### Common patterns and what they mean

- **A wide plateau near the bottom of the graph** — a single function
  (often a library call: JSON serialization, a regex, a database driver
  method) consuming a large, flat share of total time, with a relatively
  shallow call stack above it. This is usually the cleanest optimization
  target: one function, one fix, and the width tells you the ceiling on
  potential improvement (a 15%-wide plateau caps the best-case win at 15%
  of total time, however you optimize it — don't oversell the fix).
- **A tall, narrow tower** — deep recursion, a long chain of wrapper/
  middleware/decorator calls, or deeply nested synchronous call layers
  (framework → ORM → driver → network library → syscall) each adding a
  thin frame. A tall tower with a *narrow* top is not itself expensive
  (little width at the top means little time actually spent there) — the
  question is which frame in the tower is wide, not how tall the tower is.
  A uniformly narrow tower all the way up usually means the depth itself
  isn't the cost; keep scanning for the wide frame it's built on top of.
- **Many identical narrow frames repeated side-by-side at the same
  depth** — a function called many times with each call cheap
  individually; this is the flame-graph signature of an N+1-shaped problem
  (a query, an API call, or a serialization step invoked once per item in a
  loop) even in a non-database context. Width still tells the true cost:
  1,000 calls at 0.1ms each is still 100ms, and the graph shows it as one
  wide band made of many thin repeated segments, not as 1,000 separate
  "small" costs to dismiss individually.
- **A single frame that's wide *and* appears at multiple unrelated places
  in the tree** (not merged into one node) — a shared utility function
  called from several different code paths; some flame-graph tools offer a
  "merged" or "inverted" view specifically to re-aggregate this case so its
  true total cost is visible as one number instead of split across several
  smaller-looking frames.

### Reading order

1. Look at total width distribution first — which top-level branches
   (request handling vs. background job vs. framework internals) dominate.
2. Within the dominant branch, find the widest frame at any depth — that is
   the specific function to investigate, not necessarily the deepest one.
3. Confirm the frame is on the actual hot path for the complaint being
   investigated (a wide frame in a rarely-hit code path isn't the answer to
   "why is the checkout endpoint slow") before proposing a fix.
4. Apply the constraint-test from `backend-latency-and-throughput.md`: would
   speeding up this specific frame move the end-to-end metric that was
   measured in Phase 1? If the wide frame is CPU-bound compute but the
   endpoint's actual bottleneck (per the on/off-CPU split above) is I/O
   wait, optimizing it produces the "component improved, end-to-end
   unchanged" trap that file warns about.

---

## Python — py-spy

`py-spy` samples a running Python process from outside it (no code changes,
no import, works against a process you don't control the source of) and
supports both on-CPU and wall-clock (`--idle`-inclusive) sampling.

```bash
# Attach to a running process and record a flame graph (on-CPU by default)
py-spy record -o profile.svg --pid 12345

# Include time spent idle/blocked (wall-clock view — see On-CPU vs off-CPU above)
py-spy record -o profile.svg --pid 12345 --idle

# Profile a script from launch instead of attaching
py-spy record -o profile.svg -- python manage.py runserver

# Quick live top-like view instead of a full recording
py-spy top --pid 12345

# Dump the current stack of every thread once, useful for a hung process
py-spy dump --pid 12345
```

Python-specific gotchas:

- The GIL means most pure-Python CPU-bound work runs on one core at a time
  — a flame graph showing one wide Python-level frame while the process has
  many threads usually means those threads are mostly waiting on the GIL,
  not doing useful parallel work; check for GIL contention specifically
  before assuming "add more threads" will help pure-Python compute (it
  generally won't; multiprocessing or releasing the GIL in a C extension
  will).
- `py-spy` needs permission to read another process's memory
  (`--pid` attach); on Linux this typically means `ptrace` capability —
  either run as the same user with appropriate permissions, or use
  `sudo`/the container's equivalent, rather than silently getting an
  empty/partial profile.
- Native extensions (NumPy, a C extension) show as native frames without
  Python-level detail unless `py-spy` is run with native-frame support
  enabled for that build — a wide native frame with no further Python
  breakdown means the cost is inside the extension, not something further
  Python-level profiling will illuminate.

---

## Go — pprof

Go's built-in `pprof` is the standard tool and supports CPU, heap, goroutine,
block, and mutex profiles — the last two are specifically Go's off-CPU
story and are the ones most often skipped by mistake.

```go
// In an HTTP-serving app: expose pprof endpoints (guard behind auth/internal-only!)
import _ "net/http/pprof"
// then hit /debug/pprof/profile (CPU), /debug/pprof/heap, /debug/pprof/goroutine,
// /debug/pprof/block, /debug/pprof/mutex
```

```bash
# CPU profile (on-CPU), 30-second sample window
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30

# Generate a flame graph directly (requires graphviz, or use -http for interactive)
go tool pprof -http=:8081 http://localhost:6060/debug/pprof/profile?seconds=30

# Block profile — time goroutines spent blocked on channel ops, mutexes, select
go tool pprof http://localhost:6060/debug/pprof/block

# Mutex profile — contention specifically on sync.Mutex/RWMutex
go tool pprof http://localhost:6060/debug/pprof/mutex

# For a one-off binary (not a server), profile programmatically:
# import "runtime/pprof"; pprof.StartCPUProfile(f); defer pprof.StopCPUProfile()
```

Go-specific notes:

- The block and mutex profilers are **off by default** and need an explicit
  sampling rate set before they collect anything:
  `runtime.SetBlockProfileRate(1)` and `runtime.SetMutexProfileFraction(1)`
  (a rate of 1 samples every event — fine for a bounded investigation,
  too expensive to leave on at 1 in a high-throughput production service
  indefinitely; a higher rate like 100 or 1000 trades sample density for
  overhead).
- A goroutine profile (`/debug/pprof/goroutine`) showing a large and
  growing count over time is the Go-specific signature of a goroutine leak
  — take two snapshots bracketing a suspected leaking action, the same
  paired-snapshot methodology `web-frontend.md` uses for JS heap
  snapshots, and diff which stack shows growing goroutine count.
- `go tool pprof -http=:8081 <profile>` opens an interactive web UI with
  both a flame graph view and a "Top" view sorted by flat/cumulative time —
  the flat time column is closest to "how much did this specific frame
  cost, excluding what it called," which is often what you actually want
  when hunting the widest plateau.
- Never leave `net/http/pprof` reachable on a public, unauthenticated route
  in production — it exposes stack traces and can itself be triggered
  repeatedly as a resource-exhaustion vector; put it behind an internal-only
  listener or auth middleware.

---

## Java — async-profiler

`async-profiler` is preferred over the older `hprof`/JFR-only approaches
because it profiles both Java and native frames without the "safepoint
bias" that stack-sampling-at-safepoints-only profilers suffer from (a
classic false-negative trap where a profiler only samples at JVM safepoints
and systematically misses code that doesn't reach one, e.g. tight loops
without allocation).

```bash
# Attach to a running JVM by PID, produce a flame graph directly
./profiler.sh -d 30 -f profile.html -o flamegraph <pid>

# CPU profiling (on-CPU)
./profiler.sh -e cpu -d 30 -f cpu-profile.html <pid>

# Wall-clock profiling (off-CPU — includes blocked/waiting time)
./profiler.sh -e wall -d 30 -f wall-profile.html <pid>

# Allocation profiling — where object allocation pressure comes from
./profiler.sh -e alloc -d 30 -f alloc-profile.html <pid>

# Lock contention specifically
./profiler.sh -e lock -d 30 -f lock-profile.html <pid>
```

Java-specific notes:

- `-e cpu` and `-e wall` are the direct analogue of the on-CPU/off-CPU split
  above — run `wall` first for a general "why is this request slow"
  investigation unless there's already a specific reason to suspect
  CPU-bound compute.
- A flame graph dominated by JIT/GC-related frames
  (`G1CollectedHeap`, `ParallelTaskTerminator`, etc.) points at garbage
  collection pressure rather than application logic — pair with `-e alloc`
  to find which application code is generating the allocation pressure
  driving GC, rather than trying to tune GC settings blind.
- async-profiler needs `perf_events` access on Linux
  (`kernel.perf_event_paranoid` may need adjusting, or run in a container
  with the right capabilities) — a silently empty or CPU-frame-only profile
  is often a permissions issue, not "there's nothing to find."
- For a containerized JVM, confirm the profiler is attaching inside the
  same container/namespace as the target JVM — attaching from the host to a
  PID that's actually in a different PID namespace silently fails or
  attaches to the wrong process.

---

## Fix-and-reverify discipline

Same as every other measurement in this skill: after applying a fix
targeted at the widest confirmed frame, re-run the **same profiler, same
duration, same load pattern** and confirm both (a) that specific frame's
width shrank, and (b) the end-to-end metric this investigation started from
(the API p95, the job duration) actually moved — a shrunk frame that doesn't
move the end-to-end number was optimizing a non-constraint (see
`backend-latency-and-throughput.md`'s constraint-testing section) and should
be reported as such, not rounded up to "fixed."

## Provenance

Written for this ecosystem to close the non-Node flame-graph profiling gap,
2026-09-07.
