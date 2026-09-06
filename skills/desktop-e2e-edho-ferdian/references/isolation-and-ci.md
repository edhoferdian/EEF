# Isolation Tiers & CI

Adapted from ECC `windows-desktop-e2e`, fetched 2026-09-04. Use the lightest
tier that satisfies the need.

| Tier | Isolates | Cost | CI | Use when |
|---|---|---|---|---|
| 1 — `tmp_path` env redirect | filesystem / user data | zero | always | default for every test |
| 2 — Job Object | process tree | low | always | app spawns children that escape cleanup |
| 3 — Windows Sandbox | full OS | medium | needs Pro/Enterprise | nightly clean-room runs |

## Tier 1 — the default app fixture

Launch through `subprocess.Popen` so a modified environment can be passed, then
attach pywinauto **by PID**. Redirect `APPDATA`, `LOCALAPPDATA`, `TEMP` and
`TMP` into pytest's per-test `tmp_path`, so each test gets a virgin profile and
pytest cleans up automatically. Set `QT_ACCESSIBILITY=1` in the same env for Qt
5.x targets. Split `APP_ARGS` with `shlex.split` (plain `.split()` breaks on
quoted paths). Function scope, never session scope. Teardown: close gracefully,
`proc.wait(timeout=5)`, `proc.kill()` as fallback — and capture the failure
screenshot before any of that.

```python
@pytest.fixture(scope="function")
def app(request, tmp_path):
    env = os.environ.copy()
    env["QT_ACCESSIBILITY"] = "1"
    env["APPDATA"]      = str(tmp_path / "AppData" / "Roaming")
    env["LOCALAPPDATA"] = str(tmp_path / "AppData" / "Local")
    env["TEMP"] = env["TMP"] = str(tmp_path / "Temp")
    for p in (env["APPDATA"], env["LOCALAPPDATA"], env["TEMP"]):
        os.makedirs(p, exist_ok=True)
    proc = subprocess.Popen([APP_PATH] + shlex.split(APP_ARGS), env=env)
    win = Application(backend="uia").connect(process=proc.pid, timeout=LAUNCH_TIMEOUT) \
              .window(title=APP_TITLE)
    win.wait("visible", timeout=LAUNCH_TIMEOUT)
    yield win
    # ... failure screenshot, then graceful close with kill fallback ...
```

## Tier 2 — Job Object

Attach the PID to a Windows Job Object created with
`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` (0x00002000) via `ctypes`, opening the
process with `PROCESS_SET_QUOTA | PROCESS_TERMINATE` (0x0101) and keeping the
job handle alive for the fixture's lifetime — closing it kills the whole
process tree. In `JOBOBJECT_BASIC_LIMIT_INFORMATION`, `LimitFlags` sits after
the two `LARGE_INTEGER` time limits; a wrong struct layout silently
misconfigures the job, so check `SetInformationJobObject`'s return and raise
`ctypes.WinError()` on failure.

**Scope warning:** Job Objects do not virtualize the filesystem and do not
block network traffic. They contain process lifetime and child processes only.
For file/network isolation use Tier 1 plus firewall rules, or Tier 3.

## Tier 3 — Windows Sandbox

A `.wsb` config maps the built app read-only and the test suite read-write,
and a `LogonCommand` installs Python (the sandbox image ships without it),
installs requirements, and runs pytest. Artifacts flow back to the host through
the read-write mapped folder. Requires Windows 10/11 Pro or Enterprise with
virtualization enabled. Both the app and pywinauto must run *inside* the
sandbox — they need the same session.

## Hang prevention

`pytest-timeout` with `timeout_method = thread` cannot kill a GUI subprocess on
Windows. Add an orphan reaper in `conftest.py`:

```python
import atexit, psutil
atexit.register(lambda: [p.kill() for p in psutil.Process().children(recursive=True)])
```

## CI (GitHub Actions)

`runs-on: windows-latest` — a real GUI session, no Xvfb equivalent needed.
Steps: checkout → `setup-python` → install deps → build the app → run pytest
with `APP_PATH` / `APP_TITLE` / `CI=true` in `env:` and
`--html=artifacts/report.html --self-contained-html --junitxml=artifacts/results.xml`
→ `upload-artifact` with `if: always()` and a retention window (14 days is a
reasonable default). Without `if: always()` the artifacts vanish on exactly the
runs where they matter.
