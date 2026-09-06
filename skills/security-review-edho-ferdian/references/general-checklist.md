# General Security Checklist (SEC-01..13)

Migrated verbatim (SEC-01..10) from `code-review-edho-ferdian/references/
review-checklist.md` Domain 2, which is where these codes originated —
moved here as the single source of truth so every other file in the
ecosystem cross-references this one instead of holding its own copy. The
code IDs are unchanged so existing cross-references (`SEC-04`, `SEC-06`,
`SEC-04a..d`, `SEC-08`, etc.) elsewhere in the ecosystem keep working.
SEC-11..13 are new additions, folded in from ECC's original
`security-reviewer` definition (OWASP categories not yet represented in the
ported content) — see the Provenance note in `SKILL.md`.

This checklist works for **any stack**. Stack-specific security items (React,
Python, FastAPI, Django) live in `references/language-specific.md`.
Domain-specific security items (database, healthcare, RAG, ML) live in
`references/domain-specific.md`.

---

- **SEC-01 Input sanitization** — all user input sanitized before use/storage?
  Also covers **SSRF** — `fetch(userProvidedUrl)` or an equivalent
  server-side request built from unvalidated user input, with no allowlist of
  permitted domains/schemes.
- **SEC-02 Secret exposure** — API keys, passwords, tokens in code? (verify
  with a secret scanner in Phase 2 — `gitleaks`, `trufflehog`.)
- **SEC-03 Auth check** — every protected route/function checks authn/authz?
- **SEC-04 Injection** — SQL injection, XSS, or command injection risk?
  Also covers **race conditions on concurrent decrement** — a balance/quota
  check performed without a row lock (`FOR UPDATE` inside a transaction)
  before decrementing lets concurrent requests both pass the check against a
  stale read. Database-specific concurrency findings land as **SEC-04a..d** —
  see `references/domain-specific.md` §Database.
  Also covers **dynamic SQL identifiers**, which parameterization cannot
  protect: a column name, table name, `ORDER BY` field, or sort direction
  taken from user input has to be interpolated into the query string —
  placeholders only bind *values*. `ORDER BY ?` is not valid SQL. The only
  correct control is an explicit allowlist checked before interpolation
  (`%allowed = map { $_ => 1 } qw(name email created_at)` / a Python `set` /
  a TS union type), plus a separate allowlist for `ASC`/`DESC`. Flag any
  sort/filter/column parameter that reaches the query string without one —
  this is a distinct finding from ordinary value injection and is frequently
  missed because the surrounding code looks parameterized. Source: ECC
  `perl-security`, `laravel-security` (`orderByRaw($userInput)`,
  `groupByRaw($userInput)`).
- **SEC-05 IDOR** — can a user reach another user's resource by changing an ID?
- **SEC-06 Sensitive data** — passwords/PII not sent to client or logged?
  Never place sensitive identifiers — session tokens, PHI, PII — in URL
  parameters or query strings: they leak into server logs, browser history,
  and `Referer` headers even over HTTPS.
  Also: **private files served by a permanent public URL**. A document, export,
  or upload that is confidential should not be reachable at a guessable or
  permanently valid URL on a public bucket/`public/` directory — use a
  short-lived signed URL generated after an authorization check (S3 presigned,
  `Storage::temporaryUrl`, Supabase signed URL), and store the file outside
  any directly web-served path. A signed URL without a preceding authorization
  check is still a finding — the signature proves the URL was issued, not that
  this caller was entitled to it.
  Also: **sensitive fields in background-job / queue payloads**. Queue
  backends persist the serialized job (Redis, a DB table, SQS) and it is often
  readable by anyone with infra access and visible in job-failure dashboards.
  Pass an identifier and re-fetch inside the job, or encrypt the payload
  (Laravel `ShouldBeEncrypted`, or explicit encryption elsewhere) — never put
  a raw card number, password, full PHI record, or API token in a job
  constructor. Source: ECC `laravel-security`.
- **SEC-07 Dependency risk** — known-vulnerable libraries imported? (verify
  with `npm audit` / `pip-audit` / equivalent in Phase 2.)
- **SEC-08 Rate limiting** — abusable endpoints rate-limited? Stack-specific
  rate-limiting/throttling notes (e.g. Django auth-endpoint throttling) live
  in `references/language-specific.md`.
- **SEC-09 CORS/CSRF** — overly permissive CORS or missing CSRF protection?
  **False-positive trap:** CSRF disabled on a *stateless* API that
  authenticates purely with an `Authorization: Bearer` header is correct, not
  a finding — CSRF requires the browser to attach credentials automatically,
  which a manually-set header never is. The finding is CSRF disabled on
  anything that authenticates via cookie or session, including
  "API-looking" routes under `/api/*` that use cookie-based SPA auth (Laravel
  Sanctum stateful mode, Django session auth on DRF). Check *how the route
  authenticates* before flagging, not what it is named. Source: ECC
  `springboot-security` ("CSRF posture correct for app type"),
  `laravel-security` ("avoid blanket `api/*` exclusion — stateful Sanctum
  routes need CSRF").
- **SEC-10 Token handling** — tokens stored safely with correct expiry?
  Also covers **session fixation**: the session identifier must be
  regenerated at every privilege transition — successful login, step-up
  auth/MFA, impersonation start and stop, and role change — and invalidated
  on logout. Without regeneration, an attacker who plants a known session ID
  in the victim's browser before login holds a valid authenticated session
  afterwards. Look for the framework's explicit call
  (`$request->session()->regenerate()`, `django.contrib.auth.login()` which
  cycles the key for you, `req.session.regenerate()`, Spring Security's
  `sessionFixation().migrateSession()` default) — a hand-rolled login flow
  that sets a user id into an existing session and returns is the finding
  shape. Logout must call both invalidate and token regeneration, not just
  clear the user id. Source: ECC `laravel-security`.

### New — folded in from ECC's original OWASP-style categories

- **SEC-11 Security misconfiguration** — default credentials left unchanged;
  debug mode enabled in production (`DEBUG=True`, verbose stack traces
  returned to clients); missing security headers (`Content-Security-Policy`,
  `X-Frame-Options`, `Strict-Transport-Security`, `X-Content-Type-Options`);
  unnecessary services/ports/features exposed; directory listing enabled;
  default error pages that leak framework/version info.
  On CSP specifically: a header that merely exists is not sufficient. Start
  from a strict baseline and treat every loosening as documented, temporary
  compatibility debt:
  `default-src 'self'; base-uri 'self'; object-src 'none';
  frame-ancestors 'none'; script-src 'self'; style-src 'self';
  img-src 'self' data: https:; font-src 'self'; connect-src 'self'`.
  Flag `'unsafe-inline'` or `'unsafe-eval'` in **`script-src`** as a real
  weakness — they neutralize most of what CSP buys you; the fix is a nonce or
  hash, not the wildcard. `'unsafe-inline'` in `style-src` is a common,
  much lower-severity concession when a CSS framework requires it — do not
  flag both at the same severity. Missing `frame-ancestors`/`object-src`
  is a MEDIUM gap even when `default-src` is set, because neither falls back
  to `default-src` in every browser. Note that `X-XSS-Protection` is a
  deprecated header that modern browsers ignore — its **absence is not a
  finding**, and recommending it is itself a false positive. Source: ECC
  `security-review`, `quarkus-security`, `django-security`.
- **SEC-12 XXE / insecure deserialization (general)** — an XML parser
  configured to resolve external entities (XXE); any deserialization of
  untrusted data using a format/library capable of executing code during
  deserialization. This is the general/cross-stack version of the concept —
  language-specific primitives that fall under this category (Python's
  `pickle`/`yaml.load`) are detailed in `references/language-specific.md`
  under SEC-08 there; don't double-count the same finding under both codes,
  cross-reference instead.
- **SEC-13 Insufficient logging & monitoring** — security-relevant events
  (failed auth attempts, permission denials, input-validation failures,
  admin actions) not logged at all, or logged without enough context to
  investigate an incident after the fact; no alerting wired to any of it.
  Distinct from SEC-06 (which is about *not* logging sensitive data) — this
  is about making sure the *right* events *are* logged, without leaking
  secrets while doing it.

### New — folded in from ECC's per-stack security skills

- **SEC-14 Mass assignment / over-posting** — a create/update path that binds
  a whole request body straight onto a model or entity, letting a client set
  fields it was never meant to control (`role`, `is_admin`, `is_verified`,
  `balance`, `owner_id`). The finding shape is framework-independent: Laravel
  `Model::create($request->all())` with `$guarded = []`; Django/DRF a
  serializer with `fields = '__all__'` on a writable path; Rails
  `params.permit!`; Spring `@ModelAttribute` on an entity instead of a DTO;
  Express/Prisma `prisma.user.update({ data: req.body })`. Require an explicit
  allowlist of writable fields (a validated DTO, `$fillable`, explicit
  `fields = [...]`) and never a denylist. Source: ECC `laravel-security`,
  `springboot-security`.
  Cross-reference: the Django-specific instance is already recorded under
  `language-specific.md` §Django (`fields = '__all__'`) — file it once, under
  whichever code the host report is using, not both.

- **SEC-15 Client-identity / proxy-header spoofing** — any security decision
  made from a header the client itself can set. Most common: rate limiting,
  IP allowlists, geo-gating, or audit logs keyed on `X-Forwarded-For` /
  `X-Real-IP` when the app is not behind a proxy that overwrites it, or when
  the trusted-proxy list is a wildcard. A client can send any value for those
  headers, so an attacker rotates them and the rate limit becomes decorative.
  Fix: derive identity from the transport-level remote address, or from an
  authenticated identity (session, API key, JWT subject) where available; if
  a real proxy sits in front, configure an explicit trusted-proxy CIDR list
  (never `*`) so the framework strips and rewrites the header itself. The
  same rule applies to `X-Forwarded-Proto` used to decide "is this request
  HTTPS" — a spoofed value can defeat an HTTPS redirect. Source: ECC
  `quarkus-security` ("Never use X-Forwarded-For directly — clients can spoof
  it"), `laravel-security` (`trusted_proxies` must be specific CIDRs).

- **SEC-16 ReDoS (catastrophic regex backtracking)** — a regular expression
  with nested quantifiers over overlapping character sets, evaluated against
  attacker-controlled input, can take exponential time and hang the request
  thread (a single-request DoS). Flag patterns of the shape `(a+)+`,
  `([a-zA-Z]+)*`, `(.*?,){10,}`, or any `(X+)+` / `(X*)*` construction, and
  flag any regex compiled from user input at all. Fixes: rewrite without
  nesting (`^[a-zA-Z]+$`), use a possessive quantifier or atomic group
  (`^[a-zA-Z]++$`, `^(?>a+)$`) where the language supports it, anchor the
  pattern, cap input length before matching, or run the match under a timeout.
  Severity depends on reachability: HIGH on a public unauthenticated endpoint,
  MEDIUM behind auth, LOW in a build script. Source: ECC `perl-security`.

- **SEC-17 Path traversal** — a filesystem path built from user-controlled
  input (upload filename, download `?file=`, template/plugin name, archive
  entry name) without confining the resolved path to an intended base
  directory. `../` sequences, absolute paths, symlinks, and URL/Unicode
  encodings all reach outside. The correct check is **resolve then compare**:
  canonicalize the joined path (`realpath` / `Path.resolve()` /
  `os.path.realpath`) and reject unless the result is still prefixed by the
  canonicalized base directory plus a separator — a string check for `".."`
  before resolution is not sufficient and is itself a finding. Also covers
  **zip-slip**: extracting an archive entry whose name escapes the extraction
  root. Source: ECC `perl-security`, `security-bounty-hunter` (CWE-22, listed
  as reliably in-scope for bounty programs).

- **SEC-18 Open redirect** — a redirect target taken from a request parameter
  (`?next=`, `?return_to=`, `?redirect_uri=`) and followed without validation.
  Used to make a phishing link look like it originates from a trusted domain,
  and — when the parameter feeds an OAuth/SSO `redirect_uri` — to steal an
  authorization code or token. Fix: allowlist the permitted destinations, or
  accept only same-origin relative paths (reject anything containing a scheme
  or starting with `//`, which is protocol-relative and leaves the origin).
  Source: ECC `perl-security` (listed as an anti-pattern:
  `print $cgi->redirect($user_url)`).

- **SEC-19 TOCTOU & insecure temporary/predictable file creation** — a
  check-then-act sequence on the filesystem (`if not exists → create`,
  `if writable → write`) that another process can win the race on, or a
  temporary file created at a predictable path in a world-writable directory
  (`/tmp/myapp-cache`, `/tmp/upload-<pid>`), which lets a local attacker
  pre-create it or plant a symlink and redirect the write. Fix: create
  atomically and exclusively (`O_CREAT | O_EXCL` with restrictive mode
  `0600`), or use the platform's secure temp-file API (`tempfile.mkstemp`,
  `File::Temp`, `os.CreateTemp`) which does this for you; use an advisory
  lock (`flock(LOCK_EX)`) rather than an existence check where mutual
  exclusion is the actual requirement. Lower priority for pure web apps,
  real for CLI tools, build scripts, and anything running as a privileged
  service. Source: ECC `perl-security`.

---

## Pattern quick-reference (from ECC `security-reviewer`)

Treat a hit on any of these as a strong prior, but still confirm before
labeling High confidence per the ground-truth rule in `SKILL.md` Phase 2:

| Pattern | Severity | Fix |
|---|---|---|
| Hardcoded secrets | CRITICAL | Use environment variables / a secret manager |
| Shell command built with unsanitized user input | CRITICAL | Use safe APIs or an argument-array exec, never string-built shell commands |
| String-concatenated SQL | CRITICAL | Parameterized queries / query builder |
| `innerHTML = userInput` (or equivalent unescaped sink) | HIGH | Use `textContent`, or sanitize with DOMPurify/equivalent |
| `fetch(userProvidedUrl)` / server-side request from user input | HIGH | Allowlist permitted domains/schemes (SEC-01 SSRF) |
| Plaintext password comparison | CRITICAL | Use `bcrypt.compare()` / `argon2.verify()` |
| No auth check on a route | CRITICAL | Add authentication middleware/dependency |
| Balance/quota check without a row lock | CRITICAL | Use `FOR UPDATE` inside a transaction |
| No rate limiting on an abusable endpoint | HIGH | Add rate limiting (SEC-08) |
| Logging passwords/secrets/PII | MEDIUM–HIGH | Sanitize log output (SEC-06/SEC-13) |

## Severity guidance

Use the shared 5-level scale defined in `SKILL.md` (`CRITICAL/HIGH/MEDIUM/
LOW/INFO`) — the same scale `code-review-edho-ferdian` uses, so a delegated
Mode B finding slots directly into the host report without translation.

## Reachability gate (before assigning HIGH/CRITICAL)

Adapted from ECC `security-bounty-hunter` (fetched 2026-09-04). Severity is a function of the
*path*, not the pattern. Before promoting a finding to HIGH or CRITICAL,
answer all four — if any is "no", cap the finding at MEDIUM and say why:

1. Is the sink reachable from a network or user boundary (HTTP handler,
   upload, webhook, queue consumer fed by external data, parser of a
   user-supplied file)? Or is it CLI-only / local-only / build-time?
2. Is the input genuinely attacker-controlled end to end, or does it pass
   through a validated allowlist somewhere in between?
3. Is the sink meaningful — does reaching it actually achieve something
   (data read/write, code execution, auth bypass)?
4. Is this production code, or a test/fixture/demo/vendored file?

Patterns that are usually **not** worth a HIGH on their own, per this gate:
local-only `pickle.loads`/`torch.load` with no remote path; `eval()`/`exec()`
in a CLI-only tool; `shell=True` on a fully hardcoded command; a missing
security header in isolation; a rate-limiting gap with no described abuse
impact; self-XSS that requires the victim to paste code into their own
console. State the reachability verdict inline in the finding rather than
silently downgrading.

| SEC code | CWE | Typical impact when reachable |
|---|---|---|
| SEC-01 (SSRF half) | CWE-918 | Internal network access, cloud metadata credential theft |
| SEC-03 / SEC-05 | CWE-287 / CWE-639 | Unauthorized account or data access |
| SEC-04 (SQL) | CWE-89 | Data exfiltration, auth bypass, destruction |
| SEC-04 (command) | CWE-78 | Code execution |
| SEC-04 (XSS) | CWE-79 | Session theft, admin account compromise |
| SEC-12 | CWE-502 | Code execution via deserialization / upload-to-RCE |
| SEC-16 | CWE-1333 | Single-request denial of service |
| SEC-17 | CWE-22 | Arbitrary file read or write |
| SEC-18 | CWE-601 | Phishing origin laundering, OAuth code theft |
| SEC-19 | CWE-367 / CWE-377 | Local privilege escalation, file overwrite |
