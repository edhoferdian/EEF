# Feature Walkthrough — an orders page in Next.js App Router

One feature built end to end with the patterns from `react.md`,
`composition-and-ux.md` and `accessible-authoring.md`: server data, URL
state for filters, streaming, a mutation with optimistic UI, error and
empty states, and tests. Check the installed Next.js/React versions
(Context7) before copying APIs.

## The feature

Staff page `/orders`: list orders, filter by status and search, mark an
order as shipped.

## File layout

```text
src/app/orders/
├── page.tsx              ← server component: reads searchParams, fetches
├── loading.tsx           ← skeleton shown while page streams
├── error.tsx             ← error boundary (client)
├── actions.ts            ← server actions (mutations)
└── _components/
    ├── Filters.tsx        ← client: writes filters to the URL
    ├── OrdersTable.tsx    ← server-rendered table
    └── ShipButton.tsx     ← client: optimistic mutation
```

## Data on the server, state in the URL

```tsx
// src/app/orders/page.tsx
import { Suspense } from "react";
import { Filters } from "./_components/Filters";
import { OrdersTable } from "./_components/OrdersTable";

type Search = { status?: "pending" | "shipped"; q?: string; page?: string };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Pesanan</h1>
      <Filters />
      {/* key: re-suspend when filters change so the skeleton shows */}
      <Suspense key={JSON.stringify(params)} fallback={<TableSkeleton rows={8} />}>
        <OrdersTable status={params.status} q={params.q} page={Number(params.page ?? 1)} />
      </Suspense>
    </main>
  );
}
```

```tsx
// src/app/orders/_components/OrdersTable.tsx  (server component)
import { listOrders } from "@/lib/orders";
import { ShipButton } from "./ShipButton";

export async function OrdersTable({ status, q, page }: { status?: string; q?: string; page: number }) {
  const { rows, total } = await listOrders({ status, q, page, pageSize: 20 });
  if (!rows.length) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        {q || status ? "Tidak ada pesanan yang cocok dengan filter." : "Belum ada pesanan."}
      </div>
    );
  }
  return (
    <table className="mt-4 w-full text-sm">
      <caption className="sr-only">Daftar pesanan, {total} total</caption>
      <thead><tr><th scope="col">Nomor</th><th scope="col">Pelanggan</th><th scope="col" className="text-right">Total</th><th scope="col">Status</th><th /></tr></thead>
      <tbody>
        {rows.map((o) => (
          <tr key={o.id}>
            <td className="font-mono">{o.number}</td>
            <td className="max-w-[16rem] truncate" title={o.customerName}>{o.customerName}</td>
            <td className="text-right tabular-nums">{formatRupiah(o.total)}</td>
            <td>{o.status === "shipped" ? "Dikirim" : "Menunggu"}</td>
            <td>{o.status === "pending" && <ShipButton orderId={o.id} />}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const formatRupiah = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
```

## Filters write to the URL (shareable, back-button friendly)

```tsx
// src/app/orders/_components/Filters.tsx
"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { useDebouncedCallback } from "use-debounce";

export function Filters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    next.delete("page");                                  // filters reset pagination
    startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  };
  const onSearch = useDebouncedCallback((v: string) => update("q", v), 300);

  return (
    <div className="mt-4 flex gap-2" aria-busy={pending}>
      <label className="sr-only" htmlFor="q">Cari pesanan</label>
      <input id="q" defaultValue={params.get("q") ?? ""} onChange={(e) => onSearch(e.target.value)}
        placeholder="Cari nama atau nomor…" className="h-9 rounded-md border px-3" />
      <label className="sr-only" htmlFor="status">Status</label>
      <select id="status" defaultValue={params.get("status") ?? ""} onChange={(e) => update("status", e.target.value)} className="h-9 rounded-md border px-2">
        <option value="">Semua</option>
        <option value="pending">Menunggu</option>
        <option value="shipped">Dikirim</option>
      </select>
    </div>
  );
}
```

## Mutation with a server action and optimistic UI

```ts
// src/app/orders/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { markShipped } from "@/lib/orders";

export async function shipOrder(_prev: { error?: string } | null, formData: FormData) {
  await requireStaff();                                       // authorise on the server, every time
  const parsed = z.object({ orderId: z.string().uuid() }).safeParse({ orderId: formData.get("orderId") });
  if (!parsed.success) return { error: "Pesanan tidak valid" };
  try {
    await markShipped(parsed.data.orderId);
  } catch {
    return { error: "Gagal menandai pesanan. Coba lagi." };
  }
  revalidatePath("/orders");
  return null;
}
```

```tsx
// src/app/orders/_components/ShipButton.tsx
"use client";
import { useActionState, useOptimistic } from "react";
import { shipOrder } from "../actions";

export function ShipButton({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(shipOrder, null);
  const [shipped, setShipped] = useOptimistic(false);

  return (
    <form action={(fd) => { setShipped(true); return action(fd); }}>
      <input type="hidden" name="orderId" value={orderId} />
      <button type="submit" disabled={pending || shipped}
        className="h-8 rounded-md bg-primary px-3 text-primary-foreground transition-transform active:scale-[0.97] disabled:opacity-60">
        {shipped ? "Dikirim" : "Tandai dikirim"}
      </button>
      {state?.error && <p role="alert" className="mt-1 text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
```

The optimistic state reverts on its own if the action fails, and the
error is announced (`role="alert"`).

## Loading and error states

```tsx
// loading.tsx — same layout dimensions as the table, so nothing jumps
export default function Loading() { return <TableSkeleton rows={8} />; }

// error.tsx
"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="rounded-lg border p-6">
      <p className="font-medium">Daftar pesanan gagal dimuat.</p>
      <button onClick={reset} className="mt-3 underline">Coba lagi</button>
    </div>
  );
}
```

## Tests

```tsx
// ShipButton.test.tsx (React Testing Library; server action mocked)
vi.mock("../actions", () => ({ shipOrder: vi.fn(async () => ({ error: "Gagal menandai pesanan. Coba lagi." })) }));

it("shows the error and re-enables the button when shipping fails", async () => {
  render(<ShipButton orderId="3f1c…" />);
  await userEvent.click(screen.getByRole("button", { name: /tandai dikirim/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/gagal/i);
  expect(screen.getByRole("button", { name: /tandai dikirim/i })).toBeEnabled();
});
```

E2E for the journey (filter → ship → appears under "Dikirim"):
`e2e-testing-edho-ferdian`. Motion and polish of the table, skeleton and
button: `design-engineering-edho-ferdian`.

## Checklist for this kind of page

- [ ] Data fetched on the server; no `useEffect` + `fetch` for initial data.
- [ ] Filters and pagination in the URL.
- [ ] Every mutation authorises on the server and validates input.
- [ ] Loading skeleton matches the final layout; empty and error states exist.
- [ ] Table has a caption, header scopes, tabular numbers, truncation with full value on hover.
- [ ] Optimistic UI rolls back and announces errors.
