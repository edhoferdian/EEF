# React / Testing Library — Authoring Guide

This is stack-specific detail for `test-authoring-edho-ferdian`'s SKILL.md.
Read the SKILL.md first for the three-way boundary against
`code-review-edho-ferdian`'s test-quality-lens, `dev-kickoff-edho-ferdian`'s
test-design-checklist, and `e2e-testing-edho-ferdian` — this file assumes
that boundary and only covers React-specific authoring mechanics.

---

## Query priority

React Testing Library exposes queries in a deliberate priority order. Use
the highest-priority query that works for the element — don't reach for a
lower tier out of habit.

1. `getByRole` — matches how assistive tech and most users' mental model of
   the page work. Prefer this first, almost always.
2. `getByLabelText` — for form inputs, matches how a user finds a field via
   its label.
3. `getByPlaceholderText`
4. `getByText`
5. `getByDisplayValue` — for form elements with an existing value.
6. `getByAltText` — for images.
7. `getByTitle`
8. `getByTestId` — last resort only. It doesn't correspond to anything a
   real user perceives; reach for it only when nothing above can uniquely
   identify the element.

**Why this order matters**: a test built on `getByRole`/`getByLabelText`
resembles how a real user (and assistive tech) actually finds and interacts
with the UI. That resemblance is what makes the test resilient to
refactors — if you restructure the component's internal markup without
changing its accessible behavior, the test keeps passing. A test built on
`container.querySelector(...)` or a CSS class breaks on markup changes that
no real user would ever notice, which trains the team to distrust test
failures instead of trusting them.

```tsx
// Best — matches user + assistive-tech perception
screen.getByRole("button", { name: /save/i });

// Good for form inputs
screen.getByLabelText("Email");

// Last resort — no accessible signal available
screen.getByTestId("save-btn");
```

Query variants, independent of the tier:

- `getBy*` — throws if no match. Use when the element must be present.
- `queryBy*` — returns `null` instead of throwing. Use specifically to
  assert *absence* (`expect(screen.queryByText(...)).not.toBeInTheDocument()`).
- `findBy*` — async, returns a Promise. Use for elements that appear after
  async work (see Async Patterns below).

## `userEvent.setup()` discipline

The modern `@testing-library/user-event` API is instance-based, not static.
Call `userEvent.setup()` once per test and reuse the returned instance —
don't call the older bare static methods (`userEvent.click(...)`) and don't
call `setup()` more than once within a single test.

```tsx
import userEvent from "@testing-library/user-event";

test("submits the form", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<UserForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText("Email"), "user@example.com");
  await user.click(screen.getByRole("button", { name: /save/i }));

  expect(onSubmit).toHaveBeenCalledWith({ email: "user@example.com" });
});
```

- Always `await` `userEvent` calls — they simulate a real sequence of
  browser events (focus, keydown, keyup, input, etc.), not one synthetic
  event, and that sequence is asynchronous.
- Prefer `userEvent` over `fireEvent` in almost all cases. `fireEvent`
  dispatches a single low-level DOM event and skips the realistic sequence
  a browser actually produces — it can pass in cases a real user
  interaction would fail.

## Async UI changes: `findBy*`, `waitFor`, `waitForElementToBeRemoved`

Never use `setTimeout` (or any fixed-delay sleep) to "wait for" something in
a test. It is both flaky (races against however long the async work
actually takes) and slow (you always pay the worst-case delay). Use the
matcher that expresses what you're actually waiting for:

```tsx
// Element that appears after async work
expect(await screen.findByText("Loaded")).toBeInTheDocument();

// A side effect assertion (a spy/mock being called)
await waitFor(() => expect(saveSpy).toHaveBeenCalled());

// An element that should disappear (e.g. a loading spinner)
await waitForElementToBeRemoved(() => screen.queryByText("Loading"));
```

Each of these polls until the condition is true (or times out), rather than
waiting a fixed guessed duration. That makes the test both faster on the
common case and correct on the slow case.

## Mocking the network with MSW

Mock Service Worker (MSW) intercepts at the network layer, so the
component, its data-fetching hooks, and the actual `fetch`/HTTP client all
run exactly as they do in production — only the network response is
substituted.

```ts
// test/setup.ts
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/users/:id", ({ params }) =>
    HttpResponse.json({ id: params.id, name: "Alice" }),
  ),
];

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**Set `onUnhandledRequest: "error"`.** Any request the test didn't
explicitly mock should fail the test loudly, not silently pass through to
the real network (flaky, slow, sometimes hits production) or resolve to
undefined behavior. A silent unmocked request is worse than a failing test
— it hides the fact that the test's mock setup doesn't match what the
component actually calls.

Per-test overrides layer on top of the default handlers:

```tsx
test("renders error on 500", async () => {
  server.use(
    http.get("/api/users/:id", () => new HttpResponse(null, { status: 500 })),
  );
  render(<UserPage id="1" />);
  expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
});
```

## Testing custom hooks with `renderHook`

`renderHook` exercises a hook in isolation, without needing a host
component:

```tsx
import { renderHook, act, waitFor } from "@testing-library/react";

test("useCounter increments and decrements", () => {
  const { result } = renderHook(() => useCounter(0));

  expect(result.current.count).toBe(0);
  act(() => result.current.increment());
  expect(result.current.count).toBe(1);
});
```

- Wrap any call that changes state in `act(...)`.
- Test through the hook's public return value only — not internal refs or
  effects.
- For a hook that consumes context (React Query, a custom provider, etc.),
  pass a `wrapper` option.

### The flake trap: shared instances created outside the test

When a hook depends on a shared instance — a `QueryClient`, a Redux store,
any object that holds cross-render cache/state — that instance **must be
created fresh inside the test, before the wrapper is defined for that
test**, never at module scope or reused across tests. A `QueryClient`
created once at the top of the test file and reused by every test carries
cached data and in-flight state from one test into the next, so tests pass
or fail depending on execution order — a classic hard-to-reproduce flake.

```tsx
test("useUser fetches user data", async () => {
  // Created fresh for THIS test, before the wrapper — not at module scope,
  // and not re-created inside the wrapper's render closure either (that
  // would reset cache state on every re-render instead of persisting it
  // for the lifetime of this one test).
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(() => useUser("1"), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual({ id: "1", name: "Alice" });
});
```

The same rule applies to `render()` of full components with providers: wrap
provider setup once in a `test-utils.tsx` helper, but have that helper
construct the shared instance (QueryClient, store, etc.) fresh on each call
rather than importing one singleton.

## Accessibility assertions with `jest-axe`

Run an automated accessibility check on every interactive component as part
of its test file:

```tsx
import { axe, toHaveNoViolations } from "jest-axe"; // or vitest-axe
expect.extend(toHaveNoViolations);

test("UserCard has no a11y violations", async () => {
  const { container } = render(<UserCard user={mockUser} />);
  expect(await axe(container)).toHaveNoViolations();
});
```

This catches missing form labels, invalid ARIA usage, missing alt text, and
heading-order violations automatically, cheaply, on every run. It does
**not** replace a full accessibility review — JSDOM has no real CSS engine,
so contrast checks are limited to inline styles, and axe cannot catch
keyboard-trap or focus-order issues that only manifest in a real browser.

For the fuller compliance checklist (WCAG criteria, manual keyboard/screen
reader walkthroughs, contrast in a real browser), see
`code-review-edho-ferdian/references/accessibility-lens.md` — this section
intentionally doesn't duplicate that checklist. Use `jest-axe` here as a
fast, always-on floor; use the accessibility-lens for the deeper pass.

## Decision boundary: RTL vs Playwright Component Testing vs full E2E

JSDOM (what Vitest/Jest use under RTL) is not a real browser. It cannot:

- Render real layout (flexbox/grid sizing, viewport queries).
- Run native browser animation or CSS transitions.
- Handle scrolling behavior, drag-and-drop, or clipboard paste.
- Handle iframes, popups, downloads, or cross-origin flows.

Use this to decide where a given test belongs:

- **A hook, a presentational component, or a form whose logic is the thing
  under test** → RTL (this skill's home turf).
- **A component whose layout genuinely matters, or that depends on a
  browser API JSDOM doesn't implement** → Playwright Component Testing (or
  Cypress Component Testing) — same component-level granularity, real
  browser engine.
- **A full flow across multiple pages/screens** (login → dashboard,
  add-to-cart → checkout) → full E2E. See `e2e-testing-edho-ferdian` — that
  skill owns journey mapping, Page Object Model, and flake quarantine for
  this layer; don't duplicate that setup here.

Do not run RTL and a component-level browser tool for the same component
"just in case" — pick the layer that matches what's actually at risk in
that component and keep one lane per component.

## Snapshot tests: use rarely, on purpose

Snapshots of rendered component output:

- Break on every incidental styling or markup change.
- Get rubber-stamped during review once the team gets tired of reading
  giant diffs.
- Test implementation detail (DOM structure), not behavior.

Acceptable snapshot uses are narrow: pure data-serialization functions
(`formatInvoice(invoice)` → a stable string) or generated config output —
things whose *exact textual form* is the actual contract. For visual
regression on rendered UI, use a real screenshot diff tool at the
Playwright/Cypress layer, not a DOM-string snapshot in RTL.

## Coverage expectations per layer

100% coverage is not the goal — behavioral coverage of the component's
actual contract is. A component at 100% line coverage with only
`toBeTruthy()`-style assertions is not well-tested (see
`code-review-edho-ferdian/references/test-quality-lens.md` TQ-06 for how
that divergence gets caught in review). As a rough guide when scoping how
much to write:

| Layer | Rough target | Why |
|---|---|---|
| Pure utilities | High (≈90%+) | Cheap to test exhaustively; usually pure functions with clear input/output contracts. |
| Custom hooks | High (≈85%+) | Public API is small and well-defined; edge cases (loading/error/empty) are enumerable. |
| Presentational components | Behavior-focused (≈80%), not line-chasing | Test what renders and what the component does in response to props/events, not every branch of internal styling logic. |
| Container components | Golden paths + error states (≈70%) | Wiring-heavy; the valuable tests are "does it fetch, render, and handle failure," not every permutation. |
| Pages | Smoke-test minimum here | Full behavior belongs to E2E (`e2e-testing-edho-ferdian`) — a page-level RTL test should confirm it renders and wires up, not re-verify the whole journey. |

Treat these as a starting point for scoping effort, not a number to chase
for its own sake — a component with a real behavioral contract fully
covered at 70% beats one padded to 95% with weak assertions.

## Anti-patterns to avoid

- `container.querySelector(...)` — bypasses accessible queries; lets a test
  pass in a way a real user's interaction would fail.
- Asserting on render count — implementation detail, not behavior.
- Mocking React itself (`jest.mock("react", ...)`) — refactor the component
  instead of fighting the framework.
- Mocking child components by default — tests the isolation, not the
  integration; only mock a child when it has heavy side effects (e.g. a
  real network call, a native module).
- Ignoring `act()` warnings — they usually indicate a real bug (state
  update after unmount, an async update not wrapped correctly).
- Sharing mutable state across tests (see the `QueryClient` flake trap
  above) — the general form of this anti-pattern is covered in
  `dev-kickoff-edho-ferdian/references/test-design-checklist.md`.
- A test that still passes with `it.skip()` removed but the assertion
  changed to something trivially true — it isn't actually asserting what
  you think it is.
