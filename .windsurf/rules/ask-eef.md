---
trigger: model_decision
description: "Entry point to the EEF skills: reads the request and the project, then loads the right skill or sequence (dev-kickoff, design-engineering, build-fix, code-review...). Use at the start of a task when no skill is obviously right, or for \"ask-eef\", \"pakai skill apa\", \"mulai dari mana\", \"bantu kerjakan ini\", \"aku mau bikin\", \"gimana caranya\"."
---

# Ask EEF — pick the skill, then hand over

You are the front door to Ekosistem Edho Ferdian. Your job is short:
understand what the user is trying to get done, look at the project for
two minutes, choose **one** skill (or one short sequence), say why in one
line, and **load it with the Skill tool**. You don't do the work yourself.

In a plugin install every skill is named `ekosistem-edho-ferdian:<skill>`.

## Step 1 — Read the situation (≤ 2 minutes)

- The request in the user's words. What would "done" look like for them?
- The project: `ls`, `package.json` / `pyproject.toml` / `go.mod`, a
  `project-memory/` folder, open PRs or a failing build in the output they
  pasted.
- What happened earlier in this session (an error, a review, a deploy).

Ask at most **one** question, and only when two skills would do very
different work (e.g. "review the design" = motion review or code review?).

## Step 2 — Choose

### Starting or resuming work

| Situation | Load |
|---|---|
| New project from a PRD/brief, or "lanjutkan proyek" with `project-memory/` | `dev-kickoff-edho-ferdian` (it calls the others per stage) |
| A codebase with no docs, need to understand it first | `spec-mining-edho-ferdian` → then `dev-kickoff-edho-ferdian` |
| A big technical decision (architecture, monolith vs services, "apa yang rusak kalau…") | `system-design-edho-ferdian` |
| "Riset dulu", compare tools, current facts | `research-ops-edho-ferdian` |

### Building

| Situation | Load |
|---|---|
| Page, screen, component, landing page, dashboard | `frontend-engineering-edho-ferdian` + `design-engineering-edho-ferdian` |
| Animation, gestures, polish, mobile feel, design options, Swift/Expo motion | `design-engineering-edho-ferdian` |
| Endpoints / API contract | `api-design-edho-ferdian` |
| Services, jobs, queues, integrations | `backend-engineering-edho-ferdian` |
| Schema, migrations, Prisma, Redis | `data-layer-patterns-edho-ferdian` |
| Tests for a unit/component | `test-authoring-edho-ferdian` |
| Tests for a user journey (browser) | `e2e-testing-edho-ferdian` |
| Windows desktop app tests | `desktop-e2e-edho-ferdian` |
| Linters, formatters, pre-commit | `code-quality-tooling-edho-ferdian` |
| Docker / compose | `container-ops-edho-ferdian` |
| Rapid prototype scored in a loop | `gan-harness-edho-ferdian` |

### Something is wrong

| Situation | Load |
|---|---|
| Build/compile/startup error, stack trace | `build-fix-edho-ferdian` |
| A button/form does nothing or state snaps back | `click-path-audit-edho-ferdian` |
| Slow, laggy, memory leak | `performance-audit-edho-ferdian` |
| Production down, incident, rollback | `deployment-ops-edho-ferdian` |
| Not on Google | `seo-audit-edho-ferdian` |
| Billing incident, double charge, refund request | `billing-ops-edho-ferdian` |
| Network, DNS, homelab | `networking-ops-edho-ferdian` |

### Checking and improving

| Situation | Load |
|---|---|
| "Review / cek kode / sebelum merge" | `code-review-edho-ferdian` (+ `language-code-review-edho-ferdian` for a named stack) |
| Security question or audit | `security-review-edho-ferdian` |
| Code works but is messy | `code-simplification-edho-ferdian` |
| Unused code / dependencies | `dead-code-cleanup-edho-ferdian` |
| README/docs out of date | `docs-sync-edho-ferdian` |

### Shipping

| Situation | Load |
|---|---|
| Commits, branches, PRs, CI red, releases | `git-and-release-ops-edho-ferdian` |
| Deploy, CI/CD, health checks, post-deploy watch | `deployment-ops-edho-ferdian` |
| Make a repo public | `opensource-release-edho-ferdian` |

### Writing, people and business

| Situation | Load |
|---|---|
| Positioning, landing copy, launch plan | `marketing-edho-ferdian` |
| Inbox / messages to triage, draft replies | `communications-triage-edho-ferdian` |
| An agent or reply facing customers/suppliers | `counterparty-comms-edho-ferdian` |
| Agreements from a template, e-sign drafts | `legal-ops-edho-ferdian` |
| Video look and cut rhythm from a reference | `video-style-edho-ferdian` |

### The ecosystem itself

| Situation | Load |
|---|---|
| `~/.claude` cluttered, context fills fast | `config-hygiene-edho-ferdian` |
| Audit this repo's skills | `skill-audit-edho-ferdian` |
| Write or change a skill | `skill-authoring-edho-ferdian` |
| Autonomous/production run, destructive steps | `safe-execution-edho-ferdian` (alongside the main skill) |

## Common sequences

| Goal | Sequence |
|---|---|
| Idea → shipped feature | `dev-kickoff` → (frontend/design · backend · api · data-layer per task) → `test-authoring` → `code-review` → `git-and-release-ops` → `deployment-ops` |
| UI from scratch | `frontend-engineering` + `design-engineering` → `e2e-testing` → `code-review` |
| Bug report | `build-fix` or `click-path-audit` → regression test via `test-authoring` → `code-review` |
| "It's slow" | `performance-audit` → the owning skill for the fix → re-measure |
| Before going public | `security-review` → `opensource-release` → `docs-sync` |

## Step 3 — Hand over

Write one line, then load:

> Ini tugas UI baru — saya pakai `frontend-engineering` untuk struktur dan
> `design-engineering` untuk animasi & polish.

Then call the Skill tool for the first skill and follow it. When that skill
reaches a "Hands off to" situation, it loads the next one (contract:
`skill-authoring-edho-ferdian` §11). Don't re-run ask-eef mid-task unless
the user changes direction.

## Rules

1. Recommend one skill or one sequence — never the whole table.
2. Load, don't summarise: the chosen skill's instructions replace yours.
3. If nothing fits, say so and work normally; don't force a skill.
4. A request already naming a skill skips this: load that skill.

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract)

Communication to the user in Bahasa Indonesia; skill names and artifacts in
English — fixed, never ask. Full contract: `skill-authoring-edho-ferdian` §7.
