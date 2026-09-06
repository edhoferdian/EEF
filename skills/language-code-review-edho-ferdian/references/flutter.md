# Language Lens — Dart / Flutter

Adapted from ECC `dart-flutter-patterns` and `flutter-dart-code-review`,
fetched 2026-09-07 — merged into one file because both cover the same
Dart/Flutter surface (idiom + widget/state-management review) with heavily
overlapping scope; keeping them separate would duplicate the null-safety,
widget-architecture, and state-shape material. `rules/dart/patterns.md` and
`rules/dart/security.md` are folded in as supporting detail where they add
something the two skills didn't already cover (the Repository/DI/mapper
snippets, and the WebView/obfuscation specifics).

**Detect.** Any `.dart` file in review scope, or a `pubspec.yaml` at the
project root with a `flutter:` section (distinguishes a Flutter app from a
plain Dart package — the widget/state-management criteria below only apply
to the former; null-safety and async-composition criteria apply to both).

**Library-agnostic by design.** Flutter's state-management ecosystem is
fragmented (BLoC, Riverpod, Provider, GetX, MobX, Signals) — this lens states
each principle once and maps it to whichever solution the project actually
uses via the Quick Reference table at the bottom, rather than assuming BLoC
or Riverpod specifically. Detect the solution from `pubspec.yaml` dependencies
before applying the solution-specific column.

**Boundary — read before flagging anything.** Generic function-length/
nesting/magic-number checks, generic error-handling discipline, and generic
secret handling are **already owned by `references/review-checklist.md`** in
the general skill. This lens adds only what is specific to **Dart's type/
null-safety system, Flutter's widget/rebuild model, and the state-shape
discipline that differs by library but the underlying principle doesn't**.

**Accessibility cross-reference.** `references/accessibility-lens.md`
targets DOM/ARIA semantics and does not apply mechanically to Flutter's
`Semantics`/`ExcludeSemantics`/`MergeSemantics` widget API. Flag Flutter
accessibility findings here at MEDIUM under CQ-10 using Flutter's own
vocabulary (see §Accessibility below) rather than forcing them into
`A11Y-##` codes written for web elements.

**Code placement.** Findings land as **CQ-10 (Dart/Flutter idiom & widget
anti-patterns)** in the general report. **No `§Dart`/`§Flutter` section
exists yet in `security-review-edho-ferdian/references/language-specific.md`.**
Until one is written, flag Dart/Flutter security findings directly under
Domain 2 (SEC) using the general skill's existing codes — **SEC-02** (secret
exposure: hardcoded API keys in Dart source), **SEC-10** (token handling:
secrets outside `flutter_secure_storage`), **SEC-01** (input sanitization:
unvalidated deep links, raw SQL string interpolation) — rather than inventing
a new per-stack code here.

---

## Ground-truth commands

```bash
flutter analyze                      # static analysis — confirms most idiom findings below
dart analyze --fatal-infos           # stricter: also fails on info-level lints
flutter test                         # unit + widget tests
flutter test --coverage              # coverage report, feeds the 80% target
flutter pub outdated                 # stale-dependency signal for §Package review
flutter build apk --analyze-size     # bundle-size signal, only run when a PERF finding needs it
```

If `analysis_options.yaml` is missing, or present without `strict-casts:
true`, `strict-inference: true`, `strict-raw-types: true`, that absence is
itself a HIGH finding (CQ-10) — implicit-`dynamic` and unsafe-cast findings
below become invisible to CI without it, the same shape as flagging a
missing `eslint-plugin-react-hooks` config in the React lens.

---

## Lens criteria

### CRITICAL

- **Bang operator (`!`) used to force-unwrap a value that can genuinely be
  null at that point** — crashes at runtime instead of failing at compile
  time, defeating the entire point of Dart's null safety. Prefer `?.`/`??`,
  an early-return guard (which promotes the type), or Dart 3 pattern
  matching (`switch`/`if-case`) for anything beyond a trivial fallback.
  **CQ-10.**
- **Mutable state (a `List`/`Map` field, a non-final field) inside a class
  used as a `const` constructor's data** — `const` constructors promise the
  instance is compile-time-constant and structurally comparable; a mutable
  field silently breaks that contract the type system doesn't catch.
  **CQ-10.**
- **Raw SQL built via string interpolation** (`rawQuery("... WHERE email =
  '$userInput'")`) instead of a parameterized query (`db.query(...,
  whereArgs: [...])`, or the ORM's own parameter binding). Same injection
  class as any other stack's SQL string-concatenation finding. **SEC-01.**
- **Unvalidated deep-link URI driving navigation** — `Uri.parse(incomingLink)`
  used directly without checking host/scheme/allowed-path before calling
  `context.go(uri.path)` or equivalent, letting a malicious link route to any
  internal path. Validate with `Uri.tryParse` plus an explicit host/path
  allowlist before navigating. **SEC-01.**

### HIGH

- **Boolean-flag state instead of a sealed/exhaustive state type for a
  mutually-exclusive async operation** — `isLoading`/`hasError`/`user` fields
  on one class can represent impossible combinations (`isLoading && hasError`
  both true). Use a sealed class hierarchy, the state-management solution's
  built-in async type (Riverpod's `AsyncValue`), or Dart 3 pattern-matched
  unions so the compiler enforces exhaustive handling. **CQ-10.**
- **`BuildContext` used after an `await` with no `mounted` check** (or
  `context.mounted` in newer Flutter) — the widget can have been disposed
  while the `Future` was pending; using its context afterward
  (`Navigator`/`ScaffoldMessenger`/any inherited-widget lookup) throws or
  silently misbehaves. Every async gap followed by context use needs the
  guard. **CQ-10.**
- **A private `_build*()` method returning a `Widget`** instead of a
  separate widget class — prevents `const` propagation and element reuse
  that Flutter's framework otherwise provides for free; a build-method helper
  always rebuilds when its parent rebuilds, a widget class does not have to.
  **CQ-10.**
- **Manual subscription (`.listen()`, a `Timer`, a `StreamController`) with
  no corresponding cancellation in `dispose()`** — leaks past the widget's
  lifetime. Prefer a declarative builder (`StreamBuilder`, the state-
  management solution's own subscription lifecycle) over manual `.listen()`
  wherever one exists. **CQ-10.**
- **`catch (e)` with no `on` clause, or a bare `catch` that swallows an
  `Error` subtype** — `Error` subtypes (`StateError`, `TypeError`,
  `RangeError`) indicate bugs in the code, not recoverable conditions;
  catching them and continuing hides a real defect instead of surfacing it.
  Always specify the exception type being handled. **CQ-10.**
- **Raw exception text (a caught `DioException`/`SocketException`/parsing
  error) shown directly to the user** instead of mapped to a user-friendly,
  localized message before reaching the UI. **CQ-10.**
- **`Future`-returning call with no `await` and no explicit `unawaited()`**
  — an unintentional fire-and-forget that silently drops errors and races
  with whatever runs next. If the fire-and-forget is deliberate, wrap it in
  `unawaited()` to say so; a bare unhandled call is a finding either way.
  **CQ-10.**

### MEDIUM

- **`late` used where a nullable field or constructor initialization would
  be safer** — defers a null/uninitialized error from compile time to
  runtime. `late` is appropriate only when initialization is genuinely
  guaranteed before first access (e.g. an `AnimationController` set in
  `initState()`), not as a default way to avoid writing `?`.
- **String concatenation (`+`) inside a loop building up a large string**
  instead of `StringBuffer` — quadratic allocation cost that Dart's linter
  (`prefer_interpolation_to_compose_strings`-adjacent rules) usually catches,
  but check when the linter config doesn't include it.
- **A public API returning a raw mutable `List`/`Map`** instead of an
  unmodifiable view — callers can mutate internal state through the returned
  reference, silently violating the class's invariants.
- **`UniqueKey()` used inside `build()`** — forces a full rebuild of that
  subtree every single frame, defeating the exact optimization keys exist to
  provide. Use a `ValueKey`/`ObjectKey` derived from stable data instead.
- **Hardcoded `Colors.red`/raw hex values or inline `TextStyle` with raw font
  sizes** instead of `Theme.of(context).colorScheme`/`textTheme` — breaks
  dark-mode support and design-token consistency the moment the theme
  changes.
- **Sorting, filtering, or mapping a large collection inside `build()`**
  instead of in the state-management layer — recomputed on every rebuild
  regardless of whether the underlying data changed.
- **`ListView(children: [...])` used for a large or dynamically-sized list**
  instead of `ListView.builder`/`GridView.builder` — eagerly builds every
  item instead of lazily building visible ones. (A small, genuinely static
  list is fine with the concrete constructor — don't flag reflexively.)
- **`GlobalScope` or a detached top-level coroutine-equivalent
  (`Future`/`Stream` not scoped to a lifecycle)** used for work that should
  be cancelled with the widget/BLoC/notifier that started it.

### Accessibility (Flutter-native vocabulary, not `A11Y-##`)

- **Interactive widget with no `Semantics`/`semanticLabel` and no readable
  child text** — invisible to a screen reader. Icon-only buttons need an
  explicit label the same way an RN/web icon button does.
- **Tappable target under ~48×48 logical pixels** with nothing compensating
  (Flutter has no built-in `hitSlop` equivalent — the tap target itself must
  be sized correctly, e.g. via `InkWell`'s own padding or a wrapping
  `SizedBox`/`GestureDetector` with adequate bounds).
- **No-op `onPressed` callback** (a disabled-looking button that's still
  wired to an empty handler) — should be genuinely disabled (`onPressed:
  null`) instead, so assistive tech announces it correctly.
- **Text that doesn't scale with system font size** — a fixed-height
  container that clips text once the user increases their accessibility
  font size.

---

## State Management Quick Reference

Use this to map a principle above to the project's actual library before
flagging — a Riverpod finding phrased in BLoC vocabulary (or vice versa) is
noise, not signal.

| Principle | BLoC/Cubit | Riverpod | Provider | GetX | MobX/Signals |
|---|---|---|---|---|---|
| State container | `Bloc`/`Cubit` | `Notifier`/`AsyncNotifier` | `ChangeNotifier` | `GetxController` | `Store`/`signal()` |
| UI consumer | `BlocBuilder` | `ConsumerWidget` | `Consumer` | `Obx`/`GetBuilder` | `Observer`/`Watch` |
| Selector (narrow rebuild) | `BlocSelector`/`buildWhen` | `ref.watch(p.select(...))` | `Selector` | N/A | `computed`/`computed()` |
| Disposal | auto via `BlocProvider` | `.autoDispose` | auto via `Provider` | `onClose()` | manual/effect cleanup |
| Testing | `blocTest()` | `ProviderContainer` overrides | `ChangeNotifier` directly | `Get.put` in test | store/signal directly |

---

## False-positive traps

- `late` on a field genuinely initialized in `initState()` before any
  widget interaction (an `AnimationController`, a `TextEditingController`)
  is the *correct*, documented use of `late` — not a finding.
- `catch (e)` with no `on` clause is not a finding when it's the outermost
  boundary of a top-level error handler explicitly designed to catch
  anything (`FlutterError.onError`, a `runZonedGuarded` wrapper) — that's the
  intended catch-all, distinct from a narrow business-logic `try`/`catch`
  swallowing a specific exception type it should have named.
- `ref.watch` creating a dependency chain between Riverpod providers is
  expected and idiomatic — only flag it when the chain is circular or has
  grown tangled enough that tracing a state change requires jumping through
  more than a few providers.
- A class-component-equivalent "extract to a widget class, not a method" nit
  does not apply to a `_build*()` helper in a file you are not otherwise
  modifying for another reason — same scope-of-change discipline as the
  React lens's class-component caveat.

## Escalate to general domain when…

- The finding is about **generic error-handling discipline** with no
  Dart-specific mechanism behind it (a missing try/catch around an async
  call with nothing Dart-idiom-specific about the gap) — general Domain 1
  (CQ), not this lens.
- A performance claim needs **actual profiling** (DevTools' widget rebuild
  count, the timeline view, `flutter build ... --analyze-size`) to confirm
  rather than static reading — escalate to `performance-audit-edho-ferdian`.
- The finding is a **build/pub-dependency/compile failure** rather than a
  review-time concern — that's `build-fix-edho-ferdian/references/
  flutter.md`'s job, not this lens's.
- The finding is about **module/layer boundaries** (domain importing
  `package:flutter`, business logic in a ViewModel instead of a UseCase) —
  that's `references/android.md`'s Clean Architecture material (shared
  Kotlin/Dart concern) or a general architecture concern, not a Flutter
  idiom finding specifically.
