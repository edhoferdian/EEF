# Brand Voice Framework

Adapted from ECC `skills/brand-voice/SKILL.md`, fetched 2026-09-04. ECC's
version defines *what* to extract but leaves the output mostly abstract
("produce a VOICE PROFILE per a schema file"); this version makes the
profile schema and the do/don't + rewrite mechanics concrete and directly
usable, since `marketing-edho-ferdian` doesn't carry ECC's separate schema
file.

## Source priority

Use the strongest real source set available, in this order:

1. Existing repo material — README, CONTRIBUTING, changelog entries, code
   comments with personality, commit messages.
2. Past posts/threads/articles the user has actually written (X, LinkedIn,
   a blog, dev.to, a newsletter).
3. Real outbound messages that worked (an email, a Discord/community post
   that got a good response).
4. Product docs and site copy already live.

**Never invent a voice from adjectives alone** ("make it sound friendly and
professional"). Adjectives without real samples produce generic AI tone —
exactly what this framework exists to avoid.

If the user has no existing material at all (brand new project, first-ever
piece of writing), say so explicitly and default to a documented starting
point (see "No-source default" below) rather than fabricating a voice with
no basis.

## Collection workflow

1. Gather 5-20 representative samples where available. More than 20 rarely
   adds signal for a solo project's voice.
2. Prefer recent material over old, unless the user says older writing is
   more canonical (e.g. a README written years ago that still reflects how
   they want to sound).
3. Separate "public/launch voice" from "working/technical voice" if the
   source set clearly splits into two registers — a project's Twitter
   announcements and its GitHub issue responses may legitimately sound
   different, and conflating them produces a muddled profile.

## What to extract

Go through each sample and note, concretely:

- **Sentence rhythm** — short and punchy, or longer and explanatory?
- **Technical vocabulary level** — does it explain jargon or assume the
  reader already knows it?
- **Claim style** — hedged ("this might help with...") or direct ("this
  fixes X")?
- **Parenthetical use** — frequent asides, or none?
- **Question frequency** — rhetorical questions used as hooks, or avoided?
- **Evidence style** — numbers/mechanisms/specifics, or vibes/adjectives?
- **Humor/informality level** — dry, playful, deadpan, or strictly neutral?
- **Transitions** — do ideas connect explicitly, or jump?
- **What the author never does** — this is as useful as what they do. E.g.
  "never uses exclamation points," "never starts with a question."

## Output: the VOICE PROFILE block

Produce this as a short, reusable block — short enough to paste into any
later copywriting task in the same session:

```text
VOICE PROFILE — <product/person name>

Tone: <2-4 adjectives, each backed by a source example>
Sentence rhythm: <short/punchy | long/explanatory | mixed>
Vocabulary: <plain | technical-assumed | technical-explained>
Claims: <direct | hedged> — evidence style: <numbers/mechanisms | narrative | adjectives (avoid this one)>
Humor: <none | dry | playful> 
Never does: <1-3 concrete things this voice avoids>

DO
- <vocabulary/phrasing pattern, with a real example from source material>
- <...>

DON'T
- <phrase or pattern that breaks this voice, with why>
- <...>

EXAMPLE REWRITE
Before (generic AI tone): "<generic sentence>"
After (this voice):        "<rewritten in the extracted voice>"
```

Include **at least two** DO items, **at least two** DON'T items, and **at
least one** before/after rewrite pair — this is the part that makes the
profile operational rather than descriptive. A profile with only adjectives
("direct, technical, friendly") is not done yet.

### Worked example

```text
VOICE PROFILE — Salak (dependency-graph tool)

Tone: direct, technical, dry
Sentence rhythm: short/punchy, one idea per sentence
Vocabulary: technical-assumed (audience is developers)
Claims: direct — evidence style: numbers/mechanisms ("resolves in O(n log n)", not "blazing fast")
Humor: dry, occasional, never forced
Never does: exclamation points, "excited to announce", hedging on things it's sure of

DO
- Name the mechanism: "uses AST parsing to build the dependency graph" not "smart analysis"
- State limitations plainly: "doesn't handle dynamic imports yet" not burying it in a FAQ

DON'T
- "Revolutionary new way to..." — no product needs this framing, and it reads as filler
- Rhetorical questions as hooks ("Ever wondered how...?") — this voice states, it doesn't ask

EXAMPLE REWRITE
Before (generic AI tone): "We're excited to announce our revolutionary new dependency graph tool that will change how you think about your codebase!"
After (this voice): "Salak builds a real dependency graph from your codebase's AST — so 'what breaks if I delete this file' has an actual answer."
```

## Hard bans (kept from ECC — still correct for almost any voice)

Delete and rewrite any of these regardless of the extracted voice, unless a
source sample genuinely and repeatedly uses one on purpose:

- fake curiosity hooks ("You won't believe...")
- "not X, just Y" as a crutch construction
- "no fluff" (ironic self-reference)
- forced lowercase for aesthetic
- LinkedIn thought-leader cadence
- bait questions with no real answer
- "Excited to share"
- generic founder-journey filler
- corny/overused parentheticals

## No-source default (only when the user truly has nothing yet)

If there is no existing material to derive a voice from, default to this
starting point and say plainly that it's a default, not a derived profile:

- Direct, compressed, concrete.
- Specifics, mechanisms, and numbers beat adjectives.
- Parentheticals used only for genuine qualification, not filler.
- Conventional capitalization.
- Rhetorical questions avoided.
- Tone can be plain, slightly dry — never salesy.

Replace this with a real derived profile as soon as the user has 5+ samples
to work from.

## Positioning statement variants (Step 1 companion)

The core template:

```
[Product] helps [audience] [achieve outcome] by [mechanism]
```

Variants worth trying when the core template feels generic:

- **Contrast framing:** `Unlike [common alternative], [Product] [key
  difference] — so [audience] can [outcome].`
- **Problem-first framing:** `[Audience] waste [specific cost — time/money/
  effort] on [problem]. [Product] [mechanism] instead.`

Pick whichever version reads most concretely for this specific product —
don't run all three as an exercise; one locked positioning statement is the
deliverable.

## Persistence

- Reuse the same confirmed `VOICE PROFILE` across every deliverable in the
  same session — don't re-derive tone per email or per post.
- If the user wants the profile saved for reuse across sessions, write it to
  the project's own location (e.g. `/project-memory/` or a `brand/` folder)
  rather than assuming a global memory surface exists.
