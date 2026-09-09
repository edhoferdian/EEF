# JPA / Java persistence — design-time patterns

**Boundary — same rule as every other file in this directory.** This is
**design-time** guidance: entity design, relationship shape, and pooling
decisions made *before* code exists. It is not a review lens — an existing
JPA entity/query being audited for correctness belongs to
`language-code-review-edho-ferdian/references/java-spring.md` (the
`## Quarkus` sub-section there covers Panache specifically). If a review
request lands here, point it at that file instead of re-answering it as a
design question. Security-sensitive persistence decisions (row-level
authorization via `@Filter`, credential storage) belong to
`security-review-edho-ferdian`, same split as `postgres.md`.

## When to use this file

- Designing a new JPA entity or its table mapping from scratch.
- Deciding relationship shape (`@OneToMany`/`@ManyToOne`/`@ManyToMany`) and
  its fetch strategy up front, before an N+1 problem exists to review.
- Setting up transactions, auditing, soft deletes, or pagination conventions
  for a new Spring Boot or Quarkus service's data layer.
- Tuning HikariCP connection pooling or deciding whether second-level cache
  is worth the eviction-strategy complexity for a given entity.

## Entity design

Default to `IDENTITY` generation with an explicit unique index on any
natural key (a slug, an external ID) rather than relying on the primary key
alone for lookups:

```java
@Entity
@Table(name = "markets", indexes = {
  @Index(name = "idx_markets_slug", columnList = "slug", unique = true)
})
@EntityListeners(AuditingEntityListener.class)
public class MarketEntity {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 200)
  private String name;

  @Column(nullable = false, unique = true, length = 120)
  private String slug;

  @Enumerated(EnumType.STRING)
  private MarketStatus status = MarketStatus.ACTIVE;

  @CreatedDate private Instant createdAt;
  @LastModifiedDate private Instant updatedAt;
}
```

Enable auditing once, at the configuration level, rather than wiring
`createdAt`/`updatedAt` by hand in every service method:

```java
@Configuration
@EnableJpaAuditing
class JpaConfig {}
```

`@Enumerated(EnumType.STRING)` over the ordinal form is a design-time
decision worth stating explicitly here: `ORDINAL` breaks silently the moment
an enum constant is reordered or inserted mid-list — a schema-design choice
`database-lens.md`'s review side would otherwise have to catch after the
fact.

## Relationships and fetch strategy — decide this at design time

The single highest-leverage decision in this file: **default every
collection association to lazy, and design the fetch path explicitly for
each access pattern that actually needs the association loaded**, rather
than reaching for `FetchType.EAGER` because it's convenient in the entity
definition. This is the design-time half of the N+1 problem —
`language-code-review-edho-ferdian/references/java-spring.md` catches it
after the fact via `EAGER` on a collection; this file's job is to not create
that entity shape in the first place.

```java
@OneToMany(mappedBy = "market", cascade = CascadeType.ALL, orphanRemoval = true)
private List<PositionEntity> positions = new ArrayList<>();
```

- Lazy by default; add `JOIN FETCH` in the specific query that needs the
  association eagerly loaded for that access pattern.
- Avoid `EAGER` on any `@OneToMany`/`@ManyToMany` — a `@ManyToOne`/
  `@OneToOne` that is genuinely needed on every read of the parent is a
  reasonable exception (see the false-positive note in the review lens).
- Prefer DTO/record projections over loading full entity graphs for
  read-heavy list endpoints — decide this at the repository-method design
  stage, not as an afterthought optimization later.

```java
@Query("select m from MarketEntity m left join fetch m.positions where m.id = :id")
Optional<MarketEntity> findWithPositions(@Param("id") Long id);
```

`CascadeType.ALL` + `orphanRemoval = true` is a deliberate lifecycle
decision ("this child table has no existence independent of its parent") —
state that intent in a comment at design time; the review lens will ask
about it later if it isn't obvious from the code.

## Repository design

```java
public interface MarketRepository extends JpaRepository<MarketEntity, Long> {
  Optional<MarketEntity> findBySlug(String slug);

  @Query("select m from MarketEntity m where m.status = :status")
  Page<MarketEntity> findByStatus(@Param("status") MarketStatus status, Pageable pageable);
}
```

Design list-shaped repository methods to return a projection interface when
the caller only needs a subset of columns — deciding this at the repository
signature avoids a later "why is this endpoint loading the full entity"
finding:

```java
public interface MarketSummary {
  Long getId();
  String getName();
  MarketStatus getStatus();
}
Page<MarketSummary> findAllBy(Pageable pageable);
```

## Transactions

- Put `@Transactional` on the service layer, never the repository interface
  or the controller/resource — this is a design convention to establish
  once for the whole codebase, not a per-method decision.
- Use `@Transactional(readOnly = true)` on every read-only service method —
  Hibernate skips dirty-checking overhead when it knows up front the
  transaction won't write.
- Keep transaction scope short — decide the transaction boundary around the
  actual write, not around an entire request handler that also does
  unrelated I/O (external API calls, file access) inside the same
  transaction.

```java
@Transactional
public Market updateStatus(Long id, MarketStatus status) {
  MarketEntity entity = repo.findById(id)
      .orElseThrow(() -> new EntityNotFoundException("Market"));
  entity.setStatus(status);
  return Market.from(entity);
}
```

## Pagination

Design every list-shaped access path with pagination from the start —
retrofitting `Pageable` onto an endpoint already returning `List<T>` is a
breaking API change once clients depend on the unpaginated shape:

```java
PageRequest page = PageRequest.of(pageNumber, pageSize, Sort.by("createdAt").descending());
Page<MarketEntity> markets = repo.findByStatus(MarketStatus.ACTIVE, page);
```

For cursor-style pagination on a high-write table (avoids the page-drift
problem offset pagination has under concurrent inserts), design the query
around `id > :lastId` with a matching sort order from the start rather than
bolting it on later.

## Indexing and performance — decide up front

- Add indexes for every column used in a common filter (`status`, `slug`,
  every foreign key) as part of the entity's initial migration, not as a
  follow-up once a slow query shows up in `EXPLAIN ANALYZE`.
- Design composite indexes to match the actual query shape (`status,
  created_at` for "active items sorted by recency", not two separate
  single-column indexes if the query always filters both together).
- Decide the batch-write strategy (`saveAll` + `hibernate.jdbc.batch_size`)
  before a bulk-import feature ships, not after it times out in production.

## Connection pooling (HikariCP)

Starting point for a typical service — tune against actual measured
concurrency, not a copy-pasted default:

```
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=30000
spring.datasource.hikari.validation-timeout=5000
```

For PostgreSQL LOB columns specifically:

```
spring.jpa.properties.hibernate.jdbc.lob.non_contextual_creation=true
```

## Second-level cache

- The first-level (session/persistence-context) cache is automatic and
  per-`EntityManager` — don't design around keeping entities alive across
  transaction boundaries expecting them to still be cache-fresh.
- Second-level cache is worth the eviction-strategy complexity only for
  entities that are read far more often than written and can tolerate some
  staleness — decide this per-entity, not as a blanket cross-cutting
  concern, and design the eviction/invalidation path (see
  `references/redis.md` if the cache layer is actually Redis-backed rather
  than Hibernate's own second-level cache) before enabling it.

## Migrations

- Use Flyway or Liquibase for every schema change — never rely on
  Hibernate's `ddl-auto` in a production environment; this is a design-time
  decision to make once, at project setup, not per-migration.
- Design migrations to be additive and idempotent by default; see
  `references/migrations.md` for the expand-contract strategy when a change
  isn't naturally additive (renaming/dropping a column that's still in use).

## Testing the data layer at design time

- Design repository tests around `@DataJpaTest` + Testcontainers so the
  test suite exercises the real database engine, not an H2 in-memory
  substitute that silently accepts SQL the production engine would reject.
- Plan to assert SQL efficiency via Hibernate's own query logs
  (`logging.level.org.hibernate.SQL=DEBUG`,
  `logging.level.org.hibernate.orm.jdbc.bind=TRACE`) as part of the test
  strategy for any access path this file's fetch-strategy guidance applies
  to — a passing test that quietly issues N+1 queries is a design gap this
  file exists to prevent.

## Handoff to the review lens

Once this entity/repository/transaction shape exists in code,
`language-code-review-edho-ferdian/references/java-spring.md` is what
reviews it going forward (N+1 via `FetchType.EAGER`, unbounded list
endpoints, `@Transactional` placement, Panache-specific findings for
Quarkus). A schema designed following this file's defaults should not trip
those review findings later — if it does, that's a signal this file's
guidance and the review lens's checklist have drifted and need
reconciling, not that the review lens is wrong.

## Notes

Organized around the design-time/authoring use case this skill's other
reference files already follow (see `references/postgres.md`,
`references/prisma.md` for the same pattern applied to other
engines/ORMs).
