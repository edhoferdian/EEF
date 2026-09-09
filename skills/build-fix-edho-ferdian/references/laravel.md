# PHP / Laravel — build, migration & startup lens

Adapted from ECC `laravel-patterns`, `laravel-tdd`, `laravel-verification`,
fetched 2026-09-07.

Scope: Composer dependency resolution failures, Artisan migration errors,
PHPUnit/Pest bootstrap failures, config/cache staleness, and queue/scheduler
startup problems. You fix the error only — you do not refactor controllers,
models, or service layers beyond what the error demands. The security-side
content for this stack already lives in `security-review-edho-ferdian/
references/language-specific.md` §"PHP / Laravel" (D-012) —
irrelevant to this skill's job (build-fix never touches security posture as
its goal), noted only so a future session doesn't confuse "security
deferred" with "nothing about Laravel is ported yet."

## Diagnostic commands

Run these in order to localize the error before touching anything:

```bash
# Confirm interpreter, Composer, and Artisan versions
php -v
composer --version
php artisan --version

# If the project uses Laravel Sail locally, run the same commands through it
./vendor/bin/sail php -v
./vendor/bin/sail artisan --version

# Confirm composer.json/composer.lock are internally consistent
composer validate
composer dump-autoload -o

# Confirm .env is present and required keys resolve
php artisan config:show app 2>&1

# Migration state
php artisan migrate:status 2>&1
php artisan migrate --pretend 2>&1

# Test bootstrap sanity
php artisan test --list-tests 2>&1
```

## Resolution workflow

```
1. Reproduce the error           -> capture the exact message, unedited
2. Identify the error family     -> use the tables below
3. Read the affected file/config -> understand context before editing
4. Apply the minimal fix         -> only what the error demands
5. php artisan config:clear      -> clear stale cached config/routes/views
   && php artisan test           -> confirm the actual fix, not a caching artifact
6. Re-run the full pipeline      -> confirm nothing else broke
```

## Composer dependency resolution failures

| Error | Cause | Fix |
|---|---|---|
| `Your requirements could not be resolved to an installable set of packages` | Conflicting version constraints across `composer.json` requirements | Read the "Problem" block Composer prints — it names the exact conflicting packages; relax the narrowest constraint rather than force-installing |
| `Root composer.json requires X but the package could not be found` | Wrong package name, or the package needs a repository not in `repositories` | Confirm the package name/case on Packagist; add a `repositories` entry only if it is genuinely a non-Packagist package |
| `installed X does not satisfy that constraint` (during `composer install` from a committed `composer.lock`) | `composer.lock` is stale relative to `composer.json` | `composer update <package>` for the specific package, not a blanket `composer update` — a blanket update is an untracked multi-dependency change, escalate per the Reflection gate's rule 3 if the fix would need one |
| `PHP extension ext-X is missing from your system` | A required PHP extension isn't installed/enabled | Install/enable the extension in `php.ini` (e.g. `extension=intl`), don't strip the requirement from `composer.json` as the "fix" |
| `Class "X" not found` after a fresh `composer install` | Autoloader stale, or a new class added but not yet in the classmap | `composer dump-autoload -o` |
| `Allowed memory size of N bytes exhausted` during `composer update` | Composer's own memory limit too low for a large dependency graph | `COMPOSER_MEMORY_LIMIT=-1 composer update` |

```bash
# Force a clean, deterministic reinstall
rm -rf vendor composer.lock
composer install

# Diagnose a specific conflict without changing anything yet
composer why-not <package> <version>
composer depends <package>

# Regenerate the optimized autoloader after any dependency change
composer dump-autoload -o
```

## Artisan migration errors

| Error | Cause | Fix |
|---|---|---|
| `SQLSTATE[42S01]: Base table or view already exists` | The table was created outside Laravel's migration system, or a migration ran twice | `php artisan migrate:status` to see what Laravel thinks is applied, then reconcile — never re-run `migrate:fresh` on a database with real data to make this go away |
| `SQLSTATE[42S02]: Base table or view not found` | A migration exists but was never run | `php artisan migrate` |
| `Nothing to migrate` but the schema is visibly wrong | Migrations already marked as run in the `migrations` table without their SQL ever executing (bad rollback history) | Inspect the `migrations` table directly; do not fake a re-run — reconstruct the missing SQL as a new migration instead |
| `There is no column with name 'X' on table 'Y'` inside a migration referencing a column added by a *later* migration | Migration files run in timestamp order but this one depends on a column defined after it | Fix the migration filename's timestamp so dependency order is correct, or move the column definition into this migration — this is exactly the naming convention `laravel-patterns` calls out (`YYYY_MM_DD_HHMMSS_*`) |
| `Class "Database\Migrations\X" not found` | Migration uses a named class in a project that expects the anonymous-class convention (or vice versa after an upgrade) | Match the project's actual convention — Laravel 9+ default is anonymous `return new class extends Migration { ... };`, no named class |
| `Foreign key constraint is incorrectly formed` / `errno: 150` | Referenced table doesn't exist yet, or a type/collation mismatch between the FK column and its parent's primary key | Reorder migrations so the parent table's migration runs first, or fix the column type to match exactly |
| `SQLSTATE[HY000] [2002] Connection refused` | DB service not running, or wrong `DB_HOST`/`DB_PORT` in `.env` | Start the DB service, or correct the `.env` values, then `php artisan config:clear` |

```bash
# Inspect before acting — never edit the migrations table by hand
php artisan migrate:status
php artisan migrate --pretend

# Merge/reconcile is not automatic in Laravel the way it is in Django —
# there is no merge command; fix migration timestamp ordering directly

# Reset — DEV ONLY, never on a DB with real data; this is exactly the kind
# of destructive step the loop guard should stop on if there is any doubt
# about which environment you're in
php artisan migrate:fresh
php artisan migrate:fresh --seed
```

**`down()` discipline:** never delete or silently skip a broken migration to
make an error go away. A deleted migration corrupts history for every other
environment that already applied it. If a migration's `down()` is missing or
wrong, fix `down()` itself — this is the same anti-suppression rule
`laravel-verification`'s Phase 5 gate applies before merge, just enforced
earlier, at the point the error first surfaces.

## PHPUnit / Pest bootstrap failures

| Error | Cause | Fix |
|---|---|---|
| `Error: Class "Tests\TestCase" not found` | Autoloader stale, or `tests/TestCase.php` missing/renamed | `composer dump-autoload -o`; confirm `tests/TestCase.php` extends `Illuminate\Foundation\Testing\TestCase` |
| `SQLSTATE[HY000]: General error: 1 no such table` in the test suite | Test DB (usually SQLite `:memory:` per `laravel-tdd`'s PHPUnit config) never migrated for the test run | Confirm `phpunit.xml`'s `DB_CONNECTION=sqlite` / `DB_DATABASE=:memory:` block is present and the test class uses `RefreshDatabase` |
| `Trait "Illuminate\Foundation\Testing\RefreshDatabase" not found` | Wrong Laravel testing package version, or `composer.json`'s `require-dev` missing `orchestra/testbench` (package-context tests) | Confirm `laravel/framework`'s testing traits are available for the current version; for package tests add `orchestra/testbench` |
| `Failed asserting that... session has no errors` right after upgrading form requests | Form Request's `authorize()` returning `false` unexpectedly (often a stale `Auth::user()` in a test not calling `actingAs()` first) | Not a build error strictly, but the fastest single-line fix if the whole suite fails identically: confirm every feature test authenticates before hitting an authorized route |
| `Call to a member function make() on null` from `UploadedFile::fake()` calls | `Storage::fake('public')` never called before an upload test, or facade root not bound in a Testbench context | Add `Storage::fake('public')` in `setUp()`/`beforeEach()` per `laravel-tdd`'s Storage Fake example |
| Pest: `Tests\TestCase` not bound — `uses(...)` has no effect | `Pest.php`'s `uses()` file missing, or wrong namespace glob | Confirm `tests/Pest.php` calls `uses(Tests\TestCase::class)->in('Feature')` (and `Unit` if needed) |
| `XDEBUG_MODE=coverage` set but coverage report is empty/zero | Xdebug not installed, or a different coverage driver (PCOV) expected | Confirm `php -v` shows Xdebug (`php -m | grep -i xdebug`) or switch to `pcov` if that's what CI actually uses |
| `Class "Database\Factories\XFactory" not found` | Factory namespace/`HasFactory` mismatch, or `composer dump-autoload` not run after adding a new factory | `composer dump-autoload -o`; confirm the model uses `HasFactory` and the factory file matches Laravel's factory-discovery naming (`XFactory` for model `X`) |

```bash
# Bootstrap sanity checks, cheapest first
composer dump-autoload -o
php artisan test --list-tests 2>&1

# Run a single failing test in isolation to rule out cross-test pollution
php artisan test --filter=test_it_stores_a_new_product

# Pest equivalent
vendor/bin/pest --filter="stores a new product"

# Coverage run (requires Xdebug or PCOV) — confirms the coverage-report
# error family specifically, not general test failures
XDEBUG_MODE=coverage php artisan test --coverage
```

## Config/route/view cache staleness

A build that passes locally but fails after deploy, or a `.env` change with
no visible effect, is very often stale cache, not a real regression — check
this family before assuming the code itself is broken:

| Symptom | Cause | Fix |
|---|---|---|
| `.env` change has no effect after deploy | `config:cache` was run before the `.env` change and never cleared | `php artisan config:clear && php artisan config:cache` |
| A route added/changed doesn't show up | `route:cache` stale | `php artisan route:clear && php artisan route:cache` |
| A Blade view edit doesn't render | `view:cache` stale | `php artisan view:clear && php artisan view:cache` |
| Everything above at once, unclear which | Any of the three, or all | `php artisan optimize:clear` (clears all caches), then re-cache each explicitly for production |

```bash
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## Queue / scheduler startup problems

| Error | Cause | Fix |
|---|---|---|
| Jobs stay `pending` forever, never processed | No `queue:work`/`queue:listen` process running, or `QUEUE_CONNECTION=sync` in an environment that needs async | Start a worker (`php artisan queue:work`), or correct `QUEUE_CONNECTION` in `.env` |
| `php artisan schedule:list` shows nothing scheduled | The scheduler's cron entry isn't installed on the host, or `routes/console.php`/`app/Console/Kernel.php` schedule block is empty | Confirm the server crontab runs `php artisan schedule:run` every minute; confirm the schedule definitions actually exist |
| `Horizon` dashboard shows no supervisors | `php artisan horizon` process not running, or Redis connection misconfigured | Start `php artisan horizon`; confirm `REDIS_HOST`/`REDIS_PORT` resolve |
| A queued job silently never runs and never appears in `queue:failed` | Job dispatched onto a queue name no worker is listening to (worker started with `--queue=default` but job dispatched `->onQueue('emails')`) | Match the worker's `--queue` flag to the job's actual queue name, or dispatch without `onQueue()` to use the default |

```bash
php artisan queue:failed
php artisan queue:retry all
php artisan schedule:list
php artisan horizon:status   # if Horizon is used
```

## Anti-suppression reminders specific to this stack

- Never delete or edit a migration file to make a conflict go away — fix
  timestamp ordering or add a corrective migration instead; a deleted
  migration corrupts history for every other environment that already
  applied it.
- Never set `APP_DEBUG=true` in a production `.env` as a way to "see the real
  error" during a build-fix session and forget to revert it — that's a
  security-relevant setting change (tracked separately in the security file),
  not a build fix, and directly parallels the Django lens's `DEBUG=True`
  warning.
- Never run `migrate:fresh` (or `--seed`) against a database that might hold
  real data to make a migration error go away — confirm the environment
  first; this is exactly the destructive step the loop guard should stop on.
- Prefer `composer update <specific-package>` over a blanket
  `composer update` with no arguments — the latter is the kind of untracked
  multi-dependency change the Reflection gate's rule 3 is meant to catch.
- A coverage-threshold failure (`pest --coverage --min=80` failing) is not a
  build error to suppress by lowering the `--min` flag — that is a scope
  decision belonging to whoever owns the coverage policy, not this skill's
  mandate; report it and stop rather than quietly loosening the gate.
