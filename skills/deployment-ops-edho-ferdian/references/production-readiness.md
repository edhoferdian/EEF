# Production readiness — ship / block verdict

Adapted from ECC `production-audit`, fetched 2026-09-04.

Answers exactly one question: **should this ship?** It does not re-run the
other skills' analyses — it consumes them and converts them into a decision.

## Evidence first, local first

Never upload the repository to a third-party audit service and never run
`npx <package>@latest` as the audit path. Build the verdict from:

git status --short --branch
git log --oneline --decorate -20
git diff --stat origin/main...HEAD

then the project's own surface: CI workflows, deploy manifests, API routes,
webhook handlers, migrations, env-var documentation, health checks, rollback
notes, and E2E coverage of the launch-critical path.

## Score bands

| Band | Score | Meaning |
|---|---|---|
| Blocked | 0–49 | Do not ship |
| Risky | 50–69 | Ship only behind a small rollout or internal beta |
| Launchable with caveats | 70–84 | Ship if the owner accepts the listed risks |
| Strong | 85–100 | No launch blocker visible from available evidence |

**Hard caps — these override the band:**

- Cap at 69 if any of: auth/authz missing on sensitive data; payment or
  fulfilment webhooks not idempotent; a migration that cannot be run safely;
  secrets in client bundles, logs, or committed files; **no rollback path for
  a high-impact release**.
- Cap at 84 if CI is not green, or the launch-critical path was never tested
  end to end.
- Verify SPF/DKIM/DMARC on the sender domain **before** launching anything
  that sends email — skipping this produces silent delivery failure or spam
  placement, not a visible error (adapted from ECC `mailtrap-email-integration`,
  fetched 2026-09-06).

A score is a prioritisation device, not a measurement. Always name the
evidence checked *and the evidence missing* — the second list is what would
change the number.

## Delegation, not duplication

| Risk lens | Delegate detail to |
|---|---|
| Auth, secrets, injection, rate limiting | `security-review-edho-ferdian` |
| Migration reversibility, tenancy, idempotent writes | `data-layer-patterns-edho-ferdian` |
| Launch-critical path coverage | `e2e-testing-edho-ferdian` |
| Latency / budget breaches | `performance-audit-edho-ferdian` |

This file owns only the aggregation, the caps, and the one-sentence verdict.

## Output

Lead with one sentence, e.g.:

> Production audit: 68/100, risky — Stripe webhooks are verified but not
> idempotent, and the pending migration has no rollback note.

Then: `Blockers` / `High-value fixes` / `Evidence checked` / `Evidence
missing` / `Next action`. Keep strengths short; the question was about
remaining risk.
