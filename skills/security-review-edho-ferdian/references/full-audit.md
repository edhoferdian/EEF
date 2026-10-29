# Mode C — Full audit before production

A whole-repository audit with a coverage ledger, independent verification
and machine-checked output, sized to stay cheap. Adapted from
[cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill)
(MIT, commit `c1c8a8c`, fetched 2026-10-29); what changed and why is listed
at the end. The vendored validators and schema live in `../scripts/`.

**Use it for:** "audit menyeluruh", "full security audit", "audit sebelum
production", "pen-test this codebase", or the security lens of
`deployment-ops-edho-ferdian`'s production-readiness verdict. **Not for** a
diff or a few files — that is Mode A (or Mode B inside a code review). If
the ask could mean either, ask one question before writing anything.

Mode C reads source and runs the Phase 2 scanners. It **never executes the
target's own code** (builds, tests, servers, fixtures): there is no
OS-enforced sandbox to assume, least of all on Windows. Anything only
runtime behaviour could settle becomes Needs validation.

## Step 0 — Storage guard (before the first write)

Every artifact goes to `project-memory/audit/run-NNN/` (`NNN` = next unused
number, zero-padded). Audit output is a map of the project's weaknesses, so
it must never reach a commit — even in projects that commit the rest of
`project-memory/`. Before creating anything:

```bash
git check-ignore -q project-memory/audit/probe && echo ignored
git ls-files project-memory/audit
```

- **Ignored and nothing tracked** → proceed.
- **Not ignored** → stop. Show the user the line `project-memory/audit/` to
  add to `.gitignore` and write it only on their yes.
- **Files already tracked** → stop and say so. Untracking them
  (`git rm --cached`) and scrubbing history is the user's call, never done
  silently.
- **Not a git repository** → ask for an output directory outside the
  project instead.

## Step 1 — Setup and plan

Write `run-metadata.json`: `run_id`, `repo`, `target`, `source_ref` (commit
and whether the tree is dirty), `profile: "eef-lean"`, `scope_paths`,
`execution_policy: "source-only"`, `selected_references`, `prior_runs`,
`agents` (`planned`, `ceiling`, `spent`, `reason`), `run_status:
"in_progress"`. The parent (the thread running Mode C) is the only writer
of every shared file in the run directory.

## Step 2 — Reconnaissance (inline, no agents)

Cloudflare spends four agents here; this mode does it in the parent's own
context, because the parent needs the map anyway to plan the hunt. Write
`architecture.md` (about 1,000 words at most):

1. Product, principals (anonymous, user roles, tenants, operators, CI,
   webhooks, model/tool output), and the resources worth protecting.
2. Stack — reuse Phase 0's detection; do not redo it.
3. Entry surfaces → important sinks: HTTP routes, RPC/queues/webhooks,
   file and archive input, CLI/env/config, plugins and dependencies, CI,
   model context and tool arguments, deep links, local IPC.
4. Trust boundaries and the strongest source-visible control on each.
5. Facts the source cannot show (proxy, CDN, provider settings, platform
   headers, IdP policy) — the future Needs-validation blockers.
6. Prior runs, `RECHECK-*.md` results and `review-log.md` lines (Step 3).
7. Selected references and why each applies — chosen because recon found
   the boundary a section describes, not because a dependency name appears.

Run the Phase 2 scanners once here and keep their output as evidence.

## Step 3 — Coverage ledger

`coverage-ledger.json` follows the upstream contract exactly, because
`validate-coverage-ledger.cjs` enforces it. One unit per material
combination of **surface × boundary × subsystem × attack class**; keep
subsystems coarse (a top-level package or directory) — this is what keeps
the unit count, and therefore the hunt, small.

Each unit carries `coverage_id`, `canonical_refs` (`surface`, `boundary`,
`subsystem`, `attack_class`, plus `lifecycle` when material), the same four
labels as human text, `starting_paths`, `ordinary_attack_class_block`,
`selected_companion_blocks`, `excluded_blocks` (each with a reason),
`prior_status`, `attempts`, `wave`, `status`, `agent_id`, `reviewed_paths`,
`local_checks`, `result_fingerprints`, `unresolved`.

- **`canonical_refs`** are stable source identities, e.g.
  `src/router.ts#POST /users/:id`, `src/authz.ts#requireOwner`,
  `packages/api`, and for the class a block reference such as
  `full-audit-attack-classes.md#Access control` or
  `general-checklist.md#SEC-17`.
- **`coverage_id`** = each ref (NFC, no control characters, no surrounding
  space) percent-encoded as UTF-8, leaving only `A-Z a-z 0-9 - . _ ~`
  unescaped with uppercase `%HH`, joined with `::` in the order surface,
  boundary, subsystem, attack_class (then lifecycle). No line numbers,
  waves, agents or verdicts in an ID.
- **State table** (the validator enforces it):

| Status | `agent_id` | `reviewed_paths` / `local_checks` | `result_fingerprints` | `unresolved` |
|---|---|---|---|---|
| `planned` | null | empty | empty | empty |
| `not_applicable`, `out_of_scope`, `deferred` | null | empty | empty | reason |
| `in_progress` | owner | empty | empty | empty |
| `blocked` | owner | both non-empty | empty | blocker |
| `covered` | owner | both non-empty | empty | empty |
| `candidate` | owner | both non-empty | non-empty | optional |

- Agent IDs are lowercase `^[a-z0-9][a-z0-9_-]{0,63}$`; inline work by the
  parent uses `parent`. Every check uses `method: "source"` and
  `artifact: null` — this mode produces no execution artifacts.

**Prior runs** (read every earlier `run-*/` first):

- A prior `confirmed` record whose source is unchanged is carried with its
  fingerprint and re-checked by the verifier; hunters skip that root cause.
- Changed source behind a prior record, a `RECHECK` that marked a
  fingerprint resolved, and every prior `needs_validation`, `deferred` or
  `blocked` unit become current work — they never suppress a unit.
- A prior `rejected` record suppresses only that exact unchanged claim.
- `review-log.md` paths reviewed since the last audit only lower a unit's
  rank in a tie. A diff review is not audit coverage; never mark a unit
  `covered` from it.

Validate after seeding and after every update:

```bash
node <skill-dir>/scripts/validate-audit.cjs ledger project-memory/audit/run-NNN/coverage-ledger.json
```

## Step 4 — Decide the agent count, say it, then run

The default ceiling is **5 agents**. It is a ceiling, not a target: plan the
smallest number that covers the ledger and state it, with the reason,
before launching anything — e.g. *"3 agents: 2 hunters for auth/ and
payments/, 1 verifier; the rest is small enough to hunt inline."*

| Role | When | How many |
|---|---|---|
| Hunter (`security-hunter-edho-ferdian`, standard tier) | a high-risk subsystem group too large to hunt well inline | 0–3; **0 for a small repo** — the parent hunts inline |
| Verifier (`security-verifier-edho-ferdian`, standard tier) | any candidate exists | **1**, all candidates in one batch |
| Escalated verifier (same agent, one tier up) | a proposed CRITICAL or HIGH | +1, those candidates only |
| Coverage critic | always | inline in the parent (not independent — say so in the report) |

- **More than 5 needs the user's yes** before launch; never grow silently.
- **One independent verifier is never cut** while a candidate exists — the
  one who checks a finding is never the one who found it.
- If the ceiling cannot reach every unit, defer the lowest-ranked units
  with reason `budget_ceiling` and disclose them.
- Rank units: (1) unauthenticated or lowest-trust surfaces first; (2)
  boundaries guarding credentials, cross-tenant data, code execution or
  release authority; (3) changed source, prior gaps and revalidation; (4)
  classes that usually yield real findings for this kind of target. Break
  ties by `coverage_id`.
- On Claude Code, the escalated verifier is the same agent with
  `model: "opus"` on that Agent call. On a harness without delegation, do
  everything inline and state in the report that no independent
  verification happened — the run is then **incomplete** for every
  CRITICAL/HIGH candidate.

Record `agents.planned` and `agents.reason`; update `agents.spent` as you go.

## Step 5 — Hunt

Each hunter (or the parent, inline) gets: `architecture.md`; its assigned
units with refs and `starting_paths`; the selected class blocks copied in
full from `full-audit-attack-classes.md` and the applicable reference
sections (never just their names); excluded blocks with reasons; the method
below; and the result contract. Hunters are read-only and return one JSON
object.

**Method.** Read the code at depth: follow each input through parsing,
identity, authorization, normalization, stored copies and the final sink,
including sibling, legacy, batch, retry, error and migration paths to the
same effect. Work from a concrete invariant — the six slots of the
Boundary-and-result gate in `general-checklist.md` — and stop a line of
inquiry as soon as it is settled either way. Test sad paths the interface
accepts: empty, zero, negative, maximum, duplicate, mixed encoding, stale,
revoked, reordered, concurrent. When a CRITICAL/HIGH root cause appears,
search the assigned units for its variants. A fact outside the source is
not proof either way.

**Result contract** (exactly one JSON object, no prose):

```json
{
  "units": [{
    "coverage_id": "one assigned ID",
    "disposition": "covered|candidate|blocked",
    "reviewed_paths": ["repo/relative/path"],
    "checks": [{"agent_id": "hunter-auth", "reviewed_paths": ["..."],
                "invariant": "control checked", "method": "source",
                "result": "what the source established", "artifact": null}],
    "candidate_fingerprints": [],
    "unresolved": []
  }],
  "candidates": [],
  "hardening": ["defense-in-depth note, not a finding"],
  "uncovered": [{"surface": "...", "boundary": "...", "subsystem": "...",
                 "attack_class": "...", "starting_paths": ["..."], "reason": "..."}]
}
```

Each candidate is a `report-schema.json` record with `proposed_verdict`
(`confirmed` or `needs_validation`) in place of `verdict`. Fingerprints are
source-derived (`^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$`, no line, agent, wave,
severity or verdict) and stay the same for the same root cause in every
state. The parent copies each unit result into its ledger unit, keeps
`hardening` notes in a bookkeeping field, turns `uncovered` into new units,
merges candidates by fingerprint and then by root cause, and re-validates
the ledger.

## Step 6 — Coverage critic (inline, one pass)

Before verification, check the ledger against the source for: entry points
with no unit, parallel paths to the same effect left unchecked, missing
lifecycle modes (create/update/delete/restore/export), selected classes with
no unit, exclusions without a source-backed reason, units closed without
paths or checks, and prior gaps nobody picked up. Hunt what you find if the
ceiling allows; otherwise add it as `deferred` with the reason. One pass —
this mode does not loop critics to a clean result.

## Step 7 — Independent verification

Give the verifier every candidate (carried prior records included), each
with its linked unit checks, the architecture facts needed to read the
path, the matching schema branches, and prior records with the same
fingerprint — **not** the hunter's reasoning beyond the record itself. The
verifier tries to refute each one, re-reads every cited line, checks the
strongest control on the path, and returns:

```json
{"decisions": [{"decision": "confirmed|needs_validation|rejected", "record": {}}]}
```

Each `record` matches its schema branch exactly and replaces the hunter's
wording. Proposed CRITICAL/HIGH candidates go to the escalated verifier
instead, whose decision is final for them. A malformed or prose-wrapped
reply is discarded, not repaired; re-run it if the ceiling allows, or leave
those candidates as unresolved ledger candidates and mark the run
incomplete. An unvalidated candidate never enters `findings.json`.

### Confirming without executing (the main adaptation)

Upstream `confirmed` requires an observed local execution result. This mode
cannot execute, so it confirms from source when **every link** from
entrypoint to sink is source-visible and no source-visible control
interrupts it:

- `execution.attacker_perspective` names the lower-trust principal;
  `payloads` holds the minimum input; `instructions` tell the owner how to
  reproduce it locally with dummy data — never against a live system.
- `execution.observed_result` starts with **`Source-traced, not executed:`**
  and states the result the trace establishes, no stronger.
- `confidence.score` is at most `medium`, unless scanner output or an
  existing test in the repo demonstrates the behaviour — then `high`, with
  that evidence cited.
- If the decisive step depends on runtime behaviour the source does not pin
  (a parser quirk, a race window, a framework default, platform config), it
  is `needs_validation`, not `confirmed`.

## Step 8 — `findings.json`

Write every verified record, sorted by fingerprint:

- `confirmed` — `root_cause`, `intended_behavior`, `trace`, `evidence`,
  `conditions`, `execution`, `remediation` (a `strategy`, plus
  `code_changes` when the fix is small and certain), `severity`
  (likelihood, impact, overall — overall never above impact) and
  `confidence`.
- `needs_validation` — `claimed_root_cause`, `trace`, `evidence`,
  `blockers`, and at least one of `validation_plan.local` /
  `validation_plan.deployment`. No severity, execution or remediation.
- `rejected` — `claimed_root_cause`, `trace`, `evidence`, `reason`; kept so
  the next run does not re-raise the same unsupported claim.

A multi-step trace starts at `entrypoint`, ends at `sink`, with
`propagation` between. The JSON scale maps one-to-one onto this skill's
scale: `critical` 🔴, `high` 🟠, `medium` 🟡, `low` 🔵, `informational` ⚪.

```bash
node <skill-dir>/scripts/validate-audit.cjs findings project-memory/audit/run-NNN/findings.json
node <skill-dir>/scripts/validate-audit.cjs ledger   project-memory/audit/run-NNN/coverage-ledger.json
```

Both must pass. Passing proves format and ledger consistency only, not that
a finding is real — that is Step 7's job. (On Windows the wrapper falls back
to a plain checked read because the upstream CLI needs a no-follow open the
OS does not offer; the validation itself is the upstream code.)

## Step 9 — Reports

Derived from the verified records and the ledger only; prose never changes
a verdict or severity.

- **`REPORT.md`** — run facts (scope, source ref, agents planned vs spent
  and why, "source-only, target code not executed", prior runs used,
  deferred and out-of-scope units); a one-paragraph posture summary; a
  confirmed-findings table (severity, title, boundary, one-line result);
  each confirmed finding with location, principal, reproduction,
  conditions, impact, priority and the smallest source fix plus a
  regression test; the Needs-validation table; hardening notes and positive
  patterns; ledger counts (covered, candidate, blocked, deferred) and the
  coverage-critic result, noted as non-independent. A clean run may have
  zero findings — say so, with the remaining coverage limits, and invent
  nothing.
- **`FINDINGS-DETAIL.md`** — every confirmed MEDIUM or above in full: trace,
  evidence, dummy principal and resource, input and steps, result,
  conditions, fix and regression case.
- **`NEEDS-VALIDATION.md`** — a pre-deploy checklist, one `- [ ]` item per
  lead: title, trace, the blocker phrased as a question the owner can
  answer, and the local or owner-observed check. No severity.

The audit describes fixes; it does not apply them. Fixing goes through
`code-review-edho-ferdian`'s Adaptive fix step, with the user's go-ahead
before any file is written.

Finish in one of two states: all reports written and both validators pass
(`run_status: "complete"`), or `run_status: "incomplete"` with the exact
reason, disclosed at the top of `REPORT.md`. Never stop mid-step.

## Re-check after fixes (the cheap follow-up)

"Cek ulang temuan yang sudah diperbaiki" does not re-run the audit. Read the
latest `findings.json`, take the fingerprints the user fixed (or every open
`confirmed`), and give them to **one** verifier with the current source.
Write `run-NNN/RECHECK-YYYY-MM-DD.md`: per fingerprint `resolved`, `still
open` or `changed — needs a fresh audit`, each with file:line evidence.
`findings.json` stays as written; the next full audit reads the RECHECK
files (Step 3) and re-verifies resolved items as changed source.

## Hand-off to production readiness

`deployment-ops-edho-ferdian`'s production-readiness verdict reads the
latest run:

- Any `confirmed` CRITICAL or HIGH not marked `resolved` by a later RECHECK
  caps the score at 49 — **Blocked**.
- `NEEDS-VALIDATION.md` items become Next-action checks on the server; any
  still unchecked are listed under Evidence missing. They do not block on
  their own.

## Review log (feeding Momen 1 into the next audit)

After a Mode A report, or after a code review whose Domain 2 used this
skill (Mode B — whoever writes the host report does this), and **only if
`project-memory/audit/` already exists and passes the Step 0 guard**, append
one line to `project-memory/audit/review-log.md`:

```
- 2026-10-29 a1b2c3d mode-b src/billing/, src/api/invoices.ts — 2 findings (SEC-05, SEC-17), 1 needs-validation
```

Never create the folder from a review, and skip the line when the guard
fails. It costs one append; its only use is Step 3's tie-break.

## What changed from upstream, and why

- **Not ported:** sandboxed execution and the artifact-promotion procedure
  (no sandbox to rely on); the four reconnaissance agents (recon is
  inline); multi-wave hunting with post-wave and final-clean critics (one
  inline critic pass); the `quick`/`standard`/`deep` profiles (one lean
  profile with an agent ceiling); a separate fresh verifier per record in
  Phase 5 (one batch verifier plus an escalated one for CRITICAL/HIGH).
- **Changed:** output lives in a guarded `project-memory/audit/` instead of
  `~/security-audit-skill/`; `confirmed` may rest on a complete static
  trace, marked and confidence-capped as above; severities map onto this
  skill's 5-level scale.
- **Kept verbatim:** `report-schema.json`, both validators, the ledger
  contract and state table, fingerprint rules, the three verdicts, the
  hunter and verifier result shapes, and the additive prior-run rules.
