# Observability — dashboards and logs an operator can act on

Adapted from ECC `dashboard-builder` (Grafana / SigNoz and similar), with
structured-logging rules harvested from ECC `backend-patterns`, fetched
2026-09-04.

## Start from operator questions, never from the metric list

A dashboard exists to answer four questions:

1. Is it healthy?
2. Where is the bottleneck?
3. What changed?
4. What should someone do about it?

A panel that answers none of them is a vanity panel — delete it. Every panel
needs a title, a unit, and a threshold that means something.

## Section order

1. Overview (health / availability)
2. Performance (latency percentiles — p50 / p95 / p99, never the mean alone)
3. Resources (saturation)
4. Service-specific risk

## Starter panel sets

- **API / ingress** — request rate, p50/p95/p99, error rate, upstream health,
  active connections.
- **Kafka** — broker count, under-replicated partitions, messages in/out,
  consumer lag, disk and network pressure.
- **Elasticsearch** — cluster health, shard allocation, search latency,
  indexing rate, JVM heap and GC.

Before building: read the platform's existing dashboards for JSON structure,
query language, variables, and threshold styling. A dashboard that does not
look native to its platform will not be maintained.

## Notification severity classes

Adapted from ECC `unified-notifications-ops`, fetched 2026-09-06. One event
must not fan out to every channel — collapse duplicates before adding
channels, and default to digest-first when interruption cost is unclear.

| Class | Examples | Default handling |
|---|---|---|
| Critical | broken default-branch CI, security issue, failed deploy | interrupt now |
| High | failing PR, owner-blocking handoff | same-day alert |
| Medium | issue state changes, backlog movement | digest or queue |
| Low | repeat successes, routine churn | suppress or fold |

## Structured logging (authoring side)

- One structured event per request with a correlation id that survives every
  hop; free-text logs cannot be aggregated.
- Log the decision, not the data: never secrets, tokens, full request bodies,
  or personal data. → `security-review-edho-ferdian` owns the redaction rules.
- Log levels must mean something: `error` = someone must act; `warn` =
  degraded but self-healing; `info` = state transitions only.

**Boundary:** what to emit from application code lives in
`backend-engineering-edho-ferdian`; what to put on a board and how to threshold
it lives here.
