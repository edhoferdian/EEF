# Data isolation and lifecycle — ISO-SEC-01..08

**Activation.** The scope stores multi-tenant or access-controlled data,
derives search, cache, index or analytics copies, issues object links,
exports or restores records, migrates schemas, or promises deletion,
revocation or retention. This file follows one data item through every copy
and state change. Adapted from the data-isolation companion of
[cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill)
(MIT, `c1c8a8c`), in this skill's own wording.

**Already covered — extend, do not duplicate:** endpoint-level IDOR
(**SEC-05**), RLS, privilege and concurrency in the database itself
(`domain-specific.md` §Database, SEC-04a..d), public buckets and storage
policy at the provider (**CLOUD-SEC-02**, **CLOUD-SEC-13**), export and
import abuse as a feature (`full-audit-attack-classes.md` §Feature abuse).

**Discipline.** A tenant or owner field on a record is not isolation — find
the query, key, path or policy that enforces it on each read and write.
Sanitized primary data can become unsafe in search, cache, analytics,
export, previews, logs, replicas and backups with different ACLs and
retention. A privacy or retention preference is not automatically a
vulnerability: require an explicit access boundary or deletion/revocation
promise and an unauthorized reader or later operation. External storage
policy, CDN behaviour, replica lag and backup access are **Needs
validation**.

## Tenant and object isolation

- **ISO-SEC-01 Tenant scope missing on a path** — a read, update, delete,
  list, count or bulk query that identifies an object without binding it
  to the authenticated tenant or owner, or takes that identity from the
  request body. Compare direct lookup with nested relations, background
  jobs, admin, import and legacy paths.
- **ISO-SEC-02 Key and namespace collision** — cache keys, object paths,
  uniqueness constraints, search document IDs, temp files or dedup keys
  that omit tenant or environment, so two principals overwrite or read the
  same logical key.
- **ISO-SEC-03 Policy and query disagree** — RLS, ORM default scopes and
  authorization filters applying different predicates from raw or service
  clients (`unscoped`, service-role keys); joins, aggregates, views and
  error paths where the tenant context is missing.
- **ISO-SEC-04 Object links outliving access** — attachment IDs, version
  IDs, share links or signed URLs that allow other operations or objects
  than the issuer could, or stay valid after the ACL changes. Bind
  operation, exact object and version, audience, expiry and tenant.

## Derived copies

- **ISO-SEC-05 Copies with drifting ACLs** — search indexes, caches,
  embeddings, thumbnails, previews, feeds, analytics, logs, traces and
  diagnostics that keep private content after the source record's ACL or
  lifecycle changes, or expose it to readers with broader access or longer
  retention. Filter at retrieval time as well as ingestion. Counts,
  filters, ordering, unique-constraint errors and existence checks that
  reveal a concrete confidential fact belong here too.

## Export, restore, migration, deletion

- **ISO-SEC-06 Export, import and restore authority** — an export,
  snapshot or backup that includes other tenants, inaccessible fields,
  soft-deleted data or secrets (authorize each item after selection, and
  the download of the final artifact); an import or restore that bypasses
  owner, schema, ACL or uniqueness rules, overwrites existing resources or
  writes into a tenant the requester cannot write. Treat archive contents
  as untrusted input.
- **ISO-SEC-07 Migration defaults** — old records without tenant, ACL or
  lifecycle fields; colliding IDs; dual-read/write or partial rollout where
  old and new readers apply different defaults; rollback and resumed
  migrations.
- **ISO-SEC-08 Deletion and revocation that do not stick** — direct
  lookup, search, relation traversal, links, background processors or
  restore that ignore the soft-delete or revoked predicate; deleted
  identifiers re-registrable while references remain; membership removal,
  role downgrade, consent withdrawal or secret revocation that leaves
  sessions, caches, subscriptions, jobs or materialized data still
  authorizing; queued work, retries and exports that recreate deleted
  data; undo, undelete or replica recovery that restores credentials or
  permissions current policy no longer allows. Replicas, backup keys and
  restore environments with broader scope than primary data are Needs
  validation unless the policy is in the repo.

## How to hunt it

Pick one protected record and draw its write, query, cache, index, event,
export, backup, deletion and restore paths, marking principal and tenant on
every edge. Start at bypass clients, background jobs, migrations, global
uniqueness and cache keys — the paths most likely to drop request-scoped
identity. Compare two dummy tenants through the same service methods, then
again after an ACL change, a deletion, an account switch and a restore.
