#!/usr/bin/env node
// Claude Code SessionStart hook (plugin installs) — loads EEF's always-on
// rules into the session.
//
// Why: a plugin can ship skills, agents and hooks, but not always-on
// instructions — a CLAUDE.md inside a plugin is not loaded
// (code.claude.com/docs/en/plugins-reference, checked 2026-11-19). eef-install
// copies rules/*.md to ~/.claude/rules/eef/ instead; the plugin gets the same
// text through this hook's additionalContext (cap 10,000 chars).
//
// Silent when ~/.claude/rules/eef/ already holds the rules (eef-install
// path), so the rules never load twice. Fails open.
//
// Env: CLAUDE_RULES_DIR (installed rules; default ~/.claude/rules/eef),
// EEF_RULES_SRC (rules to inject; default <plugin root>/rules).

const fs = require("fs");
const os = require("os");
const path = require("path");

const MAX_CHARS = 9500;
const INSTALLED = process.env.CLAUDE_RULES_DIR || path.join(os.homedir(), ".claude", "rules", "eef");
const SOURCE =
  process.env.EEF_RULES_SRC ||
  (process.env.CLAUDE_PLUGIN_ROOT ? path.join(process.env.CLAUDE_PLUGIN_ROOT, "rules") : path.join(__dirname, "..", "..", "..", "rules"));

const mdFiles = (dir) => {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
  } catch {
    return [];
  }
};

function rulesText() {
  if (mdFiles(INSTALLED).length) return "";
  const parts = mdFiles(SOURCE).map((f) => fs.readFileSync(path.join(SOURCE, f), "utf8").trim());
  const text = parts.join("\n\n");
  return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
}

module.exports = { rulesText };

if (require.main === module) {
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  try {
    const input = raw.trim() ? JSON.parse(raw) : {};
    if (input.hook_event_name && input.hook_event_name !== "SessionStart") return;
    const text = rulesText();
    if (!text) return;
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: `EEF always-on rules (from the ekosistem-edho-ferdian plugin):\n\n${text}`,
        },
      })
    );
  } catch {
    // fail open
  }
});
}
