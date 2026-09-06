# Regression Testing — Writing the Test a Bug Earned

Adapted from ECC `ai-regression-testing`, fetched 2026-09-04. The source is
written around one stack (Next.js + Vitest + Supabase); the generalizable
core is below, with the stack-specific parts kept only as illustration.

Companion to the 8-category edge-case checklist in
`dev-kickoff-edho-ferdian/references/test-design-checklist.md` — that checklist
decides which cases a *new* feature needs; this file covers the case a *bug*
just proved you needed.

## Core principle: test where bugs were found, not where code looks risky

Coverage percentage is the wrong target for regression work. The right target
is: every bug that was actually found gets a test that makes its exact
recurrence impossible.

```
Bug found in /api/user/profile     → write a test for the profile endpoint
Bug found in /api/user/messages    → write a test for the messages endpoint
No bug ever in /api/notifications  → do not write a test yet
```

This works because defects cluster: the same category of mistake repeats in
the same complex areas (auth, multi-path logic, state management). The suite
grows with real evidence instead of speculation, and stays fast.

## The AI blind-spot problem

When the same model writes a change and then reviews it, it carries the same
assumption into both steps:

```
model writes fix → model reviews fix → "looks correct" → bug is still there
```

An observed real sequence: a response field was added to the API shape but not
to the SELECT clause; review missed it. The SELECT was fixed but the type
generation broke; review missed it. The query was widened but only on the
production branch, not the sandbox branch; review missed it a third time. A
single test caught it on the first run.

Practical rule: **self-review is not evidence.** For any bug fixed in a session
where the same agent wrote the fix, an automated assertion — not a second
reading — is what closes it.

## The four recurring regression patterns

### P1 — Dual-path shape drift (most common)

A codebase with two branches for the same response — sandbox/mock vs.
production, feature-flagged vs. default, cached vs. fresh — gets a field added
to one branch only.

```ts
// WRONG — new field only on one branch
if (isSandboxMode()) return { data: { id, email, name } };
return { data: { id, email, name, notificationSettings } };

// RIGHT — both branches return the same shape
if (isSandboxMode()) return { data: { id, email, name, notificationSettings: null } };
return { data: { id, email, name, notificationSettings } };
```

Test: assert the *contract* (the full required-field list) rather than a single
field, and run it against every branch the code can take.

```ts
const REQUIRED_FIELDS = ["id", "email", "fullName", "role", "notificationSettings"];

it("returns every required field", async () => {
  const { status, json } = await callEndpoint("/api/user/profile");
  expect(status).toBe(200);
  for (const field of REQUIRED_FIELDS) expect(json.data).toHaveProperty(field);
});
```

### P2 — Projection omission

A new column reaches the response object but never reaches the query's
projection (`SELECT`, `select()`, `.select("a, b")`, a GraphQL field set), so
the value is silently `undefined` rather than an error. Test by asserting the
field is *present and correctly typed*, not merely truthy — `toBeDefined()`
passes on `null` in some runners and misses the bug class entirely.

### P3 — Error-state leakage

Error handling is added but stale success data is never cleared, so the UI
shows an error banner over the previous tab's content.

```ts
// WRONG
catch { setError("Failed to load"); }
// RIGHT
catch { setRows([]); setError("Failed to load"); }
```

Test: trigger the failure path, then assert both that the error is shown *and*
that the previous data is gone.

### P4 — Optimistic update without rollback

State is mutated before the request, and the failure path never restores it —
the item disappears from the UI but still exists server-side.

```ts
const prev = [...items];
setItems(items.filter(i => i.id !== id));
try {
  const res = await api.delete(id);
  if (!res.ok) throw new Error("delete failed");
} catch {
  setItems(prev);          // rollback
  showError("Delete failed");
}
```

Test: make the request fail, assert state is restored to the pre-action value.

## Fast regression tests without a database

Where a project has a sandbox/mock mode, force it on in test setup and call the
handler function directly instead of booting a server. The result is a suite
that runs in under a second and needs no fixtures, no container, no seeded DB.

```ts
// test setup file — force the DB-free path
process.env.SANDBOX_MODE = "true";
process.env.DATABASE_URL = "";
```

Then invoke the route/handler as a plain function with a constructed request
object, and assert on the parsed response. If the project has no sandbox mode,
the equivalent is a thin fake at the data-access boundary — not a real DB.

## Naming and bookkeeping

Name a regression test after the defect it prevents, so a future failure
immediately says *which* bug came back:

```ts
it("notificationSettings is never undefined (BUG-R1 regression)", ...)
```

Where the project uses `project-memory/`, reference the task id that fixed the
bug; otherwise reference the issue tracker id. A regression test with no
pointer back to its bug loses half its value the first time someone considers
deleting it.

## DO / DON'T

**DO** write the test before the fix where possible (it is a real RED gate);
assert response shape rather than implementation; make regression tests the
first mechanical step of any bug-check pass, before any human or AI reading;
keep them fast enough that nobody is tempted to skip them.

**DON'T** write regression tests for code that has never failed; trust an AI
self-review in place of an assertion; skip the sandbox/mock branch because
"it's just mock data" (that branch is where P1 lives); or chase a coverage
percentage — the metric here is *bugs that cannot recur*.
