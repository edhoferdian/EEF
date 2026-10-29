# Resource exhaustion and availability — RES-SEC-01..08

**Activation.** Untrusted requests, messages, files, tenant state or agent
work can consume shared CPU, memory, disk, connections, worker slots, queue
capacity or paid API spend, or can crash or deadlock a shared service.
This file separates a reviewable availability vulnerability from an
ordinary performance issue (that one goes to
`performance-audit-edho-ferdian`). Adapted from the availability companion
of [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill)
(MIT, `c1c8a8c`), in this skill's own wording.

**Already covered — extend, do not duplicate:** ReDoS (**SEC-16**), missing
rate limits (**SEC-08**), unbounded agent action loops and missing circuit
breakers (**AGT-04**).

**Discipline.** Require an input-to-cost path, a missing effective bound,
and impact on another user, a shared service or operator-owned spend —
work that only slows the requester's own process is not a vulnerability.
A missing rate limit is not enough on its own: check body, message and file
caps, concurrency limits, queues, deadlines, DB constraints, upstream
gateways and per-tenant quotas first. State attacker cost, service work,
persistence, scope and recovery. **Never validate by stressing a shared or
live service**; reason about complexity and use tiny fixtures. Upstream
caps, autoscaling and paid quotas outside the repo are **Needs
validation**.

## Amplification

- **RES-SEC-01 Superlinear work from small input** — nested parsing,
  recursive validation, template expansion, graph traversal, adversarial
  sort or hash behaviour (ReDoS itself is SEC-16). Derive the accepted
  depth or cardinality and the complexity.
- **RES-SEC-02 Expansion past the checked size** — compressed, sparse,
  nested, aliased or encoded input (archives, images, fonts, XML/YAML
  aliases, protocol compression) that grows far beyond the transfer or file
  size limit; limits must hold after every expansion stage.
- **RES-SEC-03 Query and fan-out amplification** — a small request causing
  broad scans, pathological joins, unbounded sort or aggregation, GraphQL
  depth or breadth, or many downstream calls because depth, filter
  cardinality, pagination or expansion fields are unbounded.

## Accumulation

- **RES-SEC-04 Unbounded buffers, cardinality and leaks** — bodies,
  out-of-order streams, uploads, sessions, unique cache keys, metric
  labels, subscriptions or pending jobs with no per-item *and* aggregate
  limit (ten thousand valid one-byte items can pass a per-message cap);
  sockets, file handles, cursors, timers, subprocesses or temp files not
  released on malformed input, timeout or cancellation; work that keeps
  running in the database, model or worker after the client disconnected
  or authorization failed.

## Quotas and scheduling

- **RES-SEC-05 Expensive work before authentication** — parsing, key
  lookup, cryptography, decompression or outbound requests performed
  before authentication and the earliest size or rate gate.
- **RES-SEC-06 Quota keyed on the wrong dimension** — accounting by
  attacker-influenced IP, route, key prefix or task ID so one principal
  escapes its budget or spends another's; races, retries, reconnects and
  counter overflow; attacker jobs holding shared locks, worker slots, DB
  pool connections or event-loop turns past their deadline (starvation).
  Paid-API spend with no per-user or per-request ceiling belongs here.

## Failure and recovery

- **RES-SEC-07 Reachable crash or deadlock** — untrusted input reaching a
  `panic`, abort, fatal assertion, unhandled exception, `process.exit`,
  lock cycle or infinite loop in a shared process. Note supervisor scope:
  a restarted worker reduces impact but does not remove the defect.
- **RES-SEC-08 Retry storms and poison records** — timeouts or dependency
  errors that trigger synchronized or unbounded retries with no jitter,
  ceiling, circuit breaker or dedup; one malformed record that fails at the
  head of a shared queue, partition, startup scan or migration forever
  (check skip/quarantine policy and which tenants share it); recovery or
  restore that rebuilds unbounded state or replays the input that crashed
  it.

## How to hunt it

Build an input-to-resource table: earliest accepted size and cardinality,
work done before auth, downstream fan-out, what persists, which shared pool
it uses, who owns the limit and the cleanup, and how it recovers. Compare
per-object limits with aggregate ones. Prioritize low attacker effort,
unauthenticated reach, cross-tenant scope, persistence and poor recovery.
Missing limits with no concrete shared impact are hardening notes.
