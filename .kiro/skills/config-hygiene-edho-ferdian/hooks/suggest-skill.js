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
// Env: CLAUDE_SKILLS_DIR (installed skills; default ~/.claude/skills).
//
// Install: `npx eef-install --target claude-hooks --only skill-router`.

const fs = require("fs");
const os = require("os");
const path = require("path");

const SKILLS_DIR = process.env.CLAUDE_SKILLS_DIR || path.join(os.homedir(), ".claude", "skills");

// Order matters only for the output order. Patterns are case-insensitive
// and anchored on word boundaries; Indonesian and English both count.
const ROUTES = [
  {
    skills: ["design-engineering-edho-ferdian", "frontend-engineering-edho-ferdian"],
    re: /\b(tampilan|desain|design|ui|ux|landing ?page|halaman|web ?site|website|komponen|component|layout|animasi|animate|animation|transisi|transition|gesture|swipe|drawer|bottom ?sheet|modal|popover|tooltip|toast|responsive|responsif|css|tailwind|figma|rapikan ui|polish)\b/i,
  },
  { skills: ["build-fix-edho-ferdian"], re: /\b(build error|gagal build|build gagal|compile error|tidak bisa jalan|gak bisa jalan|stack trace|module not found|cannot find module)\b/i },
  { skills: ["performance-audit-edho-ferdian"], re: /\b(lambat|lemot|lelet|slow|lag|janky|patah-patah|memory leak)\b/i },
  { skills: ["security-review-edho-ferdian"], re: /\b(keamanan|security|vulnerab\w*|celah keamanan|xss|sql injection|aman gak)\b/i },
  { skills: ["e2e-testing-edho-ferdian", "test-authoring-edho-ferdian"], re: /\b(tes|test|testing|unit test|e2e|end-to-end|pytest|vitest|jest|playwright)\b/i },
  { skills: ["seo-audit-edho-ferdian"], re: /\b(seo|meta tags?|sitemap|robots\.txt|google search|structured data)\b/i },
  { skills: ["deployment-ops-edho-ferdian"], re: /\b(deploy|rilis ke production|production down|rollback|ci\/cd|pipeline)\b/i },
  { skills: ["data-layer-patterns-edho-ferdian"], re: /\b(schema database|database schema|prisma|migration|migrasi|redis|postgres)\b/i },
  { skills: ["api-design-edho-ferdian"], re: /\b(endpoint|rest api|desain api|api contract|openapi)\b/i },
];

function suggestions(prompt) {
  const text = String(prompt || "");
  if (!text.trim() || text.trimStart().startsWith("/")) return [];
  const lower = text.toLowerCase();
  const found = [];
  for (const route of ROUTES) {
    if (!route.re.test(text)) continue;
    for (const skill of route.skills) {
      if (found.includes(skill) || lower.includes(skill)) continue;
      if (fs.existsSync(path.join(SKILLS_DIR, skill, "SKILL.md"))) found.push(skill);
    }
  }
  return found;
}

function render(skills) {
  return (
    `EEF skill match for this prompt: ${skills.join(", ")}. ` +
    "Load the matching one with the Skill tool before starting work, unless it clearly doesn't fit the request."
  );
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(raw);
    if (input.hook_event_name && input.hook_event_name !== "UserPromptSubmit") return;
    const skills = suggestions(input.prompt);
    if (!skills.length) return;
    process.stdout.write(
      JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: render(skills) } })
    );
  } catch {
    // fail open: never disturb the prompt
  }
});
