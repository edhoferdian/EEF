#!/usr/bin/env node
// Claude Code PostToolUse hook on the Skill tool — logs which skill loaded,
// so a skill that never fires shows up as a zero instead of going unnoticed.
//
// Appends one JSON line per Skill call: when, session, which skill, which
// project folder. Never the prompt or the skill's content. The file stays on
// this machine; nothing is sent anywhere. The Skill tool's input carries the
// skill name as `skill` (confirmed from local session transcripts,
// 2026-11-19).
//
// Log: ~/.claude/eef/skill-runs.jsonl (override with EEF_SKILL_LOG).
// Read it with `eef-install stats --skills` (scripts/skill-report.js).
//
// Fails open: unparsable input or any write error is ignored.
//
// Install: `npx eef-install --target claude-hooks --only skill-telemetry`.

const fs = require("fs");
const os = require("os");
const path = require("path");

const LOG_PATH = process.env.EEF_SKILL_LOG || path.join(os.homedir(), ".claude", "eef", "skill-runs.jsonl");

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(raw);
    if (input.hook_event_name !== "PostToolUse" || input.tool_name !== "Skill") return;
    const skill = input.tool_input && typeof input.tool_input.skill === "string" ? input.tool_input.skill : null;
    if (!skill) return;
    const record = {
      ts: new Date().toISOString(),
      session_id: input.session_id || null,
      skill,
      project: input.cwd ? path.basename(input.cwd) : null,
    };
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify(record) + "\n", "utf8");
  } catch {
    // fail open
  }
});
