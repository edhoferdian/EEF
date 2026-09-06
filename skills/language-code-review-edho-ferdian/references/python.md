# Language Lens — Python

Adapted from ECC `python-reviewer`, fetched 2026-09-04.

**Detect.** Any `.py` file in the review scope. If `manage.py`/`settings.py`
is also present, load `python-django.md` alongside this file; if a FastAPI
import is found in `main.py`/`app/main.py`, load `python-fastapi.md`
alongside this file. This file is the base layer either way — the
framework-specific files each say "Requires: python.md (load first)".

**Boundary — read before flagging anything.** Generic injection (SQL/command/
path traversal via string concatenation), generic secret handling, generic
function-length/nesting/magic-number checks, and generic N+1 detection are
**already owned by `references/review-checklist.md`** in the general skill.
This lens adds only what is specific to **Python's language idioms and
standard library** — mutable defaults, exception handling patterns, unsafe
deserialization primitives that only exist in Python (`pickle`, `yaml.load`),
type-hint discipline, and stdlib-vs-anti-pattern choices.

**Code placement.** Findings land as **CQ-10 (Python idiom anti-patterns)**
in the general report. **Python-specific security items (SEC-08) have moved
to `security-review-edho-ferdian/references/language-specific.md`** §Python
(base) — this file no longer holds its own copy; see that file for unsafe
deserialization (`pickle`, `yaml.load`), `eval()`/`exec()` on external input,
and weak cryptographic hashes. Load that file (or delegate to the skill
directly) when reviewing security.

---

## Ground-truth commands

```bash
mypy .                                       # type checking — confirms CQ-06/type-hint findings
ruff check .                                 # fast linting — confirms most idiom findings below
black --check .                              # format check
bandit -r .                                  # security scan — confirms eval/exec/pickle/yaml findings
pytest --cov=app --cov-report=term-missing   # test coverage (general skill's Domain 5 territory)
```

Do not label a `bandit`-detectable finding (unsafe `yaml.load`, `pickle`,
`eval`/`exec`, weak crypto) as [High confidence] without actually running
`bandit` — reading the line and recognizing the pattern is reasoning, not
verification, per the general skill's Phase 2 rule.

---

## Lens criteria

### CRITICAL (security)

**Python-specific security CRITICALs** (unsafe deserialization via `pickle`/
`yaml.load`, `eval()`/`exec()` on external input, weak cryptographic hashes
for passwords/tokens/signatures) moved to `security-review-edho-ferdian/
references/language-specific.md` §Python (base) — not duplicated here.

### HIGH

- **Mutable default argument** — `def f(x=[])` or `def f(x={})`. The default
  object is created once at function-definition time and shared across every
  call that doesn't pass `x` explicitly, so mutations leak between unrelated
  calls. Fix: `def f(x=None): x = x if x is not None else []`. **CQ-10.**
- **Bare `except: pass`** (or `except Exception: pass` with no logging/
  re-raise/comment) — silently swallows every error including ones that
  indicate real bugs (`KeyboardInterrupt`, a programming error, a resource
  failure). Catch the specific exception type and handle or log it. **CQ-10.**
  (This overlaps the general skill's CQ-05/silent-failure lens — if that lens
  is also active, don't double-report the same catch block; let CQ-05 own the
  "silent failure" framing and note the Python-specific mechanism here only
  if CQ-05 isn't already covering it.)
- **Missing context manager for a resource** — manual
  `f = open(...); ...; f.close()` instead of `with open(...) as f:` — a raised
  exception before `.close()` leaks the file handle/socket/lock. **CQ-10.**
- **`type(x) == SomeType` instead of `isinstance(x, SomeType)`** — breaks for
  subclasses and is the non-idiomatic form; `isinstance` is also required for
  ABC/protocol compatibility checks. **CQ-10.**
- **Missing type hints on public functions, or `Any` used where a specific
  type is knowable** — `Any` opts the value out of type-checking entirely;
  reserve it for genuinely dynamic boundaries (deserialized JSON before
  validation), not for "didn't figure out the real type." **CQ-06/CQ-10.**
- **Builtin shadowing** — parameters or variables named `list`, `dict`,
  `str`, `type`, `id`, etc. shadow the builtin for the rest of that scope,
  causing confusing bugs anywhere else in the function that expects the real
  builtin. **CQ-10.**
- **Exception chaining broken** — `raise NewError("...")` inside an `except
  OriginalError as e:` block with no `from e` (or an explicit `from None`
  when suppression is genuinely intended). Without `from e`, the original
  traceback is dropped from the exception chain (`__cause__`), so whoever
  debugs the `NewError` later has no path back to what actually failed.
  Fix: `raise NewError("...") from e`. **CQ-10.** *(Adapted from ECC
  `python-patterns`, fetched 2026-09-04.)*

### MEDIUM

- **`value == None` instead of `value is None`** — `==` can be overridden by
  `__eq__` on a custom class and gives a surprising result; identity
  comparison against the `None` singleton is the correct and idiomatic form.
  **CQ-10.**
- **`print()` used instead of `logging`** in application/library code
  (scripts and one-off tooling are fine) — `print` output can't be leveled,
  routed, or disabled per-module, and is easy to leave in accidentally.
  **CQ-10.**
- **`from module import *`** — pollutes the namespace, makes it impossible to
  tell where a name came from by reading the file, and can silently shadow
  other imports. **CQ-10.**
- **C-style loop where a comprehension/generator expression is clearer** —
  `for i in range(len(x)): result.append(f(x[i]))` instead of
  `[f(v) for v in x]`. Flag only when the comprehension is genuinely more
  readable, not as a blanket style preference. **CQ-10.**
- **String concatenation in a loop** (`s += chunk`) instead of
  `"".join(chunks)` — quadratic behavior on large inputs; this is a
  Python-specific performance idiom distinct from the general skill's PERF
  domain, which doesn't know about CPython string immutability specifically.
  **CQ-10.**
- **Magic-number-shaped enum candidate** — a set of related integer/string
  literals that represent a closed set of states, better expressed as
  `enum.Enum`, where the general skill's generic CQ-12 magic-number check
  wouldn't necessarily suggest the Python-specific fix (an `Enum`, not just
  a named constant).
- **LBYL where EAFP is the idiomatic default** — `if key in dct: value =
  dct[key]` (or `if hasattr(obj, "attr"):` then accessing it) instead of
  `try: value = dct[key] except KeyError:` or `dct.get(key, default)`. EAFP
  is not just style here: the LBYL form is also a **TOCTOU race** in any
  concurrent/threaded context (the key can be removed between the check and
  the access), which the try/except form doesn't have. Flag the idiom gap
  and, when the code is reachable from multiple threads/async tasks, note
  the race explicitly. **CQ-10.** *(Adapted from ECC `python-patterns`,
  fetched 2026-09-04.)*
- **Inheritance used only for structural typing** — a class inherits from an
  abstract base purely so a type checker accepts it somewhere, with no
  shared implementation actually reused from the base. A `typing.Protocol`
  (structural, duck-typed) expresses "has this shape" without forcing an
  inheritance relationship the runtime doesn't need. Suggest `Protocol` when
  the only reason for the base class is the type checker, not shared code.
  *(Adapted from ECC `python-patterns`, fetched 2026-09-04.)*
- **Missing `__slots__` on a memory-sensitive, fixed-attribute class** — a
  class instantiated in bulk (thousands+ instances: rows, events, graph
  nodes) with a fixed, known-at-class-definition set of attributes and no
  dynamic attribute assignment, left with the default per-instance `__dict__`
  instead of `__slots__ = (...)`. Only flag where instance count is actually
  large enough for the per-instance dict overhead to matter — not a blanket
  suggestion for every class. *(Adapted from ECC `python-patterns`, fetched
  2026-09-04.)*

---

## False-positive traps

- `except Exception:` followed by a `logger.exception(...)` or `raise` is
  **not** a silent failure — only flag the bare/pass form.
- A mutable default argument that is never mutated in the function body
  (used strictly read-only) is a latent risk, not an active bug — cap at
  MEDIUM instead of HIGH and say why.
- `Any` on a function's parameter that receives genuinely heterogeneous,
  validated-just-before-use JSON (e.g. straight off `request.json()` before a
  Pydantic model validates it) is the correct boundary type, not a finding —
  the finding belongs at the point where the value is used without having
  been narrowed.
- `print()` inside a `if __name__ == "__main__":` block, a management
  command's user-facing CLI output, or a test file is normal, not a finding.
- `type(x) == type(y)` used specifically to check "are these the exact same
  concrete type" (not "is this an instance of a hierarchy") is occasionally
  intentional — check whether subclass behavior would actually be wrong
  before flagging.
- An `if key in dct:` check kept deliberately to avoid the (measured, not
  assumed) cost of exception handling in a hot loop, or because the
  presence check and the value use are genuinely separate decisions (not
  "check then immediately use"), is not automatically an EAFP violation —
  the finding is about the check-then-use pattern specifically, not every
  membership test. *(Adapted from ECC `python-patterns`, fetched
  2026-09-04.)*

## Escalate to general domain when…

- The finding is generic SQL/command/path injection via string formatting
  with no Python-specific nuance — that's the general skill's SEC domain,
  not this lens; don't re-flag it here just because the string happens to be
  Python.
- The finding is about test coverage or test quality — that's Domain 5
  (`test-quality-lens.md`) in the general skill.
- A performance claim needs profiling/benchmark evidence to confirm (not
  just "this loop looks slow") — escalate to `performance-audit-edho-ferdian`
  per the general skill's PERF escalation rule.
- The file is actually Django or FastAPI code — apply this file's findings
  first, then layer `python-django.md` / `python-fastapi.md` on top; don't
  try to cover framework-specific ORM/DI/routing concerns from this file.
