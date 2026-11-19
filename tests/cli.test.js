// The npm CLI's settings.json merge and doctor, run the way a user runs
// them: a real `node cli/eef.js` process against throwaway directories.
// Unlike the shell smoke test in ci.yml, this runs the same on Windows.
// Run: node --test tests/*.test.js
const { test } = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const CLI = path.join(ROOT, "cli", "eef.js");

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
      CLAUDE_PLUGINS_FILE: path.join(d, "installed_plugins.json"), // no plugin unless a test writes one
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
  assert.deepStrictEqual(c.hooks.PreToolUse.map((g) => g.matcher), ["Edit", "Bash|PowerShell", "Edit|Write|MultiEdit|NotebookEdit"]);
  assert.strictEqual(c.hooks.PreToolUse[0].hooks[0].command, "echo mine");
  assert.deepStrictEqual(c.hooks.PostToolUse.map((g) => g.matcher), ["Agent", "Skill"]);
  assert.strictEqual(c.hooks.UserPromptSubmit.length, 1);
  assert.strictEqual(c.hooks.UserPromptSubmit[0].matcher, undefined);
  assert.match(c.hooks.UserPromptSubmit[0].hooks[0].command, /suggest-skill\.js/);
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

test("doctor and update catch a skill whose only change is in references/", () => {
  const { env } = sandbox();
  assert.strictEqual(eef(env, "code-review-edho-ferdian").status, 0);
  const ref = path.join(env.CLAUDE_SKILLS_DIR, "code-review-edho-ferdian", "references", "review-checklist.md");
  const shipped = fs.readFileSync(ref, "utf8");
  fs.writeFileSync(ref, shipped.replace("Domain 2", "Domain II"));

  assert.match(eef(env, "doctor").stdout, /differ \(older EEF version, or edited locally\): code-review-edho-ferdian/);
  assert.match(eef(env, "update", "--dry-run").stdout, /Would update skill: code-review-edho-ferdian/);
  assert.strictEqual(eef(env, "update").status, 0);
  assert.strictEqual(fs.readFileSync(ref, "utf8"), shipped);
  assert.match(eef(env, "update").stdout, /Everything installed already matches this version\./);
});

test("a skill-tree target reinstall drops files removed upstream and keeps other skills", () => {
  const { dir } = sandbox();
  const skills = path.join(dir, ".kiro", "skills");
  const stale = path.join(skills, "code-review-edho-ferdian", "references", "removed-upstream.md");
  const own = path.join(skills, "my-own-skill", "SKILL.md");
  fs.mkdirSync(path.dirname(stale), { recursive: true });
  fs.mkdirSync(path.dirname(own), { recursive: true });
  fs.writeFileSync(stale, "old");
  fs.writeFileSync(own, "mine");

  const out = spawnSync("node", [CLI, "--target", "kiro"], { cwd: dir, encoding: "utf8" });
  assert.strictEqual(out.status, 0, out.stdout + out.stderr);
  assert.ok(!fs.existsSync(stale), "stale reference should be gone");
  assert.ok(fs.existsSync(path.join(skills, "code-review-edho-ferdian", "SKILL.md")));
  assert.strictEqual(fs.readFileSync(own, "utf8"), "mine");
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

test("with the EEF plugin installed, Claude Code targets step aside unless --force", () => {
  const { dir, env } = sandbox();
  fs.writeFileSync(env.CLAUDE_PLUGINS_FILE, JSON.stringify({ version: 2, plugins: { "ekosistem-edho-ferdian@eef-marketplace": [{ scope: "user" }] } }));
  const skipped = eef(env, "--target", "claude");
  assert.strictEqual(skipped.status, 0);
  assert.match(skipped.stdout.toString(), /already provides it/);
  assert.ok(!fs.existsSync(path.join(dir, "skills", "code-review-edho-ferdian")));

  assert.strictEqual(eef(env, "--target", "claude-hooks").status, 0);
  const c = readJson(path.join(dir, "settings.json"));
  assert.strictEqual(c.hooks, undefined);                       // plugin runs the hooks
  assert.match(c.statusLine.command, /statusline-usage\.js/);   // status line still installed

  assert.strictEqual(eef(env, "--target", "claude", "--force").status, 0);
  assert.ok(fs.existsSync(path.join(dir, "skills", "code-review-edho-ferdian", "SKILL.md")));
  assert.match(eef(env, "doctor").stdout.toString(), /WARNING: EEF is installed both/);
});

test("antigravity-hooks merges one key into hooks.json and keeps the rest", () => {
  const { dir, env } = sandbox();
  const cfg = path.join(dir, "ag");
  fs.mkdirSync(cfg);
  fs.writeFileSync(path.join(cfg, "hooks.json"), JSON.stringify({ mine: { enabled: true } }));
  const e = { ...env, ANTIGRAVITY_CONFIG_DIR: cfg };
  assert.strictEqual(eef(e, "--target", "antigravity-hooks").status, 0);
  assert.strictEqual(eef(e, "--target", "antigravity-hooks").status, 0);   // idempotent
  const c = readJson(path.join(cfg, "hooks.json"));
  assert.deepStrictEqual(Object.keys(c), ["mine", "eef-edho-ferdian"]);
  assert.deepStrictEqual(Object.keys(c["eef-edho-ferdian"]), ["enabled", "SessionStart", "PreInvocation", "PreToolUse"]);
  assert.ok(fs.existsSync(path.join(cfg, "eef-hooks", "antigravity-adapter.js")));
  assert.ok(fs.existsSync(path.join(cfg, "eef-hooks", "rules", "skills.md")));
  fs.writeFileSync(path.join(cfg, "hooks.json"), "{ broken");
  assert.notStrictEqual(eef(e, "--target", "antigravity-hooks").status, 0);
  assert.strictEqual(fs.readFileSync(path.join(cfg, "hooks.json"), "utf8"), "{ broken");
});
