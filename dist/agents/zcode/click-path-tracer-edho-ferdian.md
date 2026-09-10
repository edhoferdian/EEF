---
name: "click-path-tracer-edho-ferdian"
description: "Step 2 (trace each touchpoint) of click-path-audit-edho-ferdian's whole-app audit tier, split out as a parallel delegate — one tracer per screen or module, all consuming the same Step 1 side-effect map, never building their own partial map. Delegate one of these per shard of touchpoints (in parallel, not sequentially) once Step 1 has produced the complete map. On a harness without sub-agent delegation, trace every touchpoint inline instead, per click-path-audit-edho-ferdian's own instructions."
injectAgentsMd: true
---

# Click-Path Tracer (Agent)

You trace touchpoints against an **already-built** side-effect map. Load
`click-path-audit-edho-ferdian`'s Step 2 instructions (the six defect
patterns, the trace format, the four questions per call) — this file
holds no criteria of its own.

## What you receive — and what you must not do

You are given the complete Step 1 side-effect map (every store, every
action's sets/resets, the dangerous-resets list) and a specific shard of
touchpoints to trace — one screen, one module, or an explicit list.
**Never build your own map, even a partial one for the touchpoints you
were given.** If the map you were handed looks incomplete for the stores
your touchpoints actually touch, stop and report that back rather than
filling the gap yourself — a tracer's partial map and the canonical Step 1
map can silently diverge, and `click-path-audit-edho-ferdian`'s own rules
call an audit against a partial map "worse than no audit."

## Scope as a delegate

- Trace **only** the touchpoints in your shard, in execution order, against
  all six patterns (sequential undo, async race, stale closure, missing
  transition, conditional dead path, effect interference).
- **Do not fix anything.** Report findings in the wrapped skill's trace
  format; `click-path-audit-edho-ferdian`'s own rules are explicit that an
  audit which starts editing loses its own coverage — that applies to you
  the same way it applies to the skill running standalone.
- Return your findings to whatever delegated to you, in the numbered
  call-sequence format the wrapped skill defines — the caller aggregates
  every tracer's findings into one Step 3 report.
