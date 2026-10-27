import { test } from "node:test";
import assert from "node:assert";
import { cartSummary } from "../src/cart.js";

test("summary counts lines and totals", () => {
  assert.strictEqual(cartSummary([{ cents: 250, qty: 2 }, { cents: 100, qty: 1 }]), "2 item(s), $6.00");
});
