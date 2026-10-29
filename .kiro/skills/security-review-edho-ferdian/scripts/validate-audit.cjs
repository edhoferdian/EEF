#!/usr/bin/env node

/**
 * Mode C entry point for the two vendored Cloudflare validators.
 * Usage: node validate-audit.cjs findings|ledger <path-to-json>
 *
 * Where the OS offers no-follow, nonblocking opens (Linux, macOS) this runs
 * the upstream CLI unchanged. On Windows the upstream CLI refuses to read
 * anything, so this falls back to an lstat check (regular file, not a link,
 * within the size limit), a strict UTF-8 read, and the upstream exported
 * validateDocument(). The fallback has a check-then-read window the upstream
 * open avoids; that is acceptable here because Mode C validates files its
 * own parent agent just wrote under project-memory/audit/, not
 * attacker-supplied input.
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { TextDecoder } = require("node:util");

const VALIDATORS = {
  findings: "validate-findings.cjs",
  ledger: "validate-coverage-ledger.cjs",
};

const hasSafeOpen = () =>
  Number.isInteger(fs.constants.O_NOFOLLOW) && fs.constants.O_NOFOLLOW !== 0 &&
  Number.isInteger(fs.constants.O_NONBLOCK) && fs.constants.O_NONBLOCK !== 0;

// Input-derived text can carry terminal controls; show them as escapes.
const isControl = (code) =>
  code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029;
const printable = (message) =>
  Array.from(String(message), (c) => {
    const code = c.codePointAt(0);
    return isControl(code) ? `\\u${code.toString(16).padStart(4, "0")}` : c;
  }).join("");

function runUpstream(validatorPath, file) {
  const result = spawnSync(process.execPath, [validatorPath, file], { stdio: "inherit" });
  return result.status === null ? 1 : result.status;
}

function readRegularFile(file, maxBytes) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink()) throw new Error("input must not be a symlink");
  if (!stat.isFile()) throw new Error("input must be a regular file");
  if (stat.size > maxBytes) throw new Error(`input exceeds ${maxBytes} byte limit`);
  const bytes = fs.readFileSync(file);
  if (bytes.length > maxBytes) throw new Error(`input exceeds ${maxBytes} byte limit`);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function runFallback(kind, validatorPath, file) {
  const validator = require(validatorPath);
  let document;
  try {
    document = JSON.parse(readRegularFile(file, validator.LIMITS.inputBytes));
  } catch (error) {
    console.error(`Failed to read ${kind} JSON: ${printable(error.message)}`);
    return 1;
  }
  const errors = kind === "findings"
    ? validator.validateDocument(document, JSON.parse(fs.readFileSync(path.join(__dirname, "report-schema.json"), "utf8")))
    : validator.validateDocument(document);
  for (const message of errors) console.error("ERROR:", printable(message));
  if (errors.length > 0) {
    console.error(`FAIL: ${errors.length} validation error(s)`);
    return 1;
  }
  console.log(`PASS: ${kind} valid (${document.length} entries; Windows fallback read)`);
  return 0;
}

function run(kind, file) {
  if (!VALIDATORS[kind] || !file) {
    console.error("Usage: node validate-audit.cjs findings|ledger <path-to-json>");
    return 1;
  }
  const validatorPath = path.join(__dirname, VALIDATORS[kind]);
  return hasSafeOpen() ? runUpstream(validatorPath, file) : runFallback(kind, validatorPath, file);
}

module.exports = { run };

if (require.main === module) process.exit(run(process.argv[2], process.argv[3]));
