# Worked Exchange — a supplier thread handled by an agent, end to end

How the rules in SKILL.md, `channel-discipline.md` and
`approval-loop.md` play out in one real-shaped conversation: who may be
answered, what stays internal, and how a draft becomes an approved,
exact-text send recorded in the ledger (`approval-ledger.sql`).

## Setup (from `channel-policy.example.yaml`)

```yaml
channel: whatsapp-group:supplier-kopi-gayo
counterparty: CV Kopi Gayo (supplier)
agent_may_answer:
  - delivery status questions
  - acknowledgement of received messages
agent_must_escalate:
  - price, payment terms, contracts, complaints, anything with money
never_disclose:
  - other suppliers, our margins, internal stock levels, internal people's opinions
approvers: [edho]
```

## The thread

> **Supplier (09:12):** Pagi Pak, harga green bean naik 8% mulai Desember
> ya. Pesanan minggu depan tetap 20 kg? Mohon konfirmasi.

### Step 1 — classify (internal, never posted)

```text
Message: price change + order confirmation
Policy: price → must escalate; order quantity → money → must escalate
Agent may: acknowledge receipt only
Internal context the agent has but must not use: alternative supplier quote (Rp X/kg), current stock 6 kg
```

### Step 2 — allowed immediate reply (still drafted, still approved)

```text
DRAFT A1 (acknowledgement)
"Pagi Pak, pesannya sudah kami terima. Kami konfirmasi soal harga dan jumlah pesanan hari ini ya."
```

### Step 3 — escalation to the owner (internal channel)

```markdown
**CV Kopi Gayo — needs your decision**
They say: green bean price +8% from December; asking to confirm 20 kg for next week.
Context (internal only): stock 6 kg (≈ 5 days); alternative quote from another supplier is ~5% lower than the new price.
Options:
1. Accept +8%, confirm 20 kg.
2. Confirm 20 kg at the current price (December starts after delivery), negotiate from January.
3. Ask for a volume price for 30 kg.
Draft A1 (acknowledgement) is waiting for your approval.
```

Owner: "Approve A1. Pilih opsi 2."

### Step 4 — the outbound draft for the decision

```text
DRAFT A2
"Pak, untuk pesanan minggu depan kami tetap 20 kg ya. Karena pengirimannya masih November,
mohon pakai harga lama. Soal harga Desember, boleh kita bicarakan minggu depan?"
```

Leak check before showing it to the approver:
- mentions another supplier? no
- mentions our stock or margin? no
- commits to anything the owner didn't decide? no (only option 2)

Owner: "Approve A2 apa adanya."

### Step 5 — send exactly what was approved, record it

```sql
INSERT INTO approval_ledger (draft_id, channel, counterparty, text_sha256, approved_by, approved_at, sent_at, status)
VALUES ('A2', 'whatsapp-group:supplier-kopi-gayo', 'CV Kopi Gayo',
        encode(sha256(convert_to($$Pak, untuk pesanan minggu depan kami tetap 20 kg ya. ...$$, 'UTF8')), 'hex'),
        'edho', now(), now(), 'sent');
```

The sender compares the hash of the text it is about to send with the
approved hash; any edit after approval — even a typo fix — goes back for
approval.

## What the agent does when someone else in the group asks

> **Supplier's staff (10:40):** Pak, kemarin katanya kedai sebelah ambil dari supplier lain ya?

Not in `agent_may_answer`, touches `never_disclose`. The agent posts
nothing; it escalates: "Question about other suppliers in the Kopi Gayo
group — not answered. Want to reply yourself?"

## Common failure modes this prevents

| Failure | Guard |
|---|---|
| Agent answers a price question "to be helpful" | Policy: money → escalate |
| Draft reveals internal stock or a competitor quote | Leak check before approval |
| Approved text edited before sending | Hash comparison in the ledger |
| Agent replies to someone outside the counterparty | Channel + sender allow-list |
| Silence looks rude | Pre-approved acknowledgement templates, still logged |
