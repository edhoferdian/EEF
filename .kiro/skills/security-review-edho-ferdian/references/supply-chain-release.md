# Supply chain and release — SUP-SEC-01..08

**Activation.** The scope resolves dependencies, builds from outside
contributions, runs CI, produces or signs release artifacts, ships an
updater, or loads plugins/extensions. Adapted from the supply-chain
companion of
[cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill)
(MIT, `c1c8a8c`), in this skill's own wording.

**Already covered elsewhere — do not duplicate:** dependency CVEs and
pinning (**SEC-07**); long-lived cloud keys in CI, over-broad `permissions:`,
actions on a mutable tag, `pull_request_target` with a PR-head checkout,
`npm install` instead of `npm ci` (**CLOUD-SEC-05**); secrets baked into
image layers and `.dockerignore` gaps (§Containers); unpinned MCP servers
(**AGENT-SEC-06**). This file covers the trust *handoffs* between source,
build, artifact and the user who runs it.

**Discipline.** A mutable or vulnerable dependency is not a finding by
itself: show who can influence resolution, which build consumes it, and
what execution or release boundary follows. CI configuration is
authorization code — establish the trigger, whose code runs, which secrets
and tokens exist, and what the job may publish. A checksum fetched from the
same place as the artifact proves nothing. Branch protection, hosted
runners, registry settings and signing services the repo cannot show are
**Needs validation**.

## Build inputs

- **SUP-SEC-01 Dependency source confusion** — resolver config that can
  pick an unintended namespace, fallback registry, mirror or source URL:
  an internal package name also resolvable on the public registry, a
  scope without a pinned registry, alternate build files or
  platform-specific resolution that ignores the lockfile, first install
  behaving differently from update.
- **SUP-SEC-02 Mutable or unreviewed build inputs** — branches, tags,
  unverified submodules, `curl | sh` tool downloads, remote includes,
  generated assets or container tags whose content can change without
  review, with a lower-trust writer and a path into trusted output.
  Generated clients, vendored archives, binary blobs and codegen output
  that ship without the review and integrity gate source gets belong here
  too — compare regeneration with the committed output.
- **SUP-SEC-03 Build context leaks into the artifact** — secrets, local
  config, `.git`, fixtures or developer files packaged because the build
  context or `files`/`include` list exceeds the intended release inputs.
  Confirm the artifact actually exposes a real credential or private data.

## CI and automation

- **SUP-SEC-04 Workflow expression or command injection** — branch names,
  PR titles, commit messages, issue fields, artifact names or matrix values
  interpolated into a `run:` shell, a template expression or a path
  (`run: echo "${{ github.event.pull_request.title }}"`). Pass them through
  `env:` and quote; never splice into the script. This is **SEC-04** at the
  CI layer.
- **SUP-SEC-05 Lower-trust job feeds a higher-trust one** — a fork or PR
  job writes a cache, artifact, shared workspace or output that a
  protected job later restores and executes or releases; cache keys and
  artifact names not namespaced by trust level; promotion that re-resolves
  by mutable name instead of digest. Also: CI permissions broader than the
  operation *and* untrusted input selects the affected resource — missing
  least privilege alone is hardening.

## Release and update

- **SUP-SEC-06 Build-to-release substitution** — tests, review, signature
  and publication refer to mutable tags, filenames, channels or artifact
  IDs instead of one immutable digest; check every copy, repack and
  architecture merge between build and release.
- **SUP-SEC-07 Signature without policy** — a release or signature accepted
  from the wrong workflow, repository, branch, environment, key role or
  threshold; the consumer checks that *a* valid signature exists but not
  the identity claims inside the attestation; rotation, expiry or
  revocation that fails open.
- **SUP-SEC-08 Updater and plugin trust** — an updater that authenticates
  payload bytes but not version, product, platform, channel, target path,
  expiry or rollback state, or takes metadata and payload from different
  transactions; non-atomic install with no recovery. A plugin or extension
  that gains host authority beyond its declared scope, a publisher able to
  replace another publisher's identity, or install hooks that run before
  authenticity and capability checks. Installing arbitrary same-user
  plugins by design is not a boundary.

## How to hunt it

Walk backward from a released digest or installed update to every source,
generated input, credential, worker, cache, test result and authorization
decision. Put untrusted and protected workflow events side by side and mark
every persisted channel between them (cache, artifact, output, comment);
each crossing needs an immutable identity and a trusted producer. Review the
failure paths — revoked key, failed download, missing attestation, partial
platform release, rollback, registry outage — because the failure policy is
part of release integrity. Never publish or alter a real release to test.

## Severity hints

- 🔴 untrusted contributor code reaching release or deploy credentials
  (SUP-SEC-04/05 on a protected job); an updater accepting unsigned or
  wrongly-signed payloads for every user.
- 🟠 dependency confusion on an internal package name; a cache or artifact
  poisoning path into a release job.
- 🟡 a build-context leak of non-production secrets; mutable inputs with a
  plausible but narrow writer.
