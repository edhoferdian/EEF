# Language Lens — Java / Spring Boot (+ Quarkus)

Adapted from ECC `springboot-patterns`, `java-coding-standards`,
`springboot-tdd`, `springboot-verification`, and the Spring/Quarkus review
rules embedded in ECC's `java-reviewer` agent, fetched 2026-09-07.

**Detect.** A `pom.xml`, `build.gradle`, or `build.gradle.kts` at the project
root, or any `.java` file in scope. Determine the framework from the build
file **before** applying any criterion below:

- Build file contains `spring-boot` → apply the **[SPRING]**-tagged criteria.
- Build file contains `quarkus` → apply the **## Quarkus** section below
  (which itself only lists what's *different* from Spring — read the base
  section first regardless of framework, since ~85% of the idiom/testing
  content is shared).
- Both present (unlikely, but not impossible in a multi-module repo) → apply
  both, scoped to the module that actually depends on each.
- Neither detected → apply only the framework-agnostic Java idiom criteria
  and say so explicitly; don't guess Spring- or Quarkus-specific findings
  without the manifest evidence.

**Boundary — read before flagging anything.** Generic injection (SQL/command/
path traversal via string concatenation), generic secret handling, generic
function-length/nesting/magic-number checks, and generic N+1 detection are
**already owned by `references/review-checklist.md`** in the general skill.
This lens adds only what is specific to **Java's language idioms, Spring
Boot's/Quarkus's layered-architecture conventions, and JPA/Panache
correctness** — the same boundary rule every other file in this directory
states at its own top.

**Code placement.** Findings land as **CQ-11 (Java/Spring idiom and
architecture anti-patterns)** in the general report. **Security items have
already been ported and live in `security-review-edho-ferdian/references/
language-specific.md` §"Java / Spring Boot [DEFERRED]"** (from D-012),
Quarkus included as that section's own sub-section — do not re-author SQL
injection via native `@Query` concatenation, missing `@PreAuthorize`/
`@RolesAllowed`, weak `PasswordEncoder`, wildcard CORS + credentials, or CSRF
handling here. Load that file (or delegate to `security-review-edho-ferdian`
directly) when a review needs the security depth for this stack.

---

## Ground-truth commands

```bash
# Confirm the framework first
cat pom.xml 2>/dev/null || cat build.gradle 2>/dev/null || cat build.gradle.kts 2>/dev/null

# Build & verify (both frameworks)
./mvnw verify -q            # or: mvn -T 4 clean verify -DskipTests
./gradlew check             # or: ./gradlew clean assemble -x test

# Static analysis
./mvnw checkstyle:check spotbugs:check pmd:check
./gradlew checkstyleMain spotbugsMain pmdMain

# Tests + coverage
./mvnw test && mvn jacoco:report
./gradlew test jacocoTestReport

# Dependency CVEs (confirms security-lens findings, doesn't replace them)
mvn org.owasp:dependency-check-maven:check
./gradlew dependencyCheckAnalyze

# Framework-detection greps used below
grep -rn "@Autowired" src/main/java --include="*.java"   # [SPRING] field-injection smell
grep -rn "@Inject" src/main/java --include="*.java"      # [QUARKUS] CDI injection point
grep -rn "FetchType.EAGER" src/main/java --include="*.java"
grep -rn "@Singleton" src/main/java --include="*.java"   # [QUARKUS] non-proxyable smell
```

Do not label a `checkstyle`/`spotbugs`/`pmd`-detectable finding as [High
confidence] without actually running the tool — reading the line and
recognizing the pattern is reasoning, not verification, per the general
skill's Phase 2 rule.

---

## Lens criteria

### CRITICAL — Error handling (both frameworks)

- **Swallowed exceptions** — an empty catch block, or `catch (Exception e) {}`
  with no logging, no re-raise, no comment explaining the suppression is
  intentional. **CQ-11.**
- **`.get()` on `Optional` without a presence check** — `repository.findById
  (id).get()` ([SPRING]) or `repository.findByIdOptional(id).get()`
  ([QUARKUS]) throws an unhelpful `NoSuchElementException` instead of a
  domain-meaningful 404/`EntityNotFoundException`. Use `.orElseThrow(() ->
  new SomeNotFoundException(...))`. **CQ-11.**
- **No centralized exception handling** — [SPRING]: no
  `@RestControllerAdvice`/`@ControllerAdvice`, exception handling scattered
  per-controller. [QUARKUS]: no `ExceptionMapper<T>` or
  `@ServerExceptionMapper`, scattered per-resource. **CQ-11.**
- **Wrong HTTP status semantics** — `200 OK` with a null body instead of
  `404`, or a creation endpoint missing `201`. **CQ-11.**

### HIGH — Architecture and dependency injection

- **[SPRING] `@Autowired` field injection** — a code smell; constructor
  injection is required (it makes dependencies explicit, immutable, and
  testable without reflection). Flag every field-injected bean, not just the
  first one found, but consolidate into one finding with all locations
  listed per the confidence-floor rule below. **CQ-11.**
- **[QUARKUS] Bare CDI field expecting injection without `@Inject`, or
  `@Singleton` used where `@ApplicationScoped` is intended** — `@Singleton`
  beans are not proxied, which breaks lazy initialization and interceptor
  chains (`@Transactional`, `@Retry`, custom interceptors silently do
  nothing). Prefer `@ApplicationScoped` unless there's a documented reason
  the bean must never be proxied. **CQ-11.**
- **Business logic living in the controller/resource layer** instead of
  being delegated to a service — the controller/resource should orchestrate
  (parse request, call service, shape response), not implement domain rules.
  **CQ-11.**
- **`@Transactional` on the wrong layer** — must sit on the service layer,
  never the controller/resource or the repository interface itself.
  [SPRING]: missing `@Transactional(readOnly = true)` on read-only service
  methods (Hibernate skips dirty-checking overhead when it knows the
  transaction is read-only). [QUARKUS]: missing `@Transactional` on a
  mutating Panache active-record call (`persist()`, `delete()`, `update()`
  outside a transactional context throws at runtime, not compile time — this
  is a real, easy-to-miss bug class specific to Panache's active-record
  style). **CQ-11.**
- **JPA/Panache entity returned directly from a controller/resource** —
  leaks the full persistence-layer shape (audit columns, lazy-loaded
  collections that trigger `LazyInitializationException` outside the
  session, internal-only fields) straight into the HTTP response. Use a DTO
  or record projection instead. This is the same defect class already
  flagged for NestJS/FastAPI elsewhere in the security file's Java section —
  cross-reference rather than re-deriving the reasoning. **CQ-11.**

### HIGH — JPA / relational data access

- **`FetchType.EAGER` on a collection association** — the classic Hibernate
  N+1 trigger; prefer `JOIN FETCH` in the query or an `@EntityGraph`/
  `@NamedEntityGraph` scoped to the specific access pattern that needs the
  association loaded. **CQ-11.** (This is JPA's specific mechanism for the
  general skill's N+1 concern — the general checklist doesn't know Hibernate
  fetch-strategy vocabulary, so this lens adds the JPA-specific fix, not the
  N+1 concept itself.)
- **Unbounded list endpoint** — `List<T>` returned with no `Pageable`/
  `Page<T>` ([SPRING]) or no `PanacheQuery.page(Page.of(...))` ([QUARKUS]).
  Every list-shaped endpoint over a table that can grow needs pagination
  from day one. **CQ-11.**
- **`@Query` that mutates data missing `@Modifying`** (and the enclosing
  method missing `@Transactional`) — Spring Data throws at runtime, not
  compile time, if `@Modifying` is absent on an update/delete JPQL query.
  **CQ-11.**
- **`CascadeType.ALL` combined with `orphanRemoval = true`** on a
  relationship where deleting the parent silently deletes children the
  reviewer wouldn't expect — not automatically wrong, but confirm the intent
  is actually "child rows have no independent lifecycle" before approving.
  **CQ-11.**
- **[QUARKUS] Mixing `PanacheEntity`/active-record style with
  `PanacheRepository` style in the same bounded context** — pick one
  convention per module; mixing them makes it unclear where persistence
  logic is supposed to live. **CQ-11.**

### MEDIUM — Java idioms and concurrency

- **Mutable instance fields on a singleton-scoped bean** (`@Service`/
  `@Component` in Spring, `@ApplicationScoped`/`@Singleton` in Quarkus) that
  are non-final and written to after construction — a race condition under
  concurrent requests, since the container hands out one shared instance.
  **CQ-11.**
- **Unbounded async execution** — `@Async`/`CompletableFuture` ([SPRING]) or
  a raw `ExecutorService.submit()` ([QUARKUS]) with no bounded custom
  `Executor`/`ManagedExecutor` — the JDK/Spring default can create unbounded
  threads under load. **CQ-11.**
- **String concatenation in a loop** instead of `StringBuilder`/
  `String.join` — Java-specific performance idiom, same shape as the
  Python lens's string-concatenation-in-a-loop finding but for a different
  root cause (JIT/String immutability, not CPython specifically). **CQ-11.**
- **Raw generic types** (`List` instead of `List<T>`) — loses compile-time
  type safety for no benefit in code written after Java 5. **CQ-11.**
- **`instanceof` + explicit cast where pattern matching (Java 16+) reads
  cleaner** — `if (x instanceof Foo) { Foo f = (Foo) x; ... }` instead of
  `if (x instanceof Foo f) { ... }`. Flag only when the codebase's declared
  Java version actually supports it. **CQ-11.**
- **Null returned from a service method instead of `Optional<T>`** — forces
  every caller to remember a null check with no compiler help. **CQ-11.**
- **[QUARKUS] Blocking call on a reactive/event-loop thread** — JDBC, file
  I/O, or `Thread.sleep()` invoked directly inside a `Uni`/`Multi` pipeline
  or a non-`@Blocking` endpoint blocks the Vert.x event loop for every
  concurrent request being served by that thread, not just the current one.
  Use `@Blocking`, `Uni.createFrom().item(() -> ...).runSubscriptionOn(executor)`,
  or a genuinely reactive client instead. **CQ-11.**
- **[QUARKUS] A shared `Uni`/`Multi` subscribed to more than once** — reactive
  streams are typically not multicast by default; two `.subscribe()` calls
  on the same instance can each re-trigger the underlying work. Use
  `Uni.memoize()` (or an equivalent broadcasting operator) when the same
  computed value needs multiple subscribers. **CQ-11.**

### MEDIUM — Testing conventions

- **[SPRING] `@SpringBootTest` used for what should be a unit test** — boots
  the full application context for a test that only needed a mocked service
  or a `@WebMvcTest`/`@DataJpaTest` slice. Slow test suites are usually this,
  multiplied across many test classes. **CQ-11.**
- **[QUARKUS] `@QuarkusTest` used for a pure unit test** — same problem,
  Quarkus flavor: reserve `@QuarkusTest` for CDI integration tests; a plain
  JUnit 5 + Mockito test (no container bootstrap) is faster and sufficient
  for a service class with mocked dependencies. **CQ-11.**
- **`Thread.sleep()` used in a test to wait for async completion** — flaky
  by construction; use `Awaitility` (`await().atMost(...).until(...)`)
  instead. **CQ-11.**
- **Weak test names** — `testFindUser` instead of
  `should_return_404_when_user_not_found` gives a reviewer nothing to work
  with when the test fails in CI. **CQ-11.**

---

## Quarkus

Read the base section above first — everything not restated here applies
identically to Quarkus. This sub-section covers only what's *different*, per
this ecosystem's design (a Quarkus sub-section inside this file, not a
separate `references/quarkus.md`), and mirrors the sub-section pattern
already set for Quarkus security in `security-review-edho-ferdian/
references/language-specific.md`.

**Detect.** `quarkus` string present in `pom.xml`/`build.gradle(.kts)`.

**What's actually different from Spring Boot:**

- **CDI over Spring's bean model** — `@ApplicationScoped`/`@Singleton`
  instead of `@Service`/`@Component`; `@Inject` instead of `@Autowired`
  (already covered above under Architecture).
- **Panache** as the JPA/MongoDB data-access layer instead of plain Spring
  Data JPA — active-record (`PanacheEntity`) or repository
  (`PanacheRepository`) style; the fetch/pagination/transaction findings
  above already carry the Panache-specific form alongside the Spring one.
- **Reactive-first idioms** (`Uni<T>`/`Multi<T>`, Mutiny) are common in
  Quarkus in a way they're not in typical Spring MVC code — the
  blocking-call-on-event-loop and double-subscription findings above are
  Quarkus-specific because Spring MVC's default thread-per-request model
  doesn't have this failure mode (Spring WebFlux does, but that's the
  minority case in this ecosystem's Spring content so far).
- **Build-time processing over runtime reflection** — Quarkus does most of
  its bean/config wiring at build time (`@RegisterForReflection` is the
  escape hatch for anything still needing runtime reflection, relevant
  mainly for native-image builds). Flag runtime classpath scanning or
  reflection-heavy code that could be replaced by a build-time Quarkus
  extension mechanism as a MEDIUM idiom finding, not a correctness bug.
- **Config**: `@ConfigMapping` (type-safe, validated at build time) or
  `@ConfigProperty` instead of Spring's `@ConfigurationProperties` —
  functionally equivalent, no separate finding needed beyond noting the
  idiom if a review finds ad-hoc `System.getenv()` calls instead.
- **Testing**: `@QuarkusTest` reserved for CDI integration tests (see
  Testing conventions above), `@InjectMock` for replacing CDI beans in that
  context, Dev Services preferred over hand-rolled Testcontainers setup for
  database/Kafka/Redis dependencies in tests — flag a manual Testcontainers
  wiring only when Dev Services would have covered the same need with less
  code, not as a blanket "always use Dev Services" rule.
- **Panache MongoDB** (`PanacheMongoEntity`/`PanacheMongoRepository`) carries
  its own HIGH-severity findings distinct from relational JPA: missing
  codec/BSON annotation on a custom type causing silent serialization
  failure; unbounded `listAll()`/`findAll()` with no `.page(Page.of(...))`;
  querying a field with no supporting index; ambiguous `String` id fields
  without an explicit `@BsonId`/`ObjectId` strategy; using the blocking
  `MongoClient` inside a reactive pipeline instead of `ReactiveMongoClient`;
  and the absence of `ClientSession`-based multi-document transaction
  handling (Panache MongoDB does not auto-manage transactions the way
  Hibernate ORM does — document the consistency guarantee instead of
  assuming one). **CQ-11.**

**Security note:** Quarkus security criteria (`@RolesAllowed`,
`quarkus.http.cors.origins=*`, `X-Forwarded-For`-keyed rate limiting) are
already ported as the Quarkus sub-section of `security-review-edho-ferdian/
references/language-specific.md` §"Java / Spring Boot [DEFERRED]" — do not
re-author them here.

---

## False-positive traps

- `@Autowired` on a `@Configuration` class's `@Bean`-producing method
  parameter (not a field) is a different mechanism (Spring resolves method
  parameters from the context regardless of the annotation being present)
  and is not the field-injection anti-pattern — only flag field-level
  `@Autowired`.
- `@Singleton` in Quarkus used deliberately for a stateless bean that is
  never intercepted and never needs lazy proxying (confirmed by the absence
  of `@Transactional`/`@Retry`/custom interceptors on it) is a defensible
  choice, not automatically a defect — check for interceptor usage before
  flagging.
- `FetchType.EAGER` on a `@ManyToOne`/`@OneToOne` association that is always
  needed alongside the parent (a true 1:1 relationship accessed on every
  read path) is a reasonable default; the N+1 risk is specific to
  `@OneToMany`/`@ManyToMany` collections, not every eager association.
- `List<T>` returned without pagination from an endpoint that is genuinely
  bounded by construction (e.g. a fixed enum-backed lookup table with under
  50 rows that will never grow) is not the unbounded-list finding — check
  whether the underlying table can actually grow before flagging.
- A `@QuarkusTest`/`@SpringBootTest` class that is explicitly testing
  cross-cutting integration behavior (security filter chain, full
  request-to-database round trip) is using the right tool, not the "over-
  scoped test annotation" anti-pattern — the finding is about tests that
  could have been a narrower slice but weren't, not about every full-context
  test.

## Escalate to general domain when…

- The finding is generic SQL/command/path injection via string
  concatenation with no Java-specific nuance — that's the general skill's
  SEC domain.
- The finding is a security-sensitive Spring/Quarkus misconfiguration
  (missing `@PreAuthorize`/`@RolesAllowed`, wildcard CORS + credentials,
  weak password encoder, plaintext secrets) — that's
  `security-review-edho-ferdian/references/language-specific.md` §"Java /
  Spring Boot [DEFERRED]", not this file.
- The finding is about test coverage percentage or test quality in the
  abstract (not a specific idiom listed above) — that's Domain 5
  (`test-quality-lens.md`) in the general skill.
- A performance claim needs profiling/benchmark evidence to confirm — escalate
  to `performance-audit-edho-ferdian` per the general skill's PERF escalation
  rule.
- The JPA/Panache finding is about *designing* a schema, index, or migration
  strategy rather than reviewing existing entity/query code — that's
  `data-layer-patterns-edho-ferdian`'s JPA section (`references/jpa.md`),
  the design-time companion to this review-time lens.

## Provenance

Adapted from ECC `springboot-patterns`, `java-coding-standards`,
`springboot-tdd`, `springboot-verification`, `quarkus-patterns`, and the
Spring/Quarkus review criteria embedded in ECC's `java-reviewer` agent
(`agents/java-reviewer.md`), fetched 2026-09-07, consolidated for this
ecosystem's Java/Spring + Quarkus review lens. Security content
(`springboot-security`/`quarkus-security`) was deliberately **not**
re-ported here — it already lives in `security-review-edho-ferdian/
references/language-specific.md` §"Java / Spring Boot [DEFERRED]" per D-012.
