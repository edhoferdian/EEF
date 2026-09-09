# Phase 2 — Sanitize / Audit

Reference for Phase 2 of `opensource-release-edho-ferdian`.

## Framing — this IS a Critique-Correction Loop instance

This ecosystem already has a named pattern for "one role produces, a second
adversarial role verifies without trusting the first" —
`code-review-edho-ferdian`'s Critique-Correction Loop
(`references/reflection-critique.md` in that skill): Reviewer produces,
Critic attacks, Correction resolves. Phase 1 → Phase 2 of this skill is the
same shape, applied to a release pipeline instead of a code review:

- **Phase 1 (`fork-prep.md`) is the Producer.** It claims what it stripped,
  replaced, and extracted, and writes `FORK_REPORT.md` as its account of
  the work.
- **Phase 2 (this file) is the adversarial Verifier.** It does not read
  `FORK_REPORT.md` as evidence of anything. It re-derives every finding
  from the filesystem and git history directly, the same way the Critic in
  a code review re-checks claims against the actual code rather than
  trusting the Reviewer's write-up.
- **Correction, if needed, goes back to Phase 1's method** — fix the actual
  file/history issue, then re-run Phase 2 from scratch. There is no
  "partial re-audit" — a fix invalidates the whole prior audit result.

**The one rule that matters most: never open `FORK_REPORT.md` to decide
what to scan.** Scan everything, unconditionally, then optionally compare
your independent findings against what Phase 1 claimed — a mismatch there
is itself a finding ("Phase 1 reported 3 secrets extracted; audit found a
4th it missed").

## Step 1 — Secrets scan (CRITICAL — any match = FAIL)

Scan every text file (excluding `node_modules`, `.git`, `__pycache__`,
`*.min.js`, binaries) against the CRITICAL patterns in
**`references/secret-patterns.md`** — read that file now; do not use a
separate copy of these patterns. Any confirmed match in this tier is an
automatic overall FAIL, full stop.

## Step 2 — PII scan (CRITICAL — this ecosystem's addition)

This ecosystem treats PII as its own tier with explicit CRITICAL weight,
per `secret-patterns.md`'s PII section: personal email addresses (not generic role addresses), phone
numbers (confirm by context — high false-positive regex), private IPs (CRITICAL
unless documented as a placeholder in `.env.example`), SSH connection
strings, and absolute paths naming a real person or machine.

## Step 3 — Internal references scan (CRITICAL)

Confirm every entry in `secret-patterns.md`'s replacement map was actually
applied — re-run the source patterns (not the replacements) against the
staged copy. Any leftover match is CRITICAL: Phase 1 claimed a replacement
that didn't fully happen.

## Step 4 — Dangerous files check (CRITICAL — existence alone = FAIL)

Confirm none of the files listed in `secret-patterns.md`'s "Dangerous
files" section exist in the staged copy. Existence of even one is an
automatic FAIL — no severity judgment needed, just presence/absence.

## Step 5 — Entropy heuristic scan (WARNING — does not alone fail release)

Apply the high-entropy heuristic from `secret-patterns.md`. Every hit is a
WARNING requiring manual review, not an automatic FAIL — false positives
here (a hash, a generated ID, a legitimately random-looking but non-secret
value) are common. List each hit with enough context (file, line, first 4
characters) for a human to judge quickly.

## Step 6 — Configuration completeness (WARNING)

- `.env.example` exists.
- Every environment variable referenced in code has a matching entry in
  `.env.example`, and vice versa (an unused example entry is a smaller
  smell, still worth listing).
- `docker-compose.yml` (if present) uses `${VAR}` syntax, not literals.

## Step 7 — Git history audit (CRITICAL — do not skip this)

Phase 1 claims a single clean commit, but the audit re-confirms it and goes
further: a leaked secret in an **old** commit (added, then later removed
from the working tree) is invisible to Steps 1–6, which only see the
current file state.

```bash
cd PROJECT_DIR

# Should be exactly one commit if Phase 1's fresh-history step worked
git log --oneline | wc -l
# > 1 => history was not cleaned. FAIL, regardless of what FORK_REPORT.md claims.

# Even on a single-commit repo, re-scan its diff content directly —
# a single "clean" commit can still carry a secret if Phase 1 committed
# before fully stripping it. Never assume commit count alone proves safety.
git log -p | grep -iE '(password|secret|api.?key|token|-----BEGIN)' | head -50
```

If the repo somehow retains multiple commits (Phase 1 was skipped, or its
git-init step was bypassed), audit **every** commit's diff against the
secret patterns, not just the tip — a secret introduced and later deleted
still exists in the object store until history is rewritten or the repo is
recreated fresh.

## Verdict

```
PASS               — zero CRITICAL findings across all six categories.
FAIL               — one or more CRITICAL findings. Hard gate: Phase 3
                      (packaging) MUST NOT begin. Send back to Phase 1
                      with the specific findings; Phase 1 fixes, Phase 2
                      re-runs from Step 1, in full, on the corrected copy.
PASS-WITH-WARNINGS — zero CRITICAL, one or more WARNING findings.
```

## The hard gate (non-negotiable)

**FAIL blocks Phase 3 unconditionally.** No packaging step runs, no
`CLAUDE.md`/`README.md`/etc. gets generated, until a re-run of this phase
returns PASS or PASS-WITH-WARNINGS. There is no "package it anyway, fix
later" path — a public repository is not a private draft; once packaged
and the user proceeds to publish it, the secret is out.

## PASS-WITH-WARNINGS requires an explicit user decision

A WARNING is not nothing — it means something plausible but unconfirmed was
found. Do not silently proceed to Phase 3 on a PASS-WITH-WARNINGS verdict.
Present the warning list to the user **in Bahasa Indonesia** (this
ecosystem's user-facing language convention) and ask for an explicit
decision per warning or as a batch:

```
Audit selesai — status: PASS-WITH-WARNINGS.

{N} temuan WARNING (bukan CRITICAL, tidak otomatis memblokir), contoh:
1. [ENTROPY] config/app.json:12 — string 40 karakter, entropi tinggi,
   tidak cocok pola vendor yang dikenal. Butuh peninjauan manual.
2. [CONFIG] .env.example tidak mencantumkan STRIPE_WEBHOOK_SECRET yang
   dipakai di src/billing.py:88.

Lanjut ke Phase 3 (packaging) dengan status ini, atau perbaiki dulu?
```

Record the user's decision the same way any binding decision gets recorded
in this ecosystem: if this release is happening inside a dev-kickoff-managed
project, write it to that project's
`/project-memory/01-decision-register.md` (source: this conversation, date,
the specific warnings accepted or the fix requested). If there is no
dev-kickoff project context (a standalone one-off release), record the
decision inline in `SANITIZATION_REPORT.md`'s own verdict section instead —
never proceed on a WARNING without *some* durable record of who accepted
the risk and why.

## Output — `SANITIZATION_REPORT.md`

```markdown
# Sanitization Report: {project-name}

**Date:** {date}
**Auditor:** opensource-release-edho-ferdian, Phase 2 (independent re-scan)
**Verdict:** PASS | FAIL | PASS WITH WARNINGS

## Summary

| Category | Status | Findings |
|----------|--------|----------|
| Secrets | PASS/FAIL | {count} |
| PII | PASS/FAIL | {count} |
| Internal References | PASS/FAIL | {count} |
| Dangerous Files | PASS/FAIL | {count} |
| Config Completeness | PASS/WARN | {count} |
| Git History | PASS/FAIL | {count} |

## Critical Findings (block release)

1. **[SECRETS]** `src/config.py:42` — hardcoded database password: `DB_P...` (truncated)

## Warnings (user decision required — see below)

1. **[ENTROPY]** `config/app.json:12` — high-entropy string, unconfirmed

## Cross-check against FORK_REPORT.md (informational — audit trusts its own scan, not this comparison)

- Phase 1 claimed {N} secrets extracted; audit independently found {M}.
- {If M > N: "Audit found {M-N} additional match(es) Phase 1's report did not list — see Critical Findings."}

## User Decision (only if PASS-WITH-WARNINGS)

{Recorded decision, date, and where it was logged.}

## Recommendation

{FAIL: "Fix the listed critical findings and re-run Phase 2 in full."}
{PASS: "Clear for Phase 3 packaging."}
{PASS-WITH-WARNINGS: "Clear for Phase 3 pending the user decision above."}
```

## Rules

- Never display a full secret value — truncate to first 4 characters + "...".
- Never modify source files in this phase — read-only, report only.
- Always scan every text file, not just known extensions — a secret in a
  `.txt`, `.yml`, or extensionless file is as real as one in `.py`.
- Always audit git history, even for a repo that claims a single commit.
- Be paranoid: a false positive costs a manual review; a false negative
  costs a public leak. Bias toward flagging.
- A single CRITICAL finding in any category is an overall FAIL — no
  averaging, no "mostly clean."
