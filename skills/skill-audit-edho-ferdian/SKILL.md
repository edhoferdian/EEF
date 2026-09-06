---
name: skill-audit-edho-ferdian
description: >-
  Audit this ecosystem's own `skills/` directory for staleness, redundancy,
  broken cross-references, and description-quality problems — increasingly
  important as this ecosystem grows past a dozen interlinked skills. Use
  when the user says "audit skill saya", "cek skill yang sudah dibuat", "ada
  yang redundan gak", "skill mana yang basi", or periodically after a batch
  of new skills is added. Scope is this repo's own `skills/` content and
  quality only — NOT the `~/.claude` environment/config (that's
  `config-hygiene-edho-ferdian`), even for overlapping phrasing like
  "kebanyakan skill" or "audit setup gue".
---

# Skill Audit — Edho Ferdian Mode

For pre-creation search, quality bar, and compliance testing of a single
skill, see `skill-authoring-edho-ferdian` instead — this skill only runs
periodic checks across the whole `skills/` tree.

## Scope reframe — read this first, it is the most important thing here

**This skill audits this repo's own `skills/` directory (`ekosistem-edho-ferdian/skills/*`,
24+ skills as of this porting effort and counting) — and nothing else.**

It does **not** audit:

- An ECC install (`~/.claude/agents`, `~/.claude/skills` from the ECC
  package, or any ECC-managed directory). ECC's own `harness-optimizer` —
  the skill this one is adapted from — audits *that*: the local agent
  harness configuration for reliability, cost, and throughput of an ECC
  install. That is explicitly not this ecosystem's concern; per this
  project's own decision record (D-005), an ECC install here is treated as
  temporary scaffolding being replaced by native skills, not a target to
  keep healthy.
- This repo's own `project-memory/` (where gap analyses, decision register,
  and porting decisions like this one live). That's process history — this
  skill's target is the *product* of that process (`skills/*`), not the
  planning trail that produced it.
- The unrelated `Skill-Ekosistem-Edho` folder (a leftover from a prior
  session mistakenly conflated with this ecosystem — see D-011 in
  `01-decision-register.md`). It is a different project; never scan it.

If you ever catch yourself pointing a grep at `~/.claude/agents/*.md`, at
`project-memory/`, or at a sibling `Skill-Ekosistem-Edho` folder while
running this skill, stop — you have drifted out of scope. This is a full
reframe of ECC's `harness-optimizer` concept, not a port with
find-and-replace on the target path. Its ECC-internal command dependencies
(references to ECC's own `/harness-audit` command family, ECC agent
registries, etc.) were replaced entirely — there is nothing ECC-specific
left for this skill to depend on at runtime.

## What it actually checks

Four categories, defined in full (mechanics, severity rules, and worked
detection steps) in **`references/audit-checklist.md`** — read it now,
don't re-derive the categories here:

1. **Staleness** — a skill whose `Adapted from ECC <agent>, fetched <date>`
   provenance line is old and the file hasn't been meaningfully revisited
   since.
2. **Redundancy** — two skills whose descriptions/trigger phrases overlap
   enough that either could plausibly be loaded for the same request, with
   no stated boundary between them.
3. **Broken cross-references** — a `SKILL.md` or `references/*.md` pointing
   at a `references/*.md` file or a sibling skill directory that no longer
   exists.
4. **Description quality** — a `description:` frontmatter field too vague
   to trigger reliably, or too broad and now competing with a neighbor.

## Workflow

1. **Enumerate the target.** List every `skills/*/SKILL.md` under this
   repo's own `skills/` directory (confirm this is the repo root you're in
   before scanning anything — see the scope reframe above). This is the
   entire universe for this audit; nothing outside this repo's `skills/`
   is in scope.
2. **Run each category from `references/audit-checklist.md`, in the order
   it specifies** — staleness and broken cross-references first (cheap,
   mechanical, grep-and-date), then redundancy and description-quality last
   (need actual reading and judgment, and benefit from having the fast
   findings already in hand as context).
3. **Produce the report** in the format below.
4. **Do not fix anything unless asked.** This skill's job is to surface
   findings with enough evidence that the user (or a follow-up editing
   pass) can act on them — not to silently rewrite descriptions or delete
   files mid-audit. If the user asks you to fix a specific finding
   afterward, do that as an explicit follow-up action, not folded into the
   audit itself.

## Report format

Lead with a summary table, then per-skill findings — this mirrors the
severity-table-then-detail pattern `audit-checklist.md` already implies
with its per-category severity levels, so the report reads consistently
with how the checklist itself is organized.

```markdown
# Skill Audit Report — Ekosistem Edho Ferdian

**Date:** {date}
**Skills scanned:** {count}

## Summary

| Skill | Staleness | Redundancy | Broken refs | Description quality |
|---|---|---|---|---|
| {skill-name} | OK / MEDIUM / HIGH | OK / MEDIUM / HIGH | OK / HIGH | OK / MEDIUM |

## Findings

### {skill-name}

- **[STALENESS — MEDIUM/HIGH]** {provenance line, fetch date, git-modified
  date, which staleness signal fired (never-revisited vs. silently-diverged),
  and whether an ECC source spot-check was done}.
- **[REDUNDANCY — MEDIUM/HIGH]** overlaps with `{other-skill}` on
  {specific shared phrase/domain}; {boundary statement found, or "no
  boundary statement found in either skill"}.
- **[BROKEN REF — HIGH]** `{file}` references `{missing-path}`, which does
  not exist.
- **[DESCRIPTION — MEDIUM]** {vague: no concrete trigger phrases / too
  broad: overlaps `{other-skill}`'s claimed territory}.

## Clean

{Skills with zero findings across all four categories — list by name, no
detail needed.}

## Recommendation

{Prioritized punch list: HIGH findings first (broken refs, severe
redundancy), then MEDIUM (staleness, vague descriptions) — same severity
weighting `audit-checklist.md` already defines per category.}
```

A skill with zero findings across all four categories goes in **Clean**,
not into an empty row of the findings section — don't pad the report with
"no issues found" boilerplate per skill.

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract)

Communication to the user in Bahasa Indonesia; the findings/recommendation
report in English, matching the `SKILL.md` prose it audits. Full contract:
`skill-authoring-edho-ferdian` §7.

## Provenance

Adapted from ECC `harness-optimizer`, fetched 2026-09-04 — **this is a
reframe, not a direct port.** ECC's `harness-optimizer` audits a live agent
harness install for reliability/cost/throughput; this skill keeps only the
general shape of "systematically audit a growing collection of
configuration artifacts for drift and redundancy" and replaces everything
else: the target (this repo's own `skills/*`, never an ECC install, this
repo's `project-memory/`, or the unrelated `Skill-Ekosistem-Edho` folder),
the four finding categories (staleness, redundancy, broken cross-references,
description quality — none of which map 1:1 to what `harness-optimizer`
checks), and the report format. Its ECC-internal command dependencies were
replaced entirely, not adapted.

## Rules

- Scope is this repo's own `skills/*` only. Never treat an ECC install,
  this repo's `project-memory/`, or the unrelated `Skill-Ekosistem-Edho`
  folder as in-scope for this skill's findings.
- Evidence or it's not a finding — every finding cites a concrete file,
  line, or provenance date, same standard `code-review-edho-ferdian` holds
  its own findings to.
- Intentional layering (a skill that explicitly states it's a lens on top
  of another, or a phase-handoff, or a consolidation-with-references) is
  not redundancy — don't flag architecture the repo already uses on
  purpose. See `references/audit-checklist.md` §2 for the exact test.
- A path that resolves is fine even if its content might be stale — that's
  a staleness finding (§1), not a broken-reference finding (§3). Keep the
  two categories separate even when they land on the same file.
- Report first, fix only on request.
