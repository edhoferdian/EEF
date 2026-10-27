import { test } from "node:test";
import assert from "node:assert";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config.js";

test("file values override defaults", () => {
  const file = join(mkdtempSync(join(tmpdir(), "b03-")), "c.json");
  writeFileSync(file, '{"port": 8080}');
  assert.deepStrictEqual(loadConfig(file), { port: 8080 });
});
