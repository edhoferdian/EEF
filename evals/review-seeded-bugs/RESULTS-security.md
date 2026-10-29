# Security corpus — boundary gate and Needs validation (2026-10-29)

First run of the `security` corpus. It compares `security-review-edho-ferdian`
before and after the change that added the boundary-and-result gate, the
Needs-validation verdict, the severity anchors and "defense in depth is not a
vulnerability". Both versions ran from exported skills trees
(`--skills-dir … --variant before|after`), not from the installed skills, at
`sonnet-high`, one run per case.

Records: `results-security/runs/20261029T131414Z-pr1-before.json` and
`results-security/runs/20261029T132626Z-pr1-after.json`.
(`20261029T130442Z-pilot-skills-dir.json` was a one-case pilot that checked
`--skills-dir` actually loads the exported tree; the review cited SEC codes,
so it did.)

| version | recall | recall@high | control FP (high+) | control medium | findings, all cases | cost (est.) |
|---|---|---|---|---|---|---|
| before | 8/8 | 7/8 | 0 | 6 | 57 | $1.96 |
| after | 8/8 | 6/8 | 0 | 4 | 43 | $2.17 |

- **Every seeded vulnerability is still found.** Recall stays 8/8.
- **Less noise.** 25% fewer findings across the corpus (57 → 43). Medium
  findings on the two safe controls fall from 6 to 4. Most of the drop is
  defense-in-depth items that moved to ⚪ INFO or out of the findings.
- **recall@high drops by one case: `05-webhook_auth.py`.** The `==`
  comparison on an HMAC was still found, but as MEDIUM instead of HIGH. The
  new anchors keep HIGH for a result that fully defeats an explicit control,
  and the review argued that a network timing attack on the comparison is
  hard to exploit in practice. That is arguably the intended calibration,
  but the answer key counts it as a miss and it is reported as one here.
- **About 10% more cost**, from the extra gate reasoning.

Ten cases, one run each: a one-case difference is noise (see README
§Limits). This run supports "precision improved and recall held", nothing
stronger.
