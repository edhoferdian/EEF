# Long-Form Writing — Articles, Guides, Essays, Newsletters

Adapted from ECC `skills/article-writing`, fetched 2026-09-06.

Covers anything longer than a paragraph that is meant to be read on its own:
blog posts, technical guides, tutorials, launch write-ups, essays,
newsletter issues, conference-talk write-ups, and long-form README sections.
`copywriting-patterns.md` covers conversion copy (landing pages, emails);
`platform-content.md` covers short-form social. This file covers the middle,
which is where most of a solo developer's actual reputation is built.

Apply the `VOICE PROFILE` from `brand-voice-framework.md` first. Do not run
a second style-analysis pass here.

## Core rules

1. **Lead with the concrete thing** — the artifact, the output, the number,
   the screenshot, the code, the specific incident. Not the framing.
2. **Explain after the example, never before.** Most AI-written articles
   invert this and lose the reader in paragraph one.
3. **Keep sentences tight** unless the source voice is intentionally
   expansive.
4. **Proof instead of adjectives.** "Resolves a 12k-file graph in 400ms" not
   "blazingly fast".
5. **Never invent facts, credibility, benchmarks, or user evidence.** For a
   solo project with no users yet, say so — it is more credible than an
   invented testimonial and infinitely less costly when someone checks.

## Process

1. **Clarify audience and purpose** in one sentence each before writing
   anything. "For developers" is not an audience.
2. **Build a hard outline where each section has exactly one job.** If you
   cannot state a section's job in five words, it does not have one.
3. **Start each section with proof, artifact, conflict, or example.**
4. **Expand only where the next sentence earns its space.**
5. **Cut anything templated, over-explained, or self-congratulatory.**

## Structure by type

### Technical guide / tutorial
- Open with **what the reader gets** — the end state, ideally shown.
- Every major section carries real code, a real command, or real output.
  A guide with no reproducible output is an essay wearing a guide's clothes.
- State prerequisites and version numbers honestly up front; a tutorial that
  silently assumes a setup is a tutorial that fails for half its readers.
- Include the failure modes you actually hit, not only the happy path. This
  is the single highest-value thing a solo dev's write-up can contain and
  the thing official docs almost never have.
- End with actionable takeaways, not a soft recap of what was just read.

### Essay / opinion
- Start with the tension, the contradiction, or a specific observation —
  never with a definition or a landscape survey.
- One argument thread per section.
- Every opinion answers to evidence. An unfalsifiable claim is a mood.
- Steelman the counterargument in the piece itself, not in a defensive
  paragraph at the end.

### Launch / release write-up
- What it does → why it exists (the specific problem, named) → how it works
  (mechanism, briefly) → what it does *not* do → how to try it.
- The "what it does not do" section is the credibility engine. Skipping it
  is the most common self-inflicted wound in a solo launch post.

### Newsletter issue
- The first screen does real work. No diary preamble.
- Section labels only when they improve scanability.
- Every section adds something new — a recycled section is a reason to
  unsubscribe.

### Post-mortem / debugging write-up
- Symptom → what you believed → why that was wrong → the actual root cause →
  the generalizable pattern → the signal that would catch it next time.
- This shape overlaps `04-instincts.md` entries deliberately: a good instinct
  is the compressed form of a good post-mortem.

## Banned patterns

Delete and rewrite on sight:

- "In today's rapidly evolving landscape"
- "game-changer", "cutting-edge", "revolutionary", "world-class"
- "here's why this matters" as a standalone bridge
- fake vulnerability arcs ("I almost gave up, and then…")
- a closing question added only to juice engagement
- biography padding that does not move the argument
- generic AI throat-clearing that delays the point by two paragraphs
- "let's dive in" / "buckle up" / "the results may surprise you"
- section headings that are questions the section never answers

## Quality gate

Before delivering:

- [ ] Every factual claim traces to a provided source, the repo, or a real
      measurement — nothing invented.
- [ ] The opening paragraph contains something concrete, not framing.
- [ ] Generic AI transitions are gone.
- [ ] Voice matches the `VOICE PROFILE` throughout, including in code
      comments and captions.
- [ ] Every section adds something the previous ones did not.
- [ ] Formatting matches the destination medium (a blog post is not a README
      is not an email).
- [ ] Code blocks are runnable as shown, or explicitly labeled as excerpts.
- [ ] Nothing overpromises what a solo project can support.
