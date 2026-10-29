# Full-audit attack classes

The class blocks Mode C (`full-audit.md`) assigns to coverage units. Each
bold heading is a block reference: `full-audit-attack-classes.md#<heading>`.
Copy the whole block into a hunter prompt, never just its name. Adapted from
the attack-class list in
[cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill)
(MIT, `c1c8a8c`), mapped onto this skill's SEC codes so findings keep one
vocabulary. Not every class applies to every codebase: pick from recon, and
split a large class per subsystem.

## Domain routing

Add the matching reference section to a unit when recon found the boundary
it describes:

| Recon found | Add |
|---|---|
| Database, ORM, RLS, migrations | `domain-specific.md` §Database |
| LLM, RAG, tool-calling agent, MCP | `domain-specific.md` §LLM & agent pipelines |
| Dockerfile / Compose | `domain-specific.md` §Containers |
| IaC, CI workflows, IAM, cloud config | `domain-specific.md` §Cloud, IaC & CI/CD |
| `CLAUDE.md`, harness settings, hooks, MCP config | `domain-specific.md` §Agent & AI-harness configuration |
| Clinical / PHI data | `domain-specific.md` §Healthcare |
| A named framework | `language-specific.md` section for it |

## Core classes

**Injection** (SEC-04, SEC-12) — trace untrusted input to a dangerous sink:
SQL/NoSQL queries, HTML output, shell commands, template engines, file
paths, redirects, deserializers, LDAP/XPath, log lines. Go past direct
paths: data stored safely and later used raw by different code (second
order); injection through field names, keys, headers and metadata, not only
values; injection into secondary systems — logs, caches, search indexes,
analytics.

**Access control** (SEC-03, SEC-05, SEC-14) — not "is there a check" but
"is it the right check, for the right resource, by the right mechanism".
Look for a second path to the same state change that checks a weaker
permission; request-body fields that override what the permission system
restricts; routes that authenticate but never authorize; one resource with
several access paths and inconsistent checks; bulk, batch, export and
import operations that skip per-item checks. For a complex model, split
authentication bypass and authorization logic into separate units.

**Resource and file handling** (SEC-01, SEC-12, SEC-17, SEC-19) — path
traversal including symlinks, encoded sequences and null bytes; SSRF
including redirects, DNS rebinding and URL-parser disagreements; unsafe
deserialization; archive extraction (zip slip); temp files; check-then-use
races on files.

**Cryptography and secrets** (SEC-02, SEC-06, SEC-10) — weak randomness for
tokens, keys or nonces; secrets hardcoded or leaking into logs, errors, URLs
or client-visible responses; broken key derivation, missing MAC checks,
nonce reuse; non-constant-time secret comparison; misused primitives (ECB,
unauthenticated encryption, static IVs); an error path that falls back to
no crypto at all.

**Business logic** — hand-hunted, because scanners cannot see it. Per major
workflow: skipped, repeated or reversed steps and replayed completed flows;
partial failure that leaves step 1 committed when step 2 fails; non-atomic
check-then-act with business impact (double spend, double approve, lost
update); negative, zero, overflowing or imprecise quantities and
string/number coercion; a restriction enforced on one operation but not on
another with the same effect; data trusted because "it was validated on the
way in" when another path wrote it; expiry, scheduling and rate-window edges
and clock or timezone skew; the security posture when config is missing, a
flag is off, a dependency is down, or a migration is half done.

**Feature abuse and data leakage** — legitimate features used for the wrong
purpose. Export, backup or snapshot that includes data above the caller's
access (other users', deleted, draft, pruned history); import or restore
that overwrites data or bypasses validation and permissions; search, filter
or sort that acts as an oracle for hidden records or fields; enumeration
through different errors, timings, sizes or status codes (password reset,
invite, registration); preview or draft tokens scoped too broadly, or
drafts reachable through search, feeds, sitemaps, listings or a CDN cache;
user-set webhook, callback or notification URLs fetched by the server
(SSRF, including after a redirect).

**Chained trust** — individually acceptable behaviour that breaks a later
component's stronger assumption. Map what a low-trust principal can read,
write, invoke and retain, then connect only concrete outputs to later trust
decisions. Compare what component A guarantees with what B assumes
(truncation, coercion, normalization, tenant scope). Watch second-order use
(a field name becomes a JSON path, a slug a file path, escaped text enters
raw rendering, a stored string becomes a URL, regex, template or policy),
capability growth after delegation, refresh, caching or role change, stale
state across revoke/expiry windows, and undelete, restore or rollback that
skips current ownership and authorization checks. Confirm every link; never
assume the downstream effect.

## Breadth classes

**Wildcard** — no category given: find what the classes above miss. The
strangest code and why it exists; half-finished, experimental or bolted-on
features; API calls the UI never makes; undocumented routes, parameters and
headers in route registrations, middleware and config; features mixed in
ways nobody designed for (localization + preview + caching, import +
plugins + webhooks, OAuth + impersonation + API keys); git history with
reverted security fixes, commented-out checks, or secrets committed then
removed; valid-account actions that hit other users, shared integrity or
operator cost; irreversible actions whose approval is not bound to the
final principal, action and resource; environment assumptions (local
database, accurate clock, trusted DNS, case-sensitive filesystem); and
what the tests do *not* cover. Verify every "this is safe because" comment;
read anything named `temp`, `hack` or `legacy` closely. Same evidence bar
as every other class.

**Obvious things** — the basics everyone assumes someone else checked. Be
literal and thorough; report each item's result:

- secrets in source (`password`, `secret`, `apikey`, `token`, `Bearer`,
  `-----BEGIN`, default passwords) and `.env`, `credentials.json`, `*.pem`,
  `*.key` files in the repo; a `.gitignore` that misses secrets, uploads or
  local config;
- `TODO`/`FIXME`/`HACK` comments about auth, validation or permissions;
- debug or dev mode switchable in production by env var, query parameter or
  header; seed or example credentials that work in production;
- unprotected `/debug`, `/admin`, `/test`, `/status`, `/health`,
  `/metrics`, `/env`, `/.env`, `/config`;
- unpinned dependencies and known CVEs in the lockfile;
- `eval`, `exec`, `child_process`, `Function()`, `vm`, dynamic `import()`
  fed by input;
- CORS `*`, or credentials allowed with a reflected or wildcard origin;
- cookies missing `HttpOnly`, `Secure` or `SameSite`;
- open redirects through `redirect`, `return`, `next`, `url`, `goto`,
  `continue` parameters;
- TLS not enforced; stack traces, internal paths or SQL errors in
  production responses.

A flag is not a finding: trace the impact first. A cookie without
`HttpOnly` matters only if it holds something sensitive and the script does
not need to read it by design.
