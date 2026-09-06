# False-Positive Catalogue

Adapted from ECC `code-reviewer`, fetched 2026-09-04.

Patterns that LLM code reviewers commonly mis-flag. This skill's Pre-Report
Gate (`references/reflection-critique.md`) and Phase 3 false-positive gate
both cross-check candidate findings against this list before drafting or
keeping them. Skip a match here **unless you have concrete evidence specific
to this codebase** that overrides the general pattern — the list is a strong
prior, not an absolute rule.

The test to apply when tempted to flag one of these anyway: **"Would a senior
engineer on this team actually change this in review?"** If no, skip it.

---

1. **"Consider adding error handling"** on a call whose error path is already
   handled by the caller or by framework middleware — Express error
   middleware, a React error boundary, a top-level `try/catch` one frame up,
   or a Promise chain with an upstream `.catch`. Trace the call chain before
   flagging; don't assume isolation.

2. **"Missing input validation"** on an internal function whose callers
   already validate. Trace at least one caller before flagging — internal
   helpers are allowed to trust validated input from their callers.

3. **"Magic number"** for well-known constants: `200`, `404`, `1000` (ms),
   `60`, `24`, `1024`, array index `0` or `-1`, HTTP status codes, and
   single-use local constants whose meaning is obvious from the variable
   name assigning them.

4. **"Function too long"** on exhaustive `switch` statements, configuration
   objects, test-data tables, or generated code. Line count is not the same
   thing as complexity — a 200-line switch with one line per case is simpler
   than a 40-line function with five branches.

5. **"N+1 query"** on a fixed-cardinality loop (e.g. iterating a four-element
   enum) or on a path already using `DataLoader` or explicit batching. Check
   the actual cardinality and whether batching already exists before
   flagging.

6. **"Missing await"** on a deliberately fire-and-forget call — logging,
   metrics emission, or a background queue push. Check for a `void` prefix or
   an explanatory comment before flagging; intentional fire-and-forget is a
   real, common pattern, not an oversight.

7. **"Should use TypeScript" / "Should have types"** in a JavaScript-only
   repo. Match the project's existing language choice; suggesting a stack
   change is out of scope for a code review.

8. **`Math.random()` flagged as a crypto/security issue** in a
   non-cryptographic context — animation timing, jitter, sampling, UI
   randomization. `Math.random()` is only a real finding when used for
   something that needs cryptographic unpredictability (tokens, secrets,
   session IDs).

9. **"Hardcoded value"** in test fixtures, example code, or documentation
   snippets. Tests are supposed to have hardcoded expected values — that's
   what makes them assertions.

10. **"Prefer `const` over `let`"** when the variable actually is reassigned
    later in the function. Read the whole function body before flagging —
    don't stop at the declaration line.

11. **"Possible null dereference"** when a preceding `if` guard or type-narrowing
    check is already in scope. Trace the actual type-flow instead of
    pattern-matching on the presence or absence of `?.`.

12. **"Missing JSDoc / docstring"** on a single-purpose internal helper whose
    name and signature are already self-describing. Documentation is for
    public APIs and non-obvious behavior, not every function that exists.

---

## Applying this list

- A match on this list does not mean "never flag it" — it means the default
  prior is "not a real issue," and you need codebase-specific evidence to
  override that prior (e.g. the project's own conventions explicitly forbid
  the pattern, or this specific instance genuinely lacks the mitigating
  context the general pattern assumes).
- When you do override a listed pattern, say so explicitly in the finding:
  "This looks like [pattern N] but differs because [specific evidence]" — so
  the maintainer can see you considered the common false-positive reading and
  ruled it out deliberately, rather than missing it.
