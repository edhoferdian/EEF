# Language Lens — Python / Django

**Requires: `python.md` (load first).** This file assumes general Python
idiom checks (mutable defaults, bare except, unsafe deserialization, type
hints) already ran. It adds only Django-framework-specific criteria on top.

**Detect.** `manage.py` at the repo root, or a `settings.py` with
`INSTALLED_APPS` / `django.` imports, in the review scope.

**Boundary — read before flagging anything.** Generic Python style and
generic injection stay owned by `python.md` and the general skill's
checklist. **N+1 detection in general is already the general skill's PERF
domain** — this lens adds only the **Django ORM-specific mechanics** of it
(`select_related`/`prefetch_related`, `.count()` vs `len()`, `.exists()`),
not the concept of N+1 itself. Migration safety, DRF serializer exposure, and
Django's specific security misconfigurations are entirely this lens's
territory since the general skill has no Django-specific knowledge.

**Code placement.** Findings land as **CQ-10 (Django-specific
anti-patterns)** or **PERF-08 (Django ORM performance)** in the general
report. **Django-specific security items (SEC-08) have moved to
`security-review-edho-ferdian/references/language-specific.md` §Python /
Django** — this file no longer holds its own copy; see that file for
`mark_safe()`, `@csrf_exempt`, `DEBUG=True`, hardcoded `SECRET_KEY`, unsafe
`eval()`/`exec()`, file-upload validation, missing DRF `permission_classes`,
`fields = '__all__'`, and missing auth-endpoint throttling. Load that file
(or delegate to the skill directly) when reviewing security.

---

## Ground-truth commands

```bash
python manage.py check                          # Django system check
python manage.py makemigrations --check          # detect missing migrations for model changes
ruff check .
mypy . --ignore-missing-imports
bandit -r . -ll                                  # security scan, medium+ (mark_safe, csrf_exempt, eval)
pytest --cov=apps --cov-report=term-missing -q   # tests + coverage
python manage.py sqlmigrate <app> <migration>    # inspect what a migration actually runs before flagging it unsafe
```

Do not label a migration-safety finding [High confidence] without actually
inspecting the migration file (or `sqlmigrate` output) for the missing
`reverse_code`, the column type change, or the drop in question — cap at
[Medium confidence] and name the file if you haven't opened it.

---

## Lens criteria

### CRITICAL (security)

**Django-specific security CRITICALs** (`mark_safe()` on user-controlled
input, `@csrf_exempt` on non-webhook views, `DEBUG=True` in production,
hardcoded `SECRET_KEY`, `eval()`/`exec()` on request-influenced values,
unvalidated file uploads, missing DRF `permission_classes`) moved to
`security-review-edho-ferdian/references/language-specific.md` §Python /
Django — not duplicated here.

### HIGH

- **N+1 via missing `select_related`/`prefetch_related`** — the Django-ORM
  form of N+1: a loop over a queryset that then accesses a
  ForeignKey/OneToOne (`select_related`) or reverse-FK/M2M
  (`prefetch_related`) without either, issuing one query per row. **PERF-08.**
  ```python
  # Bad — N+1
  for order in Order.objects.all():
      print(order.user.email)
  # Good
  for order in Order.objects.select_related('user').all():
      print(order.user.email)
  ```
- **Missing `transaction.atomic()` around a multi-step write** — a sequence
  of related DB writes with no atomic boundary can leave the database in a
  partially-written state if a later step fails. **CQ-10.**
- **Migration safety violations** — a model field change with no
  corresponding migration (confirm via `makemigrations --check`); a
  backward-incompatible column drop done in a single deployment instead of
  the two-phase pattern (make nullable / stop writing → drop); a `RunPython`
  data migration with no `reverse_code`, making the migration irreversible.
  **CQ-10.** The two-phase pattern named here is a partial statement of the
  full expand-contract pattern — see `data-layer-patterns-edho-ferdian/
  references/migrations.md` for the complete sequence (including the
  read-cutover phase this bullet doesn't cover) when designing a migration
  rather than reviewing one already written.
- **`bulk_create()` without `update_conflicts`** — silently drops rows that
  collide on a unique constraint instead of erroring or updating; verify the
  intended behavior on conflict. **CQ-10.**
**Django-specific security HIGHs** (`fields = '__all__'` on a DRF serializer,
missing throttling on an authentication endpoint) moved to
`security-review-edho-ferdian/references/language-specific.md` §Python /
Django — not duplicated here.

- **Missing pagination on a DRF list endpoint** — can return the entire
  table as the data grows; confirm a pagination class is set globally or
  per-view. **PERF-08.**
- **Synchronous external API call inside a view** — blocks the request
  thread for the duration of the call; should be offloaded to Celery (or
  another async task queue) with the view returning immediately. **PERF-08.**
- **Missing `db_index` on a foreign key or a commonly-filtered column** —
  causes a full table scan on that query pattern as the table grows.
  **PERF-08.**
- **N+1 finding with no `django_assert_num_queries` test backing it** — when
  reviewing an N+1 fix (or asserting one is absent), ask "is there a test
  asserting the query count?" rather than eyeballing the access pattern.
  `pytest-django`'s `django_assert_num_queries` (or Django's own
  `assertNumQueries`) is the ground-truth verification method for this
  category of finding — it fails the build the moment a future change
  reintroduces the N+1, where eyeballing the code does not. If no such test
  exists for a query path this change touches, **that absence is itself a
  finding** (Domain 5 test-gap territory, flagged here because it's the
  concrete fix for the PERF-08 N+1 item above), not just a note. **PERF-08 /
  Domain 5 cross-reference.** *(Mechanics only, not a RED/GREEN/REFACTOR
  cycle, which duplicates `dev-kickoff-edho-ferdian`'s own stricter TDD
  loop.)*

### MEDIUM

- **`len(queryset)` instead of `.count()`** — forces the entire queryset to
  be fetched into memory just to count rows. **PERF-08.**
- **`if queryset:` instead of `.exists()`** for an existence check — same
  issue, fetches objects it doesn't need.
  ```python
  # Bad
  if Product.objects.filter(sku=sku):
      ...
  # Good
  if Product.objects.filter(sku=sku).exists():
      ...
  ```
  **PERF-08.**
- **`save()` called without `update_fields`** after mutating only specific
  attributes — overwrites every column with the in-memory object's current
  values, which can clobber a concurrent write to a different field made
  between load and save. **CQ-10.**
- **Business logic embedded in a view or serializer** instead of a
  `services.py`-style module — makes the logic hard to reuse and hard to
  test independently of the HTTP layer. **CQ-10.**
- **Signal-based logic that would be clearer as an explicit service call** —
  Django signals make control flow implicit and hard to trace; prefer
  explicit calls unless there's a real cross-cutting reason for a signal.
  **CQ-10.**
- **Mutable default on a model field** — `default=[]` or `default={}`
  instead of `default=list`/`default=dict` — same root cause as the general
  Python mutable-default finding, but at the Django model-field layer where
  it additionally affects every row's initial value at the ORM level.
  **CQ-10.**
- **`str(queryset)` or slicing used for debugging** left in production code
  paths — use the Django shell for exploration, not runtime code.
- **Missing `related_name`** on a ForeignKey/ManyToMany — the default
  reverse accessor (`modelname_set`) is confusing and collides more easily
  when two FKs point at the same model.
- **`blank=True` without `null=True`** on a non-string field — the database
  ends up storing an empty string where a non-string type semantically wants
  `NULL`.
- **Missing test for a permission boundary** — no test asserting that an
  unauthorized request actually gets 401/403 on a protected endpoint. (This
  is the Django-specific instance of the general skill's Domain 5 test-gap
  checks — flag it here only if `test-quality-lens.md` isn't already active
  on this scope.)
- **`force_authenticate` used in tests instead of a real token/session** —
  bypasses the actual authentication code path, so the test doesn't verify
  auth logic actually works, only that the view works when auth is skipped.
- **Large queryset iterated without `.iterator()`** — a loop over a queryset
  expected to return many thousands of rows (a bulk export, a report, a data
  migration) with no `.iterator()` (or `.iterator(chunk_size=...)`), loading
  the entire result set into memory and into the queryset's result cache at
  once, when the caller never re-iterates the same queryset (i.e. doesn't
  need that cache). `.iterator()` streams rows from the database instead.
  Don't flag this on a queryset that's iterated more than once elsewhere, or
  one already small/bounded by pagination — the cost only shows up on
  genuinely large, single-pass iteration. **PERF-08.**
- **`cache.get_or_set` (or manual `cache.set`) with no invalidation path
  tied to the underlying model** — a view or service caches a value keyed
  off a model's data but nothing in that model's `save()`/`delete()` (or a
  `post_save`/`post_delete` signal) invalidates the cache key, so the cache
  can serve stale data indefinitely after the underlying row changes. Ask
  where the invalidation happens before accepting the cache as correct — "it
  will expire eventually" (a bare TTL with no explicit invalidation) is a
  finding when the data changes more often than the TTL assumes staleness is
  acceptable. **CQ-10.**
- **Django fixtures used for test data instead of `factory_boy` factories**
  — fixture-based test data (`fixtures = [...]` / `loaddata`) is shared,
  static, and mutated in place across a test run, which risks one test's
  mutation of a fixture row silently bleeding into another test's
  assertions. `factory_boy` factories build fresh, independent instances per
  test, removing that shared-mutable-state risk. Flag new tests introducing
  fixtures where the project already has `factory_boy` factories available
  for the same models; this is a preference, not a correctness bug, so cap
  at MEDIUM/LOW rather than HIGH.

---

## False-positive traps

The `fields = '__all__'` false-positive trap (internal-only serializer
behind staff-only permission classes) moved to `security-review-edho-
ferdian/references/language-specific.md` §Python / Django — not duplicated
here.

- A `RunPython` migration with no `reverse_code` that only ever *adds* data
  (e.g. seeding a lookup table) is lower risk than one that *transforms*
  existing data destructively — note the distinction rather than flagging
  both at the same severity.
- `select_related`/`prefetch_related` is unnecessary (not a finding) when
  the related object is only accessed 0 or 1 times total for the whole
  request, not once per row in a loop — verify the actual access pattern,
  don't flag every bare `.objects.all()` reflexively.
- `save()` without `update_fields` is fine on a freshly-fetched-and-fully-
  populated object with no concurrent-write risk (e.g. a single-writer batch
  job) — the risk is specifically about concurrent partial updates.
- Signals used for a genuinely cross-cutting, framework-level concern
  (invalidating a cache on any model save, regardless of call site) are an
  appropriate use of signals, not an anti-pattern — the finding is about
  signals standing in for business logic that has one clear caller.

## Escalate to general domain when…

- The finding is about general Python idiom with no Django-specific
  mechanism — that's `python.md`, not this file.
- A query-performance claim needs `EXPLAIN ANALYZE` or `pg_stat_statements`
  evidence to confirm index/scan behavior at the database level rather than
  the ORM-call-pattern level — that's `database-lens.md` in the general
  skill (activates automatically when the scope touches `migrations/` or ORM
  models, which Django projects always do).
- The finding is about DRF request/response shape correctness with no
  security or performance angle (e.g. inconsistent naming) — general Domain
  1 (CQ) in the base checklist, not this lens.
- A performance claim needs load-test or profiler evidence to size real
  impact — escalate to `performance-audit-edho-ferdian`.
