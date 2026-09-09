# ADR template

One ADR = one decision. If you're tempted to write "and also," that's a
second ADR.

## Template

```markdown
# ADR-<NNN>: <short, decision-shaped title>

## Status
Proposed | Accepted | Superseded by ADR-<NNN> | Deprecated

## Date
<YYYY-MM-DD>

## Context
<What situation forced this decision? What constraint, requirement, or
observed problem made the current approach (or the lack of one) untenable?
Ground any claim about the current system's behavior — cite the Salak-graph
fact or the manual check that supports it, per SKILL.md Step 1. State the
non-functional target this decision is answering (latency, scale, cost,
availability, security posture).>

## Decision
<The one sentence that states what was chosen, stated as a decision, not a
description: "Use X for Y because Z" — not "We are considering X.">

## Consequences

### Positive
- <what gets easier, faster, safer, cheaper as a direct result>

### Negative
- <what gets harder, slower, riskier, more expensive as a direct result —
  a real decision always costs something; an ADR with no Negative section
  is a sign this wasn't scrutinized>

### Neutral / follow-up
- <anything that changes but isn't clearly good or bad, and any follow-up
  work this decision creates (migration steps, a deprecation timeline)>

## Alternatives Considered

### <Alternative A>
- Why it was viable: <one line>
- Why it was rejected: <the actual reason — cost, complexity, team
  familiarity, a hard constraint it fails to meet. "Didn't feel right" is
  not a reason.>

### <Alternative B>
- Why it was viable: <one line>
- Why it was rejected: <reason>

<Minimum one alternative. Two or three is typical for a decision worth an
ADR. More than four usually means the options weren't filtered before
writing — narrow to the real contenders first.>

## Non-functional requirements addressed
<Pointer to the relevant lines of references/nfr-and-scaling.md's checklist
— which NFRs this decision was optimizing for, and which it deliberately
traded away.>
```

## Worked example (kept as reference shape)

```markdown
# ADR-001: Use Redis for Semantic Search Vector Storage

## Status
Accepted

## Date
2025-01-15

## Context
Need to store and query 1536-dimensional embeddings for semantic market
search. Current traffic: ~50K searches/day, p99 latency target <50ms.
No existing vector storage in the stack (checked via Salak — zero edges
into any vector-store package).

## Decision
Use Redis Stack with vector search (KNN) for embedding storage and query.

## Consequences

### Positive
- Fast vector similarity search (<10ms observed)
- Built-in KNN algorithm, no custom index code
- Simple deployment — one more Redis instance, team already operates Redis

### Negative
- In-memory storage — expensive at datasets beyond ~1M vectors
- Single point of failure without clustering (not yet budgeted)
- Limited to cosine similarity — no room for a hybrid distance metric later
  without a migration

### Neutral / follow-up
- Revisit at the 100K-vector mark (see scaling tier table) — this is a
  10x-tier decision, not a 1000x-tier one.

## Alternatives Considered

### PostgreSQL pgvector
- Why it was viable: persistent storage, already running Postgres, no new
  infra piece.
- Why it was rejected: measured 3-4x slower on the target query shape at
  current index settings; would need HNSW tuning work not budgeted this
  sprint.

### Pinecone (managed)
- Why it was viable: zero ops burden, scales past 1M vectors without a
  migration.
- Why it was rejected: per-query cost model doesn't fit the traffic profile
  at this stage; revisit if the 1000x-tier ever becomes real.

### Weaviate
- Why it was viable: more retrieval features (hybrid search, filtering).
- Why it was rejected: none of those features are on the current roadmap;
  adopting it now would be speculative generality (YAGNI).

## Non-functional requirements addressed
Latency (primary — <50ms p99 target met), cost (secondary — in-memory cost
accepted at current scale), availability (deliberately deferred — see
Negative).
```
