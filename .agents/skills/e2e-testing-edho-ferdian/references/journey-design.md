# Journey Design & Page Object Model (Phase 1–2)

Reference for Phase 1 and Phase 2 of `e2e-testing-edho-ferdian`. Playwright
examples are used throughout — a standard, widely-used framework.

## Phase 1 — Critical journey mapping

**Map before you write.** The failure mode this guards against is an E2E
suite that grows to cover every possible click path and becomes slow,
flaky, and ignored. A good E2E suite is small and load-bearing.

### Step 1 — List candidate flows

Walk the product from the user's perspective, not the codebase's. For each
distinct flow, capture:

- **Entry point** — where the user starts (a URL, a screen, a trigger).
- **Steps** — the observable actions a real user takes, in order.
- **End state** — what "succeeded" looks like, observably (a confirmation
  message, a redirected URL, a changed count, an email — whatever a human
  could check without opening dev tools).

### Step 2 — Prioritize by risk, not by ease

| Priority | Criteria | Examples |
|----------|----------|----------|
| HIGH | Money, auth, irreversible actions | Login, signup, checkout, payment, delete account, password reset |
| MEDIUM | Core value-delivering flows | Search → view result → take action, primary CRUD flow, main navigation |
| LOW | Cosmetic, rarely used | Theme toggle, profile avatar upload, a settings page nobody changes |

Write E2E tests for HIGH first, always. MEDIUM once HIGH is stable. Treat
LOW as a candidate for a lighter check (a unit/component test, or skip) —
E2E is the most expensive test type per assertion; spend it deliberately.

### Step 3 — Write the journey, not the implementation

```
Journey: User completes checkout with a saved card
1. User is on the cart page with 1+ items
2. User clicks "Checkout"
3. User selects a saved payment method
4. User clicks "Place order"
Expected end state: order confirmation page shown with an order number;
                     cart is now empty.
```

This is what gets reviewed with a product owner or PM, and what a test
file's `test()` description should read like — not "clicks button #cart-1."

### How many journeys is enough

There is no fixed number — the sizing signal is coverage of HIGH-priority
flows, not a target count. A small app might need 5–8 journeys total; a
larger one may need 20+ HIGH/MEDIUM journeys. Padding the suite with LOW
journeys to hit a number is an anti-pattern (slower CI, more flake surface,
no proportional risk reduction).

---

## Phase 2 — Page Object Model

**Why:** without it, a UI change (a renamed button, a moved field) breaks
every test that touches that screen, each with its own copy of the same
selector. With it, one file changes.

### Structure

One class/module per screen or major reusable component. It exposes
**intention-revealing actions**, not raw locators, to the test:

```typescript
// pages/checkout.page.ts
export class CheckoutPage {
  constructor(private page: Page) {}

  async selectSavedCard(last4: string) {
    await this.page.getByRole('radio', { name: `Card ending ${last4}` }).check();
  }

  async placeOrder() {
    await this.page.getByRole('button', { name: 'Place order' }).click();
  }

  async expectOrderConfirmed() {
    await expect(this.page.getByText(/Order #\d+/)).toBeVisible();
  }
}
```

```typescript
// tests/checkout.spec.ts
test('user completes checkout with a saved card', async ({ page }) => {
  const checkout = new CheckoutPage(page);
  await checkout.selectSavedCard('4242');
  await checkout.placeOrder();
  await checkout.expectOrderConfirmed();
});
```

The test file reads like the journey from Phase 1. That's the point —
traceability from mapped flow to test to code.

### Locator strategy (in priority order)

1. **Role/accessible-name locators** (`getByRole`, `getByLabel`) — resilient
   to markup changes, and doubles as a lightweight accessibility check.
2. **`data-testid`** — stable, explicit test hook, when a role locator isn't
   practical (a generic container, a canvas element).
3. **CSS/XPath selectors** — last resort only. Brittle against refactors;
   a raw CSS chain inside a test body (not inside the Page Object) is a
   defect to flag in review, not a style nitpick.

### Waiting — for conditions, not time

- `waitForTimeout(ms)` is an anti-pattern — it's either too short (flaky) or
  too long (slow suite) and never both correct and fast.
- Wait for the actual condition: `waitForResponse()` for a network call,
  a locator's built-in auto-wait (`.click()`, `.fill()` already wait for
  actionability), `waitForURL()` for navigation, `expect(locator).toBeVisible()`
  with its built-in retry.

### Test isolation

Each test must be independent — no shared mutable state between tests
(a test that depends on a previous test having run first is a defect, not a
sequencing feature). Seed the data a test needs inside that test (or a
scoped fixture), not via execution order.

### When to escalate a component test to E2E

JSDOM — the DOM implementation behind most component test runners (Jest,
Vitest with the default `jsdom` environment) — is not a real browser. It
cannot accurately simulate:

- **Real layout / box-model** — no actual layout engine, so anything
  depending on computed sizes, overflow, or scroll position is unreliable.
- **CSS animations and transitions** — these don't run in JSDOM at all.
- **Native drag-and-drop** — the browser's native DnD APIs have no JSDOM
  implementation.
- **`<iframe>`s** — cross-document behavior isn't modeled.
- **Clipboard API** — no real clipboard to read from or write to.
- **Cross-origin behavior** — CORS, cross-origin `postMessage`, and related
  same-origin-policy behavior aren't enforced the way a real browser
  enforces them.

A test whose assertion depends on any of the above belongs in E2E (Phase 1's
journey mapping, run against a real browser engine), not in a component
test — a component test asserting "the element animated" or "the drag
completed" against JSDOM is asserting against a simulation that doesn't
model the mechanism being tested, and a green result there proves nothing
about real behavior.

### Native OS matrix — a Linux CI container doesn't cover other platforms

A Linux
container in CI validates Linux behavior, not macOS or Windows behavior —
Docker shares the host's Linux kernel, so it cannot exercise
macOS/Windows-specific code paths at all. For anything host-path-sensitive —
path separators (`/` vs `\`), filesystem case-sensitivity (case-insensitive
on macOS/Windows by default, case-sensitive on Linux), or shell-quoting
differences — a green Linux-container run in CI is not evidence the same
flow works on macOS or Windows. Keep a native OS matrix (real macOS runner,
real Windows runner, alongside the Linux container) for any E2E or
build-verification flow that touches these; don't assume the Linux result
generalizes.

### Native-automation note (when Phase 0 selected `desktop-e2e-edho-ferdian`)

The Page Object Model still applies conceptually — one module per
screen/window, exposing named actions — but locators become OS accessibility
identifiers or coordinates instead of DOM selectors, and "role locator" in
the priority list above maps to the accessibility-tree role exposed by the
native automation tool, not a web ARIA role. The journey-mapping method in
Phase 1 is unchanged either way — it's driver-agnostic by design.
