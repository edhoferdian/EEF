# Security Policy

## What "security" means for this repo

This isn't a typical application with a server or a database — it's a
collection of Markdown instructions (skills) that AI coding agents read
and act on, distributed via GitHub, npm, and a Claude Code plugin
marketplace. The realistic risk surface is different from a normal
codebase, and reports are welcome in any of these categories:

- **A skill instruction that could cause an AI agent to take a harmful
  action** — anything in `skills/*/SKILL.md` or `skills/*/references/*.md`
  (or a generated adapter file under `.cursor/`, `.windsurf/`, `.clinerules/`,
  etc.) that tries to get a consuming agent to exfiltrate secrets, run a
  destructive command, disable its own safety behavior, or otherwise act
  against the user's interest. This is the most important category for a
  repo shaped like this one, and the one least likely to be caught by
  normal code review.
- **Supply-chain issues** in the published `eef-install` npm package or
  in `.github/workflows/ci.yml` — a compromised dependency, an
  unintended publish, or a CI step that could leak credentials or run
  untrusted code from a fork.
- **Accidentally committed secrets** — an API key, token, or credential
  that ended up in this repo's history.
- **Anything in the install scripts** (`install.sh`, `install.ps1`,
  `bin/eef.js`, `scripts/*.py`) that writes outside its documented target
  directory, or executes something it shouldn't.

Ordinary bugs, typos, or a skill giving bad advice belong in a normal
[GitHub issue](https://github.com/edhoferdian/EEF/issues) — this is for
things with an actual security impact.

## Reporting a vulnerability

**Do not open a public issue.** Email edhoferdian31@gmail.com with:

- What you found and where (file path, or the specific adapter/target)
- Why it's a security issue, not just a quality one
- A minimal reproduction if you have one

This is a single-maintainer project — there's no formal SLA, but security
reports get priority over everything else in the backlog. Expect an
acknowledgment within a few days.

## Scope boundaries

Out of scope: vulnerabilities in the AI coding agents themselves (Claude
Code, Cursor, Windsurf, etc.) — report those to the respective vendor, not
here. Also out of scope: a skill's advice being merely wrong or outdated
for a specific stack — that's a quality issue (see
[CONTRIBUTING.md](CONTRIBUTING.md)), not a security one, unless the wrong
advice specifically steers toward an insecure practice (e.g., a skill
recommending disabling a security control) — that's worth reporting.

## Disclosure

No bug bounty program exists. If you'd like credit for a report, say so
and it'll be noted in the fix's commit message and/or release notes; if
you'd rather stay anonymous, that's respected too.
