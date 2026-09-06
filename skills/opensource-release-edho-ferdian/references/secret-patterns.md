# Secret & Sensitive-Data Patterns — Single Source of Truth

Adapted from ECC `opensource-forker` + `opensource-sanitizer`, fetched
2026-09-04.

**Why this file exists as its own file.** ECC ships this same regex family
twice — once inline in `opensource-forker.md` (Phase 1, extraction) and
again inline in `opensource-sanitizer.md` (Phase 2, verification) — as two
independently-maintained copies. `02-gap-analysis.md` flagged this as a
drift bug: the two lists were already slightly different (the sanitizer's
API-key pattern is broader than the forker's, the sanitizer added a
DB-credential-in-URL pattern the forker's DB pattern doesn't require). If
one list gets a pattern added later and the other doesn't, Phase 1 stops
extracting something Phase 2 still flags, or worse, Phase 2 stops catching
something Phase 1 never stripped.

**Rule for this skill:** both Phase 1 (`fork-prep.md`) and Phase 2
(`sanitize-audit.md`) read patterns from *this file only*. Neither phase
keeps its own inline copy. Updating a pattern means editing this file once.

---

## CRITICAL — secrets (any match blocks release)

### Generic key/token/secret assignment

```
[A-Za-z0-9_]*(KEY|TOKEN|SECRET|PASSWORD|PASS|API_KEY|AUTH)[A-Za-z0-9_]*\s*[=:]\s*['"]?[A-Za-z0-9+/=_-]{8,}
```

### AWS credentials

```
AKIA[0-9A-Z]{16}
(?i)(aws_secret_access_key|aws_secret)\s*[=:]\s*['"]?[A-Za-z0-9+/=]{20,}
```

### Database connection URLs

```
(postgres|mysql|mongodb|redis)://[^\s'"]+
```

Stricter variant for the audit pass (Phase 2) — a connection string is only
a confirmed secret when it embeds actual credentials, not just a scheme:

```
(postgres|mysql|mongodb|redis)://[^:]+:[^@]+@[^\s'"]+
```

### JWT tokens (3-segment: header.payload.signature)

```
eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+
```

### PEM private keys

```
-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----
```

### GitHub tokens

```
gh[pousr]_[A-Za-z0-9_]{36,}
github_pat_[A-Za-z0-9_]{22,}
```

### Google OAuth

```
GOCSPX-[A-Za-z0-9_-]+
[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com
```

### Slack webhooks

```
https://hooks\.slack\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[A-Za-z0-9]+
```

### SendGrid / Mailgun

```
SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}
key-[A-Za-z0-9]{32}
```

### Generic `.env`-style secret line (manual review — do not auto-strip blind)

```
^[A-Z_]+=((?!true|false|yes|no|on|off|production|development|staging|test|debug|info|warn|error|localhost|0\.0\.0\.0|127\.0\.0\.1|\d+$).{16,})$
```

This one over-matches on purpose (any long non-boolean/non-obvious value on
a `KEY=value` line). Treat every hit as a candidate to inspect, not an
automatic strip — false positives here are cheap, false negatives are not.

---

## CRITICAL — PII (added in this ecosystem's adaptation; ECC's list did not
## treat these as CRITICAL)

### Personal email addresses

```
[a-zA-Z0-9._%+-]+@(gmail|yahoo|hotmail|outlook|protonmail|icloud)\.(com|net|org)
```

Generic role addresses (`noreply@`, `info@`, `support@`, `hello@` on a
project's own domain) are not PII — only free-mail personal addresses and
personal addresses on a private domain.

### Phone numbers

```
(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}
```

High false-positive rate (matches version strings, IDs) — always confirm by
reading surrounding context before flagging as CRITICAL; don't auto-flag on
regex match alone for this one.

### Private IP addresses (infrastructure fingerprinting, not identity PII,
### but grouped here because it leaks who/where, not just what)

```
(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)
```

CRITICAL unless the value is already documented as a placeholder in
`.env.example` (i.e. it's clearly an example, not a real leaked address).

### SSH connection strings

```
ssh\s+[a-z]+@[0-9.]+
```

### Absolute paths naming a real person/machine

```
/home/[a-z][a-z0-9_-]*/          # anything other than /home/user/
/Users/[A-Za-z][A-Za-z0-9_-]*/   # macOS
C:\\Users\\[A-Za-z]              # Windows
```

---

## WARNING — heuristics (manual review, does not alone fail the release)

### High-entropy strings

A string with no dictionary structure and high character diversity is
*plausibly* a secret even if it doesn't match a known vendor's format
(homegrown tokens, internal API keys, unrecognized third-party formats).

Practical heuristic (no external entropy library required): flag a
`KEY=value`-shaped line where the value is ≥32 characters, uses 3+ of
{uppercase, lowercase, digit, symbol} character classes, and doesn't match
a known safe pattern (UUID-shaped, a version string, a hex color, base64 of
an obviously non-secret asset). Where a proper Shannon-entropy check is
available (e.g. via a secret-scanning tool in the environment), prefer it —
this regex heuristic is the fallback when no such tool is present.

```
^[A-Z_]+=[A-Za-z0-9+/=_-]{32,}$
```

### Internal domain / hostname references

```
[a-z0-9-]+\.(internal|corp|local)\b
```

Not every match is sensitive (some are legitimately generic), but every
match is worth a human glance before shipping.

---

## Dangerous files (existence alone = FAIL, no regex needed)

```
.env, .env.local, .env.production, .env.development, .env.*.local
*.pem, *.key, *.p12, *.pfx, *.jks
credentials.json, service-account*.json
.secrets/, secrets/
.claude/settings.json
sessions/
*.map                              # source maps expose original file paths
node_modules/, __pycache__/, .venv/, venv/
```

---

## Internal-reference replacement map (Phase 1 uses this to rewrite, Phase 2
## uses the same list to confirm nothing was missed)

| Pattern | Replacement |
|---------|-------------|
| Custom internal domains | `your-domain.com` |
| Absolute home paths (`/home/username/`, `/Users/name/`, `C:\Users\name`) | `/home/user/`, `$HOME/`, or a generic placeholder |
| Secret file references (`~/.secrets/`) | `.env` |
| Private IPs (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`) | `your-server-ip` |
| Internal service URLs | Generic placeholders |
| Personal email addresses | `you@your-domain.com` |
| Internal GitHub org names | `your-github-org` |
| Internal hostnames (`*.internal`, `*.corp`, `*.local`) | `your-internal-host` |

---

## Maintenance rule

If a new pattern is needed (a new vendor's token format, a new PII shape),
add it here once, under the correct severity heading, then confirm both
`fork-prep.md` (Phase 1) and `sanitize-audit.md` (Phase 2) still say "see
this file" rather than re-embedding the pattern — that's the drift bug this
file exists to prevent.
