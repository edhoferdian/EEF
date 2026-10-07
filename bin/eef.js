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
const AGENTS_DIST_DIR = path.join(PKG_ROOT, "dist", "agents");

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
    label: "Claude Code sub-agents (agents/*/AGENT.md roster; --profile picks the model mix)",
    scope: "global (or $CLAUDE_AGENTS_DIR)",
    install(_skillNames, opts) {
      const destRoot = process.env.CLAUDE_AGENTS_DIR || path.join(os.homedir(), ".claude", "agents");
      const route = profileRoute(opts, "claude");
      if (route === undefined) return;
      copyAgentFiles(path.join(PKG_ROOT, ".claude", "agents"), destRoot, ".md", route && withClaudeModel(route));
    },
  },

  "codex-agents": {
    label: "Codex custom agents (.codex/agents/*.toml; --profile picks the model mix)",
    scope: "project by default, --global for ~/.codex/agents (or $CODEX_AGENTS_DIR)",
    install(_skillNames, opts) {
      const destRoot =
        process.env.CODEX_AGENTS_DIR ||
        (opts.global ? path.join(os.homedir(), ".codex", "agents") : path.join(process.cwd(), ".codex", "agents"));
      const route = profileRoute(opts, "codex");
      if (route === undefined) return;
      copyAgentFiles(path.join(AGENTS_DIST_DIR, "codex"), destRoot, ".toml", route && withCodexModel(route));
      console.log("Skills these agents wrap: eef-install --target openclaw (installs .agents/skills/, which Codex reads).");
    },
  },

  "claude-rules": {
    label: "Claude Code always-on rules (rules/*.md, loaded every session)",
    scope: "global (or $CLAUDE_RULES_DIR)",
    install() {
      const destRoot = process.env.CLAUDE_RULES_DIR || path.join(os.homedir(), ".claude", "rules", "eef");
      copyDirInto(path.join(PKG_ROOT, "rules"), destRoot);
    },
  },

  "opencode-agents": {
    label: "OpenCode sub-agents (merged into opencode.json, never overwritten; --models sets per-tier model IDs)",
    scope: "project by default, --global for ~/.config/opencode",
    install(_skillNames, opts) {
      const destRoot = opts.global
        ? path.join(os.homedir(), ".config", "opencode")
        : process.cwd();
      const tierModels = loadTierModels(opts);
      if (tierModels === undefined) return;
      mergeOpencodeAgents(destRoot, tierModels);
    },
  },

  "zcode-agents": {
    label: "ZCode sub-agents (added to ~/.zcode/agents/, existing files never touched; --models sets per-tier model IDs)",
    scope: "global only (or $ZCODE_AGENTS_DIR — no confirmed project-local Subagent directory)",
    install(_skillNames, opts) {
      const destRoot = process.env.ZCODE_AGENTS_DIR || path.join(os.homedir(), ".zcode", "agents");
      const tierModels = loadTierModels(opts);
      if (tierModels === undefined) return;
      copyAgentFiles(path.join(AGENTS_DIST_DIR, "zcode"), destRoot, ".md", tierModels && withZcodeModel(tierModels));
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
 * Model routing (D-060). Every agent carries a harness-neutral tier
 * (light/standard/deep); dist/agents/routing.json — generated by
 * scripts/export_agents_routing.py — holds each agent's resolved model and
 * effort per profile and harness. This installer only looks values up, so
 * it can never disagree with the Python exporters about what a profile
 * means. The shipped agent files already carry the default profile.
 */
function loadRouting() {
  return JSON.parse(fs.readFileSync(path.join(AGENTS_DIST_DIR, "routing.json"), "utf8"));
}

/**
 * Return a lookup (agent name -> {model, effort}) for this harness from
 * --profile (default profile when omitted) with --models overriding the
 * model per tier; null when neither flag was given (the shipped files are
 * used as-is), or undefined after reporting a bad flag value. --models is
 * how a consumer swaps in a renamed or newer model without waiting for an
 * EEF release (Codex model names change often; Claude aliases do not).
 */
function profileRoute(opts, harness) {
  if (!opts.profile && !opts.models) return null;
  const routing = loadRouting();
  const profile = opts.profile || routing.default_profile;
  if (!routing.profiles.includes(profile)) {
    console.error(`Unknown profile '${profile}'. Valid profiles: ${routing.profiles.join(", ")}`);
    process.exitCode = 2;
    return undefined;
  }
  const tierModels = loadTierModels(opts);
  if (tierModels === undefined) return undefined;
  console.log(`Model profile: ${profile}${tierModels ? " (models overridden by --models)" : ""}`);
  return (name) => {
    const agent = routing.agents[name];
    if (!agent) return null;
    const resolved = agent.profiles[profile][harness];
    const model = tierModels && tierModels(name);
    // A profile model that takes no effort (Haiku) leaves resolved.effort
    // null; a substitute that does take one falls back to the agent's own.
    const effort = resolved.effort || agent.effort;
    return model ? { model, effort: clampEffort(routing, harness, model, effort) } : resolved;
  };
}

/**
 * Keep a --models substitute within that model's own effort ceiling from
 * routing.json's model_limits (null = takes no effort, e.g. Haiku 4.5) —
 * the profile's effort was clamped for the profile's model, not this one.
 * A model with no listed limit keeps the effort unchanged.
 */
function clampEffort(routing, harness, model, effort) {
  const limits = routing.model_limits[harness] || {};
  if (!(model in limits) || !effort) return effort;
  if (limits[model] === null) return null;
  const levels = routing.effort_levels;
  return levels[Math.min(levels.indexOf(effort), levels.indexOf(limits[model]))];
}

/**
 * Read --models <file.json>: {"light": "<id>", "standard": "<id>", "deep": "<id>"},
 * the consumer's own provider model IDs for harnesses whose model names EEF
 * cannot know (OpenCode, ZCode — a guessed alias made ZCode fail to load the
 * agent). Returns a lookup (agent name -> model ID), null without --models,
 * or undefined after reporting a bad file.
 */
function loadTierModels(opts) {
  if (!opts.models) return null;
  const routing = loadRouting();
  let byTier;
  try {
    byTier = JSON.parse(fs.readFileSync(opts.models, "utf8"));
  } catch (err) {
    console.error(`Error: cannot read --models file ${opts.models} as JSON (${err.message})`);
    process.exitCode = 2;
    return undefined;
  }
  const missing = routing.tiers.filter((t) => typeof byTier[t] !== "string" || !byTier[t].trim());
  if (missing.length) {
    console.error(`Error: --models file must give a model ID for every tier; missing: ${missing.join(", ")}`);
    process.exitCode = 2;
    return undefined;
  }
  return (name) => routing.agents[name] && byTier[routing.agents[name].tier];
}

/**
 * Copy this package's agent files (one per agent, named <agent><ext>) into
 * destRoot, leaving every other file there untouched. transform(name,
 * content) — optional — rewrites a file's model fields before writing.
 */
function copyAgentFiles(srcDir, destRoot, ext, transform) {
  if (!fs.existsSync(srcDir)) {
    console.error(`Error: ${srcDir} not found in this package — reinstall eef-install.`);
    process.exitCode = 1;
    return;
  }
  fs.mkdirSync(destRoot, { recursive: true });
  let count = 0;
  for (const file of fs.readdirSync(srcDir)) {
    if (!file.endsWith(ext)) continue;
    const content = fs.readFileSync(path.join(srcDir, file), "utf8");
    const name = file.slice(0, -ext.length);
    fs.writeFileSync(path.join(destRoot, file), transform ? transform(name, content) : content, "utf8");
    console.log(`Installed: ${file} -> ${destRoot}`);
    count++;
  }
  console.log(`\nDone. ${count} agent(s) installed to ${destRoot} (other files there untouched).`);
}

// Shipped files may carry LF or CRLF (a checkout on Windows converts them),
// so every rewrite below matches either and writes back the file's own.
const eolOf = (content) => (content.includes("\r\n") ? "\r\n" : "\n");

/** Rewrite the model/effort lines inside a Claude Code agent's frontmatter. */
function withClaudeModel(route) {
  return (name, content) => {
    const r = route(name);
    if (!r) return content;
    const eol = eolOf(content);
    // +1 keeps the last frontmatter line's own newline inside the slice.
    const end = content.indexOf("\n---", 4) + 1;
    const frontmatter = content
      .slice(0, end)
      .replace(
        /^model: .*?\r?\n(effort: .*?\r?\n)?/m,
        `model: ${r.model}${eol}` + (r.effort ? `effort: ${r.effort}${eol}` : "")
      );
    return frontmatter + content.slice(end);
  };
}

/** Rewrite model/model_reasoning_effort in a Codex agent TOML's header keys. */
function withCodexModel(route) {
  return (name, content) => {
    const r = route(name);
    if (!r) return content;
    const eol = eolOf(content);
    const end = content.indexOf("\ndeveloper_instructions = ") + 1;
    const header = content
      .slice(0, end)
      .replace(
        /^model = .*?\r?\n(model_reasoning_effort = .*?\r?\n)?/m,
        `model = ${JSON.stringify(r.model)}${eol}` +
          (r.effort ? `model_reasoning_effort = ${JSON.stringify(r.effort)}${eol}` : "")
      );
    return header + content.slice(end);
  };
}

/** Add a model line to a ZCode agent's frontmatter (shipped without one). */
function withZcodeModel(tierModels) {
  return (name, content) => {
    const model = tierModels(name);
    if (!model) return content;
    return content.replace(/^injectAgentsMd: /m, `model: ${JSON.stringify(model)}${eolOf(content)}injectAgentsMd: `);
  };
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
 *
 * Logs "Added"/"Updated"/"Unchanged" per agent so an overwrite of a
 * pre-existing (possibly hand-edited) entry is never silent — found by
 * code-reviewer-edho-ferdian's own review of this file: the previous
 * single "Merged agent: X" message for every case made a real overwrite
 * of a customized entry indistinguishable from a first-time add.
 *
 * tierModels (from --models, optional) adds a "model" to each agent from
 * its tier; without it no model is set and OpenCode uses its own default.
 */
function mergeOpencodeAgents(destRoot, tierModels) {
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
    for (const [name, shipped] of Object.entries(fragment.agent || {})) {
      const model = tierModels && tierModels(name);
      const def = model ? { ...shipped, model } : shipped;
      const existing = config.agent[name];
      if (existing === undefined) {
        console.log(`Added agent: ${name}`);
      } else if (JSON.stringify(existing) !== JSON.stringify(def)) {
        console.log(`Updated agent: ${name} (replaced a differing entry already in opencode.json — any hand edits to it are gone)`);
      } else {
        console.log(`Unchanged agent: ${name}`);
      }
      config.agent[name] = def;
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
  eef-install                          Install all 38 skills for Claude Code
  eef-install <skill> [<skill> ...]    Install only these skills for Claude Code
  eef-install --list                   List all installable skill names
  eef-install --target <name>          Install for a different harness (see below)
  eef-install --help                   Show this message

Targets (--target):
`);
  const widest = Math.max(...Object.keys(TARGETS).map((k) => k.length));
  for (const [key, t] of Object.entries(TARGETS)) {
    console.log(`  ${key.padEnd(widest + 1)} ${t.label} — ${t.scope}`);
  }
  console.log(`
Env vars:
  CLAUDE_SKILLS_DIR   Install location for --target claude (default: ~/.claude/skills)
  CLAUDE_AGENTS_DIR   Install location for --target claude-agents (default: ~/.claude/agents)
  CLAUDE_RULES_DIR    Install location for --target claude-rules (default: ~/.claude/rules/eef)
  ZCODE_AGENTS_DIR    Install location for --target zcode-agents (default: ~/.zcode/agents)
  CODEX_AGENTS_DIR    Install location for --target codex-agents (default: .codex/agents)

Model routing (sub-agent targets) — each agent has a tier (light/standard/deep):
  --profile <name>    claude-agents, codex-agents: hemat | seimbang (default) | maksimal
  --models <file>     any *-agents target: JSON giving a model ID per tier, e.g.
                      {"light":"...","standard":"...","deep":"..."} — overrides the
                      profile's models (effort still follows the profile). Required
                      for opencode/zcode to set a model at all; on claude/codex, use it
                      when a model is renamed before EEF ships an update.

Examples:
  eef-install
  eef-install code-review-edho-ferdian dev-kickoff-edho-ferdian
  eef-install --target cursor
  eef-install --target kiro --global
  eef-install --target claude-agents --profile hemat
  eef-install --target codex-agents --global
  eef-install --target opencode-agents --models ./eef-models.json
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

  const valueOf = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  const opts = { global: args.includes("--global"), profile: valueOf("--profile"), models: valueOf("--models") };
  const valueFlags = ["--target", "--profile", "--models"];
  const skillNames = args.filter((a, i) => {
    if (a.startsWith("-")) return false;
    if (i > 0 && valueFlags.includes(args[i - 1])) return false;
    return true;
  });
  if (opts.profile && !["claude-agents", "codex-agents"].includes(targetName)) {
    console.warn(`Note: --profile only applies to claude-agents and codex-agents; ignored for '${targetName}'.`);
  }
  if (opts.models && !["claude-agents", "codex-agents", "opencode-agents", "zcode-agents"].includes(targetName)) {
    console.warn(`Note: --models only applies to the *-agents targets; ignored for '${targetName}'.`);
  }

  target.install(skillNames, opts);
}

main();
