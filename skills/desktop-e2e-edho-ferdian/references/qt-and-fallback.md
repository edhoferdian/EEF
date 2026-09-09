# Qt Quirks & Screenshot Fallback

## Qt 5.x accessibility

Qt 5.7–5.14 ship with accessibility off in many builds. Set
`os.environ["QT_ACCESSIBILITY"] = "1"` at the top of `conftest.py` (or in the
CI `env:` block) **before** launching. Qt 6.x enables it by default.

## Quirks that break naive locators

- **QComboBox** — the dropdown is a separate top-level window, not a child of
  the combo. Click the combo, then find the popup at desktop level:
  `Desktop(backend="uia").window(class_name_re="Qt[56]QWindowIcon")`, wait for
  it, then click the item by title. Verify the class name against
  Accessibility Insights; it changes between Qt 5 and Qt 6.
- **QMessageBox / QDialog** — also top-level. Use `wait_window(title)` and
  click the button inside the returned dialog, never `child_window` from the
  main window.
- **QTableWidget / QTableView** — reach cells through the wrapper:
  `table.cell(row=0, column=1).window_text()`.
- **Self-drawn controls** (`paintEvent`-only widgets, `QGraphicsView`,
  `QOpenGLWidget`) — UIA cannot see inside them at all. This is the one case
  that justifies the fallback below.

## Screenshot-matching fallback (last resort)

Only for genuinely unreachable controls — self-drawn widgets, third-party
components, embedded game engines. Requires `pyautogui`, `Pillow`,
`opencv-python`. Capture the screen, `cv2.matchTemplate` with
`TM_CCOEFF_NORMED`, accept above a confidence threshold (0.85 is a workable
default), click the match center.

**Three hard DPI rules — matching is brutally scale-sensitive:**

1. Capture templates at the same display scale as the target machine. Do not
   try to rescue a mismatch with `Image.resize` — resampling artefacts wreck
   `matchTemplate` scores.
2. Pin display scaling in CI (fix the resolution, disable per-monitor DPI
   scaling) so screenshot dimensions are reproducible run to run.
3. Record the scale with each artefact — write `GetDpiForWindow(hwnd) / 96`
   into `artifacts/<test>/metadata.json`. Postmortems become obvious instead
   of guesswork.

Do **not** flip process-wide DPI awareness (`SetProcessDpiAwarenessContext`) in
a fixture when the app under test is Qt — it conflicts with Qt's own DPI
handling. Prefer same-scale templates plus a pinned CI display.

When calibrating a threshold, draw the best match back onto the screenshot
(rectangle + score, green above threshold / red below) into
`artifacts/match_debug.png`. That helper is diagnosis-only — never call it from
test code.

## Anti-patterns

| Bad | Good |
|---|---|
| `time.sleep(3)` then click | `wait_visible(spec)` then click |
| `by_class("Edit", index=2)` as the primary locator | `by_id("usernameInput")` |
| `assert btn.rectangle().left == 120` | `assert get_text(by_id("lblStatus")) == "Logged in"` |
| `@pytest.fixture(scope="session") def app()` | `scope="function"` — fresh process per test |
