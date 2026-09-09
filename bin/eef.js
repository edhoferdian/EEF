#!/usr/bin/env node
"use strict";

/**
 * eef-install — installer CLI for Ekosistem Edho Ferdian (EEF).
 *
 * Zero runtime dependencies on purpose (matches this ecosystem's own
 * "standalone, no dependency" design) — plain Node `fs`/`path` only, no
 * argument-parsing library. This CLI ships the actual skill content inside
 * the published npm package (see package.json's `files` list), the same
 * way `ecc-universal` bundles its own content rather than shelling out to
 * `git clone` at install time — no git required, works offline once
 * installed.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const PKG_ROOT = path.resolve(__dirname, "..");
const SKILLS_DIR = path.join(PKG_ROOT, "skills");

const TARGETS = {
  claude: {
    label: "Claude Code",
    scope: "global (or $CLAUDE_SKILLS_DIR)",
    install(skillNames) {
      const destRoot = process.env.CLAUDE_SKILLS_DIR || path.join(os.homedir(), ".claude", "skills");
      fs.mkdirSync(destRoot, { recursive: true });
      const names = skillNames.length ? skillNames : listSkillNames();
      let count = 0;
      for (const name of names) {
        const src = path.join(SKILLS_DIR, name);
        if (!fs.existsSync(src)) {
          console.warn(`Skip: no such skill '${name}'`);
          continue;
        }
        const dest = path.join(destRoot, name);
        fs.rmSync(dest, { recursive: true, force: true });
        fs.cpSync(src, dest, { recursive: true });
        console.log(`Installed: ${name} -> ${dest}`);
        count++;
      }
      console.log(`\nDone. ${count} skill(s) installed to ${destRoot}`);
    },
  },

  cursor: {
    label: "Cursor",
    scope: "project (current directory)",
    install() {
      copyDirInto(path.join(PKG_ROOT, ".cursor", "rules"), path.join(process.cwd(), ".cursor", "rules"));
    },
  },

  windsurf: {
    label: "Windsurf + Devin",
    scope: "project (current directory)",
    install() {
      copyDirInto(path.join(PKG_ROOT, ".windsurf", "rules"), path.join(process.cwd(), ".windsurf", "rules"));
      copyDirInto(path.join(PKG_ROOT, ".devin", "rules"), path.join(process.cwd(), ".devin", "rules"));
    },
  },

  cline: {
    label: "Cline",
    scope: "project (current directory)",
    install() {
      copyDirInto(path.join(PKG_ROOT, ".clinerules"), path.join(process.cwd(), ".clinerules"));
    },
  },

  copilot: {
    label: "GitHub Copilot",
    scope: "project (current directory)",
    install() {
      const src = path.join(PKG_ROOT, ".github", "copilot-instructions.md");
      const destDir = path.join(process.cwd(), ".github");
      fs.mkdirSync(destDir, { recursive: true });
      const dest = path.join(destDir, "copilot-instructions.md");
      fs.copyFileSync(src, dest);
      console.log(`Installed: ${dest}`);
    },
  },

  hermes: {
    label: "Hermes Agent",
    scope: "project by default, --global for ~/.hermes",
    install(_skillNames, opts) {
      const destRoot = opts.global
        ? path.join(os.homedir(), ".hermes", "skills")
        : path.join(process.cwd(), ".hermes", "skills");
      copyDirInto(path.join(PKG_ROOT, ".hermes", "skills"), destRoot);
    },
  },

  openclaw: {
    label: "OpenClaw",
    scope: "project by default, --global for ~/.agents",
    install(_skillNames, opts) {
      const destRoot = opts.global
        ? path.join(os.homedir(), ".agents", "skills")
        : path.join(process.cwd(), ".agents", "skills");
      copyDirInto(path.join(PKG_ROOT, ".agents", "skills"), destRoot);
    },
  },

  kiro: {
    label: "Kiro",
    scope: "project by default, --global for ~/.kiro",
    install(_skillNames, opts) {
      const destRoot = opts.global
        ? path.join(os.homedir(), ".kiro", "skills")
        : path.join(process.cwd(), ".kiro", "skills");
      copyDirInto(path.join(PKG_ROOT, ".kiro", "skills"), destRoot);
    },
  },

  zcode: {
    label: "ZCode (Z.ai)",
    scope: "project by default, --global for ~/.zcode",
    install(_skillNames, opts) {
      const destRoot = opts.global
        ? path.join(os.homedir(), ".zcode", "skills")
        : path.join(process.cwd(), ".zcode", "skills");
      copyDirInto(path.join(PKG_ROOT, ".zcode", "skills"), destRoot);
    },
  },

  "claude-agents": {
    label: "Claude Code sub-agents (agents/*/AGENT.md roster)",
    scope: "global (or $CLAUDE_AGENTS_DIR)",
    install() {
      const destRoot = process.env.CLAUDE_AGENTS_DIR || path.join(os.homedir(), ".claude", "agents");
      copyDirInto(path.join(PKG_ROOT, ".claude", "agents"), destRoot);
    },
  },

  "opencode-agents": {
    label: "OpenCode sub-agents (merged into opencode.json, never overwritten)",
    scope: "project by default, --global for ~/.config/opencode",
    install(_skillNames, opts) {
      const destRoot = opts.global
        ? path.join(os.homedir(), ".config", "opencode")
        : process.cwd();
      mergeOpencodeAgents(destRoot);
    },
  },

  "zcode-agents": {
    label: "ZCode sub-agents (added to ~/.zcode/agents/, existing files never touched)",
    scope: "global only (no confirmed project-local Subagent directory)",
    install() {
      const destRoot = path.join(os.homedir(), ".zcode", "agents");
      const srcDir = path.join(PKG_ROOT, "dist", "agents", "zcode");
      fs.mkdirSync(destRoot, { recursive: true });
      let count = 0;
      for (const file of fs.readdirSync(srcDir)) {
        if (!file.endsWith(".md")) continue;
        fs.copyFileSync(path.join(srcDir, file), path.join(destRoot, file));
        console.log(`Installed: ${file} -> ${destRoot}`);
        count++;
      }
      console.log(`\nDone. ${count} agent(s) installed to ${destRoot} (other files there untouched).`);
    },
  },

  "agents-md": {
    label: "AGENTS.md (Codex, OpenCode, Muse Code, Zed, Antigravity, Cline fallback, ...)",
    scope: "project (current directory)",
    install() {
      copyFileInto(path.join(PKG_ROOT, "AGENTS.md"), path.join(process.cwd(), "AGENTS.md"));
    },
  },

  "gemini-md": {
    label: "Gemini CLI",
    scope: "project (current directory)",
    install() {
      copyFileInto(path.join(PKG_ROOT, "GEMINI.md"), path.join(process.cwd(), "GEMINI.md"));
    },
  },

  pi: {
    label: "Pi (@earendil-works/pi-coding-agent)",
    scope: "no files to copy",
    install() {
      console.log("Pi resolves a standard skills/ folder directly, no install step needed here.");
      console.log("Run this instead: pi install git:github.com/edhoferdian/EEF");
    },
  },
};

function listSkillNames() {
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function copyDirInto(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`Error: ${src} not found in this package — reinstall eef-install.`);
    process.exitCode = 1;
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  const count = fs.readdirSync(dest).length;
  console.log(`Installed: ${dest} (${count} file(s))`);
}

function copyFileInto(src, dest) {
  fs.copyFileSync(src, dest);
  console.log(`Installed: ${dest}`);
}

/**
 * Merge every dist/agents/opencode/*.agent.json fragment's "agent" block
 * into destRoot/opencode.json, without touching any other key in that
 * file — a consumer's own mcp/plugin/command config lives in the same
 * file and must survive this untouched (this is exactly the mistake this
 * ecosystem's own ECC-decommissioning pass had to route around: never
 * write a whole config file wholesale when it might carry a user's own
 * settings). Existing agents not in this package's roster are preserved;
 * an agent with the same name as one already in the file is overwritten
 * (this package is the source of truth for its own -edho-ferdian agents).
 *
 * Also copies each referenced prompts/agents/<name>.txt alongside the
 * config, since opencode.json's prompt field is a {file:...} reference
 * relative to opencode.json's own directory.
 */
function mergeOpencodeAgents(destRoot) {
  const srcDir = path.join(PKG_ROOT, "dist", "agents", "opencode");
  if (!fs.existsSync(srcDir)) {
    console.error(`Error: ${srcDir} not found in this package — reinstall eef-install.`);
    process.exitCode = 1;
    return;
  }

  const configPath = path.join(destRoot, "opencode.json");
  let config = { $schema: "https://opencode.ai/config.json" };
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (err) {
      console.error(`Error: ${configPath} exists but is not valid JSON — refusing to touch it.`);
      console.error(`Fix or remove it, then re-run this install. (${err.message})`);
      process.exitCode = 1;
      return;
    }
  }
  config.agent = config.agent || {};

  const promptsDestDir = path.join(destRoot, "prompts", "agents");
  fs.mkdirSync(promptsDestDir, { recursive: true });

  let count = 0;
  for (const file of fs.readdirSync(srcDir)) {
    if (!file.endsWith(".agent.json")) continue;
    const fragment = JSON.parse(fs.readFileSync(path.join(srcDir, file), "utf8"));
    for (const [name, def] of Object.entries(fragment.agent || {})) {
      config.agent[name] = def;
      console.log(`Merged agent: ${name}`);
      count++;
    }
  }

  const promptsSrcDir = path.join(srcDir, "prompts", "agents");
  if (fs.existsSync(promptsSrcDir)) {
    for (const file of fs.readdirSync(promptsSrcDir)) {
      fs.copyFileSync(path.join(promptsSrcDir, file), path.join(promptsDestDir, file));
    }
  }

  fs.mkdirSync(destRoot, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log(`\nDone. ${count} agent(s) merged into ${configPath} (other keys in that file untouched).`);
}

function printHelp() {
  console.log(`eef-install — install Ekosistem Edho Ferdian's skills

Usage:
  eef-install                          Install all 33 skills for Claude Code
  eef-install <skill> [<skill> ...]    Install only these skills for Claude Code
  eef-install --list                   List all installable skill names
  eef-install --target <name>          Install for a different harness (see below)
  eef-install --help                   Show this message

Targets (--target):
`);
  for (const [key, t] of Object.entries(TARGETS)) {
    console.log(`  ${key.padEnd(12)} ${t.label} — ${t.scope}`);
  }
  console.log(`
Env vars:
  CLAUDE_SKILLS_DIR   Install location for --target claude (default: ~/.claude/skills)

Examples:
  eef-install
  eef-install code-review-edho-ferdian dev-kickoff-edho-ferdian
  eef-install --target cursor
  eef-install --target kiro --global
`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  if (args.includes("--list")) {
    for (const name of listSkillNames()) console.log(name);
    return;
  }

  const targetIdx = args.indexOf("--target");
  const targetName = targetIdx !== -1 ? args[targetIdx + 1] : "claude";
  const target = TARGETS[targetName];

  if (!target) {
    console.error(`Unknown target '${targetName}'. Valid targets: ${Object.keys(TARGETS).join(", ")}`);
    process.exitCode = 2;
    return;
  }

  const opts = { global: args.includes("--global") };
  const skillNames = args.filter((a, i) => {
    if (a.startsWith("-")) return false;
    if (i > 0 && args[i - 1] === "--target") return false;
    return true;
  });

  target.install(skillNames, opts);
}

main();
