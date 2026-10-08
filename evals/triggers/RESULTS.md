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

## Run 2 (2026-10-08) — in-repo variants, cut short by the plan usage limit

`--case "*-in-repo" --scaffold`, $1.20. The Pro plan's usage limit was hit
mid-run, so only part of it is valid:

| Case | Fired | Valid? |
|---|---|---|
| build-broken-in-repo | 2/2 (inline: 1/2) | yes |
| not-on-google-in-repo | 2/2 (inline: 0/2) | yes — the skill fired before one run hit the limit |
| commit-and-rebase-in-repo | 0/2 | yes — still not firing |
| review-before-merge-in-repo | 0/2 | **no** — both runs hit the usage limit |
| simplify-nesting-in-repo | 0/2 | **no** — both runs hit the usage limit |

So far: build-fix and seo-audit fire once the code lives in files (prompt
shape), while git-and-release-ops does not fire either way (its description
needs strengthening). code-review and code-simplification remain untested
in-repo — rerun those two after the limit resets.

## Run 3 (2026-10-08) — after strengthening three descriptions

The misses that stayed after the in-repo check were description problems:
the descriptions already listed the user's exact phrases, but gave Claude
no reason to load a skill for a quick request, so it answered by itself.
git-and-release-ops (86f7826), then code-review and code-simplification
now say to load the skill even for a quick request, and *why* — the
binding conventions or the safety gate it carries. $2.0 in total.

| Case | Before | After |
|---|---|---|
| commit-and-rebase | 0/2 | 2/2 |
| commit-and-rebase-in-repo | 0/2 | 2/2 |
| review-before-merge | 0/2 | 2/2 |
| review-before-merge-in-repo | 0/2 | 2/2 |
| review-pr-english | 0/2 | 1/2 |
| simplify-nesting | 0/2 | 2/2 |
| simplify-nesting-in-repo | 0/2 | 2/2 |

build-fix and seo-audit fire once the code lives in files (run 2), so they
were left unchanged. Lesson for every skill description: name the reason to
load the skill — what it carries that a direct answer would miss — not just
trigger phrases.

## Run 4 (2026-10-08) — build-fix and seo-audit, $1.21

Pasting a build error inline is how most build questions arrive, so the
inline misses mattered for build-fix and seo-audit too. Both descriptions
got the same "load it even for one pasted X, because…" sentence.

| Case | Before | After |
|---|---|---|
| build-broken (inline) | 1/2 | 2/2 |
| build-broken-in-repo | 2/2 | 2/2 |
| not-on-google (inline) | 0/2 | 0/2 |
| not-on-google-in-repo | 2/2 | 1/2 |

The build-fix change is kept. The seo-audit change showed no gain (and
one fewer in-repo hit, within the noise of two runs), so it was reverted
except for a fix to "Cross-references", which a line break had split at
its hyphen. With robots.txt `Disallow: /` pasted, the answer is obvious and
Claude gives it directly; the case may need a less self-evident fixture
rather than a stronger description.
