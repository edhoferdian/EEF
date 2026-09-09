# Django / Python — build, migration & startup lens

Scope: pip/Poetry dependency resolution, Django migration errors, settings/
configuration errors, circular imports, database connection failures, and
`collectstatic`/`STORAGES` misconfiguration. You fix the error only — you do
not refactor models, views, or settings beyond what the error demands.

## Diagnostic commands

Run these in order to localize the error before touching anything:

```bash
# Confirm interpreter and framework versions
python --version
python -m django --version

# Confirm the virtualenv is actually active
which python
pip list | grep -E "Django|djangorestframework|celery|psycopg"

# Confirm installed packages are internally consistent
pip check

# Validate Django's own configuration
python manage.py check --deploy 2>&1 || python manage.py check 2>&1

# Migration state
python manage.py showmigrations 2>&1
python manage.py migrate --check 2>&1

# Static files, dry run only at this stage
python manage.py collectstatic --dry-run --noinput 2>&1
```

## Resolution workflow

```
1. Reproduce the error          -> capture the exact message, unedited
2. Identify the error family    -> use the tables below
3. Read the affected file/config -> understand context before editing
4. Apply the minimal fix        -> only what the error demands
5. python manage.py check       -> validate Django config again
6. Run the test suite           -> confirm nothing else broke
```

## Dependency resolution (pip / Poetry)

| Error | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'X'` | Package not installed in the active environment | `pip install X`, or add it to `requirements.txt`/`pyproject.toml` if it's a real project dependency, not a one-off |
| `ImportError: cannot import name 'X' from 'Y'` | Installed version of `Y` doesn't export `X` at that path — usually a version mismatch | Pin a compatible version of `Y` in the requirements file |
| `ERROR: pip's dependency resolver does not currently take into account...` | Conflicting version constraints across packages | Upgrade pip first (`pip install --upgrade pip`), then re-resolve with `pip install -r requirements.txt` |
| `Poetry: No solution found` | Conflicting version constraints in `pyproject.toml` | Relax the offending version pin rather than force-installing |
| `pkg_resources.DistributionNotFound` | Package installed outside the active virtualenv | Confirm `which python` points at the venv, reinstall inside it |

```bash
# Force-reinstall everything cleanly
pip install --force-reinstall -r requirements.txt

# Poetry: clear cache and re-resolve
poetry cache clear --all pypi
poetry install

# Nuclear option for a corrupted venv — confirm with the user first if this
# is a shared/CI environment, not just the developer's local machine
deactivate
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Migration errors

| Error | Cause | Fix |
|---|---|---|
| `django.db.migrations.exceptions.MigrationSchemaMissing` | DB tables were never created | `python manage.py migrate` |
| `InconsistentMigrationHistory` | A migration was applied out of dependency order | Fake the correct sequence back into alignment, or squash — see command below; never edit the migration history table directly |
| `Migration X dependencies reference nonexistent parent Y` | A migration file was deleted or never committed | Recreate it with `makemigrations`, matching the missing dependency's name if the app already assumes it exists |
| `relation "X" already exists` / `Table already exists` | The table was created outside Django's migration system (raw SQL, another tool) | `python manage.py migrate --fake-initial` |
| `Multiple leaf nodes in the migration graph` | Two migration branches diverged (common after a merge) | `python manage.py makemigrations --merge --no-input` |
| `django.db.utils.OperationalError: no such column` | A migration exists but was never applied | `python manage.py migrate` |

```bash
# Merge conflicting migration branches
python manage.py makemigrations --merge --no-input

# Fake a migration that's already reflected in the DB schema
python manage.py migrate --fake <app> <migration_number>

# Reset an app's migrations — DEV ONLY, never on a DB with real data;
# this is exactly the kind of destructive step the loop guard should stop
# on if there's any doubt about which environment you're in
python manage.py migrate <app> zero
python manage.py makemigrations <app>
python manage.py migrate <app>

# Inspect before acting
python manage.py migrate --plan
```

**`--fake` discipline:** `--fake` marks a migration as applied without
running its SQL. Use it only when you have confirmed the DB schema already
matches what that migration would produce — faking a migration whose SQL
was never actually run leaves the DB schema silently wrong. This is the
anti-suppression rule applied to migrations: `--fake` used to make the
error message go away without confirming the underlying schema state is a
suppression, not a fix.

## Settings / configuration errors

| Error | Cause | Fix |
|---|---|---|
| `django.core.exceptions.ImproperlyConfigured` | A required setting is missing or holds an invalid value | Read the exception message for the exact setting name, check `settings.py`/the settings module for it |
| `DJANGO_SETTINGS_MODULE not set` (or pointing at the wrong module) | Environment variable missing or wrong | `export DJANGO_SETTINGS_MODULE=config.settings.development` (adjust path to the project's actual settings package) |
| `SECRET_KEY must not be empty` | Missing environment variable the settings file reads from | Set `DJANGO_SECRET_KEY` (or whatever name the settings file expects) in `.env` — never hardcode a literal key in `settings.py` as the fix |
| `Invalid HTTP_HOST header` | `ALLOWED_HOSTS` doesn't include the host making the request | Add the specific hostname to `ALLOWED_HOSTS`; don't blanket it to `['*']` as a build fix — that's a security-relevant setting change outside this skill's mandate |
| `Apps aren't loaded yet` | A model (or app-registry-dependent code) was imported before `django.setup()` ran | Call `django.setup()` first in standalone scripts, or move the import inside a function so it runs after Django's app loading |
| `RuntimeError: Model class ... doesn't declare an explicit app_label` | The app isn't listed in `INSTALLED_APPS` | Add the app to `INSTALLED_APPS` |

```bash
# Confirm the settings module actually resolves
python -c "import django; django.setup(); print('OK')"

echo $DJANGO_SETTINGS_MODULE

# List every setting Django is actually using vs. its defaults
python manage.py diffsettings 2>&1
```

## Circular imports

```bash
python -c "import <module>" 2>&1
grep -r "from <module> import" . --include="*.py"
python -c "import <app>; print(<app>.__file__)"
```

Fix by deferring the import, not by restructuring the module graph (that's
a refactor, out of scope here):

```python
# Triggers the cycle — top-level import evaluated at module load time
from apps.users.models import User

# Fix 1 — defer the import until the function actually runs
def get_user(pk):
    from apps.users.models import User
    return User.objects.get(pk=pk)

# Fix 2 — use Django's app registry instead of a direct import
from django.apps import apps
User = apps.get_model('users', 'User')
```

If Salak is installed (see `dev-kickoff-edho-ferdian`'s
`salak-integration.md`), read the real cycle path from its
`repo-graph.json` instead of reconstructing it by hand from grep output —
faster and it won't miss an edge a manual grep skipped.

## Database connection failures

| Error | Cause | Fix |
|---|---|---|
| `django.db.utils.OperationalError: could not connect to server` | DB process not running, or wrong host/port | Start the DB, or correct `DATABASES['default']['HOST']`/`PORT` |
| `django.db.utils.OperationalError: FATAL: role "X" does not exist` | Wrong DB user configured | Correct `DATABASES['default']['USER']` |
| `django.db.utils.ProgrammingError: relation "X" does not exist` | A migration hasn't been applied | `python manage.py migrate` |
| `ModuleNotFoundError: No module named 'psycopg2'` (or similar driver) | DB driver package missing | `pip install psycopg2-binary` (or the equivalent driver for the configured `ENGINE`) |

```bash
python manage.py dbshell
python -c "from django.conf import settings; print(settings.DATABASES)"
```

## `collectstatic` / `STORAGES` misconfiguration

| Error | Cause | Fix |
|---|---|---|
| `staticfiles.E001: The STATICFILES_DIRS setting should not contain the STATIC_ROOT setting` | Same directory listed in both settings | Remove it from `STATICFILES_DIRS` — `STATIC_ROOT` is the collection target, not a source |
| `FileNotFoundError` during `collectstatic` | A template references a static file that doesn't exist on disk | Fix or remove the dangling `{% static %}` reference |
| `AttributeError: 'str' object has no attribute 'path'` | `STORAGES` dict not configured for Django 4.2+'s storage API | Update `settings.py` to the `STORAGES = {...}` dict form (replaces the old `STATICFILES_STORAGE` string setting) |

```bash
python manage.py collectstatic --dry-run --noinput 2>&1
python manage.py collectstatic --clear --noinput
```

## `runserver` / management-command failures

```bash
# Port already bound by another process
lsof -ti:8000 | xargs kill -9
python manage.py runserver

# Use a different port instead of killing the other process
python manage.py runserver 8080

# Verbose output surfaces errors that otherwise get swallowed on startup
python manage.py runserver --verbosity=2 2>&1
```

## Anti-suppression reminders specific to this stack

- Never delete a migration file to make a conflict go away — fake or merge
  it instead; a deleted migration corrupts history for every other
  environment that already applied it.
- Never set `ALLOWED_HOSTS = ['*']` or blanket-disable `DEBUG`-only checks
  as a build fix — that's a security-relevant setting change, escalate
  instead of silently loosening it.
- Never use `--fake` without confirming the DB schema already matches —
  see the `--fake` discipline note above.
- Prefer `pip install --upgrade` for a single conflicting package over
  hand-editing `requirements.txt` pins across multiple packages at once —
  the latter is exactly the kind of untracked multi-dependency change the
  Reflection gate's rule 3 is meant to catch.
