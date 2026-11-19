# Fix Recipes — verify a finding, then the code that fixes it

Companion to `technical-seo-checklist.md`. Each recipe: the command that
proves the problem, and the fix for common stacks (Next.js App Router, plain
HTML). Check the framework's current docs before editing — metadata APIs
change between majors.

## Prove it from the outside

```bash
URL=https://example.com/produk/kopi-arabika

# Status, redirects, canonical headers
curl -sIL "$URL" | grep -iE "^(HTTP|location|x-robots-tag|link)"

# What a crawler gets without JavaScript
curl -s "$URL" -A "Mozilla/5.0 (compatible; Googlebot/2.1)" | grep -iE "<title>|<meta name=\"(description|robots)\"|rel=\"canonical\"|application/ld\+json" | head

# robots.txt and sitemap
curl -s https://example.com/robots.txt
curl -s https://example.com/sitemap.xml | head -40

# Is the main content in the HTML or only rendered client-side?
curl -s "$URL" | grep -c "Kopi Arabika"
```

Zero matches for the product name in raw HTML on a page meant to rank =
client-only rendering finding.

## Titles, descriptions, canonical (Next.js App Router)

```tsx
// app/produk/[slug]/page.tsx
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  return {
    title: `${p.name} — Harga & Spesifikasi | Toko Kopi`,       // ~50–60 chars
    description: p.summary.slice(0, 155),
    alternates: { canonical: `https://example.com/produk/${slug}` },
    openGraph: { title: p.name, description: p.summary, images: [{ url: p.image, width: 1200, height: 630 }], type: "website" },
    robots: p.published ? undefined : { index: false, follow: true },
  };
}
```

Plain HTML:

```html
<title>Kopi Arabika Gayo 250g — Harga & Spesifikasi | Toko Kopi</title>
<meta name="description" content="Kopi Arabika Gayo single origin, roasting medium, 250 gram. Kirim dari Jakarta.">
<link rel="canonical" href="https://example.com/produk/kopi-arabika">
```

## sitemap.xml and robots.txt (Next.js)

```ts
// app/sitemap.ts
import type { MetadataRoute } from "next";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await listPublishedProducts();
  return [
    { url: "https://example.com/", lastModified: new Date() },
    ...products.map((p) => ({ url: `https://example.com/produk/${p.slug}`, lastModified: p.updatedAt })),
  ];
}

// app/robots.ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/keranjang"] }],
    sitemap: "https://example.com/sitemap.xml",
  };
}
```

Sitemap lists only canonical, indexable, 200-status URLs. A URL that is in
the sitemap but `noindex` or redirected is a finding.

## Structured data (JSON-LD)

```tsx
export default async function ProductPage({ params }) {
  const p = await getProduct((await params).slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    image: [p.image],
    description: p.summary,
    sku: p.sku,
    brand: { "@type": "Brand", name: "Toko Kopi" },
    offers: {
      "@type": "Offer",
      url: `https://example.com/produk/${p.slug}`,
      priceCurrency: "IDR",
      price: p.price,
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {/* page */}
    </>
  );
}
```

The `.replace(/</g, "\\u003c")` prevents `</script>` injection from
product text. Validate with Google's Rich Results Test; structured data
must match visible content.

Other common types: `Organization` + `WebSite` (home), `BreadcrumbList`,
`Article`, `FAQPage` (only for real FAQ content), `LocalBusiness` (with
address, `openingHours`, geo for a physical store).

## Two languages (id / en)

```tsx
alternates: {
  canonical: "https://example.com/id/produk/kopi",
  languages: {
    "id-ID": "https://example.com/id/produk/kopi",
    "en-US": "https://example.com/en/products/coffee",
    "x-default": "https://example.com/id/produk/kopi",
  },
},
```

Every language version lists all versions (reciprocal), each with its own
self-canonical. Don't auto-redirect by IP without an alternative link.

## Redirects and duplicate URLs

```ts
// next.config.ts
export default {
  async redirects() {
    return [{ source: "/product/:slug", destination: "/produk/:slug", permanent: true }]; // 308
  },
  trailingSlash: false,
};
```

Pick one host (`www` or apex) and one protocol (https) and 301 the rest.
Parameters for sorting/filters: canonical to the clean URL, or block
crawling of infinite filter combinations.

## Images

```tsx
<Image src={p.image} alt={`${p.name} kemasan 250 gram`} width={800} height={800} sizes="(max-width: 768px) 100vw, 50vw" priority={isAboveFold} />
```

Descriptive `alt`, explicit dimensions (CLS), modern formats, `priority`
only for the LCP image.

## Internal links

- Real `<a href>` links (not `onClick` navigation) to every indexable page.
- Breadcrumbs on deep pages; related products/articles linking sideways.
- Orphan check: every sitemap URL should be reachable by links from the
  home page within ~3 clicks.

```bash
# Crawl a small site and list pages with no inbound internal links (example with a crawler of choice)
npx --yes linkinator https://example.com --recurse --format json > crawl.json
```

## Verification after the fix

```bash
curl -s "$URL" | grep -iE "<title>|canonical|ld\+json"
```

Then: URL Inspection in Google Search Console → "Test live URL" →
"Request indexing" for the key pages. Report the before/after evidence in
the finding.
