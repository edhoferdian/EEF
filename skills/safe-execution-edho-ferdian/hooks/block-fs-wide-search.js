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
// Also the mechanical form of Gate 2's destructive-command list: `rm -r`,
// `Remove-Item -Recurse` (and its aliases), `rd /s`, `git reset --hard`,
// `git push --force`, `git checkout .`, `git clean -f`, `DROP TABLE`,
// `docker system prune`, `kubectl delete`, `chmod 777`, `npm publish`,
// `Format-Volume` and anything carrying `--no-verify`. Those are not denied
// but escalated to "ask": the user must confirm, even in auto mode. Quotes
// split segments too, so `bash -c "rm -rf x"` and `pwsh -c "..."` are seen;
// the cost is an occasional prompt for a commit message that names one.
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

const has = (args, re) => args.some((a) => re.test(a));
// POSIX short-flag bundles (-r, -rf, -fR) use only rm's own letters, so
// PowerShell's -Force never reads as one; -rec… is -Recurse by prefix.
const RECURSE_FLAG = /^(-[fivd]*r[fivdr]*|--recursive|-rec(u(r(s(e)?)?)?)?)$/i;
const remove = (args) => has(args, RECURSE_FLAG);
const removeCmd = (args) => has(args, /^\/s$/i);

// Per-tool: is this segment destructive? Args are lower-cased.
const DESTRUCTIVE = {
  rm: remove, "remove-item": remove, ri: remove, del: (a) => remove(a) || removeCmd(a),
  erase: (a) => remove(a) || removeCmd(a), rd: (a) => remove(a) || removeCmd(a),
  rmdir: (a) => remove(a) || removeCmd(a),
  git: ([sub, ...rest]) =>
    (sub === "reset" && rest.includes("--hard")) ||
    (sub === "push" && has(rest, /^(-f|--force|--force-with-lease(=.*)?|\+.+)$/)) ||
    ((sub === "checkout" || sub === "restore") && rest.includes(".")) ||
    (sub === "clean" && has(rest, /^(-[a-z]*f|--force)/)),
  docker: ([sub, verb]) => sub === "system" && verb === "prune",
  kubectl: ([sub]) => sub === "delete",
  chmod: (args) => args.includes("777"),
  npm: ([sub]) => sub === "publish",
  "format-volume": () => true,
  "clear-disk": () => true,
  "clear-recyclebin": () => true,
};

function destructiveSegment(command) {
  if (/\bdrop\s+(table|database|schema)\b/i.test(command)) return command.trim();
  for (const segment of command.split(/&&|\|\||[;|\n"'`]/)) {
    let tokens = segment.trim().split(/\s+/).filter(Boolean).map((t) => t.toLowerCase());
    while (tokens.length && /^(sudo|env|command|time|nohup|&|[a-z_]+=\S*)$/.test(tokens[0])) tokens.shift();
    if (/^cmd(\.exe)?$/.test(tokens[0]) && /^\/[ck]$/.test(tokens[1])) tokens = tokens.slice(2); // unquoted `cmd /c rd /s x`
    if (!tokens.length) continue;
    if (tokens.includes("--no-verify")) return segment.trim();
    const tool = tokens[0].replace(/^.*[\\/]/, "").replace(/\.exe$/, "");
    const check = DESTRUCTIVE[tool];
    if (check && check(tokens.slice(1))) return segment.trim();
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
    if (!hit) {
      const destructive = destructiveSegment(command);
      if (!destructive) return process.exit(0);
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "ask",
          permissionDecisionReason:
            `Gate 2 — destructive command: \`${destructive}\`. ` +
            "Approve only if Claude has said what this modifies or deletes and how to roll it back.",
        },
      }));
      return process.exit(0);
    }
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
