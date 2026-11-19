# Research Playbook — queries, sources, and a worked example

Practical detail for Phases 1–4 of SKILL.md.

## Pick the lightest path (Phase 1)

| Ask | Path | Tools |
|---|---|---|
| A library/API/CLI fact ("how does X config work") | Docs lookup | Context7 first, then the official docs page |
| One current fact (price, release date, version) | 1–3 targeted searches + open the primary source | WebSearch → WebFetch on the official page |
| Comparison of 2–4 options | Structured comparison | Official docs + pricing pages + 1–2 independent benchmarks |
| Open question / market / trend | Full research | Decompose into 3–6 sub-questions, search each |
| "Is this claim true?" | Fact-check | Find the original source of the claim, then a contradicting source |

Stop at the lightest path that answers. A one-fact question does not get a
report.

## Query patterns that work

```
"<exact product name>" pricing site:<vendor-domain>
"<library>" "breaking changes" <major version>
"<library>" changelog 2026
<topic> filetype:pdf site:.go.id                 # Indonesian regulation, primary source
<topic> site:github.com/<org>/<repo>/issues "<error text>"
"<claim sentence>"                                # find where a quote originated
<topic> benchmark -sponsored                      # then check who ran the benchmark
```

- Search the **current year** for anything that changes (prices, versions,
  limits, laws).
- Search in **both Indonesian and English** for local topics (regulation,
  payment gateways, marketplaces, tax).
- After a search, **open the primary source** — snippets and summaries are
  not evidence.

## Source quality (Phase 2–3)

| Tier | Examples | Use for |
|---|---|---|
| Primary | Official docs, pricing pages, changelogs, RFCs, standards, laws/regulations (JDIH, peraturan.go.id), company filings, the paper itself | Facts and numbers |
| Secondary, accountable | Major news with named authors, vendor-neutral benchmarks with method published, maintainers' blog posts | Context, trends |
| Tertiary | Aggregators, listicles, AI-generated summaries, SEO comparison sites, forum answers | Leads to primary sources only |

Rules of thumb:
- A number without a date is not usable. Note the date you saw it.
- A benchmark without its method and versions is an anecdote.
- Vendor claims about competitors are claims, not facts.
- Two tertiary sources repeating each other are one source.

## Labelling every claim (Phase 4)

| Label | Meaning | Example |
|---|---|---|
| **[sourced]** | Stated by a cited source | The free plan includes N projects and pauses inactive ones [sourced: vendor pricing page URL, date read] |
| **[user-supplied]** | Came from the user's own material | The team already runs Postgres in production [user-supplied] |
| **[inference]** | Your reasoning from sourced facts | Row-level security in Postgres covers the multi-tenant need without extra middleware [inference] |
| **[recommendation]** | What you suggest doing | Prototype both auth flows for one day before deciding [recommendation] |

Never present an inference as sourced. When sources disagree, say so and
show both.

## Comparison matrix template

```markdown
| Criterion (weight) | Option A | Option B | Option C | Evidence |
|---|---|---|---|---|
| Fits current stack (3) | ✔ Postgres | ✖ NoSQL | ✔ | [sourced] docs links |
| Cost at our scale (3) | ~$25/mo | ~$0–45/mo | self-host | [sourced] pricing, 2026-11-19; [inference] for our usage |
| Lock-in (2) | Low (plain Postgres) | High | Low | [inference] |
| Team familiarity (2) | High | Low | Medium | [user-supplied] |
| Weighted score | 26 | 14 | 21 | |
```

Write the weights before scoring, not after.

## Worked example (condensed)

**Ask:** "Riset dulu: Supabase vs Firebase untuk app kasir UMKM, mana yang
cocok?"

1. **Classify:** comparison of 2 options → structured comparison.
2. **Starting material:** user says the app is offline-first on Android
   tablets, 1–3 outlets, team knows SQL [user-supplied].
3. **Sub-questions:**
   - Offline support on Android for each?
   - Pricing at ~50k reads/day, 3 outlets?
   - Data model fit (relational sales, stock)?
   - Indonesian data residency / latency (regions available)?
4. **Search & read primary sources:** Firebase docs (Firestore offline
   persistence), Supabase docs (offline is client-side, e.g. via a local
   DB + sync library), both pricing pages, both region lists.
5. **Cross-check:** a community post claims "Supabase has offline mode" →
   the official docs don't list built-in offline sync → mark the claim as
   unsupported.
6. **Report:** matrix as above, with the downside case ("If offline sync is
   the hardest requirement, Firestore's built-in persistence wins despite
   the NoSQL model") and confidence & gaps ("pricing estimated from list
   prices; real read counts unknown").

## Report checklist (Phase 5)

- [ ] Every number has a source and a date.
- [ ] Every claim carries a label.
- [ ] At least one contrarian/downside paragraph.
- [ ] Gaps named (what you couldn't verify and why).
- [ ] Sources listed with URLs; no source you didn't open.
- [ ] Recommendation answers the original question in one sentence first.
