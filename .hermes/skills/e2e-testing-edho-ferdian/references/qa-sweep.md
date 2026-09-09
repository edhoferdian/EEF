# QA Sweep — Post-Deploy Verification Mode

A **different mode** from Phases 1–4 of this skill. Journey tests answer "does
this specific flow still work, repeatably, in CI?" A QA sweep answers "is this
deployed build broadly OK, right now?" — broad and shallow, run once against a
live URL, ending in a ship/no-ship verdict rather than a committed test file.

Use it after deploying to staging/preview, before shipping, or when reviewing a
PR that touches frontend code. Do not use it as a substitute for journey tests:
a sweep is a snapshot, not a regression net.

Need repeated observation across a release window instead of one pass? →
`deployment-ops-edho-ferdian/references/post-deploy-watch.md`.

## Blast radius — read before touching anything

A sweep drives real sessions against a real deployment, so state the blast
radius explicitly before the first navigation:

1. **Read-only by default.** Never run a mutating journey — checkout, payment,
   delete, bulk update — against a production URL. Mutating requires an
   explicit user opt-in *and* a staging/preview URL.
2. **Seeded test credentials only.** Never a real user's production login.
3. **Redact before saving.** Credentials, tokens and PII must not survive into
   a screenshot or a log that gets attached to a report.

If any of the three cannot be satisfied, report the limitation and run the
phases that are safe — do not quietly downgrade to "I checked visually".

## Phase A — Smoke

1. Navigate to the target URL.
2. Read console output; filter known third-party noise (analytics, ad SDKs)
   and report the rest.
3. Check network requests for 4xx/5xx.
4. Screenshot above-the-fold at desktop and mobile widths.
5. Capture Core Web Vitals. **Do not restate thresholds here** — use the
   budgets and measurement method in `performance-audit-edho-ferdian`; this
   sweep only reports the numbers and hands a budget breach to that skill.

## Phase B — Interaction

1. Click every navigation link; report dead links and unexpected redirects.
2. Submit each form with valid data → expect the success state.
3. Submit each form with invalid data → expect the *specific* error state, not
   just "it didn't submit". A form that silently does nothing on bad input is a
   finding.
4. Auth: login → protected page → logout, with test credentials only.
5. Critical journeys: read-only unless the blast-radius opt-in above was given.

## Phase C — Visual regression

1. Screenshot key pages at three widths (mobile / tablet / desktop).
2. Compare against committed baseline screenshots.
   **No baseline ⇒ report INCONCLUSIVE, never a silent PASS.** "Looks fine to
   me" is not a visual regression result.
3. Flag layout shift beyond a few pixels, missing elements, and overflow.
4. Check dark mode where the product has one.

## Phase D — Accessibility (runtime)

1. Run axe-core (or equivalent) against each page.
2. Report WCAG 2.2 AA violations.
3. Verify keyboard navigation end to end and check landmark structure.

**Boundary with `code-review-edho-ferdian`:** its accessibility lens reviews
*source* for a11y defects; this phase runs a *live* automated scan. They are
complementary, not duplicates — cross-reference findings, do not restate the
lens's rules here. Automated scanning covers roughly a third of WCAG: a clean
axe run is necessary, not sufficient. Never report "accessible" on the strength
of an automated pass alone; say what was scanned and what was not.

## Verdict format

```markdown
## QA Sweep — <URL> — <timestamp> — <driver>

### Smoke
Console: 0 errors, 2 warnings (analytics)
Network: all 2xx/3xx
Core Web Vitals: LCP 1.2s / CLS 0.02 / INP 89ms  (budgets: performance-audit skill)

### Interaction
[PASS] Nav links 12/12
[FAIL] Contact form — no error state shown for an invalid email
[PASS] Auth login → protected → logout

### Visual
[FAIL] Hero overflows at 375px
[PASS] Dark mode consistent
(or: INCONCLUSIVE — no committed baseline)

### Accessibility (automated only)
2 AA violations: missing alt on hero image; low contrast on footer links
Keyboard pass: OK. Screen-reader pass: not performed.

### VERDICT: SHIP WITH FIXES — 2 issues, 0 blockers
```

Verdict values: `SHIP` / `SHIP WITH FIXES` / `DO NOT SHIP` / `INCONCLUSIVE`.
Use `INCONCLUSIVE` when a phase could not run at all (no baseline, no driver,
blast-radius restriction) — an unrun phase is never a pass.

## Handoff

Anything found here that is a repeatable user-flow defect should become a
mapped journey (Phase 1) and a committed test — a sweep finding that stays in a
report will be re-found by hand next release.
