# Java / Spring Boot (+ Quarkus) — build, compile & startup lens

Adapted from ECC's `java-build-resolver` agent (`agents/java-build-resolver.md`,
which already covers both Spring Boot and Quarkus in one file), plus
`springboot-verification`'s Phase 1/4 build and security-scan commands,
fetched 2026-09-07.

Scope: Maven/Gradle dependency resolution failures, Java compiler errors,
annotation-processor errors (Lombok, MapStruct), Spring application-context
startup failures, bean-wiring errors, and the Quarkus-specific build-time
augmentation failures. You fix the error only — you do not refactor
services, entities, or configuration beyond what the error demands.

## Framework detection (run first)

```bash
cat pom.xml 2>/dev/null || cat build.gradle 2>/dev/null || cat build.gradle.kts 2>/dev/null
```

- Build file contains `spring-boot` → apply the **[SPRING]** rows below.
- Build file contains `quarkus` → apply the **## Quarkus** section (base
  Maven/Gradle diagnostics are shared — only the framework-specific error
  tables differ, per the ~85% overlap this ecosystem already applies to
  Quarkus elsewhere).
- Both present (multi-module repo) → apply both, scoped to the failing
  module.
- Neither detected → use the general Java rows only and say so; don't guess
  framework-specific fixes without build-file evidence.

## Diagnostic commands

Run these in order to localize the error before touching anything:

```bash
# Confirm interpreter/toolchain
java -version
./mvnw --version 2>/dev/null || mvn --version

# Compile first — isolates compiler errors from test failures
./mvnw compile -q 2>&1 || mvn compile -q 2>&1
./gradlew compileJava 2>&1

# Then full build
./mvnw verify -q 2>&1 || mvn -T 4 clean verify -DskipTests 2>&1
./gradlew build 2>&1 || ./gradlew clean assemble -x test 2>&1

# Dependency tree — for resolution conflicts
./mvnw dependency:tree -Dverbose 2>&1 | head -100
./gradlew dependencies --configuration runtimeClasspath 2>&1 | head -100

# Static analysis (confirms a checkstyle/spotbugs/pmd-shaped error is real)
./mvnw checkstyle:check spotbugs:check 2>&1 || echo "not configured"
./gradlew checkstyleMain spotbugsMain 2>&1 || echo "not configured"
```

## Resolution workflow

```
1. Detect the framework (Spring Boot / Quarkus / neither) from the build file
2. ./mvnw compile OR ./gradlew compileJava  -> parse the exact error message
3. Read the affected file                    -> understand context before editing
4. Apply the minimal fix                     -> only what the error demands
5. ./mvnw compile OR ./gradlew compileJava   -> verify the fix
6. ./mvnw test OR ./gradlew test             -> confirm nothing else broke
```

## Dependency resolution (Maven / Gradle)

| Error | Cause | Fix |
|---|---|---|
| `package X does not exist` | Missing dependency or wrong import | Add the dependency to `pom.xml`/`build.gradle`, or fix the import path |
| `cannot access X, class file not found` | Missing transitive dependency | Add the dependency explicitly rather than relying on transitivity |
| `Could not resolve: group:artifact:version` | Missing repository or wrong version coordinate | Add the repository, or correct the version in the POM/Gradle file |
| `The following artifacts could not be resolved` | Private repo auth or network issue | Check repository credentials / `settings.xml` (Maven) or `gradle.properties` (Gradle) |
| `COMPILATION ERROR: Source option X is no longer supported` | Java version mismatch between toolchain and `maven.compiler.source`/`targetCompatibility` | Align the build file's Java version with the actual JDK in use |
| `spring-boot-starter-* not found` | Spring Boot BOM version mismatch in the parent POM | Check `spring-boot-dependencies` BOM version |
| `quarkus-extension-* not found` | Wrong Quarkus BOM version, or extension not declared | Check the `quarkus-bom` version; add via `./mvnw quarkus:add-extension -Dextensions="<name>"` rather than hand-editing the POM |

```bash
# Maven: force a clean re-resolve
./mvnw clean install -U

# Maven: see why a version was chosen
./mvnw dependency:tree -Dverbose | grep -B2 -A2 "<offending-artifact>"

# Gradle: force refresh
./gradlew build --refresh-dependencies

# Gradle: inspect a specific dependency's resolution path
./gradlew dependencyInsight --dependency <name> --configuration runtimeClasspath
```

## Java compiler errors (general, both frameworks)

| Error | Cause | Fix |
|---|---|---|
| `cannot find symbol` | Missing import, typo, or missing dependency | Add the import or the dependency that provides the symbol |
| `incompatible types: X cannot be converted to Y` | Wrong type, missing cast | Add an explicit cast, or fix the declared type at the source |
| `method X in class Y cannot be applied to given types` | Wrong argument types or count | Fix the call site's arguments, or check for an overload mismatch |
| `variable X might not have been initialized` | Uninitialized local variable on some code path | Initialize the variable before the first use, on every path |
| `non-static method X cannot be referenced from a static context` | Instance method invoked statically | Create an instance, or make the method `static` if that's actually correct |
| `reached end of file while parsing` | Missing closing brace | Add the missing `}` — usually visible by re-indenting the file |
| `Annotation processor threw uncaught exception` | Lombok/MapStruct misconfiguration | Verify the annotation processor is registered (see below), not just present as a dependency |

```bash
# Verify Lombok is wired as an annotation processor, not just a dependency
grep -A5 "annotationProcessorPaths\|annotationProcessor" pom.xml build.gradle build.gradle.kts

# Debug annotation-processor issues directly
./mvnw compile -X 2>&1 | grep -i "processor\|lombok\|mapstruct"
```

## Spring Boot startup / bean-wiring failures [SPRING]

| Error | Cause | Fix |
|---|---|---|
| `No qualifying bean of type X` | Missing `@Component`/`@Service`/`@Repository`, or component scan doesn't cover the package | Add the annotation, or fix `@ComponentScan`'s base package |
| `Circular dependency involving X` | Constructor-injection cycle between two beans | Refactor to break the cycle (extract a shared interface, invert one dependency) — `@Lazy` on one leg is a narrower stopgap, not the preferred fix, since it masks a real design issue |
| `BeanCreationException: Error creating bean` | Missing config value, bad property, or a missing downstream dependency bean | Read the full nested cause, not just the outer exception — the real error is usually 2-3 levels down in the stack trace |
| `Could not autowire. No beans of type found` | Missing bean definition, or wrong Spring profile active | Check `@Profile`, `@ConditionalOn*` annotations, and which profile is actually active at startup |
| `Failed to configure a DataSource` | Missing JDBC driver dependency, or missing `spring.datasource.*` properties | Add the driver dependency, or set the required datasource properties |
| `HttpMessageNotReadableException` | Malformed request JSON, or Jackson not on the classpath | Confirm `spring-boot-starter-web` (which pulls in Jackson) is present |

```bash
# Verify the application context actually loads (fast smoke test)
./mvnw test -Dtest=*ContextLoads* -q

# Confirm which Spring Boot version is actually resolved
./mvnw dependency:tree | grep "org.springframework.boot"

# Run with an explicit profile to rule out profile-activation issues
./mvnw spring-boot:run -Dspring-boot.run.arguments="--spring.profiles.active=test"
```

## Quarkus build-time augmentation failures [QUARKUS]

| Error | Cause | Fix |
|---|---|---|
| `UnsatisfiedResolutionException: no bean found` | Missing `@ApplicationScoped`/`@Inject`, or the extension providing that bean type isn't installed | Add the CDI annotation, or install the missing `quarkus-*` extension |
| `AmbiguousResolutionException` | Multiple beans satisfy the same injection point | Add `@Priority`, `@Alternative`, or a CDI qualifier to disambiguate |
| `Build step X threw an exception: RuntimeException` | Build-time augmentation failure — usually a missing extension, bad config value, or a reflection issue discovered at build time rather than runtime | Read the **full** stack trace; the actual cause is typically a nested exception naming the real problem, not the outer `RuntimeException` |
| `Error injecting X: it's a non-proxyable bean type` | `@Singleton` combined with an interceptor, or a `final` class/method that can't be proxied | Switch to `@ApplicationScoped`, or remove `final` if proxying is required |
| `ClassNotFoundException at native image build` | Missing `@RegisterForReflection`, or an incomplete `reflect-config.json` entry | Add `@RegisterForReflection` on the class needing runtime reflection in a native image |
| `BlockingNotAllowedOnIOThread` | A blocking call (JDBC, file I/O, `Thread.sleep()`) executed directly on the Vert.x event-loop thread | Add `@Blocking` to the endpoint, or move the call to a reactive/worker-thread pipeline |
| `ConfigurationException: SRCFG*` | A required `quarkus.*`/`mp.*` config property is missing or malformed | Check `application.properties` for the exact property named in the error |
| `Panache entity not enhanced` | The entity class isn't in a build-time-scanned package, or the Hibernate ORM/MongoDB Panache extension isn't declared | Confirm the extension dependency, and that the entity is in a scanned package |
| `RESTEASY* deployment failure` | Duplicate `@Path` values, or a missing provider | Check `@Path` uniqueness across resources; confirm `quarkus-resteasy-reactive` and classic `quarkus-resteasy` aren't both on the classpath — mixing them is unsupported |

```bash
# Maven
./mvnw quarkus:build -q                      # verify build-time augmentation in isolation
./mvnw quarkus:dev                           # surfaces runtime errors fast, with hot reload
./mvnw quarkus:list-extensions -q            # confirm what's actually installed
./mvnw quarkus:add-extension -Dextensions="<extension-name>"   # prefer this over hand-editing pom.xml
./mvnw dependency:tree | grep "io.quarkus"   # confirm BOM version alignment
./mvnw compile -X 2>&1 | grep -i "augment\|build step\|extension"

# Gradle
./gradlew quarkusBuild
./gradlew quarkusDev
./gradlew listExtensions
./gradlew addExtension --extensions="<extension-name>"
./gradlew dependencies --configuration runtimeClasspath | grep "io.quarkus"

# Native image (GraalVM) — a missing GraalVM install is a prerequisite gap
# to report, not something this skill fixes
./mvnw package -Pnative -DskipTests 2>&1 | head -50
```

## Anti-suppression reminders specific to this stack

- **Never add `@SuppressWarnings` to make a compiler warning disappear**
  without the warning itself being a confirmed false positive — the
  general skill's Reflection gate rule 1 applies directly here.
- **Never widen a generic type to a raw type, or add an unchecked cast, just
  to make a generics error go away** — that's the Java-specific instance of
  Reflection gate rule 2 (widening a type just to silence the compiler).
- **Never hand-edit `pom.xml`/`build.gradle` to bump a dependency's major
  version to resolve a conflict** without being asked — that's an
  architectural decision (Reflection gate rule 3), not a build fix, even
  when the newer version happens to compile.
- **[QUARKUS] Prefer `quarkus ext add`/`quarkus:add-extension` over manually
  editing the POM/Gradle file for extensions** — the CLI keeps the BOM
  version and extension coordinates consistent; hand-editing risks a
  mismatched extension version that compiles locally but fails augmentation
  in CI.
- **[QUARKUS] Confirm `@RegisterForReflection` is actually needed before
  adding reflection config manually** — most Quarkus extensions already
  register their own reflection needs; a hand-added `reflect-config.json`
  entry is often masking a missing extension dependency instead of fixing
  the real gap.
- **A `BeanCreationException`'s outer message is rarely the root cause** —
  always read the full nested `Caused by:` chain before proposing a fix;
  fixing the outer symptom (e.g. suppressing the bean-creation failure)
  without reading the nested cause is exactly the "rewritten problem
  statement" anti-pattern this skill's root-cause discipline warns against.

## Quarkus

Base Maven/Gradle diagnostics, dependency-resolution troubleshooting, and
compiler-error tables above apply identically. This section exists only
because Quarkus's build-time augmentation model produces error categories
Spring Boot doesn't have (see the table above) — CDI resolution,
build-step failures, native-image reflection gaps. Detect via `quarkus` in
the build file, same as the base file's detection rule.

## Stop conditions (loop guard specifics for this stack)

In addition to the general skill's 3-attempt guard, stop and escalate when:

- A `Circular dependency` error requires restructuring bean relationships
  rather than a one-line fix — that's a refactor, hand off to
  `code-review-edho-ferdian`.
- A native-image build fails because GraalVM isn't installed — report the
  missing prerequisite, don't attempt to work around it.
- A dependency conflict can only be resolved by bumping a major version —
  surface it as an architectural decision per the general skill's escalation
  routing, don't silently bump it.

## Provenance

Adapted from ECC's `java-build-resolver` agent (`agents/
java-build-resolver.md`, which already combines Spring Boot and Quarkus
diagnostics in one file) and `springboot-verification`'s build/static-
analysis phase commands, fetched 2026-09-07, consolidated for this
ecosystem's Java/Spring + Quarkus build-fix lens.
