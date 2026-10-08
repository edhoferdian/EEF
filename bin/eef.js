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
const PKG_VERSION = require(path.join(PKG_ROOT, "package.json")).version;

/**
 * Ready-made Claude Code hooks this package ships, keyed by their --only
 * name. Registration shape verified against code.claude.com/docs/en/hooks
 * (2026-10-08): hooks.<Event> is an array of {matcher?, hooks: [{type:
 * "command", command}]} groups; an omitted matcher fires on every
 * occurrence, and "Bash|PowerShell" is an exact-name list, not a regex.
 */
const HOOKS = {
  "fs-guard": {
    file: "block-fs-wide-search.js",
    src: path.join(SKILLS_DIR, "safe-execution-edho-ferdian", "hooks", "block-fs-wide-search.js"),
    event: "PreToolUse",
    matcher: "Bash|PowerShell",
    timeout: 10, // same as the manual setup in safe-execution-edho-ferdian's appendix
  },
  telemetry: {
    file: "log-subagent-run.js",
    src: path.join(SKILLS_DIR, "config-hygiene-edho-ferdian", "hooks", "log-subagent-run.js"),
    event: "SubagentStop",
  },
};

const claudeDir = () => path.join(os.homedir(), ".claude");
const claudeSkillsDir = () => process.env.CLAUDE_SKILLS_DIR || path.join(claudeDir(), "skills");
const claudeAgentsDir = () => process.env.CLAUDE_AGENTS_DIR || path.join(claudeDir(), "agents");
const claudeRulesDir = () => process.env.CLAUDE_RULES_DIR || path.join(claudeDir(), "rules", "eef");
const claudeHooksDir = () => process.env.CLAUDE_HOOKS_DIR || path.join(claudeDir(), "hooks");
const claudeSettingsFile = () => process.env.CLAUDE_SETTINGS_FILE || path.join(claudeDir(), "settings.json");

const TARGETS = {
  claude: {
    label: "Claude Code",
    scope: "global (or $CLAUDE_SKILLS_DIR)",
    install(skillNames) {
      const destRoot = claudeSkillsDir();
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
      const destRoot = claudeAgentsDir();
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
      const destRoot = claudeRulesDir();
      copyDirInto(path.join(PKG_ROOT, "rules"), destRoot);
    },
  },

  "claude-hooks": {
    label: "Claude Code hooks (fs-guard: blocks root-wide searches; telemetry: logs subagent runs) — registered in settings.json, other keys untouched; --only picks one",
    scope: "global (or $CLAUDE_HOOKS_DIR + $CLAUDE_SETTINGS_FILE)",
    install(_skillNames, opts) {
      const names = opts.only ? [opts.only] : Object.keys(HOOKS);
      const unknown = names.filter((n) => !HOOKS[n]);
      if (unknown.length) {
        console.error(`Unknown hook '${unknown[0]}'. Valid --only values: ${Object.keys(HOOKS).join(", ")}`);
        process.exitCode = 2;
        return;
      }
      mergeClaudeHooks(names, claudeHooksDir(), claudeSettingsFile());
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

/** The command a hook is registered with; forward slashes work in bash and PowerShell alike. */
const hookCommand = (hooksDir, hook) => `node "${path.join(hooksDir, hook.file).replace(/\\/g, "/")}"`;

/**
 * Read a settings.json as an object: {} when absent, null (after reporting)
 * when unparsable or not an object — the caller must then leave it alone.
 */
function readSettings(settingsPath) {
  if (!fs.existsSync(settingsPath)) return {};
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    if (settings && typeof settings === "object" && !Array.isArray(settings)) return settings;
    throw new Error("top level is not a JSON object");
  } catch (err) {
    console.error(`Error: ${settingsPath} exists but is not valid settings JSON — refusing to touch it.`);
    console.error(`Fix or remove it, then re-run. (${err.message})`);
    return null;
  }
}

/**
 * Every command handler registered for a hook's event whose command names
 * the hook's file, with the group's matcher — hand registrations count too,
 * so a hook someone already wired up by hand is never added a second time.
 */
function findHookRegistrations(settings, hook) {
  const groups = settings.hooks && Array.isArray(settings.hooks[hook.event]) ? settings.hooks[hook.event] : [];
  const found = [];
  for (const group of groups) {
    if (!group || !Array.isArray(group.hooks)) continue;
    for (const handler of group.hooks) {
      if (handler && typeof handler.command === "string" && handler.command.replace(/\\/g, "/").includes(hook.file)) {
        found.push({ command: handler.command, matcher: group.matcher });
      }
    }
  }
  return found;
}

/**
 * Copy the selected hooks into hooksDir and register each in settingsPath,
 * touching nothing else in that file (same posture as mergeOpencodeAgents:
 * an unparsable file is refused, never rewritten). A hook already
 * registered — by this installer or by hand — is reported, not duplicated
 * or edited. The file is backed up before the first change to it.
 */
function mergeClaudeHooks(names, hooksDir, settingsPath) {
  const settings = readSettings(settingsPath);
  if (settings === null) {
    process.exitCode = 1;
    return;
  }
  const hooksKey = settings.hooks === undefined ? {} : settings.hooks;
  if (!hooksKey || typeof hooksKey !== "object" || Array.isArray(hooksKey)) {
    console.error(`Error: "hooks" in ${settingsPath} is not an object — refusing to touch it.`);
    process.exitCode = 1;
    return;
  }
  for (const name of names) {
    const event = hooksKey[HOOKS[name].event];
    if (event !== undefined && !Array.isArray(event)) {
      console.error(`Error: "hooks.${HOOKS[name].event}" in ${settingsPath} is not an array — refusing to touch it.`);
      process.exitCode = 1;
      return;
    }
  }

  fs.mkdirSync(hooksDir, { recursive: true });
  const added = [];
  for (const name of names) {
    const hook = HOOKS[name];
    const dest = path.join(hooksDir, hook.file);
    const shipped = fs.readFileSync(hook.src, "utf8");
    const before = fs.existsSync(dest) ? fs.readFileSync(dest, "utf8") : null;
    fs.writeFileSync(dest, shipped, "utf8");
    const fileState = before === null ? "Installed" : before === shipped ? "Unchanged" : "Updated";
    console.log(`${fileState} hook file: ${name} -> ${dest}`);

    const command = hookCommand(hooksDir, hook);
    const existing = findHookRegistrations({ hooks: hooksKey }, hook);
    if (existing.some((r) => r.command === command)) {
      console.log(`Already registered: ${name} (${hook.event})`);
    } else if (existing.length) {
      console.log(`Already registered: ${name} (${hook.event}) as \`${existing[0].command}\` — left as is`);
    } else {
      const group = { ...(hook.matcher ? { matcher: hook.matcher } : {}), hooks: [{ type: "command", command, ...(hook.timeout ? { timeout: hook.timeout } : {}) }] };
      hooksKey[hook.event] = [...(hooksKey[hook.event] || []), group];
      added.push(name);
      console.log(`Added registration: ${name} (${hook.event}${hook.matcher ? `, matcher "${hook.matcher}"` : ""})`);
    }
  }

  if (!added.length) {
    console.log(`\nDone. ${settingsPath} already had every selected hook — not rewritten.`);
    return;
  }
  if (fs.existsSync(settingsPath)) {
    fs.copyFileSync(settingsPath, `${settingsPath}.eef-backup`);
    console.log(`Backup: ${settingsPath}.eef-backup`);
  }
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify({ ...settings, hooks: hooksKey }, null, 2) + "\n", "utf8");
  console.log(`\nDone. ${added.length} hook(s) registered in ${settingsPath} (other keys untouched). Restart Claude Code to load them.`);
}

const normalizeEol = (s) => s.replace(/\r\n/g, "\n");

/** Split an agent file into its model/effort values and the rest (model lines removed). */
function splitAgentModel(content) {
  const text = normalizeEol(content);
  const end = text.indexOf("\n---", 4) + 1;
  const frontmatter = text.slice(0, end);
  const field = (key) => {
    const m = frontmatter.match(new RegExp(`^${key}: (.*)$`, "m"));
    return m ? m[1].trim() : null;
  };
  const rest = frontmatter.replace(/^(model|effort): .*\n/gm, "") + text.slice(end);
  return { model: field("model"), effort: field("effort"), rest };
}

/**
 * Compare one shipped directory of files against an install location.
 * Returns {present, same, differs, missing} name lists over the shipped files.
 */
function compareFiles(shippedPaths, destDir, compare) {
  const result = { present: [], same: [], differs: [], missing: [] };
  for (const [name, src] of shippedPaths) {
    const dest = path.join(destDir, name);
    if (!fs.existsSync(dest)) {
      result.missing.push(name);
      continue;
    }
    result.present.push(name);
    const equal = compare ? compare(src, dest) : normalizeEol(fs.readFileSync(src, "utf8")) === normalizeEol(fs.readFileSync(dest, "utf8"));
    (equal ? result.same : result.differs).push(name);
  }
  return result;
}

/**
 * eef-install doctor — read-only report of what this package has installed
 * for Claude Code, and whether it still matches this version. Exits 1 only
 * on clear breakage (an unparsable settings.json, a registered hook whose
 * file is gone); stale or partial installs are reported, not failed.
 */
function doctor() {
  let broken = 0;
  const say = (line) => console.log(line);
  const shortList = (names) => (names.length > 5 ? `${names.slice(0, 5).join(", ")}, … (+${names.length - 5})` : names.join(", "));
  say(`eef-install doctor — package version ${PKG_VERSION}\n`);

  // Skills: compare each SKILL.md (the rest of a skill's folder moves with it).
  const skillsDir = claudeSkillsDir();
  const skills = compareFiles(
    listSkillNames().map((n) => [path.join(n, "SKILL.md"), path.join(SKILLS_DIR, n, "SKILL.md")]),
    skillsDir
  );
  const skillName = (p) => p.split(path.sep)[0];
  say(`Skills (--target claude) — ${skillsDir}`);
  if (!skills.present.length) {
    say("  not installed");
  } else {
    say(`  ${skills.present.length}/${listSkillNames().length} installed, ${skills.same.length} match this version`);
    if (skills.differs.length) say(`  differ (older EEF version, or edited locally): ${shortList(skills.differs.map(skillName))}`);
    if (skills.missing.length) say(`  missing: ${shortList(skills.missing.map(skillName))}`);
  }

  // Agents: compare without model/effort (those are the profile's), then infer the profile.
  const agentsDir = claudeAgentsDir();
  const agentsSrc = path.join(PKG_ROOT, ".claude", "agents");
  const agentFiles = fs.readdirSync(agentsSrc).filter((f) => f.endsWith(".md")).sort();
  const agents = compareFiles(
    agentFiles.map((f) => [f, path.join(agentsSrc, f)]),
    agentsDir,
    (src, dest) => splitAgentModel(fs.readFileSync(src, "utf8")).rest === splitAgentModel(fs.readFileSync(dest, "utf8")).rest
  );
  say(`\nAgents (--target claude-agents) — ${agentsDir}`);
  if (!agents.present.length) {
    say("  not installed");
  } else {
    say(`  ${agents.present.length}/${agentFiles.length} installed, ${agents.same.length} match this version`);
    if (agents.differs.length) say(`  differ (older EEF version, or edited locally): ${shortList(agents.differs.map((f) => f.slice(0, -3)))}`);
    if (agents.missing.length) say(`  missing (new in this version?): ${shortList(agents.missing.map((f) => f.slice(0, -3)))}`);
    const routing = loadRouting();
    const installed = agents.present
      .map((f) => [f.slice(0, -3), splitAgentModel(fs.readFileSync(path.join(agentsDir, f), "utf8"))])
      .filter(([name]) => routing.agents[name]);
    const matching = routing.profiles.filter((p) =>
      installed.every(([name, got]) => {
        const want = routing.agents[name].profiles[p].claude;
        return got.model === want.model && got.effort === (want.effort || null);
      })
    );
    say(
      matching.length
        ? `  model profile: ${matching.join(" / ")}${matching.includes(routing.default_profile) ? " (default)" : ""}`
        : "  model profile: custom (--models override, or model lines edited by hand)"
    );
  }

  // Rules.
  const rulesDir = claudeRulesDir();
  const rulesSrc = path.join(PKG_ROOT, "rules");
  const rules = compareFiles(
    fs.readdirSync(rulesSrc).filter((f) => f.endsWith(".md")).sort().map((f) => [f, path.join(rulesSrc, f)]),
    rulesDir
  );
  say(`\nRules (--target claude-rules) — ${rulesDir}`);
  if (!rules.present.length) {
    say("  not installed");
  } else {
    say(`  ${rules.present.length}/${rules.present.length + rules.missing.length} installed, ${rules.same.length} match this version`);
    if (rules.differs.length) say(`  differ: ${rules.differs.join(", ")}`);
    if (rules.missing.length) say(`  missing: ${rules.missing.join(", ")}`);
  }

  // Hooks: file on disk, and registration in settings.json.
  const hooksDir = claudeHooksDir();
  const settingsPath = claudeSettingsFile();
  say(`\nHooks (--target claude-hooks) — ${hooksDir}, registered in ${settingsPath}`);
  const settings = readSettings(settingsPath);
  if (settings === null) broken++;
  for (const [name, hook] of Object.entries(HOOKS)) {
    const dest = path.join(hooksDir, hook.file);
    const fileState = !fs.existsSync(dest)
      ? "file missing"
      : normalizeEol(fs.readFileSync(dest, "utf8")) === normalizeEol(fs.readFileSync(hook.src, "utf8"))
        ? "file matches this version"
        : "file differs (older EEF version, or edited locally)";
    let regState = "registration unknown (settings.json unreadable)";
    if (settings !== null) {
      const regs = findHookRegistrations(settings, hook);
      if (!regs.length) {
        regState = "not registered";
      } else {
        const missingTargets = regs.filter((r) => !hookTargetExists(r.command, hook.file));
        regState = `registered under ${hook.event}`;
        if (missingTargets.length) {
          regState += ` — BROKEN: \`${missingTargets[0].command}\` points at a file that does not exist`;
          broken++;
        }
      }
    }
    say(`  ${name} (${hook.file}): ${fileState}; ${regState}`);
  }

  say(broken ? `\n${broken} problem(s) need fixing (marked above).` : "\nNo breakage found.");
  if (broken) process.exitCode = 1;
}

/**
 * eef-install update — bring an existing Claude Code install up to this
 * version, touching only what is already there: skills, agents and rules
 * that differ from this package are replaced, items new in this version
 * are added to a group that is already installed, and hook files are
 * refreshed. Nothing is installed from scratch and settings.json is never
 * written. Each agent keeps the model/effort lines it has now, so a
 * profile or a --models override survives; a new agent takes the profile
 * the others match (the default when they match none). "Differs" can mean
 * a local edit, which update overwrites — --dry-run lists the plan first.
 */
function update(opts) {
  const dry = opts.dryRun;
  const act = dry ? "Would update" : "Updated";
  let changed = 0;
  console.log(`eef-install update — package version ${PKG_VERSION}${dry ? " (dry run: nothing is written)" : ""}\n`);

  // Skills: whole folders, since a skill's references/ move with its SKILL.md.
  const skillsDir = claudeSkillsDir();
  const skills = compareFiles(
    listSkillNames().map((n) => [path.join(n, "SKILL.md"), path.join(SKILLS_DIR, n, "SKILL.md")]),
    skillsDir
  );
  const skillNames = skills.present.length ? [...skills.differs, ...skills.missing].map((p) => p.split(path.sep)[0]) : [];
  for (const name of skillNames) {
    console.log(`${act} skill: ${name}`);
    if (!dry) {
      const dest = path.join(skillsDir, name);
      fs.rmSync(dest, { recursive: true, force: true });
      fs.cpSync(path.join(SKILLS_DIR, name), dest, { recursive: true });
    }
    changed++;
  }

  // Agents: replace the body, keep each installed file's own model/effort.
  const agentsDir = claudeAgentsDir();
  const agentsSrc = path.join(PKG_ROOT, ".claude", "agents");
  const agentFiles = fs.readdirSync(agentsSrc).filter((f) => f.endsWith(".md")).sort();
  const agents = compareFiles(
    agentFiles.map((f) => [f, path.join(agentsSrc, f)]),
    agentsDir,
    (src, dest) => splitAgentModel(fs.readFileSync(src, "utf8")).rest === splitAgentModel(fs.readFileSync(dest, "utf8")).rest
  );
  if (agents.present.length) {
    const routing = loadRouting();
    const installed = Object.fromEntries(
      agents.present.map((f) => [f.slice(0, -3), splitAgentModel(fs.readFileSync(path.join(agentsDir, f), "utf8"))])
    );
    // The profile most installed agents match: one hand-edited agent must
    // not push the newcomers onto the default profile.
    const matches = (p) =>
      Object.entries(installed).filter(([name, got]) => {
        const want = routing.agents[name] && routing.agents[name].profiles[p].claude;
        return want && got.model === want.model && got.effort === (want.effort || null);
      }).length;
    const best = Math.max(...routing.profiles.map(matches));
    const profile = best > 0 ? routing.profiles.find((p) => matches(p) === best) : routing.default_profile;
    const keepModel = withClaudeModel((name) =>
      installed[name] && installed[name].model
        ? { model: installed[name].model, effort: installed[name].effort }
        : routing.agents[name] && routing.agents[name].profiles[profile].claude
    );
    for (const file of [...agents.differs, ...agents.missing]) {
      const name = file.slice(0, -3);
      console.log(`${act} agent: ${name}${installed[name] ? "" : ` (new, profile ${profile})`}`);
      if (!dry) fs.writeFileSync(path.join(agentsDir, file), keepModel(name, fs.readFileSync(path.join(agentsSrc, file), "utf8")), "utf8");
      changed++;
    }
  }

  // Rules.
  const rulesDir = claudeRulesDir();
  const rulesSrc = path.join(PKG_ROOT, "rules");
  const rules = compareFiles(
    fs.readdirSync(rulesSrc).filter((f) => f.endsWith(".md")).sort().map((f) => [f, path.join(rulesSrc, f)]),
    rulesDir
  );
  if (rules.present.length) {
    for (const file of [...rules.differs, ...rules.missing]) {
      console.log(`${act} rule: ${file}`);
      if (!dry) fs.copyFileSync(path.join(rulesSrc, file), path.join(rulesDir, file));
      changed++;
    }
  }

  // Hooks: refresh files already installed; registrations are left alone.
  for (const [name, hook] of Object.entries(HOOKS)) {
    const dest = path.join(claudeHooksDir(), hook.file);
    if (!fs.existsSync(dest)) continue;
    if (normalizeEol(fs.readFileSync(dest, "utf8")) === normalizeEol(fs.readFileSync(hook.src, "utf8"))) continue;
    console.log(`${act} hook file: ${name} (${hook.file})`);
    if (!dry) fs.copyFileSync(hook.src, dest);
    changed++;
  }

  console.log(
    changed
      ? `\n${dry ? "Would update" : "Updated"} ${changed} item(s).${dry ? " Run without --dry-run to apply." : " Restart Claude Code to load them."}`
      : "\nEverything installed already matches this version."
  );
}

/** Does the path a registered hook command names (…/<file>, ~ and $HOME expanded) exist? */
function hookTargetExists(command, file) {
  const normalized = command.replace(/\\/g, "/");
  const match = normalized.match(new RegExp(`["']?([^"'\\s]*${file.replace(/\./g, "\\.")})`));
  if (!match) return true; // cannot tell — do not call it broken
  const home = os.homedir().replace(/\\/g, "/");
  const target = match[1].replace(/^~(?=\/)/, home).replace(/^\$\{?HOME\}?(?=\/)/, home).replace(/^%USERPROFILE%(?=\/)/i, home);
  if (/\$|%/.test(target)) return true; // other variables: cannot resolve here
  // Git Bash style /c/Users/... is what Node on Windows calls C:/Users/...
  const native = process.platform === "win32" ? target.replace(/^\/([a-z])\//i, "$1:/") : target;
  if (!path.isAbsolute(native)) return true; // relative to an unknown cwd
  return fs.existsSync(native);
}

function printHelp() {
  console.log(`eef-install — install Ekosistem Edho Ferdian's skills

Usage:
  eef-install                          Install all 38 skills for Claude Code
  eef-install <skill> [<skill> ...]    Install only these skills for Claude Code
  eef-install --list                   List all installable skill names
  eef-install --target <name>          Install for a different harness (see below)
  eef-install doctor                   Report what is installed for Claude Code and
                                       whether it matches this version (read-only)
  eef-install update [--dry-run]       Bring an existing Claude Code install up to this
                                       version: only what is installed and differs is
                                       replaced; agents keep their model/effort
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
  CLAUDE_HOOKS_DIR    Install location for --target claude-hooks (default: ~/.claude/hooks)
  CLAUDE_SETTINGS_FILE  settings.json the hooks are registered in (default: ~/.claude/settings.json)

Hooks (--target claude-hooks):
  --only <name>       install one hook: fs-guard (PreToolUse, blocks recursive searches
                      from / ~ or a drive root) | telemetry (SubagentStop, logs each
                      subagent run to ~/.claude/eef/subagent-runs.jsonl). Default: both.
                      Existing settings.json keys are kept; a hook already registered
                      (even by hand) is never added twice; an unparsable file is refused.

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
  eef-install --target claude-hooks --only fs-guard
  eef-install doctor
  eef-install update --dry-run
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

  if (args[0] === "doctor") {
    doctor();
    return;
  }

  if (args[0] === "update") {
    update({ dryRun: args.includes("--dry-run") });
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
  const opts = {
    global: args.includes("--global"),
    profile: valueOf("--profile"),
    models: valueOf("--models"),
    only: valueOf("--only"),
  };
  const valueFlags = ["--target", "--profile", "--models", "--only"];
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
  if (opts.only && targetName !== "claude-hooks") {
    console.warn(`Note: --only only applies to claude-hooks; ignored for '${targetName}'.`);
  }

  target.install(skillNames, opts);
}

main();
