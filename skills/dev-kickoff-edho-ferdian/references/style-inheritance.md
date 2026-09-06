# Style Inheritance

Reference for aligning an AI agent's code output with a brownfield project's
existing, unwritten conventions — so generated code reads as if the same
person wrote it, instead of drifting toward the model's pretrained mainstream
idioms.

Adapted from ECC `inherit-legacy-style`, fetched 2026-09-06.

## Scope boundary — read this before the trace

This file answers **"how is this code written"** — form and convention:
declaration order inside a file, naming habits, where cross-cutting utilities
live, how errors are handled. It never asks whether the code is *correct* or
*complete*.

Two adjacent references answer different questions on purpose. Do not let
this one bleed into either:

- **`intake-validation.md` § Mode C — brownfield trace** answers **"what does
  this code do, and what does it promise"** — the semantic trace (entry
  point → branches → async boundaries → data transformations → error paths)
  and the behavior/spec side of a brownfield feature. Run that trace first
  when Phase 3 is about to touch existing code for a specific feature; it
  tells you what the code must keep doing. This file tells you how to write
  the new code so it looks native once the trace says what it must do.
- **`spec-mining-edho-ferdian`** answers **"what requirement does this code
  satisfy"** — it mines BEHAVIOR_SPEC content (FR/NFR, acceptance criteria)
  out of existing code when that role is missing from the source documents
  (see `intake-validation.md` Step 0.3). It produces requirements, never
  conventions.

Pointer back: if you arrived here needing to know what a brownfield feature
does before changing it, or whether a requirement exists at all, you're in
the wrong file — go to `intake-validation.md` (behavior) or
`spec-mining-edho-ferdian` (requirements). This file only ever answers "how
is it written."

**Relevant here because Edho works in a fork of upstream `ghostfolio` plus
vendored code under `mangga-pa/upstream/`** — both are exactly the brownfield
shape this reference exists for: someone else's conventions, no spec for the
conventions themselves, and a real cost to drifting from them file by file.

## Step 0 — Auto-detect mode, announce, don't ask

Check for `.ai-style-rules.md` at the project root:

| File exists? | Mode |
|---|---|
| No | **Full-scan** (first run) |
| Yes | **Incremental sniff** |

Announce the mode in one line and proceed — e.g. *"Belum ada
`.ai-style-rules.md` — jalan full-scan."* Never interrogate the user about
which mode to run; the file's presence already answers it.

## Full-scan mode

### 1. Measure scale before picking a scan tier

```bash
git ls-files | grep -cE '\.(js|ts|jsx|tsx|vue|py|go|rs|java|kt|rb|php|cs|swift|c|cpp|h)$'
```

Adjust the extension list to what the repo actually contains (for the
ghostfolio fork this is mostly `.ts`/`.tsx`; for vendored `mangga-pa/upstream/`
check its own stack before assuming).

| Tier | Source files | Strategy |
|---|---|---|
| Small | ≲ 50 | Full close-read of every source file |
| Medium | 50–500 | Infrastructure layer: full read. Business layer: sample 2–3 files per dimension |
| Large | ≳ 500 | Strict sampling with a budget cap — `--stat` summary first, then targeted `Read` on suspect files only |

**Why this matters, not just what to do:** sampling a 30-file project starves
the scan of signal — three files is not enough to see a real convention, only
noise that looks like one. Full-reading a 5,000-file repo blows the context
budget before a single line of the actual task gets written. The tier exists
so the scan cost scales with the project, not with a fixed habit.

### 2. Scan along 4 meta-architecture dimensions

1. **File anatomy** — the in-file declaration order: imports → types →
   main logic → helpers → export. Note the house order, not what's
   theoretically idiomatic for the language.
2. **State & control flow** — naming conventions for async state (`isLoading`
   vs `loading` vs `pending`), pagination (`page`/`cursor`/`offset`), and
   boolean flags.
3. **Infrastructure** — where cross-cutting utilities actually live:
   interceptors, formatters, middleware, shared validators. This is the
   dimension most often violated by a fresh AI session, which tends to
   re-invent a local helper instead of finding the existing one.
4. **Error handling** — try/catch vs a global interceptor vs `Result`-style
   return values; null-check habits (early return vs guard clause vs
   optional chaining).

These four dimensions are meta-architecture — form and shape — never syntax
quality or technology choice. See Anti-patterns below.

### 3. Apply signal-threshold noise reduction

Not every inconsistency is worth an interruption. Before surfacing anything
to the user, classify it:

- **Weak signal → auto-suppress.** Minority usage is `<5%` of instances
  **and** fewer than 10 occurrences → the majority wins silently, and the
  minority is recorded in `.ai-style-rules.md` under `[DONTs]` as a pattern
  not to propagate. No question asked.
- **Strong signal → grill it.** A near-even split, or a semantic fork on one
  of the 4 core dimensions (e.g. half the codebase uses a global error
  interceptor, half uses local try/catch) — this is a real fork, not noise.
- **Small-project exception.** On ≲50 source files, a split like "3 files
  vs 2 files" is **not** a majority by percentage math — grill it anyway.
  The weak-signal math above assumes a population large enough for 5%/10 to
  mean something; it doesn't hold at this scale.

### 4. Grilling Protocol — one conflict, one question, four options

For every strong-signal conflict, ask exactly one question with exactly four
options. Never stack multiple open conflicts into one message.

```
Evidence: `pathA` uses style X, `pathB` uses style Y
Risiko: mencampur keduanya memecah konsistensi gaya proyek
Pilih: 1) ikut X   2) ikut Y   3) ini evolusi, perbarui aturan   4) saya punya aturan baru
```

Suspend and wait for the answer before moving to the next conflict. This is
the same one-gate-per-turn discipline `safe-execution-edho-ferdian` already
uses for its own gates (Gate 1 fact-forcing, Gate 2 destructive commands) —
cross-reference it there if you need the general rationale for why gates
don't get batched: a stacked set of questions gets rubber-stamped as a block,
which defeats the point of asking per-conflict in the first place.

### 5. Generate `.ai-style-rules.md`

Three mandatory sections, in this order:

- **`[Golden Files]`** — real exemplar paths in the repo, each annotated
  with what it demonstrates. Not a description of an ideal file — a pointer
  to an actual one that already exists and already passed review.
- **`[Naming & State-Control Rules]`** — concrete, checkable conventions.
  "Use descriptive names" is not checkable; "async state fields are prefixed
  `is` + present participle (`isLoading`, not `loading`)" is.
- **`[DONTs]`** — anti-patterns that must not propagate, including every
  minority pattern auto-suppressed in Step 3.

Header carries a **commit fingerprint** (the `HEAD` hash at scan time) and
the **scale tier** used, so a later incremental run knows both what changed
and how the original scan was scoped.

### 6. Wire the soft hook — never the hard hook, never `settings.json`

The upstream ECC skill offers the user a choice of soft hook, hard hook, or
no hook, with a hard `PreToolUse[Write|Edit|MultiEdit]` entry in
`settings.json`. **That choice does not exist here.** In this ecosystem,
writing to `settings.json` is `config-hygiene-edho-ferdian`'s domain and any
hook — hard or otherwise — is subject to the `safe-execution-edho-ferdian`
gate discipline (Gate 3 Freeze and the hookify appendix cover the mechanical
binding). This file has no authority to touch either.

So: this skill's only output here is a **soft hook** — a reference line in
the project's `CLAUDE.md` (e.g. `@.ai-style-rules.md` or an equivalent
pointer under the project's existing context-pack conventions). If the user
asks for mechanical enforcement (a real `PreToolUse` block that blocks a
non-conforming edit), say so plainly and route the request to
`config-hygiene-edho-ferdian` — do not attempt it here, and never write to
`settings.json`/`settings.local.json` from this file's workflow.

## Incremental sniff mode

1. Read the existing `.ai-style-rules.md`. If its header carries a commit
   fingerprint, run `git diff <last_hash> HEAD --stat` to localize the delta
   instead of rescanning the whole tree.
2. Read recent history (`git log -3 --stat`) and open suspect files on
   demand — files with a large diff, or a diff touching one of the 4
   dimensions.
3. For an oversized diff (hundreds of files — plausible after pulling
   upstream `ghostfolio` changes into the fork, or refreshing
   `mangga-pa/upstream/`): `--stat` summary only, then sample the largest
   changes. Don't full-read a vendor sync.
4. Compare new code against the recorded rules. Any conflict goes through
   the same Grilling Protocol as full-scan mode — one question, four
   options, no stacking.
5. **Append an evolution log entry. Never overwrite existing rules.**

```
### [YYYY-MM-DD] Style Evolution Log
- <what changed, which file(s) triggered it, which option the user picked>
```

An incremental run that silently rewrites an old rule destroys the audit
trail of why the project's style is what it is — the same "never overwrite,
always append" discipline `execution-loop.md` already applies to
`04-instincts.md` (contradictions get logged, not deleted).

## Per-turn enforcement (once the soft hook is live)

When `.ai-style-rules.md` is loaded into context via the `CLAUDE.md`
reference, every code-writing task should open with a short compliance line
naming the exemplar being followed and the DONTs being avoided — a cheap,
concrete check, not a reasoning gate. If a task can't name an exemplar, that
is itself a signal the task is doing something the scan never saw and may be
worth a fresh grilling-protocol question rather than a silent guess.

## Anti-patterns (do not do these)

- **Judging syntax or tech-stack quality.** This skill aligns
  meta-architecture only — file anatomy, naming, infra placement, error
  handling shape. Whether the stack itself is a good choice, or whether a
  particular syntax construct is idiomatic for the language, is out of
  scope here. That belongs to the language-specific reviewer agents
  (`typescript-reviewer`, etc.) or `code-review-edho-ferdian`.
- **Copying bugs from a golden file.** A golden file is an exemplar of
  *structure*, not a guarantee of correctness. If it contains a defect,
  reuse its shape and report the defect separately to
  `code-review-edho-ferdian` — never propagate it silently because "that's
  what the exemplar does."
- **Skipping the scale measurement.** Sampling a 30-file project starves it
  of signal; full-reading a 5,000-file repo blows the context budget. Always
  measure first.
- **Stacking grilling-protocol questions.** One conflict, one question, four
  options — every time.
- **Overwriting `.ai-style-rules.md` in incremental mode.** Append the
  evolution log; the old rules stay.
- **Defaulting to a hard hook, or writing `settings.json` directly.** Both
  are out of scope for this file — soft hook only, hand off hard-hook
  requests to `config-hygiene-edho-ferdian`.
