# Worked Loop — three rounds on a landing page

One full Plan → Generate → Evaluate run, showing the files each phase
writes and how feedback turns into the next round's changes. Phases are
specified in `spec-and-plan.md`, `generate-phase.md` and
`evaluate-phase.md`; this is the same thing with real content.

## Plan — `gan/spec.md` and `gan/rubric.md`

```markdown
# Spec — landing page "Kasirku"
Audience: owners of small coffee shops in Indonesia, on phones.
Goal: sign up for a free trial.
Must: hero with one CTA, 3 benefits, pricing (1 plan), FAQ, footer. Indonesian copy.
Stack: Next.js + Tailwind, no UI kit.
Out of scope: auth, payments.
```

```markdown
# Rubric (pass = every criterion ≥ 7, average ≥ 8)
| Criterion | 10 looks like |
|---|---|
| Clarity | In 5 s a visitor can say what it is and what to do next |
| Visual hierarchy | One focal point per section; CTA is the most prominent element |
| Mobile (390 px) | No horizontal scroll, tap targets ≥ 44 px, text ≥ 16 px |
| Craft | Consistent spacing scale, type scale, no generic AI look |
| Motion | Purposeful, < 300 ms, respects reduced motion (design-engineering) |
| Accessibility | Landmarks, contrast AA, focus visible, alt text |
| Performance | LCP < 2.5 s on mobile (Lighthouse) |
```

## Round 1 — Generate

The generator builds the page and writes `gan/round-1/notes.md` (what was
built, decisions, known gaps). The dev server runs on `localhost:3000`.

## Round 1 — Evaluate (`gan/round-1/feedback.md`)

The evaluator drives the live page in a browser — never reads the
generator's notes first.

```markdown
# Round 1 evaluation — evaluation mode: isolated browser session
| Criterion | Score | Evidence |
|---|---|---|
| Clarity | 6 | Headline "Solusi Modern untuk Bisnis Anda" doesn't say POS or coffee shop |
| Visual hierarchy | 5 | Two equal-weight buttons in the hero ("Coba Gratis", "Pelajari") |
| Mobile | 7 | Pricing card overflows by 12 px at 390 px (screenshot r1-mobile-pricing.png) |
| Craft | 5 | Purple→blue gradient hero, glass cards, emoji icons — generic AI look |
| Motion | 6 | Every section fades in on scroll with 600 ms delay; feels slow |
| Accessibility | 7 | FAQ toggles are divs (not buttons); no focus style |
| Performance | 8 | LCP 2.2 s |
Average 6.3 — FAIL

Top fixes, in order:
1. Headline that names the product and the user ("Kasir untuk kedai kopi, langsung dari HP").
2. One primary CTA in the hero; the second becomes a text link.
3. Replace the gradient/glass/emoji with a flat palette and line icons.
4. Remove scroll fades; keep a single hero entrance ≤ 400 ms.
5. FAQ as <button aria-expanded> with visible focus.
6. Fix pricing card width at 390 px.
```

## Round 2 — Generate (only the feedback, nothing else)

```diff
- <h1>Solusi Modern untuk Bisnis Anda</h1>
+ <h1>Kasir untuk kedai kopi, langsung dari HP</h1>
+ <p>Catat penjualan, terima QRIS, lihat laporan harian. Gratis 30 hari.</p>

- <button>Coba Gratis</button><button>Pelajari</button>
+ <a href="/daftar" className="h-12 rounded-lg bg-stone-900 px-6 text-white">Coba gratis 30 hari</a>
+ <a href="#fitur" className="underline underline-offset-4">Lihat fitur</a>
```

```tsx
// FAQ item
<button aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}
  className="flex w-full justify-between py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2">
```

## Round 2 — Evaluate

```markdown
Clarity 9 · Hierarchy 8 · Mobile 9 · Craft 7 · Motion 8 · A11y 9 · Perf 8 → average 8.3
Every criterion ≥ 7 and average ≥ 8 → PASS.
Optional polish (not required): benefit cards are all the same size/weight — the main benefit could lead.
```

## Stop conditions

- **Pass:** every criterion ≥ 7 and average ≥ 8 → stop, report.
- **Plateau:** two rounds with average change < 0.3 → stop and ask the
  user (the rubric or the spec may be the problem).
- **Budget:** max rounds set in the plan (here 4).

## Final report

```markdown
# GAN harness — Kasirku landing page
Rounds: 2 · Result: PASS (8.3)
| Criterion | R1 | R2 |
|---|---|---|
| Clarity | 6 | 9 |
| Visual hierarchy | 5 | 8 |
| Mobile | 7 | 9 |
| Craft | 5 | 7 |
| Motion | 6 | 8 |
| Accessibility | 7 | 9 |
| Performance | 8 | 8 |
Artifacts: gan/round-*/feedback.md, screenshots, Lighthouse JSON.
Not verified: real-device Safari (evaluated in Chromium mobile emulation).
```
