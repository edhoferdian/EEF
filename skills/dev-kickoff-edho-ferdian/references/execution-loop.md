# Execution Loop, Snapshot & Recovery

Reference for Phase 3 and Phase 4 of dev-kickoff-edho-ferdian v3.0.

Every task runs: **PLAN → TEST → IMPLEMENT → REVIEW → VERIFY → REMEMBER →
IMPROVE.**

## Auto-invocation contract (v3.0)

This skill orchestrates; it does not re-implement a sibling skill's
specialty inline. At any stage where a matching specialist skill exists in
this ecosystem, **invoke it** (via the Skill tool, mid-task, the same way
you would if the user had asked for that specialty directly) rather than
producing the same category of work from general knowledge alone. This is
not optional politeness — a stack-specific idiom check from
`language-code-review-edho-ferdian`'s lens catches things generic review
prose does not, the same way a human team pulls in the person who actually
owns that surface instead of guessing.

**How to detect which skill applies, per stage:**

| Stage | Detect | Invoke |
|---|---|---|
| PLAN (feature-level) | New module/component, or a system-shaped decision (data flow, service boundary, scaling) | `system-design-edho-ferdian` |
| PLAN (API-shaped) | Task adds/changes an HTTP/GraphQL/RPC contract | `api-design-edho-ferdian` |
| TEST | Any task with TEST not skipped | `test-authoring-edho-ferdian` (stack-specific reference for the stack actually in scope) |
| IMPLEMENT (frontend) | Touched files are UI/component/client-side | `frontend-engineering-edho-ferdian` |
| IMPLEMENT (backend) | Touched files are server-side services, jobs, queues | `backend-engineering-edho-ferdian` |
| IMPLEMENT (API surface) | Touched files define/change endpoints or contracts | `api-design-edho-ferdian` |
| IMPLEMENT (data layer) | Touched files are schema, migration, ORM, query | `data-layer-patterns-edho-ferdian` |
| REVIEW | Any completed IMPLEMENT | `code-review-edho-ferdian`; add its stack lens via `language-code-review-edho-ferdian` when the stack has one |
| REVIEW (HIGH-RISK) | Auth, payments, migrations, personal data, permissions | `security-review-edho-ferdian`, in addition to the above |
| REVIEW (E2E-shaped) | A user-facing flow with multiple state-changing steps | `e2e-testing-edho-ferdian` or `click-path-audit-edho-ferdian` |
| VERIFY (build fails) | Any gate in the Stage 5 order fails | `build-fix-edho-ferdian` |
| IMPROVE | See Stage 7 below | `skill-audit-edho-ferdian`, `dead-code-cleanup-edho-ferdian`, `performance-audit-edho-ferdian` |

**Skip rule.** A stage may proceed without invoking the matching skill only
with a stated reason in the task's Reflection block — "no specialist skill
exists for this surface yet" is a valid reason; silence is not. This mirrors
the existing stage-skip rule below and is not a separate, softer standard.

---

## Stage 1 — PLAN

1. Restate: "Task [id] — [name]. Sprint [n]. Dependencies: [status].
   Acceptance criteria: [from WORK_PLAN; if absent, derive from BEHAVIOR_SPEC
   / PRODUCT_INTENT and label DERIVED]."
2. Dependency pre-check. Unmet dependency → refuse this task, offer the
   nearest unblocked one.
3. State the files you intend to create or modify, and the shape of the change
   in 3–6 lines. For anything beyond a trivial edit, get the user's "lanjut"
   before writing code. A wrong plan caught here costs one message; caught at
   VERIFY it costs the whole task.
4. Big-task check: if this clearly needs more than one session, split it now
   and say so.

**Blueprint escalation (feature-level tasks only).** Adapted from ECC
`code-architect`, fetched 2026-09-04. If this task creates a new
module/component, or touches more than a handful of files, produce a
lightweight blueprint before writing any test:

- **Files to Create** / **Files to Modify** — two short lists, one line each.
- A dependency-ordered **build sequence**: types/interfaces → core logic →
  integration → UI → tests → docs. Skip stages that don't apply; don't
  reorder them.

**Threshold — this does not fire for small fixes.** A one- or two-file bug
fix, a config tweak, or a small edit inside an existing module does not need
a blueprint; the Stage 1 restatement (steps 1–3 above) is already enough.
Reserve this for genuinely feature-level work — new modules, new
components, or a change fanning out across several files — where skipping
straight to TEST risks discovering the shape of the feature mid-implementation
instead of before it.

**Search before you build.** Before writing new code, confirm an existing
implementation was actually searched for, not just assumed absent. The order
is cheapest-and-most-authoritative first:

1. **Existing code search** — `gh search repos` / `gh search code` for a
   proven implementation, template, or pattern. Prefer porting or wrapping
   something that already solves 80% of the problem over writing it new.
2. **Primary library docs** — resolve the library id, then query it, to
   confirm API behaviour and version-specific details. Cap at three lookup
   calls per question; past that, state the uncertainty instead of guessing.
   Redact keys, tokens, and personal data from any query before sending it.
3. **Package registries** — npm, PyPI, crates.io. A battle-tested dependency
   beats hand-rolled utility code, unless the dependency's surface is far
   larger than the need.
4. **Broad web search** — only after 1–3 come up short.

State the result of this search in the plan, even when it is negative
("searched npm and GitHub for a debounced-queue helper; nothing matched the
back-pressure requirement, writing it"). An unstated search is
indistinguishable from a skipped one.

**Verify library/API behavior from live docs, not memory.** Adapted from
ECC `documentation-lookup`, fetched 2026-09-04. Resolve the library id
first, then query with the user's actual question. Cap it at three lookup
calls per question — after that, state the uncertainty rather than
guessing. Redact keys, tokens, and personal data from the query before
sending it.

## Stage 2 — TEST (write the failing test first)

**What TEST is not:** it is not a review of the plan. The plan is checked
inside Stage 1 (steps 3–4) and, for high-risk work, again in REVIEW. TEST is
where the acceptance criteria stop being prose and become something executable
that can fail. Prose can be satisfied by an agent's opinion; a failing test
cannot.

Write the test that encodes the acceptance criteria, run it, and **show the
RED output**. A test that has never failed proves nothing.

**What counts as a valid RED.** Adapted from ECC `tdd-workflow`, fetched
2026-09-04. "The test failed" is not automatically RED. A RED gate is valid
only when one of these two paths holds:

- **Runtime RED** — the test target compiles, the new or changed test is
  actually executed, and the result is a failure.
- **Compile-time RED** — the new test references or instantiates a code path
  that does not exist yet, and the compile/type error *is* the intended
  failure signal.

In both cases the failure must be caused by the missing implementation or the
bug under test — **not** by an unrelated syntax error, a broken test harness,
a missing dependency, or a pre-existing regression somewhere else. A test that
was written but never compiled and never run does not count as RED at all, and
IMPLEMENT may not start on that basis.

**Checkpoint commits (git repos only).** When the repo is under git, the
minimal task-level trail is three commits on the *current active branch*:

| Stage | Commit message shape | What it proves |
|-------|----------------------|----------------|
| after RED validated | `test: add reproducer for <feature/bug>` | the failing test existed before the fix |
| after GREEN validated | `fix: <feature/bug>` | the same test target was re-run and passed |
| after refactor (optional) | `refactor: clean up after <feature/bug>` | behavior unchanged, suite still green |

Rules: no separate evidence-only commits are needed; do not count commits from
other branches or earlier unrelated work as checkpoint evidence; verify each
checkpoint is reachable from the current `HEAD` before moving on. If these
commits will be squashed on merge, copy the RED/GREEN summary into the PR body
first — squashing must not destroy the proof.

Before writing the test, check the acceptance criteria against the 8-category
edge-case checklist in `references/test-design-checklist.md` (null/undefined,
empty collections, invalid types, boundary values, error paths, race
conditions, large data, special characters) and avoid the 4 test
anti-patterns listed there. Not every category applies to every task, but a
skipped category should be a stated call, not an oversight.

Escape hatches — allowed, but each must be named in the Reflection block with
its reason:

| Situation | What to do instead |
|-----------|--------------------|
| No test infrastructure exists yet | Make "set up the test harness" the current task, then return |
| Task is pure config / scaffolding / docs | Skip TEST; define a concrete manual verification step instead |
| Visual or layout work | Skip automated TEST; define the visual acceptance check and screenshot/inspection step |
| Test framework not chosen (PDR §3 silent) | STOP — this is a binding decision; ask the user |

"There's no time" and "it's obvious" are not on this list.

## Stage 3 — IMPLEMENT

Real code until the test passes. No pseudocode, no `// implement later`.
Follow PDR §3 conventions. Do not edit the test to make it pass — if the test
is wrong, say so explicitly and fix it as a separate, stated step.

If implementation forces a decision not in the PDR → **STOP**, propose it with
options and a recommendation, wait for approval, record it in
`01-decision-register.md`, then continue. The register is living, not frozen.

## Stage 4 — REVIEW (fresh context)

The reviewer must not reuse the implementer's reasoning. If subagents are
available, run the review as a separate agent; otherwise role-play it
deliberately and say which you did.

Review targets, in order: does it meet the acceptance criteria · does it
violate any PDR decision, non-goal, or domain rule · how does it fail or get
abused · is there a simpler correct implementation · error handling and edge
cases · hardcoded secrets.

**Optional scorecard pass.** Before or alongside the review targets above, you
may run the 5-axis Output Scorecard (Accuracy/Completeness/Clarity/
Actionability/Conciseness) from `references/output-scorecard.md` — useful
when the task is non-trivial enough to want a structured second read. It is
optional, not mandatory, but its result feeds the CCL trigger below when run.

**Critique-Correction Loop (CCL).**
- **Auto-trigger** for HIGH-RISK tasks: auth, payments, database migrations,
  personal-data handling, credit/quota logic, anything touching permissions.
- **Auto-trigger** whenever an Output Scorecard pass was run and any axis
  scored ≤2 — see `references/output-scorecard.md`. This applies even to a
  task that is not otherwise HIGH-RISK.
- Opt-in otherwise.
- **Critic** attacks; **Corrector** accepts or rejects each critique with
  reasoning and revises.
- **Hard cap: 2 rounds.** Stop early on convergence. Only
  correctness/security/behavior disputes justify round 2 — never style.
  Unresolvable disagreement → surface both views with a recommendation; do not
  force a fake resolution.
- End state: RESOLVED or ACCEPTED-WITH-NOTES.

## Stage 5 — VERIFY (tool output or it didn't happen)

Run the real tooling: build, linter, type-checker, and the full relevant test
suite — not just the new test. Paste the outcome.

**Gate order — run sequentially, stop at first failure.** Adapted from ECC
`commands/prp-implement.md` Phase 4, fetched 2026-09-06. Run the gates in
this order and stop as soon as one fails; fix it, then restart from that
same gate rather than pushing ahead:

1. **Static analysis** — type-checker/linter, zero type errors.
2. **Unit tests.**
3. **Build.**
4. **Integration tests.**

Running integration tests on top of a red typecheck wastes time on a
failure whose cause is already known — fix the cheap gate first.

For a concrete, stack-specific command set (currently Django; more planned),
see `references/stack-verification.md` — this stage stays deliberately
stack-agnostic here.

**Guarantee table (for tasks worth an explicit record).** For a task big
enough that "tests pass" is too coarse a summary — a sprint-closing task, a
HIGH-RISK task, or anything whose proof must survive a squash merge — record
what the passing tests actually guarantee, in plain language, alongside the
raw tool output:

| # | What is guaranteed | Test file / test name | Type | Result | Evidence command |
|---|--------------------|-----------------------|------|--------|------------------|
| 1 | Empty search returns an empty list without throwing | `src/search.test.ts:returns empty list for empty query` | unit | PASS | `npm test -- search.test.ts` |
| 2 | API rejects an invalid `limit` with HTTP 400 | `src/api/route.test.ts:validates query parameters` | integration | PASS | `npm test -- route.test.ts` |

This table goes into the Stage 6 snapshot in `03-progress.md`, not into a
separate document. Quote real commands and real outcomes; never write PASS for
a test that was not run. Intentional gaps (a skipped case, an untestable
boundary) are listed here explicitly rather than left unstated.

Confidence labels: tool-confirmed → **[High confidence]**; sound reasoning,
not tool-verified → **[Medium confidence]**; depends on runtime data or
external behavior you can't see → **[Low confidence] — needs verification**.

Never fabricate tool output. If a tool can't run in this environment, say so
plainly and mark the task `VERIFIED: NO — [reason]`. An unverified task may
not be reported as done.

Regression rule: if the full suite was green before this task and is not green
now, the task is not done, regardless of whether the new test passes.

## Stage 6 — REMEMBER

In the same turn, not "later":

1. Update `03-progress.md`: ledger (done / in-progress / next) + new snapshot
   at the top.
2. Update `01-decision-register.md` if a decision was added or changed.
3. Move any resolved open question in `02-gap-analysis.md` to resolved, dated.
4. **Instincts** — if this task produced a lesson that will apply again
   (a repo-specific gotcha, a pattern that failed, a convention the docs
   never stated), append it to `04-instincts.md`:

```
| # | Instinct | Trigger (when it applies) | Evidence (task id) | Confidence |
|---|----------|---------------------------|--------------------|------------|
| I3 | Supabase RLS policies must be added in the same migration as the table | any new table | T-018 | High |
```

Rules for instincts: one real observation each, tied to a task id. No generic
engineering advice — "write clean code" is not an instinct. Three or more
related instincts pointing the same way → propose promoting them into PDR §3
conventions, where they become binding.

**Instinct confidence.** Adapted from ECC `continuous-learning-v2`, fetched
2026-09-04. A new instinct starts at **Low** confidence on first
observation. It rises to **Medium** once it holds again on a different
task, and to **High** after a third occurrence or an explicit user
confirmation. It **drops** when a later event contradicts it — record the
contradiction explicitly ("contradicted by TASK-XXX on <date>") rather than
silently deleting the entry; a discredited instinct is still information.

**Scope.** Instincts default to **project-scoped** (this repo's
`04-instincts.md`). Only a **High**-confidence instinct that is clearly not
specific to this repo gets proposed for promotion to a global layer — this
guards against cross-project contamination from something that only held
true here by coincidence.

**Second instinct source — repeated correction within a session.** Instincts
are not only harvested from completed task outcomes. If the user has to make
the same correction more than once within a single session — a repeated
"no, not like that" on the same point — that repetition is itself an instinct
candidate, tied to the turn/interaction rather than to a completed task id,
and should be proposed for `04-instincts.md` even mid-task, without waiting
for REMEMBER to close out a task.

**Instinct quality bar.** Adapted from ECC `growth-log`, fetched 2026-09-06.
An instinct is a *pattern*, not an event. Four checks before an entry is
allowed into `04-instincts.md`:

1. **Name the pattern, not the event.** "Fixed the auth bug" is a diary
   line. "Browser default changes silently break existing cross-origin
   behavior" is an instinct. If the entry could be reconstructed from the
   git log, it is not an instinct yet.
2. **Search before writing (dedup rule).** Grep existing instincts for the
   root cause first. Same root cause with a different symptom → **add the
   new symptom to the existing entry**, do not create a second one. New
   root cause → new entry. Two entries for one cause defeat the trigger
   column, because neither fires reliably.
3. **The transferable sentence is mandatory.** Every entry must support
   "next time I see `<signal>`, I will `<action>`." The `<signal>` is the
   Trigger column; if you cannot name an observable signal, you have
   recorded a story, not a pattern.
4. **Root cause, not symptom.** Ask "why" until the mechanism appears —
   usually three to five times. Length calibration: if the entry took more
   than two minutes to write you are narrating events; under thirty
   seconds and you stopped at the symptom.

**Failures outrank successes.** One bug that took two hours to find carries
more transferable signal than three features that worked first try. When
deciding what to record, prefer the thing that went wrong.

**One canonical home per fact set.** Adapted from ECC `knowledge-ops`,
fetched 2026-09-06. Before creating any new memory artifact, search whether
the fact already lives in the decision register, the progress ledger, or
the instincts file, and update that instead. Parallel copies of the same
fact across files are the failure mode this ecosystem is most exposed to,
because every one of them looks authoritative.

## Stage 7 — IMPROVE

**What IMPROVE is not.** It is not a second REVIEW (Stage 4 already gated
correctness before VERIFY) and it is not REMEMBER (Stage 6 already recorded
the fact). IMPROVE is where a recorded fact is allowed to change something —
without it, `04-instincts.md` and `01-decision-register.md` accumulate
observations that never feed back into the actual code or process, which
defeats the point of recording them at all.

Run these checks, in order, once REMEMBER has closed for the task:

1. **Instinct-promotion check.** Re-read the instinct just written (or
   updated) in Stage 6. Does it now have 3+ occurrences, or an explicit user
   confirmation? If Stage 6's own promotion rule already fires, execute the
   promotion here — write the new PDR §3 convention — don't leave it as a
   dangling "propose promoting" note.
2. **Cheap-refactor check.** If IMPLEMENT left an intentional shortcut
   (named as such in the Reflection block, not a silent one) that is now
   cheap to clean up because the surrounding code is already open and fresh
   in context, do it now — before the diff is closed and reopening it costs
   a fresh context load. If the shortcut is not cheap right now, leave it
   named as debt in `02-gap-analysis.md` rather than force it.
3. **Dead-code signal.** If IMPLEMENT or REVIEW surfaced code that is now
   unreachable (an old code path fully replaced, a flag that's always the
   same value post-change), invoke `dead-code-cleanup-edho-ferdian` rather
   than leaving it — a task that adds code without removing what it made
   obsolete is only half done.
4. **Performance signal.** If VERIFY's tool output showed a real regression
   (build time, bundle size, a slow test) that Stage 5 correctly didn't
   block on (it wasn't a correctness gate), invoke
   `performance-audit-edho-ferdian` to size it — don't silently carry it
   forward unmeasured.
5. **Periodic ecosystem health.** Every sprint boundary (not every task —
   see the EDHO SCAN item below), invoke `skill-audit-edho-ferdian` if this
   session touched or leaned on this repo's own `skills/` content, to catch
   drift before it compounds across many tasks.

Each of the five checks above is a **check**, not a mandatory action — most
tasks will find nothing to do at several of them, and that's the expected
outcome, not a failure. What IMPROVE forbids is skipping the check itself
without saying so; "checked, nothing applied" is a valid Stage 7 outcome,
"didn't look" is not.

## Per-task Reflection (9 gates)

```
CATATAN REFLEKSI — TASK [id]
Gate 1: All acceptance criteria met?                          [.]
Gate 2: Test written before implementation (or escape hatch
        named with reason)?                                   [.]
Gate 3: PDR §3 conventions followed?                          [.]
Gate 4: No NON-GOALS territory touched?                       [.]
Gate 5: Error handling & edge cases present? — checked against
        the 8-category checklist in
        references/test-design-checklist.md, not vague judgment [.]
Gate 6: No hardcoded secrets/credentials?                     [.]
Gate 7: Full verification run — real tool output, not eyeball?[.]
Gate 8: Memory files + snapshot updated this turn?            [.]
Gate 9: IMPROVE checks run (1-5 above), each explicitly
        checked-and-skipped or checked-and-acted-on?          [.]
```

Any FAIL → fix before moving to the next task, or record it explicitly as
accepted debt in `02-gap-analysis.md`.

## EDHO SCAN — per sprint

- [ ] Task order followed the plan, or deviations were logged + approved
- [ ] No task started before its dependencies finished
- [ ] Every new decision entered `01-decision-register.md`, not just chat
- [ ] Every HIGH-RISK task went through CCL
- [ ] Every completed task has real verification output behind it
- [ ] Progress Ledger matches reality
- [ ] Memory files (01/02/03/04) are not lagging behind actual state
- [ ] `skill-audit-edho-ferdian` ran this sprint if this repo's own
      `skills/` content was touched or leaned on
- [ ] No instinct sat at 3+ occurrences without a promotion decision

## Anti-pattern detection (warn the user when detected)

| Anti-pattern | Signal |
|--------------|--------|
| Sprint-skipping | Asked for a sprint-5 task while sprint 2 is unfinished |
| Silent scope creep | A "small" feature not in any source doc requested mid-task |
| Register drift | Code deviating from PDR decisions without updating the register |
| Snapshot debt | >3 tasks completed without a fresh snapshot |
| Big-bang task | One task that clearly needs >1 session — split before starting |
| Test theatre | Tests written after the code, or a test that never failed |
| Green-by-deletion | Suite passes because a test was weakened or removed |
| Verification bypass | Task marked done with no tool output |
| Rationalized shortcut | The turn contains "skip tests for now", "pre-existing bug", "already broken", or "good enough for now" — surface signals that a gate was talked past rather than passed |
| Unplanned diff | A file appears in `git diff --name-only` that was never listed in the Stage 1 plan |

---

## Phase 4 — Session Snapshot format (English, < 1 page)

```
# SESSION SNAPSHOT — [Project Name]
Snapshot #: [n] | Timestamp: [date/time] | Mode: [A/B/C]

## STATE
- Sprint [n]/[total], Task [id] — [status: done / in-progress at stage X]
- Tasks completed this session: [ids]
- Files written: [paths + one-line purpose each]
- Last verification: [build/lint/test result + when]

## DECISIONS ADDED/CHANGED SINCE LAST SNAPSHOT
- [Dx: decision — rationale]  (or "none")

## INSTINCTS ADDED
- [Ix: ...]  (or "none")

## OPEN THREADS
- [pending questions/decisions, if any]

## WHAT DID NOT WORK (and why)

For each dead end: what was tried, what happened, and the reason it failed.
Without this, the next session re-runs the same failed approach — this is
the single most expensive thing a snapshot can omit, because a dead end that
is not written down looks exactly like an untried idea.

## NOT YET TRIED

Approaches considered and consciously deferred, with the reason. Separating
"failed" from "not yet attempted" is what stops a resumed session from
either repeating a failure or skipping a viable option because it assumed
someone already checked.

## RESUME COMMAND
Filesystem: open the repo, read CLAUDE.md + /project-memory/, continue from
the task above at stage [X]. Chat: paste this snapshot + the Execution Context
Pack into a new session and say "resume".
```

Snapshot triggers: task completed · sprint end · new decision recorded · any
interruption you can anticipate. Latest snapshot always at the top of
`03-progress.md`; in pure chat, also emit it as a paste-ready block.

## Resume protocols (Mode C)

**Path 1 — Filesystem (Claude Code / Cursor / repo access):**
1. Read `CLAUDE.md`/`AGENTS.md` + all of `/project-memory/` — primary source
   of truth. A pasted snapshot is supplementary.
2. Cross-check `03-progress.md` against the actual repo: do the claimed files
   exist, does the build still pass, does the test suite still pass?
   Discrepancy → report it; **reality wins**, log it in the next snapshot.
3. Resume mid-loop, not mid-air: if the last task stopped after IMPLEMENT,
   restart it at REVIEW, not at PLAN and not at the next task.
4. Confirm: "Resuming Task [id] at stage [X]. Benar?" → continue Phase 3.

**Path 2 — Pure chat (no filesystem):**
1. Require BOTH the snapshot and the Context Pack. Snapshot alone is state
   without decisions — blind execution. Ask for the missing piece.
2. Sanity-check: does the in-progress task exist in the plan? Is the snapshot
   number plausible in sequence?
3. Reconstruct the Progress Ledger, confirm the resume point and stage,
   continue Phase 3.

**State-corruption rule:** whenever records and reality conflict — reality
wins, and the discrepancy is written into the next snapshot so the history
stays honest.
