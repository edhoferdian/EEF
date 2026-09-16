# Bridge Guide — Impeccable (external design-craft tool)

**This file is a router, not a rewrite.** Impeccable (`pbakaus/impeccable`,
`impeccable.style`) is a full third-party agent skill with its own
commands, its own persisted project state (`PRODUCT.md`, `DESIGN.md`), and
its own compiled binary that its launcher downloads and runs per project
(`npx impeccable` / `.agent/skills/impeccable/scripts/impeccable`). This
ecosystem does **not** vendor or rewrite Impeccable's ~25 command
references into its own prose — that would drift the moment upstream ships
a new version (it moves fast: multiple releases in the time this note was
written), which is exactly the failure mode this ecosystem already avoids
for the installed upstream harness this ecosystem is decommissioning
(D-005), Salak (D-004), and Context7 (D-044) by treating them as
live dependencies to consume, not sources to fork. Same treatment here.

## What this means in practice

1. **Never download or execute Impeccable's binary yourself.** Its
   launcher (`impeccable context`, or any `impeccable <verb>` command)
   fetches and runs a self-contained third-party executable. That is the
   user's call to make for their own project, the same way installing any
   other npm dependency or CLI tool is — surface it as an option, don't
   run it unprompted.
2. **Detect before routing.** Before starting UI design/critique/polish
   work on a project, check whether Impeccable is actually set up there:
   look for `.agent/skills/impeccable/` in the project tree, or a
   `PRODUCT.md`/`DESIGN.md` pair at the project root (Impeccable's own
   persisted context files). Their presence means the project has opted
   in; their absence means it hasn't — don't assume either way from this
   ecosystem's own conventions.
3. **If Impeccable is present and set up:** prefer it for the tasks it
   specializes in — full craft/redesign passes, heuristic UX critique,
   technical a11y/perf/responsive audits, and live in-browser iteration on
   variants. It has capabilities this ecosystem's own skills don't
   replicate (persisted product/design context across sessions, live
   browser variant picking, an auto-QA hook). Read its own `SKILL.md`
   routing table in the project (`.agent/skills/impeccable/SKILL.md`) and
   follow it directly rather than re-deriving equivalent steps here.
4. **If Impeccable is absent, or the user declines installing it:** fall
   back to this ecosystem's own coverage — `references/design-direction.md`
   and `references/ui-polish.md` in this skill for authoring-time craft,
   the installed `ui-ux-pro-max` skill for broader UI/UX planning, and
   `code-review-edho-ferdian`'s `references/accessibility-lens.md` for
   compliance-grade a11y review. Mention that Impeccable exists as a
   heavier option if the task looks like it would benefit (a full
   redesign, a persisted design system across many sessions) — don't push
   installing it for a small, one-off tweak.
5. **Don't blend outputs.** If Impeccable is driving (its `PRODUCT.md`/
   `DESIGN.md` exist and its commands are being used), let it own the
   design decisions end to end for that surface; don't simultaneously
   apply this ecosystem's `design-direction.md` self-audit on top — that
   produces two competing sources of truth for the same visual world. Pick
   one driver per surface.

## Boundary with `ui-ux-pro-max` (installed, not part of this repo)

`ui-ux-pro-max` is a separately-installed marketplace skill (not owned by
this ecosystem's `skills/` tree) that already covers UI/UX planning across
many stacks. Impeccable's scope overlaps it heavily (both do UX critique,
design-system extraction, styling guidance). When both are available for a
task, Impeccable takes priority for anything involving its persisted
`PRODUCT.md`/`DESIGN.md` state or live browser iteration (capabilities
`ui-ux-pro-max` doesn't have); `ui-ux-pro-max` remains useful for quick
stack-specific pattern lookups (chart types, color palettes, font pairings)
that don't need a full Impeccable command cycle.

## Component-library pairing

See `references/heroui.md` in this same skill for how HeroUI slots in as
the default component-library recommendation underneath an Impeccable-led
design — Impeccable decides the visual world and tokens, HeroUI supplies
accessible component primitives to express them in.

## Provenance

Native bridge skill added 2026-09-16 per D-047, at the user's request to
adopt `pbakaus/impeccable` for website design work. Deliberately does not
port Impeccable's own command references (fetched and inspected live from
`github.com/pbakaus/impeccable` at `.agent/skills/impeccable/` on that
date, version 4.3.1, Apache 2.0) — see the drift rationale above. Re-check
Impeccable's own `SKILL.md` for its current command set and setup steps
each time it's actually used; this file's job is only the routing decision
around it, not a copy of its content.
