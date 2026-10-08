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

## Run 5 (2026-10-08) — coverage batch, cut short by the monthly spend limit

`claude plugin eval . --tag coverage --runs 2 --ablation none --model sonnet
--scaffold --trust-plugin --no-publish --max-cost-usd 12`, Claude Code
2.1.293, 29 cases × 2 runs (25 new cases, so every one of the 38 skills
now has one, plus four changed ones), $5.50. The account's monthly spend
limit was hit at the 18th case; every later run errored on its first turn.

| Case | Expected skill (near-miss that must not fire) | Fired |
|---|---|---|
| checkout-flow-test | e2e-testing (not desktop-e2e) | 2/2, near-miss held |
| claude-config-cleanup | config-hygiene (not skill-audit) | 2/2, near-miss held |
| comment-api-design | api-design | 2/2 |
| deploy-with-rollback | deployment-ops (not container-ops) | 2/2, near-miss held |
| docker-compose-dev | container-ops (not deployment-ops) | 2/2, near-miss held |
| double-charged | billing-ops | 2/2 |
| inbox-triage | communications-triage | 2/2 |
| kickoff-from-prd-in-repo | dev-kickoff | 2/2 |
| launch-positioning | marketing | 2/2 |
| legacy-rules-in-repo | spec-mining | 2/2 |
| lint-setup-in-repo | code-quality-tooling | 2/2 |
| match-video-look | video-style | 2/2 |
| nda-many-partners | legal-ops | 2/2 |
| new-skill-request | skill-authoring (not skill-audit) | 2/2, near-miss held |
| open-source-in-repo | opensource-release | 2/2 |
| overnight-agents | safe-execution | 2/2 (one run then hit the limit) |
| **django-review-in-repo** | language-code-review | **0/2** |
| **not-on-google** (new fixture) | seo-audit | **0/2** |

Not valid (limit hit, no tool call possible): payment-retry-in-repo,
prototype-loop, react-dashboard-structure, research-compare,
review-before-merge, save-button-in-repo, slow-office-network,
slow-report-in-repo, stale-readme-in-repo, supplier-group-bot,
wpf-cashier-test.

The seo-audit inline case no longer pastes `Disallow: /`; it pastes a shop
whose product pages are missing for several subtler reasons (canonical to
the homepage, sitemap on the staging host, product links that exist only
as `onclick`). Claude still answered in one turn without a skill, so the
miss is not about the answer being obvious. language-code-review was
skipped on a Django REST Framework review with the files in the workspace:
Claude read the files and reviewed them itself.
