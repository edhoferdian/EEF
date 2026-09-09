# Ruby / Rails — bundler, syntax & test-bootstrap lens

## Provenance

Source: ECC `rules/ruby/hooks.md` and the command-relevant portions of
`rules/ruby/testing.md`, fetched 2026-09-09, for the ground-truth commands
and CI gate list. **Rules-only ECC content, and thinner than this
directory's other lenses.** ECC has **no dedicated `ruby-build-resolver`
skill or agent** — unlike the Go/Django/Java build-fix lenses elsewhere in
this directory, each adapted from a purpose-built ECC build-resolver
skill. The diagnostic error tables below are **not ECC-sourced** — they
are written from well-known Bundler/RubyGems/`ruby -c`/RSpec/Minitest/
Rails error messages and general Ruby-ecosystem knowledge, and are called
out per-section below so this file is never mistaken for a ported ECC
skill. Re-derive this file from a live `gh api` fetch if ECC ever ships a
dedicated Ruby build-resolver skill.

**Detect.** A `Gemfile` at repo root, or any `.rb`/`.rake` file in scope
whose build/test bootstrap has failed.

Scope: Bundler/RubyGems dependency resolution failures, `ruby -c` syntax
errors, RSpec/Minitest bootstrap failures, and Rails-specific startup
failures (`config/environment.rb`, pending migrations at boot, credentials
decryption). You fix the error only — you do not refactor gem
architecture, models, or app structure beyond what the error demands.

## Diagnostic commands

Run these in order to localize the error before touching anything:

```bash
# Confirm interpreter and Bundler versions
ruby -v
bundle -v

# Confirm the syntax of a specific file compiles without running it
ruby -c path/to/file.rb

# Confirm Gemfile.lock is internally consistent with the Gemfile
bundle check

# The actual resolve — capture the exact, unedited output
bundle install
```

## Resolution workflow

```
1. Reproduce the error            -> capture the exact message, unedited
2. Identify the error family      -> use the tables below
3. Read the affected file/Gemfile -> understand context before editing
4. Apply the minimal fix          -> only what the error demands
5. bundle check && ruby -c <file> -> confirm the immediate error is gone
6. bin/rails test / bundle exec rspec -> confirm nothing else broke
```

## Bundler / RubyGems dependency resolution

*(general Bundler/RubyGems knowledge — not ECC-sourced)*

| Error | Cause | Fix |
|---|---|---|
| `Could not find gem 'X' in any of the sources` | Gem not in `Gemfile.lock`, or removed from the source registry | Add it to the `Gemfile` and run `bundle install`; confirm the gem name/source if it was recently yanked |
| `Bundler could not find compatible versions for gem "X"` | Conflicting version constraints across gems in the `Gemfile`/lockfile | Read the full resolver output for the conflicting requirement chain; relax the offending pin rather than force-installing |
| `Your bundle is locked to X (version) but that version could not be found` | `Gemfile.lock` references a version no longer available (yanked, or gem removed from a private source) | `bundle update X` to re-resolve that gem to an available version |
| `Gemfile.lock is corrupt` / lockfile checksum mismatch | Manually edited or partially-written lockfile | Never hand-edit `Gemfile.lock` — regenerate with `bundle lock` or `bundle install` from a clean state |
| `bundler: command not found` | Bundler itself not installed for the active Ruby | `gem install bundler`, matching the version pinned at the top of `Gemfile.lock` (`BUNDLED WITH`) if one is present |
| `An error occurred while installing X, and Bundler cannot continue` (native extension build failure) | Missing system library/header the gem's C extension needs to compile | Install the missing system dependency — read the actual compiler error printed just above this line, it names the missing header/library |
| `uninitialized constant X` at require time, gem otherwise installed | Gem installed but its `Gemfile` group excludes it from `Bundler.require`'s scope at boot | Confirm the `Gemfile` group the gem belongs to matches what's required at boot (`Bundler.require(*Rails.groups)` in Rails apps) |

```bash
# Force a clean re-resolve
bundle install --redownload

# Update a single gem without touching the rest of the lockfile
bundle update <gem-name>

# Nuclear option for a corrupted bundle — confirm this isn't a shared/CI
# environment other builds depend on before running it
rm -rf .bundle vendor/bundle
bundle install
```

## `ruby -c` syntax errors

*(general Ruby knowledge — not ECC-sourced)*

| Error | Cause | Fix |
|---|---|---|
| `syntax error, unexpected end-of-input, expecting 'end'` | Unbalanced `do`/`end`, `if`/`end`, `class`/`end`, or block | Count opening/closing keywords from the reported line upward; the actual missing `end` is usually above the reported line, not at it |
| `syntax error, unexpected ')'` / `unexpected ']'` | Mismatched parens/brackets, often from a misplaced string interpolation | Check the line the error names and the line immediately before it for an unclosed `(`/`[`/`{` |
| `unterminated string meets end of file` | An opened quote/heredoc never closed | Find the opening quote/heredoc marker and close it; heredocs (`<<~TEXT`) need their exact closing marker on its own line |
| `warning: possibly useless use of == in void context` | A stray comparison instead of assignment (common typo: `==` where `=` was meant) | Confirm intent — assignment vs. comparison — before changing it |

```bash
ruby -c path/to/file.rb
find . -name "*.rb" -exec ruby -c {} \; 2>&1 | grep -v "Syntax OK"
```

## RSpec / Minitest bootstrap failures

*(general RSpec/Minitest knowledge; commands cross-referenced against ECC
`rules/ruby/testing.md`)*

| Error | Cause | Fix |
|---|---|---|
| `Could not locate Gemfile or .bundle/ directory` (RSpec run) | RSpec invoked from outside the project root, or without Bundler | Run via `bundle exec rspec` from the project root, not a bare `rspec` |
| `uninitialized constant RSpec` | `spec_helper.rb`/`rails_helper.rb` not required, or RSpec missing from the `Gemfile`'s test group | Confirm the project's `.rspec` file requires the helper; confirm `rspec-rails` (for Rails apps) is in the `Gemfile` |
| `NoMethodError: undefined method 'described_class'` outside an example group | A shared example or support file loaded outside an actual `describe`/`context` block | Move the offending code inside a proper example group, or guard it with `RSpec.configure` if it's meant to run at configuration time |
| `Minitest::UnexpectedError` wrapping an unrelated exception | The real failure is inside the wrapped exception, not Minitest itself | Read the wrapped exception's own message/backtrace — Minitest is only the messenger here |
| `LoadError: cannot load such file -- rails_helper` | `rails_helper.rb` missing or not on the load path (common after moving `spec/` files, or a fresh clone that never ran the RSpec installer) | Run `bin/rails generate rspec:install` if it's genuinely missing, or fix the `require` path if the file exists elsewhere |

```bash
bin/rails test                              # Minitest — full suite
bin/rails test test/models/user_test.rb     # Minitest — narrow to one file
bundle exec rspec                           # RSpec — full suite
bundle exec rspec spec/models/user_spec.rb  # RSpec — narrow to one file
bundle exec rspec --backtrace                # full backtrace when a failure's origin is unclear
```

(The bare test-runner commands above are cross-referenced against
`rules/ruby/testing.md`'s own examples, not invented for this file; the
error-table diagnosis is general RSpec/Minitest knowledge.)

## Rails-specific startup failures

*(general Rails knowledge — not ECC-sourced)*

| Error | Cause | Fix |
|---|---|---|
| `ActiveRecord::PendingMigrationError` | Migrations exist that haven't been applied to the boot-time database | `bin/rails db:migrate` (or `RAILS_ENV=test bin/rails db:migrate` for the test DB specifically) |
| `ActiveSupport::MessageEncryptor::InvalidMessage` on credentials access | `config/credentials.yml.enc` can't be decrypted — wrong or missing `RAILS_MASTER_KEY`/`config/master.key` | Confirm `config/master.key` exists locally (never committed) or `RAILS_MASTER_KEY` is set in the environment; a key mismatch means the credentials file was encrypted with a different key than the one currently present |
| `Zeitwerk::NameError: expected file ... to define constant X` | An autoloaded file's constant name doesn't match its path (Rails' Zeitwerk autoloader is strict about this) | Rename the file or the constant so the path matches the expected camelization exactly |
| `PG::ConnectionBad` / `Mysql2::Error::ConnectionError` at boot | Database not running, or wrong host/port/credentials in `config/database.yml` | Start the DB, or correct the relevant `database.yml` entry (usually reading from an env var) |
| `Bundler::GemNotFound` during Rails boot (distinct from a bare Bundler error above) | `config/boot.rb` requiring Bundler before `bundle install` has run for the current lockfile | `bundle install`, then retry boot |

```bash
bin/rails db:migrate:status
bin/rails runner "puts 'boot OK'"
RAILS_ENV=test bin/rails db:migrate
```

## Anti-suppression reminders specific to this stack

- Never hand-edit `Gemfile.lock` — it's a generated, checksum-consistent
  file; the only correct way to change it is `bundle install`/`bundle
  update`/`bundle lock` regenerating it from the real dependency graph.
  Same discipline as this directory's Go lens's `go.sum` rule.
- Never run `rm -rf .bundle vendor/bundle` (or an equivalent gem-cache
  wipe) on a shared or CI machine without confirming with the user first
  — it forces every other in-flight build on that machine to re-download
  its full gem set.
- Never set `RAILS_MASTER_KEY` or commit `config/master.key` just to make
  a credentials-decryption error go away — that's a security-relevant
  secret-handling change; escalate to the security lens
  (`security-review-edho-ferdian/references/language-specific.md` §"Ruby /
  Rails") instead of silently working around it.
- Never delete a pending migration file to make
  `ActiveRecord::PendingMigrationError` go away — run it
  (`bin/rails db:migrate`) or, if it's genuinely wrong, fix and re-run it;
  a deleted migration corrupts history for every other environment that
  already applied it, same rule as this directory's Django lens's
  migration-deletion warning.
