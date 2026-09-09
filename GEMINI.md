# GEMINI.md — Ekosistem Edho Ferdian (EEF)

Identical in content to this repo's `AGENTS.md` — Gemini CLI looks for this filename specifically and doesn't fall back to AGENTS.md by default. See `AGENTS.md` for the canonical version; this file is generated from it, not authored separately.

This project ships 33 skills under `skills/*/SKILL.md` — each one a focused
playbook for a specific engineering task (code review, API design, test
authoring, deployment, and more). This file is a router, not a full copy:
skim the table below, and when a request matches a row, **read that skill's
`SKILL.md` file before acting** — it has the actual workflow, checklists,
and reference material this index intentionally leaves out to stay small.

A skill's own `references/*.md` files go one level deeper still; its
`SKILL.md` tells you when to open those too. Don't guess at a skill's
method from its one-line description here — read the file.

## Skills

| Skill | Use when | Path |
|---|---|---|
| `api-design-edho-ferdian` | Design and evolve API boundaries and contracts — REST resource naming, status-code semantics, pagination strategy, versioning policy, and… | `skills/api-design-edho-ferdian/SKILL.md` |
| `backend-engineering-edho-ferdian` | Authoring server-side code between the API contract and the datastore — layering and ports/adapters boundaries, error taxonomy and… | `skills/backend-engineering-edho-ferdian/SKILL.md` |
| `billing-ops-edho-ferdian` | Diagnosing and handling billing/subscription operations — classifying customer billing incidents (duplicate subscriptions, multi-seat vs… | `skills/billing-ops-edho-ferdian/SKILL.md` |
| `build-fix-edho-ferdian` | Diagnose and fix build, compile, dependency, and runtime-startup failures with minimal surgical diffs — never refactors, never… | `skills/build-fix-edho-ferdian/SKILL.md` |
| `click-path-audit-edho-ferdian` | Trace every user-facing touchpoint (button, toggle, form submit) through its full state-change sequence to find defects that reading code… | `skills/click-path-audit-edho-ferdian/SKILL.md` |
| `code-review-edho-ferdian` | Senior-engineer code review across five domains — Code Quality, Security, Performance, Blueprint/Spec Consistency, and Test Quality — plus… | `skills/code-review-edho-ferdian/SKILL.md` |
| `communications-triage-edho-ferdian` | Channel-agnostic framework for triaging incoming messages (email, chat, Slack, LINE, Messenger, or any other channel) into four priority… | `skills/communications-triage-edho-ferdian/SKILL.md` |
| `config-hygiene-edho-ferdian` | Periodic garbage collection for Edho's own Claude Code environment (`~/.claude`): find redundant, stale, orphaned, or context-expensive… | `skills/config-hygiene-edho-ferdian/SKILL.md` |
| `container-ops-edho-ferdian` | Container setup, docker-compose design, multi-stage build optimization, and debugging guidance. Security-specific container concerns live… | `skills/container-ops-edho-ferdian/SKILL.md` |
| `data-layer-patterns-edho-ferdian` | Design and setup guidance for the data layer — Postgres schema design, Prisma ORM patterns, Redis caching/queue patterns, and cross-ORM… | `skills/data-layer-patterns-edho-ferdian/SKILL.md` |
| `dead-code-cleanup-edho-ferdian` | Staged dead-code removal workflow — detect (stack-appropriate tooling: knip/depcheck/ts-prune, vulture/deptry, cargo-udeps, deadcode, ...),… | `skills/dead-code-cleanup-edho-ferdian/SKILL.md` |
| `deployment-ops-edho-ferdian` | Getting a build to production and keeping it healthy — release strategy (rolling / blue-green / canary), CI/CD pipeline gates, health… | `skills/deployment-ops-edho-ferdian/SKILL.md` |
| `desktop-e2e-edho-ferdian` | End-to-end testing for Windows native desktop applications (WPF, WinForms, Win32/MFC, Qt 5/6) using pywinauto over the Windows UI… | `skills/desktop-e2e-edho-ferdian/SKILL.md` |
| `dev-kickoff-edho-ferdian` | Kickoff and execute a development project from ANY specification or planning documents — PRD, SRS, SDD, UIX Flow, WBS, tech spec, RFC,… | `skills/dev-kickoff-edho-ferdian/SKILL.md` |
| `docs-sync-edho-ferdian` | Keep USER-FACING documentation honest against the current codebase — README, docs/CODEMAPS/*, architecture-as-markdown, public API docs.… | `skills/docs-sync-edho-ferdian/SKILL.md` |
| `e2e-testing-edho-ferdian` | End-to-end testing for critical user journeys — the visual/browser-level layer that dev-kickoff-edho-ferdian's TEST stage explicitly defers… | `skills/e2e-testing-edho-ferdian/SKILL.md` |
| `frontend-engineering-edho-ferdian` | Authoring and configuration guidance for building React/Next.js frontend applications well from the start — component composition patterns,… | `skills/frontend-engineering-edho-ferdian/SKILL.md` |
| `gan-harness-edho-ferdian` | Rapid, adversarial-loop prototyping and design iteration: a Plan → Generate → Evaluate/iterate cycle where a generator builds a live app… | `skills/gan-harness-edho-ferdian/SKILL.md` |
| `git-and-release-ops-edho-ferdian` | Git and forge workflow — branching strategy selection, conventional commit format, merge versus rebase, conflict resolution, PR readiness… | `skills/git-and-release-ops-edho-ferdian/SKILL.md` |
| `language-code-review-edho-ferdian` | Language- and framework-specific code review lenses layered on top of the general four-domain review in code-review-edho-ferdian — idioms,… | `skills/language-code-review-edho-ferdian/SKILL.md` |
| `marketing-edho-ferdian` | Campaign/positioning strategy, brand-voice definition, landing-page and email copywriting patterns, and a lightweight competitive/market-… | `skills/marketing-edho-ferdian/SKILL.md` |
| `networking-ops-edho-ferdian` | Networking skill covering five modes — reviewing a router/switch config for security and correctness, designing a network (homelab or… | `skills/networking-ops-edho-ferdian/SKILL.md` |
| `opensource-release-edho-ferdian` | Fork, sanitize, and package a project for open-source release in three phases — extract secrets into .env.example rather than deleting… | `skills/opensource-release-edho-ferdian/SKILL.md` |
| `performance-audit-edho-ferdian` | Measure-then-fix performance workflow — runs real profiling/measurement tooling (Lighthouse, bundle analyzers, heap-snapshot diffing,… | `skills/performance-audit-edho-ferdian/SKILL.md` |
| `research-ops-edho-ferdian` | Evidence-first research workflow — classify what kind of research the question actually needs, take the lightest evidence path that answers… | `skills/research-ops-edho-ferdian/SKILL.md` |
| `safe-execution-edho-ferdian` | Mechanical gates around agent execution, as a complement to this ecosystem's reasoning gates: a pre-action fact-forcing gate that demands… | `skills/safe-execution-edho-ferdian/SKILL.md` |
| `security-review-edho-ferdian` | Single source of truth for security review criteria across the Edho Ferdian ecosystem — general OWASP-style checklist (SEC-01..19),… | `skills/security-review-edho-ferdian/SKILL.md` |
| `seo-audit-edho-ferdian` | Technical + on-page SEO audit workflow — crawl/gather site signals, check them against a real technical-SEO checklist (crawlability,… | `skills/seo-audit-edho-ferdian/SKILL.md` |
| `skill-audit-edho-ferdian` | Audit this ecosystem's own `skills/` directory for staleness, redundancy, broken cross-references, and description-quality problems —… | `skills/skill-audit-edho-ferdian/SKILL.md` |
| `skill-authoring-edho-ferdian` | Discipline for creating and governing this ecosystem's own skills: search before building (local → marketplace → GitHub → web, with a… | `skills/skill-authoring-edho-ferdian/SKILL.md` |
| `spec-mining-edho-ferdian` | Extract behavioral specifications from an existing codebase that has no written spec — mining a brownfield repo into a flat list of… | `skills/spec-mining-edho-ferdian/SKILL.md` |
| `system-design-edho-ferdian` | Mid-project architectural decision-making — Architecture Decision Records (ADRs), structured trade-off analysis,… | `skills/system-design-edho-ferdian/SKILL.md` |
| `test-authoring-edho-ferdian` | Guidance for WRITING unit and component tests well — React/Testing Library, Python/pytest, Go, and Vue, plus stack-agnostic regression-test… | `skills/test-authoring-edho-ferdian/SKILL.md` |

## Notes for non-Claude-Code harnesses

- These skills were authored for Claude Code's Agent Skills format, but the
  content itself is plain Markdown with no Claude-specific syntax — reading
  a `SKILL.md` file directly works the same way here as it does there.
- If this harness also supports a native rules/instructions directory
  (`.cursor/rules/`, `.windsurf/rules/`, `.clinerules/`, etc.), check
  whether this repo ships an adapter for it under `scripts/export_*.py`
  before assuming this router file is the only option.
