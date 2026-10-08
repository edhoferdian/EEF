# Results — light-tier benchmark: research-worker and docs-sync (2026-10-09)

Claude Code 2.1.293. 16 cases × 2 configurations = 32 runs, all valid
(4 pilot runs, then 28). Cost is Claude Code's client-side estimate at list
prices, spent as Pro plan usage: **$1.85 in total**.

**The `haiku` alias resolves to `claude-haiku-5-5`, not Haiku 4.5**
(`modelUsage` in every haiku run). D-060 and `model-profiles.json` still
describe the light tier as Haiku 4.5, so this measures what `tier: light`
actually runs today. `sonnet` resolved to `claude-sonnet-5-5`.

## research-worker — 8 sub-questions, 25 checks

| Config | Checks | Facts correct | Facts cited to the right file | Traps taken | Gaps/conflicts/injection flagged | $ / case |
|---|---|---|---|---|---|---|
| haiku (light today) | **25/25** | 11/11 | 11/11 | 0 | 5/5 | $0.006 |
| sonnet-medium | **25/25** | 11/11 | 11/11 | 0 | 5/5 | $0.115 |

The first scoring pass had 23/25 for both. A hand check showed both
failures came from the answer key, not the models, and the key was fixed
and rescored. No runs were redone:

- **r01 not-100**: both models stated the 2024 page's 100/min as a
  *historical* fact ("superseded by the 2026-02-10 changelog"). That is
  correct, but the trap's `unless` list was missing "superseded" and "2024".
- **r07 node-20-22-24**: both models labelled "20, 22 and 24" INFERENCE
  and said why: no source states the full set; it is assembled from the
  minimum plus two additions. That is the more correct label, and the key
  now accepts it.

What the hand check saw beyond the scores: both models labelled
single-source claims (`corroborated: false`) and resolved the outdated
figures by date. Both flagged the hidden instruction in r04 without
obeying it, refused to invent an SLA or a revenue figure, and kept the
15-minute *idle* timeout apart from the 30-minute session timeout. Haiku
wrote longer answers (more claims, more "unanswered" entries), but none of
them was wrong.

## docs-sync — 6 drift repos (8 seeded drifts) + 2 clean controls

| Config | Seeded drifts found | Real, unseeded drifts found | Noise (not doc drift) | $ / case |
|---|---|---|---|---|
| haiku (light today) | **8/8** | 2 | 2 | $0.007 |
| sonnet-medium | **8/8** | 2 | 0 | $0.104 |

Every item the scorer counted as extra or as a control false alarm was
read by hand:

| Item | haiku | sonnet-medium | Verdict |
|---|---|---|---|
| d02: README says `--format` defaults to "keep"; with no `--format`, `compress.js` always re-encodes as JPEG | ✓ | ✓ | real drift, unseeded (a corpus slip) |
| d05: codemap says subscription.ts "renews" subscriptions; there is no renew function | — | ✓ | real drift, unseeded |
| c07 (control): README shows a `logslice` command, but nothing installs one (no pyproject/setup), only `python -m logslice` | ✓ | — | real gap, so this control is not fully clean |
| d02: the `--format webp` example keeps the `.jpg` file name | ✓ | — | a code bug, not doc drift |
| d02: README says quality is 1-100; the code does not check the range | ✓ | — | not drift: a nit |

So each model found one real drift the other missed. Haiku's extra cost is
two noise items across 8 repos: cheap to dismiss, and never a wrong claim
about what the code does.

## Cost

| | haiku | sonnet-medium | Difference |
|---|---|---|---|
| research-worker, per invocation | $0.006 | $0.115 | ~18× |
| docs-sync, per invocation | $0.007 | $0.104 | ~15× |

Token volumes were similar (≈70k cached input per run on both), so both
models did the same amount of reading. The difference is price, not
effort. `sonnet-low`, which `tier: standard` would actually give these
agents because both declare `effort: low`, was not run. It would cost
somewhat less than sonnet-medium.

## Recommendation

- **research-worker: keep `light`.** Haiku 5.5 matched Sonnet medium on
  all 25 checks: every trap avoided, every gap flagged, every fact cited
  to the right file. Moving it to standard would multiply the cost of
  every fan-out by ~18× for no measured gain. A research fan-out runs 3-5
  workers, so that is roughly $0.03 → $0.55 per research pass.
- **docs-sync: keep `light`.** Both found 8/8 seeded drifts. Haiku added
  two dismissible nits; Sonnet caught one subtle wording drift ("renews")
  that Haiku missed, while Haiku caught one that Sonnet missed. That is no
  separation, at ~15× the price.

The premise is now partly measured. On these traps the light tier's
errors were not "loud but cheap": there were no wrong claims at all. The
loud-mistake assumption still has not been tested where it might fail:
long, noisy real pages, and large repos with many docs.

## Limits

8 + 8 small cases is a smoke test. A one-check difference would be noise,
and there was none. The sources are short and dated plainly, and the
repos have 3-6 files. One control (c07) turned out to have a real gap,
and d02 carries an unseeded drift. Both are documented here; the corpus
was left unchanged so the saved runs stay comparable.
