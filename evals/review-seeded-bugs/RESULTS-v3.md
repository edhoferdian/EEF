# Results — seeded-bug benchmark, v3 corpus: large PRs (2026-10-08)

Claude Code 2.1.292, `claude-opus-5-5` / `claude-sonnet-5-5`, 8 cases × 3
configurations = 24 runs, all valid; a 3-run pilot was discarded after it
exposed two real bugs in the base project (fixed in 9f665e3). Cost is the
client-side estimate at API rates, spent as Pro plan usage.

v3 tests the threshold D-061 left as a guess: code-reviewer runs at the
standard tier and is escalated for "roughly ten or more changed files".
Each PR changes **10-12 files** in a ~16-file project with an architecture
or conventions doc; one change carries a bug that is only wrong given a
file the PR does not touch, hidden among benign changes.

| Config | Recall | Recall@high | Control FP (high+, PR files) | Control medium | Findings / case | $ / case |
|---|---|---|---|---|---|---|
| opus-high | 6/6 | 6/6 | 0 | 5 | 11.4 | $0.366 |
| sonnet-high | 6/6 | 6/6 | 0 | 3 | 11.1 | $0.193 |
| sonnet-medium | 6/6 | 6/6 | 1 | 4 | 9.8 | $0.167 |

All 18 catches were read by hand; each names the seeded bug and the
untouched document that makes it a bug ("ARCHITECTURE.md requires reserve,
then charge", "CONVENTIONS.md requires tax once on the subtotal").

The one high finding on a control (Sonnet medium, v3-07): `to: userId`
passed to the mailer as a recipient. That pattern is in the base project
and was copied by the benign change; the reviewer hedged it ("unless the
mailer resolves IDs"). It is a fair question, not a clear false positive.

## What this shows

- **No tier fell behind on 10-12-file PRs.** Every configuration caught
  every bug at high or critical severity while reading a dozen changed
  files and the docs around them.
- **Across all three corpora, every tier has caught 33 of 33 seeded bugs**
  — single-file, multi-file with context, and large PRs.
- **Cost:** Sonnet medium is 46% of Opus high per case, Sonnet high 53%.

## What it still does not show

The base projects are small (~16 files) and their docs are short and on
point, so finding the relevant rule is easy. PRs of 30+ files, repos of
hundreds of files, rules that live only in other code rather than a doc,
and bugs needing several hops of reasoning remain untested.

## Recommendation (proposed, not applied)

The ~10-file escalation trigger in `code-review-edho-ferdian` is not
supported by this data: at 10-12 files the standard tier did as well as
Opus. Options for the user:

1. **Raise the size trigger** to roughly 25+ changed files, keeping the
   other two triggers (a change spanning several services/modules, a review
   the Critic disputes). Saves an Opus review on most mid-sized PRs; the
   region above 12 files is still untested, so the new number is a
   judgment, not a measurement.
2. **Keep ~10 files** as cheap insurance until real-use telemetry
   (SubagentStop log, §4.4) shows escalated reviews finding what the first
   pass missed.
