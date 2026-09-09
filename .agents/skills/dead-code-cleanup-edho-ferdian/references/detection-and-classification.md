# Detection tooling & risk classification

The tooling table below covers multiple stacks, using the same
manifest-detection idea used elsewhere in this ecosystem, e.g.
`build-fix-edho-ferdian`'s stack routing.

## 1. Detection commands by stack

Detect the stack from the manifest file present at the repo root (or nearest
package root in a monorepo), then run the matching tools. Run independent
tools in parallel.

| Manifest | Stack | Unused deps | Unused exports/files | Unused vars/imports |
|---|---|---|---|---|
| `package.json` | JS/TS | `npx depcheck` | `npx knip`, `npx ts-prune` (TS) | `npx eslint . --report-unused-disable-directives` |
| `pyproject.toml` / `requirements.txt` | Python | `npx deptry .` (works off `pyproject.toml`) or manual cross-check of `requirements.txt` vs imports | `vulture .` | `unimport --check .` |
| `go.mod` | Go | `go mod tidy -diff` (or `go mod tidy` then diff) | `deadcode ./...` (golang.org/x/tools/cmd/deadcode) | `staticcheck -checks U1000 ./...` |
| `Cargo.toml` | Rust | `cargo machete` | `cargo udeps` (nightly) | `cargo clippy -- -W dead_code` |
| `pom.xml` / `build.gradle` | Java/Kotlin | IDE inspection or `gradle dependencyCheckAnalyze` (no single de-facto CLI — say so, fall back to grep + Salak) | same | same |
| `composer.json` | PHP | `composer unused` (composer-unused/composer-unused) | manual + Salak-first (weakest static tooling of this list) | PHPStan/Psalm dead-code rules if configured |
| none of the above | Unknown | Ask one question, or fall back to Salak-only + scoped grep and say explicitly that detection confidence is lower without stack-native tooling |

If a package manager script wraps these (e.g. `npm run lint:unused`), prefer
the repo's own script over the raw command — it likely carries project-specific
config (ignore patterns, entry points) the raw invocation would miss.

## 2. Risk classification

Every hit from Phase 1 gets exactly one label. Do not skip classification
for anything that "looks obviously dead" — that's precisely the case where a
missed dynamic reference does the most damage.

### SAFE

- An unused **private** (not exported / not `pub` / module-local) function,
  variable, class, or type with **zero references anywhere in the repo**,
  confirmed by both the detection tool and a manual grep for the identifier
  name (catches references the tool's AST walk might not model, e.g. a
  re-export chain).
- An unused dependency in the manifest with no import anywhere in the source
  tree, confirmed by `depcheck`/`deptry`/`cargo machete` and a grep for the
  package name.
- A file with zero inbound imports, confirmed by the tool and (if available)
  Salak's reverse-dependency data — see `salak-cross-check.md`.

### CAREFUL

- An **exported** function/class/type with zero in-repo references, where
  the repo is a library, SDK, or has any published/public-facing surface
  (npm package, PyPI package, a plugin API, a webhook handler matched by
  route string). The export could be consumed by code outside this repo.
- A symbol referenced only in a test file, config file, or documentation —
  ambiguous whether removing it breaks something outside the direct
  dependency graph the tool modeled.
- Anything Salak's cross-check downgrades from SAFE (see
  `salak-cross-check.md`) — an inbound edge exists but its provenance is
  `inferred` or `ambiguous` rather than `extracted`.

### RISKY

- Anything referenced only in **string form**: `import(variableName)`,
  `require(computedPath)`, a route/handler registered from a config string,
  a dependency-injection container resolving by name, a CLI subcommand
  dispatched via a lookup table built from strings, reflection
  (`getattr`/`Class.forName`/`reflect` equivalents).
- Anything a detection tool flags as unused but that appears in a
  string literal elsewhere in the repo (grep for the bare identifier name as
  a string, not just as code) — treat a match as evidence of possible dynamic
  use, not proof, and downgrade accordingly.
- Anything Salak's provenance tags as `ambiguous` with no other corroborating
  signal.

RISKY items are **reported, not removed**, by default (see SKILL.md Phase 3).
