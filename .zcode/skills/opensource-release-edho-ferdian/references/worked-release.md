# Worked Release — a private repo made public, end to end

The three phases on one repo: what Phase 1 changes, what the independent
audit (Phase 2) runs and finds, and what Phase 3 produces. Commands are
read-only unless stated.

## The repo

`kasirku`: Next.js + Postgres, 14 months of history, deployed for one
client. Goal: publish the code as a template, keep the client's data and
keys out.

## Phase 1 — Fork / prep (on a copy, never the original)

```bash
git clone --mirror git@github.com:edho/kasirku.git kasirku-mirror.git
git clone kasirku-mirror.git kasirku-public && cd kasirku-public
```

Find secrets in the **working tree and history**:

```bash
npx --yes gitleaks detect --source . --log-opts="--all" --report-path ../gitleaks.json
rg -n --hidden -g '!node_modules' -e "sk_(live|test)_" -e "AKIA[0-9A-Z]{16}" -e "postgres(ql)?://[^ ]+:[^ ]+@" -e "-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY"
git log --all --diff-filter=D --name-only --pretty=format: | sort -u | rg -i "\.env|secret|credential|\.pem|\.key"
```

Findings in this run:

| Where | What | Action |
|---|---|---|
| `.env.production` (deleted 2025-03, still in history) | DB URL + Midtrans server key | Rotate both keys at the provider **now**; purge from history |
| `src/config.ts:4` | Hard-coded client domain and email | Replace with env vars |
| `prisma/seed.ts` | Real customer names and phones | Replace with fake data |
| `docs/client-notes.md` | Client pricing | Delete |

Rewrite history only on the copy:

```bash
pip install git-filter-repo
git filter-repo --path .env.production --path docs/client-notes.md --invert-paths
git filter-repo --replace-text ../replacements.txt     # lines like: literal:sk_live_abc123==>REDACTED
```

Or publish a **fresh history** (one initial commit) when the history isn't
worth keeping — simpler and safer.

Move configuration to `.env.example`:

```bash
# .env.example
DATABASE_URL=postgres://user:password@localhost:5432/kasirku
MIDTRANS_SERVER_KEY=          # from the Midtrans dashboard (sandbox key for development)
NEXT_PUBLIC_APP_NAME=Kasirku
```

`FORK_REPORT.md` lists every change made and why.

## Phase 2 — Independent audit (fresh eyes; must not read FORK_REPORT.md)

The auditor clones the prepared copy and checks from scratch:

```bash
npx --yes gitleaks detect --source . --log-opts="--all" --exit-code 1
npx --yes trufflehog git file://$PWD --only-verified --fail
rg -n --hidden -g '!node_modules' -i -e "password\s*=\s*['\"][^'\"]{6,}" -e "token\s*[:=]\s*['\"][A-Za-z0-9_\-]{20,}"
rg -n --hidden -g '!node_modules' -e "@[a-z0-9-]+\.(co\.id|com)" -e "08[0-9]{8,11}" src prisma docs   # client emails / phone numbers
npm ls --all --omit=dev >/dev/null && npx --yes license-checker --production --summary
git log --format='%an <%ae>' | sort -u                    # authors' emails will be public
```

Verdict format (gates the release):

```markdown
# Sanitize audit — kasirku-public @ 7c1e2f0
Verdict: FAIL

1. FAIL — prisma/migrations/20250114_seed_data/migration.sql inserts 12 real customers (names + phones).
2. WARN — commit author emails include a personal address (decide: keep or rewrite with a .mailmap + filter-repo).
3. PASS — no secrets in tree or history (gitleaks 0, trufflehog 0 verified).
4. PASS — dependency licenses compatible with MIT (no GPL in production deps).
```

FAIL sends it back to Phase 1. Release only on PASS.

## Phase 3 — Package

```text
README.md            what it is, screenshot, quick start, configuration table, deploy notes
LICENSE              MIT (chosen by the owner)
CONTRIBUTING.md      setup, tests, commit convention, PR process
CODE_OF_CONDUCT.md   Contributor Covenant
SECURITY.md          how to report a vulnerability (private email / GitHub advisories), supported versions
.github/ISSUE_TEMPLATE/bug_report.yml, feature_request.yml
.github/workflows/ci.yml   lint, typecheck, test on PRs
```

```markdown
## SECURITY.md (excerpt)
Please do not open public issues for security problems. Report them through
GitHub's "Report a vulnerability" (Security tab) or to security@<your-domain>.
We aim to reply within 3 working days.
```

Turn on, after publishing: secret scanning + push protection, Dependabot
alerts, branch protection for `main`, private vulnerability reporting.

## Final checklist before switching to public

- [ ] All exposed keys **rotated** (not just removed).
- [ ] Audit verdict PASS on the exact commit being published.
- [ ] Fresh clone → `cp .env.example .env` → quick start works.
- [ ] No client names, data, domains or pricing anywhere (code, seeds, tests, docs, images).
- [ ] License chosen by the owner and present; third-party notices kept where required.
- [ ] The original private repo stays private and untouched.
