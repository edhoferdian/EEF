---
name: opensource-release-edho-ferdian
description: >-
  Fork, sanitize, and package a project for open-source release in three
  phases — extract secrets into .env.example rather than deleting them, run
  an independent adversarial audit that never trusts the fork phase's own
  report (PASS/FAIL/PASS-WITH-WARNINGS, hard-gates packaging on FAIL), then
  generate CLAUDE.md/README/LICENSE/CONTRIBUTING/issue-templates. Use when
  the user wants to open-source a project, says "mau open-source-kan ini",
  "siapkan repo ini buat publik", "audit sebelum rilis publik", or "cek
  apakah aman di-publish".
---

# Open-Source Release — Edho Ferdian Mode

You are running a **three-phase release pipeline**: fork/prep, then an
independent adversarial sanitization audit, then packaging. The three phases
are separated on purpose — a project is not safe to publish because the
person who sanitized it says so; it's safe because someone who didn't do
the sanitizing re-checked it from scratch and found nothing.

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract)

- Communication to the user → **Bahasa Indonesia**.
- Report files (`FORK_REPORT.md`, `SANITIZATION_REPORT.md`, generated
  `CLAUDE.md`/`README.md`/etc.) → **English**, matching the base rule's
  artifact clause.
- The Phase 2 PASS-WITH-WARNINGS confirmation prompt to the user is always
  in Bahasa Indonesia (see below) — this is a deliberate exception spelled
  out in `references/sanitize-audit.md`, not an inconsistency. Full
  contract: `skill-authoring-edho-ferdian` §7.

## Phase flow

```
Phase 1  Fork / Prep         → references/fork-prep.md
                                 Copy to staging, detect + extract secrets
                                 into .env.example, replace internal refs,
                                 fresh git history, write FORK_REPORT.md.

Phase 2  Sanitize / Audit    → references/sanitize-audit.md
                                 Independent adversarial re-scan. Does not
                                 trust FORK_REPORT.md. Verdict: PASS / FAIL /
                                 PASS-WITH-WARNINGS. Writes
                                 SANITIZATION_REPORT.md.

Phase 3  Package             → references/packaging-templates.md
                                 CLAUDE.md (this ecosystem's Execution
                                 Context Pack format, <100 lines),
                                 setup.sh, README.md, LICENSE, CONTRIBUTING.md,
                                 GitHub issue templates.
```

Shared reference used by both Phase 1 and Phase 2:
**`references/secret-patterns.md`** — the single source of truth for every
secret/PII regex and the internal-reference replacement map. Neither phase
keeps its own inline copy; both read this file. If you ever find yourself
about to write a regex pattern inline in Phase 1 or Phase 2's instructions,
stop — it belongs in `secret-patterns.md` instead, edited once.

## The hard gate — read this before starting Phase 3

**Phase 3 cannot start while Phase 2's verdict is FAIL.** This is not a
recommendation, it's a hard stop: no `CLAUDE.md`, no `README.md`, nothing
gets generated for a project Phase 2 rejected. Send the project back to
Phase 1 with the specific findings, let Phase 1 fix them, then re-run Phase
2 **in full, from Step 1** — a partial re-audit against only the previously
failing items is not sufficient, because a fix to one file can introduce or
reveal something a full re-scan would catch and a targeted one wouldn't.

**PASS-WITH-WARNINGS requires an explicit user decision before Phase 3
proceeds.** Do not silently treat a WARNING verdict as good enough to move
on. Present the warning list in Bahasa Indonesia (template and full
reasoning in `references/sanitize-audit.md`) and get an explicit yes/no —
either "lanjut dengan status ini" or "perbaiki dulu." Record whichever
answer you get:

- If this release is happening inside a `dev-kickoff-edho-ferdian`-managed
  project (a `/project-memory/` directory exists), write the decision to
  that project's `project-memory/01-decision-register.md` — source: this
  conversation, date, and the specific warnings accepted or the fix
  requested.
- Otherwise (a standalone, one-off release with no dev-kickoff project
  context), record the decision inline in `SANITIZATION_REPORT.md`'s own
  verdict section instead. Never proceed on a WARNING without *some*
  durable record of who accepted the risk and why — a chat message alone
  disappears; a file doesn't.

**PASS** needs no confirmation — proceed straight to Phase 3.

## This skill's Critique-Correction Loop instance

Phase 1 → Phase 2 is this ecosystem's Critique-Correction Loop pattern
(the same shape `code-review-edho-ferdian` uses between its Reviewer and
Critic roles — see that skill's `references/reflection-critique.md`),
applied to a release pipeline instead of a code review:

- Phase 1 is the **Producer** — it claims what it stripped and extracted,
  and writes `FORK_REPORT.md` as its own account.
- Phase 2 is the **adversarial Verifier** — it never opens `FORK_REPORT.md`
  to decide what to scan. It re-derives every finding from the filesystem
  and git history directly, then optionally compares its independent
  findings against Phase 1's claims (a mismatch is itself a finding, not a
  contradiction to paper over).

**On a harness with sub-agent delegation** (Claude Code, OpenCode, Hermes
via its delegate_task template, ZCode's own Subagents), Phase 2 runs as
the `opensource-sanitizer-edho-ferdian` agent, delegated fresh after Phase
1 completes — a real separate context, not just an instruction to
disregard what's already in view. "Never trust FORK_REPORT.md" is much
easier to actually honor when the verifier genuinely never saw it, versus
asking the same context that wrote it to pretend otherwise. On a harness
with no delegation primitive, run Phase 2 inline per
`references/sanitize-audit.md`, and note in `SANITIZATION_REPORT.md` that
the independence guarantee is weaker in that mode — still re-derive every
finding from scratch, just without hard context isolation backing it.
- A FAIL sends the actual file/history issue back to Phase 1's method,
  never a patch applied directly by Phase 2 — Phase 2 stays read-only, full
  stop, per its own rules in `references/sanitize-audit.md`.

Full framing and the reasoning behind treating this as the same pattern
lives at the top of `references/sanitize-audit.md` — read it there rather
than duplicating it here.

## Workflow

1. **Confirm scope with the user**: source project path, target directory
   for the sanitized copy, intended license (don't default silently — see
   `references/packaging-templates.md` Step 5), and whether a GitHub repo
   already exists (affects whether `.github/ISSUE_TEMPLATE/` gets created).
2. **Run Phase 1** per `references/fork-prep.md`. Report file counts,
   secrets extracted, and internal references replaced. State plainly that
   this report is not the release gate.
3. **Run Phase 2** — delegate to `opensource-sanitizer-edho-ferdian` on a
   harness that supports it, else run `references/sanitize-audit.md`
   inline — unconditionally, on the staged copy, regardless of how
   confident Phase 1's own report sounded. Get a verdict.
4. **Apply the hard gate** above based on the verdict.
5. **Run Phase 3** per `references/packaging-templates.md` once cleared.
   Report every file generated or enhanced, with `setup.sh` confirmed
   executable.
6. **Final summary to the user** (Bahasa Indonesia): what was done in each
   phase, the Phase 2 verdict and any recorded warning decision, and where
   every report/generated file landed.

## Notes

- `references/secret-patterns.md` consolidates what used to be two
  independently-drifting inline pattern lists into one shared source of
  truth.

## Rules

- Never sanitize in place — always stage to a separate `TARGET_DIR` (Phase
  1, Step 2).
- Never let Phase 3 start on a FAIL verdict, no exceptions, no "package it
  anyway, fix later" path.
- Never silently proceed past PASS-WITH-WARNINGS — get and record an
  explicit decision first.
- Never trust `FORK_REPORT.md`'s claims as evidence in Phase 2 — re-derive
  everything.
- Keep secret/PII patterns in `secret-patterns.md` only — no inline copies
  in Phase 1 or Phase 2's own reference files.
- Generated `CLAUDE.md` reuses this ecosystem's Execution Context Pack
  format and stays under 100 lines — see `references/packaging-templates.md`.
