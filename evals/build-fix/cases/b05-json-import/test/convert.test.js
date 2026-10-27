import { test } from "node:test";
import assert from "node:assert";
import { fromUsd } from "../src/convert.js";

test("converts with the table rate", () => {
  assert.strictEqual(fromUsd(10, "EUR"), 9.2);
  assert.throws(() => fromUsd(1, "XYZ"));
});
