#!/usr/bin/env node
// Claude Code PreToolUse hook on Edit|Write|MultiEdit|NotebookEdit — names
// the EEF skill that owns the file about to be changed, when that skill
// hasn't been loaded in this session yet.
//
// Why: handoffs between skills ("dev-kickoff hands the UI work to
// frontend-engineering") are instructions the model may skip. This hook
// makes the handoff deterministic at the moment it matters — the first edit
// of a .tsx, a migration, a Dockerfile — without blocking anything. It
// reads the skill-telemetry log (log-skill-use.js) to see which skills this
// session already loaded, and reminds once per skill per session.
//
// Output: hookSpecificOutput.additionalContext with no permissionDecision,
// so the edit proceeds normally (code.claude.com/docs/en/hooks, checked
// 2026-11-19). Fails open on any error.
//
// Env: CLAUDE_SKILLS_DIR, EEF_SKILL_LOG (default ~/.claude/eef/skill-runs.jsonl),
// EEF_GUARD_STATE (default ~/.claude/eef/skill-guard.jsonl).

const fs = require("fs");
const os = require("os");
const path = require("path");

const PLUGIN_NAME = "ekosistem-edho-ferdian";
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT ? path.resolve(process.env.CLAUDE_PLUGIN_ROOT) : null;
const IN_PLUGIN = Boolean(PLUGIN_ROOT && path.resolve(__dirname).startsWith(PLUGIN_ROOT));
const SKILLS_DIR =
  process.env.CLAUDE_SKILLS_DIR ||
  (IN_PLUGIN ? path.join(PLUGIN_ROOT, "skills") : path.join(os.homedir(), ".claude", "skills"));
const EEF_DIR = path.join(os.homedir(), ".claude", "eef");
const SKILL_LOG = process.env.EEF_SKILL_LOG || path.join(EEF_DIR, "skill-runs.jsonl");
const STATE = process.env.EEF_GUARD_STATE || path.join(EEF_DIR, "skill-guard.jsonl");
const TAIL_BYTES = 256 * 1024;

// First match wins per rule; a file can match several rules.
const RULES = [
  { re: /(^|\/)(\.claude\/|skills\/)[^/]+\/SKILL\.md$/i, skills: ["skill-authoring-edho-ferdian"], what: "a skill" },
  { re: /\.(tsx|jsx|vue|svelte|astro|css|scss|sass|less|html)$|(^|\/)tailwind\.config\.\w+$/i, skills: ["frontend-engineering-edho-ferdian", "design-engineering-edho-ferdian"], what: "UI code" },
  { re: /\.swift$/i, skills: ["design-engineering-edho-ferdian"], what: "Swift code" },
  { re: /(^|\/)(schema\.prisma|drizzle\.config\.\w+)$|(^|\/)migrations?\/|\.sql$/i, skills: ["data-layer-patterns-edho-ferdian"], what: "the data layer" },
  { re: /(^|\/)(openapi|swagger)[^/]*\.(ya?ml|json)$/i, skills: ["api-design-edho-ferdian"], what: "an API contract" },
  { re: /(^|\/)(routes?|controllers?|handlers?|services?|api|server|jobs?|workers?)\/[^/]+\.(ts|js|mjs|py|go|rb|php|java|kt|rs|cs)$/i, skills: ["backend-engineering-edho-ferdian"], what: "backend code" },
  { re: /(^|\/)(Dockerfile[^/]*|docker-compose[^/]*\.ya?ml|compose\.ya?ml|\.dockerignore)$/i, skills: ["container-ops-edho-ferdian"], what: "container config" },
  { re: /(^|\/)\.github\/workflows\/|(^|\/)(\.gitlab-ci\.yml|Jenkinsfile)$|(^|\/)(k8s|kubernetes|helm|deploy)\//i, skills: ["deployment-ops-edho-ferdian"], what: "CI/CD or deployment config" },
  { re: /(^|\/)(e2e|playwright|cypress)\/|\.e2e\.\w+$/i, skills: ["e2e-testing-edho-ferdian"], what: "an end-to-end test" },
  { re: /\.(test|spec)\.\w+$|_test\.(go|py)$|(^|\/)test_[^/]+\.py$|(^|\/)__tests__\//i, skills: ["test-authoring-edho-ferdian"], what: "a test" },
  { re: /(^|\/)(\.eslintrc[^/]*|eslint\.config\.\w+|biome\.jsonc?|\.prettierrc[^/]*|prettier\.config\.\w+|\.lintstagedrc[^/]*|\.pre-commit-config\.ya?ml|ruff\.toml|\.husky\/[^/]+)$/i, skills: ["code-quality-tooling-edho-ferdian"], what: "lint/format tooling" },
  { re: /(^|\/)(README|CHANGELOG|ARCHITECTURE|CODEMAP)\.md$|(^|\/)docs\/[^/]+\.mdx?$/i, skills: ["docs-sync-edho-ferdian"], what: "user-facing docs" },
  { re: /(^|\/)(LICENSE(\.\w+)?|CONTRIBUTING\.md|CODE_OF_CONDUCT\.md|SECURITY\.md|\.env\.example)$/i, skills: ["opensource-release-edho-ferdian"], what: "open-source release files" },
  { re: /(^|\/)\.claude\/(settings(\.local)?\.json|hooks\/[^/]+)$|(^|\/)\.mcp\.json$/i, skills: ["config-hygiene-edho-ferdian"], what: "Claude Code configuration" },
  { re: /(^|\/)(nginx[^/]*\.conf|Caddyfile|haproxy\.cfg|netplan\/[^/]+\.ya?ml)$/i, skills: ["networking-ops-edho-ferdian"], what: "network configuration" },
  { re: /(^|\/)(webhooks?|billing|payments?|checkout|subscriptions?)\/[^/]+\.(ts|js|py|go|rb|php)$/i, skills: ["billing-ops-edho-ferdian", "security-review-edho-ferdian"], what: "billing or payment code" },
  { re: /(^|\/)(auth|security|crypto)\/[^/]+\.(ts|js|py|go|rb|php|java|kt|rs|cs)$|(^|\/)middleware\.(ts|js)$/i, skills: ["security-review-edho-ferdian"], what: "security-sensitive code" },
];

function owners(filePath) {
  const p = String(filePath || "").replace(/\\/g, "/");
  if (!p) return [];
  const out = [];
  for (const rule of RULES) {
    if (!rule.re.test(p)) continue;
    for (const skill of rule.skills) {
      if (!out.some((o) => o.skill === skill)) out.push({ skill, what: rule.what });
    }
  }
  return out;
}

function tailLines(file) {
  try {
    const fd = fs.openSync(file, "r");
    try {
      const size = fs.fstatSync(fd).size;
      const start = Math.max(0, size - TAIL_BYTES);
      const buf = Buffer.alloc(size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      return buf.toString("utf8").split("\n").filter(Boolean);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return [];
  }
}

const bare = (name) => String(name || "").split(":").pop();

function seenThisSession(file, sessionId, field) {
  const seen = new Set();
  for (const line of tailLines(file)) {
    try {
      const r = JSON.parse(line);
      if (r.session_id === sessionId) seen.add(bare(r[field]));
    } catch {
      // skip a torn line
    }
  }
  return seen;
}

function remindersFor(input) {
  const ti = input.tool_input || {};
  const file = ti.file_path || ti.notebook_path;
  const sessionId = input.session_id || null;
  const candidates = owners(file).filter(({ skill }) => fs.existsSync(path.join(SKILLS_DIR, skill, "SKILL.md")));
  if (!candidates.length) return [];
  const loaded = sessionId ? seenThisSession(SKILL_LOG, sessionId, "skill") : new Set();
  const reminded = sessionId ? seenThisSession(STATE, sessionId, "skill") : new Set();
  return candidates.filter(({ skill }) => !loaded.has(skill) && !reminded.has(skill));
}

if (require.main === module) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (raw += chunk));
  process.stdin.on("end", () => {
    try {
      const input = JSON.parse(raw);
      if (input.hook_event_name && input.hook_event_name !== "PreToolUse") return;
      if (IN_PLUGIN) {
        try {
          const settings = fs.readFileSync(path.join(os.homedir(), ".claude", "settings.json"), "utf8");
          if (settings.includes(path.basename(__filename))) return; // eef-install copy is active
        } catch {
          // no global settings: the plugin copy is the only one
        }
      }
      const due = remindersFor(input);
      if (!due.length) return;
      if (input.session_id) {
        fs.mkdirSync(path.dirname(STATE), { recursive: true });
        const ts = new Date().toISOString();
        fs.appendFileSync(STATE, due.map(({ skill }) => JSON.stringify({ ts, session_id: input.session_id, skill })).join("\n") + "\n");
      }
      const name = (s) => (IN_PLUGIN ? `${PLUGIN_NAME}:${s}` : s);
      const file = (input.tool_input && (input.tool_input.file_path || input.tool_input.notebook_path)) || "this file";
      const list = due.map(({ skill }) => name(skill)).join(", ");
      const what = [...new Set(due.map((d) => d.what))].join(" / ");
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            additionalContext:
              `EEF handoff: ${path.basename(file)} is ${what}, owned by ${list}, which this session hasn't loaded. ` +
              "Load it with the Skill tool and apply it to this change (the edit itself is not blocked).",
          },
        })
      );
    } catch {
      // fail open
    }
  });
}

module.exports = { owners };
