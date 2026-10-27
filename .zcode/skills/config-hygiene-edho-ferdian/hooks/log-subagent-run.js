#!/usr/bin/env node
// Claude Code PostToolUse hook on the Agent tool — telemetry for re-tiering
// agents from evidence instead of guesswork (config-hygiene-edho-ferdian
// references/harness-operation.md §4.4, D-060).
//
// Appends one JSON line per subagent run: when, which agent, which model it
// actually ran on, how long, how many tool calls, the final request's
// tokens. Never the prompt or the subagent's reply — only their size — so
// the log holds no project content. The file stays on this machine; nothing
// is sent anywhere.
//
// Why PostToolUse and not SubagentStop: SubagentStop carries no model,
// duration or usage (code.claude.com/docs/en/hooks, checked 2026-10-27), so
// every record it produced had those fields null. The Agent tool's
// tool_response has them for a foreground run; a background launch
// (status "async_launched") is logged with its model and no usage yet.
// An older SubagentStop registration is ignored here, so upgrading never
// double-counts a run.
//
// `tokens` is totalTokens: the subagent's final API request only, not the
// whole run — comparable between runs of one agent, not a cost figure.
//
// Log: ~/.claude/eef/subagent-runs.jsonl (override with EEF_SUBAGENT_LOG).
// Read it with scripts/subagent-report.js in this skill.
//
// Fails open: unparsable input or any write error is ignored — telemetry
// must never disturb the session it observes.
//
// Install: copy to ~/.claude/hooks/ and register under hooks.PostToolUse
// with matcher "Agent" and command `node <path-to-this-file>`.

const fs = require("fs");
const os = require("os");
const path = require("path");

const LOG_PATH = process.env.EEF_SUBAGENT_LOG || path.join(os.homedir(), ".claude", "eef", "subagent-runs.jsonl");

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function replyChars(content) {
  if (!Array.isArray(content)) return null;
  return content.reduce((sum, block) => sum + (block && typeof block.text === "string" ? block.text.length : 0), 0);
}

function toRecord(input) {
  const req = input.tool_input || {};
  const res = input.tool_response || {};
  const durationMs = num(res.totalDurationMs);
  return {
    ts: new Date().toISOString(),
    session_id: input.session_id || null,
    agent_id: res.agentId || null,
    agent_type: req.subagent_type || "general-purpose",
    status: res.status || null,
    model: res.resolvedModel || null,
    duration_s: durationMs === null ? null : Math.round(durationMs / 100) / 10,
    tool_uses: num(res.totalToolUseCount),
    tokens: num(res.totalTokens),
    reply_chars: replyChars(res.content),
    project: input.cwd ? path.basename(input.cwd) : null,
  };
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(raw);
    if (input.hook_event_name !== "PostToolUse" || !/^(Agent|Task)$/.test(input.tool_name || "")) return;
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify(toRecord(input)) + "\n", "utf8");
  } catch {
    // fail open
  }
});
