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

## Run 6 (2026-10-09) — invalidated cases re-run, then one fix at a time

Same flags, one `--case` per invocation. The eleven cases the spend limit
invalidated in run 5 ($3.40):

| Case | Expected skill (near-miss) | Fired |
|---|---|---|
| payment-retry-in-repo | backend-engineering | 2/2 |
| prototype-loop | gan-harness | 2/2 |
| react-dashboard-structure | frontend-engineering | 2/2 |
| research-compare | research-ops (not marketing) | 2/2, near-miss held |
| review-before-merge | code-review (not language-code-review) | 2/2, near-miss held |
| save-button-in-repo | click-path-audit | 2/2 |
| slow-office-network | networking-ops | 2/2 |
| stale-readme-in-repo | docs-sync | 2/2 |
| supplier-group-bot | counterparty-comms | 2/2 |
| wpf-cashier-test | desktop-e2e | 2/2 |
| **slow-report-in-repo** | performance-audit | **0/2** |

So 35 of 38 skills fire on their case and every near-miss check holds.
The three misses each got the proven fix — a sentence saying to load the
skill even for a quick request, and why — one at a time ($1.09 in total):

| Skill (case) | Before | After | Kept? |
|---|---|---|---|
| language-code-review (django-review-in-repo) | 0/2 | 2/4 | yes (c32cb2f) — a gain, but a small one |
| seo-audit (not-on-google, new fixture) | 0/2 | 0/2 | no — reverted |
| performance-audit (slow-report-in-repo) | 0/2 | 0/2 | no — reverted |

The language-code-review sentence was run four times because one hit in
two runs could not be told from noise. seo-audit has now failed the same
fix on two fixtures, a blatant one and a subtle one, so the fixture was
not the problem: with HTML pasted into the chat, Claude answers in one
turn every time. performance-audit has a different likely cause: its own
description says it is "not for a static read-time performance guess",
and with a 9-line function in hand Claude makes exactly that guess
instead of measuring. Both need a different change than the quick-request
sentence — for performance-audit, probably rewording that boundary so it
excludes reviews of code nobody reported slow rather than reported
slowness with the code in hand.

Spent across runs 5-6: about $10 of the $12 approved.

## Run 7 (2026-10-09) — a different change for the last two misses, $0.77

Same flags, one `--case` per invocation, one skill at a time, against a
$1.20 approval.

| Skill (case) | Change | Before | After | Kept? |
|---|---|---|---|---|
| performance-audit (slow-report-in-repo) | boundary reworded | 0/2 | 2/2 | yes (0c8c5a2) |
| seo-audit (not-on-google) | framed around the report | 0/2 | 0/2 | no — reverted |
| seo-audit (not-on-google) | framed as diagnosing missing pages | 0/2 | 0/2 | no — reverted |

performance-audit: the description used to exclude "a static read-time
performance guess". It now excludes flagging code nobody reported as
slow. It says to load the skill for reported slowness even when the slow
code is open and the cause looks obvious, because the obvious suspect is
often not where the time goes. This turned 0/2 into 2/2. With
language-code-review fixed in run 6, 37 of 38 skills now fire on their
case.

seo-audit: two new angles, neither the quick-request sentence. The first
led with the deliverable: an audit report whose findings are ranked on
the indexing-impact ladder, built from any signal including snippets
pasted into chat. The second recast the skill from "an SEO audit
workflow" to diagnosing why pages do not show up in Google, from pasted
snippets, a repo or a URL. Both got 0/2. In a kept trace, the skill was
listed in the session. Claude still answered in one turn, and the answer
was right: the canonical pointing at the homepage first, then the sitemap
on the staging host, then the `onclick`-only product links, each with a
fix. So with the evidence pasted inline, Claude judges the skill
unnecessary whatever the description says. The in-repo variant fires
(run 2), and that is how a real audit arrives. After four reverted
description changes on two fixtures, the inline case looks like a
limit of description-based triggering, not a wording problem. It stays
as a known miss.
