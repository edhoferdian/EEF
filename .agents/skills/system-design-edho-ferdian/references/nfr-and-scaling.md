# Non-functional requirements checklist + scaling-tier framework

## Non-functional requirements checklist

Run through every category below for a decision that touches architecture.
Not every category applies to every decision — mark the ones that don't as
"N/A, because <reason>" rather than skipping silently; a silent skip reads
as "forgotten," a stated N/A reads as "considered."

- [ ] **Scalability** — expected growth curve, and at what point (see tier
      table below) the current design needs to change.
- [ ] **Availability** — target uptime, single points of failure, what
      happens on partial failure (does it degrade or fully fail).
- [ ] **Latency** — p50/p95/p99 targets for the operations this decision
      affects, measured or estimated against current traffic shape.
- [ ] **Cost** — infra cost delta versus the current approach, at current
      scale and at the next scaling tier up.
- [ ] **Security posture** — new attack surface this decision introduces
      (new network boundary, new credential, new external dependency);
      cross-reference `code-review-edho-ferdian`'s SEC domain if the
      decision will need review later.
- [ ] **Maintainability** — does this decision increase or decrease the
      number of moving parts an engineer must understand to change this
      area of the system.
- [ ] **Operability** — what does on-call need to know; new alerts,
      dashboards, or runbook entries this decision requires.

## Scaling-tier framework

State explicitly what changes — and what deliberately does *not* change —
at each order-of-magnitude jump from current load. A decision that doesn't
name its tier is implicitly claiming to work at every scale, which is
almost never true and almost never checked.

| Tier | What typically breaks first | What usually changes |
|------|------------------------------|------------------------|
| **Current (1x)** | — | Baseline: state current numbers (requests/day, data volume, concurrent users) so "10x" has a concrete meaning, not a vague "a lot more." |
| **10x** | A single database instance's connection limit or query latency under naive queries; an in-memory cache's size ceiling. | Add read replicas or connection pooling; introduce or resize a cache layer; add basic indexing that wasn't needed before. Usually does **not** require a rewrite. |
| **100x** | Single-writer database throughput; monolithic deploy unit slowing every release; a synchronous call chain that was fine at low volume. | Consider read/write splitting, sharding, or a queue between slow and fast paths; start separating deploy units for the hottest component only — not a full microservices rewrite unless the org/team structure also justifies it (Conway's Law cuts both ways). |
| **1000x** | Whatever remained a single point of contention through the 100x tier; cross-region latency if the user base has gone global; a single-region database. | Multi-region or multi-cluster design; event-driven decoupling between major subsystems; this is the tier where a genuine architecture rewrite is usually justified — say so explicitly if the ADR is proposing one prematurely (below 1000x) versus reactively (at 1000x). |

**Rule: don't design for a tier you're not near.** Proposing 1000x-tier
architecture (full event-driven microservices) for a 1x-tier problem is the
same anti-pattern as premature optimization — it trades real, current
simplicity for hypothetical, future scale that may never arrive (YAGNI,
per Edho's coding-style baseline). State which tier the current decision is
actually solving for, and name the next tier's likely trigger so a future
session knows when to revisit — don't leave it open-ended.

## Red flags (ported, still apply at this altitude)

- **Big Ball of Mud** — no clear structure driving the decision.
- **Golden Hammer** — reaching for the same pattern regardless of fit.
- **Premature optimization** — solving for a tier not yet reached.
- **Not Invented Here** — rejecting a proven library/service without a
  concrete reason tied to this project's constraints.
- **Analysis paralysis** — this skill's own trade-off format has a stated
  option-count ceiling (`tradeoff-analysis.md`) precisely to avoid this.
- **Magic** — a design that depends on undocumented behavior of another
  system; if it must, the ADR names the dependency and its risk explicitly.
