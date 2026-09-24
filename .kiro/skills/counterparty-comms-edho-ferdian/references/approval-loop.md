# Approval loop — what may leave, and proof of what did

The agent never sends a commitment on its own judgment. Every outbound draft
becomes an obligation, an operator decides on the exact text, and a ledger
proves what was dispatched. Reference schema: `approval-ledger.sql`.

## 1. Objects

| Object | Meaning |
|---|---|
| Obligation | One thing owed to a counterparty. Status `drafted` → `approved` / `rejected` → `sent`. Carries counterparty, channel, direction, and an `epoch` that advances on every re-file. |
| Draft | The exact text, its SHA-256, origin (platform, channel, thread), priority P0–P3. One current draft per obligation. |
| Decision | Approve or reject by an identified operator, with a nonce and the epoch it was made against. |
| Approval snapshot | Immutable copy of text, hash, epoch and destination written in the same transaction as an approve decision. Only a snapshot can authorise dispatch. |
| Claim | Durable reservation with a random token; at most one active claim per obligation. |
| Delivery | Receipt row for one (obligation, decision) pair. |

## 2. Filing a draft

1. **Clean inputs.** Strip control characters, collapse whitespace in
   single-line fields, enforce length caps. Refuse empty or oversized input —
   never truncate silently.
2. **Baseline gate** (below). It may refuse.
3. **Hash** the text; show the hash prefix on the approval panel so the
   operator knows which text they approve.
4. **Upsert.** If an open `drafted` obligation exists for the same
   (counterparty, channel), replace its draft and advance `epoch`. That
   advance is what voids any decision made against the old text.
5. **Receipt goes internal only** — to a configured, verified internal ops
   destination, or else the internal tool result. Never to the origin
   channel unless the origin *is* that verified internal destination; never
   to an unknown origin as a fallback.

Filing does not authorise any external reply. A neutral clarifying message,
if allowed at all, is a separate decision under `channel-discipline.md`.

## 3. Baseline gate

Before filing, look up the counterparty's current state (contract store, CRM,
ledger):

- Signed or delivered contract on record → refuse, citing the evidence.
  Re-asking a counterparty for specs after signature is the failure this
  gate exists for.
- Explicit operator override → allow, and stamp
  `[BASELINE_OVERRIDE_SIGNED_CONTRACT]` into the draft context.
- Gate unavailable → allow, and stamp `[BASELINE_CHECK_UNAVAILABLE]` so the
  approver sees the guard was off. A failing gate never silently disables
  itself.
- Otherwise attach the freshest few facts as `[BASELINE FACTS: …]`.

## 4. Deciding

The panel lists `drafted` obligations the operator owes a reply on. Approve or
reject writes the decision with the epoch it was shown, and flips status in
the same transaction. A decision whose epoch is not the current one is stale
and releases nothing.

An approve decision writes the immutable snapshot in that same transaction.
The writer must already have authenticated the operator; the schema records
authority, it does not create it. Legacy approvals without a snapshot need a
fresh approval — never backfill permission from the current, mutable draft.

## 5. Dispatch state machine

| State | Next |
|---|---|
| claimed | dispatching, or cancelled (before dispatch only) |
| dispatching | delivered, or unknown |
| unknown | delivered, via trusted reconciliation only |
| delivered, cancelled | terminal |

1. **Claim.** In one immediate/serialisable transaction: re-validate current
   epoch, exact text, recomputed hash and full destination against the
   snapshot; insert the claim. A uniqueness conflict means another worker
   won — stop before touching transport.
2. **Begin dispatch.** Re-validate and move `claimed → dispatching` by token.
   Only this winner receives the text and destination, after commit. Never
   regenerate or re-read mutable text for transport. No transaction stays
   open across the network call.
3. **Complete.** On confirmed success, record the provider's message
   coordinate, mark the claim delivered and the obligation `sent`, in one
   transaction. Repeating an identical completion is a no-op.
4. **Unknown.** Timeouts, exceptions, a worker dying after begin-dispatch, or
   a failed receipt write → `unknown`. Unknown never expires, never reopens,
   never auto-retries, and blocks further decisions for that obligation.
   Only a trusted caller with confirmed evidence reconciles it.

The guarantee is **at most one automatic attempt per approval**, not
exactly-once delivery: a crash after begin-dispatch may leave zero sends and a
held claim. That is deliberate — the alternative risks a duplicate message.

While a claim is active, obligation, draft and decision rows for it are
frozen; cancel a still-`claimed` operation by token before re-filing.

Internal receipt footers stay internal:
`approved by <operator> · receipt <decision_id> · sha256 <prefix>`.
Never append workflow metadata to already-approved external text.

## 6. Optional time-boxed auto-approval

A draft may carry `auto_send_after`. A sweep approves it as operator
`auto-ttl` once the deadline passes with no decision. Operator actions win:
a decision flips status first, a re-file rotates the epoch and clears or
moves the deadline, and the sweep re-checks status and epoch inside its write
transaction. Drafts without a deadline wait for a human forever. Keep
draft-only commitment classes (prices, contract language) out of auto-ttl
unless the operator explicitly opts that class in.

## 7. Signal linkage

A draft may name the inbound obligation it answers. That link is the only
honest basis for response-latency metrics; reject a filing that points at a
row that does not exist.

## 8. Invariants to test

- Filing receipts reach only verified internal destinations; unknown origins
  stay quiet; no external fallback.
- Same (counterparty, channel) filed twice → one obligation, two epochs.
- A stale-epoch decision never produces a delivery.
- Two concurrent claimants → one dispatch; the loser never calls transport.
- Unknown outcomes and failed receipt writes never trigger a retry.
- Completion writes receipt and `sent` atomically.
- Altered epoch, text, hash or destination cannot claim or begin dispatch.
- Active claims block re-filing until cancelled pre-dispatch.
- Gate unavailable stamps its marker; signed contract refuses without override.
- Auto-ttl never releases text the operator has since re-filed.

Test with temporary databases, separate connections and a simulated
transport counter — never a real provider or a real counterparty.
