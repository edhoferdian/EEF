# Vue / Vitest — Authoring Guide

This is stack-specific detail for `test-authoring-edho-ferdian`'s SKILL.md.
Read the SKILL.md first for the three-way boundary against
`code-review-edho-ferdian`'s test-quality-lens, `dev-kickoff-edho-ferdian`'s
test-design-checklist, and `e2e-testing-edho-ferdian` — this file assumes
that boundary and only covers Vue-specific authoring mechanics. Structured
to mirror `react.md`'s coverage (query priority, async patterns, mocking,
isolation, coverage-per-layer) for the parts of that shape which transfer,
and to cover what's genuinely different about Vue: the Composition API,
Vue Test Utils' mount strategies, and Pinia.

---

## Query priority (same principle as React, same tool family)

Vue Testing Library (built on `@testing-library/dom`, the same underlying
library React Testing Library uses) exposes the identical accessible-query
priority order as `react.md` — prefer `getByRole`/`getByLabelText` over
`getByTestId` for the same reason: a test built on accessible queries
resembles how a real user and assistive tech find the element, and survives
markup refactors that don't change accessible behavior.

```ts
import { render, screen } from "@testing-library/vue";

test("submits the form", async () => {
  render(UserForm);
  await screen.getByRole("button", { name: /save/i }).click();
});
```

If a project uses Vue Test Utils directly instead of Vue Testing Library
(common in older or more component-internals-focused Vue codebases), the
same priority preference still applies where VTU exposes it —
`wrapper.find('[role="button"]')` over `wrapper.find(".save-btn")` — but
prefer Vue Testing Library's `screen.getByRole` API when the project has it
available, since VTU's `find()` is CSS-selector-based by default and makes
it easy to default to markup-coupled selectors without noticing.

---

## Vue Test Utils — mount strategies: shallow vs. full mount

This is the first Vue-specific decision every component test makes, and
getting it wrong in either direction is common.

```ts
import { mount, shallowMount } from "@vue/test-utils";

// Full mount — renders child components for real, all the way down
mount(UserProfile, { props: { userId: "1" } });

// Shallow mount — child components render as stubs (no internal markup)
shallowMount(UserProfile, { props: { userId: "1" } });
```

- **`mount` (full mount)** renders the entire component tree, including
  every child component's real template output. Use this as the default —
  it's what actually resembles what a user sees, and it's the only way an
  accessible query like `getByRole` can find something inside a child
  component (a shallow-mounted child renders as an opaque stub tag with no
  accessible content inside it at all).
- **`shallowMount`** stubs out every child component, rendering only the
  component under test's own template. This isolates the component from
  its children's behavior entirely, which is occasionally the right choice
  (verifying a parent passes the right props down, without caring what the
  child does with them) but has a real cost: it can't catch an integration
  bug where the parent and child disagree about a prop's shape, and it
  can't be queried for anything that only exists inside the child's real
  render output.
- **Default to full mount.** Reach for `shallowMount` only when a specific
  child is expensive or has side effects that make a full render
  impractical for this test (a real map widget, a video player, a component
  that fires a real network call on mount that isn't otherwise mocked) —
  not as a default isolation strategy. This mirrors `react.md`'s anti-
  pattern list: "mocking child components by default... tests the
  isolation, not the integration."

---

## Testing Composition API composables in isolation

A composable (`useX()` function using `ref`/`computed`/`watch`/lifecycle
hooks) can often be tested as a plain function call, without mounting any
component at all — this is the Vue analogue of `react.md`'s `renderHook`
section, and is usually simpler than React's equivalent because a
composable that doesn't rely on `getCurrentInstance()`, injected context, or
a component lifecycle hook can just be called directly:

```ts
import { useCounter } from "./useCounter";

test("useCounter increments and decrements", () => {
  const { count, increment, decrement } = useCounter(0);

  expect(count.value).toBe(0);
  increment();
  expect(count.value).toBe(1);
  decrement();
  expect(count.value).toBe(0);
});
```

No wrapper component needed here — `ref`s work outside a component context,
so a composable built purely on `ref`/`computed`/plain functions can be
exercised directly, reading `.value` to assert.

### When a composable needs `withSetup`

A composable that uses `provide`/`inject`, lifecycle hooks
(`onMounted`, `onUnmounted`), or anything else requiring an active component
instance needs to be invoked inside one. The common pattern is a small
`withSetup` test helper that mounts a throwaway host component just to give
the composable a valid instance to run inside:

```ts
import { createApp } from "vue";

function withSetup<T>(composable: () => T): [T, ReturnType<typeof createApp>] {
  let result!: T;
  const app = createApp({
    setup() {
      result = composable();
      return () => {};
    },
  });
  app.mount(document.createElement("div"));
  return [result, app];
}

test("useMousePosition registers and cleans up a listener", () => {
  const [{ x, y }, app] = withSetup(() => useMousePosition());
  expect(x.value).toBe(0);
  app.unmount(); // triggers onUnmounted — verify cleanup ran if that's the contract
});
```

Calling `app.unmount()` at the end and asserting on whatever the composable
was supposed to clean up (an event listener removed, a timer cleared) is
the direct way to test that an `onUnmounted` cleanup actually runs — the
Vue analogue of the leaked-listener heap-diffing concern
`backend-latency-and-throughput.md` and `web-frontend.md` care about for
JS generally, caught here at the unit level instead of via a heap snapshot.

### The shared-instance flake trap — same shape as React's `QueryClient` trap

If a composable depends on a shared singleton (a module-level `ref`, a
shared event bus, an app-wide reactive store created once at import time),
that instance carries state across tests unless it's re-created fresh per
test — identical failure mode to `react.md`'s `QueryClient` warning. Prefer
a composable that accepts its dependencies as parameters (or a factory
function that creates a fresh instance) over one that imports a module-level
singleton directly, specifically so tests can construct an isolated instance
per test rather than sharing one across the file.

---

## Testing Pinia stores

Pinia stores need an active Pinia instance to run against — set one up
fresh per test, the same discipline as the flake trap above, using
`@pinia/testing`'s `createTestingPinia` or a plain `createPinia()`:

```ts
import { setActivePinia, createPinia } from "pinia";
import { useUserStore } from "./userStore";

beforeEach(() => {
  setActivePinia(createPinia()); // fresh store instance per test
});

test("useUserStore login sets the current user", () => {
  const store = useUserStore();

  store.login({ id: "1", name: "Alice" });

  expect(store.currentUser?.name).toBe("Alice");
  expect(store.isAuthenticated).toBe(true);
});
```

`beforeEach` re-creating the Pinia instance is not optional boilerplate —
without it, a store's state (and any actions with side effects already
run) persists from the previous test, reproducing the exact
shared-mutable-state flake this file and `react.md` both warn about.

### `createTestingPinia` for component tests that use a store

When testing a *component* that reads from or dispatches to a Pinia store
(rather than testing the store directly), `@pinia/testing`'s
`createTestingPinia` auto-mocks actions by default, which lets a component
test assert "did the component call this action with these arguments"
without the action's real implementation (and its own side effects, e.g. a
real API call) running during a component-level test:

```ts
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { vi } from "vitest";

test("clicking save dispatches the store action", async () => {
  const wrapper = mount(SaveButton, {
    global: {
      plugins: [createTestingPinia({ stubActions: true })],
    },
  });
  const store = useUserStore();

  await wrapper.get('[role="button"]').trigger("click");

  expect(store.save).toHaveBeenCalledOnce();
});
```

Use `stubActions: true` (the default) for a component test that only cares
whether the right action was dispatched; use `stubActions: false` (or test
the store directly, per the section above) when the test needs the action's
real effect on state to actually happen.

---

## Async UI changes — Vitest/VTU equivalents of `findBy*`/`waitFor`

Vue's reactivity updates the DOM asynchronously (batched via `nextTick`), so
an assertion made immediately after a state-changing call can run before
the DOM has actually updated:

```ts
import { nextTick } from "vue";

test("shows loaded data after fetch resolves", async () => {
  const wrapper = mount(UserProfile, { props: { userId: "1" } });

  await flushPromises();    // let the mocked fetch's promise chain resolve
  await nextTick();          // let Vue's reactivity flush the resulting DOM update

  expect(wrapper.text()).toContain("Alice");
});
```

- `await nextTick()` after any state change that should be reflected in the
  DOM before the next assertion — this is Vue's most common source of a
  flaky "expected text not found" failure when omitted.
- `flushPromises()` (from `@vue/test-utils` or a small helper) drains the
  microtask queue for async work (a mocked fetch's `.then` chain) that
  `nextTick()` alone doesn't wait for — reach for both together when the
  update flows through an async call before it changes reactive state.
- Never use a fixed `setTimeout`-based wait to paper over a missing
  `nextTick`/`flushPromises` — same anti-pattern `react.md` flags for RTL,
  same fix: await the actual thing you're waiting for.
- If using Vue Testing Library (`@testing-library/vue`), its `findBy*`
  queries poll the same way React Testing Library's do and are usually
  simpler than manually chaining `nextTick`/`flushPromises` — prefer them
  when the project already uses Vue Testing Library.

---

## Mocking the network

Prefer MSW (Mock Service Worker) here too, for the same reason `react.md`
prefers it: it intercepts at the network layer, so the component's actual
`fetch`/HTTP client runs unmodified and only the response is substituted.
The setup is framework-agnostic — the same `setupServer`/`http.get(...)`
pattern from `react.md` applies unchanged to a Vue project; there is no
Vue-specific network-mocking layer to reach for instead.

---

## Coverage expectations per layer

Same rough shape as `react.md`'s table, mapped to Vue's equivalents:

| Layer | Rough target | Why |
|---|---|---|
| Pure utilities | High (≈90%+) | Cheap to test exhaustively; clear input/output contracts. |
| Composables | High (≈85%+) | Small public API surface (the returned refs/functions); edge cases (loading/error/empty) are enumerable, same as a React hook. |
| Pinia stores | High (≈85%+) | State/getters/actions are a well-defined contract; test the store directly per the section above rather than only through components that happen to use it. |
| Presentational components | Behavior-focused (≈80%) | Test rendered output and emitted events in response to props, not internal reactive state. |
| Container/page components | Golden path + error states (≈70%) | Wiring-heavy; full behavioral coverage belongs to E2E (`e2e-testing-edho-ferdian`). |

Treat this as a starting point for scoping effort, not a number to chase —
same caveat as every other stack file in this skill.

---

## Anti-patterns to avoid

- `shallowMount` as the default mounting strategy instead of the exception —
  see the mount-strategy section above.
- Reaching into a component's internal reactive state via
  `wrapper.vm.someInternalRef` instead of asserting on rendered output or
  emitted events — tests implementation detail, not behavior, the same
  complaint `react.md` has about asserting render count.
- A module-level singleton `ref`/store/event-bus reused across tests
  without being re-created per test — the Vue shape of the shared-instance
  flake trap.
- Asserting immediately after a state change without `await nextTick()`
  (or the equivalent `findBy*`), producing a test that's flaky depending on
  timing rather than reliably wrong or right.
- Testing a composable only through a mounted host component when it has no
  actual dependency on component lifecycle/injection — adds an unnecessary
  mount just to call a function that could be called directly.
- Mocking a child component by default in a full-mount test "to be safe" —
  reintroduces the isolation-vs-integration tradeoff `shallowMount` already
  represents, just implicitly.

## Provenance

Written for this ecosystem to close the Vue test-authoring gap, 2026-09-07.
Structured to parallel `react.md`'s existing coverage where the
underlying concepts transfer (query priority, async waiting, network
mocking, coverage-per-layer), with Vue-specific sections (Composition API
composables, Vue Test Utils mount strategies, Pinia) written directly for
this skill.
