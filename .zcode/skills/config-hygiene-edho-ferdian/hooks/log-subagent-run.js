#!/usr/bin/env node
// Claude Code SubagentStop hook — telemetry for re-tiering agents from
// evidence instead of guesswork (config-hygiene-edho-ferdian
// references/harness-operation.md §4.4, D-060).
//
// Appends one JSON line per finished subagent: when, which agent, which
// model it actually ran on, how long, how many tokens. Never the prompt or
// the subagent's reply — only their size — so the log holds no project
// content. The file stays on this machine; nothing is sent anywhere.
//
// Log: ~/.claude/eef/subagent-runs.jsonl (override with EEF_SUBAGENT_LOG).
// Read it with scripts/subagent-report.js in this skill.
//
// Fails open: unparsable input or any write error is ignored — telemetry
// must never disturb the session it observes (SubagentStop cannot block
// anyway).
//
// Install: copy to ~/.claude/hooks/ and register under hooks.SubagentStop
// (no matcher = every agent) with command `node <path-to-this-file>`.

const fs = require("fs");
const os = require("os");
const path = require("path");

const LOG_PATH = process.env.EEF_SUBAGENT_LOG || path.join(os.homedir(), ".claude", "eef", "subagent-runs.jsonl");

function toRecord(input) {
  return {
    ts: new Date().toISOString(),
    session_id: input.session_id || null,
    agent_id: input.agent_id || null,
    agent_type: input.agent_type || null,
    model: input.model || null,
    duration_s: typeof input.duration === "number" ? input.duration : null,
    tokens: input.usage && typeof input.usage.tokens === "number" ? input.usage.tokens : null,
    reply_chars: typeof input.last_assistant_message === "string" ? input.last_assistant_message.length : null,
    project: input.cwd ? path.basename(input.cwd) : null,
  };
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(raw);
    if (input.hook_event_name && input.hook_event_name !== "SubagentStop") return;
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify(toRecord(input)) + "\n", "utf8");
  } catch {
    // fail open
  }
});
