# Salak cross-check (optional, auto-detected) — the key differentiator

Replicates `dev-kickoff-edho-ferdian/references/salak-integration.md`'s
detect-defer-never-require pattern **exactly**, applied here to dead-code
candidates instead of kickoff/review tasks. Read that file if you need the
full exit-code contract and provenance details — this file only states the
parts specific to a cleanup run; it does not restate the whole contract.

## Why this exists

Static heuristic tools (knip, depcheck, ts-prune, vulture, deadcode, ...)
walk the AST they can see and nothing else. Two known failure modes:

1. **False negatives on dynamic usage** — a symbol referenced via
   `import(computedPath)`, a string-keyed route table, or a DI container
   resolving by name looks "unused" to a static walker even though it has a
   real, live caller.
2. **Over-reporting** — a tool's model of the dependency graph can miss a
   re-export chain, a barrel file, or a build-time alias, flagging something
   "unused" that a broader graph (built the same way, once, across the whole
   repo) would show has an inbound edge.

Salak's `repo-graph.json` is built once for the whole repo with a declared
provenance per edge (`extracted` > `inferred` > `ambiguous`) and is exactly
the kind of ground truth that resolves both failure modes — **when it's
installed.** When it isn't, this file is a no-op and Phase 1's classification
stands unchanged.

## Step 1 — Detect (silent, once per cleanup run)

Run `salak version` (or `command -v salak`). Not found / non-zero → Salak is
absent. Say nothing about it, proceed with Phase 1's classification as-is.
This is not a blocker and not a gap to report to the user.

## Step 2 — Freshness

Before trusting any graph-derived claim, run `salak check [PATH]`:

- **Exit 0** — fresh. Trust the graph.
- **Exit 2** — stale. Refresh with `salak scan` before relying on it for this
  cleanup pass — a stale graph could show a since-deleted caller as still
  present, or miss a caller added since the last scan, either of which is
  exactly wrong for a deletion decision.
- **Exit 1** — internal error (no graph yet, or it's invalid). Don't refresh;
  run `salak scan` once if no graph exists at all, otherwise fall back to
  Phase 1's static-tool classification unchanged for this run and say so.

If the tree has a permanently-unparseable fixture file, `check` will report
stale forever for that reason alone (see the Gotcha in
`salak-integration.md`) — read which paths are named; if they're unrelated to
the candidates being cross-checked, the graph is still trustworthy for this
purpose and re-scanning in a loop is not the fix.

## Step 3 — Cross-check every candidate before deletion

For each SAFE or CAREFUL candidate from Phase 1 (both directions matter —
SAFE items get demoted, CAREFUL items can occasionally be confirmed truly
orphaned):

1. Look up the candidate symbol/file's node in `repo-graph.json`.
2. Read its **inbound edges** (`depends_on` / `imports`, whichever the
   language adapter emits — check `adapters[].emits` for that language
   before assuming an edge kind is tracked at all; an edge kind absent from
   `emits` proves nothing about "no callers", it means Salak never tracked
   that kind for this language).
3. Apply the downgrade rule:
   - **Zero inbound edges, and the edge kind is tracked for this language**
     → candidate stays at its Phase-1 classification (SAFE stays SAFE).
   - **One or more inbound edges, provenance `extracted`** → this is a
     **confirmed false positive** from the static tool. Downgrade SAFE →
     CAREFUL at minimum, or skip the deletion outright if the caller is
     clearly live (not itself dead code in the same cleanup batch).
   - **Inbound edge present but provenance `inferred` or `ambiguous`** →
     downgrade to CAREFUL regardless of the edge count. An `ambiguous` edge
     is a lead to double-check by reading the actual call site, not a
     citation to act on.
4. Record the before/after classification for the Phase 4 report — this is
   the evidence that the cross-check did real work on this run, not just a
   theoretical safeguard.

## Step 4 — After deletion (optional but recommended when Salak is present)

Run `salak diff <old-graph.json> <new-graph.json>` comparing the graph from
before this cleanup pass to a fresh scan after it, to see the actual
structural change (nodes/edges removed) instead of trusting the removal
self-report. Exit 0 = identical (nothing actually changed structurally —
worth double-checking why, if deletions were supposed to happen), exit 1 =
real reported differences (expected outcome), exit 2 = load error (one of
the graphs is invalid — not a signal either way).

## Never

- Never require Salak as a precondition for running this skill.
- Never pass `--force` past the 20%-node-drop overwrite guard (`scan` exit
  3) automatically — a cleanup pass legitimately shrinks the graph, but the
  guard existing to catch a mistaken over-broad scan/delete is exactly the
  kind of thing this skill should respect, not route around. Stop and ask.
- Never treat an `ambiguous`-provenance edge as settled fact in either
  direction.
