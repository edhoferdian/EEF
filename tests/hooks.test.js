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
  // A backslash inside a quoted pattern is not the Windows root `\`.
  ["allow", "Bash", 'grep -rn -i "jq \\|json.load" skills'],
  ["allow", "Bash", "grep -rn 'a \\| b' src"],
  ["allow", "Bash", 'rg "foo \\ bar" src'],
  ["deny", "Bash", 'grep -rn "jq \\|json.load" /'],
  ["deny", "PowerShell", 'Get-ChildItem -Recurse "C:\\" -Filter x'],
  ["deny", "Bash", "cd src && find ~ -name x"],
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

const ROUTER = path.join(SKILLS, "config-hygiene-edho-ferdian", "hooks", "suggest-skill.js");
const SKILL_LOG = path.join(SKILLS, "config-hygiene-edho-ferdian", "hooks", "log-skill-use.js");

function routerFor(prompt, installed = ["design-engineering-edho-ferdian", "frontend-engineering-edho-ferdian", "build-fix-edho-ferdian"]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eef-router-"));
  for (const name of installed) {
    fs.mkdirSync(path.join(dir, name));
    fs.writeFileSync(path.join(dir, name, "SKILL.md"), "---\nname: x\n---\n");
  }
  const out = run(ROUTER, JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt }), { CLAUDE_SKILLS_DIR: dir });
  return out ? JSON.parse(out).hookSpecificOutput : null;
}

test("skill-router names installed design skills for a UI prompt", () => {
  const out = routerFor("tolong rapikan tampilan chat-nya ya");
  assert.strictEqual(out.hookEventName, "UserPromptSubmit");
  assert.match(out.additionalContext, /design-engineering-edho-ferdian, frontend-engineering-edho-ferdian/);
});

test("skill-router stays silent when nothing matches, on slash commands, and for uninstalled skills", () => {
  assert.strictEqual(routerFor("berapa jumlah commit minggu ini?"), null);
  assert.strictEqual(routerFor("/design-engineering-edho-ferdian animasikan ini"), null);
  assert.strictEqual(routerFor("buat landing page", []), null);
  assert.strictEqual(run(ROUTER, "{ not json"), "");
});

test("skill-router skips a skill the prompt already names", () => {
  const out = routerFor("pakai design-engineering-edho-ferdian buat animasi tombol");
  assert.match(out.additionalContext, /frontend-engineering-edho-ferdian/);
  assert.doesNotMatch(out.additionalContext, /design-engineering-edho-ferdian,/);
});

test("skill-telemetry logs the skill name and nothing for other tools", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eef-skl-"));
  const log = path.join(dir, "skills.jsonl");
  run(SKILL_LOG, JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Skill", session_id: "s1", cwd: "/x/demo", tool_input: { skill: "design-engineering-edho-ferdian" } }), { EEF_SKILL_LOG: log });
  run(SKILL_LOG, JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "ls" } }), { EEF_SKILL_LOG: log });
  const lines = fs.readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.strictEqual(lines.length, 1);
  assert.deepStrictEqual({ ...lines[0], ts: undefined }, { ts: undefined, session_id: "s1", skill: "design-engineering-edho-ferdian", project: "demo" });
});

const ALL_SKILLS = fs.readdirSync(SKILLS).filter((n) => fs.existsSync(path.join(SKILLS, n, "SKILL.md")));

test("skill-router routes Indonesian prompts to the right skills", () => {
  const cases = [
    ["mulai proyek baru dari PRD ini", "dev-kickoff-edho-ferdian"],
    ["bikin landing page toko kopi", "design-engineering-edho-ferdian"],
    ["kenapa build-nya gagal build terus", "build-fix-edho-ferdian"],
    ["desain arsitektur microservices atau monolith?", "system-design-edho-ferdian"],
    ["tambah endpoint untuk order", "api-design-edho-ferdian"],
  ];
  for (const [prompt, want] of cases) {
    const out = routerFor(prompt, ALL_SKILLS);
    assert.ok(out && out.additionalContext.includes(want), `${prompt} -> ${want}: ${out && out.additionalContext}`);
  }
  // architecture alone must not pull in the UI skills
  const arch = routerFor("desain sistem untuk antrian pembayaran", ALL_SKILLS);
  assert.doesNotMatch(arch.additionalContext, /design-engineering/);
});

const GUARD_HOOK = path.join(SKILLS, "config-hygiene-edho-ferdian", "hooks", "skill-guard.js");

function guardRun(file, { session = "s1", log, state }) {
  const out = run(GUARD_HOOK, JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Edit", session_id: session, tool_input: { file_path: file } }),
    { CLAUDE_SKILLS_DIR: SKILLS, EEF_SKILL_LOG: log, EEF_GUARD_STATE: state });
  return out ? JSON.parse(out).hookSpecificOutput : null;
}

test("skill-guard names the owner skill once per session, and not when it is loaded", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eef-guard-"));
  const log = path.join(dir, "skills.jsonl");
  const state = path.join(dir, "state.jsonl");
  const first = guardRun("C:\\app\\src\\components\\Button.tsx", { log, state });
  assert.strictEqual(first.hookEventName, "PreToolUse");
  assert.strictEqual(first.permissionDecision, undefined);           // never blocks
  assert.match(first.additionalContext, /frontend-engineering-edho-ferdian, design-engineering-edho-ferdian/);
  assert.strictEqual(guardRun("/app/src/components/Card.tsx", { log, state }), null);  // reminded already
  assert.ok(guardRun("/app/src/components/Card.tsx", { session: "s2", log, state }));  // new session
  fs.writeFileSync(log, JSON.stringify({ session_id: "s3", skill: "ekosistem-edho-ferdian:data-layer-patterns-edho-ferdian" }) + "\n");
  assert.strictEqual(guardRun("/app/prisma/schema.prisma", { session: "s3", log, state }), null); // loaded (plugin name)
  assert.match(guardRun("/app/prisma/schema.prisma", { session: "s4", log, state }).additionalContext, /data-layer-patterns/);
  assert.strictEqual(guardRun("/app/notes.txt", { session: "s5", log, state }), null);           // no owner
  assert.strictEqual(run(GUARD_HOOK, "{ not json"), "");
});

test("skill-guard maps file kinds to owner skills", () => {
  const { owners } = require(GUARD_HOOK);
  const of = (f) => owners(f).map((o) => o.skill);
  assert.deepStrictEqual(of("web/Dockerfile"), ["container-ops-edho-ferdian"]);
  assert.deepStrictEqual(of(".github/workflows/ci.yml"), ["deployment-ops-edho-ferdian"]);
  assert.deepStrictEqual(of("db/migrations/001_init.sql"), ["data-layer-patterns-edho-ferdian"]);
  assert.deepStrictEqual(of("src/routes/orders.ts"), ["backend-engineering-edho-ferdian"]);
  assert.deepStrictEqual(of("src/Button.test.tsx"), ["frontend-engineering-edho-ferdian", "design-engineering-edho-ferdian", "test-authoring-edho-ferdian"]);
  assert.deepStrictEqual(of("App/Views/Profile.swift"), ["design-engineering-edho-ferdian"]);
});

const RULES_HOOK = path.join(SKILLS, "config-hygiene-edho-ferdian", "hooks", "inject-rules.js");

test("inject-rules loads the rules only when eef-install hasn't", () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "eef-rules-"));
  const src = path.join(__dirname, "..", "rules");
  const out = JSON.parse(run(RULES_HOOK, JSON.stringify({ hook_event_name: "SessionStart", source: "startup" }),
    { CLAUDE_RULES_DIR: empty, EEF_RULES_SRC: src })).hookSpecificOutput;
  assert.strictEqual(out.hookEventName, "SessionStart");
  assert.match(out.additionalContext, /Reach for the matching skill/);
  assert.ok(out.additionalContext.length < 10000);
  fs.writeFileSync(path.join(empty, "skills.md"), "x");
  assert.strictEqual(run(RULES_HOOK, JSON.stringify({ hook_event_name: "SessionStart" }), { CLAUDE_RULES_DIR: empty, EEF_RULES_SRC: src }), "");
});

test("skill-router has a route to every skill in the repo", () => {
  const { ROUTES } = require(ROUTER);
  const routed = new Set(ROUTES.flatMap((r) => r.skills));
  const missing = ALL_SKILLS.filter((s) => !routed.has(s));
  assert.deepStrictEqual(missing, []);
});

test("skill-router reaches the less obvious skills from everyday Indonesian", () => {
  const cases = [
    ["pelanggan minta refund karena kena tagih dua kali", "billing-ops-edho-ferdian"],
    ["tombolnya gak jalan pas diklik", "click-path-audit-edho-ferdian"],
    ["setup eslint sama prettier dong", "code-quality-tooling-edho-ferdian"],
    ["tolong review kode Django ini", "language-code-review-edho-ferdian"],
    ["bikin NDA untuk partner baru", "legal-ops-edho-ferdian"],
    ["riset dulu bandingkan Supabase vs Firebase", "research-ops-edho-ferdian"],
    ["repo ini gak ada dokumentasi, ekstrak spec dari kode", "spec-mining-edho-ferdian"],
    ["samakan grading video ini", "video-style-edho-ferdian"],
    ["kenapa internet lambat di homelab", "networking-ops-edho-ferdian"],
  ];
  for (const [prompt, want] of cases) {
    const out = routerFor(prompt, ALL_SKILLS);
    assert.ok(out && out.additionalContext.includes(want), `${prompt} -> ${want}: ${out && out.additionalContext}`);
  }
});

test("plugin hooks.json points only at hook files that exist", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "hooks", "hooks.json"), "utf8"));
  for (const groups of Object.values(cfg.hooks)) {
    for (const g of groups) for (const h of g.hooks) {
      const rel = h.command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"]+)/)[1];
      assert.ok(fs.existsSync(path.join(__dirname, "..", rel)), rel);
    }
  }
});

const AG = path.join(SKILLS, "config-hygiene-edho-ferdian", "hooks", "antigravity-adapter.js");

test("antigravity adapter: router once per prompt, fs-guard decision, edit handoff delivered next turn", () => {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), "eef-ag-"));
  const env = { EEF_AG_STATE: state, EEF_AG_SKILLS: SKILLS, EEF_AG_RULES: path.join(__dirname, "..", "rules") };
  const ag = (mode, input) => {
    const o = execFileSync("node", [AG, mode], { input: JSON.stringify(input), env: { ...process.env, ...env } }).toString();
    return o ? JSON.parse(o) : null;
  };

  const p = { conversationId: "c1", lastUserInput: "bikin landing page toko kopi" };
  assert.match(ag("prompt", p).injectSteps[0].ephemeralMessage, /design-engineering-edho-ferdian/);
  assert.strictEqual(ag("prompt", p), null);                                   // same input, next model call

  assert.strictEqual(ag("shell", { toolCall: { name: "run_command", args: { CommandLine: "find / -name x" } } }).decision, "deny");
  assert.strictEqual(ag("shell", { toolCall: { name: "run_command", args: { CommandLine: "git push --force" } } }).decision, "ask");
  assert.strictEqual(ag("shell", { toolCall: { name: "run_command", args: { CommandLine: "npm test" } } }), null);

  assert.strictEqual(ag("edit", { conversationId: "c1", toolCall: { name: "write_to_file", args: { TargetFile: "/p/db/migrations/001.sql" } } }), null);
  assert.match(ag("prompt", p).injectSteps[0].ephemeralMessage, /data-layer-patterns-edho-ferdian/);

  assert.match(ag("session-start", {}).injectSteps[0].systemMessage, /EEF always-on rules/);
});
