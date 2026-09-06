# Codemap generation

Adapted from ECC `doc-updater`, fetched 2026-09-04. Dependency-graph
generation (ECC's `madge`/AST step) intentionally removed — see SKILL.md
Step 4 for why and what replaces it.

## What a codemap is for

A codemap is a map, not a mirror. It should let a new contributor (human or
AI) find the right file in under a minute, not reproduce every file's
contents. If a codemap is getting long enough to duplicate the source, it's
drifted from its job.

## Layout

```
docs/CODEMAPS/
├── INDEX.md          # overview of all areas, links to each file below
├── frontend.md        # frontend structure (if applicable)
├── backend.md         # backend/API structure (if applicable)
├── database.md        # database schema
├── integrations.md    # external services
└── workers.md         # background jobs / async workers (if applicable)
```

Adapt the file list to what the repo actually has — don't create
`workers.md` for a repo with no background jobs. One file per real area,
not one file per possible area.

## Per-module analysis (before writing anything)

For each module/area a codemap will cover:
- Identify entry points (`apps/*`, `packages/*`, `services/*`, or the
  project's own convention).
- Extract what it exports (public API surface).
- Identify routes/endpoints if it's a backend area.
- Locate DB models/schemas if it touches persistence.
- Locate background workers/jobs if any.

Read the actual files for this — don't infer structure from directory names
alone; a `services/` folder can mean different things in different repos.

## Codemap file format

```markdown
# [Area] Codemap

**Last Updated:** YYYY-MM-DD
**Entry Points:** <list of main files>

## Architecture
<A short prose or ASCII-diagram description of how the pieces in this area
relate. Keep it to what a reader needs to orient, not a full component
inventory — the table below does that.>

## Key Modules
| Module | Purpose | Exports | Dependencies |
|--------|---------|---------|--------------|
| <path> | <one line> | <public API surface> | <see "Dependency section" below — Salak-sourced or "Deferred"> |

## Data Flow
<How data moves through this area — request in, response out; event in,
side effect out; whichever shape fits.>

## External Dependencies
- <package-name> — <purpose>, <version, if the repo pins one>

## Related Areas
<Links to other codemap files this area's code actually touches — sourced
the same way as the Key Modules dependency column>
```

## Quality bar before calling a codemap done

- [ ] Every path named in the codemap was verified to exist (Step 3 of
      SKILL.md, `doc-freshness-checklist.md`).
- [ ] Every dependency claim is either Salak-sourced-with-provenance or
      explicitly marked deferred — never a guess.
- [ ] Freshness timestamp is today's date (or the date this codemap was
      actually last regenerated, if this run only checked and found it
      still accurate — say which).
- [ ] Kept under roughly 500 lines. A codemap this long has usually stopped
      being a map — split it into two areas instead of letting one grow.
- [ ] Cross-references between codemap files are two-way where it makes
      sense (if `backend.md` links to `database.md`, consider whether
      `database.md` should link back).

## When to regenerate vs. leave alone

**Regenerate when:** a new major feature shipped, API routes changed,
dependencies were added/removed, the architecture changed, or the setup
process changed.

**Leave alone (or spot-check only) for:** a minor bug fix, a cosmetic
change, or an internal refactor that didn't change the module's public
surface, routes, or dependencies. Regenerating a codemap for every commit
is wasted work and creates noisy diffs nobody reads.
