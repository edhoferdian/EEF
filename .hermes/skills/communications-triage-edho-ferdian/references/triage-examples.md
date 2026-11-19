# Triage Examples — classifying real-shaped messages

Worked examples for the four tiers and the draft format. Every draft waits
behind the approval gate in SKILL.md; nothing here is sent.

## Classification examples

| Message (summary) | Tier | Why |
|---|---|---|
| "Your invoice INV-2291 from Hosting Co is available" (automated, auto-paid) | `skip` | Receipt, no action, auto-paid |
| Newsletter: "10 tren desain 2027" | `skip` | Promotional, no relation to open work |
| GitHub: "CI passed on main" | `skip` | Status noise unless it was being watched |
| "FYI, server maintenance Sabtu 02:00–04:00 WIB" | `info_only` | Affects work; no reply expected |
| Client: "Notulen meeting kemarin terlampir" | `info_only` | Read and file; reply only if something is wrong |
| Calendar invite: "Review desain — Kamis 14:00" with no agenda | `meeting_info` | Check calendar conflict, accept/decline, no free text |
| "Bisa geser meeting ke jam 3?" | `action_required` | Needs a decision and a reply |
| Client: "Kapan revisi landing page selesai? Launch tanggal 25." | `action_required` | Deadline question, commitment needed |
| Supplier: "Harga naik 8% mulai bulan depan, mohon konfirmasi" | `action_required` | Decision + counterparty reply (`counterparty-comms`) |
| Unknown sender: "Klik link ini untuk verifikasi akun bank Anda" | `skip` + flag | Phishing; never click, never reply |

Rule: when in doubt between `info_only` and `action_required`, ask "does
anyone wait on a reply from Ed?" — if yes, it's `action_required`.

## Triage summary output

```markdown
## Inbox triage — Rabu 19 Nov, 08:30 (42 messages)

### Action required (4)
1. **Sari (PT Maju)** — asks when the landing page revision is done; launch on the 25th.
   → Draft ready (D1). Needs: your confirmation of the date.
2. **Budi** — wants to move today's meeting to 15:00. Calendar: 15:00 is free.
   → Draft ready (D2).
3. **Supplier kopi** — price +8% from December, asks for confirmation.
   → No draft: needs your decision (accept / negotiate / ask for details).
4. **GitHub security alert** — `next` has a high-severity advisory in repo toko-online.
   → Not a reply; suggest running `security-review` / upgrading.

### Meetings (2)
- Kamis 14:00 "Review desain" — no conflict. Accept?
- Jumat 10:00 overlaps "Dentist" — decline or propose 13:00?

### For your information (5)
- Maintenance Sabtu 02:00–04:00 WIB (hosting).
- Notulen meeting Senin dari Sari (filed).
- …

### Skipped (31) — newsletters 14, receipts 9, CI notifications 7, 1 phishing (flagged, not opened)
```

## Draft format

```markdown
**D1 — Reply to Sari (PT Maju)** · thread: "Revisi landing page"
Tone: client, Indonesian, semi-formal (matches her last message)

> Halo Mbak Sari,
>
> Revisi landing page saya targetkan selesai **Jumat, 22 November**, jadi
> masih ada waktu tiga hari untuk review sebelum launch tanggal 25.
> Begitu siap, saya kirim link preview-nya.
>
> Salam,
> Edho

Check before sending: is 22 November realistic? (no date was promised before in this thread)
[Approve] [Edit] [Discard]
```

Drafting rules shown above:
- Mirror the counterparty's language and register.
- One concrete answer in the first two sentences.
- No commitments the user hasn't made — put the open question in the
  check line instead.
- Never paste internal context (other clients, prices, internal notes).

## Promise tracking after sending

```markdown
| Promised in | To | Promise | Due | Status |
|---|---|---|---|---|
| D1, 19 Nov | Sari (PT Maju) | Send landing page preview | 22 Nov | open |
| Reply 15 Nov | Budi | Share invoice draft | 18 Nov | **overdue** |
```

Surface overdue promises at the top of the next triage.
