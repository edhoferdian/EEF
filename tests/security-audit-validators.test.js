// Runs Cloudflare's own test suites for the two validators vendored into
// security-review-edho-ferdian/scripts/ (Mode C full audit). The suites live
// under tests/security-audit/ unchanged except for their require paths and
// a skip on CLI cases where the OS has no no-follow open (Windows), so a
// future upstream sync stays close to a plain copy; requiring them
// registers their node:test cases with this run.
require("./security-audit/validate-findings.test.cjs");
require("./security-audit/validate-coverage-ledger.test.cjs");

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const WRAPPER = path.join(__dirname, "..", "skills", "security-review-edho-ferdian", "scripts", "validate-audit.cjs");

function runWrapper(kind, contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eef-validate-audit-"));
  try {
    const file = path.join(dir, `${kind}.json`);
    fs.writeFileSync(file, contents);
    return spawnSync(process.execPath, [WRAPPER, kind, file], { encoding: "utf8" });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("validate-audit passes an empty findings document and an empty ledger on every OS", () => {
  assert.equal(runWrapper("findings", "[]").status, 0);
  assert.equal(runWrapper("ledger", "[]").status, 0);
});

test("validate-audit fails a findings record missing its required fields", () => {
  const result = runWrapper("findings", JSON.stringify([{ verdict: "confirmed" }]));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /FAIL/);
});

test("validate-audit fails invalid UTF-8 instead of replacing it", () => {
  assert.equal(runWrapper("ledger", Buffer.from([0xff])).status, 1);
});

test("validate-audit rejects an unknown document kind", () => {
  const result = spawnSync(process.execPath, [WRAPPER, "report", "x.json"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage/);
});
