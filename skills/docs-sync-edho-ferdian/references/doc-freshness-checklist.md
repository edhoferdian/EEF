# Doc Freshness Checklist

## Four non-overlapping document roles

Adapted from ECC `living-docs-governance`, fetched 2026-09-04.

A documentation set stays healthy when every document has exactly one job.
This ecosystem's own `project-memory/` already maps onto four
non-overlapping roles without anyone having named them explicitly:

| Role | Job | This ecosystem's instance |
|---|---|---|
| **Constitution** | The rules that bind — rarely changes, changes deliberately | `CLAUDE.md` |
| **Map** | What exists and what doesn't yet | `02-gap-analysis.md` |
| **Status** | Where things stand right now | `03-progress.md` |
| **History** | Why things are the way they are | `01-decision-register.md` |

The filename does not matter; the role does. A repo with different
filenames but the same four roles is equally healthy — the failure mode
this checklist watches for is one document quietly absorbing a second
role (a status file that starts also explaining historical rationale, a
constitution that starts tracking day-to-day state), which is how
docs silently drift out of sync with each other.

**Update cadence per role** — each role has its own rhythm; forcing one
cadence onto all four is what causes staleness:

- **Constitution** — updated rarely, and only deliberately (a real
  decision changed, not a routine task).
- **Map** — updated when the inventory of what exists changes (a new
  skill ported, a new gap discovered).
- **Status** — updated every task or session, per the Stage 6 REMEMBER
  discipline already in `execution-loop.md`.
- **History** — append-only. Never rewritten, only added to; a superseded
  decision gets a note pointing to what replaced it (see D-002 in
  `01-decision-register.md` for a live example of this pattern), not a
  deletion.

## Deletion zones — recording what was deliberately removed

When content is intentionally removed from a doc set (a deprecated
section, a skill that was retired, a decision that was reversed), record
*that a decision to remove it was made* — not just delete it silently.
Otherwise a future session (human or agent) re-derives the same content
from scratch, not knowing it was already considered and rejected. A short
note in the History-role document ("removed X on <date> — see D-0NN") is
enough; this checklist does not require a dedicated deletion log separate
from the decision register this ecosystem already keeps.
