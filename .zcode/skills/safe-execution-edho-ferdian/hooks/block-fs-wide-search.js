#!/usr/bin/env node
// Claude Code PreToolUse hook (Bash + PowerShell) — Gate 2 of
// safe-execution-edho-ferdian, mechanical form of its "runaway search" rule.
//
// Denies a recursive search whose starting point is a filesystem root, a
// drive root, or the home directory (`find /`, `find ~`, `rg x /`,
// `Get-ChildItem -Recurse C:\`, `dir /s C:\`, `where /r C:\`). On Windows such
// a scan runs for hours and outlives the tool call as an orphaned process
// (2026-09-24: up to six find.exe processes hunting for a SKILL.md, some
// alive for 10 hours). Scoped searches (`find .`, `find ~/.claude/skills`,
// `rg x src/`) pass untouched.
//
// Fails open: unparsable input or any internal error allows the command.
//
// Install: copy to ~/.claude/hooks/ and register under hooks.PreToolUse with
// matcher "Bash|PowerShell" and command `node <path-to-this-file>`.

const os = require("os");

function normalize(token) {
  let t = token.trim().replace(/^["']|["']$/g, "").replace(/\\/g, "/").toLowerCase();
  const drive = t.match(/^([a-z]):(\/.*)?$/);
  if (drive) t = "/" + drive[1] + (drive[2] || "");
  if (t.length > 1) t = t.replace(/\/+$/, "");
  return t;
}

const home = normalize(os.homedir());
const ROOTS = new Set([
  "/", "~", "$home", "${home}", "$env:userprofile", "%userprofile%", "$env:systemdrive", "%systemdrive%",
  home, home.replace(/\/[^/]+$/, ""), // C:\Users\<name> and C:\Users
]);
const isRoot = (tok) => {
  const n = normalize(tok);
  return ROOTS.has(n) || /^\/[a-z]$/.test(n); // bare drive: C:, C:\, /c
};

// Per-tool: is this segment a recursive search at all?
const RECURSIVE = {
  find: () => true,
  fd: () => true,
  rg: () => true,
  grep: (args) => args.some((a) => /^-[a-zA-Z]*[rR]/.test(a) || a === "--recursive"),
  "get-childitem": (args) => args.some((a) => /^-r(ecurse)?$/i.test(a)),
  gci: (args) => args.some((a) => /^-r(ecurse)?$/i.test(a)),
  ls: (args) => args.some((a) => /^-r(ecurse)?$/i.test(a) || /^-[a-zA-Z]*R/.test(a)),
  dir: (args) => args.some((a) => /^\/s$/i.test(a) || /^-r(ecurse)?$/i.test(a)),
  where: (args) => args.some((a) => /^\/r$/i.test(a)),
};

function offendingSegment(command) {
  for (const segment of command.split(/&&|\|\||[;|\n]/)) {
    let tokens = segment.trim().split(/\s+/).filter(Boolean);
    while (tokens.length && /^(sudo|env|command|time|nohup|[A-Za-z_]+=\S*)$/.test(tokens[0])) tokens.shift();
    if (!tokens.length) continue;
    const tool = tokens[0].replace(/^.*[\\/]/, "").toLowerCase().replace(/\.exe$/, "");
    const args = tokens.slice(1);
    const recursive = RECURSIVE[tool];
    if (!recursive || !recursive(args)) continue;
    // -Path / --search-path style values count as starting points too.
    if (args.some((a) => isRoot(a.replace(/^-(path|literalpath)[:=]?/i, "")))) return segment.trim();
  }
  return null;
}

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(raw);
    const command = (input.tool_input && input.tool_input.command) || "";
    const hit = offendingSegment(command);
    if (!hit) return process.exit(0);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          `Blocked a recursive search from a filesystem/drive/home root: \`${hit}\`. ` +
          "On this machine that scans the whole drive for hours and leaves orphaned processes. " +
          "Search a known directory instead (the project, or ~/.claude/skills/<name>/ for a skill). " +
          "If the thing you are looking for has no known location, stop and ask the user.",
      },
    }));
  } catch (_) {
    // fail open
  }
  process.exit(0);
});
