---
name: desktop-e2e-edho-ferdian
description: >-
  End-to-end testing for Windows native desktop applications (WPF, WinForms,
  Win32/MFC, Qt 5/6) using pywinauto over the Windows UI Automation API. The
  native-automation driver that e2e-testing-edho-ferdian's Phase 0 detects as
  option 4 but has no content behind — journey mapping and the Page Object
  Model come from there; the pywinauto mechanics live here. Use when the
  target is a desktop .exe rather than a browser page, when a desktop GUI test
  suite is being set up or is flaky, or when adding AutomationIds to make an
  app testable. Trigger phrases: "test aplikasi desktop", "pywinauto",
  "WPF/WinForms/Qt test", "UI Automation", "test .exe ini".
---

# Desktop E2E (Windows) — Edho Ferdian Mode

## Where this sits

`e2e-testing-edho-ferdian` owns the *process*: Phase 1 journey mapping,
Phase 2 Page Object Model, Phase 3 flake quarantine, Phase 4 artifact capture.
All four are driver-agnostic and apply unchanged here — do not restate or fork
them. This skill supplies only what changes when the driver is native Windows
automation instead of a browser:

| Concept | Browser (Playwright) | Here (pywinauto + UIA) |
|---|---|---|
| Locator | role / `data-testid` / CSS | AutomationId → Name → ClassName+index |
| Wait | auto-waiting locators | `spec.wait("visible")` / `wait_until(...)` |
| Artifact | screenshot / video / trace | window capture / ffmpeg `gdigrab` / step trace |
| Isolation | browser context | fresh process + redirected `APPDATA`/`TEMP` |

**Not for:** web apps (use Playwright), Electron/CEF/WebView2 (the HTML layer
needs browser automation, UIA only sees the shell), mobile, or anything that
does not need a running GUI.

## How it works

Everything routes through Windows UI Automation, an accessibility API built
into Windows. Each UI framework ships a UIA provider of varying quality:

```
pytest → pywinauto (uia backend) → Windows UI Automation API → app's UIA provider → running .exe
```

| Framework | AutomationId source | Reliability |
|---|---|---|
| WPF | `x:Name` maps directly | Excellent |
| UWP / WinUI 3 | native | Excellent |
| Qt 6.x | `setAccessibleName`; accessibility on by default | Excellent |
| WinForms | `AccessibleName` | Good |
| Qt 5.15+ | needs `QT_ACCESSIBILITY=1` | Good |
| Qt 5.7–5.14 | needs `QT_ACCESSIBILITY=1`; manual objectName | Fair |
| Win32 / MFC | resource control IDs appear as numeric strings | Fair |

## Phase 0′ — Environment check (before anything else)

```bash
pip install pywinauto pytest pytest-html pytest-timeout Pillow
```

```python
from pywinauto import Desktop
Desktop(backend="uia").windows()   # must list top-level windows
```

Install **Accessibility Insights for Windows** (free, Microsoft) — it is the
DevTools equivalent for this stack. Inspect the UIA tree there *before*
writing a locator; guessing at AutomationIds is the main time sink here.

If UIA is unreachable, or the target turns out to be Electron/WebView2, stop
and say so — report `VERIFIED: NO — no usable native automation driver`, the
same convention the rest of this ecosystem uses. Never fabricate a run.

## Testability first

The single highest-leverage action is giving every interactive control a
stable AutomationId **before** writing tests. Per framework:

- **WPF** — `x:Name="btnLogin"` in XAML; nothing else needed.
- **WinForms** — `btnLogin.AccessibleName = "btnLogin";`
- **Qt** — set both, via one helper, and centralize the string constants in a
  header so tests and app cannot drift:
  ```cpp
  void setTestId(QWidget* w, const char* id) {
      w->setObjectName(id);
      w->setAccessibleName(id);   // becomes the UIA Name property
  }
  ```
- **Win32 / MFC** — resource IDs surface as numeric AutomationId strings;
  prefer `SetWindowText` for a readable Name.

A test suite written against `ClassName + index` because the app has no
AutomationIds will be rewritten within a release. Fixing testability in the app
is cheaper than the flakiness it prevents — say so when the app owner resists.

## References

- **`references/pywinauto-harness.md`** — the Page Object base class, locator
  priority, wait patterns, artifact capture, the opt-in per-step trace, and the
  flaky-cause table.
- **`references/isolation-and-ci.md`** — the three isolation tiers (tmp_path
  env redirect / Job Object / Windows Sandbox), hang prevention, and the GitHub
  Actions `windows-latest` workflow.
- **`references/qt-and-fallback.md`** — Qt-specific quirks (combo popups,
  dialogs as top-level windows, table cells, self-drawn widgets) and the
  screenshot-matching fallback with its DPI rules.

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract)

Communication to the user in Bahasa Indonesia; test code, page-object names,
and assertions in English — fixed, never ask. Full contract:
`skill-authoring-edho-ferdian` §7.

## Global rules

1. **AutomationId first, always.** Name second, ClassName+index only when
   forced, coordinates never as a primary strategy.
2. **Never `time.sleep()` as synchronization.** `wait_visible` / `wait_gone` /
   `wait_until` exist for exactly this.
3. **Fresh process per test.** A session-scoped app fixture leaks state between
   tests and turns every failure into an archaeology exercise.
4. **Assert content and state, never pixel geometry.** `lblStatus == "Logged
   in"` is a test; `btn.rectangle().left == 120` is a trap.
5. **Redact typed text in traces.** Never enable trace text capture on a login
   or payment flow.
6. **Quarantine, don't delete** — the protocol in
   `e2e-testing-edho-ferdian/references/flake-quarantine.md` applies verbatim;
   the Python spelling is `@pytest.mark.skip(reason="...")` /
   `@pytest.mark.skipif(os.environ.get("CI") == "true", reason="...")`.
