# Technical SEO Checklist

Adapted from ECC `skills/seo` (SKILL.md) and ECC `agents/seo-specialist.md`,
fetched 2026-09-04. Reorganized into the categories `seo-audit-edho-ferdian`
Phase 1 runs in order, with severity hints per item using the ladder in the
main SKILL.md (Critical / High / Medium / Low).

## Principles (kept from ECC, still correct)

1. Fix technical blockers before content optimization — an unindexable page
   ranking well is impossible regardless of content quality.
2. One page should have one clear primary search intent.
3. Prefer long-term quality signals over manipulative patterns.
4. Mobile-first assumptions matter because indexing is mobile-first.
5. Recommendations should be page-specific and implementable — never
   "improve your SEO" without a concrete file/URL and change.

---

## 1. Crawlability & indexability

| Check | Severity if broken |
|---|---|
| `robots.txt` allows all important pages, blocks only genuinely low-value surfaces (admin, internal search, staging) | Critical |
| No important page is unintentionally `noindex` (check both meta-robots tag and `X-Robots-Tag` header) | Critical |
| Canonical tags are self-consistent and non-looping (page A canonicals to B, B doesn't canonical back to A or to C) | Critical |
| No redirect chains longer than two hops | High |
| Important pages are reachable within a shallow click depth (3-4 clicks from home) | Medium |
| No orphan pages that should be discoverable | Medium |
| Preferred URL format is consistent (trailing slash, www vs non-www, http vs https — pick one, canonicalize the rest) | High |
| Multilingual pages have correct `hreflang` if the site is multilingual | High |
| No duplicate URLs competing without canonical control (e.g. `?sort=` query params creating near-duplicate indexable pages) | Medium |

**How to check with repo access:** read `robots.txt` directly, grep for
`noindex` / `<meta name="robots"` / `X-Robots-Tag` across route/page/layout
files, trace canonical tag generation logic.

**How to check with live URL only:** fetch `robots.txt`, fetch the page and
inspect response headers + rendered `<head>`, follow redirects manually to
count hops.

## 2. Structured data (schema.org)

| Page type | Expected schema | Severity if missing/broken |
|---|---|---|
| Homepage / business site | `Organization` or `LocalBusiness` | Medium (High if it's a business relying on local search) |
| Editorial / blog pages | `Article` or `BlogPosting` | High |
| Product pages | `Product` + `Offer` | High |
| Interior/nested pages | `BreadcrumbList` | Low |
| Genuine Q&A content | `FAQPage` — **only** when the on-page content actually matches the marked-up Q&A pairs | High if present-but-mismatched (this is a policy violation risk, not just a missed opportunity) |

Validation checks regardless of type:
- JSON-LD parses as valid JSON (a single syntax error invalidates the whole
  block).
- Required properties for the chosen `@type` are present.
- Marked-up content matches visible on-page content — schema for content
  that isn't actually there is a violation, not just unhelpful (High).

## 3. Sitemap & robots.txt correctness

- `sitemap.xml` (or sitemap index) reflects the intended public surface —
  no `noindex`'d pages listed, no 404/redirect targets listed.
- Sitemap is referenced from `robots.txt` (`Sitemap:` directive) when one
  exists.
- `robots.txt` syntax is valid — no malformed `Disallow`/`Allow` rules that
  accidentally block more (or less) than intended.
- Sitemap `lastmod` dates are not stale/fabricated (a sitemap that always
  says "today" for every URL is a weak signal and worth flagging as Low).
- Sitemap doesn't exceed the 50,000 URL / 50MB single-file limit without a
  sitemap index splitting it.

## 4. Meta tags & on-page basics

**Title tags**
- Present and unique per page (duplicate titles across pages → High).
- Roughly 50-60 characters — primary keyword/concept near the front.
- Legible to humans, not stuffed for bots.
- Formula: `Primary Topic - Specific Modifier | Brand`

**Meta descriptions**
- Present and unique per page (duplicate → Medium).
- Roughly 120-160 characters.
- Describes the page honestly — no bait that doesn't match content.
- Formula: `Action + topic + value proposition + one supporting detail`

**Heading hierarchy**
- Exactly one clear `H1` per page.
- `H2`/`H3` reflect actual content structure, not just visual styling choices.
- No skipped levels used purely for CSS convenience.

## 5. Mobile-friendliness

- Viewport meta tag present and correct (`width=device-width,
  initial-scale=1`) — missing this is Critical, since indexing is
  mobile-first.
- Layout is genuinely responsive at common breakpoints, not just "doesn't
  overflow."
- Tap targets (buttons, links) are large enough and spaced enough to hit
  reliably on a touchscreen.
- No mobile-only content gaps versus desktop (Google indexes the mobile
  version — content hidden on mobile may not be indexed at all).

## 6. Internal linking structure

- Link from strong/high-authority pages toward pages you want to rank.
- Anchor text is descriptive, not generic ("click here", "read more").
- No orphan pages that should be linked from somewhere in the site
  architecture.
- New pages get backfilled with links from relevant existing pages, not left
  isolated until the next content pass.

## 7. Core Web Vitals as an SEO signal (not a full performance audit)

Check these as **ranking-signal-level** checks only. If a real fix requires
profiling, bundle analysis, or render-path investigation, hand off to
`performance-audit-edho-ferdian` and cite this section's finding as the
trigger — don't re-derive the performance workflow here.

| Metric | Threshold | What commonly breaks it |
|---|---|---|
| LCP (Largest Contentful Paint) | < 2.5s | unoptimized hero image/video, render-blocking CSS/JS, slow server response |
| INP (Interaction to Next Paint) | < 200ms | heavy main-thread JS, large event handlers, unoptimized third-party scripts |
| CLS (Cumulative Layout Shift) | < 0.1 | images/ads without reserved dimensions, web fonts causing reflow, injected content pushing layout |

Quick, signal-level fixes worth noting even without a full audit: preload
hero assets, reduce render-blocking work, reserve layout space for
images/embeds, trim heavy third-party JS.

## Keyword mapping (when the audit scope includes content strategy)

1. Define the search intent for the page.
2. Gather realistic keyword variants (not aspirational volume-chasing).
3. Prioritize by intent match, likely value, and competition.
4. Map one primary keyword/theme to one URL — never split intent across
   near-duplicate pages.
5. Detect and flag keyword cannibalization (two+ pages competing for the
   same query).

## Anti-patterns to flag, never to recommend

| Anti-pattern | Correct direction |
|---|---|
| Keyword stuffing | Write for users first; keywords follow naturally |
| Thin near-duplicate pages | Consolidate or genuinely differentiate them |
| Schema for content that isn't actually present | Match schema strictly to reality |
| Content advice without reading the actual page | Always read the real page/file first |
| Generic "improve SEO" output | Tie every recommendation to a specific page or asset |
| Cloaking, doorway pages, PBNs, hidden text | Never recommend — these are policy violations, not "aggressive optimization" |

## Audit finding output shape (reference example)

```text
[HIGH] Duplicate title tags on product pages
Location: src/routes/products/[slug].tsx
Issue: Dynamic titles collapse to the same default string, which weakens
relevance and creates duplicate signals across dozens of product URLs.
Fix: Generate a unique title per product using the product name and primary
category, e.g. `${product.name} - ${product.category} | ${brand}`.
Confidence: [High confidence] — verified by reading the title-generation
logic directly.
```

## Example JSON-LD (Article)

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Page Title Here",
  "author": {
    "@type": "Person",
    "name": "Author Name"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Brand Name"
  }
}
```
