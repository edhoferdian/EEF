# Release strategies, health checks, and rollback

Adapted from ECC `deployment-patterns`, fetched 2026-09-04.

## Choosing a strategy

| Strategy | Use when | Cost | Rollback speed |
|---|---|---|---|
| Rolling (default) | Stateless app, backward-compatible schema | Low | Minutes (roll forward previous image) |
| Blue-green | Zero-downtime required, you can afford 2x capacity | High | Seconds (flip the router back) |
| Canary | Change is risky and its failure mode is measurable | Medium | Seconds, if the metric gate is real |

**A canary without a metric gate is just a slow rolling deploy.** Before
choosing canary, name the metric, the threshold, and the automatic action on
breach. If you cannot name all three, pick rolling and watch manually
(`post-deploy-watch.md`).

## Health checks — the endpoint contract

A health endpoint that returns `200 OK` unconditionally is worse than none: it
converts a real outage into a silent one.

- **Liveness** — "is this process wedged?" No dependency checks. If liveness
  calls the database, one slow query restarts every pod at once.
- **Readiness** — "can this instance serve traffic right now?" *This* is where
  dependency reachability belongs (DB, cache, upstream API).
- **Startup** — "has this finished booting?" Use it for slow starters instead
  of inflating `initialDelaySeconds` on liveness.

Report each dependency's status individually; a single boolean tells the
operator nothing about where to look.

## Environment configuration

- All config via environment variables; none in code, none in the image.
- **Validate required variables at startup and fail fast.** A service that
  boots with `DATABASE_URL` undefined and dies on the first request has moved
  a deploy-time error into a user-facing one.
- Config validation failure must be a non-zero exit, not a warning log.

## Rollback checklist — written before the deploy, not after

- [ ] Previous image tag / deployment id recorded and reachable
- [ ] The migration in this release is reversible, *or* is expand-only and
      the old code still runs against the new schema
- [ ] Rollback command written out verbatim (not "redeploy the old one")
- [ ] Someone is named as the owner for the watch window
- [ ] Feature flag exists for the risky change, if one is feasible

Migration note, cross-referenced to `data-layer-patterns-edho-ferdian/
references/migrations.md`: an irreversible migration turns instant rollback
into a restore-from-backup incident. Ship schema and code in separate
releases (expand → deploy → contract) whenever the change is destructive.
