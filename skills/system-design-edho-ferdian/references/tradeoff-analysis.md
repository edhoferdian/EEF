# Trade-off analysis format

Adapted from ECC `architect`, fetched 2026-09-04.

## Format

For every option under real consideration:

```markdown
### Option: <name>

**Pros**
- <concrete benefit — tie it to a requirement from Step 2, not a vibe>

**Cons**
- <concrete drawback — cost, complexity, risk, a constraint it fails>

**Alternatives it competes with**
- <the other options in this same analysis, one line each>

**Decision**
- Chosen | Rejected — <one-line reason either way>
```

Run this for every option, then close with one paragraph stating the final
decision and which non-functional target drove it. That closing paragraph
is what becomes the ADR's "Decision" line.

## How many options is "enough"

- **Minimum two** — a trade-off analysis with one option is just a
  justification, not an analysis.
- **Typical: two to four.** Below two: the alternative wasn't really
  considered. Above four: the options probably weren't filtered before
  writing this — do a quick elimination pass first (cost floor, hard
  constraint, team familiarity) and only write up the survivors in full.
- If there is genuinely only one viable option (a hard platform constraint,
  a vendor lock-in already committed elsewhere), say so explicitly and name
  the constraint — don't manufacture a strawman alternative just to fill the
  section. A strawman alternative is worse than an honest "one option" note,
  because it fakes rigor that wasn't there.

## Anti-patterns to catch in your own draft

- **The strawman alternative** — an option nobody would seriously pick,
  included only to make the chosen option look better by comparison. If an
  alternative's Cons list reads like a caricature, replace it with the real
  competing option or drop it.
- **Missing Cons on the chosen option.** Every real decision costs
  something. A chosen option with an empty or token Cons list means the
  trade-off wasn't actually examined — go back and find the real cost.
- **Vague criteria.** "Better performance" is not a Pro; "cuts p99 latency
  from 300ms to 80ms in the target query shape" is. Tie every bullet to
  something measurable or at least falsifiable.
- **Deciding on team familiarity alone without saying so.** Familiarity is a
  legitimate factor (it lowers delivery risk), but if it's the deciding
  factor, name it as such rather than dressing it up as a technical
  superiority claim the option doesn't actually have.

## Escalation

If a trade-off surfaces a finding that needs *measurement*, not just
reasoning (e.g. "which of these is actually faster under our load") —
that's `performance-audit-edho-ferdian`'s job, not this skill's. Name the
need, don't fabricate a benchmark number to fill the table.
