# Salak integration (optional, auto-detected)

Salak (`pip install salak` / `uv tool install salak`) is a separate tool — a
deterministic code knowledge graph generator that emits
`project-memory/repo-graph.json`. Every EEF skill that uses it (this one,
dead-code-cleanup, docs-sync, spec-mining, build-fix, system-design,
safe-execution, code-review) treats it exactly like the agent-harness case in
`references/agent-harness.md`: **detect, defer, never require.** If it isn't
installed, every phase runs exactly as if this file didn't exist. This file is
the canonical copy of the commands and exit codes; the other skills point
here instead of restating them.

## Step 1 — Detect (silent, every Mode A/C run)

Run `salak version` (or `command -v salak`). Non-zero / not found → Salak is
absent. Say nothing about it, proceed with every phase unchanged. This is not
a BLOCKER and not a gap to report. `eef-install doctor` also reports whether
Salak is on PATH and flags a build older than 0.3.

## Step 2 — Read the contract from the installed binary, not from docs

A normal `pip install`/`uv tool install` does **not** bundle Salak's `docs/`
folder — only `salak/*.py` and `salak/schema/*.json` ship on PyPI. Do not
rely on finding `AI-CONSUMER-PLAYBOOK.md` or `cli-reference.md` inside the
installed package.

Instead, the sync mechanism is: **run `salak --help` and `salak <cmd> --help`
against whatever is actually installed, every time, and treat that output as
authoritative** — flags and exit codes are printed inline and ship with the
binary itself, so this stays correct across Salak versions without ever
touching this skill. Only if the current project happens to vendor Salak's
source (its `docs/` folder present in-repo, e.g. `docs/AI-CONSUMER-PLAYBOOK.md`)
is a markdown doc worth reading directly — treat that as a bonus and prefer it
when present, since it documents `emits`/provenance nuance `--help` won't.

## Step 3 — Verified exit-code contract — reconfirm via `--help` if in doubt

**Re-verify this table against the installed binary's `--help` output before
trusting it** — exit codes are a contract Salak has renumbered before (see
"why this table exists" below) and a locally installed version may predate or
postdate this note.

- `salak scan [PATH]` → writes `PATH/project-memory/repo-graph.json` (default;
  `--out` overrides). `salak scan . --update` is the incremental form: same
  result as a full scan, less work, and it falls back to a full scan by itself
  when the old graph can't be reused — use it for every refresh after the
  first scan.
  - **Exit 0** = clean.
  - **Exit 2** = completed, but a file failed to parse — the graph is still
    written and still usable; treat as success with a noted diagnostic, not a
    failure.
  - **Exit 3** = refused by the overwrite guard (§5): the new scan would drop
    the in-scope node count by more than 20% versus the previous graph. This
    is a deliberate regression guard — **never pass `--force` automatically**.
    Stop and tell the user rather than routing around it.
  - **Exit 1** = fatal — the command did not complete at all (crash, bad args,
    filesystem error).
- `salak check [PATH]` — **do not assume the numbering below is stable long
  term; it is the current one, confirmed against source.** It takes seconds
  on a few-hundred-file repo, so run it when a graph answer is about to be
  used, not from a session-start hook.
  - **Exit 0** = fresh. Trust the graph, say nothing.
  - **Exit 1** = internal error — no graph at the default path, or it's
    unreadable/schema-invalid, or the walk hit a filesystem error. The
    comparison never ran; this is not a staleness signal.
  - **Exit 2** = stale — the routine, expected non-zero result: the graph no
    longer matches the working tree. Not a crash. Print/summarize which
    files/rules changed; refresh with `salak scan . --update`, or answer with
    the caveat "graph may be out of date for X."
  - **Why this table exists as a table, not a one-liner:** Salak's own exit
    codes for `check` were renumbered once already (an early build shipped
    them inverted — `1` for stale, `2` for internal error — before being
    fixed to match `scan`'s "1 = fatal, 2 = completed with a finding"
    convention). Treating every non-zero `check` exit the same way
    mis-triages either way the numbering runs. If a locally installed
    `salak`'s `check --help` or behavior doesn't match the table above,
    believe the binary, not this file, and note the discrepancy in
    `02-gap-analysis.md`.
- `salak query QUESTION TARGET` — see Step 3a. **Exit 0** answered (possibly
  empty), **1** fatal (no graph, unknown file or node), **2** that edge kind
  is not tracked for the target's language.
- `salak init [PATH] [--file AGENTS.md] [--dry-run]` → writes or refreshes the
  "Consulting the Salak graph" block in `PATH/CLAUDE.md` (or the named file),
  generated from the graph's own coverage. Re-running replaces only that
  block. **Exit 0** = written or unchanged, **1** = fatal (including malformed
  block markers — fix the markers, don't delete the file).
- `salak validate <path-to-repo-graph.json>` → confirms the file matches its
  own declared schema version before you trust it. Exit 0 = valid, non-zero =
  invalid/fatal — confirm exact codes via `--help` if this matters to the task.
- Any other failure (missing binary, crash, timeout, permission error): log
  one line, continue without the graph. Never let a Salak failure stop a
  kickoff or a task.

Two more subcommands exist with their **own, different** exit-code shapes —
don't apply the scan/check/validate table to either:

- `salak diff <old.json> <new.json>` — **Exit 0** = identical graphs. **Exit
  1** = real, reported differences (not an error — the comparison succeeded).
  **Exit 2** = load error, one or both files unreadable/invalid — the
  comparison never ran. Useful in REVIEW: diff the graph from before a task
  against a fresh scan after it, to see the actual structural change instead
  of trusting a self-report.
- `salak doctor` — **Exit 0** = every language adapter healthy. **Exit 1** =
  at least one adapter unhealthy (this only reflects Salak's own ability to
  parse the repo, not whether an optional language server is present/current
  — that's reported informationally and never changes the exit code). Worth
  running once at Step 1 detection if `scan`/`check` behave unexpectedly.

## Step 3a — Ask with `salak query`, never by reading the graph

`repo-graph.json` runs to megabytes on a real repo; reading it whole (or
walking `nodes[]`/`edges[]` by hand) burns context and still invites a missed
edge. `salak query` answers one question deterministically, read-only:

| Question | Answers | Typical use |
|---|---|---|
| `salak query importers FILE` | who imports this file | blast radius before editing it; "is this unused?" |
| `salak query imports FILE` | what this file imports | its own dependencies; a cycle path |
| `salak query symbols FILE` | what this file defines | the public surface a change touches |
| `salak query callers NODE` | who calls this symbol | call sites of a function — **Go only** (see below) |

`TARGET` is a repo-relative path (`src/a.ts`) or a node id (`ts:src/a.ts#Foo`,
`go:example.com/pkg`). Flags: `--sites` (one `file:line` per source site
instead of one line per item), `--json` (the matching edges, for scripting),
`--root ROOT` (repo root; the graph is read from `ROOT/project-memory/`),
`--graph FILE` (another graph file). Each output line carries its provenance.

**Exit codes decide what an empty answer means:**

- **0** — answered. An empty answer here really is "none", for that edge
  kind, as of the last scan.
- **2** — the graph does not track that edge kind for the target's language.
  An empty result proves **nothing**; fall back to Grep and say so.
- **1** — fatal: no graph, or the file/node is not in it (new file, typo,
  excluded path). Don't treat it as "nothing depends on it".

**Edge kinds per language** (`adapters[].emits` in the graph header; as of
salak 0.3.1): Go emits `calls`, `defines`, `depends_on`, `extends`,
`imports`; Python emits `defines`, `depends_on`, `extends`, `imports`,
`instantiates`, `references`; TypeScript emits `defines`, `depends_on`,
`extends`, `implements`, `imports`, `instantiates`, `references`. So
`callers` works for Go and exits 2 for Python and TypeScript — for those,
`importers` plus a scoped Grep for the symbol name is the honest answer.
Re-check `emits` after a Salak upgrade instead of trusting this list.

## Step 4 — When to run it

- **Mode A / Mode C**, after Phase 0 classification: if
  `project-memory/repo-graph.json` doesn't exist yet, run `salak scan .` once.
  This is a local, non-destructive action (writes one JSON file) — run it the
  same way VERIFY already runs lint/tests, without asking permission, unless
  the 20%-drop guard fires (exit 3 — see above), in which case stop and ask.
  Outside a kickoff (any other skill, or the always-on rule), offer
  `salak scan .` once instead of running it unasked.
- **Before Phase 3 REVIEW/VERIFY** on any task touching pre-existing code
  (not a from-scratch file): run `salak check .` first. Exit 2 (stale) →
  refresh with `salak scan . --update` before relying on graph-derived claims
  such as "nothing else imports this module." Exit 1 (internal error) → don't
  refresh, don't trust the graph this round, fall back to reading source
  directly, move on.
  - **Gotcha, confirmed against a real repo:** if the tree has *any*
    permanently-unparseable file (a deliberately broken fixture, a file with
    a real syntax error nobody's fixed), `check` reports it `stale` forever —
    even one second after a fresh `scan` with 0 other changes — because a
    `PARSE_FAILED` file's record is defined as always-incomplete (D41/D42)
    and is re-flagged on every run, not just when it changes. **Don't treat
    a repeat `salak scan` as the fix here** — it will re-scan, still fail to
    parse the same file, and `check` will report the same staleness again,
    forever. Read *which* paths are named in the stale output before acting:
    if they're the only files listed and they're known-broken (test
    fixtures, WIP code), the graph is still trustworthy for everything else —
    proceed and say so, don't loop on re-scanning.
- **Mode B** (handoff pack only): still generate/refresh the graph if Salak
  is present — it's worth handing off — but don't let it delay or block
  Mode B's early exit after Phase 2.

## Step 4a — The graph and git

`project-memory/repo-graph.json` is generated, large, and rewritten by every
scan, so two branches or worktrees that each scan will conflict on it for no
reason. **Gitignore it even when the rest of `project-memory/` is committed**
(`project-memory/repo-graph.json` in `.gitignore`; each clone runs its own
`salak scan .`). Commit it only when CI runs `salak check` against it — and
then CI (or one release step) is the only writer: nobody commits a locally
scanned graph by hand, and a merge conflict on it is resolved by re-scanning,
never by editing the JSON.

## Step 5 — What it's used for once present

- **Phase 0 cross-document validation (Axis 6 — doc vs. existing repo)**:
  check `ARCHITECTURE`-role documents' claimed dependencies with
  `salak query imports` / `importers` on the modules they name. A mismatch is
  a consistency-axis finding to report, not something to resolve silently.
- **Phase 2 Context Pack**: if a graph is present, run `salak init .` (or
  `salak init . --file AGENTS.md`, once per instructions file the pack
  generates) instead of hand-writing a "Consulting the Salak graph" section —
  the block Salak writes is generated from the graph's actual coverage and
  refreshes in place on the next run. Preview with `--dry-run` when the file
  is the user's own. Hand-write the §F habit only if `salak init` is missing
  (a build older than 0.3) or exits 1.
- **Phase 3 IMPLEMENT / REVIEW**: prefer `salak query importers FILE` ("what
  else imports this file") and, for Go, `salak query callers NODE` over
  inference from reading a handful of files by hand.
- **Respect Salak's own provenance tagging** (`extracted` > `inferred` >
  `ambiguous`). Never treat an `ambiguous` edge as settled fact — it's a lead
  to double-check, not a citation. And never read an empty answer for an
  untracked edge kind as "this has no callers" — that is what `query`'s exit
  2 and `adapters[].emits` are for (Step 3a).

## Verification record (2026-10-27, salak 0.3.1, scratch repo)

Re-checked against the installed 0.3.1 binary's `--help` and a scratch repo
with Python and TypeScript files: `query importers|imports|symbols|callers`
with `--sites` and `--json`; exit 0 on an answered and on an empty question,
1 on an unknown file, 2 for `callers` on Python and TypeScript targets;
`adapters[].emits` as listed in Step 3a, read from the graph header (Go now
emits `calls` — the 0.1 note below that no build tracked `calls` is out of
date); `check` 1 with no graph, 0 fresh, 2 after an edit; `scan . --update`
producing a graph `salak diff` finds identical to a full scan; `init
--dry-run` printing the generated block. A Go `callers` answer and `check`
timing (about 7 s on a 250-file repo) come from an earlier run the same day.

## Dry-run record (2026-09-02, salak 0.1.0.dev0, against salak's own repo)

Every command and exit code in Step 3 was run for real, not inferred:
`version` (0), `doctor` (0, both adapters ok), `check` pre-scan (1, "no graph
found" — matches), `scan` (2, 218 parsed/2 intentionally-broken fixtures — the
Gotcha above was found this way), `check` post-scan (2, stale — same Gotcha),
`validate` on the fresh graph (0). `diff` was verified against an isolated
scratch repo (not salak's own tree, to avoid touching real source): identical
graphs → 0, a real added file/imports → 1 with a correct nodes/edges-added
report, a missing file argument → 2. At the time `adapters[].emits` excluded
`calls` for every language and `implements` for Python only.

**Not yet dry-run:** this reference has still not been exercised from inside
a live Phase 0→Phase 3 kickoff session on a project that doesn't already have
`salak` installed — only the CLI contract and the usage patterns above.
Whether an agent mid-task actually stops and asks on a `--force`-guard
refusal (exit 3) rather than routing around it, and whether the REVIEW-stage
`diff` habit reads naturally as part of PLAN→TEST→IMPLEMENT→REVIEW→VERIFY
rather than as a bolted-on extra step, remains unverified in that context.
