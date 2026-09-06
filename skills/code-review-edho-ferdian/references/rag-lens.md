# Conditional Lens — RAG Pipelines

Adapted from ECC `rag-pipeline-reviewer`, fetched 2026-09-04.

**Activation.** This lens runs only when Phase 0 detects the review scope
touches a vector store client, an embedding call, or a retrieval/RAG chain
(imports of a vector DB SDK, `embed(...)`/embedding-model calls, retriever
classes, a chunking pipeline). If none of these are in scope, skip this file
entirely.

**Code placement.** Findings use their own `RAG-##` codes rather than folding
into CQ/SEC/PERF, since retrieval-quality issues don't map cleanly onto any
of the four general domains.

**Scope discipline.** This lens does not rewrite the LLM's answer-generation
prompt or response format — that's outside a code-review pass. It reviews the
retrieval pipeline: what gets fetched, how it's filtered/reranked, whether the
system knows when it doesn't have enough context, and whether the project can
prove the pipeline works via evaluation.

---

## RAG-01 — Raw top-k dumped with no reranking / filtering

Flag a pipeline that fetches top-k chunks (commonly top-5) by raw
cosine-similarity and forwards them to the LLM unfiltered. Raw similarity
ranking alone often surfaces near-duplicates or tangentially related text —
similarity to the query embedding is not the same as relevance to answering
the query.

- Check whether a reranking step exists between vector retrieval and the LLM
  call.
- If reranking exists, **verify it actually reorders results** rather than
  being a pass-through: the top chunk after reranking should differ from the
  top chunk by raw similarity alone on at least some sample queries. A
  reranker that always returns the same order as raw similarity search is
  providing no value and should be flagged as such.
- Check whether there's a fallback when even reranked results score poorly —
  does the pipeline retry with adjusted parameters, or forward low-quality
  context regardless?

## RAG-02 — Missing "not enough context" fallback

The system should be able to signal insufficient grounding (ask for more
documents, decline to answer, or clearly caveat the response) rather than
answering ungrounded when retrieval comes back empty or low-relevance. Flag
any pipeline that always generates a confident-sounding answer regardless of
retrieval quality.

## RAG-03 — Citation attribution

Check that the pipeline attributes claims only to retrieved and verified
source chunks — not free-generated text passed off as sourced. A citation
that doesn't trace back to an actual retrieved chunk is a fabricated
citation, which is worse than no citation because it reads as verified when
it isn't.

## RAG-04 — Evaluation coverage (strong stance — do not accept a blanket threshold)

Before treating a RAG pipeline as production-ready, require a RAGAS-or-
equivalent evaluation harness run on a representative sample of real queries,
with the minimum metric set of **faithfulness**, **context_recall**, and
**context_precision**.

**Reject a blanket "≈1.0 threshold"** as an evaluation policy — it's not a
real bar, it's a number nobody checked. Require the project to define and
justify:

- a **versioned baseline dataset** and the current baseline score against it;
- **acceptance thresholds** appropriate to the task's actual risk and data
  quality (not a copy-pasted "should be close to 1" with no reasoning);
- **named slices** for important query types, languages, tenants, or known
  failure modes — an aggregate score can hide a slice that's badly broken;
- an **allowed regression delta** per metric, so a small evaluation-harness
  change doesn't silently redefine "passing".

Flag absolute scores below the project's own stated threshold, and flag
statistically or operationally meaningful regressions from the project's
baseline. If the project has no evaluation policy at all, report that as a
blocking gap and recommend establishing a baseline before calling the
pipeline production-ready — don't wave it through because "it seems to work
in manual testing."

---

## Output shape for this lens

When this lens is active, fold its findings into the standard report format
(`references/review-checklist.md` §6) using `RAG-##` IDs, but also note in
Phase 0's scope summary:

- vector store, embedding model, and chunking strategy in use;
- top-k value and whether reranking exists;
- whether an evaluation harness / baseline exists, and its current numbers if
  runnable.

## Handoffs

If a finding exceeds retrieval-specific review, name the gap rather than
attempting to cover it yourself:

- dataset governance, offline/online evaluation design, model serving, or
  monitoring → if the scope also touches a training pipeline, feature store,
  model serving, or evaluation harness, `references/mle-lens.md` activates
  alongside this one — cross-reference its `ML-##` findings rather than
  duplicating them here.
- untrusted retrieved content, prompt injection via retrieved documents,
  authorization on retrieved data, or egress of sensitive retrieved content →
  this overlaps Domain 2 (Security); cross-reference the relevant SEC-##
  finding instead of duplicating it under a RAG code.
- retrieval latency, index sizing, caching, or load behavior → this overlaps
  Domain 3 (Performance) and the measurement-escalation note in
  `references/review-checklist.md` (PERF findings needing real measurement
  escalate to `performance-audit-edho-ferdian`).

---

## Severity guidance

- 🔴 **CRITICAL** — the pipeline answers confidently with fabricated
  citations, or answers ungrounded with no "not enough context" signal, on a
  user-facing feature where correctness matters (e.g. legal, medical,
  financial guidance).
- 🟠 **HIGH** — no reranking on a top-k pipeline serving a feature with
  meaningful query diversity; no evaluation harness at all before a
  production launch.
- 🟡 **MEDIUM** — reranking exists but isn't verified to actually reorder
  results; evaluation harness exists but lacks named slices or a regression
  policy.
- 🔵 **LOW** — evaluation baseline exists but hasn't been re-run recently
  against the current pipeline version.
- ⚪ **INFO** — a suggestion to add citation attribution where none was
  requested but would improve trust.
