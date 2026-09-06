---
name: backend-engineering-edho-ferdian
description: >-
  Authoring server-side code between the API contract and the datastore —
  layering and ports/adapters boundaries, error taxonomy and resilience
  (typed errors, Result style, retry with backoff, circuit breakers),
  background jobs and queues, structured logging emission, and adding a new
  integration that matches the repo's existing connector pattern. The
  backend counterpart to frontend-engineering-edho-ferdian. Trigger phrases:
  "struktur service layer", "error handling di backend", "retry/circuit
  breaker", "background job / queue", "tambah integrasi baru".
---

# Backend Engineering — Edho Ferdian Mode

Adapted and consolidated from ECC `backend-patterns`, `hexagonal-architecture`,
`error-handling`, and `api-connector-builder`, fetched 2026-09-04.

## Where this sits

- `api-design-edho-ferdian` decides the **contract** at the boundary.
- `data-layer-patterns-edho-ferdian` decides the **storage** behind it.
- This skill is the **middle**: how the code between them is layered, how it
  fails, and how it defers work.
- `code-review-edho-ferdian` reviews the result — in particular
  `silent-failure-lens.md`, which is the review-side mirror of
  `references/error-and-resilience.md` here. Cross-reference, never restate.

## References

- `references/error-and-resilience.md`
- `references/llm-pipelines.md` — regex-first parsing with confidence-scoring
  as the LLM gate, plus cost-aware model routing, budget tracking, retry
  policy, and prompt caching for pipelines that call an LLM API.
- `references/scheduled-collection.md` — unattended collect/enrich/store
  pipelines (scrapers, feed pollers, report builders): source selection,
  per-source failure isolation, LLM-enrichment batching and fallback,
  prompt-injection rules for untrusted scraped content, idempotent upsert,
  and cron/alerting operations. Covers the background-job concerns
  (idempotency, dead-letter-style backfill, run scheduling) for this class of
  job — see the note below for what it does not cover.
- `references/nestjs.md` — NestJS project structure (`common/`, `config/`,
  `modules/<fitur>/` with module-local DTOs), canonical bootstrap (global
  `ValidationPipe`, `ClassSerializerInterceptor`, `HttpExceptionFilter`), env
  validation at boot, repository/transaction placement, and background
  jobs/event consumers in their own modules. Not speculative — this is the
  framework behind `ghostfolio`, a real project in Edho's stack.

**Note:** `references/layering-and-boundaries.md` (ports & adapters, repository
and service layers, composition root, migration playbook for entangled code,
"adding an integration") is planned but not yet written — the analysis this
skill was built from didn't produce ready-to-use content for it. Ask if you
need it filled in now. `references/jobs-and-queues.md` as a separate
general-purpose background-job/queue-backend reference is still not written;
`references/scheduled-collection.md` covers idempotency, dead-letter-style
handling, and scheduling for the scheduled-collection job shape specifically,
but a generic queue-backend/worker-pool reference remains a gap — ask if you
need that filled in.

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract)

Communication to the user in Bahasa Indonesia; code, comments, and any
generated files in English — fixed, never ask. Full contract:
`skill-authoring-edho-ferdian` §7.
