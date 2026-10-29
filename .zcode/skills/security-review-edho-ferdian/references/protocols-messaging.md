# Protocols, RPC and messaging — MSG-SEC-01..08

**Activation.** The scope uses gRPC, GraphQL transports, Protobuf, Thrift,
Cap'n Proto, a custom binary protocol, streaming RPC, webhooks, brokers,
queues, pub/sub or an event bus. This file covers peer identity, how a
message is interpreted, routing, replay, ordering and delivery. Adapted
from the protocols companion of
[cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill)
(MIT, `c1c8a8c`), in this skill's own wording.

**Already covered — extend, do not duplicate:** webhook signature compared
with `==` (**SEC-10**), HTTP framing (`web-protocol-auth.md`), availability
impact (`resource-exhaustion.md`), parser memory safety
(`memory-safety-native.md`), provider event envelopes (**CLOUD-SEC-13**).

**Discipline.** "Internal" is not authentication — name the peer identity
at every hop and how it becomes the principal used for authorization.
Schema validation proves shape, not provenance, authority, ordering or safe
values. Broker guarantees are not application guarantees: write down retry,
ordering, ack, dedup and transaction behaviour before judging a state
change. A parser disagreement needs two concrete consumers and one
security-relevant value they read differently. Broker ACLs, mesh identity
and topic attachment outside the repo are **Needs validation**.

## Interpretation

- **MSG-SEC-01 Two readers, two meanings** — components disagreeing on
  length, compression, duplicate or unknown fields, encoding, numeric width,
  normalization, or whether envelope or body wins; unknown enum variants,
  missing discriminators, zero values or compatibility mappings reaching
  code that assumes a validated case (an old consumer reading a newly added
  field as a default privilege).
- **MSG-SEC-02 Envelope and payload disagree** — authorization uses routing
  or envelope metadata while the handler acts on a different tenant,
  account, subject or sender named in the body. One source must be
  authoritative and the client must not override it.

## RPC identity

- **MSG-SEC-03 Interceptor gaps** — authn/authz interceptors on unary
  methods but not on streams, reflection, health, gateway-transcoded routes,
  compatibility services or individual stream messages.
- **MSG-SEC-04 Channel identity vs claimed principal** — mTLS, workload
  identity, bearer metadata or broker credentials authenticate the channel
  while a caller-controlled field picks the user or tenant, with no
  deterministic binding between them.
- **MSG-SEC-05 Authorized once, trusted forever** — a stream, subscription
  or batch authorized at the start while later items name other resources
  or continue after role change or token revocation; predictable, reused
  or cross-tenant correlation IDs that let a reply, webhook, cancellation or
  ack satisfy someone else's pending operation.

## Brokers and queues

- **MSG-SEC-06 Topic and routing scope** — a publisher or subscriber able
  to pick another tenant's topic, wildcard, consumer group, partition, reply
  queue or dead-letter route (tenant text inside the payload is not
  isolation); dead-letter queues, error topics, traces or operator views
  holding secrets or cross-tenant payloads readable by a lower-trust
  consumer.
- **MSG-SEC-07 Message claims to be the control plane** — a body that
  declares itself an admin event, provider callback, replication record or
  migration instruction, handled with privilege without an independently
  authenticated producer and event type.

## Replay and ordering

- **MSG-SEC-08 Delivery semantics break an invariant** — redelivery
  repeating a non-idempotent side effect (dedup missing, done after the
  mutation, or keyed so it collides across tenants); stale messages —
  older state, revoked membership, cancelled work — accepted after newer
  ones; ack before durable commit (lost security work) or commit before an
  unreliable ack (duplicated mutation); several consumers jointly
  implementing one authorization transition that partial failure leaves
  half done.

## How to hunt it

Draw producer → broker/transport → gateway → consumer → storage for each
message family, recording at every hop the authenticated peer, the
authoritative tenant and resource fields, validation, and side effect.
Compare normal, retry, dead-letter, replay, migration, reflection, stream
and transcoded routes — policy must survive a change of transport. Think
through duplicate, missing, unknown, boundary, replayed and reordered
messages against an in-memory transport, never by producing load.
