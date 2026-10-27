#!/usr/bin/env node
// Claude Code status line — keeps quota burn in view so a wasteful session
// or a burst of subagents shows up while it happens, not when the limit hits
// (config-hygiene-edho-ferdian references/harness-operation.md §5).
//
// Prints one line, each part only when its data exists:
//   5h 23% ↺14:00 · 7d 41% · ctx 8% · agents 2 · $0.12
// 5h/7d are the claude.ai plan windows (rate_limits, Pro/Max only, after the
// first response); ctx is context_window.used_percentage; agents counts this
// session's finished subagents in the telemetry log written by
// log-subagent-run.js (shown only when that hook is installed and fired);
// $ is cost.total_cost_usd, an estimate at list price, not a bill.
// Percentages turn yellow at 50 and red at 80.
//
// Reads only stdin and the local telemetry log; sends nothing anywhere.
// Fails quiet: any error prints an empty line rather than breaking the UI.
//
// Install: copy to ~/.claude/hooks/ and set in settings.json
//   "statusLine": { "type": "command", "command": "node <path-to-this-file>" }
// (forward slashes on Windows — Git Bash eats backslashes).

const fs = require("fs");
const os = require("os");
const path = require("path");

const LOG_PATH = process.env.EEF_SUBAGENT_LOG || path.join(os.homedir(), ".claude", "eef", "subagent-runs.jsonl");
const TAIL_BYTES = 512 * 1024;
const COLOR = !process.env.NO_COLOR;

const paint = (pct, text) => {
  if (!COLOR) return text;
  const code = pct >= 80 ? 31 : pct >= 50 ? 33 : 32;
  return `\x1b[${code}m${text}\x1b[0m`;
};

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

function percent(label, pct) {
  return isNum(pct) ? paint(pct, `${label} ${Math.round(pct)}%`) : null;
}

function resetClock(epochSeconds) {
  if (!isNum(epochSeconds)) return "";
  const d = new Date(epochSeconds * 1000);
  return ` ↺${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Finished subagents this session, from the tail of the telemetry log. */
function subagentCount(sessionId) {
  if (!sessionId || !fs.existsSync(LOG_PATH)) return null;
  const { size } = fs.statSync(LOG_PATH);
  const fd = fs.openSync(LOG_PATH, "r");
  try {
    const length = Math.min(size, TAIL_BYTES);
    const buf = Buffer.alloc(length);
    fs.readSync(fd, buf, 0, length, size - length);
    const needle = `"session_id":"${sessionId}"`;
    return buf.toString("utf8").split("\n").filter((line) => line.includes(needle)).length;
  } finally {
    fs.closeSync(fd);
  }
}

function render(input) {
  const limits = input.rate_limits || {};
  const five = limits.five_hour || {};
  const week = limits.seven_day || {};
  const spend = limits.spend_limit || {};
  const agents = subagentCount(input.session_id);
  const cost = input.cost && input.cost.total_cost_usd;
  const parts = [
    isNum(five.used_percentage) ? percent("5h", five.used_percentage) + resetClock(five.resets_at) : null,
    percent("7d", week.used_percentage),
    percent("spend", spend.used_percentage),
    percent("ctx", input.context_window && input.context_window.used_percentage),
    agents ? `agents ${agents}` : null,
    isNum(cost) ? `$${cost.toFixed(2)}` : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let line = "";
  try {
    line = render(JSON.parse(raw));
  } catch {
    // fail quiet
  }
  process.stdout.write(line + "\n");
});
