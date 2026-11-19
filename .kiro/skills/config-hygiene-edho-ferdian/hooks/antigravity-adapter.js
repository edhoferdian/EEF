#!/usr/bin/env node
// Antigravity hook adapter — runs EEF's Claude Code hook logic under
// Antigravity's hook protocol (antigravity.google/docs/hooks, checked
// 2026-11-19).
//
// Antigravity's protocol differs from Claude Code's:
//   events     SessionStart, PreInvocation (before each model call, carries
//              lastUserInput), PreToolUse, PostToolUse, Stop
//   stdin      camelCase: conversationId, lastUserInput, toolCall.{name,args}
//   context    stdout {"injectSteps":[{"systemMessage"|"ephemeralMessage": "…"}]}
//              — only SessionStart / PreInvocation / PostInvocation accept it
//   blocking   PreToolUse stdout {"decision":"deny"|"ask", "reason": "…"}
//   tools      run_command (shell); write_to_file, replace_file_content,
//              multi_replace_file_content (edits)
//
// Usage (registered by `eef-install --target antigravity-hooks`):
//   node antigravity-adapter.js session-start   (SessionStart: always-on rules)
//   node antigravity-adapter.js prompt          (PreInvocation: skill router + pending handoffs)
//   node antigravity-adapter.js shell           (PreToolUse run_command: fs-guard)
//   node antigravity-adapter.js edit            (PreToolUse edits: skill-guard, delivered at the next PreInvocation)
//
// Fails open: any error prints nothing and exits 0.

const fs = require("fs");
const os = require("os");
const path = require("path");

const HERE = __dirname;
const STATE_DIR = process.env.EEF_AG_STATE || path.join(os.homedir(), ".gemini", "config", "eef-state");
const SKILLS_DIR = process.env.EEF_AG_SKILLS || path.join(os.homedir(), ".gemini", "config", "skills");
const RULES_DIR = process.env.EEF_AG_RULES || path.join(HERE, "rules");

// The Claude Code modules read these at require time.
process.env.CLAUDE_SKILLS_DIR = SKILLS_DIR;
process.env.CLAUDE_RULES_DIR = path.join(STATE_DIR, "no-claude-rules"); // never "already installed" here
process.env.EEF_RULES_SRC = RULES_DIR;
delete process.env.CLAUDE_PLUGIN_ROOT;

const statePath = (conversationId, kind) =>
  path.join(STATE_DIR, `${String(conversationId || "none").replace(/[^\w-]/g, "_")}.${kind}.json`);

function readState(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeState(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

// Tool args are not documented field by field; find the value by shape.
function stringsIn(args) {
  const out = [];
  const walk = (v) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(args);
  return out;
}

function commandOf(args) {
  if (args && typeof args === "object") {
    for (const [k, v] of Object.entries(args)) if (/command/i.test(k) && typeof v === "string") return v;
  }
  return stringsIn(args)[0] || "";
}

function filesOf(args) {
  if (args && typeof args === "object") {
    const keyed = Object.entries(args)
      .filter(([k, v]) => /file|path|target/i.test(k) && typeof v === "string")
      .map(([, v]) => v);
    if (keyed.length) return keyed;
  }
  return stringsIn(args).filter((s) => /[\\/]/.test(s) && /\.[A-Za-z0-9]{1,8}$/.test(s) && !/\s/.test(s));
}

const inject = (message, kind = "ephemeralMessage") => ({ injectSteps: [{ [kind]: message }] });

function handle(mode, input) {
  if (mode === "session-start") {
    const { rulesText } = require(path.join(HERE, "inject-rules.js"));
    const text = rulesText();
    return text ? inject(`EEF always-on rules:\n\n${text}`, "systemMessage") : null;
  }

  if (mode === "prompt") {
    const messages = [];
    const seenFile = statePath(input.conversationId, "prompt");
    const seen = readState(seenFile, { last: null });
    const prompt = input.lastUserInput || "";
    // PreInvocation fires before every model call; route once per new user input.
    if (prompt && prompt !== seen.last) {
      const { suggestions } = require(path.join(HERE, "suggest-skill.js"));
      const skills = suggestions(prompt);
      if (skills.length) {
        messages.push(
          `EEF skill match for this request: ${skills.join(", ")}. Read that skill's SKILL.md (in ${SKILLS_DIR}) before starting, unless it clearly doesn't fit.`
        );
      }
      writeState(seenFile, { last: prompt });
    }
    const pendingFile = statePath(input.conversationId, "pending");
    const pending = readState(pendingFile, []);
    if (pending.length) {
      messages.push(...pending);
      writeState(pendingFile, []);
    }
    return messages.length ? inject(messages.join("\n")) : null;
  }

  if (mode === "shell") {
    // Installed copies sit side by side; in the repo, fs-guard lives in safe-execution.
    const flat = path.join(HERE, "block-fs-wide-search.js");
    const guardPath = fs.existsSync(flat) ? flat : path.join(HERE, "..", "..", "safe-execution-edho-ferdian", "hooks", "block-fs-wide-search.js");
    const { offendingSegment, destructiveSegment } = require(guardPath);
    const command = commandOf(input.toolCall && input.toolCall.args);
    const hit = offendingSegment(command);
    if (hit) {
      return {
        decision: "deny",
        reason: `Blocked a recursive search from a filesystem/drive/home root: \`${hit}\`. Search a known directory instead (the project, or the skills folder).`,
      };
    }
    const destructive = destructiveSegment(command);
    if (destructive) {
      return {
        decision: "ask",
        reason: `Destructive command: \`${destructive}\`. Approve only after the agent has said what it deletes or rewrites and how to roll it back.`,
      };
    }
    return null;
  }

  if (mode === "edit") {
    const { owners } = require(path.join(HERE, "skill-guard.js"));
    const remindedFile = statePath(input.conversationId, "reminded");
    const reminded = new Set(readState(remindedFile, []));
    const due = [];
    for (const file of filesOf(input.toolCall && input.toolCall.args)) {
      for (const { skill, what } of owners(file)) {
        if (reminded.has(skill) || !fs.existsSync(path.join(SKILLS_DIR, skill, "SKILL.md"))) continue;
        reminded.add(skill);
        due.push(`EEF handoff: ${path.basename(file)} is ${what}, owned by ${skill}. Read its SKILL.md and apply it to this change.`);
      }
    }
    if (due.length) {
      writeState(remindedFile, [...reminded]);
      const pendingFile = statePath(input.conversationId, "pending");
      writeState(pendingFile, [...readState(pendingFile, []), ...due]);
    }
    return null; // PreToolUse can't inject context; the next PreInvocation delivers it
  }

  return null;
}

if (require.main === module) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (raw += chunk));
  process.stdin.on("end", () => {
    try {
      const out = handle(process.argv[2], raw.trim() ? JSON.parse(raw) : {});
      if (out) process.stdout.write(JSON.stringify(out));
    } catch {
      // fail open
    }
  });
}

module.exports = { handle, commandOf, filesOf };
