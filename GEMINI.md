# GEMINI.md — Ekosistem Edho Ferdian (EEF)

Identical in content to this repo's `AGENTS.md` — Gemini CLI looks for this filename specifically and doesn't fall back to AGENTS.md by default. See `AGENTS.md` for the canonical version; this file is generated from it, not authored separately.

This project ships 38 skills under `skills/*/SKILL.md` — each one a focused
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
| `api-design-edho-ferdian` | Design and evolve API contracts: REST resource naming, status codes, pagination, versioning, and one authoritative OpenAPI/schema so client… | `skills/api-design-edho-ferdian/SKILL.md` |
| `backend-engineering-edho-ferdian` | Write server-side code well: service layering and ports/adapters, typed errors, retry with backoff and circuit breakers, background jobs… | `skills/backend-engineering-edho-ferdian/SKILL.md` |
| `billing-ops-edho-ferdian` | Diagnose billing and subscription incidents (duplicate subscriptions, failed checkout, double charges, broken billing portal) and verify… | `skills/billing-ops-edho-ferdian/SKILL.md` |
| `build-fix-edho-ferdian` | Fix build, compile, dependency and startup failures with a minimal verified diff, never a cast, ts-ignore or disabled check that hides the… | `skills/build-fix-edho-ferdian/SKILL.md` |
| `click-path-audit-edho-ferdian` | Trace each button, toggle or form submit through its full state changes to find handlers that undo each other, async races, stale closures… | `skills/click-path-audit-edho-ferdian/SKILL.md` |
| `code-quality-tooling-edho-ferdian` | Set up the automated quality gate: Biome or ESLint+Prettier, Husky, lint-staged, and the equivalents for Python (Ruff), Go and Rust. Use… | `skills/code-quality-tooling-edho-ferdian/SKILL.md` |
| `code-review-edho-ferdian` | Senior code review across quality, security, performance, spec consistency and tests, with evidence-backed, severity-ranked findings. Load… | `skills/code-review-edho-ferdian/SKILL.md` |
| `code-simplification-edho-ferdian` | Rewrite code for clarity without changing behaviour: extract long functions, flatten nesting, merge duplication, remove over-engineering,… | `skills/code-simplification-edho-ferdian/SKILL.md` |
| `communications-triage-edho-ferdian` | Triage incoming messages from any channel into four priority tiers, draft replies behind a human-approval gate, and track promises made in… | `skills/communications-triage-edho-ferdian/SKILL.md` |
| `config-hygiene-edho-ferdian` | Clean up the ~/.claude environment: redundant, stale or context-expensive skills, memory, hooks, permissions, MCP servers and caches, one… | `skills/config-hygiene-edho-ferdian/SKILL.md` |
| `container-ops-edho-ferdian` | Container setup, docker-compose design, multi-stage build optimization and debugging. Use for "setup Docker untuk project ini",… | `skills/container-ops-edho-ferdian/SKILL.md` |
| `counterparty-comms-edho-ferdian` | Rules for an agent that talks to customers, suppliers or partners: who it may answer, no leak of internal context, and every outbound draft… | `skills/counterparty-comms-edho-ferdian/SKILL.md` |
| `data-layer-patterns-edho-ferdian` | Design and set up the data layer: Postgres schemas, Prisma, Redis caching and queues, and safe expand-contract migrations. Use for "desain… | `skills/data-layer-patterns-edho-ferdian/SKILL.md` |
| `dead-code-cleanup-edho-ferdian` | Remove dead code safely: detect with stack tooling (knip, vulture, cargo-udeps...), rank by risk, then delete deps, exports, files and… | `skills/dead-code-cleanup-edho-ferdian/SKILL.md` |
| `deployment-ops-edho-ferdian` | Ship a build and keep it healthy: release strategy, CI/CD gates, health checks and Kubernetes, rollback, readiness verdict, dashboards,… | `skills/deployment-ops-edho-ferdian/SKILL.md` |
| `desktop-e2e-edho-ferdian` | End-to-end tests for Windows desktop apps (WPF, WinForms, Win32, Qt) with pywinauto over UI Automation. Use for "test aplikasi desktop",… | `skills/desktop-e2e-edho-ferdian/SKILL.md` |
| `dev-kickoff-edho-ferdian` | Start and run a project from specs (PRD, SRS, WBS, RFC, ADRs): decision register, context pack, then a… | `skills/dev-kickoff-edho-ferdian/SKILL.md` |
| `docs-sync-edho-ferdian` | Keep user-facing docs true to the code: README, codemaps, architecture and API docs; every path, link and snippet checked. Use for "update… | `skills/docs-sync-edho-ferdian/SKILL.md` |
| `e2e-testing-edho-ferdian` | End-to-end tests for critical user journeys: map flows first, use whichever browser driver is available, Page Object Model, quarantine… | `skills/e2e-testing-edho-ferdian/SKILL.md` |
| `frontend-engineering-edho-ferdian` | Build React/Next.js frontends well from the start: component composition, UX recipes, Vite, HeroUI, and avoiding generic AI-looking UI. Use… | `skills/frontend-engineering-edho-ferdian/SKILL.md` |
| `gan-harness-edho-ferdian` | Fast prototype iteration: a generator builds a live app and an evaluator drives it in a browser, scores it on a design rubric and feeds… | `skills/gan-harness-edho-ferdian/SKILL.md` |
| `git-and-release-ops-edho-ferdian` | Git and release workflow with this ecosystem's binding conventions: branching, conventional commits, merge vs rebase, conflicts, PR… | `skills/git-and-release-ops-edho-ferdian/SKILL.md` |
| `language-code-review-edho-ferdian` | Stack-specific review lenses on top of code-review: idioms, framework misconfigurations, ORM query traps, performance and test conventions… | `skills/language-code-review-edho-ferdian/SKILL.md` |
| `legal-ops-edho-ferdian` | Draft agreement paperwork from one template plus a JSON spec per counterparty (NDA, referral fee, non-circumvention, master services), add… | `skills/legal-ops-edho-ferdian/SKILL.md` |
| `marketing-edho-ferdian` | Positioning, brand voice, launch plans, and landing-page and email copy for a solo developer's own tools and projects. Use for "marketing",… | `skills/marketing-edho-ferdian/SKILL.md` |
| `networking-ops-edho-ferdian` | Network config review, design (homelab or multi-site), read-only OSI-layer troubleshooting, device changes (Cisco IOS-style) and homelab… | `skills/networking-ops-edho-ferdian/SKILL.md` |
| `opensource-release-edho-ferdian` | Prepare a project for public open-source release: move secrets to .env.example, run an independent audit that gates on FAIL, then generate… | `skills/opensource-release-edho-ferdian/SKILL.md` |
| `performance-audit-edho-ferdian` | Measure, fix, re-measure: profile with real tooling (Lighthouse, bundle analyzers, heap snapshots, profilers, EXPLAIN), fix, and prove the… | `skills/performance-audit-edho-ferdian/SKILL.md` |
| `research-ops-edho-ferdian` | Evidence-first research: pick the lightest path that answers, synthesize sources into a cited report, and label each claim as sourced,… | `skills/research-ops-edho-ferdian/SKILL.md` |
| `safe-execution-edho-ferdian` | Mechanical gates for agent runs: investigate before the first edit, guard destructive commands, freeze write scope for autonomous or… | `skills/safe-execution-edho-ferdian/SKILL.md` |
| `security-review-edho-ferdian` | The single source of security review criteria: OWASP-style checklist (SEC-01..19) plus stack- and domain-specific items, standalone or as… | `skills/security-review-edho-ferdian/SKILL.md` |
| `seo-audit-edho-ferdian` | Technical and on-page SEO audit: crawlability, indexability, structured data, meta tags, sitemap/robots.txt, mobile and internal links,… | `skills/seo-audit-edho-ferdian/SKILL.md` |
| `skill-audit-edho-ferdian` | Audit this repo's skills/ for staleness, redundancy, broken cross-references and weak descriptions (not the ~/.claude setup: that is… | `skills/skill-audit-edho-ferdian/SKILL.md` |
| `skill-authoring-edho-ferdian` | Create and govern this ecosystem's skills: search before building, a quality bar, compliance checks, promoting repeated principles to… | `skills/skill-authoring-edho-ferdian/SKILL.md` |
| `spec-mining-edho-ferdian` | Extract behavioural specs from a codebase with none: WHEN/THEN requirements and invariants, each anchored to the code that enforces it,… | `skills/spec-mining-edho-ferdian/SKILL.md` |
| `system-design-edho-ferdian` | Mid-project architecture decisions: ADRs, trade-off analysis, non-functional requirements, scaling tiers and blast radius. Use for "desain… | `skills/system-design-edho-ferdian/SKILL.md` |
| `test-authoring-edho-ferdian` | Write unit and component tests well: React Testing Library, pytest, Go and Vue, plus regression-test patterns. Use for "tulis test untuk… | `skills/test-authoring-edho-ferdian/SKILL.md` |
| `video-style-edho-ferdian` | Measure a reference video's look and pacing (colour grade as a 3D LUT, cut rhythm, overlays) and reproduce it: grade, cut and composite new… | `skills/video-style-edho-ferdian/SKILL.md` |

## Notes for non-Claude-Code harnesses

- These skills were authored for Claude Code's Agent Skills format, but the
  content itself is plain Markdown with no Claude-specific syntax — reading
  a `SKILL.md` file directly works the same way here as it does there.
- If this harness also supports a native rules/instructions directory
  (`.cursor/rules/`, `.windsurf/rules/`, `.clinerules/`, etc.), check
  whether this repo ships an adapter for it under `scripts/export_*.py`
  before assuming this router file is the only option.
