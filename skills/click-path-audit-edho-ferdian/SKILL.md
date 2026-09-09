---
name: click-path-audit-edho-ferdian
description: >-
  Trace every user-facing touchpoint (button, toggle, form submit) through its
  full state-change sequence to find defects that reading code line by line
  cannot see: handlers whose calls silently undo each other, async races,
  stale closures, and effects that reset the very state the button just set.
  Use when a control "does nothing" despite the handler existing and not
  crashing, after refactoring a shared state store (Zustand/Redux/context/
  signals), or before release on critical flows. Trigger phrases: "tombolnya
  gak jalan", "diklik tapi gak ada yang terjadi", "the button does nothing",
  "state-nya balik lagi", "sudah dicek semua tapi gak ketemu bug-nya".
---

# Click-Path Audit — Edho Ferdian Mode

Ordinary debugging asks: does the handler exist, does it crash, are the types
right. All three can be YES while the button is still broken. This skill asks
the question those three miss:

> **Does the final state match what the control's label promises?**

## The defect class

A "New Email" button called `setComposeMode(true)` and then
`selectThread(null)`. Both functions existed, neither threw, types were
correct — and `selectThread` reset `composeMode: false` as an undeclared side
effect. The button did nothing. A systematic debugging pass that found 54 other
defects missed this one, because nothing about it is visible from either
function in isolation. It only appears when you look at the *sequence*.

## Scope first

This audit is expensive; scope it before starting:

| Scope | When |
|-------|------|
| One control | A user reported one specific broken button |
| One screen | A new page was just built, or one screen misbehaves |
| One store | A shared store action was modified — audit every caller of the changed actions |
| Whole app | Pre-release, or after a refactor that touched shared state broadly |

For a whole-app audit, Step 1 must complete before any Step 2 work begins —
its output is the input for everything else. If work is parallelized across
agents, one agent produces the store map and the rest consume it; never let
each agent build its own partial map.

## Step 1 — Build the side-effect map (mandatory, always first)

For every state store in scope (Zustand store, Redux slice, React context
reducer, signal container, view model), record for each action:

- which fields it **sets**
- which fields it **resets** as a side effect — fields it does not conceptually
  own

```
STORE: emailStore
  setComposeMode(bool)  → sets {composeMode}
  selectThread(t|null)  → sets {selectedThread, selectedThreadId, messages, drafts}
                          RESETS {composeMode: false, composeData: null, redraftOpen: false}
  setDraftGenerating(b) → sets {draftGenerating}

DANGEROUS RESETS (an action clearing state it does not own):
  selectThread → resets composeMode (owned by setComposeMode)
  reset        → resets everything
```

The DANGEROUS RESETS list is the whole point of this step. Every defect this
skill exists to catch lives there. Do not proceed to Step 2 with an incomplete
map — an audit against a partial map produces false confidence, which is worse
than no audit.

## Step 2 — Trace each touchpoint

For every interactive element in scope (`onClick`, `onSubmit`, `onChange`,
keyboard handler, gesture handler):

```
TOUCHPOINT: "New Email" — ThreadList.tsx:88
  HANDLER: onClick
    1. setComposeMode(true)   → sets {composeMode: true}
    2. selectThread(null)     → RESETS {composeMode: false}   ← CONFLICT
  EXPECTED (from the label): a blank compose form opens
  ACTUAL: composeMode is false; nothing renders
  VERDICT: BUG — Sequential Undo
```

Check every trace against these six patterns:

1. **Sequential undo** — a later call resets what an earlier call set. The
   canonical case above.
2. **Async race** — two async calls both write the same field; the final value
   depends on resolution order, not on intent.
3. **Stale closure** — a memoized handler captures an old value, so two
   increments apply the same stale base and the effect happens once, not twice.
4. **Missing transition** — the handler validates, logs, or sets a flag but
   never performs the action the label promises (no API call, no navigation,
   no persistence).
5. **Conditional dead path** — the real work sits behind a condition that is
   always false at that point in the lifecycle.
6. **Effect interference** — the handler sets a field and a watcher/effect
   observing that field immediately resets it.

For each call in a trace, answer four questions: what does it read, what does
it write, does it touch shared state, and does it reset anything as a side
effect.

## Step 3 — Report

```
CLICK-PATH-001 [HIGH]
  Touchpoint: "New Email" — src/components/ThreadList.tsx:88
  Pattern:    Sequential Undo
  Trace:
    1. setComposeMode(true) → sets {composeMode: true}
    2. selectThread(null)   → RESETS {composeMode: false}
  Expected: blank compose form opens
  Actual:   nothing renders; composeMode is false by the end of the handler
  Fix:      reorder (selectThread first, then setComposeMode), or remove the
            undeclared composeMode reset from selectThread and clear it at the
            call sites that actually mean to
```

Severity: **CRITICAL** — a money, auth, or destructive control that silently
does nothing (the user believes the action happened). **HIGH** — a primary
control that does nothing. **MEDIUM** — a control whose final state is partly
wrong. **LOW** — a redundant call with no user-visible effect (dead code, not a
defect).

## Boundaries — what this is not for

- API-level defects (wrong response shape, missing endpoint) — a click-path
  trace ends at the request; take those to normal debugging, and to
  `test-authoring-edho-ferdian/references/regression-testing.md` for the test.
- Styling and layout — visual inspection, or a QA sweep
  (`e2e-testing-edho-ferdian/references/qa-sweep.md`).
- Performance — `performance-audit-edho-ferdian`.

## Handoff — every finding earns a test

A click-path finding is a proven defect with a known reproduction, which makes
it the ideal RED gate. Hand each one to `dev-kickoff-edho-ferdian`'s normal
PLAN → TEST → IMPLEMENT loop: the failing test asserts the *final* state after
the handler runs, not that each individual function was called. A test that
asserts `setComposeMode` was called would have passed against the original bug.

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract)

Communication to the user in Bahasa Indonesia; the trace report and call
sequence in English, since it gets pasted into an issue or handed to
`dev-kickoff-edho-ferdian`'s TEST/IMPLEMENT loop. Full contract:
`skill-authoring-edho-ferdian` §7.

## Global rules

1. **Store map before traces, always.** No exceptions; a partial map hides the
   exact defect this skill targets.
2. **Trace in execution order.** The order is the evidence.
3. **Judge against the label, not against the code.** The label is the
   contract with the user.
4. **A finding is a trace, not an opinion.** Every report shows the numbered
   call sequence with the conflicting write marked.
5. **Do not fix inside the audit.** Report, then hand off — an audit that
   starts editing loses its own coverage.

## Growth path

This skill is intentionally single-file. If the defect-pattern list (Step 2)
grows past six patterns, or this file passes ~250-300 lines, split framework-
specific tracing detail (e.g. a Zustand/Redux-specific vs. a signals-specific
lens) into `references/`, following the domain+lens pattern other skills in
this ecosystem use — do not let a single growing file replace that split.
