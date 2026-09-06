# Driver Detection (Phase 0)

Reference for Phase 0 of `e2e-testing-edho-ferdian`.

ECC's `e2e-runner` hardcodes `agent-browser` (its own CLI) as the primary
driver and treats Playwright as a fallback. This ecosystem does not depend
on ECC's tooling (D-005/D-009), so this skill does the opposite: **detect
what's actually available, every run, and pick from that** — never assume
one tool is installed just because it was last time.

## Detection order

Run these checks in order. Stop at the first one that succeeds and state
which driver you're using in one line before Phase 1. Detection is silent
when it fails — only report what you found, not every tool you ruled out.

### 1. Claude's own browser tools

If tools named `mcp__Claude_Browser__*` (or an equivalent preview-pane
browser toolset exposed directly in this environment) are available, this
is the lowest-friction option — no project configuration, no install step,
works immediately against a locally previewed app or any external URL.

Check: are `mcp__Claude_Browser__navigate`, `mcp__Claude_Browser__computer`,
`mcp__Claude_Browser__read_page` (or their session-specific equivalents)
present in the current toolset? If yes, use these directly for journey
execution — `navigate` to load a page, `read_page`/`find` for locators
instead of raw CSS where possible, `computer` for interaction,
`read_console_messages` / `read_network_requests` for failure diagnosis.

### 2. Chrome DevTools MCP

If a Chrome DevTools MCP server is configured for this project (check
`.mcp.json` / the project's MCP configuration, or whether
`browser-testing-with-devtools`-style tools are present), prefer it when the
task needs deep runtime inspection alongside automation — DOM snapshots,
console errors, network waterfall, performance traces. Equivalent
capability to option 1 for pure navigation/interaction; the deciding factor
is whether the task needs that inspection depth.

### 3. Project's own Playwright

Check the project manifest for an existing E2E setup before introducing
anything new:

```bash
# Node/JS projects
grep -l "@playwright/test" package.json 2>/dev/null
test -f playwright.config.ts -o -f playwright.config.js

# Confirm it's actually runnable
npx playwright --version
```

If found, **use the project's existing config and test runner** — its
`baseURL`, `projects` (browsers), and `use` block already encode real
decisions someone made (which browsers, which viewport, auth setup). Adding
a second E2E framework alongside an existing one is an anti-pattern this
skill should never introduce.

If Playwright is the chosen driver but no config exists yet, scaffolding one
is itself a first task — don't silently invent ad-hoc config inline in a
test file.

### 4. `desktop-e2e-edho-ferdian` — native Windows automation

Use this path only when the target is a **native desktop application**, not
a browser surface — there is no DOM to drive. This ecosystem's
`desktop-e2e-edho-ferdian` skill covers this driver (pywinauto over Windows
UI Automation, for WPF/WinForms/Win32/Qt targets) — read that skill for the
mechanics rather than treating this as a placeholder. Native automation
trades DOM-aware locators for OS accessibility-tree / coordinate-based
interaction — expect journeys to be authored differently (see
`references/journey-design.md`'s note on this).

## When nothing is available

If none of the four apply — no browser tools in this session, no DevTools
MCP configured, no Playwright in the project, and the target isn't a native
desktop app reachable via option 4 — **stop and say so plainly**. Do not:

- Fabricate a test run or a pass/fail result.
- Silently fall back to reading the code and asserting it "should work."
- Install a new E2E framework without asking — that's a project-level
  decision (test framework choice), the same class of decision dev-kickoff's
  PDR §3 governs. If no framework is chosen yet, that's a binding decision
  to raise with the user, not something to pick unilaterally.

Report `VERIFIED: NO — no E2E driver detected` and offer the concrete next
step (e.g. "install `@playwright/test` and scaffold a config, or confirm
Claude's browser tools should be used against the local dev server").

## Re-detection

Detect fresh at the start of every session/task that needs E2E work. A tool
available in a previous session (a different sandbox, a different project
checkout) is not guaranteed to be available now. This check is cheap — never
skip it to save time.
