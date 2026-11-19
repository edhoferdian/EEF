# Skill Template — a new EEF skill that meets §2 and §11

Copy, fill, then run the checks at the bottom. Replace `<…>`.

## Folder

```text
skills/<name>-edho-ferdian/
├── SKILL.md                 ← routing + process; short
└── references/
    ├── <lens-1>.md           ← one lens per file, loaded on demand
    ├── <lens-2>.md
    └── worked-example.md     ← one task end to end, with code
```

## SKILL.md

```markdown
---
name: <name>-edho-ferdian
description: >-
  <What it does in one sentence: the outcome, not the topic>. Use for
  "<Indonesian phrase the user really types>", "<another>", "<English
  phrase>", or <a situation>. <One "not for" line if a neighbour skill exists.>
metadata:
  last_reviewed: "<YYYY-MM-DD>"
---

# <Title> — Edho Ferdian Mode

<Two or three sentences: the job, and the failure this skill prevents.>

## Boundary

- **`<neighbour>-edho-ferdian`** owns <X>; this skill owns <Y>.

## Workflow

1. **<Step>** — <what to do, what evidence to produce>.
2. **<Step>** — …
3. **Verify** — <the command or check that proves it worked>.

## References

| File | Read when |
|---|---|
| `references/<lens-1>.md` | <situation> |
| `references/worked-example.md` | doing the work for the first time in a project |

## Worked examples

`references/worked-example.md` — <one line on what it shows>.

## Hands off to (fixed — see skill-authoring-edho-ferdian §11)

When the work reaches one of these, load that skill with the Skill tool
and follow it — don't write its part from memory.

- <Situation> → `<skill>-edho-ferdian`
- <Situation> → `<skill>-edho-ferdian`

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract)

Communication to the user in Bahasa Indonesia; code and artifacts in
English — fixed, never ask. Full contract: `skill-authoring-edho-ferdian` §7.

## Global rules

1. <Rule that, if skipped, caused a real failure before.>
```

## A good description vs a weak one

```yaml
# Weak — accurate, never fires
description: Guidance on caching strategies for web applications.

# Good — outcome, real trigger phrases (id + en), boundary
description: >-
  Design and fix caching for web apps: Redis keys and TTLs, HTTP cache
  headers, CDN rules, invalidation after writes. Use for "cache-nya basi",
  "data gak update", "pasang Redis", "kenapa harus refresh dua kali", or
  stale data after a deploy. Query speed itself is performance-audit.
```

Keep it ≤ 450 characters; put detail in the body.

## Worked example skeleton

```markdown
# Worked Example — <task>

## The ask
"<the user's words>"

## Step 1 — <step name>
<what was looked at, with file:line or command output>

## Step 2 — …
<code before / after>

## Verify
<command and its output>

## Report
<the exact output shape the skill produces>
```

## Wire it into the ecosystem

1. **Router:** add a route in
   `skills/config-hygiene-edho-ferdian/hooks/suggest-skill.js` with the
   trigger phrases (the test "skill-router has a route to every skill"
   fails until you do).
2. **File guard** (if it owns a file type): add a rule in
   `skills/config-hygiene-edho-ferdian/hooks/skill-guard.js`.
3. **Handoffs in:** add a "Hands off to" row in at least one neighbour
   skill that reaches this one.
4. **dev-kickoff:** add it to the stage or touched-file table if a project
   stage should load it.
5. **Decision:** record the decision to add it (project memory, D-0xx).

## Checks before the PR

```bash
python scripts/validate_skills.py
python scripts/measure_context.py --budget 9500 --max-desc-chars 450 --listing-chars 14000
python scripts/regen_all.py && python scripts/regen_all.py --check
node --test tests/*.test.js
python -m unittest discover -s tests -p "test_*.py"
```

If `measure_context.py` fails on the listing budget, shorten descriptions
(this one or others) before merging — an overflowing listing silently
strips other skills' triggers.

## Trigger eval case (optional but recommended)

Follow the existing cases in `evals/triggers/` (e.g. `architecture-decision/`):

```text
evals/triggers/<case-name>/
├── prompt.md         ← the user's words, Indonesian if that's how it's asked
└── graders/          ← how a run is judged (copy the shape of a neighbouring case)
```

Cases ending in `-in-repo/` also carry a `scaffold.sh` that builds a tiny
repo so the prompt is realistic.
