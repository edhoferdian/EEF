# Language Lens — Angular / TypeScript

**Detect.** `package.json` present with `@angular/core` in `dependencies` or
`devDependencies`. Applies to `.ts` component/service/directive/pipe files and
`.html` Angular templates in the review scope. `nx.json` at repo root
activates the Nx sub-sections below (ground-truth commands, cache
troubleshooting). If the same repo (an Nx monorepo) also has `@nestjs/core`
in its dependency graph, also load `references/nestjs.md` — that file is
being written in parallel by another agent; if it does not exist yet at
review time, note the gap and proceed with this lens alone.

**Boundary — read before flagging anything.** Generic TypeScript type safety
(`any` abuse, unsafe `as` casts, strict-null violations), generic async
correctness (unhandled promise rejections, floating promises), generic
function-length/nesting/magic-number checks, and generic secret/injection
handling are **already owned by `references/review-checklist.md`** in the
general skill (CQ/SEC domains) — do not re-flag them here. This lens only
adds what is specific to **Angular's execution model**: signals and the
reactive graph, dependency injection and injection context, the Signal Forms
API surface, routing/guards, and Angular-specific testing patterns.

**Accessibility cross-reference.** The general skill already has a full
`references/accessibility-lens.md` (WCAG 2.2 AA, `A11Y-##` codes) that
activates automatically for any UI/component scope, Angular included. Do
**not** duplicate its checklist here — labels, `alt` text, contrast, keyboard
reachability, ARIA, heading order are all covered there. Angular Aria
component-building guidance is a
code-generation reference, not a review checklist item, and is out of scope
for this lens.

**React cross-reference (`@for`/`track`).** Angular's `@for` block requires a
`track` expression, conceptually the same reconciliation mechanism as React's
list `key` — reusing the wrong identity (or `track $index` on a reorderable
list) corrupts component state/focus across re-renders the same way
`key={index}` does in React. See `references/react.md`'s `key={index}`
CRITICAL/HIGH entry for the full explanation of *why* identity-based
reconciliation breaks under reorder — this file does not repeat that
mechanism, only the Angular-specific trigger condition (see MEDIUM below).

---

## Rule #1 — read the project's Angular version before reviewing

**This is the single most important rule in this lens.** Angular's public API
surface changed substantially across v16–v20+, and flagging "should use X"
against a version that doesn't support X is a false positive, not a finding.

- Check `package.json`'s `@angular/core` version (and run `ng version` if
  available — see Ground-truth commands) **before** evaluating any of the
  criteria below.
- **Signal Forms, `resource()`, and `linkedSignal()` are recent APIs.** A
  codebase on Angular v16–v18 has no Signal Forms module
  (`@angular/forms/signals` does not exist there) — do not recommend
  migrating an existing Reactive/Template-driven form to Signal Forms on
  those versions, and do not flag the *absence* of Signal Forms as a defect.
  The MEDIUM finding below ("new form written with old API") only applies
  when the installed version actually ships Signal Forms.
- Ghostfolio (Edho's real project referenced by this lens) is on a recent
  Angular major that does support Signal Forms/`resource()`/`linkedSignal()`
  — but do not assume every Angular project in scope is at the same version;
  re-check per-repo.
- Functional route guards (`CanActivateFn` as a plain function, not a class
  implementing `CanActivate`) became the idiomatic form starting Angular 15
  — a class-based guard in a codebase that predates that, or that hasn't
  otherwise been touched in the current change, is not itself a finding.

---

## Ground-truth commands

```bash
ng version                                   # confirms the Angular major — run this FIRST
ng build                                     # MANDATORY — confirms the change actually compiles
npx ng lint                                  # or `ng lint` if the builder is configured
npx nx affected -t lint,test                 # Nx monorepo only (nx.json present)
npx nx reset                                 # Nx monorepo cache troubleshooting (see build-fix lens)
```

**`ng build` is mandatory, not optional.** Every lens finding that a build
would surface (a Signal Forms API misuse that fails to compile, a template
type error, a missing standalone import) must be checked against an actual
`ng build` run before being asserted as fact.

**Medium-cap rule (inherited from the general skill's ground-truth-first
rule, restated here because it is the most consequential rule for this
stack):** a finding that `ng build`/`ng lint`/`nx affected` *could* confirm
but that command was not actually run **never reaches [High confidence]** —
cap it at [Medium confidence] and name the exact command that would confirm
it. This applies especially to Signal Forms API-shape errors (calling a
field without invoking it, wrong `applyEach` arity) — these are TypeScript
compile errors, not style opinions, and `ng build`/`tsc` settles them
definitively when run.

---

## Lens criteria

### HIGH

- **`effect()` used for derived state that should be `computed()`.** If an
  effect's body calls `.set()`/`.update()` on another signal to keep two
  signals in sync, that is state propagation, not a side effect — Angular's
  own guidance is explicit that this causes
  `ExpressionChangedAfterItHasBeenChecked` errors and can loop. The signal
  being derived should be a `computed()` instead. Recognize the shape:
  `effect(() => { otherSignal.set(deriveFrom(sourceSignal())) })` where
  `deriveFrom` is a pure function of already-available signals. **CQ-11.**
- **`inject()` called outside an injection context (NG0203).** Valid
  contexts are field initializers and constructors of DI-managed classes
  (`@Component`, `@Directive`, `@Injectable`, `@Pipe`), factory functions in
  provider configuration, and Angular's own functional APIs (route guards,
  resolvers, interceptors) when they execute. `inject()` called inside a
  method body invoked later (an event handler, a `setTimeout` callback, a
  promise `.then()`), inside a plain async function, or in any code path that
  runs after the constructor has already returned, throws NG0203 at runtime.
  Fix: capture the dependency via `inject()` at the field/constructor level,
  or use `runInInjectionContext(injector, () => inject(X))` when the call
  must genuinely happen later and an `Injector` is available. **CQ-11.**
- **Signal Form field initial value is `null`/`undefined`.** Signal Forms
  binds each field's type directly to the model's initial value; `null`/
  `undefined` on a string/number/array field breaks the `[formField]`
  binding and validator type inference. Required initial values: `''` for
  strings, `0` for numbers, `[]` for arrays. Flag any `signal({ ...,
  someField: null })` or `undefined` feeding a `form()` model. Only
  applicable when the project's Angular version ships `@angular/forms/
  signals` (see Rule #1). **CQ-11.**
- **`form.field.valid()` (or any flag/value access) without calling the
  field first.** A Signal Forms field (`FormField`) is a function; calling
  it returns the `FieldState` that actually carries `.valid()`, `.dirty()`,
  `.touched()`, `.value()`, `.errors()`, `.hidden()`, `.disabled()`,
  `.readonly()`, `.pending()`. `form.field.valid()` is a TypeScript compile
  error (`Property 'valid' does not exist on type 'FieldTree'`) — the
  correct form is `form.field().valid()`. The one documented exception is
  `.length` on an array-typed field path (`form.items.length`, no
  parentheses — a structural property, not a signal read). `ng build`
  confirms this class of error definitively. **CQ-11.**
- **HTML `min`/`max`/`value`/`disabled`/`readonly` attributes set directly
  on a `[formField]`-bound input instead of as schema rules.** Signal Forms'
  `[formField]` directive owns `disabled`/`readonly`/`value` binding
  automatically; setting `[disabled]`, `[readonly]`, `[value]`/
  `[attr.value]`, or static/bound `min`/`max`/`[attr.min]`/`[attr.max]` on
  the same element either conflicts with or duplicates what the schema
  should express via `disabled()`, `readonly()`, `min()`, `max()` rules in
  the `form()` schema callback. Example of the anti-pattern: `<input
  min="1" [formField]="form.age">` — should be `min(schemaPath.age, 1)` in
  the schema instead, with a bare `<input [formField]="form.age">` in the
  template. **CQ-11.**
- **Manual `.subscribe()` on an Observable with no `takeUntilDestroyed()`
  and no `async` pipe.** A component or service that subscribes directly
  (`this.someObservable$.subscribe(...)`) without either piping through the
  template's `async` pipe or unsubscribing via `takeUntilDestroyed()` (or an
  equivalent teardown in `ngOnDestroy`) leaks the subscription past the
  component's lifetime — the classic Angular memory-leak shape, structurally
  identical to a React `useEffect` missing cleanup. Flag every unmanaged
  `.subscribe()` call found in scope; consolidate repeats per the general
  skill's noise-control rule if the same pattern repeats across a file.
  **CQ-11.**
- **`providedIn: 'root'` on a service that holds per-route or per-component
  state.** `providedIn: 'root'` creates an application-wide singleton — a
  service meant to hold state scoped to one route or one component instance
  (e.g. a wizard's current-step state, a detail-page's loaded-record cache)
  leaks that state across navigations/instances when it's a root singleton
  instead of being provided in the route's component tree or the
  component's own `providers` array. Distinguish this from services that are
  *correctly* root-scoped (auth state, a shared HTTP client, app-wide
  config) — the finding is specifically about scope mismatch, not
  `providedIn: 'root'` being wrong in general. **CQ-11.**

### MEDIUM

- **`$parent.$index` referenced inside a nested `@for` loop.** Angular's
  control-flow syntax has no `$parent` — this is an AngularJS-era pattern
  that does not exist in modern Angular and will fail to compile. The fix is
  to capture the outer index with a template variable: `@for (item of items;
  track item.id; let outerIdx = $index) { @for (opt of item.options; track
  opt.id) { <button (click)="remove(outerIdx, $index)"> } }`. **CQ-11.**
- **`@for` with no `track` expression, or `track $index` on a list that can
  reorder/filter/insert.** `track` is Angular's reconciliation-identity
  mechanism — the same class of bug as React's `key={index}` (see the
  cross-reference at the top of this file for the underlying mechanism;
  not repeated here). Flag a missing `track` (a template compile error on
  recent Angular versions, so `ng build` will already catch it — check that
  first) and, separately, a `track $index` on a list whose items can change
  order, be filtered, or be inserted/removed from the middle — use a stable
  identifier from the data (`track item.id`) instead. **CQ-11.**
- **A new form written against the Reactive Forms or Template-driven API
  when the project's Angular version supports Signal Forms.** Per Rule #1,
  this only applies when `@angular/forms/signals` is actually available in
  the installed version — a v16-18 project has no such option and this
  finding does not apply there. On a version that does support Signal Forms,
  a brand-new form built with `FormBuilder`/`FormGroup`/`FormControl`
  instead of `form()` is a missed-idiom finding, not a defect — note it as a
  should-use recommendation, not a build-breaking issue. Existing forms on
  the old API in files not otherwise being touched are not a finding (scope-
  of-change discipline, same as the React lens's stance on class components).
  **CQ-11.**
- **`CanActivate`/a route guard treated as the sole access control for a
  protected resource.** A route guard only prevents client-side navigation
  — it does nothing to stop a direct API call, a replayed request, or a
  modified client bundle from reaching the underlying data. Angular's own
  guard documentation states this explicitly: guards are UX, not security.
  If a review finds a sensitive endpoint or data flow whose *only*
  authorization check is a `CanActivate` guard with no corresponding
  server-side check, **this is not a CQ finding — escalate it to Domain 2
  (SEC)** as a missing server-side authorization control, not a routing
  idiom issue. Do not file it under CQ-11 once escalated.
- **`ChangeDetectionStrategy.Default` on a component rendering a large or
  frequently-updating list.** Only flag this with actual evidence of volume
  or update frequency in scope (a list confirmed to render 100+ rows, a
  component subscribed to a high-frequency stream) — per the general skill's
  PERF escalation rule, a bare claim that `OnPush` "would be faster" with no
  measured or clearly-evidenced hot path is not a finding on its own.

---

## False-positive traps

- **`effect()` used for logging, DOM manipulation via `afterRenderEffect`,
  or syncing a signal to `localStorage`/`sessionStorage`/a third-party
  non-signal API is the *documented, correct* use of `effect()`** — do not
  flag every `effect()` call as a potential "should be computed()" issue.
  The HIGH finding above applies specifically to effects that call
  `.set()`/`.update()` on another Angular signal to keep it in sync with the
  source signal; an effect writing to `localStorage`, a `<canvas>`, or a
  console is doing exactly what `effect()` is for.
- **A non-null assertion (`!`) on a `@ViewChild`/`viewChild.required()`
  reference used inside or after `ngAfterViewInit`** is a normal, accepted
  idiom — the view child is guaranteed to exist by that lifecycle point.
  Don't flag this as an unsafe assertion; it is the standard pattern the
  framework itself expects.
- **An `NgModule`-based component in a project that has not migrated to
  standalone components** is not a defect on its own. Check the project's
  actual state first — if the majority of the codebase is still
  `NgModule`-based and the file under review isn't otherwise being
  refactored for another reason, "convert to standalone" is out of scope
  (same scope-of-change discipline the React lens applies to class
  components). Only flag a *new* component added as `NgModule`-based when
  the rest of the project has already migrated to standalone.
- **A class-based route guard (`implements CanActivate`) in an older
  codebase** is not a defect distinct from the functional-guard idiom
  preference — functional guards became idiomatic at Angular 15, but a
  pre-existing class guard in a file not otherwise being changed is scope-
  of-change, not a finding.
- **`inject()` used inside a functional route guard, resolver, or
  interceptor** is a documented valid injection context (Angular executes
  these functions within one) — do not flag this as the NG0203
  outside-context finding above; that finding is specifically for `inject()`
  reached from a callback/method body that runs *after* the injection
  context has already closed.

## Escalate to general domain when…

- A finding is about **TypeScript type safety** unrelated to Angular's
  runtime/DI/signal behavior (an `any` in a component input type, an unsafe
  cast) — general Domain 1 (CQ), not this lens.
- A finding is a **plain accessibility violation** with no Angular-specific
  mechanism behind it — route to `references/accessibility-lens.md`'s
  `A11Y-##` codes instead of duplicating it here.
- A route guard is the **sole** authorization control for a sensitive
  resource — escalate to Domain 2 (SEC), per the MEDIUM item above; do not
  leave it filed as a CQ routing-idiom finding once escalated.
- A PERF finding needs actual measurement (profiler output, change-detection
  cycle counts, bundle-size diff) to confirm rather than static reading —
  escalate to `performance-audit-edho-ferdian` per the general skill's PERF
  escalation rule.
- A finding concerns Angular-specific **security** misconfiguration
  (`DomSanitizer` bypass, `innerHTML` XSS surface) — these live in
  `security-review-edho-ferdian/references/language-specific.md` §Angular,
  not here; load that file (or delegate to that skill) for Domain 2 depth.
