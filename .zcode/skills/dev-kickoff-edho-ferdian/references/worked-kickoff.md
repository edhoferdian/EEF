# Worked Kickoff — from a short PRD to the first finished task

A small but complete run, so intake, the decision register, the context
pack and one PLAN → … → IMPROVE loop have a concrete shape. Details of
each artefact live in the other references; this file shows them together.

## Input

```markdown
# PRD — Kasirku (draft)
Goal: a simple point-of-sale web app for one coffee shop.
Users: owner (reports), cashier (sales).
Must: record sales with items and payment method (cash/QRIS); daily sales report;
works on a tablet; Indonesian UI.
Nice: stock alerts.
Constraints: one developer, launch in 4 weeks, budget hosting < Rp200k/month.
```

## Intake — what's missing (ask once, as a list)

```markdown
Before I set up the project, 4 things the PRD leaves open:
1. Offline: must sales still work without internet? (affects the whole architecture)
2. QRIS: confirmation from a gateway, or the cashier just marks it paid?
3. Multi-device: one tablet, or several cashiers at once?
4. Stack preference, or should I choose?
```

User answers: offline not needed; cashier marks QRIS paid; one tablet;
"you choose, I know TypeScript".

## Decision register (`project-memory/01-decision-register.md`)

```markdown
| ID | Decision | Source | Date |
|---|---|---|---|
| D-001 | Online-only web app; no offline sync | User answer 1 | 2026-11-19 |
| D-002 | QRIS marked paid manually by cashier; no gateway integration in v1 | User answer 2 | 2026-11-19 |
| D-003 | Stack: Next.js (App Router) + Postgres (Prisma) on one small VPS | User answer 4 + budget | 2026-11-19 |
| D-004 | Money stored as integer rupiah (no decimals) | Inference: IDR has no minor unit in practice | 2026-11-19 |
```

Open questions go to `02-gap-analysis.md`, not into code.

## Context pack (CLAUDE.md, excerpt)

```markdown
## A. Project identity
Kasirku — POS web app for one coffee shop; owner + cashier roles.
## B. Binding decisions
D-001…D-004 (see register).
## C. Stack (verified)
Next.js 15 App Router, Prisma 6, Postgres 16, Tailwind 4 — versions checked 2026-11-19.
## D. Current state
Stage: setup. No code yet.
## E. Next action
T-01 data model + migration.
```

## Derived plan (`00-plan.md`, first tasks)

```markdown
| ID | Task | Depends | Acceptance |
|---|---|---|---|
| T-01 | Data model: Product, Sale, SaleItem, User | — | Migration applies; seed creates 5 products |
| T-02 | Record a sale (API + cashier screen) | T-01 | Cashier adds items, picks cash/QRIS, sale saved with total |
| T-03 | Daily report | T-02 | Owner sees today's total, by payment method |
| T-04 | Auth with roles | T-01 | Cashier can't open the report |
```

## One loop: T-02 "Record a sale"

### PLAN

Touched surfaces: API route, Prisma, a cashier screen → loads
`api-design`, `data-layer-patterns`, `frontend-engineering` +
`design-engineering` (touched-file table in SKILL.md).

```text
Files: src/app/api/sales/route.ts, src/lib/sales.ts, src/app/kasir/page.tsx
Acceptance: POST /api/sales {items:[{productId,qty}], method} → 201 {id,total}; total computed on the server.
Risk: total trusted from the client → compute server-side (D-004 integer rupiah).
```

### TEST (red)

```ts
// src/lib/sales.test.ts
import { describe, it, expect } from "vitest";
import { createSale } from "./sales";

describe("createSale", () => {
  it("computes the total on the server from product prices", async () => {
    const sale = await createSale(db, { items: [{ productId: kopiSusu.id, qty: 2 }], method: "cash" });
    expect(sale.total).toBe(2 * 18_000);
  });

  it("rejects an empty sale", async () => {
    await expect(createSale(db, { items: [], method: "cash" })).rejects.toThrow(/at least one item/);
  });
});
```

`npx vitest run src/lib/sales.test.ts` → 2 failing (module missing). ✔ red.

### IMPLEMENT (green)

```ts
// src/lib/sales.ts
export async function createSale(db: PrismaClient, input: { items: { productId: string; qty: number }[]; method: "cash" | "qris" }) {
  if (!input.items.length) throw new Error("A sale needs at least one item");
  const products = await db.product.findMany({ where: { id: { in: input.items.map((i) => i.productId) } } });
  const price = new Map(products.map((p) => [p.id, p.price]));
  const total = input.items.reduce((sum, i) => sum + (price.get(i.productId) ?? 0) * i.qty, 0);
  return db.sale.create({
    data: { method: input.method, total, items: { create: input.items.map((i) => ({ productId: i.productId, qty: i.qty, price: price.get(i.productId)! })) } },
  });
}
```

Tests → 2 passing.

### REVIEW

`code-review-edho-ferdian` (or its agent): finding — unknown productId
silently priced at 0. Fixed: throw `Unknown product` + test added.

### VERIFY

```bash
npm run lint && npm run typecheck && npx vitest run && npm run build
```

All green; output pasted in the task note.

### REMEMBER

```markdown
## Session snapshot — 2026-11-19
Done: T-01, T-02 (sale recording; server-side total; unknown products rejected).
Next: T-03 daily report.
Learned: price snapshot stored on SaleItem so reports survive price changes (→ instinct I-001).
```

### IMPROVE

Pattern noticed twice (client-supplied numbers): promoted to the context
pack's rules — "money and totals are always computed server-side".

## What the scorecard checks at the end of the task

- Acceptance met with evidence (test names, command output).
- Decisions used are cited (D-004).
- Memory updated (snapshot, instinct).
- Skipped stages: none — or listed with a reason.
