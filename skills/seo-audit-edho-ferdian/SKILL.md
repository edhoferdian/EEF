---
name: seo-audit-edho-ferdian
description: >-
  Technical + on-page SEO audit workflow — crawl/gather site signals, check
  them against a real technical-SEO checklist (crawlability, indexability,
  structured data, meta tags, sitemap/robots.txt, mobile-friendliness,
  internal linking), severity-rank findings on an indexing-impact ladder, and
  report with fix priority. Use this whenever the user wants an SEO audit;
  whenever they say "audit SEO", "kenapa website ini tidak muncul di
  Google", "cek meta tags", "structured data", "sitemap/robots.txt", "cek
  SEO", "SEO check" — or when reviewing any public-facing web project. Cross-
  references `performance-audit-edho-ferdian` for Core Web Vitals depth
  rather than duplicating it.
---

# SEO Audit — Edho Ferdian Mode

Adapted from ECC `seo-specialist` (agent) and ECC `skills/seo` (skill), fetched
2026-09-04.

You are a **technical SEO auditor**, not a "SEO guru" selling folklore. You
read the actual site — files, rendered HTML, response headers — before saying
anything. Every finding points at a real file, URL, or response; nothing gets
reported from memory or generic best-practice recitation.

## Kenapa skill ini ada

Website yang "tidak muncul di Google" hampir selalu punya penyebab teknis
yang bisa dibuktikan: `robots.txt` memblokir halaman penting, `noindex` tidak
sengaja terpasang, canonical menunjuk ke URL yang salah, atau structured data
rusak. Skill ini mengaudit itu secara sistematis, bukan menebak-nebak.

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract)

- Communication / explanation to the user → **Bahasa Indonesia**.
- Finding report, checklist codes, fix instructions (technical content) →
  **English**, karena ini akan dibaca ulang oleh engineer atau ditempel ke
  issue tracker.
- Strategic framing ("kenapa ini penting buat ranking", prioritas bisnis) →
  boleh Bahasa Indonesia — ini konten strategi, bukan kode. Full contract:
  `skill-authoring-edho-ferdian` §7.

## Workflow overview

```
Phase 0  Scope & signal-gathering       (what can actually be checked?)
Phase 1  Check against categories        → references/technical-seo-checklist.md
Phase 2  Severity-rank findings          (indexing-impact ladder, below)
Phase 3  Reflection gate                 (before finalizing — see below)
Phase 4  Report with fix priority
```

---

## Phase 0 — Scope & signal-gathering

Detect automatically before checking anything:

1. **Site type.** Static site, SSR/SSG framework (Next.js, Nuxt, Astro, etc.),
   SPA, or a live production URL the user gives you. This changes where
   meta tags, `robots.txt`, and structured data actually live in the repo.
2. **What's reachable.**
   - Repo access → read `robots.txt`, sitemap config, route/page files,
     meta-tag components, JSON-LD emission code directly. This is the
     ground-truth path — prefer it.
   - Live URL only → use `WebFetch`/browser tools to fetch the rendered
     page, `robots.txt`, `sitemap.xml`, and view-source HTML. State that
     findings are based on the live response, which may differ from source
     if there's a build step or CDN caching involved.
   - Neither → say so; do not simulate an audit from the user's description
     alone.
3. **Scope size.** Single page → full single-page audit. Whole site → sample
   representative page types (home, a listing/category page, a detail page,
   a blog/article page) rather than crawling every URL, unless the user asks
   for exhaustive coverage.
4. **Note what you could NOT check** (e.g. no access to Search Console data,
   no live rendering available for a JS-heavy SPA) up front — this scopes
   confidence labels in Phase 4, not just an afterthought.

---

## Phase 1 — Check against categories

Run the full checklist in **`references/technical-seo-checklist.md`** — read
it now. Categories, in fix-priority order:

1. **Crawlability & indexability** — `robots.txt`, meta-robots, `noindex`,
   canonical tags, redirect chains, crawl depth.
2. **Structured data (schema.org)** — JSON-LD presence, correctness, and
   fit-to-content per page type.
3. **Sitemap & robots.txt correctness** — syntax, completeness, staleness.
4. **Meta tags & on-page basics** — title tags, meta descriptions, heading
   hierarchy, canonical consistency.
5. **Mobile-friendliness** — viewport meta, responsive layout signals,
   tap-target sizing (indexing is mobile-first, so this is not optional
   polish) (size threshold defined once, canonically, in
   `code-review-edho-ferdian/references/accessibility-lens.md` A11Y-07 —
   WCAG 2.2 SC 2.5.8, 24×24 CSS px minimum).
6. **Internal linking structure** — orphan pages, anchor text quality,
   link equity flow to priority pages.
7. **Core Web Vitals as an SEO signal** — check LCP/INP/CLS **as a ranking
   signal only**; do not re-derive the full performance audit here. If the
   scope needs a real performance investigation (profiling, bundle
   analysis, render-blocking diagnosis), hand off to
   `performance-audit-edho-ferdian` and reference its output instead of
   duplicating the work.

**Evidence is mandatory.** Every finding cites a file path + line, a URL, or
an exact response header/body excerpt. A finding you can't point at is not a
finding yet.

---

## Phase 2 — Severity-rank findings

Use this **indexing-impact ladder** (not ECC's generic Critical/High/Medium —
this one is anchored to what actually blocks search visibility):

| Severity | Meaning | Examples |
|---|---|---|
| **Critical** | Blocks indexing entirely | `robots.txt` disallows a page that must rank; unintended `noindex`; canonical points to a dead/wrong URL; the page 5xx's or infinite-redirects |
| **High** | Significantly hurts ranking/CTR | missing/duplicate title tags on key pages; missing/broken structured data on a page type that should have it; broken canonical chain; large content that's actually unreadable to crawlers (client-only render with no fallback) |
| **Medium** | Best-practice gap | thin content; missing alt text; weak/generic anchor text; orphan pages; keyword cannibalization; suboptimal title/description length |
| **Low** | Minor polish | title a few characters over ideal length; a non-critical page missing a nice-to-have schema type; internal link phrasing that could be more descriptive |

Map each finding to exactly one severity. If a finding could straddle two
levels, pick the higher one and note why in one line — do not create a
"Critical-ish" hedge.

**Confidence labeling** (same discipline as `code-review-edho-ferdian`):
- Confirmed by reading the actual file/response → **[High confidence]**.
- Sound inference, not directly verified (e.g. "likely hurts CTR" without
  Search Console CTR data) → **[Medium confidence]** + what would confirm it.
- Plausible but depends on data you don't have (rank tracking, real search
  volume, competitor SERP behavior) → **[Low confidence] — needs
  verification** with a named data source (Search Console, GSC API, a
  rank tracker) that would close the gap.

---

## Phase 3 — Reflection gate (before finalizing)

Before writing the report, run this check on your own draft — the same habit
`code-review-edho-ferdian` uses, scaled to SEO's specific failure modes:

1. **Evidence** — can I point at the exact file, URL, or response? If not,
   drop it or downgrade to a question for the user.
2. **SEO folklore check** — is this a real technical finding, or a generic
   "add more keywords" / "post more content" platitude with no site-specific
   basis? Delete folklore.
3. **False positive** — could this be intentional (a page deliberately
   `noindex`'d, e.g. a staging route or a thank-you page)? If plausible,
   downgrade and say so instead of flagging it as broken.
4. **Severity calibration** — does this really block indexing (Critical), or
   did I over-escalate a best-practice gap (Medium)? Recalibrate against the
   ladder in Phase 2.
5. **Scope creep into performance-audit territory** — did I start doing a
   full performance investigation instead of citing Core Web Vitals as a
   signal and handing off? Trim back to the signal-level check.
6. **Actionability** — does every finding have a fix an engineer or content
   owner can actually execute, per the seo-specialist quality bar below?

Emit a short **Reflection Notes** block in the final report listing what you
dropped, downgraded, or handed off, and why.

## Quality bar (from ECC seo-specialist, kept as-is — it's good)

- no vague SEO folklore
- no manipulative pattern recommendations (cloaking, doorway pages, keyword
  stuffing, PBNs)
- no advice detached from the actual site structure
- recommendations must be implementable by the receiving engineer or content
  owner, not just "improve your SEO"

---

## Phase 4 — Report with fix priority

Format per finding:

```text
[SEVERITY] Issue title
Location: path/to/file.tsx:42 or https://example.com/page
Issue: What is wrong and why it hurts indexing/ranking/CTR
Fix: Exact change to make
Confidence: [High/Medium/Low confidence] (+ what would confirm it, if not High)
```

Then:

1. **Fix-priority list** — Critical first, then High, sorted within each tier
   by how many pages/URLs a fix touches (a `robots.txt` fix touching the
   whole site outranks a single-page title fix).
2. **Reflection Notes** block (Phase 3 output).
3. **What wasn't checked** — from the Phase 0 scope note (e.g. "Search
   Console data not available — cannibalization findings are inference-only,
   confirm with query-level data before acting").
4. Save the report to the repo, e.g. `./seo-audit-<scope>.md`, and tell the
   user the path — same convention as `code-review-edho-ferdian`.

---

## Global rules

1. **Detect, then check.** Read real files/responses before writing any
   finding.
2. **Evidence or it's not a finding.** Exact file, URL, or response excerpt,
   every time.
3. **Use the indexing-impact ladder**, not a generic severity scale.
4. **Don't duplicate performance-audit-edho-ferdian.** Cite Core Web Vitals
   as a signal; hand off deep performance work.
5. **No folklore, no manipulative patterns.** Every recommendation ties to
   this site's actual structure.
6. **Reflection gate is mandatory** before the report is finalized.
7. **Language routing** as defined above.
8. **Save the report file** at the end.

This skill keeps SKILL.md focused on the workflow and pushes the full
checklist into `references/technical-seo-checklist.md` — read that file at
Phase 1 rather than trying to hold it all in the workflow doc.
