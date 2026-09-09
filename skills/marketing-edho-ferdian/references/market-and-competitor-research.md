# Market & Competitor Research

This consolidates what would otherwise be a multi-part pipeline written for
an agency serving a paying client; this file keeps the method and drops the
client-deliverable theater.

This file is the **deep** path. `SKILL.md` Step 1 item 4 is the shallow one
(2-3 alternatives, one line each) and is correct for most requests. Escalate
here only when the answer will change a real decision: what to build next,
how to price, whether a niche is already taken, or how to position against a
named rival.

**Evidence method:** this file defines *what to look at and how to score it*.
For *how to gather and label evidence* (source priority, untrusted sources,
cross-checking, evidence labels), use `research-ops-edho-ferdian` — do not
re-derive it here.

---

## Stage 0 — The positioning brief (do not skip)

A competitor set scoped without your own lens is noise, not intelligence.
Before naming a single rival, lock four things:

| Field | Meaning |
|---|---|
| **Offer** | What this product actually does for someone |
| **Target user** | A specific person, not "developers" |
| **Differentiator** | The thing you believe is hard for others to copy |
| **Strategic tension** | The paired axes that define your target white-space |

The **strategic tension** is the load-bearing part and the one most often
skipped. It is two qualities that are usually traded off against each other,
where you intend to have both. Examples for a solo-dev tool:

- *distinctiveness × trustworthiness* — memorable enough to be talked about,
  credible enough to put in production
- *simplicity × depth* — usable in five minutes, still useful at year two
- *free/OSS × sustainable* — free to use, still funded enough to survive

If the tension is not defined, run `positioning-interview.md` first.

---

## Stage 1 — Scope and tier the competitor set

Goal: a defensible set of **8-15 candidates**, pruned to **5-8 profiled**.
Not a census. Breadth without pruning makes the next stage unmanageable.

### Populate across axes, not into buckets

Sorting by niche skews the landscape toward one archetype. Plot each
candidate on these axes and deliberately populate **both poles** of each:

1. **Positioning stance** — brand-led / opinionated (competes on POV) vs
   capability-led (competes on features and throughput)
2. **Specialization** — specialist (one tight job) vs generalist (broad menu)
3. **Size / model** — solo · small team · funded startup · incumbent
4. **Packaging** — productized (named tiers, clear scope) vs bespoke/opaque
5. **Distinctiveness posture** — conventional/safe vs contrarian/manifesto
6. **Evidence model** — outcome-led (metrics, named users, case depth) vs
   surface-led (screenshots, star counts, awards)
7. **Reach** — local/niche vs global
8. **Business model** — OSS-free · OSS + paid tier · closed paid · in-house

A competitor is **Direct** when it sits near you on positioning,
specialization, size, and audience *at once* — not on any single axis.

### Tiers

- **Direct** — same band, overlapping offer, same users. The real fight.
- **Adjacent** — partial overlap; pressures at the edges.
- **Aspirational** — not competing with you today, but sets the bar you aim at.
- **Substitutes** — the manual way, a shell script, a spreadsheet, "doing
  nothing", or a general-purpose AI assistant. Note as a threat vector.
  **For a developer tool the substitute is usually the strongest competitor
  and the one most often left off the list.**

### Where to look (match the source to the dimension)

| Source | What it is good for | What it lies about |
|---|---|---|
| The product's own site / README | Positioning, voice, packaging, claimed users | Traction, real limitations |
| Repo (issues, commits, releases) | Real maintenance health, actual bug surface, roadmap honesty | Nothing — this is the strongest source for OSS rivals |
| Package registry (npm/PyPI/crates) | Download trend, dependency count, release cadence | Downloads ≠ users (CI inflates them) |
| Changelog / release notes | Velocity, whether it is still alive | — |
| Community (Discord, issues, forum) | What users actually struggle with, in their own words | Loudest voices, not median ones |
| Reviews / directories / HN threads | Independent credibility, honest failure reports | Recency bias, brigading |
| Author's writing, talks, newsletter | Owned POV, thought-leadership depth | Depth of writing ≠ depth of product |

**Verify any attribute across at least two sources before treating it as
fact.** Self-reported site copy is marketing, not evidence.

### Pre-filter scoring (decide who graduates)

Score 1-5. Keep candidates that score high on **either** distinctiveness
**or** credibility — both poles are instructive.

| Candidate | Stance | Size | Tier | Offer overlap | Distinctiveness | Credibility | Include? |
|---|---|---|---|---|---|---|---|

- High distinctiveness **and** high credibility → **must profile** (proves
  your target tension is achievable)
- High distinctiveness, low credibility → **cautionary case** (memorable but
  nobody trusts it in production — a failure mode to learn from)
- High credibility, low distinctiveness → the **"competent but forgettable"**
  mass you define yourself against
- Low on both → drop unless needed for landscape breadth

---

## Stage 2 — Score the set on comparable dimensions

Same dimensions, same rubric, every competitor. Consistency is the whole
point: the same evidence must earn the same number for anyone.

### Dimensions (weights guide emphasis, not a blended score)

| # | Dimension | Weight | Question |
|---|---|---|---|
| 1 | Positioning clarity & distinctiveness | 20% | Is the position sharp and ownable, or generic? |
| 2 | Product substance | 18% | Does it do the hard part, or wrap something easy? |
| 3 | Evidence & credibility | 15% | Named users, real numbers, reproducible claims |
| 4 | Documentation & onboarding | 12% | Time from landing page to first working result |
| 5 | Maintenance health | 12% | Release cadence, issue response, bus factor |
| 6 | Verbal distinctiveness | 8% | Ownable voice, or interchangeable landing-page copy? |
| 7 | Packaging & pricing legibility | 8% | Can a buyer tell what they get and what it costs? |
| 8 | Owned POV / content presence | 7% | Writing, talks, frameworks — depth over volume |
| 9 | **Your strategic tension** | flag | **Score BOTH poles, report separately, never average** |

Dimensions 4 and 5 replace the agency-oriented "visual craft" and
"enterprise-readiness" dimensions found elsewhere — for a developer tool,
docs quality and maintenance health are what actually decide adoption.

### Rubric (1-5, dimensions 1-8)

- **1 — Absent / generic.** Indistinguishable from a template. A liability.
- **2 — Below par.** Some intent, inconsistent or unconvincing. Loses a
  side-by-side.
- **3 — Competent / table stakes.** Solid, professional, unremarkable.
- **4 — Strong.** Clearly above peers; a real strength a user would cite.
- **5 — Category-defining.** Best in class, hard to imitate, sets the bar.

### Dimension 9 — the tension plot

Score each pole 1-5 separately and plot everyone on the 2×2. **Who else
occupies your target quadrant is the single most important finding of the
whole exercise.** Averaging the two poles destroys it — the gap between
them *is* the insight.

### Bias controls (the most valuable part of this file)

- **No composite score.** Report dimensions separately. A weighted average
  hides exactly the asymmetry you need to act on.
- **Asserted vs proven.** Downgrade credibility for self-reported claims
  with no corroboration. Tag every evidence item `[asserted]` or `[proven]`.
- **Affinity bias.** You will over-score products whose taste you share and
  under-score rivals' commercial strength. A "boring" tool may be winning.
- **Flashiness bias.** A beautiful landing page and a showcase demo dazzle;
  verify against issues, changelog, and real user reports before scoring
  substance.
- **Survivorship.** The visible, well-marketed projects are not the whole
  market. Directories and dependency graphs surface strong-but-quiet ones.
- **Calibrate across the set, not in isolation.** Before finalizing, re-read
  all scores side by side. A "4" must mean the same thing for everyone.
  Adjust outliers.
- **Self-assessment is a row, not a footnote.** Score your own product on
  the same dimensions, honestly, and put it in the same table.

### Profile card (one per profiled competitor)

```text
## <Name>
- Tier: <Direct | Adjacent | Aspirational | Substitute>
- One-liner: <how they position themselves, in their words>
- Model / size / business model: <...>
- Evidence: <named users, numbers> [asserted|proven]

| Dimension | Score | Justification (1 line) | Source |
|---|---|---|---|

### Tension plot
- <Axis 1>: <1-5> — <why>
- <Axis 2>: <1-5> — <why>
- Quadrant: <high/high | high-1/low-2 | low-1/high-2 | low/low>

### Read for us
- Strength to learn from:
- Weakness to exploit / white-space it exposes:
- Threat to us:
```

---

## Stage 3 — Assemble the report

Order matters: decisions first, methodology last.

1. **Decisions first** — 3-5 takeaways in plain language: where we're
   strong, where we're exposed, who occupies our target quadrant, the top
   2-3 moves. Written so that reading only this is enough to act. **No
   methodology here.**
2. **Landscape map** — the tension 2×2 as the headline artifact, with every
   profiled competitor and us placed on it. The map carries the argument
   faster than prose.
3. **Tiers** — one short paragraph per tier: who's in it, why it matters.
4. **Comparison matrix** — competitors × dimensions, grouped by tier, with
   our own honest row. Use a symbol or color scale so patterns are
   scannable. **No blended total column.** Call out the columns where we
   lead and where we trail.
5. **Deep dives (3-5)** — chosen for instruction, not ranking: the best
   exemplar of the target tension, the "one pole only" cautionary case, the
   "competent but forgettable" archetype, and any direct threat.
6. **White-space & threats** — the strategic heart. White-space must be
   *argued from the map and matrix*, not asserted. Confirm whether the
   target quadrant is genuinely open. Be honest about our own risks
   (a bold identity can read as un-serious to a risk-averse adopter).
7. **Recommendations** — prioritized by impact × effort, each tied back to
   the positioning brief. Flag any recommendation that would shift the
   differentiator away from what we said we were.
8. **Methodology appendix** — dimensions, weights, rubric, the scoped set
   with tiers, source links per competitor, asserted-vs-proven notes. This
   is what makes the report auditable instead of a set of opinions.

### The report must resolve three questions

- **Who do we actually compete with?** Name the Direct tier specifically.
- **How do we compete?** One sentence, grounded in the matrix columns we own.
- **Where is that defensible?** Which dimensions rivals cannot easily copy
  (the moat) versus which are table stakes.

### Closing questions (force decisions, not admiration)

- Is the target quadrant truly open, or is a rival already moving in?
- Which Direct competitor is the sharpest threat in the next 12 months, and
  what is the counter?
- Which dimension where we trail is worth closing — and which do we
  deliberately concede?
- What is the one move that widens distinctiveness *without* costing
  credibility?

---

## Anti-patterns

- **Scoping without a positioning brief.** Produces a list, not intelligence.
- **Leaving out substitutes.** For a dev tool, "a 40-line shell script" and
  "just ask an AI assistant" are usually the real competition.
- **Averaging the tension poles.** Deletes the finding.
- **Scoring without evidence.** A score with no source link is an opinion
  wearing a number.
- **Blending dimensions into a total.** Hides the asymmetry that matters.
- **Running the deep path for a decision that doesn't need it.** Most
  requests are answered by `SKILL.md` Step 1 item 4 in five minutes.
