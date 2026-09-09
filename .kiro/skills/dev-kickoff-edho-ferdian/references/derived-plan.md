# Deriving a Provisional Task Plan `[DERIVED — NOT APPROVED]`

Reference for Phase 0 of `dev-kickoff-edho-ferdian` v2.0. SKILL.md's Phase 0
says that when `WORK_PLAN` is missing, you "may offer to derive a Provisional
Task Plan `[DERIVED — NOT APPROVED]`" from the other documents — this file is
the concrete method for that, since offering it without a method is not
actually offering anything.

**Everything this file produces is provisional.** No task from a derived plan
may be executed until the user has reviewed and approved it as described in
"Presenting the plan for approval" below. Do not let a derived plan quietly
become the plan of record.

## When this applies

- `WORK_PLAN` role is uncovered (Phase 0, Step 0.3) and the user agrees to a
  derived plan rather than uploading one or running an upstream Architect
  tool first.
- Every task this produces carries `source: DERIVED` in the Progress Ledger,
  permanently — even after approval. Approval means "execute this," not
  "this is now indistinguishable from a real WORK_PLAN document."

## Step 1 — Requirements analysis

Read `PRODUCT_INTENT`, `BEHAVIOR_SPEC`, and `ARCHITECTURE` (whichever roles
are covered) in full before drafting anything. Extract:

- What was explicitly specified.
- What's implicitly required (standard practices, obvious edge cases the
  spec didn't spell out — flag these as inferred, don't silently promote them
  to "explicit").
- Success criteria per feature — if the source docs don't state one, propose
  one and mark it `[PROPOSED]`.
- Assumptions and constraints you're making because the docs are silent.

**Ground the plan in the codebase before writing it.** For each requirement,
find the nearest existing implementation of the same shape in the codebase
and name it in the plan as the pattern to imitate — a file, module, or
component the task should follow, not reinvent. A plan that names zero
existing files is a plan written as if the codebase were imaginary.

## Step 2 — Task breakdown

Break the work into tasks small enough to run through one PLAN → TEST →
IMPLEMENT → REVIEW → VERIFY → REMEMBER cycle each. For each task:

- A clear, specific action (not "build the auth system" — "add POST
  `/api/login` route with email+password validation").
- The file(s) it's expected to touch.
- Estimated complexity/size, honestly — if a task clearly needs more than one
  session, split it here, before it ever reaches Stage 1 PLAN.
- Risk level (Low/Medium/High) — anything touching auth, payments,
  migrations, personal data, or permissions is High by the same rule
  `execution-loop.md` uses for CCL auto-trigger.

## Step 3 — Dependency identification between tasks

For every task, state:

- What it depends on (None, or "requires task X").
- What depends on it, if relevant to sequencing.

Order tasks by dependency, not by guesswork:

1. Types / interfaces / schema first.
2. Core logic.
3. Integration layer.
4. UI.
5. Tests (note: this is plan-level *sequencing of task groups*, not a
   license to skip TEST-before-IMPLEMENT inside any one task — that rule in
   `execution-loop.md` Stage 2 still applies per task).
6. Docs.

Group related changes to minimize context switching, and prefer phasing that
lets each phase ship independently — a plan that requires every phase to
land before anything works is a red flag, not a plan.

## Step 4 — Risk flagging

Call out explicitly, per task or per phase:

- **Risk**: what could go wrong (webhooks arriving out of order, a migration
  locking a large table, an ambiguous requirement two docs disagree on).
- **Mitigation**: what reduces it.

A derived plan with no risks flagged is more likely under-thought than
actually risk-free — re-check before presenting it that way.

## Output format

```markdown
# PROVISIONAL TASK PLAN [DERIVED — NOT APPROVED] — [Project Name]
Derived from: [doc, role, version — one line each]. WORK_PLAN role: MISSING.

## Assumptions
- [assumption] — inferred from [source], not stated explicitly

## Task Breakdown

### Phase 1: [Phase Name]
| Task | File(s) | Depends on | Risk | Acceptance criteria |
|------|---------|------------|------|----------------------|
| T-1  | ...     | None       | Low  | ...                  |
| T-2  | ...     | T-1        | Medium | ...                |

### Phase 2: [Phase Name]
...

## Risks & Mitigations
- **Risk**: [description]
  - Mitigation: [approach]

## Open Questions Raised by This Plan
- [anything the source docs didn't answer that this breakdown surfaced]
```

## Presenting the plan for approval

Show the full breakdown, then ask explicitly — do not bury the approval ask
inside a longer message:

*"Ini rencana kerja turunan (DERIVED), belum disetujui. Boleh saya lanjut
eksekusi, ada yang mau diubah/ditolak dulu?"*

Handle the three outcomes:

- **Approve as-is** → the plan enters `00-master-plan.md` / the Progress
  Ledger, each task still tagged `source: DERIVED`, execution proceeds from
  Phase 3.
- **Amend** → apply the requested change, re-show the affected section (not
  the whole plan again), re-ask for approval on just that section.
- **Reject** → do not execute any task from it. Ask whether the user will
  supply a real `WORK_PLAN` document instead, or run the upstream Architect
  tool.

Record the outcome (approved / amended-then-approved / rejected) in
`01-decision-register.md` — a derived plan that got approved is itself a
binding decision with a source (this conversation), not something to
re-litigate next session.

## Self-contained context briefs (multi-session plans)

For a plan spanning multiple sessions or multiple agents, each step should
carry a **self-contained context brief** — enough that a fresh agent with
no memory of prior sessions can execute it "cold": the specific files
relevant to that step, the binding decisions that constrain it (pointers
into `01-decision-register.md`, not restated in full), and a concrete
definition of done. A step that only makes sense to the agent who wrote the
plan is not actually plannable across a session boundary.

**Parallel-step detection.** While deriving the plan, mark which steps have
no data dependency on each other — these are the candidates for the
multi-agent dispatch pattern in `agent-harness.md`, rather than discovering
parallelizability ad hoc when execution starts.

**Mid-plan mutation protocol.** When new information forces a change to an
already-derived plan: update the plan document itself (don't silently
diverge from it in execution), note what changed and why inline, and
re-check any step whose context brief assumed the old shape. A plan that
drifts from its own document without a note is indistinguishable from one
that was never followed.
