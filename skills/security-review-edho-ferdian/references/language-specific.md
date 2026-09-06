# Stack-Specific Security Checklist

Migrated from the security-relevant items in `language-code-review-edho-
ferdian/references/{react,python,python-fastapi,python-django}.md`. Those
files keep their non-security content (idiom/performance lenses) in place —
this file is now the single source of truth for the security items that used
to live inline alongside them.

**Stack detection.** Detected via the **same manifest signals** already
established in `language-code-review-edho-ferdian/SKILL.md` — this file does
not duplicate that detection table. In short: `package.json` with
`react`/`react-dom` → React section below; `manage.py`/`settings.py` →
Django section; a FastAPI import → FastAPI section (load after the base
Python section); `@nestjs/core`/`@nestjs/common` + `nest-cli.json`/Nest
decorators → Node/NestJS section; `@angular/core` in `package.json` →
Angular section; any `.py` file → Python section as the baseline.

**Code placement.** Findings from this file land as **SEC-08** (stack-
specific security) in whichever host report is running — `code-review-edho-
ferdian`'s Domain 2 in Mode B, or this skill's own report in Mode A.

---

## React / JSX / TSX

Source: ECC `react-reviewer`.

### CRITICAL

- **`dangerouslySetInnerHTML` with unsanitized/user-controlled input** — no
  DOMPurify or equivalent allowlist sanitizer at the same call site.
- **`href`/`src` built from a user-controlled value without scheme
  validation** — `javascript:` and `data:` URLs execute in the browser
  context.
- **Server Action (`"use server"`) accepting `FormData` or arguments without
  schema validation** (zod/yup/valibot) — treat any Server Action as a public
  API endpoint that happens to look like a function call.
- **Server Action without an authorization check** — schema-validated input
  is not the same as confirming the caller is allowed to perform the
  operation.

### HIGH

- **Secret or server-side value leaked into the client bundle** —
  `NEXT_PUBLIC_*`, `VITE_*`, `REACT_APP_*`, or any client-imported env var
  holding a private key, token, or server-only credential. Anything with
  that prefix ships to every browser.
- **`loadEnv(mode, cwd, '')` (empty third argument) in `vite.config.ts`** —
  a distinct leak mechanism from the prefix rule above, not the same finding
  restated. Vite's `loadEnv` normally only loads `VITE_`-prefixed vars; an
  empty string (or omitted) third argument disables that filter and loads
  **every** env var in scope, including server-only secrets (database URLs,
  API keys) sitting in the same `.env` file. Those then become eligible for
  inlining into the client bundle via `define`, even though they were never
  meant to be public. Source: ECC `vite-patterns`. Fix: pass an explicit
  prefix list, e.g. `loadEnv(mode, cwd, ['VITE_', 'APP_'])`. The same class
  of risk applies to `envPrefix: ''` in the Vite config itself — an empty
  custom `envPrefix` removes the `VITE_` gate entirely, exposing all env vars
  to `import.meta.env` on the client. Flag both the `loadEnv` empty-prefix
  call and an `envPrefix: ''` config value as the same finding shape.
- **Session/auth tokens stored in `localStorage`/`sessionStorage`** —
  readable by any successful XSS; httpOnly cookies aren't.
- **Server-only import inside a Client Component** — a `"use client"` file
  importing a module marked `server-only` or a DB client whose root import
  carries credentials.
- **Sensitive full-record prop passed from Server to Client Component** — a
  Server Component passing an entire user record (hashed password, tokens)
  down to a Client Component that only needed the display name.

### False-positive traps

- `dangerouslySetInnerHTML` fed by content that is sanitized upstream (e.g. a
  CMS pipeline that already runs the HTML through a sanitizer before it
  reaches this component) is not a finding if the sanitization step is
  verifiable in the codebase — trace it before assuming it's missing.
- A Server Action that reads `cookies()`/`headers()` and checks a session
  itself does have an auth check, even if there's no separate
  `requireAuth()` helper call — look for the actual behavior, not a specific
  function name.

**Non-security React findings** (hooks, render performance, `key={index}`,
accessibility) stay in `language-code-review-edho-ferdian/references/
react.md` and `code-review-edho-ferdian/references/accessibility-lens.md` —
not duplicated here.

### HIGH (additional)

- **Prototype pollution via object spread of attacker-controlled JSON** —
  merging an untrusted request body directly into an object with
  `{...untrusted}` (or `Object.assign({}, untrusted)`) can set `__proto__`/
  `constructor`/`prototype` keys if the source JSON contains them, polluting
  the shared prototype for every object in the process. Validate against a
  schema (zod/yup/valibot) first and only spread the validated, known-shape
  result — never spread a raw request body straight into a config/options
  object. *(adapted from ECC rules/react/security.md, fetched 2026-09-06)*
- **Source maps served in production** — generating and deploying `.map`
  files to the public origin exposes original source, file paths, and
  internal comments to anyone who requests them. Generate source maps for
  the error tracker's own ingestion (Sentry, etc.) but do not deploy them to
  the publicly reachable origin. *(adapted from ECC rules/react/security.md,
  fetched 2026-09-06)*

---

## Python (base)

Source: ECC `python-reviewer`.

### CRITICAL

- **Unsafe deserialization of untrusted data** — `pickle.load`/`pickle.loads`
  on data that could originate outside the process (a request body, a queue
  message, a file uploaded by a user), or `yaml.load()` without
  `Loader=yaml.SafeLoader`/`yaml.safe_load()`. Both can execute arbitrary
  code during deserialization. (Cross-reference: general SEC-12.)
- **`eval()`/`exec()` on any value influenced by external input** — even
  indirectly (a config value read from a database row a user can edit).
- **Weak cryptographic hash used for a security purpose** — MD5 or SHA1 used
  for password hashing, token generation, or signature verification (not
  merely as a non-security checksum/cache key, which is fine). Use
  `bcrypt`/`argon2`/`scrypt` for passwords, `hmac` with SHA-256+ for
  signatures.

### Ground-truth

```bash
bandit -r .        # confirms eval/exec/pickle/yaml/weak-crypto findings
pip-audit          # dependency risk (SEC-07)
```

Do not label a `bandit`-detectable finding [High confidence] without
actually running `bandit` — reading the line and recognizing the pattern is
reasoning, not verification.

### False-positive traps

- `Any` on a function parameter that receives genuinely heterogeneous,
  validated-just-before-use JSON (e.g. straight off `request.json()` before a
  Pydantic model validates it) is a correct boundary type, not a finding —
  not a security issue at all, noted here only to avoid conflating it with
  SEC-01 input-sanitization findings, which apply at the point of use, not
  the point of receipt.

**Non-security Python findings** (mutable defaults, bare except, typing,
idiom) stay in `language-code-review-edho-ferdian/references/python.md`.

---

## Python / FastAPI

Source: ECC `fastapi-reviewer`. Requires the base Python section above.

### CRITICAL

- **Auth dependency that doesn't validate token expiry or signature** — a
  `Depends(get_current_user)` that decodes a JWT without verifying `exp` or
  the signature (or trusts an unverified claim) is not actually
  authenticating anyone.
- **Password hash or raw token fields present in a response model** — a
  Pydantic response schema that includes `hashed_password`, `password`, a
  refresh/access token, or any other secret field that will get serialized
  into the HTTP response body.
- **`allow_origins=["*"]` combined with `allow_credentials=True`** in
  `CORSMiddleware` — the CORS spec forbids the browser from honoring this
  combination safely; in practice it either silently fails or, on
  misconfigured proxies, allows any origin to make credentialed requests.

### False-positive traps

- `allow_origins=["*"]` **without** `allow_credentials=True` is a much lower
  severity (open API intentionally public) — don't conflate it with the
  credentialed combination above; check both settings together before
  flagging CRITICAL.

**Non-security FastAPI findings** (blocking I/O, missing timeout, pagination,
dependency-override mistakes) stay in `language-code-review-edho-ferdian/
references/python-fastapi.md`.

---

## Python / Django

Source: ECC `django-reviewer`. Requires the base Python section above.

### CRITICAL

- **`mark_safe()` on user-controlled input** — bypasses Django's automatic
  HTML escaping; requires an explicit `escape()` (or a trusted, sanitized
  source) first. Note `format_html()` as the correct path: `format_html('<span>{}</span>', value)`
  escapes its arguments automatically — safer than the manual
  `mark_safe(escape(x))` pattern, and it eliminates the whole class of
  mistake where `escape()` is forgotten on one argument.
- **`{{ value|safe }}` template filter on user-controlled input** — the
  template-side equivalent of `mark_safe()` above; same escaping bypass, just
  triggered from a Django template instead of Python code. Also flag a value
  interpolated into an inline `<script>` block without the `|escapejs`
  filter — `|safe`/no filter in that context allows breaking out of the
  script string, not just the HTML tag.
- **`@csrf_exempt` on a non-webhook view** — CSRF protection removed from an
  endpoint that isn't a third-party webhook receiver (which can't send
  Django's CSRF token) is a deliberate hole; verify the actual justification
  before accepting it.
- **`DEBUG = True` in a production settings module** — leaks full stack
  traces, local variable values, and settings to any error response.
  (Cross-reference: general SEC-11 misconfiguration.)
- **Hardcoded `SECRET_KEY`** — must come from an environment variable/secret
  manager; a key committed to source is compromised the moment the repo is
  cloned.
- **`eval()`/`exec()` on any request-influenced value** — same rule as the
  base Python section, called out again here because it shows up
  disproportionately in Django template/admin customization code.
- **`User.objects.raw()` or `.extra()` with f-string/`.format()`/`%`
  interpolation of request-influenced values** — Django's ORM has its own
  SQL-injection escape hatch: `.raw()` and `.extra()` bypass the ORM's
  automatic parameterization the same way string-concatenated SQL does in any
  other stack. This is the Django-specific call site for the general
  SQL-injection check already covered by **general SEC-04** — don't file the
  same finding twice; use SEC-04 for the general injection concept and note
  this API here as the Django-specific place it shows up. Always use the
  `params`/`[...]` positional-argument form (`.raw('... WHERE x = %s', [x])`)
  instead of building the query string first.
- **File upload validated by extension or declared MIME type only** — an
  extension check (`.jpg`, `.pdf`) or a client-declared `Content-Type` is
  trivially bypassed by renaming a `.php`/`.exe`/`.sh` payload before upload;
  neither reflects what the file actually contains. Require validation by
  **magic bytes** (the file's real content signature, e.g. via `python-magic`
  or the pure-Python `filetype` package) against an explicit allowlist of
  MIME types, then **cross-check the magic-byte-detected MIME type against
  the declared extension** and reject any mismatch (e.g. a file whose bytes
  say `image/gif` but is named `.jpg`). Extension/size checks alone are not a
  finding-clearing control, only a first-pass filter.
- **Missing `permission_classes` on a DRF view** — falls back to the
  project's global default, which may be more permissive than intended;
  every view's actual access requirement should be explicit, not implied.

### HIGH

- **`ALLOWED_HOSTS` containing `['*']` or not read from environment.** A
  wildcard disables Django's `Host` header validation, opening the door to
  Host-header poisoning: password-reset links and other absolute URLs get
  built from an attacker-controlled `Host`, and cache poisoning becomes
  possible. `ALLOWED_HOSTS` should be an explicit list of domains sourced
  from an environment variable, never a wildcard.
- **`fields = '__all__'` on a DRF serializer** — exposes every model column,
  including ones added later without anyone revisiting the serializer;
  explicit `fields = [...]` is the safer default.
- **Missing throttling on an authentication endpoint** (login, registration,
  password reset) — open to credential-stuffing/brute-force with no rate
  limit (SEC-08).
- **`AUTH_PASSWORD_VALIDATORS` missing or without a real `min_length`** —
  Django's own default `AUTH_PASSWORD_VALIDATORS` (when the setting is left
  unset entirely) is a much weaker bar than most projects assume; even when
  present, a `MinimumLengthValidator` with no `OPTIONS.min_length` override
  falls back to Django's default of 8, which most password policies consider
  too low. Flag when the setting is absent, or present without an explicit
  higher `min_length` (commonly 12+).
- **`PASSWORD_HASHERS` left at the PBKDF2 default for a new project instead
  of leading with Argon2** — Django's built-in default hasher order starts
  with PBKDF2; for a new project, `Argon2PasswordHasher` should be first in
  `PASSWORD_HASHERS` (with PBKDF2 kept later in the list for reading
  passwords hashed before the switch, not for hashing new ones). Not a
  CRITICAL on its own — PBKDF2 is not broken — but a real hardening gap worth
  flagging as HIGH when the project has no migration constraint forcing it.
- **`django.security` logger not configured** — an app with no `LOGGING`
  entry for the `django.security` logger loses visibility into
  `SuspiciousOperation`-derived events (bad `Host` header, CSRF failures,
  disallowed redirect targets, etc.) — these fire silently with no record to
  investigate after an incident. Flag as a **MEDIUM** observability gap
  (cross-reference general **SEC-13**), not HIGH — the events still occur and
  Django still rejects them, this is a detection gap, not an active
  vulnerability.
- **Missing Content-Security-Policy header** — no CSP configured (via
  `django-csp`, a custom middleware, or equivalent) leaves the app without a
  browser-enforced defense-in-depth layer against injected scripts even when
  templates escape correctly elsewhere. Cross-reference general **SEC-11**
  (missing security headers); flag alongside the other headers in
  "Deployment hardening" below rather than as a separate code.

### Deployment hardening

Ground-truth command — run this before labeling any finding in this
subsection **[High confidence]**:

```bash
python manage.py check --deploy
```

`check --deploy` directly flags the settings below; reading `settings.py` and
recognizing a missing value is reasoning (label **[Medium confidence]** at
most), the command's own warning output is verification.

- **`SECURE_SSL_REDIRECT` not `True`** — HTTP requests are served instead of
  redirected to HTTPS.
- **`SECURE_HSTS_SECONDS` unset (or `0`)**, and, once set, **missing
  `SECURE_HSTS_INCLUDE_SUBDOMAINS` and `SECURE_HSTS_PRELOAD`** — HSTS with no
  duration provides no protection; without subdomain coverage and preload, a
  subdomain or a user's first-ever request can still be downgraded to HTTP.
- **`SESSION_COOKIE_SECURE`, `SESSION_COOKIE_HTTPONLY`, and
  `SESSION_COOKIE_SAMESITE` not all set** — a session cookie sent over plain
  HTTP, readable from JavaScript, or attached to cross-site requests
  undermines session security regardless of how well the app itself validates
  auth.
- **`CSRF_COOKIE_SECURE`, `CSRF_COOKIE_HTTPONLY`, and
  `CSRF_COOKIE_SAMESITE` not all set** — same class of gap as the session
  cookie flags above, for the CSRF cookie specifically.
- **`SECURE_CONTENT_TYPE_NOSNIFF` not `True`** — allows the browser to
  MIME-sniff a response into an unintended content type (e.g. treating an
  uploaded file as executable script).
- **`X_FRAME_OPTIONS` not `'DENY'`** (or not set — Django's own default is
  `'DENY'`, but an explicit override to `'SAMEORIGIN'` or removal should be
  justified) — clickjacking exposure.
- **`CSRF_TRUSTED_ORIGINS` wildcarded or over-scoped** — an entry like
  `https://*.example.com` when only specific subdomains need it, or a
  wildcard scheme, widens the set of origins Django will accept
  unsafe-method requests from with a valid CSRF token; scope each origin to
  exactly what's needed.
- **MEDIUM — session lifetime configuration not made explicit.**
  `SESSION_COOKIE_AGE` left at Django's two-week default for an application
  handling sensitive data, with `SESSION_EXPIRE_AT_BROWSER_CLOSE` not even
  considered. Not an active vulnerability — flag as hardening.

### Ground-truth

```bash
bandit -r . -ll                 # medium+ severity: mark_safe, csrf_exempt, eval
python manage.py check --deploy # deployment-hardening settings above
```

### False-positive traps

- `fields = '__all__'` on a serializer that is genuinely internal-only
  (admin tooling behind staff-only permission classes, never exposed to a
  public API surface) may be an accepted convention — check the Reflection
  gate (CLAUDE.md / linter config / adjacent comment) before flagging.
- A `.raw()`/`.extra()` call that already uses the `params`/positional-`%s`
  form (not f-string/`.format()`/`%`-interpolated into the query string
  itself) is safe — Django parameterizes those the same way the ORM's normal
  query builder does; don't flag every `.raw()`/`.extra()` call, only ones
  building the SQL string via interpolation.
- A file-upload validator that already checks magic bytes (via
  `python-magic`/`filetype` or equivalent) and cross-checks against the
  declared extension is not a finding, even if it also happens to check
  extension/size as an additional first-pass filter — the upgrade requested
  here is "add magic-byte validation," not "remove extension checks."
- **`SECURE_BROWSER_XSS_FILTER`** still shows up in plenty of Django
  hardening guides, but it only controls the `X-XSS-Protection` header,
  which is obsolete and ignored by modern browsers. Its absence is not a
  finding — recommending it is the actual mistake.

**Non-security Django findings** (N+1 via `select_related`, migration
safety, `bulk_create`, business logic placement) stay in
`language-code-review-edho-ferdian/references/python-django.md`.

---

## Node / NestJS

Source: ECC `nestjs-patterns`, fetched 2026-09-06. **Not deferred** — unlike
PHP/Laravel and Java/Spring Boot below, this is an active section: NestJS is
the framework behind `ghostfolio`, a real project Edho runs (an Nx monorepo
alongside an Angular frontend). Detect the same way as
`language-code-review-edho-ferdian/SKILL.md`'s manifest table: `@nestjs/core`/
`@nestjs/common` in `package.json`, a `nest-cli.json` at the project root, or
`@Module`/`@Controller`/`@Injectable` decorators in scope, checked
per-project in a monorepo.

### CRITICAL

- **ORM entity returned directly from a controller with no response DTO/
  serializer, leaking `passwordHash`, `remember_token`, refresh/access
  tokens, or audit columns into the response body.** This is the **same
  finding shape** as the FastAPI CRITICAL above ("Password hash or raw token
  fields present in a response model") — don't create a new SEC code for it,
  this is the Nest instance of that same defect class: an ORM/DB layer's
  full row shape leaking straight to an HTTP response because no explicit
  response boundary (`class-transformer` `@Exclude()` + a registered
  `ClassSerializerInterceptor`, or a hand-written response DTO) sits between
  them. Full detail and the false-positive trap (confirm
  `ClassSerializerInterceptor` is actually registered before assuming an
  entity return is unprotected) is in
  `language-code-review-edho-ferdian/references/nestjs.md`'s CRITICAL/SEC
  item — this entry exists so a security-only review pass finds it without
  needing to load the language lens.

### HIGH

- **`ValidationPipe` registered without `whitelist: true` and
  `forbidNonWhitelisted: true` on a publicly reachable endpoint** — this is
  **instance SEC-14 (mass-assignment)**, the same generic code already used
  for Django's `fields = '__all__'`-style over-exposure elsewhere in this
  ecosystem's checklist. Without both options, extra properties on a request
  body pass through validation untouched and typically reach an ORM
  `create`/`update` call, letting a client set fields it should never
  control directly (`role`, `isVerified`, `balance`). A single global
  `ValidationPipe` (see the authoring-side canonical bootstrap in
  `backend-engineering-edho-ferdian/references/nestjs.md`) with both options
  set is the fix — per-route pipes that forget one or both options are the
  common way this regresses.
- **CORS misconfigured with a wildcard origin and credentials enabled** — the
  Nest instance of the same CORS misconfiguration already flagged for
  FastAPI (`allow_origins=["*"]` + `allow_credentials=True`) and Spring Boot
  (`setAllowedOrigins(List.of("*"))` + `setAllowCredentials(true)`) elsewhere
  in this file: `app.enableCors({ origin: '*', credentials: true })` (or
  equivalent config passed to `NestFactory.create(AppModule, { cors: {...} })`)
  is the same spec-forbidden combination — a browser should not honor
  credentialed requests from a wildcard origin, and a misconfigured proxy in
  front of the app may let it through anyway. Fix: an explicit origin
  allowlist (or a validating origin callback) whenever `credentials: true`
  is set.
- **A guard bypass via a missing or misapplied `@UseGuards()` on a new
  route** — a controller class carries `@UseGuards(JwtAuthGuard)` at the
  class level, but a route added later inside a *different* controller (or a
  route explicitly marked `@Public()`/exempted from a global guard) is
  reachable without authentication because the guard was never re-applied
  there. Nest does not enforce guards transitively across controllers; each
  controller (or each route, if guards are applied at the method level) needs
  its own explicit coverage. Check any global `APP_GUARD` provider first —
  if one is registered in `AppModule`, a route needs an explicit `@Public()`-
  style opt-out to be unauthenticated, and *that* opt-out is what should be
  scrutinized, not the guard's presence.
- **Guard confirms authentication/coarse role but not per-resource
  ownership (IDOR)** — cross-reference: this is a HIGH finding already fully
  specified in `language-code-review-edho-ferdian/references/nestjs.md`
  (non-SEC HIGH list) rather than duplicated here in full, since it is a
  logic-correctness issue that happens to have security consequences; load
  that file for the complete description and fix guidance.

### Ground-truth

```bash
nest build
npx tsc --noEmit
npm audit                      # dependency risk (SEC-07)
```

### False-positive traps

- `app.enableCors({ origin: '*' })` **without** `credentials: true` is a
  much lower-severity finding (an intentionally open public API) — check
  both settings together before flagging CRITICAL/HIGH, same trap as the
  FastAPI and Spring Boot CORS entries above.
- A route without its own `@UseGuards()` is not automatically an
  unauthenticated hole if a global `APP_GUARD` provider is registered in
  `AppModule` — trace whether a global guard covers it before flagging a
  missing per-route guard as a bypass.

**Non-security NestJS findings** (business logic in controllers, module
export hygiene, stateful singleton providers, swallowed exceptions in
`@Catch()`, missing correlation ids) stay in `language-code-review-edho-
ferdian/references/nestjs.md` — not duplicated here.

---

## Angular / TypeScript

Source: ECC `angular-developer` (SKILL.md + payload references), fetched
2026-09-06. **Not deferred** — Angular is a proven stack in Edho's actual
project (`ghostfolio`).

**Stack detection.** `package.json` with `@angular/core` in `dependencies`/
`devDependencies` — same signal as `language-code-review-edho-ferdian/
references/angular.md`, which owns the non-security Angular lens (signals,
DI, Signal Forms, routing idioms). This section is that file's SEC-08
counterpart, same relationship as the React/Python sections above.

The ECC `angular-developer` payload reviewed for this port (SKILL.md plus
`signals-overview.md`, `effects.md`, `signal-forms.md`, `di-fundamentals.md`,
`injection-context.md`, `hierarchical-injectors.md`, `route-guards.md`,
`testing-fundamentals.md`, `component-harnesses.md`) is a **code-generation
and architectural-guidance skill, not a security-review skill** — unlike
`react-reviewer`/`django-reviewer`/`fastapi-reviewer`, it carries no
dedicated security checklist of its own. The items below are what a careful
read of that payload surfaces as security-relevant by extension, not a
ported checklist:

### HIGH

- **`[innerHTML]` binding fed by user-controlled or externally-sourced data
  without passing through Angular's `DomSanitizer`, or a `bypassSecurityTrust*`
  call (`bypassSecurityTrustHtml`, `bypassSecurityTrustScript`,
  `bypassSecurityTrustUrl`, `bypassSecurityTrustResourceUrl`,
  `bypassSecurityTrustStyle`) applied to a value that isn't provably
  trusted.** Angular's template binding auto-sanitizes `[innerHTML]`/`[src]`/
  `[href]`/`style` bindings by default — the `bypassSecurityTrust*` family
  exists specifically to opt a value *out* of that protection. Any call
  whose input traces back to a request body, query param, route param, or
  any other externally-controlled value (not a hardcoded string or a value
  already validated against a strict allowlist) recreates the exact XSS
  surface Angular's sanitizer exists to prevent. Structurally the Angular
  equivalent of React's `dangerouslySetInnerHTML` finding in this file's
  §React — same underlying risk, different API name.
- **Route guard (`CanActivate`/`CanMatch`/functional guard) as the sole
  authorization control for a protected resource, with no corresponding
  server-side check.** The `route-guards.md` payload itself states this
  explicitly: "Client-side guards are NOT a substitute for server-side
  security. Always verify permissions on the server." A guard that only
  blocks client-side navigation does nothing to stop a direct API call, a
  replayed request, or a modified/rebuilt client bundle from reaching the
  underlying endpoint. This is the same escalation the non-security Angular
  lens flags at MEDIUM under CQ and then routes here — file it as SEC-08,
  not CQ-11, once escalated; don't double-file the same finding in both
  domains.

### False-positive traps

- A `bypassSecurityTrust*` call whose input is a compile-time constant, or a
  value that has already passed through an explicit sanitizer/allowlist at
  the same call site (verifiable in the codebase, not assumed), is not a
  finding — trace the actual value provenance before flagging, same
  discipline as the `dangerouslySetInnerHTML` false-positive trap in
  §React.
- A route guard backed by a genuine server-side check on the same resource
  (the API itself validates the session/role independently of what the
  guard decided) is not a finding — the guard is then correctly doing UX
  work, with the real security boundary enforced server-side where it
  belongs.

### No further stack-specific findings beyond general checklist

Everything else in the reviewed payload — DI scoping (`providedIn: 'root'`
vs component-scoped), Signal Forms validation, effect/computed usage,
testing patterns — has no unique *security* dimension beyond what the
non-security Angular lens already covers under CQ, or what the general
skill's checklist already owns (e.g. generic secret handling, generic
injection). Nothing else in this payload rises to a stack-specific security
finding distinct from those.

**Non-security Angular findings** (effect/computed misuse, injection-context
errors, Signal Forms API misuse, `@for`/`track`, `providedIn` scope mismatch)
stay in `language-code-review-edho-ferdian/references/angular.md` — not
duplicated here.

---

## PHP / Laravel

Source: ECC `laravel-security` (fetched 2026-09-06). Activated on a real
multi-user ecosystem serving Laravel projects — no longer gated on a
single-project trigger (see SKILL.md provenance note; the D-012/D-013
single-stack-trigger rationale that deferred this section no longer holds
once the ecosystem serves many users/projects rather than only Edho's own).

**Stack detection.** `composer.json` with `laravel/framework` in `require`,
or an `artisan` file at the project root — same manifest-signal pattern as
the other stacks in this file.

### CRITICAL

- **`APP_DEBUG=true` in a production environment** — leaks full stack traces,
  local variable values, and `.env` contents (via Laravel's Whoops error
  page) to any error response. Parallel to Django's `DEBUG = True` finding
  above. (Cross-reference: general **SEC-11** misconfiguration.)
- **Empty, missing, or hardcoded `APP_KEY`** — `APP_KEY` backs Laravel's
  encrypter (`Crypt::encrypt`/`decrypt`, encrypted cookies, `encrypted:array`
  casts, `ShouldBeEncrypted` queue jobs). An empty key at boot means these
  either fail or, worse, some versions silently no-op the encryption step. A
  key committed to source control is compromised the moment the repo is
  cloned, same reasoning as Django's hardcoded `SECRET_KEY` finding.
- **`$guarded = []` on an Eloquent model** — the inverse of an explicit
  `$fillable` whitelist; disables Laravel's mass-assignment protection
  entirely, letting any array key reach the model's attributes via
  `Model::create()`/`fill()`. This is the Laravel instance of general
  **SEC-14** (mass assignment) — same finding shape as Django's
  `fields = '__all__'` and the NestJS `ValidationPipe` whitelist gap above,
  just triggered from the model layer instead of the serializer/pipe layer.
- **`Model::create($request->all())` (or `->fill($request->all())`)** — even
  with a correct `$fillable` whitelist on the model, passing the raw request
  array instead of `$request->validated()` or `$request->safe()->only([...])`
  means any field *added* to `$fillable` later inherits an unreviewed,
  unvalidated write path. Flag alongside a missing/incorrect `$fillable`, not
  only when `$guarded = []` is present — this is a second, independent way
  the same SEC-14 defect class shows up in Laravel.
- **Raw SQL built via string interpolation** — `DB::select("... = '{$x}'")`,
  `User::whereRaw("email = '{$x}'")`, or `DB::statement()` with concatenated
  input. This is the Laravel call site for general **SEC-04** (injection) —
  Eloquent and the query builder parameterize automatically
  (`->where('email', $x)`, `whereRaw('email = ?', [$x])`); only interpolated
  raw SQL bypasses that. Also flag **`orderByRaw($userInput)`/
  `groupByRaw($userInput)`** fed directly from user input — parameter
  placeholders bind values, not column names or sort direction, so these need
  an explicit allowlist check before interpolation, not parameterization
  (same dynamic-SQL-identifier rule general SEC-04 already documents, sourced
  from this same ECC skill).
- **`{!! $userInput !!}` in a Blade template on user-controlled input, with
  no HTMLPurifier (or equivalent allowlist sanitizer) at the same call
  site** — Blade's default `{{ }}` auto-escapes; `{!! !!}` is the explicit
  opt-out, structurally identical to Django's `mark_safe()`/`{{ value|safe }}`
  finding above. Only acceptable when the value has already passed through a
  whitelist-based sanitizer (`HTMLPurifier` with an explicit `HTML.Allowed`
  list) in the codebase, verifiable, not assumed.
- **`{{ json_encode($x) }}` interpolated inside an inline `<script>` block
  instead of Blade's `@js()`/`@json()` directives** — `json_encode()` alone
  is not safe for a JavaScript-context sink (a value like `</script>` or
  ` ` in the data can break out of the script string); `@js()` applies
  JS-context escaping on top of JSON encoding. The Laravel instance of the
  same JS-context-escaping gap Django's `|escapejs` finding covers above.
- **`$hidden` missing `password`, `remember_token`, `two_factor_secret`, or
  `two_factor_recovery_codes`** — without these on the model's `$hidden`
  array, they serialize straight into any JSON response built from the model
  (`return $user;`, `UserResource`, `response()->json($user)`). Same finding
  shape as the FastAPI "password hash in response model" CRITICAL and the
  NestJS "ORM entity returned directly" CRITICAL elsewhere in this file — the
  Laravel instance of that defect class.

### HIGH

- **`VerifyCsrfToken::$except` with a blanket `api/*` entry while Sanctum's
  stateful (cookie-based SPA) mode is in use** — Sanctum's stateful mode
  authenticates `api/*` routes via the session cookie, which means they still
  need CSRF protection; only genuine webhook receivers that can't send
  Laravel's CSRF token (Stripe, etc.) should be excluded, scoped to their
  specific route, not a wildcard. This is the Laravel instance of general
  **SEC-09**'s CSRF false-positive trap — check *how the route authenticates*
  (cookie/session vs a manually-set `Authorization: Bearer` header) before
  accepting or flagging the exclusion.
- **`cors.allowed_origins = ['*']` combined with `supports_credentials =
  true`** — the Laravel instance of the same spec-forbidden combination
  already flagged for FastAPI (`allow_origins=["*"]` + `allow_credentials=
  True`), Spring Boot, and NestJS elsewhere in this file. Fix: an explicit
  origin allowlist read from `CORS_ALLOWED_ORIGINS` whenever
  `supports_credentials` is `true`.
- **Sanctum `expiration => null`** — API tokens that never expire widen the
  blast radius of any single leaked token indefinitely. Instance of general
  **SEC-10** (token handling).
- **`trusted_proxies` set to `'*'`** — trusts the `X-Forwarded-*` headers from
  any client, not just a known load balancer/proxy, letting a client spoof
  its own IP or scheme. Instance of general **SEC-15** (proxy-header
  spoofing); should be an explicit CIDR range for the actual proxy tier.
- **Weak password policy** — `Password::min()` below 12, or missing
  `->uncompromised()` (the `haveibeenpwned` breach check) for a
  security-sensitive application. Not CRITICAL on its own, but a real
  hardening gap parallel to Django's `AUTH_PASSWORD_VALIDATORS` finding
  above.
- **Missing throttling on an authentication endpoint** (login, registration,
  password reset) — `RateLimiter::for('auth', ...)` not applied via
  `throttle:auth` middleware. Instance of general **SEC-08** (rate limiting),
  same finding shape as the Django auth-endpoint throttling item above.
- **File upload validated by MIME/extension rule alone (`mimes:`,
  `extensions:`), with no magic-byte content verification** — Laravel's
  `mimes`/`image` validation rules check the client-declared/extension-
  inferred type, which is trivially spoofed by renaming a payload before
  upload. Same finding shape as the Django file-upload item above — require
  a magic-byte check (`finfo`/`php-magic-bytes` or equivalent) cross-checked
  against the declared extension, not extension/MIME rules as the sole
  control.
- **Sensitive fields in a queued job's constructor without
  `ShouldBeEncrypted`** — a job carrying a raw card number, password, or full
  PHI record in its serialized payload is readable by anyone with access to
  the queue backend (Redis, a DB table, SQS) and visible in failed-job
  dashboards. Already documented as general **SEC-06** ("sensitive fields in
  background-job / queue payloads"), sourced from this same ECC skill —
  don't re-file it as a new code, this is the concrete Laravel call site
  (`implements ShouldBeEncrypted`) for that general finding.

### Ground-truth

```bash
composer audit   # dependency risk (SEC-07)
```

### False-positive traps

- A route excluded from CSRF in `VerifyCsrfToken::$except` that is a genuine
  third-party webhook receiver (Stripe, etc.), scoped to that specific route
  rather than a wildcard, is correctly configured — not a finding.
- `$guarded` (non-empty, listing sensitive columns) is an equally valid
  mass-assignment control to an explicit `$fillable` whitelist — flag only
  when it's empty (`$guarded = []`) or missing sensitive columns that a
  matching `$fillable` list would have excluded by omission.
- `{!! !!}` fed by content that has already passed through `HTMLPurifier` (or
  an equivalent allowlist sanitizer) earlier in the same request/pipeline,
  verifiable in the codebase, is not a finding — trace the actual
  sanitization step before assuming it's missing, same discipline as the
  React `dangerouslySetInnerHTML` and Django `mark_safe()` false-positive
  traps above.

Non-security Laravel findings (Eloquent N+1, query builder idioms, job/queue
architecture, service-provider organization) belong in
`language-code-review-edho-ferdian`'s PHP/Laravel lens, not duplicated here —
that lens is being built separately; this section only owns the
security-relevant subset.

## Java / Spring Boot

Source: ECC `springboot-security` (fetched 2026-09-06). Activated on a real
multi-user ecosystem serving Java/Spring projects — no longer gated on a
single-project trigger, same reasoning as the PHP/Laravel section above.
Quarkus is a sub-section here, not a separate top-level section, since ~85%
of its concepts are identical to Spring Boot.

**Stack detection.** `pom.xml`/`build.gradle` with
`spring-boot-starter-security` (or `spring-boot-starter-web` plus explicit
Spring Security config), or `@SpringBootApplication`/`@RestController`/
`@Service` annotations in scope. Quarkus: `quarkus-security`/
`quarkus-resteasy` in the build file, or `@Path`/`@RolesAllowed` annotations.

### CRITICAL

- **A native `@Query` (or `createNativeQuery`) built via string
  concatenation of request-influenced values** — `@Query(value = "SELECT *
  FROM users WHERE name = '" + name + "'", nativeQuery = true)`. The Spring
  Data instance of general **SEC-04** (injection) — Spring Data repositories
  and `:param`/`?1` bindings parameterize automatically; only a
  concatenated native query bypasses that.
- **A controller accepting an entity (`@RequestBody User user`) directly
  instead of a validated DTO/record** — without an explicit DTO carrying only
  the intended fields, a client can set columns the entity happens to expose
  (`role`, `isAdmin`, `balance`) that were never meant to be client-settable.
  Instance of general **SEC-14** (mass assignment) — the Spring Boot version
  of the same defect class as Django's `fields = '__all__'`, the NestJS
  `ValidationPipe`-whitelist gap, and Laravel's `$guarded = []` above. Fix:
  a `record CreateUserDto(...)` (or equivalent) validated with `@Valid`,
  never the entity type itself as the request body.
- **`@EnableMethodSecurity` not enabled anywhere, or a sensitive endpoint
  with no `@PreAuthorize`/`@RolesAllowed`** — without method security
  enabled and applied, an endpoint's actual access requirement depends
  entirely on whatever the global `SecurityFilterChain` happens to allow,
  which is easy to leave more permissive than intended as routes accumulate.
  Instance of general **SEC-03** (auth check) — deny-by-default should be
  explicit per sensitive method, not implied by the filter chain.
- **`PasswordEncoder` not BCrypt/Argon2, or a `BCryptPasswordEncoder`
  constructed with a default/low cost factor** for a new project — plaintext
  or a weak/legacy hash (MD5, unsalted SHA) used for password storage is a
  direct compromise the moment the database leaks; a cost factor left at a
  library default lower than the current recommended baseline (12+) is a
  hardening gap. Instance of the same weak-crypto-for-passwords finding as
  the base Python section's CRITICAL above.
- **Plaintext credentials committed in `application.yml`/`application.properties`
  instead of an `${DB_PASSWORD}`-style environment placeholder** — a
  `spring.datasource.password: mySecretPassword123` literal in a file tracked
  by version control is a compromised secret from the moment the repo is
  cloned. Instance of general **SEC-02** (secret exposure).
- **`setAllowedOrigins(List.of("*"))` combined with
  `setAllowCredentials(true)`** in a `CorsConfigurationSource` bean — the
  Spring Boot instance of the same spec-forbidden CORS combination already
  flagged for FastAPI, Laravel, and NestJS elsewhere in this file.

### HIGH

- **CSRF disabled (`.csrf(csrf -> csrf.disable())`) on a session-based
  (cookie-authenticated) application** — correct and expected on a stateless
  API authenticating purely via a `Bearer` token (see the general **SEC-09**
  false-positive trap), but a finding on anything that authenticates via a
  session cookie, where disabling CSRF removes Spring Security's only
  built-in defense against forged cross-site requests. Check
  `sessionCreationPolicy` (`STATELESS` vs the default) before flagging or
  clearing this.
- **Missing rate limiting on an expensive or authentication endpoint** — no
  `Bucket4j` filter, gateway-level throttle, or equivalent on login,
  registration, or password-reset routes. Instance of general **SEC-08**.
- **Missing security headers** — no explicit `.headers(...)` configuration
  for `Content-Security-Policy`, `X-Frame-Options`, or a referrer policy.
  Instance of general **SEC-11** (security misconfiguration); note that
  `.xssProtection(...)` (the `X-XSS-Protection` header) is the same obsolete,
  browser-ignored header flagged as a false positive to *recommend* in the
  Django section above — its absence is not itself a finding.
- **Secrets or PII written to application logs** — a log statement that
  includes a raw token, password, or full PAN instead of a redacted/masked
  value. Instance of general **SEC-06** (sensitive data).
- **File uploads validated by declared content-type/extension only, with no
  size cap or storage outside the web root** — same finding shape as the
  Django/Laravel file-upload items above; a client-declared `Content-Type`
  or filename extension proves nothing about the file's actual bytes.

### Ground-truth

```bash
mvn org.owasp:dependency-check-maven:check   # or:
./gradlew dependencyCheckAnalyze             # dependency risk (SEC-07)
```

### False-positive traps

- `.csrf(csrf -> csrf.disable())` paired with
  `.sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))`
  and Bearer-token auth is the correct, secure configuration for a pure API —
  not a finding. Same discipline as the general SEC-09 trap: check how the
  endpoint actually authenticates before flagging.
- `setAllowedOrigins(List.of("*"))` **without** `setAllowCredentials(true)`
  is a much lower-severity finding (an intentionally open public API) — check
  both settings together before flagging CRITICAL, same trap as the FastAPI,
  Laravel, and NestJS CORS entries above.

### Quarkus sub-section

- **`@RolesAllowed` missing on a resource method** — the Quarkus equivalent
  of a missing `@PreAuthorize`; instance of general **SEC-03**.
- **`quarkus.http.cors.origins=*`** — same CORS-wildcard concern as the
  Spring Boot entry above; check whether credentials/cookies are also in
  play before setting severity.
- **A rate limiter keyed off `X-Forwarded-For`** without validating the
  header comes from a trusted proxy — trivially spoofed by any client that
  sets its own `X-Forwarded-For`, letting an attacker rotate past a
  per-client limit. Instance of general **SEC-15** (proxy-header spoofing).

Non-security Spring Boot/Quarkus findings (layered architecture, JPA/Panache
mapping, transaction boundaries, concurrency) belong in
`language-code-review-edho-ferdian`'s Java/Spring Boot lens, not duplicated
here — that lens is being built separately; this section only owns the
security-relevant subset.

## Perl — intentionally not built

`perl-security` (ECC source) was analyzed but is intentionally NOT ported as
a language section here — zero use-case in Edho's ecosystem. Its entire
value was already harvested as generic, language-independent findings: see
SEC-16 (ReDoS), SEC-17 (path traversal), SEC-18 (open redirect), and SEC-19
(TOCTOU/temp-file) in `general-checklist.md`. This is the only kelompok-2
item skipped as a stack while being fully harvested as generic content —
recorded here so a future session doesn't re-derive Perl content that was
already extracted.

---

## Smart contracts (Solidity/EVM)

Source: ECC `defi-amm-security` (fetched 2026-09-06) for the reentrancy/CEI,
donation-attack, oracle-manipulation, slippage, and admin-control patterns —
that skill is framed around AMM/liquidity-pool contracts specifically, so its
patterns are generalized below to any Solidity/EVM contract rather than kept
AMM-only. ECC carries no general-purpose (non-AMM) Solidity security skill,
so the items **explicitly marked "general Solidity/EVM knowledge"** below
(integer overflow/underflow, access-control patterns, unchecked low-level
calls, front-running/MEV) are **not** ported from an ECC source — they are
written from established, industry-standard smart-contract security
practice (the class of findings any Solidity auditor checks, corresponding
to SWC Registry entries and the Consensys/OpenZeppelin secure-development
patterns), called out here so this distinction is never lost. Activated on
a real multi-user ecosystem serving Solidity/EVM projects — no longer gated
on a single-project trigger, same reasoning as the PHP/Laravel and
Java/Spring Boot sections above.

**Stack detection.** A `.sol` file in scope, a `foundry.toml`/`hardhat.config.
{js,ts}`/`truffle-config.js` at the project root, or `@openzeppelin/contracts`
in `package.json`.

**Code placement.** Smart-contract findings do not map cleanly onto the
general `SEC-01..19` codes — the threat model is structurally different from
a web-stack language (state changes are irreversible on confirmation, there
is no privileged rollback, and execution is gas-metered and adversarially
composable with other contracts in the same transaction). Findings from this
section use their own **`SC-SEC-01..06`** prefix instead, the same pattern
`domain-specific.md` already uses for `CLOUD-SEC-01..07` and `AGT-01..04`.

### CRITICAL

- **`SC-SEC-01` Reentrancy / CEI-order violation** — external state
  (`balances[msg.sender] -= amount;`) mutated *after* an external call
  (`token.transfer(...)`, a raw `.call{value: x}("")`) instead of before it.
  A malicious `receive()`/`fallback()` (or a malicious ERC-777/ERC-20 hook)
  on the recipient can re-enter the function while the contract's own state
  still reflects the pre-withdrawal balance, draining funds across repeated
  calls in a single transaction. Fix: enforce Checks-Effects-Interactions —
  update internal state *before* the external call — and add OpenZeppelin's
  `ReentrancyGuard`/`nonReentrant` as defense-in-depth, not as the sole
  control. Source: ECC `defi-amm-security`.
- **`SC-SEC-02` Share/reserve math derived directly from
  `token.balanceOf(address(this))`** — a "donation" or inflation attack:
  anyone can send tokens directly to the contract (bypassing the intended
  deposit path) to manipulate a denominator computed from the contract's raw
  balance, skewing share price for every other depositor. Fix: track
  internal accounting (`_totalAssets`) and measure the actual delta
  received (`balanceAfter - balanceBefore`) around the transfer, never the
  raw balance alone. Source: ECC `defi-amm-security`.
- **`SC-SEC-03` Missing or inverted access control on a privileged function**
  *(general Solidity/EVM knowledge — not an ECC-sourced item)* — a function
  that mints tokens, changes an oracle address, pauses/unpauses, sets a fee,
  or upgrades a proxy implementation with no `onlyOwner`/role-gate modifier
  (or a modifier checking the wrong role/address entirely). The Solidity
  instance of the same "auth check missing" defect class as general SEC-03,
  made CRITICAL here specifically because a compromised privileged function
  on a deployed, immutable contract typically cannot be patched after the
  fact — the blast radius is total and irreversible in a way a web
  endpoint's missing auth check usually isn't. Fix: OpenZeppelin
  `Ownable`/`Ownable2Step` (prefer two-step transfer over single-step
  `transferOwnership`) or `AccessControl` role-based gating on every
  privileged entrypoint.
- **`SC-SEC-04` Unchecked or unsafe low-level external call**
  *(general Solidity/EVM knowledge — not an ECC-sourced item)* — a raw
  `.call(...)`/`.delegatecall(...)`/`.send(...)` whose boolean success value
  is discarded (`address(x).call(data);` with no `require(success, ...)`
  check), or an ERC-20 `transfer`/`transferFrom` call whose return value is
  ignored (some non-standard tokens, e.g. USDT, return no value or `false`
  on failure without reverting, silently making the call a no-op the caller
  believes succeeded). Fix: check every low-level call's return value
  explicitly, and use OpenZeppelin's `SafeERC20` (`safeTransfer`/
  `safeTransferFrom`) instead of the raw `IERC20` calls. A `delegatecall`
  additionally executes in the *caller's* storage context — flag any
  `delegatecall` to an address that isn't a fixed, audited implementation
  contract as a full storage-corruption/takeover risk, not merely a silent-
  failure risk.

### HIGH

- **`SC-SEC-05` Integer overflow/underflow on Solidity `< 0.8.0`, or
  `unchecked { }` arithmetic on `>= 0.8.0` without a justified reason**
  *(general Solidity/EVM knowledge — not an ECC-sourced item)* — Solidity
  `< 0.8.0` has no built-in overflow/underflow protection (SafeMath must be
  used explicitly); Solidity `>= 0.8.0` reverts on overflow by default, but
  an `unchecked { ... }` block re-opens exactly that hole for whatever
  arithmetic it wraps. Flag pre-0.8 arithmetic with no `SafeMath` usage as
  the finding, and any `unchecked` block wrapping user-influenced values
  (not just a gas-optimized loop counter with a proven bound) as the
  post-0.8 equivalent.
- **Oracle price read from a single spot price** (e.g. a single AMM pool's
  instantaneous reserves ratio, or one on-chain DEX quote) **instead of a
  manipulation-resistant source** — a spot price is flash-loan manipulable
  within a single transaction (borrow a large amount, skew the pool, read
  the now-wrong price, act on it, repay the loan, all atomically). Fix:
  a TWAP (time-weighted average price, e.g. Uniswap V3's `observe()`) or a
  reputable external oracle (Chainlink) with staleness/deviation checks,
  never a single same-block reserve read. Source: ECC `defi-amm-security`.
- **A swap/trade function with no caller-supplied `amountOutMin`/slippage
  bound, or no `deadline`** — without a minimum-output guard, a transaction
  sitting in the mempool can be sandwiched (front-run to move the price
  unfavorably, then back-run after it executes) for the full difference
  between the expected and worst-case price; without a deadline, a stale
  transaction can execute long after submission at a since-moved price.
  Source: ECC `defi-amm-security`.
- **Front-running / MEV exposure on an ordering-sensitive operation**
  *(general Solidity/EVM knowledge — not an ECC-sourced item)* — beyond the
  swap-specific slippage case above, any function whose outcome depends on
  transaction ordering within a block (a commit-then-reveal scheme missing
  the commit phase, an auction accepting bids without a reveal delay, a
  first-come-first-served claim with a predictable trigger condition) is
  exploitable by a searcher who observes the pending transaction and pays
  more gas to land first. Not always fixable outright — flag it and note
  the mitigation that fits the specific mechanism (commit-reveal, a private
  mempool/relay, or a batch-auction design) rather than proposing a generic
  fix.
- **Reserve/share math using naive `a * b / c` where intermediate
  multiplication can overflow `uint256`** — even on Solidity `>= 0.8.0`
  (which reverts rather than silently wrapping), an overflow here is a
  denial-of-service on legitimate large-value operations, not merely a
  correctness bug. Fix: a full-precision multiply-divide primitive
  (`FullMath.mulDiv` or equivalent) for reserve/share calculations with
  large token amounts. Source: ECC `defi-amm-security`.

### Ground-truth

```bash
pip install slither-analyzer
slither . --exclude-dependencies       # static analysis: reentrancy, access control, unchecked calls

echidna-test . --contract YourContract --config echidna.yaml   # property-based fuzzing
forge test --fuzz-runs 10000                                    # Foundry fuzz tests, if present
```

Do not label a Slither-detectable finding (reentrancy, unchecked-call,
suicidal/arbitrary-`delegatecall` detectors, etc.) **[High confidence]**
without actually running Slither — recognizing the pattern by reading the
source is reasoning, not verification, same rule as `bandit`/`eslint` for
the other stacks in this file.

### False-positive traps

- A `nonReentrant`-guarded function that also follows correct CEI ordering
  is not a finding merely because it makes an external call — the guard plus
  ordering together are the accepted mitigation; don't flag "makes an
  external call" as reentrancy risk on its own without one of the two
  controls missing.
- An `unchecked { }` block wrapping only a loop counter increment with a
  compile-time-provable upper bound (e.g. iterating a fixed-size array) is a
  standard, safe gas optimization — not every `unchecked` block is
  SC-SEC-05; check what value flows through it before flagging.
- A `delegatecall` to a fixed, audited implementation address behind a
  well-known proxy pattern (OpenZeppelin's `TransparentUpgradeableProxy`/
  `UUPSUpgradeable`) is the intended mechanism, not a finding — the
  SC-SEC-04 concern is a `delegatecall` target that is itself
  attacker-influenced or unverified.
- Ignoring the return value of `.transfer(...)`/`.send(...)` to an EOA
  (externally-owned account, not a contract) is lower risk than the same
  pattern against an arbitrary/contract address — but still flag it, since
  the recipient's status (EOA vs contract, and which contract) can change
  after deployment in ways the code can't statically guarantee.

Non-security Solidity findings (gas optimization, contract upgrade
patterns, test coverage, NatSpec documentation) are out of scope for this
skill entirely — no `-edho-ferdian` non-security Solidity lens exists yet in
`language-code-review-edho-ferdian`; this section stands alone as the only
Solidity-specific content in the ecosystem today.
