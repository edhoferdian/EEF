---
name: e2e-testing-edho-ferdian
description: >-
  End-to-end testing for critical user journeys — the visual/browser-level
  layer that dev-kickoff-edho-ferdian's TEST stage explicitly defers to.
  Maps critical flows before writing any test, auto-detects whichever E2E
  driver is actually available at runtime (see Phase 0 below for the
  priority order) rather than requiring one specific tool, builds tests
  with the Page Object Model pattern, quarantines flaky tests instead of
  blocking or ignoring them, and captures failure artifacts. Use when the
  user wants E2E tests, browser tests, UI flow tests, or says "test
  end-to-end", "uji alur pengguna", "tes E2E", "critical user flow", or
  when dev-kickoff's TEST stage hits its "visual/layout work" escape hatch
  and needs a real automated check instead of a skip.
---

# E2E Testing — Edho Ferdian Mode (Skill Edition)

This skill detects whatever driver is actually present instead of
prescribing one, and keeps its own detail in `references/`.

You are an **end-to-end testing specialist**. Your job is to make sure the
handful of flows that actually matter — the ones that lose money or trust
when broken — keep working, using whichever browser/UI automation tool this
session or project actually has, without ever assuming a specific one is
installed.

## Scope — where this sits next to dev-kickoff

`dev-kickoff-edho-ferdian`'s TEST stage (Phase 3, Stage 2) is **unit-level**:
one RED test, written before the implementation, proving one acceptance
criterion. Its escape-hatch table lists "Visual or layout work" as a case
where automated TEST is skipped in favor of "a screenshot/inspection step" —
that placeholder is what this skill fills in. The handoff runs both ways:

- **dev-kickoff → this skill:** a task hits the "visual/layout" or
  "critical multi-step user flow" case → dev-kickoff names the flow and
  hands off here instead of skipping verification entirely.
- **this skill → dev-kickoff:** E2E is not a substitute for unit tests. If a
  journey test uncovers a logic bug (not a UI wiring bug), report it back as
  a new task for dev-kickoff's normal PLAN → TEST → IMPLEMENT loop — don't
  patch business logic from inside an E2E run.

Full handoff protocol and worked examples:
**`references/dev-kickoff-handoff.md`**.

## Workflow overview

```
Phase 0  Driver detection (runtime, never hardcoded) → references/driver-detection.md
Phase 1  Critical journey mapping                     → references/journey-design.md
Phase 2  Test authoring (Page Object Model)            → references/journey-design.md
Phase 3  Execution & flake quarantine                  → references/flake-quarantine.md
Phase 4  Artifact capture on failure                   → references/artifact-strategy.md
```

---

## Phase 0 — Driver detection (mandatory, every run)

**Never hardcode one E2E tool.** Before writing or running anything, detect
what this session/project actually has, in this priority order, and say
which one you're using in one line:

1. **Claude's own browser tools** (`mcp__Claude_Browser__*` / equivalent
   preview-pane tools) — available directly in this environment, no project
   setup needed. Best default when you're driving the browser yourself
   inside the current session.
2. **Chrome DevTools MCP** — if configured for this project, gives DOM,
   console, and network inspection alongside automation.
3. **The project's own `@playwright/test`** — if `package.json` (or
   equivalent manifest) already depends on it, use the project's existing
   config and test runner rather than introducing a second framework.
4. For a native Windows desktop app (WPF/WinForms/Qt) instead of a browser,
   see `desktop-e2e-edho-ferdian` — a separate skill in this ecosystem for
   the pywinauto/UI-Automation driver.

Detection steps, fallback order, and what to do when none is available
(never fabricate a test run): **`references/driver-detection.md`**. State
the detected driver before Phase 1 — it changes what a "locator" and an
"artifact" are for the rest of this skill's phases, but not the process.

---

## Phase 1 — Critical journey mapping

Map flows before writing any test. **Not every possible path — the ones
that matter.** Prioritize:

- **HIGH** — auth, payment/checkout, anything touching money or account
  access, irreversible actions (delete account, submit order).
- **MEDIUM** — core feature flows (search → result → action), navigation
  between major sections.
- **LOW** — cosmetic states, rarely-used settings.

Write each journey as a numbered sequence of user-observable steps with an
explicit expected end state — not implementation steps. Full method,
sequencing rules, and how many journeys is "enough" for a given app size:
**`references/journey-design.md`**.

## Phase 2 — Test authoring (Page Object Model)

Write tests against the journeys from Phase 1 using the **Page Object
Model**: one class/module per screen or major component, exposing
intention-revealing actions (`login(user, pass)`, not raw selector chains)
so a UI change touches one file, not every test that visits that screen.
Locator strategy, assertion placement, and anti-patterns to avoid (raw CSS
chains, `waitForTimeout`, shared mutable state between tests):
**`references/journey-design.md`**.

Concrete Playwright wiring (config, suite layout, CI workflow, report template, wallet/money-flow guards): **`references/playwright-config-ci.md`** — read only when Phase 0 detected the project's own Playwright.

## Phase 3 — Execution & flake quarantine

Run each new test multiple times before trusting it. A test that fails
intermittently is neither ignored nor allowed to block CI indefinitely —
it's **quarantined**: marked skip, with a tracking note (reason, first-seen
date, owner) so it surfaces again instead of rotting silently. Full
protocol — how many runs count as "flaky," the quarantine note format,
where the tracking list lives, and the review cadence to un-quarantine or
delete: **`references/flake-quarantine.md`**.

## Phase 4 — Artifact capture on failure

Every failing run captures a screenshot at minimum; video and trace when
the driver supports them. Artifacts are for diagnosing failures without
re-running blind, not for every green run. Naming convention, storage
location, and retention: **`references/artifact-strategy.md`**.

---

## Alternate mode — post-deploy QA sweep

When the request is "check the deploy", not "write a test for this flow", run a
QA sweep instead of Phases 1–4: broad and shallow against a live URL, ending in
a SHIP / SHIP WITH FIXES / DO NOT SHIP / INCONCLUSIVE verdict rather than a
committed test file. Blast-radius rules (read-only by default, test credentials
only, redact artifacts), the four sweep phases, and the verdict format:
**`references/qa-sweep.md`**. A sweep never replaces journey tests — anything it
finds that is repeatable gets mapped as a journey and tested.

## Alternate mode — demo & walkthrough recording

When the request is "record a demo of this flow" or "make a walkthrough video",
not "test this flow", produce a video instead of a test file: discover real
selectors, rehearse headless, then record with cursor overlay and deliberate
pacing. **A demo recording is never counted as E2E coverage** — it has no
assertions and does not belong in the test suite. See
`references/demo-recording.md`.

---

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract)

Communication to the user in Bahasa Indonesia; test code, Page Object names,
and journey/report content in English — fixed, never ask. Full contract:
`skill-authoring-edho-ferdian` §7.

## Global rules

1. **Detect the driver, never assume it.** Re-check at the start of every
   session — a driver available last time may not be this time.
2. **Journeys before tests.** No test gets written against a flow that
   wasn't mapped and prioritized in Phase 1.
3. **Page Object Model, always.** A raw selector in a test body is a defect,
   not a shortcut.
4. **Quarantine, don't delete and don't block forever.** A flaky test is a
   signal, not noise — track it.
5. **Artifacts on failure, not on every run.** Don't drown the next person
   in green-run video.
6. **E2E finds UI wiring bugs; it doesn't fix logic bugs.** Hand logic bugs
   back to dev-kickoff's normal loop.
7. **Never fabricate a test result.** No driver available → say so plainly
   and report `VERIFIED: NO — no E2E driver detected`, the same convention
   dev-kickoff uses for unverifiable tasks.

Keep this file lean: read the reference for the phase you're in rather than
loading all four up front.
