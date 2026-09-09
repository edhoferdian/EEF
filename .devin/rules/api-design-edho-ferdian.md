---
trigger: model_decision
description: "Design and evolve API boundaries and contracts — REST resource naming, status-code semantics, pagination strategy, versioning policy, and the discipline of treating one contract artifact (OpenAPI/schema) as authoritative so client and server never drift. A design-time activity, distinct from system-design-edho-ferdian (broader architectural trade-offs) and code-review-edho-ferdian (reviewing an already-written endpoint). Trigger phrases: \"desain API untuk fitur ini\", \"bagaimana struktur endpoint yang baik\", \"API contract berubah, bagaimana handle-nya\", \"REST vs apa\", or when starting a new API surface."
---

# API Design — Edho Ferdian Mode (Skill Edition)

You are designing the **boundary** between a client and a server (or between
two services) before — or while — code gets written on either side. This is a
narrower, more concrete altitude than architecture: you are not deciding
monolith vs. microservices, you are deciding what `GET /orders/:id` returns,
what status code a duplicate email produces, and how a v1 client survives a
v2 rollout. Two source skills converge here because they are the same use
case seen from two ends: `api-design` covers what a good endpoint looks like
in isolation; `contract-first` covers how a client and a server stay in sync
about that endpoint over time. A contract without good shape conventions is
consistent but ugly; good shape conventions without a single authoritative
artifact drift apart the moment two people touch the boundary independently.

## Where this sits relative to the rest of the ecosystem

- **`system-design-edho-ferdian`** decides broader architectural trade-offs —
  monolith vs. microservices, sync vs. event-driven, which datastore. This
  skill sits one level down: given that an API boundary needs to exist,
  *design that boundary's shape and evolution discipline*. If the question is
  "should this even be a REST API vs. an event stream," hand off upward to
  `system-design-edho-ferdian`; if it's "how should this REST endpoint be
  shaped," stay here.
- **`code-review-edho-ferdian`** (Domain 2 Security, Domain 3 Performance)
  reviews an endpoint that already exists in code. This skill is upstream of
  that — a well-designed contract prevents many findings that domain would
  otherwise have to catch after the fact. See
  `references/rest-conventions.md`'s cross-reference table for exactly which
  review codes map to which design-time checklist items, so the two skills
  don't restate each other. The same relationship holds for
  **Domain 4 — Blueprint/Spec Consistency**: the API contract designed here
  (shape decisions in `references/rest-conventions.md`, plus the versioning
  and breaking-change policy in `references/contract-evolution.md`) is the
  authoritative reference `code-review-edho-ferdian` checks an implementation
  against when it asks "does the code match the agreed contract?" — that
  domain doesn't redefine contract correctness, it cites this one.
- **`spec-mining-edho-ferdian`** and **`dev-kickoff-edho-ferdian`'s Phase 0
  intake** can consume an OpenAPI/schema file produced by following this
  skill's `references/contract-evolution.md` as a legitimate `BEHAVIOR_SPEC`-
  role input — a contract artifact already states requests, responses, and
  error shapes as ground truth, so it doesn't need to be mined from code.

## Workflow

```
Step 1  Decide REST shape          → references/rest-conventions.md
Step 1b Decide MCP tool surface (if applicable) → references/mcp-tool-surface.md
Step 2  Decide the contract discipline → references/contract-evolution.md
Step 3  Reflection gate             → below
```

### Step 1 — REST shape

Resource naming, HTTP status-code semantics, response envelope and error
shape, pagination strategy (offset vs. cursor, with the concurrent-write
caveat this ecosystem's database lens already covers), filter/sort/sparse-
fieldset conventions, rate-limiting tiers and headers, versioning and
`Sunset` policy, and the pre-ship checklist cross-referenced against
`code-review-edho-ferdian`'s SEC/CQ codes. Full detail:
`references/rest-conventions.md`.

### Step 2 — Contract discipline

One authoritative contract artifact per boundary, designing from consumer
needs rather than the database schema outward, generating types/clients from
that artifact instead of hand-syncing them, the step-by-step protocol for
changing a contract without breaking consumers, and named anti-patterns
(including treating compile-time types as the only proof of contract
correctness). Full detail: `references/contract-evolution.md`.

### Step 1b — MCP tool surfaces (when the boundary is a model, not a human client)

When the "client" on the other side of this boundary is an LLM invoking tools
rather than a human-facing app, the REST conventions above still apply but
need model-consumer-specific additions — schema-first tool definitions,
description-as-contract, idempotency, and transport choice. Full detail:
`references/mcp-tool-surface.md`.

### Step 3 — Reflection gate (mandatory before presenting a new or changed API design)

```
Gate A1: Every endpoint's status codes cover success + the realistic error
         cases, not just 200/404/500?                              [PASS/FAIL]
Gate A2: Pagination strategy has a stated reason (dataset size, consumer
         type), not a default picked without thought?               [.]
Gate A3: Exactly one contract artifact is named as authoritative for this
         boundary — no wiki/mock/type-file left to drift separately? [.]
Gate A4: A breaking change (if any) has a stated migration/versioning path,
         not a silent field repurpose?                               [.]
Gate A5: This design was checked against consumer jobs (what the client
         actually needs to render/do), not just the database shape?  [.]
```

Any FAIL → fix before presenting, or state explicitly why (e.g. "no
versioning path needed — this is a new boundary with zero existing
consumers").

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract)

- Communication with the user → Bahasa Indonesia.
- The contract artifact itself (OpenAPI/schema/proto), code samples, and any
  ADR-style write-up → English (machine-facing and cross-tool). Full
  contract: `skill-authoring-edho-ferdian` §7.

## Global rules

1. **Design-time altitude only.** This skill designs or evolves a boundary
   before/while it's built. Reviewing an endpoint that's already shipped
   belongs to `code-review-edho-ferdian`.
2. **One contract, one source of truth.** Never let a wiki page, a mock file,
   a hand-written client type, and the server's actual response shape
   diverge independently — pick one artifact and generate everything else
   from it.
3. **Design from consumer jobs outward**, not from the database schema
   outward — a raw `SELECT *` row is not a contract.
4. **State the pagination and versioning reasoning**, even briefly — a
   default picked without a reason is the same failure mode
   `system-design-edho-ferdian` flags for undecided non-functional targets.
5. **Cross-reference, don't duplicate.** Security and code-quality checks
   that `code-review-edho-ferdian` already owns are referenced by code, not
   restated here.
