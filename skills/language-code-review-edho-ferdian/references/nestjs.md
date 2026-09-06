# Language Lens — NestJS

Adapted from ECC `nestjs-patterns`, fetched 2026-09-06.

**Why this matters for Edho's stack:** NestJS is not a speculative stack in
this ecosystem — it is the framework behind `ghostfolio`, a real project
Edho runs, in an Nx monorepo alongside an Angular frontend. Treat findings
from this lens as production-relevant, not placeholder coverage.

**Detect.** A `@nestjs/core` (or `@nestjs/common`) dependency in
`package.json`, a `nest-cli.json` at the project root, or `@Module`/
`@Controller`/`@Injectable` decorators in files within the review scope. In
the Nx monorepo case, detect per-project (an Nx workspace can host both a
NestJS API project and an Angular app project side by side) — apply this
lens only to the NestJS project's files.

**Boundary — read before flagging anything.** Generic TypeScript/JavaScript
checks (type safety, async correctness, general Node security) stay owned by
`typescript-reviewer`/the general checklist. This lens adds only what is
specific to **Nest's module system, dependency injection, decorator-driven
validation, and its request-pipeline (guards → pipes → interceptors →
filters)**.

**Code placement.** Findings land as **CQ-11 (NestJS-specific anti-patterns)**
in the general report. **NestJS-specific security items live in
`security-review-edho-ferdian/references/language-specific.md` §Node /
NestJS** — this file does not hold its own copy; see that file for the
mass-assignment and response-DTO findings, load it (or delegate to the
skill directly) when reviewing security.

---

## Ground-truth commands

```bash
nest build                    # confirms the project actually compiles under Nest's own build
npx tsc --noEmit              # type-check without emitting, catches DI/typing mistakes
npm test                      # unit tests (Jest, Nest's default)
npm run test:e2e              # request-level tests exercising guards/pipes/filters
nx affected -t test           # in an Nx monorepo (ghostfolio's case): only test what actually changed
nx affected -t lint
```

Do not label a CRITICAL/HIGH finding here [High confidence] without actually
running the relevant command — reading a decorator and assuming its effect
is reasoning, not verification, per this skill's general ground-truth rule.

---

## Lens criteria

### CRITICAL / SEC

- **ORM entity returned directly from a controller with no response DTO or
  serializer** — a route handler returning a Prisma/TypeORM entity instance
  (or an array of them) straight from the service, with no
  `class-transformer`-annotated response class and no `@Exclude()` on
  sensitive fields. This is the **same class of bug** as the FastAPI
  response-model finding already documented in
  `security-review-edho-ferdian/references/language-specific.md` §Python /
  FastAPI ("Password hash or raw token fields present in a response model")
  — don't file this as a new SEC code, cross-reference that entry. The
  Nest-specific trigger is `passwordHash`, `remember_token`, refresh/access
  tokens, or audit columns (`createdBy`, internal notes) present on the
  entity and absent from any declared `@Exclude()`/response-DTO boundary.
  Confirm `ClassSerializerInterceptor` is actually registered (globally or
  on the route) before assuming a bare entity return is unprotected — if
  it's missing entirely, that's the fix.

### HIGH / SEC

- **`ValidationPipe` registered without `whitelist`/`forbidNonWhitelisted`
  on a publicly reachable endpoint** — a global or per-route
  `ValidationPipe` missing either option is instance **SEC-14
  (mass-assignment)**, already generically defined in this ecosystem's
  security checklist. Do not create a new code — cite SEC-14 and name the
  concrete gap: without `whitelist`, extra properties on the request body
  pass straight through to whatever consumes the DTO (commonly an ORM
  `create`/`update` call), letting a client set fields it was never meant to
  control (`role: 'admin'`, `isVerified: true`).

### HIGH

- **Guard enforces coarse authorization but no per-resource ownership check
  runs in the service (IDOR)** — a `@UseGuards(JwtAuthGuard, RolesGuard)`
  confirms *that* the caller is authenticated and holds a role, but the
  service method it guards (`getById(id)`, `update(id, dto)`,
  `delete(id)`) never checks that the record identified by `id` actually
  belongs to (or is otherwise accessible by) the calling user. A
  role-checked but resource-unchecked endpoint lets any authenticated user
  with that role read or mutate another user's record by guessing/
  enumerating IDs. Fix: the service (not the guard, which only sees the
  route-level role/permission) must compare the resource's owner field
  against the authenticated user's id before acting, or filter the query by
  that ownership up front.
- **Module exports its entire provider set** — an `exports: [...]` array
  that re-exports everything the module declares (or omits `exports`
  filtering by using `exports: [UsersModule]`-style umbrella re-exports of
  internal providers) instead of exporting only the providers other modules
  genuinely need. Once every provider is importable from anywhere, the
  module boundary is decorative — nothing stops a distant feature module
  from reaching into another module's internal repository or a helper meant
  to stay private, and the dependency graph collapses toward "everything can
  import everything."

### MEDIUM

- **Business logic implemented in the controller** instead of delegated to
  an injectable service — a `@Controller()` method doing more than parsing
  request input, calling exactly one (or a small, clear sequence of)
  service method(s), and returning the result. Multi-step conditionals,
  direct repository/ORM calls, or manual transaction coordination inside a
  controller method are the tell.
- **A stateful `@Injectable()` left at the default (singleton) scope stores
  per-request state** — Nest's default provider scope is a singleton shared
  across every request on that instance. A service that mutates an instance
  field (a cache of "current user," an in-progress counter, a per-call flag)
  without `@Injectable({ scope: Scope.REQUEST })` leaks state between
  concurrent requests — under load, request A can observe or corrupt state
  written by request B. Fix: either make the provider stateless (pass
  per-call data as arguments/return values only) or explicitly scope it to
  `Scope.REQUEST`.
- **`@Catch()` exception filter swallows the exception without logging it**
  — a filter that formats and returns an error response but never logs the
  original `exception` object (or only logs the already-shaped response)
  loses the stack trace and root cause the moment the response leaves the
  process. This is the Nest-specific instance of the general
  never-catch-to-silence principle in
  `backend-engineering-edho-ferdian/references/error-and-resilience.md` — a
  global `HttpExceptionFilter` is exactly the "one layer that formats a
  response" that file describes, and that layer must still log before it
  formats.
- **No correlation/request id attached to log output** — log lines emitted
  from within a request's lifecycle (controller, service, filter) carry no
  shared identifier tying them to one HTTP request, making it impossible to
  reconstruct a single request's path through logs when multiple requests
  interleave. Look for a request-scoped logger, an interceptor that
  generates/propagates an id (from `x-request-id` or generated fresh), or
  equivalent — its absence is the finding, not any specific implementation
  required.

---

## False-positive traps

- A bare entity return from a controller is **not** a finding if the
  entity's sensitive fields are already marked `@Exclude()` (class-
  transformer) and `ClassSerializerInterceptor` is confirmed registered
  (globally in `main.ts`, or on that specific controller/route) — trace both
  before flagging, don't assume either is missing from the return statement
  alone.
- A module's `exports: [SomeService]` that exports **one** genuinely shared
  provider (e.g. a `UsersService` that `OrdersModule` legitimately needs to
  look up a user) is normal composition, not an "exports everything"
  finding — the finding is about exporting the *entire* provider set or
  routinely re-exporting internals, not about any cross-module export
  existing at all.
- A singleton `@Injectable()` that only holds **injected dependencies**
  (other services, a config object, a repository) as constructor-assigned
  readonly fields is not stateful in the sense this lens cares about —
  the concern is mutable per-request data written during a method call, not
  dependencies wired once at construction.
- `nx affected -t test` returning "no projects affected" is expected on a
  change that only touches an unrelated project in the monorepo (e.g. the
  Angular frontend) — not a sign the NestJS project's tests didn't run.

## Escalate to general domain when…

- The finding is generic TypeScript/Node (type safety, promise handling,
  general secret handling) with no Nest-specific mechanism — that's the
  general TypeScript lens, not this file.
- The finding is about SQL/query correctness or migration safety rather than
  Nest's own DI/module system — that's `database-lens.md` in the general
  skill (if scope also touches SQL/Prisma/TypeORM schema), not this file.
- A performance claim needs load-test/profiler evidence to size real-world
  impact — escalate to `performance-audit-edho-ferdian` per the general
  skill's PERF escalation rule; this lens only establishes the pattern
  exists.
