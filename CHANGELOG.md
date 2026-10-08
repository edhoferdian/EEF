# Changelog

Generated from conventional commits by `scripts/generate_changelog.py` — do not edit by hand.

## [v1.20.0](https://github.com/edhoferdian/EEF/releases/tag/v1.20.0) — 2026-10-08

### Features

- **install:** add eef-install update for stale Claude Code installs ([3c8d1ec](https://github.com/edhoferdian/EEF/commit/3c8d1ec))
- **scripts:** generate CHANGELOG.md and release notes from commits ([8b79054](https://github.com/edhoferdian/EEF/commit/8b79054))
- **evals:** add a v3 corpus of large PRs for the reviewer threshold ([2f98eb1](https://github.com/edhoferdian/EEF/commit/2f98eb1))

### Fixes

- **skills:** make code-review and code-simplification load for quick requests ([5f27ab9](https://github.com/edhoferdian/EEF/commit/5f27ab9))
- **skills:** make build-fix load for a single pasted build error ([9e23bb7](https://github.com/edhoferdian/EEF/commit/9e23bb7))
- **agents:** verify Codex models against Codex's own catalog ([ee9fd83](https://github.com/edhoferdian/EEF/commit/ee9fd83))
- **evals:** remove real bugs from the v3 base project, score PR files only ([a78ba36](https://github.com/edhoferdian/EEF/commit/a78ba36))
- **evals:** restore the full v1 benchmark scores ([e364fbc](https://github.com/edhoferdian/EEF/commit/e364fbc))

### Performance

- **skills:** trim the five largest SKILL.md files (~6.6k tokens across them) ([7fa2ff3](https://github.com/edhoferdian/EEF/commit/7fa2ff3))
- **code-review:** keep PR Review Mode inline, compacted ([e072dc1](https://github.com/edhoferdian/EEF/commit/e072dc1))

### Documentation

- **evals:** record the v3 large-PR benchmark run ([78cad77](https://github.com/edhoferdian/EEF/commit/78cad77))
- **evals:** correct findings-per-case figures in RESULTS-v3 ([2825400](https://github.com/edhoferdian/EEF/commit/2825400))

### Tests and evals

- **evals:** record review benchmark after the SKILL.md trim â€” no regression ([5bb49f8](https://github.com/edhoferdian/EEF/commit/5bb49f8))

### Maintenance

- bump version to 1.20.0 (eef-install update, changelog, trigger fixes, large-PR benchmark) ([5f71e63](https://github.com/edhoferdian/EEF/commit/5f71e63))

## [v1.19.0](https://github.com/edhoferdian/EEF/releases/tag/v1.19.0) — 2026-10-08

### Features

- **agents:** route agent models by tier instead of a fixed sonnet (D-060) ([c526a91](https://github.com/edhoferdian/EEF/commit/c526a91))
- **install:** add Codex agents and per-install model profiles ([8ff37a1](https://github.com/edhoferdian/EEF/commit/8ff37a1))
- **skills:** let orchestrators escalate one delegated step a tier up ([1058e41](https://github.com/edhoferdian/EEF/commit/1058e41))
- **config-hygiene:** log subagent runs to re-tier agents from evidence ([516ed12](https://github.com/edhoferdian/EEF/commit/516ed12))
- **evals:** add a seeded-bug benchmark for the review agents' tier ([ef19910](https://github.com/edhoferdian/EEF/commit/ef19910))
- **install:** add claude-hooks target and read-only doctor command ([9c9f8bb](https://github.com/edhoferdian/EEF/commit/9c9f8bb))
- **evals:** add a multi-file v2 corpus that needs context to see the bug ([f0685d4](https://github.com/edhoferdian/EEF/commit/f0685d4))
- **agents:** run code-reviewer at standard tier, escalate large PRs (D-061) ([981720c](https://github.com/edhoferdian/EEF/commit/981720c))
- **scripts:** measure EEF's per-session context cost and cap it in CI ([dc7e352](https://github.com/edhoferdian/EEF/commit/dc7e352))

### Fixes

- **scripts:** detect text by content when packaging skills ([81a7c4f](https://github.com/edhoferdian/EEF/commit/81a7c4f))
- **skills:** make git-and-release-ops load for quick git questions ([86f7826](https://github.com/edhoferdian/EEF/commit/86f7826))

### Performance

- **agents:** stop agent descriptions restating their skill (~4.5k tokens/session) ([c4d95a9](https://github.com/edhoferdian/EEF/commit/c4d95a9))

### Documentation

- **scripts:** mark the quoted ZCode agent body as verbatim evidence ([8034664](https://github.com/edhoferdian/EEF/commit/8034664))
- **config-hygiene:** document the Claude Code advisor tool's place ([7203a2e](https://github.com/edhoferdian/EEF/commit/7203a2e))
- **evals:** record run 1 of the review seeded-bug benchmark ([6ffccd9](https://github.com/edhoferdian/EEF/commit/6ffccd9))
- **skills:** point hook setup at eef-install --target claude-hooks ([7d9d33c](https://github.com/edhoferdian/EEF/commit/7d9d33c))
- **evals:** record the v2 multi-file benchmark run ([16877cb](https://github.com/edhoferdian/EEF/commit/16877cb))

### Tests and evals

- **evals:** add skill-trigger evals for claude plugin eval ([1dfbe7e](https://github.com/edhoferdian/EEF/commit/1dfbe7e))
- **evals:** record trigger run 1 and add in-repo variants of the misses ([bf2242f](https://github.com/edhoferdian/EEF/commit/bf2242f))
- **evals:** record partial in-repo trigger run (usage limit hit) ([8208ba9](https://github.com/edhoferdian/EEF/commit/8208ba9))

### CI and release

- **publish:** move npm publishing to trusted publishing and gate it on CI checks ([534477e](https://github.com/edhoferdian/EEF/commit/534477e))

### Maintenance

- **git:** normalize line endings to LF ([8837db2](https://github.com/edhoferdian/EEF/commit/8837db2))
- bump version to 1.19.0 (tier-routed agents, Codex agents, review benchmark) ([0a6981a](https://github.com/edhoferdian/EEF/commit/0a6981a))

## [v1.18.0](https://github.com/edhoferdian/EEF/releases/tag/v1.18.0) — 2026-09-24

### Features

- ship Gate 2 runaway-search hook, automate D-034 external-rules check ([a3b97f7](https://github.com/edhoferdian/EEF/commit/a3b97f7))
- add counterparty-comms, legal-ops, video-style skills, Rails guide, native rules/ (D-058, D-059) ([e4c68b4](https://github.com/edhoferdian/EEF/commit/e4c68b4))

### Fixes

- preload wrapped skill in agent wrappers, ban filesystem-wide searches (D-055) ([513ea63](https://github.com/edhoferdian/EEF/commit/513ea63))

### Maintenance

- bump version to 1.18.0 (3 new skills, Rails guide, native rules/, agent skill preload + runaway-search hook) ([ce4600e](https://github.com/edhoferdian/EEF/commit/ce4600e))

## [v1.17.4](https://github.com/edhoferdian/EEF/releases/tag/v1.17.4) — 2026-09-20

### Fixes

- guard prepare script so npm publish doesn't fail without devDependencies ([c243fd5](https://github.com/edhoferdian/EEF/commit/c243fd5))

## [v1.17.3](https://github.com/edhoferdian/EEF/releases/tag/v1.17.3) — 2026-09-20

### Documentation

- fix stale "33 skills" count to 35 in SPONSORS.md and skill-authoring-edho-ferdian ([b47e09c](https://github.com/edhoferdian/EEF/commit/b47e09c))
- annotate historical skill/agent counts in README as point-in-time ([9f959cc](https://github.com/edhoferdian/EEF/commit/9f959cc))

### Maintenance

- skill-hygiene pass â€” adopt Â§10 surgical-changes contract, trim bloated descriptions ([abded9c](https://github.com/edhoferdian/EEF/commit/abded9c))
- regenerate cross-harness exports after skill-hygiene pass ([80e8f31](https://github.com/edhoferdian/EEF/commit/80e8f31))
- add pre-commit hook guarding skills/ vs cross-harness export drift ([e76f45c](https://github.com/edhoferdian/EEF/commit/e76f45c))
- bump version to 1.17.3 (skill-hygiene pass: Â§10 contract, trimmed descriptions, stale-count fixes, pre-commit hook) ([8ba325f](https://github.com/edhoferdian/EEF/commit/8ba325f))

## [v1.17.2](https://github.com/edhoferdian/EEF/releases/tag/v1.17.2) — 2026-09-19

### Features

- add surgical-changes canonical contract, adapted from andrej-karpathy-skills ([25d87df](https://github.com/edhoferdian/EEF/commit/25d87df))

### Fixes

- surface AI-slop detection in frontend-engineering-edho-ferdian trigger ([b5d4b00](https://github.com/edhoferdian/EEF/commit/b5d4b00))
- trim AI-slop description under 1024-char CI limit, sync exports ([a4a9985](https://github.com/edhoferdian/EEF/commit/a4a9985))

### Documentation

- document npm token gotcha, fix stale "repo is private" note ([98cd432](https://github.com/edhoferdian/EEF/commit/98cd432))

### Maintenance

- repackage dist/frontend-engineering-edho-ferdian.skill ([e5b2456](https://github.com/edhoferdian/EEF/commit/e5b2456))
- bump version to 1.17.2 (AI-slop trigger phrase fix) ([2c266ff](https://github.com/edhoferdian/EEF/commit/2c266ff))

## [v1.17.1](https://github.com/edhoferdian/EEF/releases/tag/v1.17.1) — 2026-09-16

### CI and release

- add npm-publish-on-release workflow, single source of truth for skill counts ([4bdceb2](https://github.com/edhoferdian/EEF/commit/4bdceb2))

### Maintenance

- bump version to 1.17.1 (test automated npm-publish-on-release flow) ([98a7f05](https://github.com/edhoferdian/EEF/commit/98a7f05))

## [v1.17.0](https://github.com/edhoferdian/EEF/releases/tag/v1.17.0) — 2026-09-16

### Features

- add HeroUI/Impeccable bridge to frontend-engineering, new code-quality-tooling skill ([a15dc11](https://github.com/edhoferdian/EEF/commit/a15dc11))

### Documentation

- add generated skill/agent catalog, README usage section, fix stale skill-count drift ([07d6f44](https://github.com/edhoferdian/EEF/commit/07d6f44))

### Maintenance

- bump version to 1.17.0, fix stale skill counts in package metadata ([2453293](https://github.com/edhoferdian/EEF/commit/2453293))

## [v1.16.1](https://github.com/edhoferdian/EEF/releases/tag/v1.16.1) — 2026-09-12

### Fixes

- retire skill-audit's dead staleness-detection grep, rebase it internally ([2941cb4](https://github.com/edhoferdian/EEF/commit/2941cb4))

### Maintenance

- bump version to 1.16.1 ([71a9631](https://github.com/edhoferdian/EEF/commit/71a9631))

## [v1.16.0](https://github.com/edhoferdian/EEF/releases/tag/v1.16.0) — 2026-09-12

### Features

- add code-simplification-edho-ferdian skill and agent ([abfe7dd](https://github.com/edhoferdian/EEF/commit/abfe7dd))

## [v1.15.0](https://github.com/edhoferdian/EEF/releases/tag/v1.15.0) — 2026-09-11

### Features

- ZCode support and an experimental agent-orchestration layer ([7dd8ae4](https://github.com/edhoferdian/EEF/commit/7dd8ae4))
- dev-kickoff's REVIEW stage delegates to the code-reviewer agent ([90eab69](https://github.com/edhoferdian/EEF/commit/90eab69))
- give every skill an agent counterpart (33/33), not a curated subset ([3d90184](https://github.com/edhoferdian/EEF/commit/3d90184))
- split gan-harness and opensource-release into phase-isolated agents ([27fa1f4](https://github.com/edhoferdian/EEF/commit/27fa1f4))
- split code-review's Critique-Correction Loop into Reviewer/Critic agents ([dfa7011](https://github.com/edhoferdian/EEF/commit/dfa7011))
- confirm and wire up nested delegation on Claude Code ([7859a89](https://github.com/edhoferdian/EEF/commit/7859a89))
- split research-ops into parallel workers plus an independent fact-checker ([7846f0d](https://github.com/edhoferdian/EEF/commit/7846f0d))
- fan out deployment-ops' production-readiness verdict to 4 existing agents ([0997123](https://github.com/edhoferdian/EEF/commit/0997123))
- formalize seo-audit's existing performance-audit hand-off as a real delegation ([eed9c71](https://github.com/edhoferdian/EEF/commit/eed9c71))
- fan out click-path-audit and spec-mining across independent shards ([04d0d76](https://github.com/edhoferdian/EEF/commit/04d0d76))
- complete the full-sweep agent-split review across all 33 skills ([80a5ded](https://github.com/edhoferdian/EEF/commit/80a5ded))
- adopt Context7 MCP as canonical live-docs dependency for authoring skills ([cb237a7](https://github.com/edhoferdian/EEF/commit/cb237a7))

### Fixes

- stop gitignoring .claude/, keep only the session-local lock file ([5b95ed7](https://github.com/edhoferdian/EEF/commit/5b95ed7))
- address code-reviewer-edho-ferdian's findings on the agent-orchestration CLI ([29c3bbf](https://github.com/edhoferdian/EEF/commit/29c3bbf))
- gate OpenCode's task tool to match Claude Code's leaf/orchestrator design ([df4e892](https://github.com/edhoferdian/EEF/commit/df4e892))

### Documentation

- clarify deferred llm-pipeline-engineering-edho-ferdian was never built ([1c34cbe](https://github.com/edhoferdian/EEF/commit/1c34cbe))
- document Hermes' opt-in nested delegation requirement ([fedfe05](https://github.com/edhoferdian/EEF/commit/fedfe05))

### Maintenance

- resync generated skill adapters with backend-engineering-edho-ferdian fix ([78b69a2](https://github.com/edhoferdian/EEF/commit/78b69a2))

## [v1.1.0](https://github.com/edhoferdian/EEF/releases/tag/v1.1.0) — 2026-09-09

### Features

- close the 34-item DEFER backlog and remaining gap docs ([b5ed396](https://github.com/edhoferdian/EEF/commit/b5ed396))
- close remaining DEFERRED items, trim oversized descriptions, add self-orchestrating dev loop ([71f01c6](https://github.com/edhoferdian/EEF/commit/71f01c6))
- add GitHub Sponsors tiers and funding config ([8c77218](https://github.com/edhoferdian/EEF/commit/8c77218))
- remove all ECC mentions from the ecosystem, zero external attribution ([53ba399](https://github.com/edhoferdian/EEF/commit/53ba399))
- add CI, LICENSE (MIT), and a canonical packaging script ([48b5ebd](https://github.com/edhoferdian/EEF/commit/48b5ebd))
- cross-harness export â€” AGENTS.md router + Cursor .mdc adapter ([6256a76](https://github.com/edhoferdian/EEF/commit/6256a76))
- three more cross-harness adapters â€” Windsurf/Devin, Cline, GitHub Copilot ([6aa545c](https://github.com/edhoferdian/EEF/commit/6aa545c))
- Kiro adapter â€” generated .kiro/skills/ copy, not a hand-maintained fork ([310ab1e](https://github.com/edhoferdian/EEF/commit/310ab1e))
- npm CLI (eef-install) â€” install into any supported harness, no git needed ([696775f](https://github.com/edhoferdian/EEF/commit/696775f))
- Hermes Agent and OpenClaw adapters -- both via the agentskills.io standard ([8bd93e6](https://github.com/edhoferdian/EEF/commit/8bd93e6))

### Fixes

- refresh stale stack-list descriptions found by skill-audit-edho-ferdian ([f97c19c](https://github.com/edhoferdian/EEF/commit/f97c19c))
- stale PHP/Java 'deferred' reference list in security-review body prose ([ad4ed10](https://github.com/edhoferdian/EEF/commit/ad4ed10))
- normalize line endings in package_skills.py so dist/ is reproducible across OSes ([cb84fd7](https://github.com/edhoferdian/EEF/commit/cb84fd7))
- compare decompressed content, not raw zip bytes, in dist-sync check ([0446694](https://github.com/edhoferdian/EEF/commit/0446694))

### Documentation

- add Enterprise inquiry section to README ([546645f](https://github.com/edhoferdian/EEF/commit/546645f))
- remove ECC branding from public-facing text, add NOTICE.md ([1c64b57](https://github.com/edhoferdian/EEF/commit/1c64b57))
- remove project-memory/ from repo layout (kept local-only) ([417d2cd](https://github.com/edhoferdian/EEF/commit/417d2cd))
- add CODE_OF_CONDUCT, CONTRIBUTING, and SECURITY policy ([851e8ca](https://github.com/edhoferdian/EEF/commit/851e8ca))

### Maintenance

- keep CLAUDE.md and project-memory/ local-only (not tracked) ([0913e80](https://github.com/edhoferdian/EEF/commit/0913e80))
- trigger CI (trailing newline touch) ([34af9d6](https://github.com/edhoferdian/EEF/commit/34af9d6))
- remove accidentally-committed __pycache__, ignore it going forward ([7cb4afd](https://github.com/edhoferdian/EEF/commit/7cb4afd))

## [v1.0.0](https://github.com/edhoferdian/EEF/releases/tag/v1.0.0) — 2026-09-07

### Features

- init EEF repo â€” 33 packaged skills, install scripts, plugin/marketplace manifest ([0edc0f5](https://github.com/edhoferdian/EEF/commit/0edc0f5))
