# Language Lens — Ruby / Rails

## Provenance

**Rules-only content.** No dedicated Ruby reviewer skill or agent was
available — unlike Go, Python, PHP/Laravel, or Java/Spring Boot, which each
have a purpose-built review skill this ecosystem ported from elsewhere in
this directory. Ruby/Rails coverage here is built from five
convention/checklist rule sources covering coding style, patterns, and
testing, not an enumerated, severity-tiered reviewer skill. This lens is
built by translating those conventions into the CQ-11 criteria format the
rest of this skill uses, rather than adapting an existing reviewer's own
priority list — treat it as thinner and more general than the Go/Laravel/
Java lenses in this same directory, and re-derive it if a dedicated Ruby
review skill becomes available.

**Detect.** A `Gemfile` at repo root, `config/routes.rb` present, or any
`.rb`/`.rake`/`.erb` file in review scope. The Rails-specific criteria
below apply only when the project actually is a Rails app (`Gemfile`
requiring `rails`); a plain Ruby project (a gem, a script, a Sinatra app)
gets the non-Rails subset only.

**Boundary — read before flagging anything.** Generic injection (SQL/
command/path traversal via string concatenation), generic secret handling,
generic function-length/nesting/magic-number checks, and generic N+1
detection are **already owned by `references/review-checklist.md`** in the
general skill. This lens adds only what is specific to **Ruby's language
idioms and Rails' architectural conventions** — service/query/form-object
layering, background-job/cache/frontend stack fit, and RuboCop-shaped style
findings. **All Ruby/Rails security items already live in
`security-review-edho-ferdian/references/language-specific.md` §"Ruby /
Rails"** (ported from `rules/ruby/security.md`) — this file does not
re-port that content; cross-reference it, don't restate it.

**Code placement.** Findings land as **CQ-11 (Ruby/Rails idiom
anti-patterns)** in the general report.

---

## Ground-truth commands

```bash
bundle exec rubocop            # style/formatting — confirms coding-style-shaped findings
bundle exec rubocop -A         # safe autocorrect — use only when asked to fix, not just report
bin/rails test                 # Minitest — confirms test-structure findings actually run
bundle exec rspec              # RSpec — same, when the project uses RSpec instead of Minitest
```

Do not label a RuboCop-detectable finding (a formatting or cop violation)
as [High confidence] without actually having run `rubocop` — reading the
code and recognizing a style deviation is reasoning, not verification, per
the general skill's Phase 2 rule.

---

## Lens criteria

### HIGH

- **Fat controller/model doing everything inline instead of a service/
  query/form object once the responsibility outgrows plain MVC** —
  `rules/ruby/patterns.md`'s "Rails Way First" section is explicit: start
  with plain Rails MVC and Active Record conventions for small/medium
  features, but introduce a service object, query object, form object,
  decorator, or presenter once the model/controller boundary is carrying
  multiple responsibilities. Flag a controller action or model method that
  has clearly grown past that point with nothing extracted. **CQ-11.**
- **Extracted object named after a generic layer (`Manager`, `Processor`,
  `Handler`) instead of the business operation it performs** — the same
  section calls this out by name: name extracted objects after the
  business operation, not a generic architectural label. **CQ-11.**
- **Raw SQL or a string-built query left outside a query object or model
  scope** — `rules/ruby/patterns.md`'s Persistence section requires
  keeping raw SQL behind query objects/scopes with every dynamic value
  parameterized; a query built inline in a controller or view is a
  layering violation independent of the injection angle (which is the
  security lens's territory, not this one). **CQ-11.**
- **Broad `rescue StandardError` that swallows the exception instead of
  re-raising or preserving context** — `rules/ruby/coding-style.md`'s
  Error Handling section calls for rescuing specific exceptions and avoids
  broad rescues "unless they re-raise or preserve enough context for
  operators." A bare `rescue => e` (or `rescue StandardError => e`) with
  no re-raise, no logging, and no operator-facing context is a silent
  failure. **CQ-11.**
- **Debug statements left in committed application code** — `puts`, `pp`,
  `debugger`, `binding.irb`, or `binding.pry` calls outside a spec/console
  context. Both `coding-style.md` and `hooks.md` flag this explicitly.
  **CQ-11.**

### MEDIUM

- **Background job framework mismatched to the app's actual scale/
  infrastructure** — `rules/ruby/patterns.md` gives a specific decision
  rule: Solid Queue for greenfield Rails 8 apps with modest throughput and
  simple deployment needs, Sidekiq when the app needs mature observability,
  high throughput, existing Redis infrastructure, or Pro/Enterprise
  features. Flag a choice that contradicts the app's actual profile only
  when the mismatch is evident from the codebase, not as a blanket
  preference for one over the other. **CQ-11.**
- **Cache/cable backend chosen without matching the deployment model** —
  same reasoning for Solid Cache/Solid Cable vs. Redis: Redis is the right
  call for shared cross-service behavior, high fanout, or advanced data
  structures; Solid Cache/Cable fit a matching single-service deployment
  model. **CQ-11.**
- **Persistence backend (SQLite vs. PostgreSQL) picked without matching
  the deployment topology** — `patterns.md` treats Rails 8's SQLite-backed
  defaults as viable for single-host/modest deployments only, not an
  automatic fit for shared multi-service systems; PostgreSQL is the
  default recommendation for multi-host production Rails apps absent a
  clear reason otherwise. **CQ-11.**
- **View/component/presenter carrying persistence or authorization
  logic** — `patterns.md`'s Frontend section keeps view components,
  partials, and presenters focused on rendering decisions, with
  persistence and authorization kept out of templates. **CQ-11.**
- **Auth system choice mismatched to actual requirements** — the Rails 8
  authentication generator is right for straightforward session auth and
  password reset; Devise (or another established system) is warranted
  once OAuth, MFA, confirmable/lockable flows, or multi-model auth are
  actually needed. Flag Devise pulled in for a project that only needs the
  generator's simpler feature set, or the reverse (hand-rolling OAuth/MFA
  instead of using an established gem). **CQ-11.**
- **Metaprogramming/DSL-heavy code with no narrow, tested boundary** —
  `coding-style.md` prefers clear Ruby over clever metaprogramming and
  asks that DSL-heavy code be isolated behind a narrow, tested boundary
  when it is used at all. **CQ-11.**
- **RuboCop cop silenced inline without a documented, narrow reason** — an
  `# rubocop:disable` comment with no explanation, or one scoped broader
  than the actual violation. **CQ-11.**
- **Minitest and RSpec mixed in the same feature area with no migration
  reason** — `rules/ruby/testing.md` explicitly asks not to mix the two
  frameworks within one feature area absent an active migration. **CQ-11
  / testing note below.**

---

## Testing lens (from `rules/ruby/testing.md`)

- **Test pyramid shape**: fast domain behavior (model/service/query/
  policy/job) tests first; request/controller tests for HTTP contracts,
  auth behavior, redirects, status codes, response shapes; system tests
  with Capybara reserved for browser-critical flows only, kept focused and
  stable — not a substitute for the faster layers beneath them.
- **Fixtures vs. factories**: Rails fixtures are fine when they're the
  project default and the data graph is small; `factory_bot` is the right
  tool once scenarios need explicit object construction or complex
  traits. Flag test-data setup that has grown past what plain fixtures can
  express cleanly with no move to factories, and flag global fixtures used
  to hide real setup cost — `testing.md` calls out that shape specifically.
- **Coverage tooling**: SimpleCov when coverage is enforced, thresholds
  kept in CI, not gamed with low-value branch-coverage-only tests — same
  shape as the general skill's Domain 5 targets, stated here because
  `bundle exec rspec`/`bin/rails test` plus SimpleCov are the concrete
  commands for this stack.
- **Regression tests before the fix** — `testing.md` calls for a
  regression test added for a bug fix before the production code changes,
  same discipline as the general TDD workflow.

---

## False-positive traps

- A broad `rescue StandardError` that does re-raise (`raise` with no
  arguments inside the rescue block) or that logs full context via
  `ActiveSupport::Notifications`/the app's logger before returning a
  degraded response is the documented exception `coding-style.md` itself
  carves out — not a finding; check for the re-raise or the logging call
  before flagging.
- `# rubocop:disable` with an inline comment stating why the cop doesn't
  apply, scoped to the single line/block actually needing the exception,
  is the accepted pattern per `coding-style.md`'s own wording ("narrow,
  documented, and harder to express cleanly in code") — not every disable
  comment is a finding, only ones missing the narrow scope or the
  documented reason.
- Minitest and RSpec coexisting in the same repo is not automatically a
  finding — the rule is about mixing them **within the same feature area**
  without a stated migration; a repo mid-migration with a tracked plan is
  fine.
- Sidekiq present in a low-throughput app is not automatically a mismatch
  if the app already has Redis infrastructure for another reason (caching,
  rate limiting) that makes Sidekiq's marginal operational cost near zero
  — check the actual infrastructure footprint before flagging the
  framework choice.

## Escalate to general domain when…

- The finding is generic SQL/command/path injection with no Ruby/Rails-
  specific nuance — that's the general skill's SEC domain; flag it there.
- The finding is a security misconfiguration already catalogued in
  `security-review-edho-ferdian/references/language-specific.md` §"Ruby /
  Rails" — CSRF, mass assignment, `html_safe`/`raw`, secrets, file-upload
  validation. Cross-reference it; don't re-derive it here.
- The finding is about test coverage percentage or test-quality patterns
  beyond "does this test exist / is it the right pyramid layer" — that's
  Domain 5 (`test-quality-lens.md`) in the general skill.
- A performance claim needs profiling/benchmark evidence to confirm beyond
  "this N+1-shaped loop looks slow" — escalate to
  `performance-audit-edho-ferdian` per the general skill's PERF escalation
  rule.
