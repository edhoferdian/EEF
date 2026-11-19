#!/usr/bin/env node
// Summarize the skill telemetry written by hooks/log-skill-use.js: how often
// each installed skill loaded, and which installed skills never did.
//
// Usage:
//   node skill-report.js              # all records
//   node skill-report.js --days 30    # only the last 30 days
//   node skill-report.js --json       # machine-readable output
//
// Env: EEF_SKILL_LOG (log path), CLAUDE_SKILLS_DIR (installed skills).

const fs = require("fs");
const os = require("os");
const path = require("path");

const LOG_PATH = process.env.EEF_SKILL_LOG || path.join(os.homedir(), ".claude", "eef", "skill-runs.jsonl");
const SKILLS_DIR = process.env.CLAUDE_SKILLS_DIR || path.join(os.homedir(), ".claude", "skills");

const args = process.argv.slice(2);
const daysIdx = args.indexOf("--days");
const days = daysIdx !== -1 ? Number(args[daysIdx + 1]) : null;
const asJson = args.includes("--json");

function readRecords() {
  if (!fs.existsSync(LOG_PATH)) return [];
  const since = days ? Date.now() - days * 86400000 : null;
  return fs
    .readFileSync(LOG_PATH, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((r) => r && r.skill && (!since || Date.parse(r.ts) >= since));
}

function installedEefSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs
    .readdirSync(SKILLS_DIR)
    .filter((name) => name.endsWith("-edho-ferdian") && fs.existsSync(path.join(SKILLS_DIR, name, "SKILL.md")))
    .sort();
}

const records = readRecords();
const counts = {};
for (const r of records) {
  const name = r.skill.includes(":") ? r.skill.split(":").pop() : r.skill;
  counts[name] = (counts[name] || 0) + 1;
}
const installed = installedEefSkills();
const never = installed.filter((name) => !counts[name]);
const used = Object.entries(counts).sort((a, b) => b[1] - a[1]);

if (asJson) {
  process.stdout.write(JSON.stringify({ log: LOG_PATH, records: records.length, used: Object.fromEntries(used), never }, null, 2) + "\n");
} else if (!records.length) {
  console.log(`No skill records yet in ${LOG_PATH}. Install the hook: npx eef-install --target claude-hooks --only skill-telemetry`);
} else {
  console.log(`${records.length} skill load(s) from ${LOG_PATH}${days ? ` (last ${days} days)` : ""}\n`);
  for (const [name, n] of used) console.log(`${String(n).padStart(5)}  ${name}`);
  console.log(`\nInstalled EEF skills that never loaded (${never.length}/${installed.length}):`);
  for (const name of never) console.log(`       ${name}`);
}
