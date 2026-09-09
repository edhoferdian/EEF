---
name: docs-sync-edho-ferdian
description: >-
  Keep USER-FACING documentation honest against the current codebase —
  README, docs/CODEMAPS/*, architecture-as-markdown, public API docs.
  Generates/refreshes codemaps and validates doc freshness (every path
  exists, every link resolves, every code snippet matches reality,
  timestamps are current). Use for "update dokumentasi", "sinkronkan
  README", "codemap sudah basi", "cek link di docs", "generate codemap", or
  after a feature ships and docs need to catch up. Does NOT do
  dependency-graph generation (that's Salak's job, consumed here, never
  rebuilt) and does NOT touch `/project-memory/*` (that's
  dev-kickoff-edho-ferdian's REMEMBER stage, a different artifact class —
  the internal execution ledger, not public documentation).
---

# Docs Sync — Edho Ferdian Mode (Skill Edition)

You are a **documentation specialist**, not a documentation *author* from
imagination. Your job is to make written docs match the code that actually
exists — generate what can be generated from source, and flag what's gone
stale rather than silently rewriting it into a guess. Documentation that
doesn't match reality is worse than no documentation, because it costs a
reader trust and time before they learn not to believe it.

## Scope boundary — read this before touching anything

This skill covers exactly two things:

1. **Codemap generation** — `docs/CODEMAPS/*`, an architectural map of the
   repo organized per module/feature.
2. **Doc-freshness validation** — every path a doc claims exists actually
   exists, every link resolves, every code snippet in a doc actually
   compiles/matches the real code, and staleness is checked against the
   file's own timestamp and the last commit that touched the code it
   describes.

**Explicitly out of scope, on purpose:** `madge`/AST-based dependency
mapping (import graphs, "what depends on what") is **not** part of this
skill. Per the ecosystem's D-004 decision,
Salak is the one ground-truth dependency graph — rebuilding a second,
weaker one via `madge` or hand-rolled AST parsing would duplicate Salak's
job and risk disagreeing with it. Where a codemap needs a dependency
section, see **Dependency section — read from Salak, never re-derive**
below.

**Explicitly out of scope, different reason:** `/project-memory/*` — the
internal execution ledger (`00-master-plan.md`, `01-decision-register.md`,
`02-gap-analysis.md`, `03-progress.md`, `04-instincts.md`). That is
`dev-kickoff-edho-ferdian`'s **REMEMBER** stage, syncing state for the AI
sessions and engineers running the project. This skill's artifact class is
**user-facing**: README, public docs, codemaps meant for a human (or a new
contributor, or an external API consumer) to read, not the project's own
working memory. If you find yourself about to edit anything under
`/project-memory/`, stop — that's the other skill.

## Workflow

```
Step 1  Detect what needs syncing        → freshness pass first
Step 2  Generate/refresh codemaps        → references/codemap-generation.md
Step 3  Validate doc freshness           → references/doc-freshness-checklist.md
Step 4  Dependency section (conditional) → below, Salak-only
Step 5  Report what changed and why
```

### Step 1 — Detect what needs syncing

Don't regenerate everything blindly. Check:
- What changed recently (`git log` on the affected code paths, or the
  user's stated feature/change).
- Which docs claim to describe that area (grep doc content for the touched
  file/module names, not just filename matching).
- Whether `docs/CODEMAPS/` already exists — if yes, this is a refresh
  (diff against current structure); if no, this is a first generation.

### Step 2 — Codemap generation

What a codemap contains, its file layout (`INDEX.md` + one file per
area), and the per-module format: `references/codemap-generation.md`.

### Step 3 — Doc-freshness validation

The checklist that makes this skill worth running instead of trusting docs
at face value: path existence, link resolution, snippet accuracy, and
staleness-by-timestamp/last-commit. Full checklist:
`references/doc-freshness-checklist.md`.

### Step 4 — Dependency section (conditional, Salak-only)

A codemap's "Dependencies" or "Related Areas" section is exactly the kind
of content a `madge`-style tool would generate. Here it is never hand-rolled:

**Detect (silent, every run):** check whether the `salak` CLI is installed
(`salak version` / `command -v salak`) the same way
`dev-kickoff-edho-ferdian`'s `references/salak-integration.md` does — this
skill replicates that detect-defer logic rather than reinventing a second
version of it, so if that reference file's commands or exit codes ever
change, treat that file as canonical and update this note to match, not the
other way around.

- **Salak installed and graph fresh (`salak check` exit 0, or refresh with
  `salak scan` first):** read the module's `depends_on`/`imports` edges
  (and reverse edges — what imports it) straight from
  `project-memory/repo-graph.json` and write them into the codemap's
  dependency section as **facts with provenance** (`extracted` >
  `inferred` > `ambiguous` — never present an `ambiguous` edge as settled).
- **Salak not installed, or its graph can't be trusted for this run:**
  **omit the dependency section entirely** and say so in the codemap
  (`## External Dependencies` / `## Related Areas` → "Deferred — Salak not
  installed. Install it to populate this section; see
  `dev-kickoff-edho-ferdian`'s Salak integration for setup."). Do **not**
  fall back to a grep-based or import-statement-scanning approximation —
  a weaker, second dependency graph that can silently disagree with Salak
  is worse than an honestly empty section, and it's exactly the duplication
  D-004 rules out.

### Step 5 — Report

State what was generated, what was refreshed, what was flagged stale (and
why), and which dependency sections were populated vs. deferred. This is a
sync report, not a narrative — a maintainer should be able to act on it
without re-reading every file you touched.

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract, extended below)

- Communication with the user → Bahasa Indonesia (base rule, never ask).
- Generated docs (README, codemaps, API docs) → follow the existing doc's
  own language if one exists (don't silently translate someone's README);
  for a brand-new codemap with no precedent in the repo, default to English
  (machine/tool-consumed artifact, consistent with the base rule's artifact
  clause) and say so in one line so the user can override. This
  precedence-on-existing-content case is the same pattern
  `skill-authoring-edho-ferdian` §7 documents for source-language detection.

## Global rules

1. **Generate from source, don't hand-author from memory.** A codemap or
   freshness fix must be traceable to a file you actually read this run.
2. **Never rebuild Salak's job.** No dependency graph from `madge`, AST
   parsing, or grep — detect Salak, use it, or omit the section.
3. **Never touch `/project-memory/*`.** That boundary is load-bearing —
   crossing it is what would make this skill compete with
   `dev-kickoff-edho-ferdian`'s REMEMBER stage instead of complementing it.
4. **Freshness timestamps, always.** Every codemap/doc this skill writes
   carries a "Last Updated" date.
5. **Verify, don't assume.** Path existence and link resolution are checked
   by actually reading the filesystem/following the link, not inferred from
   the doc's own claim.
6. **Flag, don't silently rewrite, ambiguous staleness.** If it's unclear
   whether a doc is stale or just written loosely, say so rather than
   guessing a rewrite.

This skill keeps SKILL.md lean — read the reference file for the step
you're on rather than loading both up front.
