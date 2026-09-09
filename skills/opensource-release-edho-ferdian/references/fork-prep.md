# Phase 1 — Fork / Prep

Reference for Phase 1 of `opensource-release-edho-ferdian`.

You are the **producer** role in this skill's Critique-Correction Loop
instance (see `sanitize-audit.md` for the full framing) — Phase 2 audits
your output independently and does not trust anything you claim here beyond
what it re-derives itself. Write `FORK_REPORT.md` as accurately as you can,
but do not treat it as the release gate; Phase 2 is the gate.

## Step 1 — Analyze the source

Read enough of the project to know its stack and sensitive surface before
touching anything:

```bash
# Stack detection
ls package.json requirements.txt Cargo.toml go.mod 2>/dev/null

# Config surface
find . -maxdepth 2 -iname ".env*" -o -iname "docker-compose*"

# CI/CD surface
ls .github .gitlab-ci.yml 2>/dev/null

# Existing docs
ls README.md CLAUDE.md 2>/dev/null
```

## Step 2 — Create the staging copy

Copy to a separate staging directory — never sanitize in place, and never
sanitize inside the original repo's working tree:

```bash
mkdir -p TARGET_DIR
rsync -av \
  --exclude='.git' --exclude='node_modules' --exclude='__pycache__' \
  --exclude='.env*' --exclude='*.pyc' --exclude='.venv' --exclude='venv' \
  --exclude='.claude/' --exclude='.secrets/' --exclude='secrets/' \
  SOURCE_DIR/ TARGET_DIR/
```

Exclude list matches the "dangerous files" section of
`references/secret-patterns.md` — if that list grows, this exclude list
should too, in the same edit.

## Step 3 — Secret detection and extraction

Scan every file in `TARGET_DIR` against the CRITICAL and WARNING patterns in
**`references/secret-patterns.md`** — read that file now, don't re-derive
patterns here. For every match:

1. **Extract, never just delete.** Move the value into `.env.example` as a
   named placeholder, and replace the source occurrence with a reference to
   that variable (`process.env.X`, `${X}`, `os.environ["X"]` — whatever the
   stack's existing convention is). Deleting a secret without extracting it
   breaks the app for the next person who forks it; the whole point of
   `.env.example` is that functionality survives the sanitization.
2. **WARNING-tier matches** (high-entropy strings, ambiguous domains) get
   flagged for manual review in `FORK_REPORT.md`, not auto-stripped — an
   over-eager strip on a false positive silently breaks working config.
3. **Files to remove outright** (not strip-and-keep): the "dangerous files"
   list in `secret-patterns.md` — `.env` variants, private keys, credential
   JSON files, `.secrets/`, `sessions/`, source maps.
4. **Files to strip content from, not remove**: `docker-compose.yml`
   (replace hardcoded values with `${VAR_NAME}`), any `config/` file
   (parameterize), `nginx.conf` (replace internal domains).

## Step 4 — Internal reference replacement

Apply the replacement map from `references/secret-patterns.md` (domains,
home paths, private IPs, internal service URLs, personal emails, internal
org names). Every replacement gets a corresponding `.env.example` entry if
it's meant to be configurable — a hardcoded internal domain becomes
`APP_DOMAIN=your-domain.com` in `.env.example`, not a silent literal
placeholder with no way to configure it back.

## Step 5 — Generate `.env.example`

Every extracted value gets an entry, grouped logically, with a comment
explaining what it's for:

```bash
# Application Configuration
# Copy this file to .env and fill in your values
# cp .env.example .env

# === Required ===
APP_NAME=my-project
APP_DOMAIN=your-domain.com
APP_PORT=8080

# === Database ===
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
REDIS_URL=redis://localhost:6379

# === Secrets (REQUIRED — generate your own) ===
SECRET_KEY=change-me-to-a-random-string
JWT_SECRET=change-me-to-a-random-string
```

## Step 6 — Fresh git history

No leaked history — old commits can carry secrets that were since removed
from the working tree but still live in git's object store. A single clean
initial commit is the only way to guarantee this without a history-rewrite
tool:

```bash
cd TARGET_DIR
git init
git add -A
git commit -m "Initial open-source release

Forked from private source. All secrets stripped, internal references
replaced with configurable placeholders. See .env.example for configuration."
```

## Step 7 — Generate `FORK_REPORT.md`

```markdown
# Fork Report: {project-name}

**Source:** {source-path}
**Target:** {target-path}
**Date:** {date}

## Files Removed
- .env (contained N secrets)

## Secrets Extracted -> .env.example
- DATABASE_URL (was hardcoded in docker-compose.yml)
- API_KEY (was in config/settings.py)

## Internal References Replaced
- internal.example.com -> your-domain.com (N occurrences in N files)
- /home/username -> /home/user (N occurrences in N files)

## WARNING-tier Matches Needing Manual Review
- [ ] {file}:{line} — high-entropy string, not auto-stripped

## Next Step
Run Phase 2 (sanitize/audit) — independent re-scan, does not trust this
report's claims.
```

## Output

Report to the user: files copied, files removed, files modified, count of
secrets extracted, count of internal references replaced, path to
`FORK_REPORT.md`. State plainly: **"Next: Phase 2 audit — it will re-scan
from scratch, this report is not the release gate."**

## Rules

- Never leave a secret in output, even commented out.
- Never remove functionality — parameterize, don't delete config wholesale.
- Always extract to `.env.example` for every stripped value.
- Always produce `FORK_REPORT.md`.
- When unsure whether something is a secret, treat it as one.
- Do not modify source code logic — only configuration, references, and
  the specific lines a secret/PII pattern matched.
