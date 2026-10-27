# Incident response — production is broken right now

Step 7 of this skill: the release shipped, `post-deploy-watch.md` (or a
user, or an alert) says production is unhealthy, and the job is to restore
service, then learn from it. Dashboards and alert *design* live in
`observability.md`; this file is what to do when one fires.

## The order that matters: mitigate, then diagnose

The most common incident mistake is debugging the root cause while users
are still failing. Restore service first with the cheapest reversible
action, then find out why.

1. **Confirm and size the impact** — which users, which feature, since
   when, how many. One reproduction or one dashboard panel, not a theory.
2. **Ask "what changed?"** — the last deploy, config or feature-flag
   change, dependency/provider status page, traffic spike, certificate or
   quota expiry. Most incidents follow a change within the last hours.
3. **Mitigate** with the smallest reversible step that stops the harm:
   roll back (`release-strategies.md`), switch the flag off, shift traffic,
   scale out, shed a non-critical feature. Prefer an action you can undo
   in one command over a forward fix you have to write.
4. **Verify recovery** with the same signal that showed the breakage, not
   "the deploy went green".
5. **Then diagnose** the root cause, with service restored and no clock.

A forward fix during the incident is justified only when no rollback
exists (a destructive migration already ran, an external API changed under
you). Say so explicitly when choosing it.

## Diagnosis stays read-only until a decision is made

While impact is ongoing, every command the agent runs against production
is read-only: logs, metrics, `kubectl get/describe/logs`, `SELECT`,
`EXPLAIN`, status endpoints. A mitigation (rollback, restart, flag flip,
scale, data fix) is proposed with its blast radius and undo, and runs only
on an explicit yes — `safe-execution-edho-ferdian`'s destructive-command
gate applies with no "it's an emergency" exception. An emergency is when a
wrong command costs most.

## Severity

| Sev | Meaning | Response |
|---|---|---|
| SEV1 | Core flow down, data loss or exposure, payments failing, for many users | All hands now; status update every 30 min |
| SEV2 | Core flow degraded, or down for a segment; a workaround exists | Work it now; update every 60 min |
| SEV3 | Non-core feature broken, or a small cohort affected | Fix in working hours; ticket |

Set the severity from user impact, never from how hard the bug looks. Any
suspected data exposure is SEV1 and also goes to
`security-review-edho-ferdian`, to size the exposure and name what must be
rotated.

## Roles, even for a team of one

- **Incident commander** — decides; does not type fixes. On a solo team
  this is still a hat: stop every 30 minutes and decide again whether to
  roll back.
- **Operator** — runs the read-only diagnosis and the approved mitigation.
- **Communicator** — updates the status page and the people affected.
- **Scribe** — keeps the timeline (below). An agent is a good scribe.

## Timeline, written as it happens

Keep it in one place from the first minute; the postmortem is built from
it, and memory after the fact is wrong about order and timing.

```
14:02  Alert: checkout 5xx 18% (normal <0.5%)
14:05  Impact confirmed: card payments fail, PayPal fine. Deploy v2.31 at 13:48.
14:09  Decision: roll back to v2.30 (undo: redeploy v2.31)
14:14  Rollback done. 5xx back to 0.3% at 14:17. Monitoring 30 min.
14:47  Resolved. Root cause investigation opened.
```

## Communication

Updates say: what is affected, what is being done, and when the next
update comes, even if nothing changed. Never a cause you have not
confirmed, never an ETA you cannot keep. Any update an outside party will
read (customers, partners) is a draft for the operator's approval under
`counterparty-comms-edho-ferdian`; billing fallout (double charges, failed
renewals) goes to `billing-ops-edho-ferdian`.

## Closing the incident

Resolved when the user-facing signal has stayed normal for an agreed
window (30 min for SEV1/2 is a sane default), not when the fix merged.
Then, within days rather than weeks, a postmortem.

## Postmortem (blameless)

```markdown
# Postmortem — <title> (<date>, SEV<n>)

## Impact
Who was affected, how badly, for how long (start → detect → mitigate → resolve).

## Timeline
From the incident log, with times.

## Root cause and trigger
The trigger (what changed) and the conditions that let it cause harm.

## What went well / what went badly / where we got lucky

## Action items
| Action | Type (prevent / detect / mitigate) | Owner | Due |
```

Rules: describe systems and decisions, never people's mistakes; ask why a
safeguard did not catch it before asking who caused it; every action item
has one owner and a date, or it is a wish. Look especially for **detect**
items: how could this have paged sooner? A bug that reached production
deserves a regression test (`test-authoring-edho-ferdian`) as one of them.

## Alerting that leads to incidents worth having

Page on user-facing symptoms (error rate, latency, failed checkouts), not
causes (CPU, one pod restarting): causes go to dashboards and tickets. Each
page links to the runbook or dashboard panel that answers its first
question.

For an SLO, alert on error-budget **burn rate** over two windows, so a
short spike that already ended does not page. The Google SRE Workbook's
starting point for a 99.9% SLO (sre.google/workbook/alerting-on-slos,
Table 5-8, checked 2026-10-27):

| Budget consumed | Long window | Short window | Burn rate | Notify |
|---|---|---|---|---|
| 2% | 1 h | 5 min | 14.4 | Page |
| 5% | 6 h | 30 min | 6 | Page |
| 10% | 3 days | 6 h | 1 | Ticket |

Both windows must exceed the burn rate for the alert to fire. Tune from
there with real incident history; an alert that pages and needs no action
gets fixed or deleted, not tolerated.
