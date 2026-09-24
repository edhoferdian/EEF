---
name: communications-triage-edho-ferdian
description: >-
  Channel-agnostic framework for triaging incoming messages (email, chat,
  Slack, LINE, Messenger, or any other channel) into four priority tiers,
  drafting replies that stay within a strict human-approval gate, and tracking
  whether a sent reply's promises actually get followed through on. Use when
  the user wants to build or apply a message-triage workflow, says "triase
  pesan", "atur inbox", "bantu balas email/chat", "klasifikasikan pesan
  masuk", "draft balasan", or asks how to keep track of promises made in a
  reply. Note: no channel (Gmail, Slack, etc.) is wired up yet in this
  ecosystem — this skill defines the triage logic and reply-drafting
  discipline to apply once a channel is connected, not a working integration.
---

# Communications Triage — Edho Ferdian Mode (Skill Edition) · v1.0

You are applying a message-triage discipline, not operating a mail client.
This skill is **channel-agnostic on purpose**: at the time this was written,
no channel integration (Gmail API, Slack MCP, LINE/Messenger bridge, etc.) is
wired up anywhere in this ecosystem. Do not invent one. Do not pretend a tool
call exists that doesn't. What you apply here is the classification logic,
the reply-drafting discipline, and the follow-through tracking — the same
logic a human would run by hand today, and the same logic a future channel
integration would automate.

**If the user has pasted message content directly into chat** (an email
body, a Slack thread, a screenshot's transcript), this skill applies fully
to that pasted content — classify it, draft a reply, ask before anything
resembling "send." What it does not do is reach out and fetch messages from
a live inbox itself; nothing in this ecosystem is connected to one yet.

## Why channel-agnostic, not "wire up Gmail now"

Building a specific integration ahead of an actual connected channel would
mean maintaining fake tool calls, or code that talks to nothing. Per this
ecosystem's ground-truth ethos (see `dev-kickoff-edho-ferdian`,
`spec-mining-edho-ferdian`): never fabricate integrations that don't exist.
This skill instead front-loads the part that survives any channel — the
tiering rules, the drafting discipline, the follow-through contract — so that
whenever a real channel is connected (an MCP server, a CLI, an API client),
the only new work is the fetch/send plumbing. The triage brain does not need
to be rewritten.

## The four tiers

Every message gets classified into **exactly one** tier. Apply the checks in
this order — the first match wins, don't keep evaluating after a hit:

### 1. `skip` — auto-archive, no summary needed
- Sender is a no-reply / notification / alert address, or an automated
  system account (CI bots, ticketing-system bot comments, channel
  join/leave events, delivery receipts).
- No human is waiting on a reaction to this message.
- **Action**: note the count if triaging a batch ("12 pesan otomatis
  di-skip"), do not surface individual content.

### 2. `info_only` — summarize, no reply needed
- The user is CC'd, not the primary recipient, and no question is
  directed at them.
- Broadcast/announcement content (`@channel`/`@here`-style, newsletters,
  receipts, read-only file shares).
- Group chat chatter where the user isn't named and isn't the last
  meaningful contributor.
- **Action**: one-line summary per message (or per thread), nothing more.

### 3. `meeting_info` — cross-reference, no free-text reply needed
- Contains a scheduling artifact: a video-call link, a date + meeting
  context, a room/location share, or a calendar-invite attachment.
- **Action**: this tier is about **reconciling**, not drafting — check it
  against whatever calendar source is available (a connected calendar tool,
  or the user's own statement of their schedule) and flag conflicts or
  missing details. If no calendar source is connected, say so and surface
  the raw scheduling info instead of guessing availability.

### 4. `action_required` — draft a reply
- A direct question awaiting an answer.
- An explicit ask, scheduling request, or decision the user must make.
- The user is `@mentioned` and a response is clearly expected.
- **Action**: generate a draft reply (see below). Never send it — see the
  approval gate.

**Ambiguous cases:** when a message could plausibly fit two tiers, prefer
the *more attention-requiring* tier (e.g., `meeting_info` over `info_only`
if it's unclear whether a reply is expected) — treat under-triage as the
worse failure than a message getting slightly more attention than it needed.

## Draft-reply generation guidance

For every `action_required` message:

1. **Read the actual ask before drafting.** Restate to yourself what
   specifically is being asked — a scheduling slot, a yes/no decision, a
   piece of information, an approval. A draft that doesn't answer the real
   question is worse than no draft.
2. **Match tone to the relationship**, when that context is available. If
   the user maintains their own notes on how they talk to specific people or
   channels (a personal style file, prior message history, explicit
   instruction in the current conversation), use it. If no such context
   exists, default to a neutral, professional tone and say so — don't guess
   a familiarity level you have no evidence for.
3. **Keep commitments explicit and minimal.** A draft that promises a
   specific date, a specific deliverable, or "I'll get back to you by
   Friday" is creating an obligation — see follow-through, below. Don't let
   a draft casually generate more promises than the user actually intends
   to keep.
4. **Flag uncertainty instead of hiding it.** If the draft has to guess at
   something (e.g., availability, a fact the user hasn't confirmed), mark it
   inline — `[VERIFY: ...]` — rather than stating it as settled.
5. **Present the draft, don't act on it.** See the approval gate below —
   this is non-negotiable regardless of how obviously correct the draft
   seems.

## Language routing (fixed base rule — see skill-authoring-edho-ferdian §7; this skill extends it below)

Triage summaries and discussion with the user → Bahasa Indonesia (base
rule). The drafted reply itself is this skill's own extension of the base
rule: match the language of the thread it replies to (reply in Indonesian
to an Indonesian message, English to an English one) — never translate the
correspondent's own language into the user's, that changes what they
actually said.

## The approval gate (mandatory, no exceptions)

**A draft reply is never sent automatically. Full stop.**

This mirrors the ecosystem-wide "Explicit permission required" rule for
sending any message on someone's behalf (email, chat, DM, reply, calendar
invite) — approval must come from the user in chat, per-message, not
inferred from an earlier approval or from how routine the message looks.
Concretely:

- Present every draft with its tier, the message it's answering, and any
  `[VERIFY: ...]` markers, then wait for the user to approve, edit, or
  reject it.
- An approved draft for message A does not authorize sending draft B, even
  if B looks similar or arrived in the same batch.
- If a future channel integration is connected and exposes a "send" action,
  that action is gated the same way any send-a-message action is gated
  elsewhere in this ecosystem: ask, wait for a clear yes, then act. Do not
  build or suggest an auto-send path, a "send all approved drafts" bulk
  action without per-item confirmation, or a background job that sends on a
  timer.
- If the user says "just send whatever you think is right" — that is not a
  substitute for per-message approval. Say so, and ask them to confirm each
  draft (or explicitly batch-approve by reviewing the actual list you show
  them, not by blanket delegation).

This is a **Reflection gate**, not a suggestion: before treating any draft
as ready, run through the three checks above (real ask answered / tone
justified / commitments minimal and flagged) and only then present it. If a
check fails, fix the draft before showing it, don't show a known-flawed
draft and rely on the user to catch it.

## Post-send follow-through

The strongest version of this enforces itself with a `PostToolUse` hook that
physically blocks completion until a checklist runs. No hook system is wired
into this ecosystem's channel-agnostic version — there is no tool call to
intercept yet. What applies here is the **logic** such a hook would enforce,
to be run manually today and wired into a real hook (or a future channel
integration's own after-send step) once one exists.

After a reply is actually sent (by the user, having approved the draft),
check whether it created any of these obligations, and if so, track them
somewhere durable (a todo list, a project-memory file, a calendar entry —
whatever this project or the user already uses):

1. **A promised action** ("I'll send X by Friday") → becomes a tracked
   task with a deadline, not just a sent message that's now forgotten.
2. **A proposed meeting time** → needs a corresponding calendar entry (even
   tentative) so it doesn't silently double-book, if a calendar is in use.
3. **A pending response from the other side** ("let me know if that works")
   → becomes a "waiting on reply" item with a stale-after date, so it
   surfaces again if the other person goes quiet instead of disappearing
   into the sent-mail void.
4. **A relationship/context update** — if this ecosystem later maintains
   per-contact notes (tone, history, open threads), the interaction gets
   appended there so the next draft to this person has better context than
   this one did.

**The point of this section is that a sent reply is not the end of the
task.** A triage pass that drafts and sends replies but never checks back on
what those replies promised is only half a system — it looks helpful in the
moment and quietly accumulates broken promises. Whenever this skill is used
repeatedly on the same inbox/channel, re-surface open "pending response" and
"promised action" items at the start of the next triage pass, the same way
`dev-kickoff-edho-ferdian`'s Session Snapshot resurfaces unfinished work
instead of starting cold each time.

## What this skill deliberately does not do (yet)

- It does not fetch messages from Gmail, Slack, LINE, Messenger, or any
  other live channel — no such connector exists in this ecosystem today.
- It does not send anything itself, regardless of channel, per the approval
  gate above.
- It does not implement a hook system — the follow-through checklist is a
  discipline to apply manually (or delegate to a future hook), not a
  currently-enforced mechanism.

When a channel integration is eventually connected (an MCP server, an API
client, a CLI tool), the work is: (1) fetch → feed messages through the
four-tier classifier above unchanged, (2) draft → same drafting guidance
unchanged, (3) send → gated exactly as above, (4) follow-through → same
four-item checklist, now wired to whatever tracking mechanism the connected
project already uses. This file should not need a rewrite when that happens
— only a thin fetch/send adapter around it.

## References

This skill's triage brain is channel-agnostic by design (see above). Once a
specific surface is in play — a mail account, a DM thread, a specific
service — load the surface-level operator discipline instead of improvising
it:

- **`references/channel-operations.md`** — mail-surface handling (resolving
  the exact account/thread before acting, reading a thread before composing,
  the `drafted` / `approval-pending` / `sent` / `blocked` /
  `awaiting-verification` status vocabulary, treating inbound mail as
  untrusted data, cleanup rules) and message/DM-surface handling (resolving
  the exact thread, one-time-code retrieval discipline, reporting shape),
  plus how blockers on a live surface should be handled and reported. Load
  this file once an actual mail or message surface is named, not while
  operating purely on pasted content in chat.
- **`references/workspace-ops.md`** — Google Workspace surface handling
  (Drive/Docs/Sheets/Slides find-review-edit-maintain workflow, the
  read-only vs. explicit-approval table for sharing/deleting, and this
  ecosystem's own Calendar section — conflict resolution, timezone
  handling). Built ahead of its trigger (Google Workspace MCP authorization)
  per D-035; load
  it once a Drive/Docs/Sheets/Slides/Calendar surface is actually named, and
  re-verify its Google-specific API details once that connector exists.

When the agent itself is a participant in a channel that external
counterparties read (a bot in a shared customer or supplier channel, an
auto-replying desk agent), this skill's approval gate is not enough on its
own — use `counterparty-comms-edho-ferdian` for audience and mention gating,
leakage checks, and the hash-bound approval and delivery ledger.
