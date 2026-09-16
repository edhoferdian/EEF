# Cross-Stack Notes — Lint/Format/Hook Tooling Beyond JS/TS

Husky is JS-specific (it hooks into `npm install` via the `prepare`
script). A non-JS or mixed-language project needs either a
language-agnostic hook runner or that language's own convention.

## Python

- **Ruff** replaces the old Flake8 + isort + (often) Black combination as a
  single fast linter+formatter — prefer it for a new project.
  `ruff check .` (lint), `ruff format .` (format).
- **pre-commit** (the `pre-commit` Python framework, distinct from the
  general term "pre-commit hook") is the standard hook runner —
  `.pre-commit-config.yaml` declares hooks (including `ruff`'s own
  pre-commit hook) and `pre-commit install` wires them into `.git/hooks/`.
  This is the Python-ecosystem equivalent of Husky + lint-staged combined.

## Go

- **golangci-lint** aggregates most Go linters (`govet`, `staticcheck`,
  `errcheck`, etc.) behind one config (`.golangci.yml`) and one command.
- `gofmt`/`goimports` for formatting — idiomatic Go projects run this via
  editor integration and a CI check rather than a commit-blocking hook,
  since Go's formatting is close to non-negotiable and rarely disputed.
- For a hook runner: either the `pre-commit` framework (works fine outside
  Python, just needs `language: golang` hook entries) or **lefthook** (a
  single Go binary, genuinely language-agnostic, good fit for a polyglot
  monorepo that doesn't want a Node or Python dependency just for hooks).

## Rust

- `cargo fmt` (formatting) and `cargo clippy` (linting) are the built-in,
  essentially uncontested tools — no third-party alternative needed.
- Hook wiring: same lefthook/pre-commit-framework choice as Go.

## Choosing a hook runner for a polyglot project

If a repo mixes stacks (e.g. a Next.js frontend and a Python or Go
backend in one monorepo), don't install Husky *and* the Python
`pre-commit` framework side by side — pick one hook runner for the whole
repo:

- **lefthook** — single static Go binary, no runtime dependency on Node or
  Python, config in one `lefthook.yml` that can shell out to any
  per-language tool (`eslint`, `ruff`, `golangci-lint`) from the same file.
  Best default for a genuinely polyglot monorepo.
- **Husky** — fine and simplest when the repo is JS/TS-only, or JS/TS is
  clearly the primary stack and other languages are a small vendored
  piece.
- **pre-commit framework** — fine when Python is the primary stack, since
  its hook ecosystem (via `pre-commit-hooks` and language-specific repos)
  is the most mature for Python-first teams.

## CI-as-backstop, regardless of stack

Whatever the local hook does, CI must re-run the same checks
unconditionally — a local hook can always be bypassed (`--no-verify`,
`SKIP=... git commit`, a clone that never ran the install step). Treat the
local hook as a fast, skippable convenience for the contributor and CI as
the actual gate. See `git-and-release-ops-edho-ferdian`'s CI-failure-triage
guidance for what happens when the CI-side check fails after a bypassed
local hook let something through.
