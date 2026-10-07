#!/usr/bin/env node
// Summarize the SubagentStop telemetry written by hooks/log-subagent-run.js
// into per-agent evidence for re-tiering (harness-operation.md §4.4).
//
// For each agent: runs, the models it actually ran on, median tokens and
// duration, how often it ran on a stronger model than its installed
// default (an orchestrator escalation, §4.2), and how often it was re-run
// in the same session. A suggestion is printed only past MIN_RUNS — a
// handful of runs is anecdote, not evidence.
//
// The suggestion is a prompt for a human decision, never an automatic
// change: lowering a tier is only safe when the agent's mistakes are loud
// (§4), and no log can tell loud from quiet — so a deep (top-model) agent
// is never suggested for lowering at all.
//
// Usage:
//   node subagent-report.js                 # all runs, EEF agents only
//   node subagent-report.js --days 30       # only the last 30 days
//   node subagent-report.js --all-agents    # include non-EEF agents
//   node subagent-report.js --json          # machine-readable output
//
// Env: EEF_SUBAGENT_LOG (log path), CLAUDE_AGENTS_DIR (installed agents,
// read for each agent's default model; default ~/.claude/agents).

const fs = require("fs");
const os = require("os");
const path = require("path");

const LOG_PATH = process.env.EEF_SUBAGENT_LOG || path.join(os.homedir(), ".claude", "eef", "subagent-runs.jsonl");
const AGENTS_DIR = process.env.CLAUDE_AGENTS_DIR || path.join(os.homedir(), ".claude", "agents");
const MIN_RUNS = 5;
const RAISE_AT = 0.3; // escalated or re-run in >= 30% of runs
const LOWER_MIN_RUNS = 10;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const daysIdx = args.indexOf("--days");
const days = daysIdx !== -1 ? Number(args[daysIdx + 1]) : null;

// Coarse capability order; unknown model names rank null and are never
// counted as an escalation.
function modelRank(model) {
  const m = String(model || "").toLowerCase();
  if (/fable|mythos/.test(m)) return 3;
  if (/opus/.test(m)) return 2;
  if (/sonnet/.test(m)) return 1;
  if (/haiku/.test(m)) return 0;
  return null;
}

function installedModel(agent) {
  try {
    const content = fs.readFileSync(path.join(AGENTS_DIR, `${agent}.md`), "utf8");
    const fm = content.split(/\r?\n---/, 1)[0];
    const m = fm.match(/^model:\s*(.+?)\s*$/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function median(values) {
  const v = values.filter((x) => typeof x === "number").sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function readRuns() {
  if (!fs.existsSync(LOG_PATH)) return null;
  const cutoff = days ? Date.now() - days * 86400000 : null;
  return fs
    .readFileSync(LOG_PATH, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((r) => r && r.agent_type)
    .filter((r) => !cutoff || Date.parse(r.ts) >= cutoff)
    .filter((r) => flag("--all-agents") || r.agent_type.endsWith("-edho-ferdian"));
}

function summarize(agent, runs) {
  const expected = installedModel(agent);
  const expectedRank = modelRank(expected);
  const models = {};
  for (const r of runs) models[r.model || "unknown"] = (models[r.model || "unknown"] || 0) + 1;
  const escalated = runs.filter((r) => expectedRank !== null && modelRank(r.model) > expectedRank).length;
  const perSession = {};
  for (const r of runs) perSession[r.session_id] = (perSession[r.session_id] || 0) + 1;
  const reruns = Object.values(perSession).reduce((sum, n) => sum + Math.max(0, n - 1), 0);
  const n = runs.length;

  let suggestion = "not enough runs yet";
  if (n >= MIN_RUNS) {
    if (escalated / n >= RAISE_AT || reruns / n >= RAISE_AT) {
      suggestion = "consider raising one tier (often escalated or re-run)";
    } else if (n >= LOWER_MIN_RUNS && escalated === 0 && reruns === 0 && expectedRank === 1) {
      // Only standard -> light. A deep agent is deep *because* its
      // mistakes are quiet, and a clean log is exactly what quiet
      // mistakes look like — so no run count argues it down.
      suggestion = "candidate to try one tier lower — only if its mistakes are loud";
    } else {
      suggestion = "keep";
    }
  }
  return {
    agent,
    runs: n,
    installed_model: expected,
    models,
    median_tokens: median(runs.map((r) => r.tokens)),
    median_duration_s: median(runs.map((r) => r.duration_s)),
    escalated,
    reruns,
    suggestion,
  };
}

function main() {
  const runs = readRuns();
  if (runs === null) {
    console.log(`No telemetry yet: ${LOG_PATH} does not exist. Install hooks/log-subagent-run.js first.`);
    return;
  }
  const byAgent = {};
  for (const r of runs) (byAgent[r.agent_type] = byAgent[r.agent_type] || []).push(r);
  const rows = Object.keys(byAgent)
    .sort()
    .map((agent) => summarize(agent, byAgent[agent]));

  if (flag("--json")) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  console.log(`${runs.length} subagent run(s) from ${LOG_PATH}${days ? ` (last ${days} days)` : ""}\n`);
  for (const r of rows) {
    const models = Object.entries(r.models)
      .map(([m, c]) => `${m}×${c}`)
      .join(", ");
    console.log(`${r.agent}`);
    console.log(`  runs ${r.runs} · installed ${r.installed_model || "?"} · ran on ${models}`);
    console.log(`  median ${r.median_tokens ?? "?"} tokens, ${r.median_duration_s ?? "?"}s · escalated ${r.escalated} · re-run ${r.reruns}`);
    console.log(`  -> ${r.suggestion}\n`);
  }
}

main();
