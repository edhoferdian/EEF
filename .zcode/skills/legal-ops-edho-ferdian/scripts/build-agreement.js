#!/usr/bin/env node
// Build a DRAFT agreement from a Markdown template and a JSON spec.
// Usage: node build-agreement.js <template.md> <spec.json> <out-dir> [--markdown-only]
// Exit codes: 0 ok, 1 build/validation/conversion failure, 2 bad arguments.
// See ../references/agreement-drafting.md. Output is never legal advice and
// never an execution copy.

"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// Replace with counsel-approved wording. `{cp}` becomes the counterparty's short name.
const ROLES = {
  buyer: {
    feeTitle: "INTRODUCTION FEE",
    role: "{cp} appoints Us on a non-exclusive basis to source and introduce counterparties for {cp}'s requirements.",
    fee: "{cp} pays Us the fee stated on Schedule A for each Transaction with a Protected Counterparty.",
  },
  supplier: {
    feeTitle: "INTRODUCTION FEE",
    role: "{cp} offers its capacity to Us and to buyers We introduce; where We buy as principal, the Schedule A terms for that entry apply.",
    fee: "{cp} pays Us the fee stated on Schedule A for each Transaction with a buyer We introduced.",
  },
  mutual: {
    feeTitle: "RECIPROCAL INTRODUCTION FEE",
    role: "Each Party may introduce counterparties to the other.",
    fee: "The Party that closes a Transaction with a Protected Counterparty introduced by the other pays the fee stated on Schedule A.",
  },
};

const BLANK = "______________________________";
const DRAFT_BANNER =
  "> **DRAFT — NOT FOR SIGNATURE.** Generated from a template for review by qualified counsel. " +
  "Generation does not establish legal completeness, signing authority, or approval to send.\n\n";
const EMPTY_SCHEDULE_ROW = "| — | — | No entries at signing | — | — | — |";

class BuildError extends Error {}

function validateFileName(name) {
  const bad =
    typeof name !== "string" || name.length === 0 || name.length > 120 ||
    /[\\/:*?"<>|\x00-\x1f]/.test(name) || /[. ]$/.test(name) || /^\.+$/.test(name) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(name);
  if (bad) throw new BuildError(`spec.file is not a portable bare filename: ${JSON.stringify(name)}`);
}

function hasLoneSurrogate(s) {
  return /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(s);
}

function escapeCell(value, where) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new BuildError(`${where}: non-finite number`);
    value = String(value);
  }
  if (typeof value !== "string") throw new BuildError(`${where}: must be a string or finite number`);
  if (hasLoneSurrogate(value)) throw new BuildError(`${where}: unpaired UTF-16 surrogate`);
  return value
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/[\\`*_{}\[\]<>|#&]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "\\" + c));
}

function renderSchedule(schedule) {
  if (schedule === undefined || (Array.isArray(schedule) && schedule.length === 0)) return EMPTY_SCHEDULE_ROW;
  if (!Array.isArray(schedule)) throw new BuildError("spec.schedule must be an array of six-cell rows");
  return schedule
    .map((row, r) => {
      if (!Array.isArray(row) || row.length !== 6) throw new BuildError(`schedule row ${r}: must have exactly 6 cells`);
      return "| " + row.map((cell, c) => escapeCell(cell, `schedule row ${r} cell ${c}`)).join(" | ") + " |";
    })
    .join("\n");
}

function buildValues(spec) {
  for (const key of ["file", "short", "role"]) {
    if (typeof spec[key] !== "string" || spec[key].trim() === "") throw new BuildError(`spec.${key} is required`);
  }
  validateFileName(spec.file);
  const role = ROLES[spec.role];
  if (!role) throw new BuildError(`unknown role "${spec.role}"; expected one of ${Object.keys(ROLES).join(", ")}`);
  const cp = spec.short.trim();
  const orBlank = (v) => (typeof v === "string" && v.trim() ? v.trim() : BLANK);
  return {
    DATE: spec.date || new Date().toISOString().slice(0, 10),
    CP_SHORT: cp,
    CP_LEGAL: orBlank(spec.legal),
    CP_JURIS: orBlank(spec.juris),
    CP_ADDR: orBlank(spec.addr),
    ROLE_CLAUSE: role.role.replaceAll("{cp}", cp),
    FEE_TITLE: role.feeTitle,
    FEE_CLAUSE: role.fee.replaceAll("{cp}", cp),
    SCHEDULE_ROWS: renderSchedule(spec.schedule),
    SUPPLEMENT_CLAUSE: typeof spec.supplement === "string" && spec.supplement.trim() ? `${spec.supplement.trim()}; ` : "",
    CP_SIGBLOCK: typeof spec.legal === "string" && spec.legal.trim() ? spec.legal.trim() : cp,
    CP_SIGNER: orBlank(spec.signer),
    CP_TITLE: orBlank(spec.title),
    CP_EMAIL: orBlank(spec.email),
  };
}

function render(template, values) {
  const out = template.replace(/\{\{([A-Z_]+)\}\}/g, (m, key) => {
    if (!(key in values)) throw new BuildError(`template uses unknown placeholder {{${key}}}`);
    return values[key];
  });
  return DRAFT_BANNER + out;
}

function safeDestination(outDir, name) {
  const dest = path.join(outDir, name);
  if (path.dirname(dest) !== outDir) throw new BuildError(`destination escapes output directory: ${dest}`);
  let st = null;
  try { st = fs.lstatSync(dest); } catch (_) { /* absent is fine */ }
  if (st && st.isSymbolicLink()) throw new BuildError(`refusing to write through a symlink: ${dest}`);
  if (st && !st.isFile()) throw new BuildError(`destination exists and is not a regular file: ${dest}`);
  return dest;
}

function build(templatePath, specPath, outDirArg, { markdownOnly = false } = {}) {
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const values = buildValues(spec);
  const markdown = render(fs.readFileSync(templatePath, "utf8"), values);

  fs.mkdirSync(outDirArg, { recursive: true });
  const outDir = fs.realpathSync(outDirArg);
  const mdPath = safeDestination(outDir, `${spec.file} MASTER.md`);
  const docxPath = safeDestination(outDir, `${spec.file} MASTER.docx`);

  if (fs.existsSync(docxPath)) fs.unlinkSync(docxPath); // never let a stale DOCX pass for this build
  fs.writeFileSync(mdPath, markdown, "utf8");
  if (markdownOnly) return { markdown: mdPath, docx: null, docxSkipped: true, documentStatus: "draft" };

  const probe = spawnSync("pandoc", ["--version"], { timeout: 10000 });
  if (probe.error || probe.status !== 0) throw new BuildError("pandoc not available (use --markdown-only to skip DOCX)");
  const conv = spawnSync("pandoc", [mdPath, "-o", docxPath], { timeout: 10000 });
  const ok = !conv.error && conv.status === 0 && fs.existsSync(docxPath) && fs.statSync(docxPath).size > 0;
  if (!ok) {
    if (fs.existsSync(docxPath)) fs.unlinkSync(docxPath);
    throw new BuildError(`pandoc conversion failed: ${conv.error ? conv.error.message : (conv.stderr || "").toString().trim()}`);
  }
  return { markdown: mdPath, docx: docxPath, docxSkipped: false, documentStatus: "draft" };
}

function main(argv) {
  const flags = argv.filter((a) => a.startsWith("--"));
  const positional = argv.filter((a) => !a.startsWith("--"));
  const unknown = flags.filter((f) => f !== "--markdown-only");
  if (unknown.length || new Set(flags).size !== flags.length || positional.length !== 3) {
    console.error("usage: build-agreement.js <template.md> <spec.json> <out-dir> [--markdown-only]");
    return 2;
  }
  try {
    const result = build(...positional, { markdownOnly: flags.includes("--markdown-only") });
    console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (e) {
    console.error(`build failed: ${e.message}`);
    return 1;
  }
}

module.exports = { ROLES, buildValues, render, renderSchedule, build, main };
if (require.main === module) process.exitCode = main(process.argv.slice(2));
