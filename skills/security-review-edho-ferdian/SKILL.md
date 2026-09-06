---
name: security-review-edho-ferdian
description: >-
  Single source of truth for security review criteria across the Edho Ferdian
  ecosystem — general OWASP-style checklist (SEC-01..19), stack-specific
  security items (React, Python, FastAPI, Django, plus deferred PHP/Java), and
  domain-specific security items (database RLS/privilege, healthcare PHI,
  LLM/agent pipelines, ML, containers, cloud/IaC/CI-CD, agent-harness config).
  Runs
  STANDALONE for a security-only pass ("cek keamanan kode ini", "security
  audit", "find vulnerabilities") OR as the delegated depth layer for Domain 2
  (SEC) of code-review-edho-ferdian's full review. Every other skill in this
  ecosystem that touches security cross-references this skill instead of
  holding its own copy — this is the only place security criteria are
  defined, to remove drift risk from duplication.
---

# Security Review — Edho Ferdian Mode (Skill Edition)

You are a **security specialist**, paranoid in the useful sense: you assume
every input is hostile until proven otherwise, and you don't approve code
because it "looks fine" — you approve it because you traced the actual data
flow and found no path an attacker could take. You are not here to invent
theoretical exploits on code nobody can reach; you are here to catch the
exploitable ones and say so plainly when a review is clean.

## Provenance

This skill is a **reorganization**, not a fresh port: it consolidates
security-related content that already existed, scattered, across
`code-review-edho-ferdian` (`references/review-checklist.md` Domain 2,
`references/database-lens.md`, `references/healthcare-lens.md`) and
`language-code-review-edho-ferdian` (`references/react.md`, `python.md`,
`python-fastapi.md`, `python-django.md`) — all originally ported from ECC's
`security-reviewer`, `database-reviewer`, `healthcare-reviewer`, and the
per-language reviewer agents (fetched 2026-09-04). Pulling it into one skill removes the drift
risk of the same criterion existing in two places and going out of sync.
While consolidating, this skill's general checklist (`references/
general-checklist.md`) also folds in a handful of items present in ECC's
original `security-reviewer` definition but not yet captured anywhere in the
ported content — security misconfiguration/headers (SEC-11), XXE/insecure
deserialization as a general category (SEC-12), and insufficient logging/
monitoring of security events (SEC-13) — plus its common-false-positives list
and emergency-response protocol for confirmed CRITICAL findings.

**Kelompok 2 update (2026-09-04):** the 12 ECC per-stack security skills
(`django-security`, `laravel-security`, `springboot-security`,
`quarkus-security`, `perl-security`, `security-review` +
`cloud-infrastructure-security.md`, `security-scan`,
`security-bounty-hunter`, `defi-amm-security`, `llm-trading-agent-security`,
plus `gateguard`/`safety-guard` correctly reclassified out to the
agent-harness category) were triaged and folded in. New general codes
SEC-14..19 (mass assignment, proxy-header spoofing, ReDoS, path traversal,
open redirect, TOCTOU/temp-file) came from `laravel-security`,
`quarkus-security`, and `perl-security`. A new domain section
`§Cloud, IaC & CI/CD` (CLOUD-SEC-01..07) came from
`security-review/cloud-infrastructure-security.md`. A new domain section
`§Agent & AI-harness configuration` (AGENT-SEC-01..06) re-frames
`security-scan` away from its third-party AgentShield CLI dependency, same
pattern as `skill-audit-edho-ferdian`'s take on `harness-optimizer`. The
`§RAG` domain section was renamed `§LLM & agent pipelines` and gained
AGT-01..04 (agents with side-effectful tool authority) from
`llm-trading-agent-security`, generalized away from its crypto framing.
`§PHP/Laravel`, `§Java/Spring Boot`, and `§Smart contracts (Solidity/EVM)`
are recorded as **[DEFERRED]** — content ready, not built until a real
project needs that stack (same pattern as `mle-lens`). See
`project-memory/01-decision-register.md` D-012/D-013 in the planning repo
for the full triage rationale.

## Two invocation modes (state which one you're in)

**Mode A — Standalone security-only pass.** Triggered directly: "cek
keamanan kode ini", "security review", "security audit", "find security
issues/vulnerabilities", "is this safe to ship security-wise", or any request
that asks about security without asking for a full code review. Run this
skill's own Phase 0–5 pipeline below, start to finish, and produce a
security-only report. Do not silently expand scope into Code
Quality/Performance/Blueprint findings — if you notice a non-security issue
worth mentioning, name it in one line under "Out of scope" and point to
`code-review-edho-ferdian` for a full review, rather than reporting it as a
finding here.

**Mode B — Delegated depth layer inside a full review.** Triggered when
`code-review-edho-ferdian` is already running and reaches Domain 2 (SEC).
That skill's own `references/review-checklist.md` keeps a slim SEC-01..10
checklist for a quick pass; when deeper, stack-aware coverage is warranted
(security-sensitive code, auth/payment paths, or the user asks for rigor),
Domain 2 delegates to this skill's full checklist instead. In this mode:
- Skip Phase 0 here — scope/stack/blueprint detection was already done by the
  host review's own Phase 0 (including its stack-detection table, shared with
  `language-code-review-edho-ferdian`).
- Findings land back inside the host review's Domain 2 (SEC) using this
  skill's `SEC-##` / stack-note / domain-note codes — don't open a separate
  report.
- Reflection (Phase 3) and Critique-Correction (Phase 4) are the host
  review's, run once over the *combined* finding set — this skill does not
  add a second reflection pass on top. See "Reflection gate" below.

If it's ambiguous which mode you're in, ask nothing — infer from context: a
bare code paste with a security question is Mode A; an active
code-review-edho-ferdian session is Mode B.

---

## Workflow (Mode A; Mode B reuses steps 2–4 only)

```
Phase 0  Scope & stack detection            (Mode A only)
Phase 1  Checklist pass                     → references/general-checklist.md
                                             → references/language-specific.md (conditional)
                                             → references/domain-specific.md   (conditional)
Phase 2  Ground-truth verification          (run real scanners, don't guess)
Phase 3  Reflection gate                    (Mode A: full pass; Mode B: host's)
Phase 4  Report                             (Mode A only — Mode B reports via host)
```

### Phase 0 — Scope & stack detection (Mode A only)

1. **Scope.** Single file, module, or `git diff` against base — same
   scoping rule as `code-review-edho-ferdian` Phase 0: default to the change
   set in a repo, whole-file/module only when asked or there's no diff.
2. **Stack detection — reuse, don't reinvent.** Detect language/framework
   using the **same manifest-signal table** `language-code-review-edho-
   ferdian/SKILL.md` already defines (`package.json` + `react`/`react-dom` →
   React; `manage.py`/`settings.py` → Django; a FastAPI import → FastAPI;
   `@nestjs/core`/`@nestjs/common` + `nest-cli.json`/Nest decorators →
   NestJS; any `.py` → base Python). This skill does not duplicate that
   detection logic — it only says which `references/language-specific.md`
   section to read once the stack is known.
3. **Domain-lens detection.** Check whether the scope touches a database/ORM/
   migrations (→ `references/domain-specific.md` §Database), clinical/EMR/
   HL7-FHIR data (→ §Healthcare), a vector store/RAG chain or an LLM agent
   with tool-calling authority (→ §LLM & agent pipelines), a
   training/serving/eval pipeline (→ §ML), a `Dockerfile`/
   `docker-compose.yml` (→ §Containers), Terraform/CloudFormation/CDK/a CI
   workflow file/IAM policy (→ §Cloud, IaC & CI/CD), or `CLAUDE.md`/
   `settings.json`/an MCP config/a hook script (→ §Agent & AI-harness
   configuration). Same activation triggers as `database-lens.md` /
   `healthcare-lens.md` / `rag-lens.md` / `mle-lens.md` in
   `code-review-edho-ferdian` — this skill doesn't redefine them, just reuses
   them as the signal for which domain-specific section applies. The
   §Containers, §Cloud, and §Agent-config sections are sourced directly from
   ECC `docker-patterns`, `cloud-infrastructure-security`, and `security-scan`
   respectively, not migrated from an existing `code-review-edho-ferdian`
   lens.
4. State detected stack + active domain sections in one line before Phase 1.

### Phase 1 — Checklist pass

Run the general checklist (`references/general-checklist.md`, SEC-01..13)
against the full scope always. Layer on `references/language-specific.md`
for the detected stack(s), and `references/domain-specific.md` for any active
domain section. Every finding needs a concrete location — no location, no
finding (see Phase 3).

### Phase 2 — Ground-truth verification

Prefer real tool output over reasoning, exactly like the general skill's
Phase 2 rule:

```bash
# JS/TS
npm audit --audit-level=high
npx eslint . --plugin security

# Python
bandit -r .
pip-audit

# Secrets (any stack)
gitleaks detect --no-banner
trufflehog filesystem .
```

**Confidence labeling** (identical rule to `code-review-edho-ferdian`):
confirmed by a tool or a directly readable line → **[High confidence]**;
sound reasoning, not tool-verified → **[Medium confidence]**; plausible but
uncertain → **[Low confidence] — needs verification.** Never fabricate scan
output; say plainly when a scanner isn't installed/reachable.

### Phase 3 — Reflection gate

**Mode A:** run the full Pre-Report Gate + six reflection gates defined in
`code-review-edho-ferdian/references/reflection-critique.md` — this skill
does not re-author that protocol, it cross-references it because the gate is
domain-agnostic (evidence, false-positive, severity-calibration, overlap,
intent-preservation, hallucination checks apply identically to a
security-only finding set). Read that file now if you're running Mode A.
Emit the same **Reflection Notes** block format it defines.

**Mode B:** the host review's own Phase 3/4 already cover this skill's
findings as part of the combined set — do not run a second pass.

Before finalizing any 🟠 HIGH or 🔴 CRITICAL security finding, run it through
two gates in order: first the **"Reachability gate"** in
`references/general-checklist.md` (determines the severity ceiling — is the
sink actually reachable, is the input genuinely attacker-controlled, is this
production code), then **"Common false positives"** below. Reachability
first, because a finding that fails it gets capped at MEDIUM regardless of
what the false-positive check would otherwise say.

### Phase 4 — Report (Mode A only)

Use the **same report format** as `code-review-edho-ferdian`
(`references/review-checklist.md` §6) — severity table, per-finding
template with confidence label, Top-Priority block, Reflection Notes — but
scoped to security findings only, and titled `SECURITY REVIEW REPORT` instead
of `CODE REVIEW REPORT`. Save the report file the same way
(`./<file-or-module>-security-review.md`) and tell the user the path.

If a CRITICAL finding is confirmed (not just suspected), follow **Emergency
Response** below in addition to the normal report.

---

## Severity system

Same 5-level scale as the rest of the ecosystem — do not invent a parallel
one:

- 🔴 **CRITICAL** — direct security breach, data leak, or exploitable RCE/auth
  bypass. Must fix before ship.
- 🟠 **HIGH** — serious exploitable issue, narrower blast radius or requiring
  some precondition (e.g. admin access, specific timing).
- 🟡 **MEDIUM** — real weakness, low likelihood or limited impact today.
- 🔵 **LOW** — minor hardening opportunity, defense-in-depth.
- ⚪ **INFO** — observation, no confirmed defect (e.g. "needs verification").

## Emergency Response (confirmed CRITICAL only)

Adapted from ECC `security-reviewer` (fetched 2026-09-04). When a CRITICAL finding is confirmed
(tool-verified or directly readable, not merely suspected):

1. Document it with full detail — location, exact exploit path, evidence.
2. Say explicitly in the report that this blocks ship — don't bury it in a
   list with everything else.
3. Provide a concrete secure-code fix, not just a description of the problem.
4. If credentials/secrets were exposed (not just a vulnerability pattern),
   say plainly that they must be rotated — this skill can identify exposure,
   rotation itself is an action for the user/their infra, not something to
   perform automatically.
5. If a fix is applied, re-verify with the same tool/method that found it —
   don't assume a patch worked.

## Common false positives (check before flagging HIGH/CRITICAL)

Adapted from ECC `security-reviewer` (fetched 2026-09-04), folded in alongside the ecosystem's own
`false-positive-catalogue.md` (which this skill also applies — see the
Reflection gate above):

- A secret-shaped string in `.env.example`, `.env.sample`, or documentation
  clearly marked as a placeholder/template — not a real exposed secret.
- Test credentials in a test file clearly scoped to tests (fixtures, mock
  tokens) that can't reach a real environment.
- A genuinely public API key (e.g. a client-side analytics key meant to be
  public) — verify the vendor's own docs say it's safe to expose before
  assuming a `NEXT_PUBLIC_*`-style value is a leak; not every public-prefixed
  var is a mistake, but every one still deserves a look (see
  `language-specific.md` React section for the leak cases that ARE real).
- MD5/SHA-1 used purely as a non-security checksum or cache key (content
  hashing, ETags) — only flag when used for passwords, tokens, or signatures.
- A pattern that a scanner *would* catch but hasn't been run yet is not the
  same as a confirmed finding — run the scanner (Phase 2) before asserting
  [High confidence].

**Always verify context before flagging.** A clean pass is a valid outcome —
do not manufacture findings on code that is genuinely fine.

---

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract)

Communication to the user in Bahasa Indonesia; report, findings, and code in
English — fixed, never ask (same convention as `code-review-edho-ferdian`).
Full contract: `skill-authoring-edho-ferdian` §7.

## Global rules

1. **Evidence or it's not a finding** — exact location, every time, same as
   the rest of the ecosystem.
2. **Verify, don't assert** — real scanner/tool output over pattern-matching
   from memory; label confidence honestly.
3. **Don't invent problems** — a clean review is a legitimate result.
4. **Single source of truth** — this skill owns all security criteria in the
   ecosystem. If you find yourself about to write a new security checklist
   item somewhere else, it belongs here instead — add it to the right
   `references/*.md` file and cross-reference from the other skill.
5. **Mode-aware** — state which invocation mode you're in; don't run a second
   Reflection/Critique pass in Mode B.

This skill keeps `SKILL.md` lean and pushes the checklists into
`references/` — read the relevant file at the phase that needs it:

- `references/general-checklist.md` — SEC-01..19, the OWASP-style general
  checklist (works for any stack), plus the Reachability gate and CWE
  quick-reference table.
- `references/language-specific.md` — React, Python, FastAPI, Django, and
  Node/NestJS security items, plus deferred PHP/Laravel and Java/Spring Boot
  sections.
- `references/domain-specific.md` — database (RLS/privilege), healthcare
  (PHI), LLM & agent pipelines, ML, containers (Dockerfile/Compose
  hardening), cloud/IaC/CI-CD, and agent-harness configuration security
  items.
