# Worked Journey — checkout, from map to a stable Playwright test

A critical journey taken from `journey-design.md` to running code with a
Page Object Model, fixtures, network control and artifacts. Playwright
shown; the structure carries over to other drivers (`driver-detection.md`).

## 1. Map the journey (before any code)

```markdown
Journey J-03 "Guest checkout with QRIS"
Actor: guest  ·  Value: revenue  ·  Frequency: every order  → CRITICAL
1. Open product page → add to cart (cart badge = 1)
2. Open cart → change qty to 2 (total updates)
3. Checkout → fill name, phone, address
4. Pick QRIS → "Bayar" → payment page shows QR and amount
5. Payment confirmed (webhook) → order confirmation page with order number
Assertions that matter: totals, the order number exists, the confirmation email job is queued
Out of scope here: real payment provider (stubbed at the boundary)
```

## 2. Project layout

```text
e2e/
├── fixtures.ts               ← test.extend: page objects, seeded data
├── pages/
│   ├── ProductPage.ts
│   ├── CartPage.ts
│   └── CheckoutPage.ts
├── journeys/
│   └── checkout-qris.spec.ts
└── support/
    ├── seed.ts               ← creates the product via API, returns ids
    └── payment-stub.ts       ← simulates the provider's webhook
```

## 3. Page objects — locators by role and label, actions as intent

```ts
// e2e/pages/CartPage.ts
import { expect, type Page } from "@playwright/test";

export class CartPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto("/keranjang");
  }

  async setQuantity(productName: string, qty: number) {
    const row = this.page.getByRole("row", { name: new RegExp(productName, "i") });
    await row.getByRole("spinbutton", { name: /jumlah/i }).fill(String(qty));
    await row.getByRole("spinbutton", { name: /jumlah/i }).blur();
  }

  async expectTotal(text: string) {
    await expect(this.page.getByTestId("cart-total")).toHaveText(text);   // web-first assertion, auto-waits
  }

  async checkout() {
    await this.page.getByRole("link", { name: /checkout/i }).click();
  }
}
```

```ts
// e2e/pages/CheckoutPage.ts
export class CheckoutPage {
  constructor(private readonly page: Page) {}

  async fillGuest({ name, phone, address }: { name: string; phone: string; address: string }) {
    await this.page.getByLabel("Nama lengkap").fill(name);
    await this.page.getByLabel("Nomor HP").fill(phone);
    await this.page.getByLabel("Alamat").fill(address);
  }

  async payWithQris() {
    await this.page.getByRole("radio", { name: "QRIS" }).check();
    await this.page.getByRole("button", { name: "Bayar" }).click();
    await expect(this.page.getByRole("img", { name: /kode qris/i })).toBeVisible();
  }

  orderNumber() {
    return this.page.getByTestId("order-number");
  }
}
```

## 4. Fixtures — seeded data and page objects per test

```ts
// e2e/fixtures.ts
import { test as base } from "@playwright/test";
import { seedProduct } from "./support/seed";
import { ProductPage } from "./pages/ProductPage";
import { CartPage } from "./pages/CartPage";
import { CheckoutPage } from "./pages/CheckoutPage";

type Fixtures = { product: { id: string; slug: string; name: string }; productPage: ProductPage; cart: CartPage; checkout: CheckoutPage };

export const test = base.extend<Fixtures>({
  product: async ({ request }, use) => {
    const product = await seedProduct(request, { name: `Kopi Uji ${Date.now()}`, price: 45_000, stock: 10 });  // unique per test
    await use(product);
    await request.delete(`/api/test/products/${product.id}`);                                                   // cleanup
  },
  productPage: async ({ page }, use) => use(new ProductPage(page)),
  cart: async ({ page }, use) => use(new CartPage(page)),
  checkout: async ({ page }, use) => use(new CheckoutPage(page)),
});
export { expect } from "@playwright/test";
```

Seeding through an API (test-only endpoint, disabled in production)
keeps tests independent of each other and of UI setup steps.

## 5. The journey test

```ts
// e2e/journeys/checkout-qris.spec.ts
import { test, expect } from "../fixtures";
import { confirmPayment } from "../support/payment-stub";

test("guest buys 2 items with QRIS and gets an order number", async ({ page, product, productPage, cart, checkout, request }) => {
  await productPage.open(product.slug);
  await productPage.addToCart();
  await expect(page.getByTestId("cart-badge")).toHaveText("1");

  await cart.open();
  await cart.setQuantity(product.name, 2);
  await cart.expectTotal("Rp90.000");

  await cart.checkout();
  await checkout.fillGuest({ name: "Sari Uji", phone: "081234567890", address: "Jl. Mawar 1, Bandung" });
  await checkout.payWithQris();

  // The provider is outside our system: simulate its signed webhook instead of a real payment.
  const orderId = new URL(page.url()).searchParams.get("order")!;
  await confirmPayment(request, orderId);

  await expect(checkout.orderNumber()).toHaveText(/^ORD-\d{6}$/, { timeout: 15_000 });
});
```

```ts
// e2e/support/payment-stub.ts — posts what the provider would post, signed with the test secret
import crypto from "node:crypto";
export async function confirmPayment(request, orderId: string) {
  const body = JSON.stringify({ order_id: orderId, status: "settlement" });
  const sig = crypto.createHmac("sha256", process.env.PAYMENT_WEBHOOK_TEST_SECRET!).update(body).digest("hex");
  const res = await request.post("/api/webhooks/payment", { data: body, headers: { "content-type": "application/json", "x-signature": sig } });
  if (!res.ok()) throw new Error(`webhook stub failed: ${res.status()}`);
}
```

## 6. Reusing login for staff journeys

```ts
// e2e/auth.setup.ts
import { test as setup } from "@playwright/test";
setup("staff login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_STAFF_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_STAFF_PASSWORD!);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL("/dashboard");
  await page.context().storageState({ path: "e2e/.auth/staff.json" });
});
```

```ts
// playwright.config.ts (excerpt)
projects: [
  { name: "setup", testMatch: /auth\.setup\.ts/ },
  { name: "staff", dependencies: ["setup"], use: { storageState: "e2e/.auth/staff.json" }, testMatch: /staff\/.*\.spec\.ts/ },
  { name: "guest", testMatch: /journeys\/.*\.spec\.ts/ },
],
use: { trace: "retain-on-failure", screenshot: "only-on-failure", video: "retain-on-failure" },
```

Test credentials come from the environment (CI secrets), never from the
repo. `e2e/.auth/` is gitignored.

## 7. Making it stable

| Instability | Fix |
|---|---|
| Waiting with `waitForTimeout` | Web-first assertions (`toHaveText`, `toBeVisible`) |
| Text locators that change with copy | Roles + accessible names; `data-testid` for values |
| Shared data between tests | Unique seed per test, cleanup in the fixture |
| Animations interfering | `reducedMotion: "reduce"` in `use`, or wait for the final state |
| Third-party scripts (chat widgets, analytics) | `page.route("**/widget.js", r => r.abort())` |
| Time-dependent UI | `page.clock.setFixedTime(new Date("2026-11-19T10:00:00+07:00"))` |

A test that still flakes goes to quarantine with a ticket
(`flake-quarantine.md`); it doesn't get a retry count of 5.

## 8. Run and read the artifacts

```bash
npx playwright test e2e/journeys/checkout-qris.spec.ts --project=guest
npx playwright show-trace test-results/**/trace.zip     # step-by-step DOM, network, console
npx playwright test --repeat-each=10 --workers=4        # flake check before merging
```

Report: journey ID, pass/fail, trace link for failures, and what the
failure means for a user ("guests can't complete QRIS checkout").
