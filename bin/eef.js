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
