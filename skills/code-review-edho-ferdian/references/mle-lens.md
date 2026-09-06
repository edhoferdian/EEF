# Conditional Lens — ML Engineering (Training/Serving/Eval)

Adapted from ECC `mle-reviewer`, fetched 2026-09-04.

**Activation.** This lens runs only when Phase 0 detects the review scope
touches a training pipeline, a feature store or feature-generation code, a
model-serving/inference path, or an offline/online evaluation harness
(imports of an ML framework, `train`/`fit`/`predict` entry points, a feature
join, a model registry or artifact-promotion script, a monitoring/alerting
config tied to model quality). If none of those are in scope, skip this file
entirely — don't report "N/A" for it in the final review.

**Reuse existing review lanes — this lens does not replace them.** MLE review
composes the general domains and other lenses instead of duplicating them:
this file adds ML-specific detection depth, but generic Python/typing/error-
handling issues still go through Domain 1 (CQ), secrets/PII/injection through
Domain 2 (SEC), latency/memory/batching through Domain 3 (PERF), and query/
schema/index issues on feature tables or prediction logs through
`references/database-lens.md`. Don't re-report a finding under an ML-##
code that already has a home in CQ/SEC/PERF/database-lens — cross-reference
instead.

**Code placement.** Findings use their own `ML-##` codes (below) for the
ML-specific failure modes that don't map onto the general domains: leakage,
split integrity, train/serve skew, promotion-gate discipline, and rollback
design. Everything else stays in its existing domain per the paragraph above.

---

## ML-01 — Point-in-time-correct feature joins (no future leakage)

Every feature used at training time must be joinable using only data that
would have been available at the label's timestamp in production. Flag:

- Feature joins that use a "current" or "latest" value of a mutable field
  instead of an as-of-timestamp snapshot.
- Any join key that pulls in a field derived from the outcome/label itself
  (post-outcome fields), even indirectly (e.g. an aggregate that includes the
  event being predicted).
- Missing snapshot/version columns on feature tables that would make a
  point-in-time join possible to verify at all.

This is the single most common way an ML pipeline shows great offline metrics
and fails in production — treat any ambiguity here as worth a [Medium
confidence] finding at minimum, and ask for the entity grain, label
timestamp, and feature timestamp explicitly if they aren't visible in the diff.

## ML-02 — Random split on time- or entity-dependent data

Flag `train_test_split`/`random_split` (or equivalent) used on data where:

- Rows share an entity (user, account, patient) across the split — the same
  entity appearing in both train and test leaks entity-specific signal.
- Rows are time-ordered and the task is used to predict forward in time — a
  random split lets the model train on "future" data relative to some test
  rows, inflating offline metrics versus real deployment performance.

The correct fix is a split that respects time (train on the past, test on
the future) and/or entity grouping (all of one entity's rows on one side of
the split). This is a common blocker, not a style nit — treat a hit here as
at least HIGH severity.

## ML-03 — Training-vs-serving transformation skew

Flag any feature transformation, preprocessing step, or normalization that is
implemented once for training and copied (by hand, not shared) into the
serving path. Two independent implementations of the same transformation
drift over time and produce inputs the model was never actually trained on.
Prefer: a shared transformation module/pipeline object used by both paths, or
an equivalence test that fails CI when they diverge. Absent either, flag the
duplication itself as the finding even before a concrete divergence is found.

## ML-04 — Promotion gates declared before selection, and fail closed

A model promotion/selection step must have its acceptance thresholds
(baseline comparison, slice metrics, guardrails) declared **before** looking
at candidate results, not chosen after seeing which threshold the new model
happens to clear. Also flag:

- Promotion logic that defaults to "promote" on an error, timeout, or missing
  metric (fail open) — it must fail closed (block promotion) on any gate
  evaluation failure.
- Gates that only check an aggregate metric with no slice/cohort coverage,
  letting a badly regressed segment hide behind a good average.
- A promotion path that depends on a notebook, a manually pasted chart, or an
  ungated local script rather than a reproducible, code-reviewable gate.

## ML-05 — Model version absent from prediction logs

Every prediction written to logs or a predictions table must be attributable
to the exact model artifact version, config, and (ideally) feature-set
version that produced it. Without this, delayed-label evaluation, incident
investigation, and rollback all become guesswork. Flag any prediction path
that logs the output without also logging `model_version` (or equivalent).

## ML-06 — Rollback that requires retraining is a design flaw

Rollback must mean "switch traffic back to the previous artifact and config"
— a rollback plan that requires retraining the previous model from scratch is
not a rollback, it's a multi-hour-to-multi-day incident response. Flag any
deployment/versioning design where the previous known-good artifact isn't
retained and directly re-deployable. This is a design-level finding, not a
missing-runbook nit — treat as HIGH or CRITICAL depending on how
production-critical the serving path is.

---

## Common blockers (from the source agent — treat a hit as a strong prior)

- Random train/test split on time-dependent or user-dependent data (ML-02).
- Feature generation uses fields unavailable at prediction time (ML-01).
- Offline metric improves while key slices regress (ML-04).
- Training preprocessing copied into serving code by hand (ML-03).
- Model version absent from prediction logs (ML-05).
- Promotion depends on a notebook, manual chart, or local file (ML-04).
- Monitoring only checks service uptime, not data or prediction quality.
- Rollback requires retraining (ML-06).
- Secrets, credentials, or PII in datasets, notebooks, logs, prompts, or
  artifacts — cross-reference Domain 2 (SEC), don't double-count under ML-##.

## Ground-truth requirement

Prefer real signal over reasoning when it's available in the repo:

```bash
pytest
python -m pytest tests/ -k "model or feature or eval or inference"
git grep -nE "train_test_split|random_split|fit_transform|predict_proba|model_version|feature_store|artifact"
git grep -nE "customer_id|email|phone|ssn|api_key|secret|token" -- '*.py' '*.sql' '*.ipynb'
```

A leakage or split-integrity claim you can't confirm this way stays at
[Medium confidence] with a note on what would confirm it (e.g. "would need
the feature table's timestamp columns to verify point-in-time correctness").

## Handoffs

- Tensor shape, device, gradient, CUDA, DataLoader, or AMP failures blocking
  training/inference → out of scope for this lens; note the gap rather than
  guessing at a fix.
- Latency, memory, batching, GPU utilization, or cost-per-prediction findings
  needing real measurement → escalate per the PERF measurement-escalation
  note in `references/review-checklist.md` (`performance-audit-edho-ferdian`).
- Feature-table/prediction-log query performance or schema design →
  `references/database-lens.md`, not this file.

---

## Operational lifecycle checklist (complements, does not replace, the review above)

Adapted from ECC `mle-workflow`, fetched 2026-09-05. Everything above this
point is the **review** lens — finding problems in ML code that already
exists. This section adds a different axis: the **operational lifecycle**
around that code, from data contract through post-deploy monitoring and
rollback. Use it as a checklist of lifecycle gaps to flag, not as a
replacement for the ML-01..06 findings above — a diff can pass every ML-##
check and still be missing a piece of this lifecycle (e.g. correct feature
joins but no rollback path, or a clean promotion gate but no drift
monitoring after deploy).

When reviewing, check whether the surrounding system (not just the diff)
covers each stage. A missing stage is a finding in its own right, filed
under the general domain it belongs to (CQ for missing tests/docs, PERF for
missing latency/cost tracking) unless it overlaps an ML-## code above.

- **Data contract.** Entity grain, label definition + timestamp + delay,
  feature timestamp/freshness SLA and point-in-time join rules, required
  columns/nulls/ranges, PII exclusions, and a dataset version/snapshot ID.
  Missing pieces here are the root cause of most ML-01 leakage findings —
  ask for the contract explicitly if it isn't visible in the diff.
- **Reproducible training.** Runnable by another engineer without hidden
  notebook state: typed config (not ad hoc globals), pinned dependencies,
  fixed random seeds, and a recorded (dataset version, code SHA, config
  hash, metrics, artifact URI) tuple per run. Flag training code that only
  reproduces inside the author's notebook.
- **Quality gate before deploy.** Promotion thresholds declared before
  results are seen (see ML-04), compared against both a baseline and the
  current production model, with slice/guardrail metrics — not just an
  aggregate. The gate must fail closed on error/timeout/missing metric.
- **Deployment artifact versioning.** Every artifact carries its version,
  training data reference, config, and preprocessing bundled together —
  never preprocessing logic that lives only in a notebook separate from the
  model it was fit for.
- **Post-deploy monitoring.** System health (availability, latency,
  timeout/error rate) *and* quality health (feature null/range/categorical
  drift, prediction and confidence distribution drift, delayed-label
  arrival and quality) as first-class monitored signals — uptime alone is
  not model monitoring.
- **Rollback.** Must mean switching traffic back to a previously retained,
  directly re-deployable artifact and config — see ML-06 above. A rollback
  "plan" that requires retraining is a gap to flag, not a completed item.

**Baseline-first principle.** Adapted from ECC `ml-adoption-playbook`,
fetched 2026-09-05. Before approving or helping build a complex model,
confirm a simple baseline (a rule-based heuristic or a plain linear/logistic
model) was tried and measured first — added complexity should be justified
by a measured gain over that baseline, not assumed to be worth it.

## Severity guidance

- 🔴 **CRITICAL** — confirmed future-label leakage or a promotion gate that
  fails open, on a model already serving production traffic.
- 🟠 **HIGH** — random split on time/entity-dependent data; rollback that
  requires retraining; no model version in prediction logs on a live serving
  path.
- 🟡 **MEDIUM** — training/serving transformation duplicated without an
  equivalence test but no confirmed divergence yet; promotion gate exists but
  lacks slice coverage.
- 🔵 **LOW** — monitoring covers uptime but not data/prediction quality on a
  low-traffic or internal model.
- ⚪ **INFO** — a leakage suspicion you couldn't verify because the feature
  table's timestamp columns weren't visible in the diff.
