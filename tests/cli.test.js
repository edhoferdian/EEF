// The npm CLI's settings.json merge and doctor, run the way a user runs
// them: a real `node bin/eef.js` process against throwaway directories.
// Unlike the shell smoke test in ci.yml, this runs the same on Windows.
// Run: node --test tests/*.test.js
const { test } = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const CLI = path.join(ROOT, "bin", "eef.js");

function sandbox() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "eef-cli-"));
  return {
    dir: d,
    env: {
      ...process.env,
      CLAUDE_SKILLS_DIR: path.join(d, "skills"),
      CLAUDE_AGENTS_DIR: path.join(d, "agents"),
      CLAUDE_RULES_DIR: path.join(d, "rules"),
      CLAUDE_HOOKS_DIR: path.join(d, "hooks"),
      CLAUDE_SETTINGS_FILE: path.join(d, "settings.json"),
    },
  };
}

const eef = (env, ...args) => spawnSync("node", [CLI, ...args], { env, encoding: "utf8" });
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

test("--list prints one line per skill folder", () => {
  const out = eef(process.env, "--list");
  assert.strictEqual(out.status, 0);
  const skills = fs.readdirSync(path.join(ROOT, "skills"));
  assert.strictEqual(out.stdout.trim().split(/\r?\n/).length, skills.length);
});

test("claude-hooks keeps other keys and existing hooks, and never registers twice", () => {
  const { dir, env } = sandbox();
  const settings = path.join(dir, "settings.json");
  fs.writeFileSync(settings, JSON.stringify({
    model: "opus",
    hooks: { PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "echo mine" }] }] },
  }));
  assert.strictEqual(eef(env, "--target", "claude-hooks").status, 0);
  assert.strictEqual(eef(env, "--target", "claude-hooks").status, 0);

  const c = readJson(settings);
  assert.strictEqual(c.model, "opus");
  assert.strictEqual(c.hooks.PreToolUse.length, 2);
  assert.strictEqual(c.hooks.PreToolUse[0].hooks[0].command, "echo mine");
  assert.strictEqual(c.hooks.PostToolUse.length, 1);
  assert.match(c.statusLine.command, /statusline-usage\.js/);
  assert.ok(fs.existsSync(`${settings}.eef-backup`));
});

test("claude-hooks leaves a user's own statusLine alone", () => {
  const { dir, env } = sandbox();
  const settings = path.join(dir, "settings.json");
  fs.writeFileSync(settings, JSON.stringify({ statusLine: { type: "command", command: "mine" } }));
  assert.strictEqual(eef(env, "--target", "claude-hooks", "--only", "statusline").status, 0);
  assert.strictEqual(readJson(settings).statusLine.command, "mine");
});

test("claude-hooks refuses an unparsable settings.json and leaves it untouched", () => {
  const { dir, env } = sandbox();
  const settings = path.join(dir, "settings.json");
  fs.writeFileSync(settings, "{ not json");
  assert.notStrictEqual(eef(env, "--target", "claude-hooks").status, 0);
  assert.strictEqual(fs.readFileSync(settings, "utf8"), "{ not json");
});

test("doctor is clean after an install and fails once a registered hook file is gone", () => {
  const { env } = sandbox();
  assert.strictEqual(eef(env, "--target", "claude-hooks").status, 0);
  const ok = eef(env, "doctor");
  assert.strictEqual(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /No breakage found\./);

  fs.rmSync(path.join(env.CLAUDE_HOOKS_DIR, "log-subagent-run.js"));
  assert.notStrictEqual(eef(env, "doctor").status, 0);
});

test("stats leaves SubagentStop-era records out and counts PostToolUse runs", () => {
  const { dir, env } = sandbox();
  const log = path.join(dir, "runs.jsonl");
  const run = (session, extra) => JSON.stringify({ session_id: session, agent_type: "code-critic-edho-ferdian", ...extra });
  fs.writeFileSync(log, [
    run("s0", { model: null }),
    run("s1", { status: "completed", model: "claude-opus-5-5", tokens: 100 }),
    run("s2", { status: "completed", model: "claude-opus-5-5", tokens: 300 }),
  ].join("\n") + "\n");
  const out = eef({ ...env, EEF_SUBAGENT_LOG: log }, "stats", "--json");
  assert.strictEqual(out.status, 0, out.stderr);
  const [row] = JSON.parse(out.stdout);
  assert.strictEqual(row.runs, 2);
  assert.strictEqual(row.median_tokens, 200);
});
