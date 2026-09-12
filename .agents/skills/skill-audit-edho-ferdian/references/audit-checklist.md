# Audit Checklist — What To Inspect And How

This file operationalizes the four finding categories the top-level
SKILL.md commits to. Run them in this order — staleness and broken
cross-references are cheap grep-and-date checks; redundancy and
description-quality need actual reading and judgment, so do them last with
the fast findings already in hand for context.

## 1. Staleness

**What it used to catch, and why that mechanism is retired:** this section
originally checked a skill's provenance line (`Adapted from <source>,
fetched <date>.`) against today's date — a signal that made sense while
this ecosystem was still actively porting content from an external upstream
(D-005's transitional phase). That phase is over: every "Adapted from
<source>, fetched <date>" line in this repo was rewritten into free-form
prose during the external-attribution-removal pass (commit `53ba399`), and
every skill built since is native to begin with. A grep for that pattern now
returns **zero matches across the entire `skills/` tree** — not because
nothing is stale, but because the signal it looked for no longer exists in
the corpus. Don't run that grep; it will always report a clean bill of
health regardless of actual staleness. (Found and retired 2026-09-12, during
the audit that first noticed the checklist itself had gone stale.)

**What it catches now:** a skill that hasn't been substantively revisited
even as the ecosystem's own canonical, cross-skill contracts and shared
conventions moved on around it — the same underlying risk (content quietly
falling behind a moving reference point), just measured against this
repo's own evolving norms instead of an external upstream.

**How to check:**
1. Get each skill's last substantive touch date:
   ```bash
   git log -1 --format=%ad --date=short -- skills/<name>/SKILL.md skills/<name>/references/*.md
   ```
   **Fallback when the repo has no `.git`:** use filesystem mtime instead
   (`ls -la` / `ls --time-style=full-iso`), understanding it is weaker
   evidence — mtime changes on any touch, including a non-substantive one,
   while a git commit date reflects an intentional change.
2. Find this ecosystem's current list of canonical, cross-skill contracts
   and when each was introduced — read `skill-authoring-edho-ferdian`'s own
   numbered sections (§7 Language routing, §8 Development loop convention,
   §9 External docs/Context7, and whatever has been added since — its own
   `## Provenance` section dates each one) and check `01-decision-register.md`
   for any other ecosystem-wide promotion (a shared rule file, a baseline
   conventions doc, a new required section). This list will keep growing;
   don't hardcode today's set into this checklist.
3. For each skill, compare its last-touch date (step 1) against each
   contract's introduction date (step 2). A skill last touched **before** a
   contract that applies to it was introduced, and that does not carry that
   contract's one-line pointer, is a staleness candidate — it predates the
   norm and may never have adopted it. (A skill that's genuinely exempt from
   a given contract, the way `safe-execution-edho-ferdian` and
   `config-hygiene-edho-ferdian` are exempt from Language routing, is not a
   candidate — check the contract's own stated exemptions before flagging.)
4. Two signals matter, same shape as before, re-based on this ecosystem's
   own timeline instead of an external one:
   - **Never revisited**: a skill with no commits touching it in roughly
     **90+ days** while its immediate neighbors (skills it cross-references,
     or that cross-reference it) have been actively edited in that window —
     the "written once, left behind while its neighborhood moved" signal.
   - **Silently diverged**: a skill's own `## Provenance` section narrates
     facts about the repo that no longer hold — a total skill/agent count
     that's since changed, a decision ID it names that was later superseded
     or corrected, a skill or file name it mentions that no longer exists.
     This is a provenance-hygiene issue even if the skill's operative
     instructions are otherwise fine.
5. Where feasible, spot-check a flagged skill's actual content against
   whatever it should be current with (the contract it's missing, the
   decision it narrates) for the highest-priority candidates — skills that
   get used often, or that other skills depend on. This step is judgment-
   heavy; don't run it against every candidate on every audit.

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
   that mentions it (a reference file's own bare `references/<name>.md`
   mention means a sibling in the same skill's `references/` directory) and
   confirm the target file actually exists on disk.
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
