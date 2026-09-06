---
name: skill-authoring-edho-ferdian
description: >-
  Discipline for creating and governing this ecosystem's own skills: search
  before building (local → marketplace → GitHub → web, with a security vet
  on anything external), write to a quality bar, measure whether a skill is
  actually obeyed rather than assuming it, promote recurring cross-skill
  principles up into rules, and package a finished skill into
  `dist/*.skill` for manual upload. Use when the user says "bikin skill
  baru", "ada skill buat X gak", "fork skill ini", "skill gue kepake gak
  sih", "package skill ini", "mau publish skill ini", "buatkan .skill-nya",
  or before adding anything to this repo's `skills/` or `dist/`.
---

# Skill Authoring — Edho Ferdian Mode

## Boundary with `skill-audit-edho-ferdian`

| Moment | Skill |
|---|---|
| Before a skill exists — should it? does one already? | **this skill** §1 |
| While writing it — quality bar, description that triggers | **this skill** §2 |
| After it ships — is it actually obeyed? | **this skill** §3 |
| Periodically across all skills — stale, redundant, broken links | `skill-audit-edho-ferdian` |
| Principles recurring across many skills → rules | **this skill** §4 |
| Packaging a finished skill into `dist/*.skill` | **this skill** §6 |

Neither skill runs the other's checks. If you find yourself grading
description quality across the whole `skills/` tree, you are running the
audit, not this.

Also distinct from `opensource-release-edho-ferdian`: that skill packages
*someone else's project* for public open-source release. §6 below packages
*this ecosystem's own* skill folders for distribution. Same verb
("package"), different object — don't route a "package this skill" request
there.

## §1 — Search before you build

The failure mode is building the twelfth variant of something that already
exists. Search in cost order, cheapest first:

1. **This ecosystem** — `skills/*/SKILL.md` in this repo. A near-match here
   is usually a FOLD (a new `references/*.md` under an existing skill), not
   a new top-level skill. This is the same consolidation rule D-009 set for
   the ECC port, applied to original work.
2. **Installed and marketplace skills** — name match first, then
   frontmatter descriptions.
3. **GitHub** — `gh search repos`, `gh search code --filename SKILL.md`.
4. **Web** — at most three targeted queries.

**Vet anything external before adopting it.** Read the full SKILL.md and
every reference. Look for unexpected shell commands, file writes outside
the working tree, network calls, credential handling, or package installs.
Check whether the repo is maintained. Copy into a fresh branch and review
the diff rather than editing a marketplace original in place. An external
skill is untrusted content until read — the same standard this ecosystem
holds for any other fetched file.

If the user explicitly says to skip the search, acknowledge it and proceed.

**Choosing the right artifact form.** A repeated pattern becomes a
**command** when a human decides to invoke it at a known moment; a **skill**
when it should fire on its own from a description-level trigger; an
**agent/subagent** when it needs its own context window or an isolated
write surface. Choosing "skill" for something that is really an on-demand
checklist is what produces trigger collisions later — see `skill-audit-
edho-ferdian`'s redundancy category.

(adapted from ECC commands/evolve.md, fetched 2026-09-06)

## §2 — The quality bar

A skill in this ecosystem is not done until:

- **The description triggers.** It names concrete phrases the user actually
  says (including Indonesian ones), and it says what the skill is *not* for
  when a neighbouring skill exists. A description that is merely accurate
  but never fires is a dead skill.
- **Its boundary is stated.** If it overlaps another skill, the overlap is
  named and adjudicated in the text — the audit skill treats a stated
  boundary as intentional architecture, not redundancy.
- **Provenance is recorded** when adapted from an external source: what it
  was adapted from, the fetch date, and what was deliberately changed.
- **References are split by lens, not by chapter.** Many small
  `references/*.md` loaded on demand beats one long SKILL.md.
- **No live dependency on an external harness** (D-005), and no
  Claude-Code-only construct that breaks portability (D-008).

## §3 — Compliance: does anyone actually obey it?

Adapted from ECC `skill-comply` (fetched 2026-09-04). The unexamined
assumption behind every skill collection is that written instructions are
followed. They frequently are not, and nobody notices because nobody looks.

Test one skill by running the same task at three prompt strictness levels
and classifying what the agent actually did:

| Level | Prompt shape | What a pass looks like |
|---|---|---|
| Supportive | Names the skill explicitly | The skill's steps appear in order |
| Neutral | Describes the task using the skill's own trigger phrases, without naming it | The skill still fires |
| Competing | Describes the task while nudging toward a shortcut the skill forbids | The skill's constraint holds |

The neutral level tests the description; the competing level tests whether
the rules are load-bearing or decorative. Report the compliance rate and
the tool-call sequence, not an impression. A skill that only passes at the
supportive level has a description problem; one that fails at the competing
level has a rules problem.

## §4 — Distilling rules from skills

When the same principle appears in three or more skills, it belongs in a
rule, not repeated in each. This is the same promotion rule Stage 6 of
`dev-kickoff-edho-ferdian` applies to instincts ("three or more related
instincts pointing the same way → propose promoting them into PDR §3"),
applied one level up.

Method: collect exhaustively and mechanically (grep for the repeated
phrasing across all `skills/**/*.md`), then judge with full context —
scripts gather facts, the model decides. Output is one of: append to an
existing rule file, revise an outdated one, or create a new one. Replace
the now-duplicated passages with a cross-reference rather than leaving both.

## §5 — Incremental audit handoff

Adapted from ECC `skill-stocktake`. A full pass over every skill is
expensive and mostly re-reads unchanged files. Prefer a **quick scan**:
compare each `SKILL.md` and `references/*.md` mtime against the last audit
run, re-evaluate only what changed, and carry forward previous findings for
the rest. Report the diff. Fall back to a full pass when no previous run
exists, or on explicit request.

The findings format and the four audit categories belong to
`skill-audit-edho-ferdian` — this section only governs *which files* that
audit needs to look at.

## §6 — Packaging for distribution (`dist/*.skill`)

Adapted per D-023 (R8) — this ecosystem produces `.skill` archives in `dist/`
for manual upload (Claude.ai / Claude Desktop / Claude Code Skills UI), and
until now no skill in this ecosystem covered that step. This is not
`opensource-release-edho-ferdian`'s job — that skill packages *someone else's
project* for public release; this section packages *this ecosystem's own*
skill folders for distribution.

### When to package

Package a skill into `dist/*.skill` only on explicit request — packaging is
not a step that runs automatically after every edit. A stale `.skill`
archive that silently diverges from `skills/<name>/` is worse than no
archive, because it looks authoritative.

### Pre-package validation

Before zipping, verify:

1. `SKILL.md` has valid YAML frontmatter with `name` and `description` —
   a malformed frontmatter fails silently on upload with no useful error.
2. Every `references/*.md` path mentioned inside `SKILL.md` actually exists
   — this is the same broken-cross-reference check
   `skill-audit-edho-ferdian` already runs; reuse its result rather than
   re-deriving it.
3. No absolute local paths (`C:\Users\...`, `/home/...`) leaked into any
   file — a path from the author's machine is useless to anyone else and a
   sign a template or example wasn't generalized.
4. No secrets, tokens, or credentials in any reference file (same check as
   `security-review-edho-ferdian` SEC-02, applied to the skill's own
   content rather than a reviewed codebase).

### Packaging

```bash
cd skills/<skill-name>
zip -r "../../dist/<skill-name>.skill" . -x "*.DS_Store"
```

The archive root must be the skill's own files (`SKILL.md` at the archive
root, `references/` as a sibling) — not the parent `skills/` directory and
not an extra wrapping folder. A `.skill` with the wrong root structure
installs as an empty or broken skill with no error message explaining why.

### Drift check

After packaging, the archive is a snapshot. `skills/<name>/` keeps
evolving; `dist/<name>.skill` does not, until repackaged. There is currently
no automated check that a `.skill` file in `dist/` matches the current state
of its source folder — treat any `dist/*.skill` older than its source
folder's last edit as **stale and unpublished**, not as the current version.
Repackage before pointing anyone at a `dist/*.skill` file if the source has
changed since.

### What this section does not cover

Publishing the packaged skill anywhere (a marketplace, a shared drive, a
repo release) is a separate, explicit-permission action — this section only
covers producing a correct local archive.

## §7 — Language routing (canonical contract — all skills point here)

Promoted per R3/D-023 (this is §4 applied to itself): 14 skills carried 5+
mutually inconsistent headings/wordings for the same convention — plain
`## Language routing`, `(fixed — never ask)`, `(fixed — matches
code-review-edho-ferdian's contract)`, `(fixed — matches the rest of this
ecosystem)`, and `dev-kickoff-edho-ferdian`'s richer `(v2.0 — inherited, not
hardcoded)` — one skill (`security-review-edho-ferdian`) buried it as a
numbered item inside "Global rules" instead of its own heading, and roughly
half the ecosystem had no statement at all. This section is now the single
source of truth; every other skill states it in one line and points here.

**Scope — what this governs, and what it does not.** This is which human
language a *shipped, installed* skill uses wherever it runs — any project,
not just this one. It is a different document from this repo's own
`CLAUDE.md` §F, which governs communication during curation work *inside
this repo* and is never distributed with an individual skill. The two
happen to agree in value (Bahasa Indonesia narration, English artifacts) —
that is a coincidence of both being written by the same person for the same
habits, not one inheriting from the other. Do not merge them or delete
either one thinking it is a duplicate.

**The base rule (fixed, never ask):**
1. Narration, explanations, questions, and reports to the user → **Bahasa
   Indonesia**.
2. Code, diffs, commit messages, filenames, folder names, and any other
   machine-facing generated artifact → **English**.
3. Never ask the user which language to use — this is fixed, not a
   preference to elicit.

**When a skill's own source material carries a language** (e.g. a spec,
document, or dataset already written in a specific language it must mirror
back), detect that source language and follow it for content that mirrors
the source, while the base rule above still governs narration and
artifacts. `dev-kickoff-edho-ferdian`'s "Language routing" section is the
fullest worked example of this split (`doc_lang` vs `artifact_lang`,
because it ingests specs that may already be Indonesian or English) — read
it before writing a new multi-language exception rather than re-deriving
one from scratch.

**Standard form for every other skill** (one heading, 1-2 sentences, no
inline restatement of the full contract):
`## Language routing (fixed — see skill-authoring-edho-ferdian's canonical
contract)` followed by a sentence naming the base rule and pointing here.

## Provenance

Adapted from ECC `skill-scout`, `skill-stocktake`, `skill-comply`, and
`rules-distill`, fetched 2026-09-04, consolidated into one skill per D-009.
Every ECC-install-specific path (`~/.claude/skills/skill-stocktake/
scripts/*.sh`, marketplace assumptions, the `results.json` cache location)
was replaced with this repo's own `skills/` tree.

§6 (packaging) added 2026-09-06 per D-023 (R8 audit finding: no skill in
this ecosystem covered `dist/*.skill` packaging). Native to this ecosystem,
not adapted from an external source.

§7 (language routing canonical contract) added 2026-09-06 per D-023 (R3
audit finding), executed under D-035 override. Native to this ecosystem,
consolidated from the 14 skill-local variants it replaces rather than
adapted from an external source.
