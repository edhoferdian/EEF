#!/usr/bin/env node
// Claude Code UserPromptSubmit hook — a deterministic nudge toward the EEF
// skill that matches the prompt.
//
// Why: Claude Code only lists each skill's name and description; whether a
// skill loads is the model's call, and for everyday asks ("rapikan tampilan
// chat", "landing page") it often decides it can do without. Session logs
// on 2026-11-19 showed 0 of 9 UI sessions loading a design skill on their
// own. This hook matches the prompt against a small keyword map and, when a
// matching skill is installed, adds one line of context naming it. The
// model still decides; it just can't miss that the skill exists.
//
// Output: JSON hookSpecificOutput.additionalContext for UserPromptSubmit
// (code.claude.com/docs/en/hooks, checked 2026-11-19; the event takes no
// matcher and fires on every prompt). Silent when nothing matches, when the
// prompt is a slash command, or when the prompt already names the skill.
// Never blocks a prompt. Fails open on any error.
//
// Runs from either install: copied to ~/.claude/hooks by eef-install, or
// from the plugin (CLAUDE_PLUGIN_ROOT set). In the plugin, skills are
// namespaced `ekosistem-edho-ferdian:<name>`, and when the eef-install copy
// of this same hook is registered too, the plugin copy stays silent so the
// nudge never appears twice.
//
// Env: CLAUDE_SKILLS_DIR (installed skills; default ~/.claude/skills, or
// the plugin's skills/ when run from the plugin).
//
// Install: `npx eef-install --target claude-hooks --only skill-router`, or
// the plugin.

const fs = require("fs");
const os = require("os");
const path = require("path");

const PLUGIN_NAME = "ekosistem-edho-ferdian";
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT ? path.resolve(process.env.CLAUDE_PLUGIN_ROOT) : null;
const IN_PLUGIN = Boolean(PLUGIN_ROOT && path.resolve(__dirname).startsWith(PLUGIN_ROOT));
const SKILLS_DIR =
  process.env.CLAUDE_SKILLS_DIR ||
  (IN_PLUGIN ? path.join(PLUGIN_ROOT, "skills") : path.join(os.homedir(), ".claude", "skills"));

// True when this hook runs from the plugin while eef-install registered its
// own copy in ~/.claude/settings.json — the global copy speaks, this one
// doesn't.
function globalCopyActive() {
  if (!IN_PLUGIN) return false;
  try {
    const settings = fs.readFileSync(
      process.env.CLAUDE_SETTINGS_FILE || path.join(os.homedir(), ".claude", "settings.json"),
      "utf8"
    );
    return settings.includes(path.basename(__filename));
  } catch {
    return false;
  }
}

// Order matters only for the output order. Patterns are case-insensitive
// and anchored on word boundaries; Indonesian and English both count.
// `unless` drops a route when a more specific meaning is present.
const UI_WORDS = /\b(tampilan|ui|ux|landing ?page|halaman|komponen|component|animasi|animation|css|tailwind)\b/i;
const ROUTES = [
  {
    skills: ["dev-kickoff-edho-ferdian"],
    re: /\b(mulai proyek|mulai project|proyek baru|project baru|kickoff|kick-off|lanjutkan proyek|lanjut proyek|resume proyek|context pack|start (a |the )?project)\b/i,
  },
  {
    skills: ["system-design-edho-ferdian"],
    re: /\b(arsitektur|architecture|system design|desain sistem|adr|microservices?|monolith|trade-?off|skalabilitas|scaling)\b/i,
  },
  {
    skills: ["design-engineering-edho-ferdian", "frontend-engineering-edho-ferdian"],
    re: /\b(tampilan|desain|design|ui|ux|landing ?page|halaman|web ?site|website|komponen|component|layout|animasi|animate|animation|transisi|transition|gesture|swipe|drawer|bottom ?sheet|modal|popover|tooltip|toast|responsive|responsif|css|tailwind|figma|polish|dashboard)\b/i,
    // "desain sistem" / "system design" alone is architecture, not UI
    unless: (text) => /\b(system design|desain sistem|arsitektur|architecture|api design|desain api)\b/i.test(text) && !UI_WORDS.test(text),
  },
  { skills: ["backend-engineering-edho-ferdian"], re: /\b(backend|back-end|server|service layer|background job|queue|antrian|worker|cron|webhook|integrasi)\b/i },
  { skills: ["api-design-edho-ferdian"], re: /\b(endpoint|rest api|desain api|api design|api contract|openapi|graphql)\b/i },
  { skills: ["data-layer-patterns-edho-ferdian"], re: /\b(schema database|database schema|skema database|prisma|migration|migrasi|redis|postgres|mysql|database)\b/i },
  { skills: ["build-fix-edho-ferdian"], re: /\b(build error|gagal build|build gagal|compile error|tidak bisa jalan|gak bisa jalan|nggak jalan|stack trace|module not found|cannot find module|error saat build)\b/i },
  { skills: ["code-review-edho-ferdian"], re: /\b(review|cek kode|cek kodenya|periksa kode|sebelum merge|ada yang salah gak)\b/i },
  { skills: ["performance-audit-edho-ferdian"], re: /\b(lambat|lemot|lelet|slow|lag|janky|patah-patah|memory leak|optimasi performa)\b/i },
  { skills: ["security-review-edho-ferdian"], re: /\b(keamanan|security|vulnerab\w*|celah keamanan|xss|sql injection|aman gak|audit keamanan)\b/i },
  { skills: ["test-authoring-edho-ferdian"], re: /\b(unit test|tulis test|bikin test|testing|pytest|vitest|jest|tes unit)\b/i },
  { skills: ["e2e-testing-edho-ferdian"], re: /\b(e2e|end-to-end|playwright|cypress|alur pengguna|user flow)\b/i },
  { skills: ["seo-audit-edho-ferdian"], re: /\b(seo|meta tags?|sitemap|robots\.txt|google search|structured data|muncul di google)\b/i },
  { skills: ["deployment-ops-edho-ferdian"], re: /\b(deploy|rilis ke production|production down|rollback|ci\/cd|pipeline|postmortem|insiden)\b/i },
  { skills: ["container-ops-edho-ferdian"], re: /\b(docker|dockerfile|docker-compose|container|kontainer)\b/i },
  { skills: ["git-and-release-ops-edho-ferdian"], re: /\b(commit message|strategi branch|rebase|merge conflict|konflik merge|bikin release|changelog|ci merah)\b/i },
  { skills: ["docs-sync-edho-ferdian"], re: /\b(readme|dokumentasi|documentation|codemap)\b/i },
  { skills: ["dead-code-cleanup-edho-ferdian"], re: /\b(kode mati|dead code|unused code|tidak dipakai|bersihkan kode)\b/i },
  { skills: ["code-simplification-edho-ferdian"], re: /\b(sederhanakan|simplify|refactor biar rapi|terlalu rumit|over-?engineered)\b/i },
];

function qualified(skill) {
  return IN_PLUGIN ? `${PLUGIN_NAME}:${skill}` : skill;
}

function suggestions(prompt) {
  const text = String(prompt || "");
  if (!text.trim() || text.trimStart().startsWith("/")) return [];
  const lower = text.toLowerCase();
  const found = [];
  for (const route of ROUTES) {
    if (!route.re.test(text)) continue;
    if (route.unless && route.unless(text)) continue;
    for (const skill of route.skills) {
      if (found.includes(skill) || lower.includes(skill)) continue;
      if (fs.existsSync(path.join(SKILLS_DIR, skill, "SKILL.md"))) found.push(skill);
    }
  }
  return found.slice(0, 4);
}

function render(skills) {
  return (
    `EEF skill match for this prompt: ${skills.map(qualified).join(", ")}. ` +
    "Load the matching one with the Skill tool before starting work, unless it clearly doesn't fit the request."
  );
}

if (require.main === module) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (raw += chunk));
  process.stdin.on("end", () => {
    try {
      const input = JSON.parse(raw);
      if (input.hook_event_name && input.hook_event_name !== "UserPromptSubmit") return;
      if (globalCopyActive()) return;
      const skills = suggestions(input.prompt);
      if (!skills.length) return;
      process.stdout.write(
        JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: render(skills) } })
      );
    } catch {
      // fail open: never disturb the prompt
    }
  });
}

module.exports = { suggestions };
