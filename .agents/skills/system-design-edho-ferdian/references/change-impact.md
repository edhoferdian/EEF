# Change impact analysis

A two-pass check for a change whose blast radius is not obvious: map what it
will touch **before** writing it, then hold the finished diff against that
map **after**. The first pass decides whether the change is safe to start;
the second catches the drift between what was planned and what shipped.

## When it is worth running

- A change crosses module boundaries, or alters a public interface (an
  exported function, an API route, a CLI flag, an event payload).
- It touches persisted data: a schema, a migration, a file format, a date or
  unit convention.
- It touches auth, deployment, or anything with no clean undo.
- Someone asks "what breaks if we change X?" or "is this safe to roll back?"

Not for a change confined to one function body with no outside callers —
`safe-execution-edho-ferdian` Gate 1's lighter tier already covers that.

## Pass 1 — the impact map (before)

Every row must come from something you ran or read — a grep, a reference
search, the schema file, the deploy config — and say which. A row you could
not check is written down as `unverified`, never quietly dropped and never
guessed from a directory name.

```markdown
| Area | What is affected | Evidence | Status |
|---|---|---|---|
| Callers | `billing/invoice.ts:42`, `jobs/renew.ts:17` | `rg "chargeCustomer\("` | verified |
| Contracts | `POST /charges` response drops `fee` | openapi.yaml | verified |
| Data | `charges.fee` column becomes nullable | migration 0042 | verified |
| Tests | `invoice.test.ts` asserts `fee` | rg in tests/ | verified |
| Docs / ADRs | ADR-007 says fee is always set | docs/adr/ | verified |
| Deploy | needs migration before app rollout | — | unverified |
| Consumers outside this repo | mobile app reads `fee` | — | unverified |
```

Then close with three lines, all mandatory for a data or contract change:

- **Order of rollout** — which piece ships first (migration, server,
  clients) and why that order is the safe one.
- **Rollback** — the concrete undo for each step, and the point after which
  there is none.
- **Irreversible effects** — data that is dropped, rewritten or emitted to
  someone else, stated plainly. "None" is an answer; silence is not.

An `unverified` row on a contract or on data is a reason to stop and ask,
not to proceed and hope. If the change turns out to need a real
architectural decision (a new pattern, a compatibility window, a versioning
choice), that decision goes through this skill's ADR workflow — the impact
map is evidence for it, not a substitute.

## Pass 2 — reconcile (after)

Once the diff exists, walk the map again against it:

- **Planned and done** — each row the diff actually addresses.
- **Planned, not done** — a caller or doc that still needs the change.
- **Done, not planned** — files the diff touches that the map never named.
  Each one is either a missed row (add it, re-check its consumers) or scope
  creep (take it out).
- **Still unverified** — carried into the PR description by name, so the
  reviewer knows exactly what nobody checked.

The reconciliation goes in the PR description. A reviewer reading it should
learn what the change reaches without re-deriving the map themselves.

## Anti-patterns

- Inferring call relationships from file names or "it is probably only used
  in…" instead of searching for them.
- Letting the impact map grow into a second requirements document. It lists
  what is affected and how you know; the why belongs in the ticket or ADR.
- Declaring a migration or contract change ready with no rollout order, no
  rollback, or no statement about irreversible effects.
