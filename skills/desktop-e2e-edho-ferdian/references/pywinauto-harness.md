# pywinauto Harness — Page Objects, Waits, Artifacts

Adapted from ECC `windows-desktop-e2e`, fetched 2026-09-04.

## Layout

```
tests/
├── conftest.py     # app fixture (see isolation-and-ci.md), failure screenshot hook
├── pytest.ini
├── config.py       # everything from env — no hardcoded paths
├── pages/          # base_page.py, login_page.py, main_page.py
├── tests/          # test_login.py, test_main_flow.py
└── artifacts/      # screenshots, videos, traces — gitignored
```

`config.py` reads `APP_PATH`, `APP_TITLE`, `APP_ARGS`, `LAUNCH_TIMEOUT`
(default 15), `ACTION_TIMEOUT` (default 10) from the environment and exits the
run with a clear message if `APP_PATH` or `APP_TITLE` is unset. Never commit a
machine-specific `.exe` path as a default.

`pytest.ini`:
```ini
[pytest]
testpaths = tests
markers =
    smoke: fast critical-path tests
    flaky: known-unstable, quarantined
addopts = -v --tb=short --html=artifacts/report.html --self-contained-html
timeout = 60
timeout_method = thread
```

## BasePage

```python
import os, time
from pywinauto import Desktop
from config import ACTION_TIMEOUT, ARTIFACT_DIR

class BasePage:
    def __init__(self, window):
        self.window = window

    # locators, in priority order
    def by_id(self, auto_id, **kw):  return self.window.child_window(auto_id=auto_id, **kw)
    def by_name(self, name, **kw):   return self.window.child_window(title=name, **kw)
    def by_class(self, cls, index=0, **kw):
        """Fragile. Last resort before screenshot fallback."""
        return self.window.child_window(class_name=cls, found_index=index, **kw)

    # waits — never time.sleep
    def wait_visible(self, spec, timeout=ACTION_TIMEOUT):
        spec.wait("visible", timeout=timeout); return spec

    def wait_gone(self, spec, timeout=ACTION_TIMEOUT):
        spec.wait_not("visible", timeout=timeout); return spec

    def wait_window(self, title, timeout=ACTION_TIMEOUT):
        """Dialogs and popups are separate TOP-LEVEL windows, not children."""
        dlg = Desktop(backend="uia").window(title=title)
        dlg.wait("visible", timeout=timeout); return dlg

    def wait_until(self, fn, timeout=ACTION_TIMEOUT, interval=0.3):
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                if fn(): return True
            except Exception:
                pass
            time.sleep(interval)
        raise TimeoutError(f"condition not met within {timeout}s")

    # actions
    def click(self, spec):
        self.wait_visible(spec); spec.click_input()

    def type_text(self, spec, text):
        self.wait_visible(spec)
        ctrl = spec.wrapper_object()
        try:
            ctrl.set_edit_text(text)
        except Exception:
            # Qt 5.x and some custom controls expose no UIA ValuePattern
            import pywinauto.keyboard as kb
            ctrl.click_input(); kb.send_keys("^a"); kb.send_keys(text, with_spaces=True)

    def get_text(self, spec):
        ctrl = spec.wrapper_object()
        for attr in ("window_text", "get_value"):
            try:
                v = getattr(ctrl, attr)()
                if v: return v
            except Exception:
                pass
        return ""

    def screenshot(self, name):
        os.makedirs(ARTIFACT_DIR, exist_ok=True)
        path = os.path.join(ARTIFACT_DIR, f"{name}.png")
        self.window.capture_as_image().save(path)
        return path
```

A page object then exposes intention-revealing actions only — `login(user,
pwd)`, `login_fail(user, pwd) -> error_text` — never raw locator chains in
test bodies. That is the same Page Object Model rule as the browser skill; only
the locator vocabulary changed.

## Exploring an unknown UI tree

```python
win.print_control_identifiers()                        # whole window
win.child_window(auto_id="groupBox1").print_control_identifiers()   # narrowed
```

## Artifacts

Screenshot on failure is the floor (wire it in `conftest.py` via a
`pytest_runtest_makereport` hookwrapper that stores `rep_call` on the item, and
capture in the fixture teardown when `rep_call.failed`).

Video, when a failure needs the sequence rather than the end state, via ffmpeg
`gdigrab` started before the test and stopped after (`-f gdigrab -framerate 10
-i desktop`).

**Per-step trace — opt-in only**, for reproducing a flake. Gate it behind
`E2E_TRACE=1`: capture one PNG per action plus a `trace.jsonl` line recording
timestamp, step index, action, and locator criteria. Typed text is
`<redacted>` unless `E2E_TRACE_INCLUDE_TEXT=1` — **never set that on login or
payment flows**. Costs ~50–200 ms and one PNG per action, so keep it off the
default CI matrix and out of parallel runs unless each worker writes to its own
artifact directory (the naive class-level step counter collides otherwise).
Actions taken with raw pywinauto calls outside `BasePage` are not traced.

## Flaky causes, ranked

| Cause | Fix |
|---|---|
| Control not ready | replace `time.sleep` with `wait_visible` |
| Window not focused | `win.set_focus()` before interacting |
| Animation in progress | `wait_until(lambda: not spinner.exists())` |
| Dialog timing | `wait_window(title, timeout=15)` |
| `set_edit_text` raises NotImplementedError | missing UIA ValuePattern (common on Qt 5.x) — the keyboard fallback in `type_text` already handles it |
| Times out though the control exists | window minimised or off-screen — `win.restore()` then `win.set_focus()` |

Confirm flakiness before quarantining: `pip install pytest-repeat` then
`pytest tests/test_login.py --count=5 -v`.
