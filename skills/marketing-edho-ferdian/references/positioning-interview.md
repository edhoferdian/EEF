# Positioning Interview

Adapted from ECC `brand-discovery` (SKILL.md + 8 reference modules), fetched
2026-09-06.

## When this file actually gets used

**Trigger: only when `brand-voice-framework.md` hits its "No-source default"
branch** — a genuinely new project or product with zero existing writing to
extract a voice from (no README, no past posts, no docs, no outbound
messages). If there is *any* real material to mine, go back to
`brand-voice-framework.md`'s normal Source priority / Collection workflow
instead — a derived voice from real samples always beats an interviewed one.

This is **not** a default step for every marketing request, not a
replacement for Step 1 of `SKILL.md` on a product that already has
positioning, and not something to run because a request merely mentions
"branding." Run it only when there is nothing to derive from and Edho needs
to articulate the brand identity from scratch, through conversation.

## What ECC's version does differently (and why this file drops it)

ECC's `brand-discovery` is written for an agency running a multi-week,
multi-founder client engagement: it persists interview state to
`modules/{file}.md` + `state.json` on disk, supports several founders being
interviewed separately before a "reconciliation pass," and frames the output
as a brandbook used to **brief external designers, writers, and
collaborators**. None of that fits here:

- **No multi-founder reconciliation.** Edho is the only participant. ECC's
  divergence/convergence mechanism across `founders/{name}.md` files is
  dropped entirely.
- **No `state.json` + path-validation machinery.** `dev-kickoff-edho-ferdian`
  already has its own Session Snapshot mechanism for resuming work across
  sessions — duplicating a second checkpoint format here would fork state in
  two places. If this interview spans multiple sessions, resume it the same
  way any other in-progress deliverable resumes in this ecosystem: pick the
  conversation back up and re-read what was written so far.
- **One file, six modules, not eight files.** ECC ships each module as its
  own file under `references/` (`10_purpose-why.md` … `90_SYNTHESIS.md`).
  For a single-person interview that's unnecessary ceremony — this file
  holds all six modules plus the closing synthesis section.
- **No "brief an external agency" framing.** The audience for this interview
  is Edho himself, being interviewed by the assistant. The output feeds
  `brand-voice-framework.md`'s `VOICE PROFILE` and `SKILL.md` Step 1's
  positioning statement — not a document handed to a hired designer.
- **Module 70 (Founder Brand vs Organisation Brand) is dropped.** ECC's
  Module 70 exists to manage the tension between a founder's personal
  reputation and an institution that might one day operate independently of
  them — a scaling question for a firm with staff. For a solo developer
  whose projects *are* an extension of his own name, that tension mostly
  doesn't exist yet; when it eventually does (e.g. a project outgrows being
  "an Edho Ferdian thing"), that's a fresh, separate conversation, not
  something to force into this interview.

What's kept because it's genuinely load-bearing: one-question-at-a-time
discipline, laddering, 5 Whys, thin-answer detection, the three projective
techniques (verified against ECC's actual wording below — they hold up),
the saturation signal, and the Raw/Synthesis split per module.

## Language

Run the actual interview in **Bahasa Indonesia** — this is a strategy
conversation with Edho, per `SKILL.md`'s language routing rule. Quote his
answers verbatim in whatever language he actually used (don't translate
quotes in the Raw section — translation there would corrupt the source
material). Field names and the final `VOICE PROFILE` / positioning-statement
templates stay in English, since those are reusable structures consumed by
other reference files.

---

## Interview discipline

Apply these throughout every module, not just the first:

1. **One question at a time.** Never present a list of questions, even
   grouped as "a few quick ones." A list produces checklist answers, not
   real insight.
2. **After each answer:** give a short paraphrase, then either ask one
   deepening probe or close the thread if it's saturated. Never move to the
   next question silently — the paraphrase is what lets Edho correct a
   misread before it gets baked into the synthesis.
3. **Laddering** — for every "what" answer, ask "kenapa itu penting buat
   kamu?" (why does that matter to you?) and repeat on the answer to *that*,
   typically **2-4 iterations**, until a core value surfaces instead of a
   surface-level feature or preference.
4. **5 Whys** — specifically for positioning claims and beliefs ("developer
   tools should be free," "this needs to feel serious, not playful"). Push
   past the first justification to the root reason. This is stricter than
   laddering: laddering climbs toward a value, 5 Whys interrogates whether a
   *claim* actually holds up when traced to its root, surfacing the
   assumption underneath it.
5. **Detect thin answers.** If a response is generic, jargon-heavy, or
   could apply to any product in the category ("developer-friendly,"
   "just works," "clean and modern"), don't accept it — ask for one concrete
   example, a specific moment/story, or a number. "Kasih contoh konkretnya
   dong" is a legitimate full turn on its own.
6. **Projective techniques** — use **one per module, at most**, to break a
   plateau when answers have gone abstract or Edho is visibly reaching for
   generic descriptors. Don't run all three in one module; pick whichever
   fits where the conversation stalled:
   - *Brand-as-person entrance:* "Kalau brand/proyek ini orangnya, gimana
     dia masuk ke ruangan?"
   - *Brand obituary:* "Kalau proyek ini berhenti lima tahun lagi, apa yang
     bakal dirindukan orang? Apa yang bakal kamu sesalkan nggak pernah
     kamu bilang/bikin?"
   - *Competitive contrast:* "Sebutin satu proyek/tool yang kamu kagumi tapi
     nggak mau jadi kayak itu — apa persisnya yang salah di situ?"
7. **Saturation signal.** When two consecutive probes in a row produce no
   new information, stop pushing — summarize what's there and close the
   module. Forcing a third probe past saturation produces restated answers,
   not new ones.
8. **Close every module the same way:** write `## Raw` (verbatim quotes,
   exact language, no paraphrase) and `## Synthesis` (your interpretation —
   2-3 candidate formulations, open questions, and any contradiction this
   answer creates with an earlier module) before moving on.

---

## Module 1 — Purpose / Why

*Frameworks: Sinek Golden Circle, Lencioni organisational purpose.*

Goal: surface the founding conviction — why this project/brand exists
independent of what it sells or how it's built. Not the elevator pitch.

Question bank (ask one at a time, follow with laddering on each):
- Kenapa proyek ini ada? Apa yang bikin kamu mulai, bukan yang lain?
- Apa nilai yang kamu pegang waktu bikin keputusan soal proyek ini, bahkan
  kalau nggak ada yang lihat?
- Ada hal yang proyek ini *menolak* untuk jadi atau lakukan, walau itu bisa
  lebih menguntungkan?
- Ada satu kalimat yang pernah kamu ucapkan/tulis soal proyek ini yang masih
  kamu pegang sampai sekarang?

### Raw

<!-- Verbatim quotes, exact language, speaker is always Edho. -->

### Synthesis

<!-- 2-3 candidate Why formulations, open questions, how this constrains
     Module 2 positioning. -->

---

## Module 2 — Positioning

*Frameworks: Dunford "Obviously Awesome," Moore crossing-the-chasm template,
jobs-to-be-done.*

Goal: define the competitive frame — who it's for, what category it
competes in, what it does uniquely, why the target user cares. This feeds
`SKILL.md` Step 1 item 2 directly.

Question bank:
- Siapa target user-nya, spesifik — bukan "developer," tapi situasi macam
  apa yang mereka lagi hadapi?
- Kalau proyek ini nggak ada, gimana orang biasanya nyelesain masalah ini
  sekarang? (termasuk "manual," "pakai script sendiri," atau "nggak
  diselesain sama sekali" sebagai jawaban valid)
- Apa yang bikin proyek ini beda dari cara-cara itu?
- Dari semua yang proyek ini bisa lakukan, mana yang paling penting buat
  target user — bukan buat kamu sebagai pembuatnya?
- Ada metafora atau cara kamu ngejelasin proyek ini secara natural ke orang,
  yang belum pernah kamu tulis di mana pun?

Apply 5 Whys on any positioning claim that sounds asserted rather than
demonstrated ("ini lebih cepat," "ini lebih simpel").

### Raw

### Synthesis

**Positioning statement draft (Dunford template):**
> For **[target user]** who **[situation/JTBD]**, **[project]** is the
> **[category]** that **[unique value]**. Unlike **[alternatives]**, it
> **[key differentiator]**.

Also try the two variants from `brand-voice-framework.md` if the Dunford
template reads generic:
- Contrast framing: `Unlike [alternative], [Product] [difference] — so
  [audience] can [outcome].`
- Problem-first framing: `[Audience] waste [cost] on [problem]. [Product]
  [mechanism] instead.`

<!-- 2-3 alternative framings, white-space hypothesis, open questions,
     tensions with Module 1. -->

---

## Module 3 — Audience & Niche

*Frameworks: Baker "Business of Expertise," Ideal Client Profile,
pain/trigger/desired-outcome.*

Goal: make the target audience concrete enough to actually write copy for —
a specific situational portrait, not a demographic sketch.

Question bank:
- Bayangin satu orang spesifik yang bakal paling diuntungkan proyek ini —
  siapa dia, situasinya kayak apa?
- Apa yang bikin orang itu mulai nyari solusi kayak ini? (momen/trigger-nya)
- Dia udah pernah coba apa sebelumnya, dan kenapa itu nggak cukup?
- Kalau dia berhasil pakai proyek ini, hasilnya kayak apa — dalam kata-kata
  dia sendiri, bukan istilah teknis kamu?
- Ada tipe user yang justru **bukan** target — yang kamu nggak mau proyek
  ini dipakai buat use case mereka?

### Raw

### Synthesis

| Dimension | Description |
|---|---|
| Role / situation | |
| Trigger situation | |
| Primary pain | |
| Desired outcome | |
| Red-flag / not-for | |

<!-- Psychographic portrait (2-3 sentences), niche hypothesis, open
     questions feeding back into Module 2. -->

---

## Module 4 — Personality & Archetype

*Frameworks: Mark & Pearson 12 brand archetypes, J. Aaker 5 brand
personality dimensions.*

Goal: establish character — how the brand would behave if it were a person.
This is what makes a hundred small tone decisions automatic later instead
of re-litigated per piece of copy.

Question bank (this is the module where a projective technique earns its
keep fastest):
- *Brand-as-person entrance* (projective): kalau proyek ini orangnya, gimana
  dia masuk ke ruangan?
- Tiga kata yang paling natural buat gambarin karakter proyek ini?
- Dari 12 archetype ini, mana yang paling langsung "klik"? — *Creator,
  Caregiver, Ruler, Jester, Regular Person, Lover, Hero, Outlaw, Magician,
  Innocent, Sage, Explorer*
- *Competitive contrast* (projective, if archetype answer feels generic):
  sebutin satu proyek yang kamu kagumi tapi nggak mau proyek ini jadi kayak
  itu — apa persisnya yang salah?
- Gimana perasaan yang mau ditinggalkan ke orang yang pakai ini — bukan apa
  yang mereka pikirkan, tapi apa yang mereka *rasain*?

### Raw

### Synthesis

| | |
|---|---|
| **Primary archetype** | (name + 1-line why) |
| **Shadow / what to avoid becoming** | |

| Aaker dimension | Score 1-5 | Evidence |
|---|---|---|
| Sincerity | | |
| Excitement | | |
| Competence | | |
| Sophistication | | |
| Ruggedness | | |

<!-- 2-3 behavioural guidelines derived from the archetype, anti-personality
     list, open questions feeding Module 5 Voice. -->

---

## Module 5 — Voice & Tone

*Frameworks: brand voice spectrum (formal↔casual, serious↔playful,
distant↔warm, conventional↔irreverent), content-type tone matrix.*

Goal: codify the verbal register precisely enough to run straight into
`brand-voice-framework.md`'s `VOICE PROFILE` schema — this module's
synthesis **is** that profile's first draft.

Question bank:
- Ada tulisan (punya kamu atau orang lain) yang kamu suka banget gaya
  nulisnya? Kenapa itu yang klik?
- Ada gaya tulisan yang kamu langsung ilfeel bacanya? Apa persisnya yang
  salah di situ — bukan cuma "norak," tapi elemen konkretnya apa?
- Kata atau frasa yang paling sering kamu pakai kalau ngejelasin hal
  teknis?
- Kata atau frasa yang kamu hindari, sengaja?
- *Brand obituary* (projective, if this module stalls): kalau proyek ini
  berhenti lima tahun lagi, apa yang bakal dirindukan orang dari cara proyek
  ini "ngomong"? Apa yang kamu sesalkan nggak pernah kamu tulis?

### Raw

### Synthesis

| Axis | Position (1-5) | Notes |
|---|---|---|
| Formal ↔ Casual | | |
| Serious ↔ Playful | | |
| Distant ↔ Warm | | |
| Conventional ↔ Irreverent | | |
| Minimal ↔ Expressive | | |

**Draft `VOICE PROFILE`** (fill using the schema from
`brand-voice-framework.md` — this is a first pass from stated preference,
not yet derived from 5+ real samples; flag it as such until real samples
exist):

```text
VOICE PROFILE — <project name> (interview-derived, not yet sample-derived)

Tone: <2-4 adjectives, each backed by an interview answer, not invented>
Sentence rhythm: <short/punchy | long/explanatory | mixed>
Vocabulary: <plain | technical-assumed | technical-explained>
Claims: <direct | hedged> — evidence style: <numbers/mechanisms | narrative | adjectives (avoid this one)>
Humor: <none | dry | playful>
Never does: <1-3 concrete things this voice avoids, from the interview>

DO
- <...>
- <...>

DON'T
- <...>
- <...>

EXAMPLE REWRITE
Before (generic AI tone): "<generic sentence>"
After (this voice):        "<rewritten per this profile>"
```

Replace this profile with a real sample-derived one, per
`brand-voice-framework.md`'s normal workflow, as soon as 5+ genuine writing
samples exist — this interview-derived version is a starting point, not a
permanent substitute.

<!-- Tone-by-content-type notes, the 2-3 checks every draft should pass,
     open questions feeding Module 6. -->

---

## Module 6 — Narrative / Story

*Frameworks: Neumeier trueline, brand story arc (context → conflict →
resolution → invitation).*

Goal: crystallize the founding story and its arc — the conflict the project
resolves, the transformation it delivers, and what it invites people to do.

Question bank:
- Cerita gimana proyek ini mulai — versi yang belum dipolish, bukan versi
  yang biasa kamu ceritain ke orang.
- Ada frustrasi atau masalah spesifik yang bikin proyek ini kerasa perlu
  dibikin?
- Kalau proyek ini berhasil, dunia (atau workflow orang) yang pakai ini
  kelihatan kayak apa?
- Ada satu cerita user/pemakai (nyata, bukan hipotetis) yang paling
  nunjukkin kenapa proyek ini penting?
- Apa yang proyek ini "ajak" orang buat lakuin atau percaya?

### Raw

### Synthesis

**Trueline draft** (Neumeier: "[Project] is the only [category] that
[unique claim].") — offer 2-3 variations at different levels of abstraction.

| Beat | Content |
|---|---|
| Context (world before) | |
| Conflict (what's broken) | |
| Resolution (what the project does) | |
| Invitation (what the user is asked to do) | |

<!-- Frame the project as guide, not hero — what the USER achieves, not
     what the project does for its own sake. Open questions and tensions
     with Modules 1 and 2. -->

---

## Closing synthesis

Once all six modules reach saturation, write this closing section. It does
three things at once: resolves cross-module contradictions, produces the
final deliverables other files consume, and records what's still open.

### Cross-module tensions found

| Tension | Between modules | Resolution |
|---|---|---|
| | | |

### Final deliverable 1 — `VOICE PROFILE`

Carry forward Module 5's draft, revised for any contradiction the later
modules (Personality, Narrative) surfaced. This is what gets pasted into any
later copywriting task per `brand-voice-framework.md`'s Persistence section.

### Final deliverable 2 — Positioning statement

Carry forward Module 2's chosen framing (Dunford, contrast, or
problem-first — whichever read most concrete), revised for anything Modules
3-6 changed. This is the locked positioning statement `SKILL.md` Step 1
requires before any copy gets written.

### Final deliverable 3 — Strategic tension

Fill this directly in the shape `market-and-competitor-research.md` Stage 0
expects, so a later competitive-scan request can consume it without
re-deriving it:

| Field | Value |
|---|---|
| Offer | |
| Target user | |
| Differentiator | |
| Strategic tension | *(two qualities usually traded off, that this project intends to have both of — see examples in `market-and-competitor-research.md` Stage 0)* |

### Open questions deferred

<!-- Anything that couldn't be resolved with the current interview. -->

### Practical next steps

<!-- 3-5 concrete actions — typically: lock the positioning statement, run
     Step 3 copy production, or escalate to the full
     market-and-competitor-research.md if a bigger decision is riding on
     this. -->
