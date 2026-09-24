# Rails — structure, services, and the Rails 8 defaults

Authoring guidance for Ruby on Rails 7.1+ and 8.x. Reviewing existing Rails
code is `language-code-review-edho-ferdian/references/ruby.md`; a failing
`bundle`/`rails` boot is `build-fix-edho-ferdian/references/ruby.md`. This
file is for writing new code well the first time.

Rails is opinionated on purpose. Most maintainability problems in large Rails
apps come from fighting the conventions or from letting two places — the
controller and the model — absorb everything. The patterns below give the
extra logic a named home.

## Directory contract

```text
app/
  models/       persistence + domain logic that belongs to one record type
  controllers/  HTTP in, HTTP out — orchestration only
  views/        templates, no business logic
  components/   ViewComponent classes (view logic that needs tests)
  services/     multi-step business operations
  forms/        forms spanning several models or non-column fields
  queries/      reusable, composable ActiveRecord queries
  jobs/         background work
  mailers/  helpers/  channels/  policies/ (Pundit, optional)
lib/            genuinely framework-independent code
```

Do not add `app/utils/`, `app/managers/`, or `app/lib/`. A class that fits
none of the directories above usually signals a design problem, not a missing
folder.

## When to extract what

| Signal | Extract to |
|---|---|
| Controller action past ~10 lines, or touching more than one model | Service object |
| Form spans models, or has fields with no column | Form object (`ActiveModel::Model` + `Attributes`) |
| Scope past ~3 chained conditions, or takes parameters, or reused across files | Query object that accepts a scope |
| Partial with conditionals, >2 locals, or used in >3 places | ViewComponent |
| Anything slow, external, or retryable | Background job |
| Behaviour shared by ≥2 *unrelated* models | Concern — otherwise keep it on the model |

## Service objects

Conventions that keep a codebase of services uniform:

- Namespace by domain, verb as the class: `Invoices::Create`,
  `Invoices::MarkPaid` — never `InvoiceManager` or `Invoices::Manager`.
- `.call(**kwargs)` on the class delegates to `#call` on an instance.
- Return a result object the caller can branch on (success, record, errors),
  not a bare boolean and not an exception for expected failures.
- Wrap multi-record writes in one transaction. Side effects that must not
  roll back the write (mail, export enqueue) run after commit and log on
  failure rather than raising.

```ruby
# app/services/invoices/create.rb
module Invoices
  class Create
    Result = Data.define(:success, :invoice, :errors) do
      def success? = success
    end

    def self.call(...) = new(...).call

    def initialize(params:, user:)
      @params = params
      @user = user
    end

    def call
      invoice = build
      ApplicationRecord.transaction { invoice.save! }
      notify(invoice)
      Result.new(success: true, invoice:, errors: nil)
    rescue ActiveRecord::RecordInvalid => e
      Result.new(success: false, invoice: e.record, errors: e.record.errors)
    end

    private

    attr_reader :params, :user

    def build
      user.invoices.new(params.except(:line_items)).tap do |invoice|
        invoice.line_items.build(params[:line_items])
        invoice.tax_total = TaxCalculator.call(invoice)
        invoice.total = invoice.line_items.sum(&:amount) + invoice.tax_total
      end
    end

    def notify(invoice)
      InvoiceMailer.created(invoice).deliver_later
      AccountingExportJob.perform_later(invoice.id)
    rescue StandardError => e
      Rails.logger.error("invoice #{invoice.id}: notification enqueue failed: #{e.message}")
    end
  end
end
```

`Data.define` needs Ruby 3.2+. On older Rubies use
`Struct.new(..., keyword_init: true)` with the same `success?` method.

The controller then shrinks to orchestration:

```ruby
def create
  result = Invoices::Create.call(params: invoice_params, user: current_user)
  if result.success?
    redirect_to result.invoice, notice: "Invoice created"
  else
    @invoice = result.invoice
    render :new, status: :unprocessable_entity
  end
end
```

## Form and query objects

A form object quacks like a model to `form_with model: @form`, validates
itself, and writes several records in one transaction, merging record errors
back into its own `errors` on failure.

A query object takes `scope:` as input so it composes with authorization and
other scopes: `Invoices::Overdue.call(scope: current_user.invoices)`. It owns
its `includes` so callers do not re-discover the N+1.

## ActiveRecord discipline

- Eager-load by default (`includes`; `preload` for separate queries,
  `eager_load` when filtering on the association). Turn on `strict_loading`
  in development so an accidental lazy load raises instead of hiding.
- Counter caches (`belongs_to :post, counter_cache: true`) replace
  `COUNT(*)` reads; adding one to a populated table needs a backfill.
- Callbacks only for data normalisation on the record itself
  (`before_validation :normalize_email`). Side effects — mail, jobs, calls to
  other models — go in services, where they can be skipped and tested.
- No `default_scope` on important models: it silently filters every query,
  including the support and debugging ones. Use a named scope.
- `UserRole`, `OrderStatus`, `InvoiceState` as tables are usually enums.
- `accepts_nested_attributes_for` is fine for simple parent/child forms; a
  form object once validation becomes conditional or cross-model.

## Background jobs

Pass IDs, not records. Delivery is at-least-once, so `perform` must be
idempotent, and retry/discard policy must be explicit:

```ruby
class AccountingExportJob < ApplicationJob
  queue_as :exports
  retry_on AccountingApi::TransientError, wait: :polynomially_longer, attempts: 5
  discard_on AccountingApi::PermanentError

  def perform(invoice_id)
    invoice = Invoice.find(invoice_id)
    export = AccountingExport.create_or_find_by!(
      invoice:,
      idempotency_key: "invoice-export-#{invoice.id}-#{invoice.updated_at.to_i}"
    )
    return if export.completed_at?

    receipt = AccountingApi.export(invoice, idempotency_key: export.idempotency_key)
    export.update!(completed_at: Time.current, external_id: receipt.id)
  end
end
```

The unique index on `idempotency_key` is what makes `create_or_find_by!`
safe under a race; passing the same key to the remote API covers a crash
between the remote call and `update!`. The generic queue reasoning (backoff
classes, dead letters, concurrency) is in `jobs-and-queues.md`.

Adapter choice: Solid Queue for a new Rails 8 app at modest throughput;
Sidekiq (or GoodJob on Postgres) when you need high throughput, mature
dashboards, or already run Redis.

## Views: ViewComponent and Hotwire

- Prefer a ViewComponent over a partial once the view has branching logic —
  it is unit-testable and its constructor is the documented interface.
- Hotwire is the default frontend for server-rendered apps: Turbo Frames for
  replacing one region, Turbo Streams for server-pushed updates, Stimulus for
  small behaviour attached to markup. Reach for React/Vue only when the page
  is genuinely application-shaped; that boundary is
  `frontend-engineering-edho-ferdian`'s call.

## Rails 8 defaults

Solid Queue, Solid Cache and Solid Cable move jobs, cache and ActionCable onto
the database, removing Redis from small deployments at the cost of database
load. Kamal is the default Docker deploy tool (deploy mechanics belong to
`deployment-ops-edho-ferdian`). Revisit Redis when throughput grows.

## Anti-patterns

| Pattern | Why it hurts |
|---|---|
| Controller over ~80 lines | Several responsibilities; split controllers or extract services |
| Model with 30+ methods orchestrating others | It became a service layer with persistence attached |
| `after_save :a, :b, :c` chains | Hidden, order-dependent side effects; impossible to opt out |
| A concern included by one model | Moving code, not sharing it — put it back |
| JS framework before trying Hotwire | Ships slower for server-rendered pages |
