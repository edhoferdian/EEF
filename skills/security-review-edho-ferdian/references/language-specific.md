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

## PHP / Laravel [DEFERRED]

Deferred — zero use-case in Edho's current stack, content kept ready for when
a PHP/Laravel project appears (same pattern as other deferred lenses in this
ecosystem).

Findings not already covered by the generic SEC-14/15 codes: `APP_DEBUG=true`
in production (CRITICAL, parallel to Django's `DEBUG=True`); empty or
hardcoded `APP_KEY`; `$guarded = []` (CRITICAL, instance of SEC-14);
`{!! $userInput !!}` in Blade without HTMLPurifier (CRITICAL, parallel to
`mark_safe`); `{{ json_encode($x) }}` inside `<script>` instead of `@js()`
(wrong JS-context escaping — parallel to Django's `|escapejs`); `$hidden`
missing `password`/`remember_token`/`two_factor_secret`, leaking them into
JSON responses (parallel to the FastAPI response-model finding);
`VerifyCsrfToken::$except` with a blanket `api/*` while Sanctum stateful mode
is used; `cors.allowed_origins = ['*']` combined with
`supports_credentials = true` (parallel to the existing CRITICAL FastAPI
finding); Sanctum `expiration => null` (tokens never expire);
`trusted_proxies = '*'` (instance of SEC-15). Ground-truth: `composer audit`.

## Java / Spring Boot [DEFERRED]

Deferred — zero use-case in Edho's current stack, content kept ready for when
a Java/Spring project appears. Quarkus is a sub-section here, not a separate
top-level section, since ~85% of the concepts are identical to Spring Boot.

Findings: native `@Query` with string concatenation; a controller accepting
an entity directly instead of a `@Valid` DTO (instance of SEC-14);
`@EnableMethodSecurity` not enabled / a sensitive endpoint without
`@PreAuthorize` (deny-by-default not enforced); `PasswordEncoder` not
BCrypt/Argon2, or a default cost factor too low; plaintext credentials in
`application.yml` instead of an `${DB_PASSWORD}` placeholder;
`setAllowedOrigins(List.of("*"))` combined with `setAllowCredentials(true)`;
CSRF disabled on a session-based application (see the SEC-09 false-positive
trap in `general-checklist.md`). Ground-truth:
`mvn org.owasp:dependency-check-maven:check` / `./gradlew dependencyCheckAnalyze`.

### Quarkus sub-section

`@RolesAllowed` missing on a resource; `quarkus.http.cors.origins=*`; a rate
limiter that keys off `X-Forwarded-For` (instance of SEC-15).

## Perl — intentionally not built

`perl-security` (ECC source) was analyzed but is intentionally NOT ported as
a language section here — zero use-case in Edho's ecosystem. Its entire
value was already harvested as generic, language-independent findings: see
SEC-16 (ReDoS), SEC-17 (path traversal), SEC-18 (open redirect), and SEC-19
(TOCTOU/temp-file) in `general-checklist.md`. This is the only kelompok-2
item skipped as a stack while being fully harvested as generic content —
recorded here so a future session doesn't re-derive Perl content that was
already extracted.
