# Worked Suite — a WPF invoice app tested with pywinauto

A small but complete suite: launch fixture, page objects over UI
Automation, one journey test, artifacts on failure, and a CI job. Builds
on `pywinauto-harness.md` (setup) and `isolation-and-ci.md` (isolation).

## The app and what we test

`InvoiceDesk.exe` (WPF): login → create invoice → add two lines → save →
invoice appears in the list with the right total.

Testability first: the developers added `AutomationProperties.AutomationId`
to the controls we touch (`LoginUser`, `LoginPassword`, `NewInvoiceButton`,
`LinesGrid`, `TotalText`, `SaveButton`). Without stable IDs, tests break
on every copy change.

## Layout

```text
tests_desktop/
├── conftest.py          ← app fixture, artifacts on failure
├── pages/
│   ├── login.py
│   └── invoice_editor.py
└── test_create_invoice.py
```

## Fixture — isolated launch, clean data, guaranteed shutdown

```python
# tests_desktop/conftest.py
import os, shutil, tempfile, time
import pytest
from pywinauto import Application

APP = os.environ.get("INVOICEDESK_EXE", r"C:\build\InvoiceDesk\InvoiceDesk.exe")

@pytest.fixture
def app(request):
    data_dir = tempfile.mkdtemp(prefix="invoicedesk-")          # fresh database per test
    env = {**os.environ, "INVOICEDESK_DATA_DIR": data_dir}
    application = Application(backend="uia").start(f'"{APP}" --test-mode', env=env, timeout=30)
    main = application.window(auto_id="MainWindow")
    main.wait("visible ready", timeout=30)
    yield main
    rep = getattr(request.node, "rep_call", None)
    if rep is not None and rep.failed:
        os.makedirs("artifacts", exist_ok=True)
        main.capture_as_image().save(f"artifacts/{request.node.name}.png")
        main.print_control_identifiers(filename=f"artifacts/{request.node.name}.tree.txt")  # UIA tree at failure time
    application.kill()
    shutil.rmtree(data_dir, ignore_errors=True)

@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    setattr(item, f"rep_{outcome.get_result().when}", outcome.get_result())
```

## Page objects

```python
# tests_desktop/pages/login.py
class LoginPage:
    def __init__(self, win):
        self.win = win

    def login(self, user: str, password: str):
        self.win.child_window(auto_id="LoginUser").wrapper_object().set_edit_text(user)
        self.win.child_window(auto_id="LoginPassword").wrapper_object().set_edit_text(password)
        self.win.child_window(auto_id="LoginButton").click_input()
        self.win.child_window(auto_id="NewInvoiceButton").wait("enabled", timeout=15)
```

```python
# tests_desktop/pages/invoice_editor.py
class InvoiceEditor:
    def __init__(self, win):
        self.win = win

    def open_new(self):
        self.win.child_window(auto_id="NewInvoiceButton").click_input()
        self.win.child_window(auto_id="LinesGrid").wait("visible", timeout=10)

    def add_line(self, description: str, qty: int, price: int):
        self.win.child_window(auto_id="AddLineButton").click_input()
        grid = self.win.child_window(auto_id="LinesGrid")
        row = grid.children(control_type="DataItem")[-1]
        cells = row.children(control_type="Edit")
        cells[0].set_edit_text(description)
        cells[1].set_edit_text(str(qty))
        cells[2].set_edit_text(str(price))
        cells[2].type_keys("{TAB}")                            # commit the cell edit

    def total(self) -> str:
        return self.win.child_window(auto_id="TotalText").window_text()

    def save(self):
        self.win.child_window(auto_id="SaveButton").click_input()
        self.win.child_window(title_re="Invoice saved.*", control_type="Text").wait("visible", timeout=10)
```

## The journey test

```python
# tests_desktop/test_create_invoice.py
from pages.login import LoginPage
from pages.invoice_editor import InvoiceEditor

def test_create_invoice_with_two_lines(app):
    LoginPage(app).login("tester", "test-password")        # test-mode account, not a real credential
    editor = InvoiceEditor(app)
    editor.open_new()
    editor.add_line("Konsultasi", 2, 750_000)
    editor.add_line("Hosting", 1, 300_000)
    assert editor.total() == "Rp1.800.000"
    editor.save()

    invoices = app.child_window(auto_id="InvoiceList")
    invoices.wait("visible", timeout=10)
    rows = [r.window_text() for r in invoices.children(control_type="ListItem")]
    assert any("Rp1.800.000" in r for r in rows)
```

## Stability rules applied here

| Rule | How |
|---|---|
| Wait for state, never sleep | `.wait("visible enabled ready", timeout=…)` |
| Locate by AutomationId | `auto_id=`; titles only for dynamic messages |
| One fresh data dir per test | `INVOICEDESK_DATA_DIR` in the fixture |
| Always kill the app | fixture teardown, even on failure |
| Evidence on failure | screenshot + UIA tree in `artifacts/` |

## Run locally and in CI

```bash
pip install pywinauto pytest
pytest tests_desktop -v --maxfail=1
```

```yaml
# .github/workflows/desktop-e2e.yml (excerpt)
jobs:
  desktop-e2e:
    runs-on: windows-latest            # needs an interactive desktop session; hosted Windows runners provide one
    steps:
      - uses: actions/checkout@v4
      - run: dotnet build src/InvoiceDesk -c Release -o C:\build\InvoiceDesk
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install pywinauto pytest
      - run: pytest tests_desktop -v
        env: { INVOICEDESK_EXE: 'C:\build\InvoiceDesk\InvoiceDesk.exe' }
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: desktop-e2e-artifacts, path: artifacts/ }
```

Self-hosted runners must run as an interactive user with the screen
unlocked; a service account with no desktop can't drive UI Automation.
