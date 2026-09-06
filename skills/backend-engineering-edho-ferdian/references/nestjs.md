# NestJS — structure, bootstrap, and layering

Adapted from ECC `nestjs-patterns`, fetched 2026-09-06.

**Why this matters for Edho's stack:** unlike most other framework lenses in
this ecosystem, NestJS is not speculative coverage — it is the framework
behind `ghostfolio`, a real project Edho runs, in a monorepo that also hosts
an Angular frontend under Nx. Treat this file as production guidance, not a
placeholder for a future project.

## Project structure

```text
src/
├── app.module.ts
├── main.ts
├── common/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── pipes/
├── config/
│   ├── configuration.ts
│   └── validation.ts
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   ├── dto/
│   │   ├── guards/
│   │   └── strategies/
│   └── users/
│       ├── dto/
│       ├── entities/
│       ├── users.controller.ts
│       ├── users.module.ts
│       └── users.service.ts
└── prisma/ or database/
```

- `common/` holds cross-cutting filters, guards, interceptors, and pipes —
  code that no single feature module owns.
- `config/` holds environment/configuration loading and validation, isolated
  from feature code.
- `modules/<fitur>/` is a vertical slice: controller, service, module
  definition, and — critically — **its own `dto/`**. A DTO belongs to the
  module that owns the resource it shapes, not to a shared top-level `dto/`
  folder that every module reaches into.

**Cross-reference:** "controller tipis, logic di service" is not a
NestJS-specific rule — it is the same framework-agnostic layering principle
`references/layering-and-boundaries.md` states in general terms (thin
adapters at the boundary, logic in the domain/service layer), once that file
is written. This file only maps that principle onto Nest's own vocabulary:
`@Controller()` classes parse HTTP input, call a provider, and return a
response DTO; `@Injectable()` services hold the actual business logic.

```ts
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
}
```

## Bootstrap: one global validation pipe, not per-route repetition

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

The canonical bootstrap registers exactly **one** `ValidationPipe` globally
with `whitelist: true`, `forbidNonWhitelisted: true`, and `transform: true`.
Repeating validation options per route (or per module) is drift waiting to
happen — one route will eventually be added without the same options and
become the hole. `whitelist`/`forbidNonWhitelisted` together are what strip
(and then reject) any property not declared on the DTO — this is also the
mass-assignment defense; see the review-side file
(`language-code-review-edho-ferdian/references/nestjs.md`) for what happens
when it's missing.

## One error envelope: `ClassSerializerInterceptor` + one `HttpExceptionFilter`

Register `ClassSerializerInterceptor` globally (so `@Exclude()`-annotated
entity fields are stripped from every serialized response, not just the ones
a developer remembered to decorate) alongside a single global
`HttpExceptionFilter`:

```ts
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();

    if (exception instanceof HttpException) {
      return response.status(exception.getStatus()).json({
        path: request.url,
        error: exception.getResponse(),
      });
    }

    return response.status(500).json({
      path: request.url,
      error: 'Internal server error',
    });
  }
}
```

The point of a single global filter is a **consistent error envelope** —
every error response, expected or not, has the same shape. **Cross-reference:**
the actual envelope shape (what fields it carries, success/error/pagination
conventions) is `api-design-edho-ferdian`'s call, specifically the response
envelope conventions in `references/rest-conventions.md` — this file only
says "one filter, one interceptor, applied globally," not what the JSON looks
like. Design the envelope there; wire it here.

## Env validation at boot, not at first request

```ts
ConfigModule.forRoot({
  isGlobal: true,
  load: [configuration],
  validate: validateEnv,
});
```

**Cross-reference — do not re-derive this here.** Fail-fast environment
validation at process boot (terminate on invalid/missing config instead of
booting partially and failing lazily on first use) is already the exact
principle harvested from ECC's `mailtrap-email-integration` into
`references/error-and-resilience.md` in this same skill. `ConfigModule.forRoot({ validate })`
is simply Nest's mechanism for that principle — read
`error-and-resilience.md` for the "why," and treat `validate` here as the
"how" in this framework.

## Repository/ORM behind domain-speaking providers

Keep repository or ORM code (Prisma, TypeORM, or a hand-rolled query layer)
behind providers whose method names speak the domain's language
(`findActiveSubscription`, not `findFirst({ where: { ... } })` inlined into a
service). A multi-step write that must succeed or fail as a unit is a
transaction **owned by a service**, not something a controller coordinates
by calling several service methods in sequence and hoping nothing fails
between them — the unit-of-work boundary belongs one layer below the HTTP
adapter.

## Background jobs and event consumers live in their own modules

A queue consumer, a cron handler, or an event listener is not HTTP-triggered
code and does not belong inside a controller — even when it's tempting to
bolt a `@Post('internal/run-job')` onto an existing controller as a shortcut.
Give it its own module (e.g. `modules/jobs/` or a module named after what it
consumes). **Cross-reference:** the operational concerns for this class of
work — idempotency, dead-letter/backfill handling, cron cadence, run
reporting, alerting on silence — are already covered generically in
`references/scheduled-collection.md` (and will be covered more generally
still once `jobs-and-queues.md` exists, per the gap noted in this skill's
`SKILL.md`). This file only says where the code lives inside a Nest app;
those files say how the job itself should behave.
