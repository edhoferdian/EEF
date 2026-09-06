# Audit Checklist — What To Inspect And How

Adapted from ECC `harness-optimizer`, fetched 2026-09-04 (concept only — see
SKILL.md for why this is a full reframe, not a port).

This file operationalizes the four finding categories the top-level
SKILL.md commits to. Run them in this order — staleness and broken
cross-references are cheap grep-and-date checks; redundancy and
description-quality need actual reading and judgment, so do them last with
the fast findings already in hand for context.

## 1. Staleness

**What it catches:** a skill whose provenance line cites an ECC agent fetch
date long in the past, that hasn't been meaningfully touched since — while
its ECC source has presumably kept evolving upstream. This ecosystem's own
convention (every ported file carries `Adapted from ECC <agent>, fetched
<date>.`) makes this checkable mechanically instead of by memory.

**How to check:**
1. ```bash
   grep -rnE "Adapted from ECC .*fetched [0-9]{4}-[0-9]{2}-[0-9]{2}" skills/*/SKILL.md skills/*/references/*.md
   ```
   to collect every provenance line and its fetch date. Require a
   parseable ISO date, not just the plain string `"Adapted from ECC"` —
   the plain-string version matches unfilled template placeholders (e.g.
   `Adapted from ECC <agent-name>, fetched <date>`) as false positives —
   require a parseable date to count as real provenance.
2. For each match, compare the fetch date to today's date. Flag anything
   older than roughly **90 days** as a staleness candidate — this is a
   judgment threshold, not a hard rule; a skill with a 90-day-old fetch date
   whose ECC source hasn't meaningfully changed is not actually stale.
3. Cross-check the file's last git modification date
   (`git log -1 --format=%ad -- <path>`) against the provenance fetch date.

   **Fallback when the repo has no `.git` (e.g. this repo before its
   dedicated GitHub remote exists — see `CLAUDE.md` §A):** `git log` fails
   outright. Use filesystem mtime instead (`ls -la` / `ls --time-style=full-iso`)
   as a documented substitute, understanding it is weaker evidence — mtime
   changes on any touch, including a non-substantive one, while a git commit
   date reflects an intentional change. Once this repo has real git history,
   prefer `git log` again.

   Two signals matter:
   - **Never revisited**: git-modified date ≈ fetch date, and the fetch
     date is old. This is the strongest staleness signal — the file was
     written once and never looked at again.
   - **Silently diverged**: git-modified date is recent but the provenance
     line's fetch date wasn't updated. This means someone edited the file
     without re-checking the ECC source or updating the paper trail — flag
     it as a provenance-hygiene issue even if the content itself is fine.
4. Where feasible, spot-check the actual ECC source
   (`gh api repos/affaan-m/ECC/contents/agents/<agent>.md --jq '.content' |
   base64 -d`) against the ported content for the highest-priority
   candidates (skills that get used often, or that other skills depend on).
   This step is expensive — don't run it against every skill on every
   audit; reserve it for candidates flagged by steps 1-3.

**Severity:** MEDIUM by default (staleness is a maintenance signal, not a
functional break). Escalate to HIGH if the skill is one other skills
actively cross-reference (see §3) — a stale foundation skill has a bigger
blast radius than a stale leaf skill.

## 2. Redundancy

**What it catches:** two skills whose descriptions or trigger phrases
overlap heavily enough that Claude Code (or another Agent-Skills-compliant
tool) could reasonably load either one for the same user request — a
maintenance burden and a source of inconsistent behavior depending on which
one happens to match.

**How to check:**
1. Extract every skill's `description:` frontmatter field
   (`skills/*/SKILL.md`).
2. Compare pairwise for: shared trigger phrases (quoted example prompts in
   the description), overlapping domain nouns (e.g. two skills both
   claiming "code review" without a clear scope split), and overlapping
   "use when" framing.
3. A true redundancy candidate has **both**: (a) real phrase/domain overlap,
   and (b) no explicit boundary statement in either skill's body pointing to
   the other (e.g. `language-code-review-edho-ferdian` explicitly says it's
   a lens layer on `code-review-edho-ferdian`, not a competing skill — that
   is a resolved overlap, not a redundancy finding).
4. When two skills DO explicitly reference each other and state a
   boundary (lens-on-top, consolidation-with-references, phase-handoff),
   that is intentional layering, not redundancy — do not flag it. The
   audit's job is to catch *unintentional* overlap, not architecture the
   repo already uses on purpose.

**Severity:** MEDIUM (flag for merge consideration) unless the overlap is
severe enough that a user's exact reported trigger phrase appears near-
verbatim in both descriptions with no boundary statement anywhere — that
case is HIGH, since it means trigger selection is genuinely ambiguous today,
not just theoretically.

## 3. Broken cross-references

**What it catches:** a `SKILL.md` or a `references/*.md` file pointing at
another skill or reference file path that no longer exists — increasingly
likely to cause real failures as the number of skills grows and
cross-referencing between them (lens layers, "see also," "escalates to")
becomes more common.

**How to check:**
1. Grep every skill file for path-shaped references: backtick-quoted
   `references/*.md` file names, `skills/<name>/` paths, and skill names
   mentioned as "see `<skill-name>`" or "escalate to `<skill-name>`".
   ```bash
   grep -rn '`references/[a-zA-Z0-9_.-]*\.md`' skills/*/SKILL.md skills/*/references/*.md
   grep -rn '`skills/[a-zA-Z0-9_-]*' skills/*/SKILL.md skills/*/references/*.md
   ```
2. For every `references/*.md` mention, resolve it relative to the file
   that mentions it (a reference file's own `references/foo.md` mention
   means a sibling in the same skill's `references/` directory) and confirm
   the target file actually exists on disk.
3. For every skill-name mention (e.g. "escalate to
   `performance-audit-edho-ferdian`"), confirm a directory of that name
   exists under `skills/`.
4. A path that resolves is fine even if the audit can't verify the content
   is still accurate — that's a staleness question (§1), not a broken-
   reference question. This category is purely "does the target exist."

**Severity:** HIGH. A broken cross-reference is not a style nit — it means
following the skill's own instructions leads to a dead end, which is a
functional break, not a maintainability suggestion.

## 4. Description quality

**What it catches:** a `SKILL.md` `description:` field that is too vague to
trigger correctly (Claude Code or another tool can't tell when to load it),
or too broad and now competing with another skill for the same trigger
phrases (overlaps with §2, but the fix here is rewriting the description,
not merging skills).

**How to check — vague:**
- Does the description name concrete trigger phrases a user would actually
  type, or only abstract category words ("helps with networking",
  "improves code quality")? Concrete phrases in quotes are the pattern this
  ecosystem already uses everywhere (see any existing `-edho-ferdian`
  skill's description) — a description without any is a vagueness
  candidate.
- Does it say what the skill does NOT cover, where that matters for
  disambiguation from a neighboring skill? Not every skill needs this, but
  a skill sitting next to a very similar one (e.g. `networking-ops` next to
  a hypothetical future `network-automation`) benefits from it.

**How to check — too broad:**
- Does the description claim territory that another skill's description
  also claims, without a stated boundary? (This overlaps with §2's
  mechanical check — treat this as the qualitative read-through pass that
  confirms or downgrades a §2 finding after actually reading both
  descriptions in full, not just diffing keywords.)

**Severity:** MEDIUM. A vague or overbroad description degrades trigger
accuracy but doesn't break anything that's already running correctly — it's
a "this will bite someone eventually" finding, not an active failure.
