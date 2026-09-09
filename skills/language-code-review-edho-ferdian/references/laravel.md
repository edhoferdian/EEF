# Language Lens — PHP / Laravel

Adapted from ECC `laravel-patterns`, `laravel-tdd`, `laravel-verification`,
fetched 2026-09-07.

**Detect.** `composer.json` requiring `laravel/framework`, an `artisan` file
at repo root, or `app/Http/Kernel.php` / `bootstrap/app.php` present. This
file is the only Laravel review lens — unlike Python/Django/FastAPI there is
no separate base-language file to load first, since PHP outside a framework
isn't part of this ecosystem's detection table yet.

**Boundary — read before flagging anything.** Generic injection (SQL/command/
path traversal via string concatenation), generic secret handling, generic
function-length/nesting/magic-number checks, and generic N+1 detection are
**already owned by `references/review-checklist.md`** in the general skill.
This lens adds only what is specific to **Laravel's architecture conventions
and Eloquent ORM** — service/action layering, route-model binding, Eloquent
relationship/scope correctness, form-request validation structure, queue/
event idiom, and what a reviewer checks for under `laravel-tdd`/
`laravel-verification` (test structure and pipeline gates, not the security
findings those two also touch).

**Code placement.** Findings land as **CQ-11 (Laravel/Eloquent idiom
anti-patterns)** in the general report. **All PHP/Laravel security items
(SEC-08 territory) already live in `security-review-edho-ferdian/
references/language-specific.md` §"PHP / Laravel"** (from D-012)
— `APP_DEBUG=true` in production, `$guarded = []`, `{!! !!}` without
HTMLPurifier, `$hidden` gaps, CSRF/CORS/Sanctum misconfiguration. This file
does **not** re-port that content; load the security file (or delegate to
`security-review-edho-ferdian` directly) whenever Domain 2 needs Laravel
depth. The one item worth restating here only because it is also a
correctness bug, not just a security bug: `$guarded = []` combined with
`$request->all()` passed straight into `create()`/`update()` is a
mass-assignment correctness hole as much as a security one — flag it under
CQ-11 with a cross-reference to the security file's SEC-08 entry rather than
writing a second, competing finding.

---

## Ground-truth commands

```bash
vendor/bin/pint --test              # style/formatting — confirms PSR-12-shaped findings
vendor/bin/phpstan analyse          # static analysis — confirms type/nullability findings
composer validate                   # composer.json/lock consistency
php artisan route:list              # confirms route-model-binding / middleware-group claims
php artisan test                    # confirms test-structure findings actually run
```

Do not label a PHPStan-detectable finding (a nullable property accessed
without a check, a wrong return type on a service method) as [High
confidence] without actually running `phpstan analyse` — reading the line
and recognizing the pattern is reasoning, not verification, per the general
skill's Phase 2 rule.

---

## Lens criteria

### HIGH

- **Fat controller doing ORM/business logic directly** — a controller method
  building queries, branching on business rules, or calling multiple models
  inline instead of delegating to a service/action class
  (`app/Actions/*`, `app/Services/*`). `laravel-patterns`' whole
  Controller → Service → Action layering exists precisely so controllers stay
  thin orchestration only. **CQ-11.**
- **N+1 via missing eager load on a relationship actually iterated in a
  loop/view** — `Order::all()` followed by `$order->customer->name` inside a
  `foreach` or Blade `@foreach`, with no `->with(['customer'])` on the
  original query. This is the Laravel-specific *mechanism* of N+1 (the
  general skill's N+1 check doesn't know Eloquent's `with()`/
  `load()`/`loadMissing()` API) — cite the exact relationship name and call
  site. **CQ-11.**
- **Validation missing from a Form Request, or validation done ad hoc in the
  controller instead of a `FormRequest` class** — `$request->input(...)` used
  directly without a corresponding `rules()` array anywhere in the request
  lifecycle. Laravel's own idiom is a dedicated `StoreXRequest`/
  `UpdateXRequest` with `authorize()` AND `rules()` both filled in — an
  `authorize()` that unconditionally `return true;` on a resource with an
  owner is itself the mass-assignment/authorization gap the security file's
  SEC-08 entry already tracks; cross-reference it, don't re-litigate here.
  **CQ-11.**
- **A migration that is not reversible** — a `down()` method left empty (or
  missing) after an `up()` that drops a column, drops a table, or otherwise
  loses data, with no comment explaining why rollback is intentionally
  unsupported. `laravel-verification`'s Phase 5 explicitly gates on this
  ("verify `down()` methods and avoid irreversible data loss without explicit
  backups") — a reviewer should catch it before that gate ever runs.
  **CQ-11.**
- **Global scope and named scope stacked for the same filter without stated
  intent** — e.g. a `SoftDeletes`-style `addGlobalScope` alongside a
  `scopeActive()` that filters the identical column, with nothing in a
  comment or PR description saying the layering is deliberate. `laravel-
  patterns` calls this out explicitly: use one or the other for the same
  filter unless layered behavior is actually intended. **CQ-11.**

### MEDIUM

- **Route-model binding not scoped where the route is nested under a parent
  resource** — `Route::get('/accounts/{account}/projects/{project}', ...)`
  without `Route::scopeBindings()`, letting `{project}` resolve to a project
  belonging to a *different* account than `{account}` names. This is
  primarily a correctness/IDOR-adjacent bug; flag it here at CQ-11 and note
  the cross-tenant angle, but the exhaustive authorization-bypass framing
  belongs to the security lens if it escalates. **CQ-11.**
- **Query object growing method chains that mutate `$this->query` in place**
  — a `ProjectQuery`-style class whose methods (`ownedBy()`, `active()`, …)
  mutate the held builder instead of cloning it before applying a new
  condition, breaking safe reuse of the same query object across multiple
  chained calls. `laravel-patterns`' own query-object example clones the
  builder in every method for exactly this reason — flag the omission.
  **CQ-11.**
- **`$table->timestamps()`/plural snake_case table naming convention broken
  without reason** — a new migration introducing a singular or
  non-snake_case table name, or dropping `timestamps()` from a table that
  otherwise needs `created_at`/`updated_at` (audit trail, cache
  invalidation-by-timestamp elsewhere in the codebase). **CQ-11.**
- **API response envelope inconsistency** — one endpoint returning
  `{success, data, error, meta}` (the shape `laravel-patterns`' API Resources
  example uses) while a sibling endpoint in the same module returns a bare
  array or a differently-shaped object. Inconsistent envelopes break any
  shared frontend response handler. **CQ-11.**
- **Queued job not idempotent** — a `Job::handle()` that performs a
  non-idempotent side effect (charges a payment, sends an email, increments a
  counter) with no dedup key/guard, on a queue connection that can and will
  redeliver on retry. `laravel-patterns` calls for idempotent handlers with
  retries and backoff explicitly. **CQ-11.**
- **Artisan command with no test coverage** — a custom `php artisan
  <name>` command with business logic (not just a thin wrapper around an
  existing service call) and no corresponding `$this->artisan(...)
  ->assertExitCode(...)` test. `laravel-tdd`'s Artisan Command Tests section
  is the expected pattern; note the gap under CQ-11, referring PERF/coverage-
  percentage numbers to Domain 5 (test-quality-lens) rather than restating
  them here. **CQ-11.**
- **Test suite skips `RefreshDatabase`/uses a shared persistent DB state**
  — a `Tests\Feature\*Test` class that touches the database but omits
  `use RefreshDatabase;`, risking order-dependent test pollution.
  **CQ-11.**
- **Over-mocking past the service boundary** — `Http::fake()`/`Mail::fake()`/
  `Queue::fake()` used appropriately is fine (that's the idiom), but a test
  that mocks an internal Eloquent model or a same-app service class instead
  of letting it run against `RefreshDatabase` violates `laravel-tdd`'s own
  "mock only service boundaries" rule and tends to test the mock, not the
  code. **CQ-11.**

---

## False-positive traps

- `Route::scopeBindings()` omitted on a nested route where the child
  resource's foreign key uniqueness alone already prevents cross-tenant
  resolution (e.g. the child's primary key is globally unique and the parent
  segment is purely cosmetic in the URL) is not automatically a bug — check
  whether the model's own query actually filters by the parent before
  flagging the IDOR-adjacent variant.
- A global scope and a named scope on the same column *are* intentionally
  layered when the named scope narrows further (e.g. global scope excludes
  soft-deleted rows, named scope additionally filters by owner) — only flag
  when both filters are identical, not merely related.
- `Http::fake()`/`Mail::fake()`/`Queue::fake()`/`Event::fake()` calls in a
  test file are the *documented* idiom (`laravel-tdd`'s own Mocking and Fakes
  section) — never flag these as "over-mocking"; the over-mocking finding is
  specifically about mocking first-party model/service classes.
  `Storage::fake()` for file upload tests is the same category.
- A migration `down()` that is genuinely empty because `up()` only adds a
  new nullable column (fully and safely reversible by a plain `dropColumn`)
  is not the same risk as one after a destructive `up()` — don't flag the
  irreversibility HIGH unless the `up()` actually drops/transforms data that
  cannot be reconstructed.
- Queue jobs dispatched onto the `sync` connection in tests (the default
  `QUEUE_CONNECTION=sync` from `laravel-tdd`'s PHPUnit config) execute
  inline and are not evidence of a queue misconfiguration in production —
  check the actual `config/queue.php` default connection for the real
  environment before flagging.

## Escalate to general domain when…

- The finding is generic SQL/command/path injection via raw string
  concatenation with no Laravel-specific nuance (e.g. raw `DB::statement()`
  interpolating user input) — that's the general skill's SEC domain, not
  this lens.
- The finding is a security misconfiguration already catalogued in
  `security-review-edho-ferdian/references/language-specific.md` §"PHP /
  Laravel" — `APP_DEBUG`, `APP_KEY`, `$guarded`, Blade `{!! !!}`,
  `$hidden`, CSRF/CORS/Sanctum. Cross-reference it; don't re-derive it here.
- The finding is about test coverage percentage or test-quality patterns
  beyond "does this test exist at all" — that's Domain 5
  (`test-quality-lens.md`) in the general skill; this lens only flags the
  Laravel-specific *shape* of a missing/wrong test (no Artisan command test,
  no `RefreshDatabase`), not coverage numbers.
- A performance claim (a specific N+1 site is "slow") needs profiling/
  benchmark evidence to confirm beyond "this loop looks slow" — escalate to
  `performance-audit-edho-ferdian` per the general skill's PERF escalation
  rule; this lens only flags the missing-eager-load *pattern*, not measured
  query timing.
- The fix requires restructuring the app's layering (introducing a Service/
  Action layer where none exists at all, not just fixing one fat controller)
  — that's a refactor scoped beyond a review finding; note it and hand off to
  `code-review-edho-ferdian`'s adaptive-fix judgment rather than prescribing
  the restructure inline.

---

## Vanilla PHP (no framework)

Source: ECC `agents/php-reviewer.md` (fetched 2026-09-09). Added after
comparing this general PHP reviewer agent against the Laravel-specific
content above: most of `php-reviewer.md` is either generic (already owned
by the general skill's `review-checklist.md`) or Eloquent/Laravel-specific
content this file's HIGH/MEDIUM sections above already cover in more depth
than the agent does. The genuine gap is the subset below, which applies to
PHP with **no framework present** — a standalone script, a Composer
library, or a project not detected as Laravel by this skill's manifest
table — and was not covered anywhere else in this ecosystem before this
addition.

**Detect.** A `composer.json` present with no `laravel/framework`
requirement, or any `.php` file in review scope with no `artisan` file and
no `app/Http/Kernel.php`/`bootstrap/app.php` at the project root (i.e. this
skill's own Laravel detection signals above all fail). When Laravel *is*
detected, use the Laravel-specific sections above instead — this section
does not re-apply on top of them.

**Boundary.** Generic injection, generic secret handling, generic
function-length/nesting/magic-number checks — already owned by
`references/review-checklist.md` in the general skill. This section adds
only PSR-12/type-system conventions and Composer package structure that
have no Laravel-specific equivalent above.

**Code placement.** Findings land as **CQ-11 (PHP idiom anti-patterns)**,
same code as the Laravel-specific findings above.

### HIGH

- **Missing `declare(strict_types=1)`** in a non-view PHP file — without
  it, PHP silently coerces scalar type mismatches at call boundaries
  instead of raising a `TypeError`, defeating the point of type hints.
- **Public method missing type hints on parameters or return type**, or
  using `mixed` where a specific union type is expressible — weakens
  static analysis (PHPStan/Psalm) and IDE tooling for every caller.
- **Constructor-promoted property that is never reassigned but not marked
  `readonly`** — a missed immutability guarantee PHP 8.1+ provides for
  free.
- **Class not designed for inheritance left without `final`** — an
  open-for-extension class with no actual subclassing use case invites
  fragile-base-class problems later.

### MEDIUM — PSR-12 and package hygiene

- **Import order, spacing, brace placement, or naming conventions**
  deviating from PSR-12 with no project-local style override on record —
  confirm with `vendor/bin/pint --test` (or `phpcs` if the project uses
  that instead of Pint) before flagging as [High confidence]; reading the
  diff and recognizing a PSR-12 deviation by eye is [Medium confidence] at
  most.
- **`dd()`/`dump()`/`var_dump()` left in committed code** — debug
  statements that shouldn't ship.
- **Unused or overly broad `use` imports** — import only what's needed,
  keep the import block clean.
- **`composer.json` missing an explicit `"require"` PHP version
  constraint**, or a package with no `composer validate`-clean manifest —
  a library intended for reuse (has a `composer.json` `"type": "library"`,
  or is published/publishable) without a pinned PHP version range risks
  silently supporting (or breaking on) versions never actually tested.
- **Plain PHP auth/crypto not using the standard library primitives** —
  `password_hash()`/`password_verify()` for password storage,
  PDO prepared statements for queries, and a header-based (or
  framework-agnostic middleware) CSRF token check for state-changing
  requests, in a project with no framework providing these by default.
  This is the non-Laravel instance of the same defect classes
  `security-review-edho-ferdian` already tracks for Laravel (`$guarded`,
  raw SQL, CSRF middleware) — cross-reference that file's PHP/Laravel
  section for the underlying rationale rather than re-deriving it; the
  finding here is only "this project has no framework doing it
  automatically, so the manual equivalent needs to actually be present."

### Ground-truth commands

```bash
./vendor/bin/phpstan analyse --level max   # type safety and errors
./vendor/bin/psalm --show-info=true        # static analysis
./vendor/bin/pint --test                   # PSR-12 formatting (or phpcs, if the project uses that)
composer validate                          # composer.json/lock consistency
composer audit                             # dependency vulnerabilities
```

### False-positive traps

- `mixed` on a parameter that receives genuinely heterogeneous,
  validated-just-before-use input (the vanilla-PHP equivalent of the
  Python `Any`-on-raw-JSON trap in the security file) is a correct
  boundary type, not a finding.
- A class left non-`final` that is genuinely designed for extension (an
  abstract base class, a documented extension point in a library's public
  API) is not a finding — `final` is for classes with no such intent.

### Redundancy note (why this section is short)

`php-reviewer.md`'s Eloquent/Laravel-specific content (N+1 via `with()`/
`load()`, `$fillable`/`$casts`, FormRequest validation, Livewire/Filament
checks) is **not** re-derived here — it fully overlaps with, and is less
detailed than, the Laravel-specific sections earlier in this file. Only
the framework-agnostic subset above (PSR-12/type-system conventions,
Composer package hygiene, plain-PHP auth/crypto primitives) was a genuine
gap; this is a deliberate scope decision, not an oversight.
