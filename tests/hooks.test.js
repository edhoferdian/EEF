// Decision tables for the Claude Code hooks this package ships. Each case
// pipes a hook payload through the real hook file, the way Claude Code does.
// Run: node --test tests/
const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SKILLS = path.join(__dirname, "..", "skills");
const GUARD = path.join(SKILLS, "safe-execution-edho-ferdian", "hooks", "block-fs-wide-search.js");
const STATUSLINE = path.join(SKILLS, "config-hygiene-edho-ferdian", "hooks", "statusline-usage.js");
const TELEMETRY = path.join(SKILLS, "config-hygiene-edho-ferdian", "hooks", "log-subagent-run.js");

const run = (hook, input, env = {}) =>
  execFileSync("node", [hook], { input, env: { ...process.env, ...env } }).toString();

function guardDecision(tool, command) {
  const out = run(GUARD, JSON.stringify({ tool_name: tool, tool_input: { command } }));
  return out ? JSON.parse(out).hookSpecificOutput.permissionDecision : "allow";
}

const GUARD_CASES = [
  ["deny", "Bash", "find / -name SKILL.md"],
  ["deny", "PowerShell", "Get-ChildItem -Recurse C:\\ -Filter x"],
  ["ask", "Bash", "rm -rf build"],
  ["ask", "Bash", "rm -r dist"],
  ["ask", "Bash", "sudo rm -fR /var/x"],
  ["ask", "Bash", "cd src && git reset --hard HEAD~1"],
  ["ask", "Bash", "git push --force origin main"],
  ["ask", "Bash", "git push -f"],
  ["ask", "Bash", "git push --force-with-lease"],
  ["ask", "Bash", "git checkout ."],
  ["ask", "Bash", "git restore ."],
  ["ask", "Bash", "git clean -fd"],
  ["ask", "Bash", "git commit --no-verify -m x"],
  ["ask", "Bash", 'psql -c "DROP TABLE users"'],
  ["ask", "Bash", "docker system prune -af"],
  ["ask", "Bash", "kubectl delete pod x"],
  ["ask", "Bash", "chmod -R 777 ."],
  ["ask", "Bash", "npm publish"],
  ["ask", "Bash", 'bash -c "rm -rf /tmp/x"'],
  ["ask", "PowerShell", "Remove-Item -Path .\\dist -Recurse -Force"],
  ["ask", "PowerShell", "Get-ChildItem *.log | Remove-Item -Recurse"],
  ["ask", "PowerShell", "rm -r node_modules"],
  ["ask", "PowerShell", "ri x -rec"],
  ["ask", "PowerShell", "cmd /c rd /s /q build"],
  ["ask", "PowerShell", "del /s *.tmp"],
  ["ask", "PowerShell", "Format-Volume -DriveLetter D"],
  ["ask", "PowerShell", "& git reset --hard"],
  ["ask", "PowerShell", 'pwsh -Command "Remove-Item x -Recurse"'],
  ["allow", "PowerShell", "Remove-Item .\\a.txt -Force"],
  ["allow", "Bash", "rm file.txt"],
  ["allow", "Bash", "rm -f file.txt"],
  ["allow", "Bash", "git reset HEAD~1"],
  ["allow", "Bash", "git push origin feature"],
  ["allow", "Bash", "git checkout main"],
  ["allow", "Bash", "git clean -n"],
  ["allow", "Bash", "find . -name x"],
  ["allow", "Bash", "docker system df"],
  ["allow", "Bash", "kubectl get pods"],
  ["allow", "Bash", "chmod 755 run.sh"],
  ["allow", "Bash", "npm test"],
  ["allow", "Bash", "grep -r drop src"],
  ["allow", "PowerShell", "Get-ChildItem -Recurse .\\src"],
];

for (const [want, tool, command] of GUARD_CASES) {
  test(`fs-guard ${want}: [${tool}] ${command}`, () => {
    assert.strictEqual(guardDecision(tool, command), want);
  });
}

test("fs-guard fails open on unparsable input", () => {
  assert.strictEqual(run(GUARD, "{ not json"), "");
});

test("statusline renders only the parts it has data for", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eef-sl-"));
  const log = path.join(dir, "runs.jsonl");
  fs.writeFileSync(log, ['{"session_id":"s1"}', '{"session_id":"s1"}', '{"session_id":"s2"}'].join("\n") + "\n");
  const env = { NO_COLOR: "1", EEF_SUBAGENT_LOG: log };
  const full = run(STATUSLINE, JSON.stringify({
    session_id: "s1",
    rate_limits: { five_hour: { used_percentage: 23.5 }, seven_day: { used_percentage: 41 } },
    context_window: { used_percentage: 8 },
    cost: { total_cost_usd: 0.1234 },
  }), env);
  assert.strictEqual(full, "5h 24% · 7d 41% · ctx 8% · agents 2 · $0.12\n");
  assert.strictEqual(run(STATUSLINE, JSON.stringify({ session_id: "zz", context_window: { used_percentage: null } }), env), "\n");
  assert.strictEqual(run(STATUSLINE, "garbage", env), "\n");
});

test("telemetry records agent type, model, duration and tokens", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eef-tel-"));
  const log = path.join(dir, "runs.jsonl");
  run(TELEMETRY, JSON.stringify(require("./fixtures/agent-post-tool-use.json")), { EEF_SUBAGENT_LOG: log });
  const record = JSON.parse(fs.readFileSync(log, "utf8").trim());
  assert.deepStrictEqual(
    { ...record, ts: undefined },
    {
      ts: undefined, session_id: "s1", agent_id: "a4d2c8f1e0b3a297", agent_type: "Explore",
      status: "completed", model: "claude-haiku-5-5", duration_s: 48.2, tool_uses: 7,
      tokens: 12450, reply_chars: 21, project: "demo",
    }
  );
});

test("telemetry ignores a leftover SubagentStop registration", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eef-tel-"));
  const log = path.join(dir, "runs.jsonl");
  run(TELEMETRY, JSON.stringify({ hook_event_name: "SubagentStop", session_id: "s1", agent_id: "x" }), { EEF_SUBAGENT_LOG: log });
  assert.strictEqual(fs.existsSync(log), false);
});
