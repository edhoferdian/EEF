# Performance audit output format

This report template is built around the baseline → change → measured
delta → pass/fail structure this skill's measure-then-fix contract
requires — baseline/target columns alone are not enough; an explicit
re-measured-delta section closes that gap.

Save the filled-in output as `./<target>-performance-audit.md` and tell the
user the path.

```markdown
# Performance Audit — [Target: page/route/function/bundle/query]

**Date** · **Tech Stack** · **Target** · **Tools used**

## Executive Summary
- **Baseline**: [key metric and its starting value]
- **Budget**: [the row from the Core Web Vitals / complexity / bundle table this is judged against]
- **Result**: PASS / FAIL against budget, after the fix below
- **Critical issues found**: [N]

## Baseline Measurement
| Metric | Baseline | Budget | Status |
|--------|----------|--------|--------|
| [e.g. LCP] | X.Xs | < 2.5s | FAIL |
| [e.g. Bundle size (gzip)] | XXX KB | < 200 KB | WARN |
| [e.g. Query count on this route] | N queries | — | — |

Tool/command used to produce this baseline: `[exact command]`. Raw output
saved at `[path]`, if applicable.

## Diagnosis
### [Issue title]
**Location**: `path/to/file.ts:42`
**Measured impact**: [the specific number that confirms this, e.g. "adds
340ms to LCP", "3,200 redundant queries on a 50-item page (N+1)", "12MB
retained per modal open/close cycle, non-decreasing across 10 repetitions"]
**Diagnosis basis**: [which table/methodology in `web-frontend.md` this maps
to — Core Web Vitals budget / algorithmic complexity / heap-snapshot diff /
bundle composition]

## Fix Applied
```typescript
// Before (measured baseline above)
const slowCode = ...;

// After
const fastCode = ...;
```
**Change scope**: [smallest change that addresses the measured bottleneck —
name what was NOT touched, to make clear this wasn't a broader refactor]

## Re-measurement (same tool, same methodology as baseline)
| Metric | Baseline | After fix | Budget | Status |
|--------|----------|-----------|--------|--------|
| [metric] | X.Xs | Y.Ys | < 2.5s | PASS/FAIL |

**Delta**: [e.g. "LCP improved 340ms (2.9s to 2.56s), still 60ms over budget
— see Remaining Gap below" or "N+1 confirmed eliminated: 3,200 queries to 1
query"]

## Remaining Gap (only if still failing budget after the fix)
[What's left to close the gap, and whether it needs a further round of this
same measure-then-fix loop or a different approach entirely]

## Recommendations (lower priority, not required to close this audit)
1. [Priority recommendation, with which metric it would move]
2. [...]

## Re-audit Checklist
Re-run this skill when: this route/function changes again · a new heavy
dependency is added · a database migration touches indexed columns on this
query · before a major release.
```
