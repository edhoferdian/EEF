---
name: legal-ops-edho-ferdian
description: >-
  Reproducible agreement paperwork for a solo operator or small team: build
  review drafts of a master/framework agreement (NDA, referral or sourcing
  fee, non-circumvention, master services) from one template plus a small
  JSON spec per counterparty, add deals later by Schedule A notice within
  the executed agreement's authority, and prepare e-signature envelopes by
  browser automation with calibrated numeric field placement and a hard
  save-as-draft gate. Not legal advice — output is always a DRAFT for
  counsel review. Use when the user says "bikin perjanjian dari template",
  "master agreement", "NDA untuk banyak partner", "siapkan envelope
  e-sign", "tambah deal ke Schedule A", or "otomasi tanda tangan
  elektronik".
---

# Legal Ops — Edho Ferdian Mode

Two linked workflows that turn paperwork into tracked, diffable source:

1. **Drafting** — one counsel-approved template, one JSON spec per
   counterparty, one build step. `references/agreement-drafting.md`.
2. **Envelope preparation** — placing signature/date/text fields in a web
   e-signature composer through an already signed-in browser session, then
   saving a draft for the operator. `references/esign-field-placement.md`.

## Non-negotiables

- **Not legal advice.** This skill produces documents and automation; it does
  not decide whether terms are enforceable, appropriate, or compliant in a
  jurisdiction. Every clause must come from, or be reviewed by, qualified
  counsel. Say so to the user whenever you hand over a document.
- **Everything is a DRAFT.** A successful build or conversion proves an
  artifact exists — not legal completeness, signing authority, or readiness
  to send. There is no "execution copy" mode; an execution version is a
  separate, reviewed record.
- **The agent never signs, declines, voids, sends, or enters credentials.**
  Sending an envelope requires an explicit operator instruction bound to the
  exact envelope (see the hard gate in the e-sign reference), consistent
  with `safe-execution-edho-ferdian` Gate 2.
- **Notices to counterparties go through approval.** A Schedule A notice or
  any contractual message reaches a counterparty only via
  `counterparty-comms-edho-ferdian`'s approval loop.
- **Signed documents are immutable.** Later changes produce a new draft or a
  notice; the executed file is never edited or regenerated in place.

## Workflow at a glance

1. Put the counsel-approved template and each counterparty's spec under
   version control; generated `.md`/`.docx` output stays out of it.
2. Build with `scripts/build-agreement.js` (Node 18+, no dependencies;
   pandoc optional for `.docx`). Diff the Markdown against the previous
   draft before anyone reviews it.
3. After counsel review, prepare the envelope in the e-sign composer:
   calibrate, place fields per recipient, capture evidence, save as draft.
4. The operator reviews the draft envelope and the evidence screenshot, then
   sends it themselves or gives a bound send instruction.
5. For later deals under an executed agreement, follow the Schedule A notice
   procedure — confirm authority first, approve the exact notice, record
   delivery evidence, then rebuild an internal consolidated **draft** view.

## References

- `references/agreement-drafting.md` — template placeholders, spec format
  and validation, role table, build command and failure modes, signature
  page geometry, and the Schedule A notice procedure.
- `references/esign-field-placement.md` — trusted browser target checks,
  recipients and signing order, coordinate calibration, per-recipient field
  placement, evidence capture, the hard gate, and a checklist.
- `references/master-template.example.md` — skeleton template with
  bracketed placeholders for counsel-approved clauses.
- `references/spec.example.json` — example counterparty spec.

## External docs (fixed — see skill-authoring-edho-ferdian's canonical contract)

pandoc options and a specific e-signature provider's composer UI change over
time — resolve them live (Context7 or the provider's current docs) before
automating against them. Full contract: `skill-authoring-edho-ferdian` §9.

## Surgical changes (fixed — see skill-authoring-edho-ferdian's canonical contract)

When editing a template or spec, change only the clause or field the task
names and rebuild; never reflow or "tidy" counsel-approved wording as a side
effect — a cosmetic diff in legal text still needs review. Full contract:
`skill-authoring-edho-ferdian` §10.

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract)

Communication to the user in Bahasa Indonesia; code, comments, and generated
files in English — fixed, never ask. The agreement's own language is the one
counsel chose for the template, not this rule. Full contract:
`skill-authoring-edho-ferdian` §7.
