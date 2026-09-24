# Channel discipline — who the agent may speak to, and what it may say

## 1. Trusted destination and audience

Resolve platform, workspace and channel identity from authenticated adapter
facts, then look it up in operator-controlled policy. Display names, message
text, arbitrary metadata, model output and "internal event" flags set by
anything other than the runtime are not credentials. A malformed identity
never matches a trusted policy entry; it is treated as unknown.

| Audience | What an authorised reply may contain |
|---|---|
| External or unknown | The useful final business answer, or a short safe error |
| Trusted internal / private operator | Final answer, safe error, necessary operational facts, progress |
| Muted or deferred | Nothing |

Platform access control applies first. Unknown channels are quiet for
unsolicited traffic. A one-to-one DM can *request* participation but does not
make the audience trusted.

Classification of output is not sanitisation: text classed "external" still
has to be checked for the forbidden content below.

## 2. Participation before work

Default `require_mention: true` for any group containing outsiders. A request
exists only when there is, in the current message:

- an explicit mention of the agent, a recognised agent command, or a direct
  reply to one of the agent's messages; or
- a genuine one-to-one human DM with substantive text or an attachment.

Not requests: the agent having posted earlier in the thread, an active
session, a message addressed to a human, an attachment alone in a group,
group DMs, synthetic events, and bot-authored traffic without a scoped
operator request. "Open question" answering (no mention) needs an explicit
trusted channel policy; the model deciding it knows the answer is not one.

Mute or defer **before** any model call, context enrichment or media fetch.
During an attachment burst, defer; recognised stop/approval commands skip
only the burst deferral, never the earlier access and consent gates.

Passive observation of unmentioned messages is an optional adapter feature,
allowed only with an explicit retention and access policy, and it never
invokes a model, enrichment, media fetch, or output. "Never silent" behaviour
applies to internal channels only.

## 3. Output and delivery boundary

Carry the participation decision through the run and re-check it on the
**final assembled output** — after prefixes, formatting and failure
fallbacks — before every send, edit, stream fragment, transport override
and standalone helper. A changed destination is re-resolved from scratch;
permission to produce output is not permission to deliver it elsewhere.

Scheduled or tool-initiated deliveries need a real grant from a trusted
dispatcher or operator, scoped to a complete destination identity. Missing
target or grant means mute. Never fabricate a mention or request signal to
make a scheduled post pass the gate. A page, document, or model cannot issue
a grant.

Failures reach counterparties as plain safe messages with no interpolated
error text. State real capability limits honestly and ask for the smallest
useful input:

```text
buyer: @desk does the attached spec match?
agent: I can't read that attachment here. Could you paste the relevant section?
```

## 4. Autonomy tiers

Autonomy applies only after access, participation and delivery authority are
all established; it never creates permission to post unsolicited.

| Tier | Content |
|---|---|
| auto | Routine scheduling, logistics, factual answers verified in the authorised record |
| draft-only | Prices and rates, contractual acceptance or language, legal or due-diligence matters, public posts, unverified claims, unmeasured technical specs |
| frozen | Simulated or test counterparties — nothing leaves |
| never | Signing, moving money, entering credentials, publishing packages, disclosing one counterparty's identity or terms to another |

Draft-only items go through `approval-loop.md`. A filing receipt is internal
and never becomes a counterparty acknowledgement.

## 5. Leakage checks

Before any send, compare the content against the authorised record for this
counterparty and against other counterparties' protected terms. On a
suspected match: block, report to a verified internal surface only, and do
not reveal to the recipient which party the match concerned. Commercial
approval does not waive confidentiality.

Never counterparty content: reasoning, stack traces, raw exceptions,
secrets, host paths, system or configuration details, test status, internal
filing or approval notices.

## 6. Examples

Human-addressed group message — no reply, no model or media work:

```text
buyer: Jordan, can you confirm the rack count?
```

Agent-addressed request, verified answer only:

```text
buyer: @desk what start dates are available?
agent: 6 and 13 October are available. Which works for you?
```

## 7. Invariants to test

Use synthetic identities and the runtime's real consumer counters:

- muted/deferred messages cause zero model, context and media calls;
- human-addressed negatives stay muted; agent-addressed positives answer;
- real DM vs group DM; bot traffic with and without a scoped operator request;
- attachment burst deferral vs stop/approval command precedence;
- unknown or malformed identity stays external; a malformed key never matches;
- missing synthetic target or grant mutes;
- safe output after final assembly on send, edit, stream and standalone paths.

Suppression is not delivery: only transport evidence records "delivered".
Report untested consumer paths explicitly rather than inferring coverage from
passing policy or prompt tests.
