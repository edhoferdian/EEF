---
trigger: model_decision
description: "Discipline for creating and governing this ecosystem's own skills: search before building (local → marketplace → GitHub → web, with a security vet on anything external), write to a quality bar, measure whether a skill is actually obeyed rather than assuming it, promote recurring cross-skill principles up into rules, and package a finished skill into `dist/*.skill` for manual upload. Use when the user says \"bikin skill baru\", \"ada skill buat X gak\", \"fork skill ini\", \"skill gue kepake gak sih\", \"package skill ini\", \"mau publish skill ini\", \"buatkan .skill-nya\", or before adding anything to this repo's `skills/` or `dist/`."
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
   this ecosystem's earlier porting work, applied to original work.
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

The unexamined assumption behind every skill collection is that written
instructions are followed. They frequently are not, and nobody notices because nobody looks.

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

A full pass over every skill is
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

Package a skill into `dist/*.skill` whenever `skills/<name>/` changes and
the change is going to be committed — CI (`.github/workflows/ci.yml`,
`dist-sync` job) fails the build if `dist/` drifts from `skills/`, so
"stale and unpublished" is no longer just a convention to remember, it's an
enforced gate. Packaging is not automatic on every keystroke — run it as
the last step before committing, same as running a formatter.

### Pre-package validation

`scripts/validate_skills.py` runs this automatically (also enforced in CI
as the `validate` job) — run it yourself before packaging rather than
waiting for CI to catch it:

```bash
python scripts/validate_skills.py
```

It checks: valid frontmatter with non-empty `name`/`description`,
description length ≤1024 chars (the harness display limit this ecosystem
was bitten by twice), no "ECC" mentions outside the one deliberate
exception (`config-hygiene-edho-ferdian`), and no reference to a
`references/*.md` file that doesn't exist anywhere in the repo. It does
**not** check absolute local paths (`C:\Users\...`, `/home/...`) or leaked
secrets — those need human judgment to avoid false positives in CI, so
they stay part of a manual `skill-audit-edho-ferdian` pass, not this
automated gate.

### Packaging

```bash
python scripts/package_skills.py            # all 35 skills
python scripts/package_skills.py <name>      # just one
python scripts/package_skills.py --check     # dry run — exit 1 if stale, same check CI runs
```

This is the only way `dist/*.skill` should be produced now — it writes
forward-slash paths (a `.skill` zipped with Windows-style backslash paths
can fail to install correctly on non-Windows systems) and a fixed internal
timestamp, so re-running it produces byte-identical output and CI's
`--check` diff is meaningful. Don't hand-zip a skill folder; the archive
root must be the skill's own files with no wrapping folder, which the
script already guarantees.

### Drift check

CI enforces this now (`dist-sync` job runs `package_skills.py --check` on
every push/PR) — a PR that changes `skills/` without repackaging `dist/`
fails CI rather than silently shipping a stale archive.

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


> **Truncated for Windsurf's 12,000-character workspace rule limit.** Read the full skill at `skills/skill-authoring-edho-ferdian/SKILL.md` for complete instructions.
