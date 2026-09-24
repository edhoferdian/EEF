# Agreement drafting — template + spec → reviewable draft

## When this shape fits

You issue the same framework agreement (mutual NDA, referral/sourcing fee,
non-circumvention, master services) to many counterparties with identical
terms and a handful of party-specific fields, and deals get added over time.
Re-papering each deal by hand is the bottleneck; drafts must be reproducible
from tracked source and diffable.

## Template

A Markdown file with `{{PLACEHOLDER}}` tokens for every party-specific value;
everything else is fixed, counsel-approved text. Start from
`master-template.example.md` and replace its bracketed `[...]` directives with
real clauses. Bracketed directives left in the output are deliberate markers
that the document is incomplete — the builder does not resolve them.

| Placeholder | Filled from |
|---|---|
| `{{DATE}}` | `spec.date`, default today (YYYY-MM-DD) |
| `{{CP_SHORT}}` | `spec.short` |
| `{{CP_LEGAL}}` `{{CP_JURIS}}` `{{CP_ADDR}}` | spec fields, or a blank line for the counterparty to complete |
| `{{ROLE_CLAUSE}}` `{{FEE_TITLE}}` `{{FEE_CLAUSE}}` | chosen by `spec.role` from the role table |
| `{{SCHEDULE_ROWS}}` | `spec.schedule`, or a single "no entries at signing" row |
| `{{SUPPLEMENT_CLAUSE}}` | `spec.supplement` + separator, or empty |
| `{{CP_SIGBLOCK}}` `{{CP_SIGNER}}` `{{CP_TITLE}}` `{{CP_EMAIL}}` | signature block, blank lines when unknown |

An unknown `{{TOKEN}}` left in the template after filling is a build error,
not a silent blank.

## Spec

```json
{
  "file": "AcmeSupplier",
  "short": "Acme",
  "role": "supplier",
  "legal": "Acme Compute Ltd",
  "juris": "company registered in England and Wales",
  "addr": "1 Example Street, London",
  "signer": "A. Person",
  "title": "Director",
  "email": "signer@example.com",
  "schedule": [["1", "2026-09-01", "Lot A (16 nodes)", "introducer", "12 months", "standard"]],
  "supplement": "the Data Processing Addendum dated 2026-09-01"
}
```

Required: `file`, `short`, `role`. Everything else is optional; missing
signature details render as blank lines.

Validation happens **before** anything is written:

- `file` is a bare portable filename: no path separators, drive or UNC
  syntax, control characters, Windows-reserved characters or device names,
  and no trailing dot or space. Invalid names are rejected, never
  "sanitised" into something else.
- `schedule` is absent, `[]`, or an array of six-cell rows in this order:
  number, date, protected counterparty or lot, role, terms, fee. Cells are
  strings or finite numbers; `null`, booleans, objects, nested arrays,
  missing cells and non-finite numbers are rejected with row/cell position.
- Schedule cells are plain text: the builder escapes Markdown/HTML syntax so
  a `|` or `<` stays literal, and turns line breaks into spaces.

## Role table

`spec.role` selects the standing-arrangement clause and fee wording. The
example builder ships three roles; unknown roles fail the build.

| Role | Who pays the fee | Shape |
|---|---|---|
| `buyer` | Counterparty, on deals with parties we introduced | They appoint us, non-exclusively, to source and introduce |
| `supplier` | Counterparty, on deals with buyers we introduced; if we buy as principal, schedule terms apply | They offer capacity to us and to buyers we introduce |
| `mutual` | Whichever party closes with the other's introduction | Either may introduce |

Replace the role sentences in the builder with counsel's wording; the table
structure is the point, not the example text.

## Build

```sh
node scripts/build-agreement.js <template.md> <spec.json> <out-dir> [--markdown-only]
```

- Writes `<out-dir>/<file> MASTER.md` with a mandatory DRAFT banner.
- By default also converts to `.docx` with pandoc (10-second timeout). Missing
  pandoc, a failed conversion, or an empty result is exit code 1 — and any
  stale `.docx` from an earlier build is removed first, so an old artifact
  can never pass for the current one.
- `--markdown-only` skips pandoc entirely and reports it; there is then no
  `.docx` for the e-sign workflow.
- Unknown flags are exit code 2. Outputs must land directly inside the
  output directory; an existing symlink at either destination is refused.

Treat templates and specs as trusted, operator-reviewed input. pandoc can
fetch referenced local or remote resources, so run conversion in an
environment you are comfortable letting it read from.

## Signature page geometry

End the body with a page break so the signature block starts on its own
page in DOCX:

````markdown
```{=openxml}
<w:p><w:r><w:br w:type="page"/></w:r></w:p>
```
````

Keep the block order fixed — our block, then the counterparty's, each with
By / Name / Title / Email / Date. Pagination still varies with fonts and
renderer, so the e-sign workflow calibrates against the actual converted
document rather than assuming a layout.

## Schedule A notices (adding deals after execution)

Only when the executed agreement expressly allows entries to be added by
notice, and only within that authority:

1. Discuss economics and strategy on an internal channel; get commitment
   approval before any contractual content goes out. A shared channel with
   the counterparty is not internal.
2. Confirm the entry (party or lot, role, terms, fee, effective date) is
   inside the notice authority. Anything that changes standing terms needs
   the agreement's amendment procedure — a notice cannot authorise itself.
3. Draft the dated notice for the recipient and channel the agreement names.
   Include the business content; exclude internal margins, strategy, other
   parties' economics, traces and filing notices.
4. File the exact notice for operator approval
   (`counterparty-comms-edho-ferdian`, approval loop). Approval is not
   evidence of delivery.
5. Record delivery evidence, effective date, and any objection per the
   agreement's actual terms (example periods are not defaults). Keep the
   executed document untouched; append the row to the spec and rebuild a
   **draft consolidated view** for the internal record, referencing the
   executed version and the approved notice.

Illustrative notice — use only when the executed agreement authorises it:

```text
Schedule A notice, 2026-09-02
Agreement: Master Agreement dated 2026-08-14 between Us and Acme
Entry 2: Lot B, 8 nodes, region EU-West
Role: introducer
Terms: 6-month term, start no later than 2026-10-01
Fee: standard
Effective today unless you object within [objection window per the agreement]
with dated written evidence of a prior relationship with this counterparty.
```
