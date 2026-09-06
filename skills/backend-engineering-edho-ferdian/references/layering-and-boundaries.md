# Layering and boundaries

Ports & adapters, the repository/service split, the composition root, and how
to introduce structure into code that never had any.

## Ports and adapters (hexagonal architecture)

The core idea: **business logic depends on interfaces it defines; nothing
concrete leaks inward.** The direction of dependency is the whole pattern —
get that one arrow right and everything else here is detail.

```
            ┌─────────────────────────────┐
  HTTP  ──► │  Adapter (in)               │
  CLI   ──► │  controller / handler       │
  Queue ──► │                             │
            └───────────┬─────────────────┘
                         │ calls
                         ▼
            ┌─────────────────────────────┐
            │  Application core           │
            │  use cases / services       │
            │  defines PORTS (interfaces) │
            └───────────┬─────────────────┘
                         │ depends on (interface only)
                         ▼
            ┌─────────────────────────────┐
            │  Port: UserRepository        │ ◄── defined BY the core
            │  Port: PaymentGateway        │
            │  Port: EventPublisher        │
            └───────────┬─────────────────┘
                         │ implemented by
                         ▼
            ┌─────────────────────────────┐
            │  Adapter (out)              │
            │  Postgres repo, Stripe SDK, │
            │  SQS publisher              │
            └─────────────────────────────┘
```

- A **port** is an interface owned by the application core, named for what the
  core needs (`UserRepository.findById`), never for the technology behind it
  (`PostgresClient.query`). If the interface name mentions a vendor or a
  protocol, it is not a port — it is a leaked adapter.
- An **adapter** implements a port, or drives the core through one. Adapters
  know about the outside world (HTTP status codes, SQL, a vendor SDK).
  The core never imports an adapter.
- Test the core against a fake/in-memory adapter, not the real database or
  the real payment gateway. If the core's unit tests need a running Postgres,
  the boundary has already leaked.

```typescript
// core/ports/user-repository.ts — owned by the application core
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

// core/use-cases/deactivate-user.ts — depends only on the port
export class DeactivateUserUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('user', userId);
    user.deactivate();
    await this.users.save(user);
  }
}

// adapters/postgres/postgres-user-repository.ts — implements the port
export class PostgresUserRepository implements UserRepository {
  constructor(private readonly db: Pool) {}
  async findById(id: string) {
    const row = await this.db.query('select * from users where id = $1', [id]);
    return row.rows[0] ? User.fromRow(row.rows[0]) : null;
  }
  async save(user: User) {
    await this.db.query(
      'update users set status = $1 where id = $2',
      [user.status, user.id],
    );
  }
}
```

This is framework-agnostic. NestJS gives you DI tokens and modules to wire
the port to the adapter (see below); a plain Express or Fastify app wires it
by hand in a composition root; Python wires it with a container or plain
constructor injection. The pattern is the same — only the wiring mechanism
changes.

## Repository vs service layer

Two different jobs, routinely fused into one class, which is where most
"testing this requires a database" complaints come from.

- **Repository** — translates between the domain model and the storage
  shape. It answers "how do I persist and retrieve a User?" It contains no
  business rules: no "and also send an email", no "and also check the
  quota". A repository's return type is a domain object or a domain
  collection, never a raw row.
- **Service (use case)** — orchestrates one business operation across one or
  more repositories and other ports (payment gateway, event publisher,
  clock). It contains the actual rule: "deactivating a user also revokes
  their API keys and emits a `user.deactivated` event." It has no idea a
  database exists — it only knows about ports.

```typescript
// WRONG — repository doing service work
class UserRepository {
  async deactivate(id: string) {
    await this.db.query('update users set status = $1', ['inactive']);
    await this.emailClient.send(id, 'account-deactivated'); // not this layer's job
  }
}

// RIGHT — service orchestrates, repository only persists
class DeactivateUserService {
  constructor(
    private readonly users: UserRepository,
    private readonly apiKeys: ApiKeyRepository,
    private readonly events: EventPublisher,
  ) {}

  async execute(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('user', userId);
    user.deactivate();
    await this.users.save(user);
    await this.apiKeys.revokeAllFor(userId);
    await this.events.publish('user.deactivated', { userId });
  }
}
```

**Test for a misplaced concern:** if removing all business rules from a
repository method still leaves it doing more than one storage operation, or
if a service method contains a raw SQL string, the layers have merged.

## The composition root

Exactly one place in the application wires concrete adapters to the ports
that services declare. Everywhere else, only interfaces are visible.

- In NestJS, the composition root is distributed but still single-purpose:
  each feature module's `providers` array binds a port token to a concrete
  class, and Nest's DI container does the wiring at boot. The `AppModule`
  (or a per-feature module) is the root; nothing outside module definitions
  should call `new PostgresUserRepository()` directly.
- In a framework without DI, the composition root is a single `bootstrap.ts`
  (or `main.py`, `main.go`) that constructs every adapter, injects them into
  services, and hands the wired service to the HTTP layer. Nothing below
  that file is allowed to `import` a concrete adapter — only the interface.

```typescript
// nestjs: composition happens in the module, not scattered across the app
@Module({
  providers: [
    { provide: 'UserRepository', useClass: PostgresUserRepository },
    { provide: 'EventPublisher', useClass: SqsEventPublisher },
    DeactivateUserUseCase,
  ],
})
export class UsersModule {}
```

```typescript
// no-DI-framework: one composition root, everything below only sees ports
// bootstrap.ts
const db = createPool(env.DATABASE_URL);
const userRepo: UserRepository = new PostgresUserRepository(db);
const events: EventPublisher = new SqsEventPublisher(env.QUEUE_URL);
const deactivateUser = new DeactivateUserUseCase(userRepo, events);

startServer({ deactivateUser /* ...other wired use cases */ });
```

**Symptom of a missing composition root:** `new SomeConcreteAdapter()` shows
up inside a service, a controller, or — worst case — inside another adapter.
Grep for `new Postgres`, `new Stripe`, `new S3` outside the composition root
and the adapter files themselves; every hit is a boundary violation.

## Migration playbook for entangled/legacy code

Most real codebases do not start hexagonal — they start with a controller
that opens a DB connection, calls a vendor SDK, and formats the response, all
in one function. Introducing layering into that code live, without a
rewrite, follows a fixed order:

1. **Freeze the behavior first.** Write characterization tests against the
   entangled code as it exists — inputs and outputs, including its bugs.
   Skipping this step means the refactor cannot prove it preserved behavior.
2. **Extract the port before touching the implementation.** Define the
   interface the entangled code *should* have depended on, matching what it
   currently does exactly (not the ideal shape yet).
3. **Wrap the existing code as the first adapter.** The legacy
   database-and-vendor-call function becomes `LegacyUserRepository
   implements UserRepository`, unchanged internally. This step is pure
   mechanical extraction — no behavior change, characterization tests still
   green.
4. **Move the orchestration logic up into a service**, now that it can take
   the port as a constructor argument instead of reaching for the concrete
   implementation directly.
5. **Only now improve the adapter internals** (better queries, error
   handling, retries) — with the port interface as a stable seam, the
   service and its tests do not need to change while the adapter improves.
6. **Repeat per bounded slice.** Migrate one aggregate/feature at a time.
   Never attempt a whole-codebase layering pass in one PR — a legacy system
   large enough to need this playbook is also large enough that a big-bang
   version will stall out half-refactored and rot in that state.

Do not skip step 1 to "save time." An extraction with no characterization
tests cannot distinguish "I preserved behavior" from "I silently changed
it," and the second one is how a refactor introduces a production bug that
surfaces weeks later.

## Adding a new integration

When a new external dependency needs to enter the system (a payment
processor, a new email vendor, a search index), introduce it through the
same seam rather than calling its SDK directly from wherever it is first
needed:

1. **Name the port from the core's point of view.** `PaymentGateway.charge()`,
   not `StripeClient.createPaymentIntent()`. The port's shape should survive
   swapping the vendor.
2. **Write the adapter against the port**, translating the vendor's request/
   response shapes and error types into the core's domain types and error
   taxonomy (see `references/error-and-resilience.md` — a vendor SDK's raw
   exception must never reach a service or a controller unwrapped).
3. **Wire it in the composition root only.** No feature code should import
   the vendor SDK; only the adapter file and the composition root are
   allowed to.
4. **Fake it for tests.** A `FakePaymentGateway` implementing the same port,
   with deterministic in-memory behavior, is what services and their tests
   depend on — never a mocked SDK client reconstructed per test file.
5. **Isolate configuration.** API keys, base URLs, and vendor-specific
   feature flags live in the adapter's construction (composition root reads
   env, passes config into the adapter constructor), never scattered as
   `process.env.STRIPE_KEY` reads inside business logic.

This is the same shape `data-layer-patterns-edho-ferdian` uses for storage
adapters and `references/llm-pipelines.md` uses for model provider clients —
one port, swappable adapters, composition root wiring. Do not re-derive it
per integration; apply this checklist.

## Anti-patterns

| Anti-pattern | Why it hurts | Instead |
|---|---|---|
| Port named after the vendor (`StripeGateway` as the interface) | Interface is not swappable; "port" is fiction | Name the port for the capability (`PaymentGateway`) |
| Repository method that also sends email/publishes events | Business rule hidden inside storage code, untestable without a DB | Move orchestration to a service |
| `new ConcreteAdapter()` inside a service or controller | Composition root bypassed; can't fake the dependency in tests | Inject the port; wire the concrete class only at the root |
| Whole-codebase layering rewrite in one PR | Stalls out half-done on any legacy system big enough to need this | Migrate one bounded slice at a time, adapter-wrap first |
| Vendor SDK imported directly in feature code | New integration re-litigated every time it's touched; no fake for tests | Vendor SDK only inside its adapter file |
| Refactor with no characterization tests first | Cannot tell "preserved behavior" from "silently changed it" | Freeze behavior with tests before extracting a port |

## Provenance

Adapted from general industry practice (ports & adapters / hexagonal
architecture, repository pattern, composition root) and NestJS's own module/
DI conventions — see `skills/backend-engineering-edho-ferdian/SKILL.md`
provenance note for comparison of house style. No single ECC agent covers
this topic; framework-specific wiring here follows `references/nestjs.md` in
this same skill.
