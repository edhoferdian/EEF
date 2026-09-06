# CQ-05 detail — Silent Failures

Adapted from ECC `silent-failure-hunter`, fetched 2026-09-04.

`review-checklist.md`'s CQ-05 is the short pointer to this file. This lens
takes zero tolerance for silent failures: errors that are swallowed, masked,
or lose their propagation path make production incidents harder to diagnose
than the original failure would have been. Apply it to every async operation,
every I/O boundary, and every transactional path in scope.

---

## Mechanical ground-truth greps (run these first)

Before writing a CQ-05 finding, grep the scope for these patterns. A hit
upgrades the finding to **[High confidence]** — you have the exact location
and pattern, not a hunch. Adapt the pattern to the language actually in scope.

| Pattern (regex) | Catches |
|---|---|
| `catch\s*\{\s*\}` / `catch\s*\([^)]*\)\s*\{\s*\}` | Empty catch blocks (JS/TS/Java/C#/...) |
| `\.catch\(\(\)\s*=>` | Promise `.catch()` with an empty/trivial handler |
| `except:\s*$` | Bare `except:` (Python) |
| `except Exception\s*(as\s+\w+)?:\s*pass` | Exception swallowed with `pass` |
| `catch \(\$?\w*\)\s*\{\s*\}` | Empty catch (PHP-style) |
| `\/\/\s*ignore` or `#\s*ignore` near a catch/except | Explicit "ignore" comment — check if justified |
| `catch.*\{\s*return (null|\[\]|\{\})` | Catch that swallows and returns a degenerate default |

If none of these hit and the finding rests on reading the surrounding logic
only, cap it at **[Medium confidence]**.

---

## CQ-05a — Empty or degenerate catch blocks

- `catch {}` or an equivalently empty exception handler.
- Errors converted to `null`, `[]`, `{}`, or `false` with **no logging, no
  context, no re-throw** — the failure vanishes entirely from any observable
  signal.
- Distinguish this from CQ-05b: 05a is "nothing happens", 05b is "something
  happens but it's the wrong something."

## CQ-05b — Masking fallbacks

A handler that produces a plausible-looking result instead of surfacing the
failure, making the downstream bug harder to diagnose than the original
error would have been:

- `.catch(() => [])` / `.catch(() => null)` on a call whose caller can't tell
  "no data" from "call failed".
- A default value substituted silently where the caller has no way to detect
  degraded behavior (e.g. a cache-miss default that looks identical to a
  legitimate empty result).
- Retry logic that gives up and returns success-shaped output.

## CQ-05c — Lost propagation / generic rethrows

- Stack traces discarded when re-throwing (constructing a new error without
  wrapping/chaining the original cause).
- Generic rethrows that strip the specific error type/context the caller
  needs to handle different failure modes differently (e.g. catching a typed
  exception and rethrowing `Error("something went wrong")`).
- Missing `async`/`await` handling that causes an unhandled promise
  rejection instead of a caught, propagated error.

## CQ-05d — Logging quality and severity

- Logs written without enough context to debug from (no request ID, no
  input that triggered it, no stack trace) — a log-and-forget line that
  looks like observability but isn't actionable.
- Wrong severity: a real failure logged at `debug`/`info` (invisible in
  production alerting), or routine/expected conditions logged at
  `error`/`critical` (alert fatigue that trains people to ignore the channel).
- "Log-and-continue" on a path where continuing is actually unsafe.

## CQ-05e — Missing timeout / rollback on I/O and transactional paths

- Network, file, or DB calls with no timeout — a hang becomes an unbounded
  hang instead of a bounded, handleable failure.
- Transactional work (multi-step DB writes, multi-resource operations)
  with no rollback/compensation on partial failure — a failure partway
  through leaves the system in an inconsistent state.
- External API calls in a critical path with no circuit breaker or fallback
  when the pattern already exists elsewhere in the codebase (consistency
  check, not a mandate to introduce a new pattern unprompted).

---

## Reflection-gate question for this lens

Add this question to the Phase 3 reflection pass
(`references/reflection-critique.md`) for every CQ-05 finding:

> "Is this swallow deliberate and documented — a cache-miss fallback,
> best-effort telemetry, a documented optional path? If justified by a
> comment or by the call site's tolerance for a degraded result, downgrade
> to Info rather than treating it as a defect."

This keeps the lens from flagging intentional, documented degradation as if
it were a bug. The distinguishing question is always: **can the caller tell
the difference between "no data" and "the call failed"?** If yes, it's fine
even without a comment. If no, it's a finding regardless of intent — but the
severity should reflect whether the ambiguity was a conscious tradeoff or an
accident.

---

## Severity guidance

- 🔴 **CRITICAL** — silent failure on a money, auth, or destructive-operation
  path (payment, permission check, delete/rollback).
- 🟠 **HIGH** — silent failure that would hide a real production bug with no
  other detection mechanism (no monitoring/alerting compensates for it).
- 🟡 **MEDIUM** — silent failure on a non-critical path, or a masking
  fallback where a determined caller could still detect the failure via a
  side channel (a metric, a secondary log).
- 🔵 **LOW** — logging quality/severity nits (CQ-05d) that don't hide a
  failure entirely, just make it harder to triage quickly.
- ⚪ **INFO** — deliberate, documented degradation caught by the reflection
  gate above.
