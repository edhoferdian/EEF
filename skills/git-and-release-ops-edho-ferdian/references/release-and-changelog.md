# Release and changelog

Cutting a release, writing a changelog people actually read, and choosing
the version bump — for both applications (deployed, no external consumers of
a version number) and libraries/packages (versioned API, real consumers who
pin to a range).

## Cutting a release

### Tagging conventions

- Use **SemVer** (`vMAJOR.MINOR.PATCH`, e.g. `v2.4.1`) as the default tag
  format regardless of language ecosystem — it is the one convention every
  consumer, dependency manager, and changelog tool already understands.
- **Tag the exact commit that was released**, after CI is green on it, never
  before. A tag on a commit that hasn't passed CI is a promise the pipeline
  hasn't verified yet.
- **Tags are immutable once published.** Never move or force-push a release
  tag to point at a different commit — a consumer who already pulled
  `v2.4.1` and one who pulls it tomorrow must get the same code. If a
  release was wrong, ship `v2.4.2`, don't retag `v2.4.1`.
- Annotate the tag (`git tag -a v2.4.1 -m "..."`) rather than a lightweight
  tag — an annotated tag carries its own metadata (tagger, date, message)
  independent of the commit it points to, which matters once the tag is the
  thing being referenced in a release page.

### Release branches vs trunk-based release

| Approach | Fits | Cost |
|---|---|---|
| Trunk-based (tag directly off `main`) | Continuous deployment, one supported version at a time | Almost none — matches GitHub Flow, the default in `references/branching-and-commits.md` |
| Release branch (`release/2.4`) cut per version | Multiple versions maintained simultaneously (a library with LTS lines, an app with staged rollout across environments) | Real — every backport needs cherry-picking to each maintained branch |

Default to trunk-based: tag off `main` at release time, and only branch per
release when there is a genuine, current obligation to keep patching an
older line (e.g. a library still supporting a previous major for consumers
who haven't migrated). This mirrors the GitFlow-vs-GitHub-Flow guidance in
`references/branching-and-commits.md` — don't adopt release-branch overhead
speculatively.

When a release branch is genuinely needed:

```
main ────●────●────●────●────●──── (continues receiving new work)
          \
           ●── release/2.4 ──●──●   (only fixes destined for 2.4.x land here)
              v2.4.0        v2.4.1 v2.4.2
```

A fix that belongs in both must be cherry-picked to the release branch, not
authored twice — the release branch is a filtered view of `main`'s fix
commits, never an independent line of development.

## Writing a changelog

### Format: Keep a Changelog

Structure entries under `## [version] - date`, grouped by change type, newest
version first, with an `## [Unreleased]` section at the top that accumulates
entries as they merge:

```markdown
# Changelog

All notable changes to this project are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/), and this
project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Nothing yet.

## [2.4.1] - 2026-09-06

### Fixed
- Webhook retry no longer duplicates the delivery record on a timeout
  (#412).

## [2.4.0] - 2026-08-30

### Added
- `POST /users/:id/deactivate` endpoint (#398).

### Changed
- Default request timeout raised from 5s to 15s (#401).

### Deprecated
- `GET /users/:id/status` — use the `status` field on `GET /users/:id`
  instead. Removal planned for 3.0.0.

### Fixed
- Race condition in the job queue worker pool under high concurrency (#405).

### Security
- Bumped a transitive dependency carrying a known CVE (#409).
```

The category headers (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`,
`Security`) are fixed vocabulary — using them consistently is what lets a
reader scan for "did anything break" (`Fixed`/`Security`) without reading
every line.

### Writing for the reader, not for the commit log

- **Write for the consumer of the release, not for future-you reading git
  history** — "Fixed webhook retry duplication (#412)" tells a reader what
  changed about their experience; "fix: use idempotency key in retry path"
  (a fine commit message) does not, on its own, tell them whether it affects
  them.
- **Every entry that changes behavior links its issue or PR** — a reader
  who needs the detail can follow the link; the changelog itself stays
  scannable.
- **A breaking change gets its own visible callout**, not just a `Changed`
  bullet indistinguishable from a cosmetic one — see the migration-guidance
  cross-reference in `deprecation-and-migration` when a change requires
  consumer action.
- **Skip changes with no user-visible effect** (internal refactors, CI
  config, dependency bumps with no behavior change) — a changelog that lists
  everything is as unreadable as no changelog; it exists to answer "what do
  I need to know", not to be a complete diff.

### Conventional-commits-driven generation

When commits already follow Conventional Commits (`feat:`, `fix:`, `chore:`,
etc. — see `references/branching-and-commits.md` for this project's commit
format), a changelog can be generated rather than hand-written per release,
using a tool such as `conventional-changelog`, `release-please`, or
`changesets`:

- `feat:` commits → `Added`/`Changed` entries
- `fix:` commits → `Fixed` entries
- a `BREAKING CHANGE:` footer or a `!` after the type (`feat!:`) → a
  breaking-change callout and, per the version-bump rules below, forces a
  major bump
- `chore:`, `docs:`, `test:`, `ci:` commits are typically excluded from the
  generated changelog entirely — they're real commit history but not
  release-note material

**Generated is a first draft, not the final text.** Run the generator, then
edit for the "written for the reader" rules above — a raw commit-message
list reads like git history because it is git history with the prefix
stripped.

## Semantic version bump rules

SemVer's `MAJOR.MINOR.PATCH` means something different depending on whether
there is a real external consumer of the version number.

### For a library or package (real consumers pin to a version)

| Bump | When |
|---|---|
| **MAJOR** | Any breaking change to the public API — a removed export, a changed function signature, a changed default that alters behavior for existing callers, a raised minimum supported runtime/language version |
| **MINOR** | A backward-compatible addition — a new export, a new optional parameter, a new feature that doesn't change existing behavior |
| **PATCH** | A backward-compatible bug fix — the public API is unchanged, behavior now matches what was documented/intended |

The test that decides MAJOR vs MINOR: **can every consumer currently on the
previous version upgrade with zero code changes and get correct behavior?**
If yes, it's not a major bump, regardless of how large the diff is
internally. If no — even a "small" change like tightening input validation
that now rejects something it used to silently accept — it is a major bump.

A deprecation is a MINOR (it adds a warning, doesn't remove the capability
yet); the actual removal that follows it is a MAJOR. See
`deprecation-and-migration` for the deprecate-then-remove sequencing this
implies.

### For an application (deployed, no external consumer pins to it)

There is no external contract to break, so the same rigor doesn't apply the
same way — but the version number is still useful as a release identifier
and for internal API contracts (mobile app talking to a backend, for
example):

- **MAJOR** — a change that breaks compatibility for something that *does*
  depend on the version boundary even without pinning to it: a mobile client
  built against API v1 that a v2 backend deployment would break, a data
  migration that isn't backward compatible with the previous release still
  running during a rolling deploy.
- **MINOR** — a new feature shipped.
- **PATCH** — a bug fix, a dependency bump, a config change — anything that
  doesn't add user-visible capability.

Many applications skip strict SemVer semantics entirely and use
date-based or build-number versioning (`2026.09.06`, build `4821`) instead,
which is a legitimate choice specifically *because* there's no external
consumer parsing the version number to decide compatibility — don't force
library-grade SemVer discipline onto a deploy-only application if date/build
versioning already answers "which release is this" just as well. Pick one
scheme per project and keep it consistent; the failure mode to avoid is
switching schemes mid-project so old and new version numbers aren't
comparable.

### Pre-release and build metadata

- Pre-release: `2.4.0-beta.1`, `2.4.0-rc.2` — sorts before `2.4.0` per
  SemVer precedence rules, use for versions not yet ready for general
  consumption.
- Build metadata: `2.4.0+20260906.a1b2c3d` — carries no precedence weight,
  use for tying a version to a specific build/commit without implying it's
  a different release.

## Anti-patterns

| Anti-pattern | Why it hurts | Instead |
|---|---|---|
| Retagging a published release tag | Two pulls of the same tag get different code; breaks reproducibility | Ship a new patch version instead |
| Changelog entries copy-pasted from commit messages verbatim | Reads as git history, not as "what does this mean for me" | Edit for the reader; link the commit/PR for detail |
| Treating a behavior-changing default as a MINOR | Silently breaks consumers relying on the old default | MAJOR — "zero code changes still works" is the actual test |
| Release branch created "just in case" with no current LTS obligation | Every fix now needs cherry-picking to a branch nobody consumes | Trunk-based release until a real multi-version obligation exists |
| Mixing date-based and SemVer versioning in the same project's history | Version numbers become incomparable; nobody can tell what's newer | Pick one scheme at project start, keep it for the project's life |
| Changelog with no `[Unreleased]` section | PRs merge with no agreed place to record their entry; changelog falls behind releases | Keep `[Unreleased]` at the top, move it to a version on cut |

## Provenance

Adapted from general industry practice — Keep a Changelog, Semantic
Versioning 2.0.0, and Conventional Commits' changelog-generation convention
— see `skills/git-and-release-ops-edho-ferdian/SKILL.md` provenance note for
comparison of house style. No single ECC agent covers release/changelog
practice; this file extends `references/branching-and-commits.md`'s commit
format into what those commits enable at release time.
