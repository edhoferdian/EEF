import { quote } from "../src/services/pricing";

jest.mock("../src/db", () => ({
  db: { product: { findMany: async () => [{ id: "p1", priceCents: 1200 }] } },
}));

test("adds shipping below the free-shipping threshold", async () => {
  const q = await quote([{ productId: "p1", qty: 1 }]);
  expect(q).toEqual({ subtotal: 1200, shipping: 499, tax: 96, total: 1795 });
});

test("ships free at or above the threshold", async () => {
  const q = await quote([{ productId: "p1", qty: 5 }]);
  expect(q).toEqual({ subtotal: 6000, shipping: 0, tax: 480, total: 6480 });
});
