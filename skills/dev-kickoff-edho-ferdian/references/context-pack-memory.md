# Execution Context Pack & Project Memory Files

Reference for Phase 2 of dev-kickoff-edho-ferdian v2.0.
Agent roster and harness detection live in `agent-harness.md` — read both.

---

## Context Pack structure (English)

```
# EXECUTION CONTEXT PACK — [Project Name]

## A. PROJECT IDENTITY
3–5 sentences: what, for whom, why. No marketing language.

## B. PROJECT DECISION REGISTER
Full embed of the PDR from Phase 1 (8 sections, incl. the language contract).

## C. SOURCE DOCUMENTS & ROLE COVERAGE
The intake matrix: which document covers which role, version, language, and
which roles are uncovered. Anything marked [DERIVED] is flagged here too.

## D. CURRENT STATE
- Sprint: [n]/[total] | Task: [id] — [stage: plan/test/implement/review/verify/remember]
- Completed tasks: [ids, one line]
- Files created/modified so far: [paths + one-line purpose]
- Last verification result + date

## E. NEXT ACTION
One specific task, its acceptance criteria, and the stage to start at.
Never "continue the project".

## F. WORKING RULES FOR THE EXECUTING AI
- One task at a time, in plan order, through PLAN → TEST → IMPLEMENT →
  REVIEW → VERIFY → REMEMBER.
- Test before implementation, or a stated reason why not.
- Verification means real tool output. No tool output, no "done".
- Follow conventions in §B.3 exactly.
- NON-GOALS (§B.4) are hard boundaries.
- Any new binding decision → stop and ask the user; record approved decisions
  in project-memory/01-decision-register.md.
- Update project-memory/03-progress.md after every completed task.

## G. AGENTS & HARNESS
Which harness is installed (or none), which roles it owns, and where this
project's own agent definitions live. See agent-harness.md.

## H. RESUME PROTOCOL
How to use this pack in a new session/tool (see execution-loop.md).
```

## Target variants

| Variant | File | Adaptation notes |
|---------|------|------------------|
| Claude Code | `CLAUDE.md` | §F as imperative instructions; add directory structure + build/test commands |
| Cursor | `.cursorrules` or `AGENTS.md` | Trim A–C aggressively — rules are read every request, save tokens |
| Copilot | `.github/copilot-instructions.md` | Conventions + stack only; Copilot handles long context poorly |
| Universal | `context-pack.md` | Full version — paste into any fresh AI chat session |

Ask which variants are needed (multiple allowed). For pure-chat targets,
always include Universal.

## Merge rule for existing files (mandatory)

Before writing `CLAUDE.md`, `AGENTS.md`, `.cursorrules`,
`copilot-instructions.md`, or any agent file:

1. Check whether it already exists (read the repo; in chat, ask).
2. If it exists: read it fully → keep still-valid content → add or revise only
   what changed → mark edited sections with
   `<!-- updated by Dev Kickoff [date] -->`.
3. If existing content conflicts with the PDR → don't silently pick a winner.
   Present the conflict, let the user decide, record the outcome in
   `01-decision-register.md`.
4. Never blind-overwrite. An existing CLAUDE.md represents decisions someone
   already made.

---

## Project-memory file structure

```
/project-memory/
  00-master-plan.md        ← condensed intent + sprint/milestone map from the
                             WORK_PLAN (goal, phases, what "done" means)
  01-decision-register.md  ← the PDR — LIVING DOCUMENT
  02-gap-analysis.md       ← Phase 0 findings + OPEN QUESTIONS with status
                             (open/resolved + date) + accepted debt
  03-progress.md           ← Progress Ledger; latest Session Snapshot ALWAYS
                             embedded at the top
  04-instincts.md          ← durable project-specific lessons (REMEMBER stage)
CLAUDE.md                  ← repo root (Claude Code variant)
AGENTS.md / .cursorrules   ← repo root (other agents)
.claude/agents/*.md        ← project agent roster, when this skill owns it
```

Each memory file carries frontmatter:

```
---
project: [Product_Name]
doc_lang: [id|en]
artifact_lang: en
updated: [YYYY-MM-DD]
---
```

**Language:** `01` and `04` and all snapshots are English. `00`, `02`, and the
narrative parts of `03` follow `doc_lang`. IDs and technical terms stay English
in every file.

**Sync rules (same-turn, not "later"):**
- New decision approved → update `01` immediately.
- Task completed → update `03` (ledger + new snapshot).
- Lesson learned that will recur → append to `04`.
- Open question resolved → move to resolved in `02`; if the answer is binding,
  it also enters `01`.
- `00` changes only when scope changes — which requires explicit user
  confirmation and a dated note.

**Environment adaptation:**
- Filesystem available → write and update these files directly.
- Pure chat → emit each file as a copy-ready block and tell the user to commit
  it. Remind them whenever a memory file changed but hasn't been saved.

---

## Reflection — 8 gates (mandatory after Phase 2)

```
CATATAN REFLEKSI — CONTEXT PACK
Gate 1 (Completeness): Sections A–H filled?                      [PASS/FAIL + reason]
Gate 2 (Sources): Every technical claim traceable to PDR/docs?   [.]
Gate 3 (Portability): Understandable by an AI that never saw
       this session?                                             [.]
Gate 4 (Non-goals): No instruction contradicts non-goals?        [.]
Gate 5 (State accuracy): CURRENT STATE matches reality?          [.]
Gate 6 (Language): Machine-facing artifacts English; human-facing
       memory files follow doc_lang; no mixing inside one file?  [.]
Gate 7 (Memory files): /project-memory/ complete (5 files), and
       no existing file overwritten without merge?               [.]
Gate 8 (Agents): Roster gates R1–R5 in agent-harness.md pass?    [.]
```

Any FAIL → fix first, re-show the block, then hand over. The block is
user-visible on purpose: transparency is what makes the pack trustworthy.

**Done criteria Phase 2:** all requested variants produced · 5 memory files
written/emitted · agent roster written or harness deferral recorded ·
Reflection all-PASS.
