# Results — seeded-bug benchmark, v4 corpus: 22-26-file logic PRs (2026-10-08)

Claude Code 2.1.292, `claude-opus-5-5` / `claude-sonnet-5-5`, 8 cases × 3
configurations = 24 runs, all valid. Cost is the client-side estimate at
API rates, spent as Pro plan usage.

v4 tests the size D-062 set the reviewer's escalation trigger at: about 20
or more changed files that carry logic. Each PR changes **22-26 files**
across 12-14 modules of a multi-store commerce API, each module with a
different logic change — large, but not one mechanical edit repeated. In
six PRs one module breaks a rule in `docs/ARCHITECTURE.md`, which the PR
does not touch.

| Config | Recall | Recall@high | Control FP (high+, PR files) | Control medium | $ / case |
|---|---|---|---|---|---|
| opus-high | 6/6 | 5/6 | 0 | 1 | $0.488 |
| sonnet-high (code-reviewer's tier today) | 6/6 | 5/6 | 0 | 5 | $0.261 |
| sonnet-medium (code-reviewer under `hemat`) | **5/6** | 4/6 | 0 | 6 | $0.238 |

Every catch was read by hand.

## The first difference between tiers

**v4-04 (money filter in dollars):** Opus and Sonnet high both flagged at
high severity that `?min` is read in dollars and converted, against rule 4
(money query parameters are given in cents). Sonnet medium read the same
line but raised only a low finding about overflow on huge values and never
mentioned the units rule — a real miss. It first scored as a catch because
the keyword "cent" also matched "priceCents"; the keywords were tightened to
"dollar" / "rule 4" / "in cents" / "minCents" and the run rescored, so the
table now matches the hand check.

**v4-05 (email logged):** all three caught it and all three rated it
medium, not high. That is consistent severity calibration across tiers,
not a tier difference.

The remaining four bugs (store scope, soft-delete filter, unbounded limit,
hard delete) were caught at high severity by every configuration.

Control findings at medium were design comments, not errors: gift-card
codes returned in reads, search without a deterministic `orderBy`,
addresses scoped by store but not by customer.

## What this means for D-062

- At 22-26 logic files the **default reviewer (Sonnet high) still matched
  Opus**: 6/6 caught, the same 5/6 at high severity, at 53% of the cost.
- The **cheaper configuration (Sonnet medium) missed its first seeded bug
  at this size**, after catching 33/33 at 1-12 files (v1-v3).
- Under the `hemat` profile the reviewer runs Sonnet medium, and escalating
  it "one tier up" runs it at the deep tier — which `hemat` maps to Sonnet
  high, the configuration that caught v4-04. So the ~20-logic-file trigger
  sits where the cheapest setup starts to slip, and escalating fixes the
  observed miss. **Recommendation: keep D-062 as it is.**

One miss in six cases is weak evidence on its own; it is the first
separation in 39 seeded bugs, and it points the same way the trigger does.
