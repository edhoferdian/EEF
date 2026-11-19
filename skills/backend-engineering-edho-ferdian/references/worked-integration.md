# Worked Integration — a WhatsApp notifier, built properly

One new integration through the patterns in `layering-and-boundaries.md`,
`error-and-resilience.md` and `jobs-and-queues.md`: a port, an adapter,
typed errors, retry with backoff, a circuit breaker, structured logs, and
tests that don't touch the network. TypeScript; the shape is the same in
Python or Go.

## 1. The port (what the domain needs, in its words)

```ts
// src/domain/ports/Notifier.ts
export type NotifyResult = { messageId: string };

export interface Notifier {
  orderConfirmed(input: { orderId: string; phone: string; customerName: string; total: number }): Promise<NotifyResult>;
}
```

The domain never imports the provider's SDK or knows about HTTP.

## 2. Typed errors (decide what's retryable once)

```ts
// src/infra/whatsapp/errors.ts
export class NotifyError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly cause?: unknown) { super(message); }
}
export class InvalidRecipient extends NotifyError { constructor(phone: string) { super(`invalid recipient ${phone}`, false); } }
export class ProviderUnavailable extends NotifyError { constructor(cause?: unknown) { super("provider unavailable", true, cause); } }
export class RateLimited extends NotifyError { constructor(readonly retryAfterMs: number) { super("rate limited", true); } }
```

## 3. The adapter (the only place that knows the provider)

```ts
// src/infra/whatsapp/WhatsAppNotifier.ts
import type { Notifier } from "@/domain/ports/Notifier";
import { InvalidRecipient, ProviderUnavailable, RateLimited } from "./errors";

export class WhatsAppNotifier implements Notifier {
  constructor(private readonly cfg: { baseUrl: string; token: string; templateId: string }, private readonly http = fetch) {}

  async orderConfirmed({ orderId, phone, customerName, total }) {
    const to = normalizeIdPhone(phone);                   // 0812… → 62812…
    if (!to) throw new InvalidRecipient(phone);

    let res: Response;
    try {
      res = await this.http(`${this.cfg.baseUrl}/messages`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.cfg.token}`, "content-type": "application/json", "idempotency-key": `order-confirmed:${orderId}` },
        body: JSON.stringify({ to, template: this.cfg.templateId, params: [customerName, formatRupiah(total), orderId] }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (e) {
      throw new ProviderUnavailable(e);                    // network error / timeout
    }
    if (res.status === 429) throw new RateLimited(Number(res.headers.get("retry-after") ?? 1) * 1000);
    if (res.status >= 500) throw new ProviderUnavailable(await res.text());
    if (res.status === 400) throw new InvalidRecipient(phone);
    if (!res.ok) throw new ProviderUnavailable(`unexpected ${res.status}`);
    const body = (await res.json()) as { id: string };
    return { messageId: body.id };
  }
}

export function normalizeIdPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const n = digits.startsWith("0") ? "62" + digits.slice(1) : digits;
  return /^628\d{8,11}$/.test(n) ? n : null;
}
```

## 4. Retry with backoff — only for retryable errors

```ts
// src/infra/resilience/retry.ts
export async function retry<T>(fn: () => Promise<T>, opts = { attempts: 5, baseMs: 500, maxMs: 30_000 }): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      if (!e?.retryable || attempt >= opts.attempts) throw e;
      const backoff = Math.min(opts.maxMs, opts.baseMs * 2 ** (attempt - 1));
      const wait = e.retryAfterMs ?? backoff * (0.5 + Math.random());   // full jitter
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}
```

## 5. Circuit breaker — stop hammering a provider that's down

```ts
// src/infra/resilience/breaker.ts
export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  constructor(private readonly threshold = 5, private readonly coolDownMs = 30_000) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.failures >= this.threshold && Date.now() - this.openedAt < this.coolDownMs) {
      throw new ProviderUnavailable("circuit open");
    }
    try {
      const out = await fn();
      this.failures = 0;
      return out;
    } catch (e: any) {
      if (e?.retryable) {
        this.failures++;
        if (this.failures === this.threshold) this.openedAt = Date.now();
      }
      throw e;
    }
  }
}
```

(Libraries such as `opossum` do this with metrics; the point is the
behaviour: fail fast while the provider is down, probe after the cool-down.)

## 6. Run it from a job, not the request

```ts
// src/jobs/sendOrderConfirmation.ts  (called by the queue worker / outbox poller)
export function makeSendOrderConfirmation(deps: { notifier: Notifier; breaker: CircuitBreaker; log: Logger }) {
  return async (job: { orderId: string; phone: string; customerName: string; total: number }) => {
    const log = deps.log.child({ job: "send-order-confirmation", orderId: job.orderId });
    try {
      const { messageId } = await retry(() => deps.breaker.run(() => deps.notifier.orderConfirmed(job)));
      log.info({ messageId }, "order confirmation sent");
    } catch (e: any) {
      log.warn({ err: e.message, retryable: e.retryable }, "order confirmation failed");
      if (e.retryable) throw e;            // let the queue retry later
      // non-retryable (bad phone): record and stop — retrying won't help
      await markNotificationFailed(job.orderId, e.message);
    }
  };
}
```

Structured logs carry IDs, never the token or the full phone number.

## 7. Wiring (composition root)

```ts
// src/main.ts
const notifier = new WhatsAppNotifier({ baseUrl: env.WA_BASE_URL, token: env.WA_TOKEN, templateId: env.WA_TEMPLATE_ORDER });
const sendOrderConfirmation = makeSendOrderConfirmation({ notifier, breaker: new CircuitBreaker(), log });
queue.process("order-confirmation", sendOrderConfirmation);
```

Config is validated at startup (zod over `process.env`) so a missing token
fails the deploy, not the first order.

## 8. Tests without the network

```ts
// adapter: a fake fetch drives each provider response
it("maps 429 to RateLimited with retry-after", async () => {
  const http = vi.fn(async () => new Response("", { status: 429, headers: { "retry-after": "2" } }));
  const n = new WhatsAppNotifier(cfg, http as any);
  await expect(n.orderConfirmed(order)).rejects.toMatchObject({ retryable: true, retryAfterMs: 2000 });
});

it("sends an idempotency key per order", async () => {
  const http = vi.fn(async () => Response.json({ id: "m1" }));
  await new WhatsAppNotifier(cfg, http as any).orderConfirmed(order);
  expect(http.mock.calls[0][1].headers["idempotency-key"]).toBe(`order-confirmed:${order.orderId}`);
});

// job: a fake port, no adapter at all
it("does not retry an invalid phone", async () => {
  const notifier = { orderConfirmed: vi.fn(async () => { throw new InvalidRecipient("12"); }) };
  await makeSendOrderConfirmation({ notifier, breaker: new CircuitBreaker(), log: silentLog })(order);
  expect(notifier.orderConfirmed).toHaveBeenCalledTimes(1);
});

it.each(["081234567890", "+62 812-3456-7890", "6281234567890"])("normalises %s", (raw) => {
  expect(normalizeIdPhone(raw)).toBe("6281234567890");
});
```

## Checklist for any new integration

- [ ] Port in domain terms; SDK/HTTP only in the adapter.
- [ ] Errors classified retryable vs not, once, in the adapter.
- [ ] Timeouts on every call; retry with jitter; breaker for outages.
- [ ] Idempotency key so retries can't double-send.
- [ ] Runs in a job/outbox, not inside the user's request.
- [ ] Config validated at startup; secrets never logged.
- [ ] Tests for each provider response class, with fakes.
