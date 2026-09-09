# Domain-Specific Security Checklist

Migrated from the security-relevant sections of `code-review-edho-ferdian`'s
conditional lenses (`database-lens.md`, `healthcare-lens.md`) plus the
security handoff notes already present in `rag-lens.md` and `mle-lens.md`.
Those lens files keep their non-security content in place (query
performance, clinical scoring correctness, retrieval quality, ML leakage) —
this file is the single source of truth for the security-specific pieces.

**Activation.** Same triggers as the source lenses in `code-review-edho-
ferdian` — this file doesn't redefine them: database (`*.sql`,
`migrations/`, ORM schema, `supabase/`), healthcare (clinical/EMR/HL7-FHIR
data), RAG (vector store/embedding/retrieval code), ML (training/serving/
eval pipeline), containers (`Dockerfile`, `docker-compose.yml` — this last
one is a new, original addition in this file, not migrated from an existing
`code-review-edho-ferdian` lens).

---

## Database — SEC-04a..d (RLS, privilege, concurrency)

Migrated verbatim from `code-review-edho-ferdian/references/database-lens.md`
(content credited to Supabase). `database-lens.md` keeps its non-security
content (PERF-07a..f query/schema findings) — this section is the security
half.

**Ground-truth requirement.** Do not label an RLS/privilege finding [High
confidence] without actually inspecting the policy definition or running a
privilege-check query. Reading a schema and guessing is reasoning, not
verification.

- **SEC-04a RLS policy calls the auth function per row** — a Postgres RLS
  policy that calls `auth.uid()` (or an equivalent) directly gets
  re-evaluated once per row; the fix is the `(SELECT auth.uid())` wrapper
  pattern, which Postgres can evaluate once and reuse. Flag any policy
  missing this wrapper on tables with meaningful row counts.
- **SEC-04b RLS policy columns not indexed** — a policy filtering on a
  column (e.g. `user_id = (SELECT auth.uid())`) needs that column indexed,
  or every row-level check becomes a scan.
- **SEC-04c Least-privilege / `GRANT ALL` anti-pattern** —
  application-role grants broader than the app needs, especially
  `GRANT ALL` to a role used by a general-purpose connection string; also
  flag public schema permissions left un-revoked.
- **SEC-04d Concurrency — missing `SKIP LOCKED` / lock ordering / long
  transactions** — a queue-consumption pattern that doesn't use
  `SKIP LOCKED` (serializes workers that should run in parallel);
  transactions held open across an external API call (extends lock duration
  unpredictably); inconsistent lock acquisition order across code paths
  (deadlock risk) — flag in favor of a consistent order, e.g.
  `ORDER BY id FOR UPDATE`.

### Severity guidance

- 🔴 **CRITICAL** — RLS missing entirely on a multi-tenant table with
  sensitive data, or a `GRANT ALL` that gives the application role
  destructive access it doesn't need.
- 🟠 **HIGH** — the per-row `auth.uid()` RLS pattern on a high-traffic table;
  a confirmed race condition on a balance/quota decrement (cross-reference
  general SEC-04).
- 🟡 **MEDIUM** — schema/permission choices that will cause pain later but
  aren't causing an incident today.
- 🔵 **LOW** / ⚪ **INFO** — same discipline as the general checklist: a
  Medium-confidence suspicion you couldn't verify because the database
  wasn't reachable is reported, but labeled accordingly.

- **SEC-04e Tabel audit yang bisa ditulis-ulang oleh role penulisnya
  (append-only tidak ditegakkan)** — sebuah tabel audit/event/ledger yang
  dimaksudkan sebagai catatan otoritatif, tapi role aplikasi yang menulisinya
  juga memegang UPDATE dan DELETE atasnya. Jejaknya lalu hanya sekuat
  kredensial yang paling mungkin disalahgunakan: siapa pun yang bisa
  menyisipkan baris juga bisa menghapus jejak dirinya sendiri, dan insiden
  tidak bisa direkonstruksi. Ini adalah pasangan lapisan-aplikasi dari
  **CLOUD-SEC-07** dan penegak lapisan-data dari general **SEC-13** — SEC-13
  memastikan event yang benar *tercatat*, SEC-04e memastikan catatan itu
  masih ada saat dibutuhkan.

  Tegakkan append-only di database, bukan di kode aplikasi (kode aplikasi
  adalah pihak yang sedang dibatasi). Di Postgres/Supabase pola minimalnya:

  ```sql
  ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "audit_insert_only" ON audit_log FOR INSERT
    TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
  CREATE POLICY "audit_no_modify" ON audit_log FOR UPDATE USING (false);
  CREATE POLICY "audit_no_delete" ON audit_log FOR DELETE USING (false);
  ```

  (`(SELECT auth.uid())` bukan `auth.uid()` — lihat **SEC-04a**.) Di luar
  Postgres, mekanik setaranya: GRANT hanya INSERT+SELECT ke role aplikasi,
  atau storage append-only/WORM.

  **Ground-truth.** Jangan beri label [High confidence] tanpa benar-benar
  membaca definisi policy atau GRANT-nya. Adanya tabel bernama `audit_log`
  bukan bukti bahwa tabel itu append-only.

  **Jebakan false-positive.** Sebuah tabel *event* biasa (webhook inbox,
  outbox job, cache) bukan temuan ini — kode ini hanya berlaku bila tabelnya
  diperlakukan sebagai catatan otoritatif oleh alur compliance, forensik,
  atau billing. Retensi terjadwal yang menghapus baris kedaluwarsa lewat role
  administratif TERPISAH juga bukan temuan; yang jadi temuan adalah role
  penulis yang sama memegang hak hapus.

  🟠 **HIGH** bila tabelnya adalah satu-satunya jejak untuk akses data
  sensitif, aksi admin, atau event yang berdampak uang. 🟡 MEDIUM selain itu.

**Non-security database findings** (query performance, index design, schema
type choices, pagination) stay in `code-review-edho-ferdian/references/
database-lens.md` as PERF-07a..f — not duplicated here.

---

## Healthcare / Clinical — PHI handling

`code-review-edho-ferdian/references/healthcare-lens.md` already
cross-references **SEC-06** (this skill's `general-checklist.md`) for
PHI-in-URL findings rather than duplicating it — that cross-reference now
points here as the source of SEC-06's definition. No new content to migrate:
the healthcare lens's `HC-01..06` codes (clinical scoring correctness, drug
interaction coverage, ICD-10/SNOMED mapping, HL7/FHIR handling,
encounter-lock/addendum workflow, non-dismissable critical alerts) are
patient-safety/clinical-correctness concerns, not security criteria in the
OWASP sense, and stay owned by `healthcare-lens.md` — this file does not
absorb them.

**Pembaruan.** Satu mekanik generik akhirnya memang bermigrasi dari
`healthcare-phi-compliance`: penegakan audit-trail append-only, sekarang jadi
**SEC-04e** di §Database di atas. Framing PHI-nya dilepas — aturannya berlaku
untuk tabel audit apapun, bukan hanya yang klinis.

**What this file does own:** the general reminder that PHI is a sensitive
identifier under **SEC-06** — never in URL parameters/query strings, never
in logs, never sent to a client that doesn't need it — and that a
cascade-delete path reachable on a table holding clinical data (SEC-04c-
adjacent least-privilege territory, or a plain FK-cascade finding under
`database-lens.md`) should have its severity floor raised given the clinical
stakes, per `healthcare-lens.md`'s own severity guidance.

---

## LLM & agent pipelines

`code-review-edho-ferdian/references/rag-lens.md` already names, without
duplicating, the security-adjacent concerns that fall outside its own
retrieval-quality scope: untrusted retrieved content, prompt injection via
retrieved documents, authorization on retrieved data, and egress of
sensitive retrieved content. There is no dedicated RAG security checklist
item yet in any source material — when reviewing a RAG pipeline, treat these
as instances of the general checklist:

- Untrusted retrieved content reaching the LLM prompt unfiltered → **SEC-01**
  (input sanitization; the retrieved chunk is "input" from the system's
  perspective even though it didn't come directly from the end user).
- Prompt injection via a retrieved document instructing the model to ignore
  its instructions or exfiltrate data → **SEC-01**, evaluated with the same
  rigor as any other untrusted-input path.
- A retriever that doesn't scope results to what the requesting user is
  authorized to see (cross-tenant or cross-user document leakage via
  retrieval) → **SEC-05** (IDOR, applied to retrieval instead of a direct
  object reference).
- Sensitive retrieved content (PII, secrets embedded in indexed documents)
  forwarded into a response, log, or third-party LLM API call → **SEC-06**.

If a RAG-specific pattern here proves common enough to need its own code,
add it to `general-checklist.md` (or a new `RAG-SEC-##` block in this file)
rather than letting `rag-lens.md` grow its own parallel copy.

### Agents with side-effectful tool authority — AGT-01..04

Generalized away from any single crypto-specific framing.
**Activation.** The scope includes an LLM agent that
can take actions with real-world consequences — sending email or messages,
writing to a database, calling a paid API, executing shell commands, moving
money, or modifying infrastructure. The retrieval-side concerns above still
apply; these are about the *action* side.

- **AGT-01 Prompt injection treated as a content problem instead of a
  privileged-action problem** — when the model can act, an injected
  instruction in retrieved or ingested content is not a bad-output bug, it is
  an unauthorized-action bug with the agent's full authority behind it.
  Flag: external content (a web page, a document, an issue body, a webhook
  payload, a social feed, an on-chain memo) concatenated into an
  execution-capable prompt with no separation between instructions and data,
  and no filtering of imperative/exfiltration patterns before it enters the
  context.

- **AGT-02 Limits enforced in the prompt instead of in code** — a spend cap,
  a rate cap, a "never delete production data" rule, or an allowlist of
  permitted recipients that exists only as an instruction to the model. The
  model is not a security boundary. Every limit that matters must be a
  deterministic check in the tool implementation, evaluated on the concrete
  arguments the model produced, and it must reject rather than warn. Flag any
  irreversible tool whose only guard is prompt wording. 🔴 CRITICAL where the
  action is irreversible (funds movement, deletion, public publication).

  **Sub-cek — batas yang bisa dinaikkan sendiri.** Batas yang ditegakkan di
  kode masih runtuh bila mekanisme *pengubah* batas itu sendiri terpapar ke
  model. Periksa daftar tool: `set_policy`, `update_limits`,
  `configure_budget`, `set_allowlist`, atau tool konfigurasi apapun yang
  melonggarkan sebuah guard **tidak boleh** ada di dalam permukaan tool yang
  bisa dipanggil agent. Policy di-set orkestrator sebelum delegasi, atau di
  pre-task hook — sisi agent hanya boleh punya operasi baca (`check_spending`,
  `get_balance`, `list_transactions`). Injeksi yang menemukan tool penaik-
  batas tidak perlu membobol guard apapun; ia cukup memintanya dinaikkan.

  Cek yang sama berlaku di luar konteks uang: sebuah agent yang bisa memanggil
  tool untuk memperluas allowlist path-nya sendiri, menaikkan rate limit-nya
  sendiri, atau menonaktifkan dry-run-nya sendiri secara efektif tidak punya
  batas itu. Cross-reference **AGENT-SEC-02** (permukaan tool yang terlalu
  permisif di lapisan konfigurasi harness) — ini varian runtime-nya.
  🔴 CRITICAL bila batas yang bisa dinaikkan sendiri itu menjaga aksi
  irreversible.

- **AGT-03 No dry-run / simulation and no confirmation on irreversible
  actions** — an irreversible tool call executed straight from model output,
  with no preview step whose result is checked against an expected outcome
  before committing, and no human confirmation on the highest-impact class of
  action. Where the platform supports it (a transaction simulation, a
  `--dry-run`, a `SELECT` before the `DELETE`, a diff before the write), the
  simulated result should be compared against a caller-supplied expectation
  and the action aborted on mismatch — not merely logged.

- **AGT-04 Missing circuit breaker, blast-radius isolation, and decision
  audit log** — no automatic halt on repeated failures or anomalous outcomes;
  the agent holding credentials with far more authority than its task needs
  (production admin instead of a scoped service account; a treasury wallet
  instead of a funded hot wallet; a full-access API key instead of a
  read-scoped one); and an audit log that records only successful actions,
  so an incident cannot be reconstructed from what the agent *decided* and
  *attempted*. Log every decision and every rejected attempt, not just the
  sends. Cross-reference general **SEC-13** and **AGENT-SEC-02** above.

---

## Containers — Dockerfile / Compose hardening

**Activation.** Reviewing a `Dockerfile`,
`docker-compose.yml`/`docker-compose.*.yml`, or an equivalent container
build/orchestration file.

No dedicated `SEC-##` codes exist yet for this domain — file findings under
general **SEC-11** (security misconfiguration) unless noted otherwise below,
and promote a new `CONT-SEC-##` block here if container findings become
common enough to need their own codes.

- **Running as root — missing `USER` directive, or an explicit root user** —
  a Dockerfile with no `USER` instruction runs the container process as root
  by default; a compromised process then has root inside the container
  (and, on a container-escape bug, a much shorter path to root on the host).
  Require a non-root `USER` line (`RUN addgroup ... && adduser ...` then
  `USER app`), placed after any step that legitimately needs root (package
  installs) and before `CMD`/`ENTRYPOINT`.
- **Missing `cap_drop: [ALL]` in Compose** — without it, a container keeps
  the full default Linux capability set even though almost no application
  process needs more than a couple of them (e.g. `NET_BIND_SERVICE` to bind
  a port below 1024). Flag a service definition with no `cap_drop`, and
  verify any `cap_add` alongside it is narrowly scoped (a bare `cap_add`
  without a preceding `cap_drop: [ALL]` still leaves the full default set
  present).
- **Missing `read_only: true` root filesystem** — a container that only
  needs to write to its declared volumes (or a `tmpfs` mount for genuine
  scratch space) but runs with a writable root filesystem gives a compromised
  process a place to drop and execute a payload, or persist a backdoor across
  restarts. Flag when a service has no `read_only: true` and no evidence the
  app needs broader write access than its declared `volumes`/`tmpfs`.
- **Missing `no-new-privileges` security-opt** — without
  `security_opt: [no-new-privileges:true]`, a setuid binary inside the
  container can still escalate privileges even if the container itself
  started as a non-root user.
- **Base image pinned to `:latest` instead of a specific tag/digest** — both
  a supply-chain/reproducibility risk and a security concern: `:latest` can
  silently change to a new base image between builds (or between environments
  built at different times), meaning the exact code running in production is
  not the code that was reviewed or tested. Require a specific version tag at
  minimum, and prefer pinning by immutable digest
  (`FROM node:22.12-alpine3.20@sha256:...`) for anything security-sensitive.
- **Secrets baked into image layers** — credentials passed via a Dockerfile
  `ARG`/`ENV` (e.g. `ENV API_KEY=sk-...`), or a `COPY .env .` / `COPY
  credentials.json .` step, land permanently in an image layer: removing the
  file in a later layer does not remove it from the layer history, and
  anyone with pull access to the image (or the layer cache) can extract it.
  Secrets must be injected at runtime instead — `environment`/`env_file` in
  Compose (with the `.env` file itself gitignored), Docker secrets (Swarm
  `secrets:`), or an external secret manager. This is the container-specific
  instance of general **SEC-02**.
- **`.dockerignore` missing entries that let sensitive files into the build
  context** — without `.env`, `.git`, `*.pem`/`*.key`, and similar entries in
  `.dockerignore`, a broad `COPY . .` step copies those files into the build
  context and potentially into a layer, even if no Dockerfile line
  references them by name explicitly. Check `.dockerignore` content against
  what the Dockerfile actually `COPY`s from the repo root; a bare `COPY . .`
  with a thin or missing `.dockerignore` is the highest-risk combination.

### Severity guidance

- 🔴 **CRITICAL** — a real secret confirmed baked into a pushed/distributed
  image layer (not just a `.dockerignore` gap that hasn't been exploited
  yet — see SEC-02 emergency response if confirmed).
- 🟠 **HIGH** — running as root with no `USER` directive on an
  internet-facing service; `:latest` on a base image for a
  security-sensitive production service.
- 🟡 **MEDIUM** — missing `cap_drop: [ALL]`, missing `read_only: true`,
  missing `no-new-privileges`, or a `.dockerignore` gap not yet confirmed to
  have leaked anything.
- 🔵 **LOW** — hardening opportunities on a non-production/dev-only compose
  file (e.g. `docker-compose.override.yml`), where the risk is lower by
  design.

**Non-security container findings** (multi-stage build structure, volume
strategy, service networking, Compose profiles, HMR/dev-server config) are
out of scope for this section — they belong to `docker-patterns` itself, not
this security skill.

---

## Cloud, IaC & CI/CD

**Activation.**
Scope touches Terraform/CloudFormation/CDK/Pulumi, `serverless.yml`, a CI
workflow file (`.github/workflows/*.yml`, `.gitlab-ci.yml`), an IAM policy
document, or platform config for AWS / Vercel / Railway / Cloudflare /
Supabase.

**Ground-truth requirement.** Reading a `.tf` file and reasoning about the
resulting permissions is [Medium confidence] at best. `terraform plan`,
`checkov`/`tfsec`/`terrascan` output, `aws iam simulate-principal-policy`, or
the provider console's own effective-permissions view is verification.

- **CLOUD-SEC-01 IAM over-permission** — a policy granting `"Action": "*"`,
  a service wildcard (`s3:*`, `iam:*`), or `"Resource": "*"` on a role used by
  application code. Scope each statement to the specific actions the app
  actually calls and to specific ARNs. Also flag: long-lived access keys
  issued to a service that could use an instance/workload role instead; a
  human role with no MFA condition; the root account referenced anywhere in
  deploy config; policies attached directly to users instead of groups/roles.
  🔴 CRITICAL when `*`/`*` is on a role reachable by request-handling code;
  🟠 HIGH for a broad service wildcard; 🟡 MEDIUM for a wide but read-only grant.

- **CLOUD-SEC-02 Publicly reachable data store** — an RDS/Cloud SQL instance
  with `publicly_accessible = true`, an S3/GCS bucket with a public-read ACL
  or a bucket policy granting `Principal: "*"`, an Elasticsearch/Redis/Mongo
  endpoint bound to `0.0.0.0` without auth, or a Supabase table exposed
  through the anon key with RLS disabled (cross-reference §Database SEC-04a..c).
  🔴 CRITICAL whenever the store holds user data.

- **CLOUD-SEC-03 Over-open network rules** — a security group / firewall rule
  with `cidr_blocks = ["0.0.0.0/0"]` on anything other than 80/443, and in
  particular on 22 (SSH), 3389 (RDP), or a database port. Admin access belongs
  behind a VPN, bastion, or an identity-aware proxy — not an open port with a
  strong password. Also flag a missing egress restriction on a service that
  handles untrusted input (limits the blast radius of an SSRF under SEC-01).

- **CLOUD-SEC-04 Secrets not in a managed secret store / never rotated** —
  credentials living only in plaintext platform env vars with no rotation and
  no access audit trail. A managed store (AWS Secrets Manager, GCP Secret
  Manager, Vault, Doppler) gives rotation, versioning, and an access log that
  raw env vars do not. Flag: DB credentials with no automatic-rotation policy;
  API keys with no documented rotation cadence; a secret referenced in a
  Terraform `variable` with a committed `.tfvars` default; secret values
  landing in `terraform.tfstate` stored in a bucket without encryption and
  restricted access (state files contain resolved secrets — the state backend
  is itself a secret store). Severity floor 🟠 HIGH for an unencrypted or
  world-readable state backend.

- **CLOUD-SEC-05 CI/CD credential & supply-chain exposure** — a workflow
  authenticating to a cloud provider with a long-lived access key stored as a
  repo secret instead of short-lived OIDC federation
  (`aws-actions/configure-aws-credentials` with `role-to-assume`,
  `google-github-actions/auth` with workload identity). Also flag: a workflow
  with broader `permissions:` than it needs (default `write-all` instead of an
  explicit minimal block, e.g. `contents: read`); an action pinned to a
  mutable tag or branch (`uses: some/action@main`) rather than a commit SHA;
  `pull_request_target` combined with a checkout of the PR head (this runs
  untrusted code with access to repo secrets — 🔴 CRITICAL); `npm install` /
  `composer update` in CI instead of the lockfile-respecting `npm ci` /
  `composer install`; a secret echoed into a log or passed on a command line
  where it lands in process listings.

- **CLOUD-SEC-06 Missing edge protection on an internet-facing service** — no
  WAF/managed ruleset, no platform-level rate limiting or bot protection, and
  no TLS-strict mode, on a service that is publicly reachable. This is
  defense-in-depth, not a substitute for SEC-08 in the application — flag as
  🟡 MEDIUM alongside the application-level finding, never as a replacement
  for it. Include here the response-header set that belongs at the edge rather
  than in app code when a CDN/worker terminates the request:
  `X-Frame-Options`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` (deny unused capabilities: geolocation, microphone,
  camera) — cross-reference general SEC-11.

- **CLOUD-SEC-07 Audit logging, retention, and recoverability gaps** — cloud
  audit logging (CloudTrail / Cloud Audit Logs / VPC flow logs) not enabled;
  log retention shorter than the incident-investigation or compliance window
  (90 days is a common floor); logs writable by the same role that generates
  them (tamperable); no alert wired to failed-auth spikes, IAM policy changes,
  or root-account usage. Also in this code: automated backups disabled or
  untested, no point-in-time recovery on the primary datastore, and
  `deletion_protection = false` on a production database — a destructive
  `terraform apply` or a compromised deploy credential then becomes
  unrecoverable data loss rather than an incident. This is the
  infrastructure-level counterpart of general **SEC-13**.

### Severity guidance

- 🔴 **CRITICAL** — a public data store holding user data; `Action: "*"` /
  `Resource: "*"` on an application role; `pull_request_target` executing
  untrusted PR code with secrets in scope; a real secret confirmed committed
  in a state file or workflow.
- 🟠 **HIGH** — long-lived cloud keys in CI instead of OIDC; SSH/RDP/database
  port open to `0.0.0.0/0`; unencrypted Terraform state backend.
- 🟡 **MEDIUM** — missing WAF/edge rate limiting; unpinned action tags;
  short/absent log retention; no rotation policy on a managed secret.
- 🔵 **LOW** — hardening on a non-production account/stack (dev, preview
  environments) where the blast radius is contained by design.

**Non-security infrastructure findings** (cost, module structure, state
layout, environment promotion strategy) are out of scope here — they belong
to `system-design-edho-ferdian`, not this skill.

---

## Agent & AI-harness configuration

This checklist is framed at this ecosystem's own surface rather than at any
particular third-party CLI or install. Same framing approach as
`skill-audit-edho-ferdian`.

**Activation.** Scope includes `CLAUDE.md`/`AGENTS.md`, `.claude/settings.json`
or `settings.local.json`, an MCP server config, a hook script, or a
`skills/*/SKILL.md` that will be installed and run. Treat these as executable
configuration, not documentation — everything in them reaches a model that
has tools.

- **AGENT-SEC-01 Secrets in agent-readable config** — an API key, token, or
  connection string written directly into `CLAUDE.md`, `settings.json`, an
  MCP server's `env` block, or a skill's reference file. These files are
  routinely committed, shared, and pasted into transcripts. Same fix and
  severity as general **SEC-02**; the aggravating factor is that the value
  also enters the model's context on every session.

- **AGENT-SEC-02 Over-permissive tool allowlist** — `Bash(*)`, a bare `Bash`
  entry, or an allowlist with no corresponding deny list in a settings file;
  an agent/skill definition granting write or shell tools it demonstrably
  does not use. Scope permissions to the specific commands and paths actually
  needed. 🟠 HIGH for unrestricted shell in a config that will be auto-loaded.

- **AGENT-SEC-03 Command injection in a hook** — a hook script interpolating a
  tool payload (file path, command string, user message) directly into a shell
  command. Tool payloads are attacker-influenced whenever the agent reads
  untrusted content. Quote and validate, or pass an argument array — this is
  general **SEC-04** at the harness layer.

- **AGENT-SEC-04 Prompt-injection surface in instruction files** — an
  instruction file that tells the agent to auto-run commands, auto-approve
  actions, or fetch and follow instructions from a URL or a file it does not
  control. Also flag a skill that reads external content (a web page, an
  issue body, a retrieved document) and treats it as instructions rather than
  data — cross-reference **§LLM & agent pipelines** below and general SEC-01.

- **AGENT-SEC-05 Silent failure suppression in hooks** — `2>/dev/null`,
  `|| true`, or a bare `catch {}` in a hook that is supposed to be a security
  or quality gate. A gate that fails open without saying so is worse than no
  gate. Cross-reference general **SEC-13** and
  `code-review-edho-ferdian/references/silent-failure-lens.md` (CQ-05a..e).
  🟡 MEDIUM, or 🟠 HIGH if the suppressed gate is the only control.

- **AGENT-SEC-06 Unvetted MCP server / auto-install** — an MCP server config
  using `npx -y <package>` (installs and executes whatever the registry serves
  at that moment, unpinned), a server that runs an arbitrary shell command, or
  a server pulled from a source with no provenance. Pin versions, prefer
  first-party or self-hosted servers, and treat a new MCP server the same way
  as a new production dependency (**SEC-07**).

---

## ML pipelines — security handoffs (no dedicated codes yet)

`code-review-edho-ferdian/references/mle-lens.md` names one recurring
security-adjacent concern in its own "common blockers" list without owning
it: **secrets, credentials, or PII in datasets, notebooks, logs, prompts, or
artifacts** — cross-referenced there to Domain 2 (SEC), not duplicated. That
maps directly onto:

- **SEC-02** (secret exposure) — credentials/API keys committed inside a
  notebook cell, a training script, or a serialized artifact.
- **SEC-06** (sensitive data) — PII present in a training dataset, feature
  store, or logged prediction, without an anonymization/redaction step.

No further ML-specific security codes exist yet. If model-serving-specific
security concerns emerge (e.g. model-extraction risk, adversarial-input
handling on a public inference endpoint), add them here rather than to
`mle-lens.md`.
