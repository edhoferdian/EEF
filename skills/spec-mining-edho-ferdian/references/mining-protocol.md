# Mining Protocol — Scope Discovery, Sample-and-Expand, Salak Integration

Reference for Phase 1 and Phase 2 of spec-mining-edho-ferdian v1.0.
Output format lives in `spec-format.md` — read both before mining.

---

## Phase 1 — Scope discovery

### Step 1.1 — Detect project structure (minimum viable scan)

- Find package manifests: `package.json`, `go.mod`, `pom.xml`,
  `pyproject.toml`, `Cargo.toml`, `composer.json`, etc.
- Find framework configs: `next.config.*`, `vite.config.*`, Django
  `settings.py`, Spring Boot main class, etc.
- Map the top-level directory layout. Ignore `node_modules`, `vendor`,
  `.git`, `dist`, `build`, `target`.
- Identify entry points: `main.*`, `index.*`, `app.*`, `server.*`, `cmd/`,
  `src/main/`.

### Step 1.2 — Group into capabilities

A capability is a cohesive cluster of related entry points and their backing
directories. Group by reading each entry point's first-level dependencies
(injected services, imported modules, annotated components). Entry points
that share the same service namespace belong to the same capability. Name
each capability with a kebab-case identifier: `orders`, `payments`,
`user-auth`, `inventory`.

### Step 1.3 — Salak clustering (detect, defer, never require)

Salak is a separate, optional tool — a deterministic code knowledge graph
generator. Follow the exact detect-defer pattern from
`dev-kickoff-edho-ferdian`'s `references/salak-integration.md`: run
`salak version` (or `command -v salak`) silently; non-zero/not found means
Salak is absent — proceed with the manifest/entry-point heuristic above and
say nothing about it.

**If Salak is present, check whether it exposes module clustering before
relying on it.** As of this skill's authoring (2026-09-04), Salak's own
design docs (`SALAK-SDD-v1_4.md`) list "Community detection / clustering" as
explicitly out of scope for the current version — "adds value only on large
graphs; defer until the graph exists." Do not assume a locally installed
Salak has this feature just because this skill wants it. Verify at runtime:
run `salak --help` and the relevant subcommand's `--help` (per the
detect-defer contract in `salak-integration.md`, treat `--help` output as
authoritative over any doc, including this one) and check whether a
clustering/grouping command actually exists.

- **If Salak exposes clustering**: use its output to help group capabilities
  in Step 1.2, cross-checked against the manifest/entry-point heuristic
  rather than trusting it blindly — present both if they disagree.
- **If Salak does not expose clustering** (the current, confirmed default):
  say so once, plainly, and fall back to the manifest/entry-point heuristic
  unmodified. **Never invent a Salak capability it doesn't have** — do not
  describe a heuristic grouping as "Salak's clustering" to make the mining
  sound more grounded than it is.

Salak's dependency-graph edges (`depends_on`/`imports`, not clustering) are
still used later, in Phase 2's metadata extraction — see §Salak integration
below. Clustering and dependency-graph consumption are separate questions;
answer them separately.

### Step 1.4 — Present and confirm

Present the capability list to the user **in Bahasa Indonesia**. Example
shape:

```
Saya menemukan kapabilitas berikut di repo ini:
1. orders     — src/orders/, entry: routes/orders.ts
2. payments   — src/payments/, entry: routes/payments.ts, services/stripe.ts
3. user-auth  — src/auth/, entry: middleware/auth.ts

Mau saya mining yang mana? (bisa lebih dari satu, atau semua)
```

Mine all capabilities only if the user explicitly says so ("mining semua",
"semuanya"). Do not default to mining everything on a large repo — that is
exactly the token-budget mistake this skill exists to avoid.

---

## Phase 2 — Sample-and-expand read strategy

This is a token-budget discipline, not an optional nicety. A 50-file module
cannot and should not be fully read in one pass.

### Step 2.1 — Sample

Read the entry files first for the selected capability: routers,
controllers, service facades, public API surfaces. These typically contain
roughly 70% of the behavioral assertions the eventual spec will need.
Extract every Requirement and Invariant you can find from this set before
reading anything else.

### Step 2.2 — Expand

For each behavior found in the sample, trace one level down its call chain
to verify it. Example: if a Requirement says "stock is decremented", read
`InventoryService.decrement()` to confirm the claim and pin its `enforced`
location precisely.

### Step 2.3 — Stop conditions (first one to trigger wins)

Stop expanding for this capability the moment **any** of these is true:

1. The call chain reaches an external system boundary — a DB query, an HTTP
   call, a message queue, a third-party SDK call. What happens on the other
   side of that boundary is out of scope for this mining pass.
2. Three consecutive expanded files yield no new behavioral assertions
   ("barren" files).
3. 15 files total have been read for this capability (sample + expand
   combined).

### Step 2.4 — Defer, never drop

Whatever remains unread when a stop condition triggers goes into an explicit
document-level metadata comment at the bottom of the capability's spec file:

```
<!-- deferred: file1.ts (reached external boundary before tracing further), file2.ts (read budget exhausted) -->
```

Each deferred file carries a reason, not just a filename — "read budget
exhausted" and "external boundary" are different situations for whoever
picks up mining this capability further in a later session.

---

## Mining sources (what counts as a behavioral assertion)

Capture every behavioral assertion regardless of whether it "looks like" an
API contract, a business rule, a calculation, or a state transition — do not
skip a behavior because it doesn't fit a category:

- **Public function signatures**: input/output types, error conditions, side
  effects.
- **Service-layer conditionals**: `if`/guard clauses that throw or return
  early based on domain state.
- **Status transition code**: every code path that changes an entity's
  status field.
- **Validation logic beyond schema**: domain-level checks like "start date
  before end date".
- **Calculation functions**: pure computations over domain inputs.
- **Authorization checks**: role gates, ownership checks, rate limiters.
- **Assert statements and database constraints**: invariants the code
  guarantees.
- **Event emissions and side effects**: what happens after a behavior
  completes.
- **Saga / compensating actions**: rollback logic when a multi-step process
  fails.

If the code enforces something, it goes in the spec — regardless of category.

---

## Metadata extraction

For every mined behavior, extract these fields. If a field cannot be
determined, **omit it — never guess**:

| Field | Meaning | Format |
|---|---|---|
| `id` | stable identifier, the primary/most-upstream enforcement point. MUST NOT change when the human-readable name changes — it anchors future edits. | `FileName.methodName` |
| `entities` | domain objects involved | `User, Order, Inventory` |
| `enforced` | precise code location that checks this behavior | `FileName.methodName()` |
| `test` | an existing test that covers this, if one exists | `TestClass.testMethodName()` |
| `depends_on` | a prerequisite behavior within the SAME capability that must complete first | see below for sourcing |
| `triggers` | a downstream behavior within the SAME capability caused by this one | see below for sourcing |

`id` is derived from `enforced`: when `enforced` is known, set `id` to the
most upstream enforcement point. If `enforced` is unknown, leave `id` empty
too — an anchor with no enforcement is not an anchor.

### Salak integration — the upgrade over ECC's version

ECC's original `spec-miner` infers `depends_on`/`triggers` purely by reading
call chains, and its own guardrails admit this is unreliable for
cross-module or async relationships ("do NOT record dependencies you can't
trace synchronously"). This skill does the same call-chain inference as a
**fallback only**, and prefers a real dependency graph when one exists.

**Detection (same pattern as Step 1.3 and `salak-integration.md` verbatim):**
run `salak version`; absent → proceed with call-chain inference only, say
nothing. Present → continue below.

**Freshness:** before trusting `repo-graph.json` for this capability's
metadata, run `salak check` (per `salak-integration.md`'s exit-code
contract: 0 = fresh, 2 = stale → refresh with `salak scan`, 1 = internal
error → don't trust the graph this round, fall back to inference and say
so).

**Reading the graph for `depends_on`/`triggers`:**

1. Find the file/symbol node for the behavior's `enforced` location in
   `repo-graph.json` (`nodes[].id`, format `{lang}:{path}#{qualified_name}`).
2. Walk `edges[]` where `from`/`to` matches that node and `kind` is
   `imports`, `depends_on`, `calls`, or `references` (whichever the relevant
   language's `adapters[].emits` actually lists — **check `emits` before
   trusting a zero count**; `calls` is void in every Salak build to date,
   so a same-capability trigger relationship expressed only through a
   runtime call will not show up there and must fall back to inference).
3. **Respect provenance.** Only treat an edge as ground truth if
   `provenance` is `extracted`. An `inferred` edge is "very likely,
   unconfirmed" — still usable, but label it accordingly (see below). An
   `ambiguous` edge is never asserted as a single target; skip it for
   `depends_on`/`triggers` purposes rather than picking `candidates[0]`.
4. Only record `depends_on`/`triggers` for relationships **within the same
   capability** — cross-capability edges belong in a different spec file's
   cross-reference, not folded into this one silently.

**Labeling (mandatory, never blend unlabeled):**

- Sourced from a Salak `repo-graph.json` edge (`extracted` or `inferred`
  provenance, same-capability, correct `emits` for that language) →
  `[Salak-verified]`.
- No Salak graph available, or the specific relationship isn't representable
  in Salak's edge kinds (e.g. it's runtime-only and `calls` is void) → fall
  back to manual call-chain tracing, labeled `[inferred, unverified]`.

Example metadata block:

```
<!-- depends_on: ValidateStockLevel [Salak-verified] -->
<!-- triggers: EmitLowStockAlert [inferred, unverified] -->
```

Never write a bare `depends_on`/`triggers` value without one of these two
labels — an unlabeled claim reintroduces exactly the reliability problem
this adaptation exists to fix.

---

## Cross-validation discipline

A function's docstring or comment is a claim, not a fact. Before writing a
Requirement from a docstring:

1. Read the function's actual implementation.
2. Read at least one real caller (more if the callers disagree with each
   other — that disagreement is itself worth an `<!-- uncertainty: -->`
   note).
3. If the docstring and the actual behavior/caller expectations diverge,
   the Requirement reflects what the code and its callers actually do, not
   what the docstring claims. Note the divergence as a separate
   `<!-- uncertainty: docstring at FileName.method() claims X, callers treat it as Y -->`.

Never copy a docstring verbatim into a Requirement description without this
check.
