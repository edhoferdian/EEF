# Skill-trigger evals — results

## Run 1 (2026-10-08) — inline prompts

`claude plugin eval . --runs 2 --ablation none --model sonnet --max-cost-usd 5`,
Claude Code 2.1.292, 14 cases × 2 runs, $4.77 list-price estimate (spent as
Pro plan usage).

| Case | Expected skill | Fired |
|---|---|---|
| security-only | security-review (and *not* code-review) | 2/2 |
| architecture-decision | system-design | 2/2 |
| docker-compose-dev | container-ops | 2/2 |
| postgres-schema | data-layer-patterns | 2/2 |
| remove-dead-code | dead-code-cleanup | 2/2 |
| research-compare | research-ops | 2/2 |
| write-pytest | test-authoring | 2/2 |
| audit-my-skills | skill-audit (and *not* config-hygiene) | 2/2 |
| build-broken | build-fix | 1/2 |
| **review-before-merge** | code-review | **0/2** |
| **review-pr-english** | code-review | **0/2** |
| **simplify-nesting** | code-simplification | **0/2** |
| **commit-and-rebase** | git-and-release-ops | **0/2** |
| **not-on-google** | seo-audit | **0/2** |

Every failed run ended after **one turn with no tool call**: Claude answered
straight away without loading any skill. The passing cases ask for an
artifact that takes work (an ADR, a schema, a compose file, tests); the
failing ones paste a few lines of code or ask a short question that can be
answered on the spot. Both disambiguation checks held — no near-miss skill
fired.

Two explanations fit, and they need different fixes:

1. **Prompt shape** — for a tiny pasted snippet Claude judges a skill
   unnecessary, but with real files in a repository it would load one.
2. **Description strength** — the descriptions do not push hard enough for
   Claude to load the skill even for a quick request.

The `*-in-repo` variants of the five failing cases test (1): same request,
but the code lives in workspace files (seeded by `scaffold.sh`) and the
prompt names the path. If they fire, the skills work as used in practice;
if they still don't, the descriptions need strengthening.
