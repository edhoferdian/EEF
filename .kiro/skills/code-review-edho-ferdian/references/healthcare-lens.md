# Conditional Lens — Healthcare / Clinical / EMR

**Caution — this lens requires domain expertise to fully validate.** Clinical
scoring formulas, drug-interaction logic, and coding-standard mappings are
safety-critical and this skill is a code reviewer, not a clinician. When this
lens is active, flag clinical-logic findings (scoring correctness, dose
validation, interaction pairs, ICD-10/SNOMED mappings) as **needing human
clinical review before merge**, even at High confidence on the code-reading
side — "the code matches what I believe the published spec says" is not the
same as clinical sign-off. Never let this lens's output read as a clean
clinical approval; the verdict for clinical-logic findings is always
NEEDS CLINICAL REVIEW, not APPROVE.

**Activation.** This lens runs only when Phase 0 detects the review scope
touches clinical data, an EMR/EHR system, clinical decision support (CDSS),
or health information exchange (HL7/FHIR messages, patient/encounter models,
clinical scoring functions, drug/lab reference data). If none of those are
in scope, skip this file entirely — don't report "N/A" for it in the final
review.

**Known overlaps — don't duplicate, cross-reference.**
- PHI/sensitive-identifier-in-URL findings are already covered by **SEC-06**,
  whose full definition now lives in `security-review-edho-ferdian/
  references/general-checklist.md` ("Never place sensitive identifiers —
  session tokens, PHI, PII — in URL parameters or query strings"), with a
  healthcare-specific note in that skill's `references/domain-specific.md`
  §Healthcare. Report a hit under SEC-06, not a new code here — delegate to
  `security-review-edho-ferdian` for deeper security-specific coverage.
- Cascade-delete-on-patient-records findings are already covered by
  `references/database-lens.md` (PERF-07f / general FK-cascade guidance).
  Report a hit there, but note in this lens's summary that the affected table
  holds clinical data, since that raises the severity floor (see below).

**Code placement.** Findings that are genuinely clinical-domain-specific (not
already owned by SEC-06 or database-lens) use their own `HC-##` codes below.

---

## HC-01 — Clinical scoring matches published specification

Verify implementations of clinical scoring systems (e.g. NEWS2 — Royal
College of Physicians spec, qSOFA — Sepsis-3 spec) against the actual
published thresholds and point values, not against what "looks reasonable."
A scoring function that silently deviates from spec (wrong threshold, wrong
weighting, missing a input parameter) produces a wrong clinical score that
looks legitimate. Flag any deviation, however small, and mark it as needing
clinical review regardless of your own confidence reading the code.

## HC-02 — No false negatives on drug interactions / red-flag symptoms

Check drug-interaction logic for bidirectional coverage (A interacts with B
must also fire when checking B against A) and confirm malformed or
out-of-range inputs produce an explicit error rather than silently passing
the check. A missed interaction or a silently-skipped validation is a patient
safety event, not a normal bug — treat as CRITICAL regardless of how narrow
the code path is. Never approve code that silently catches or swallows a
CDSS error; that is functionally equivalent to disabling the check.

## HC-03 — ICD-10/SNOMED and reference-data mapping correctness

Check that diagnosis/procedure code mappings (ICD-10, SNOMED) and lab
reference ranges are sourced from an authoritative table rather than
hardcoded inline, and that a mapping miss fails visibly (error or explicit
"unmapped" state) rather than defaulting to a plausible-looking but wrong
code. Flag hardcoded clinical reference values with no cited source.

## HC-04 — HL7/FHIR message handling

Check that HL7/FHIR message parsing validates required segments/fields
before use, handles malformed or partial messages with an explicit error
path (not a silent partial-parse), and that integration failures are
retried/alerted rather than dropped. A silently dropped HL7 message can mean
a lost lab result or lost encounter data.

## HC-05 — Encounter-lock / addendum-only workflow

Clinical records must not be hard-deleted or freely edited once an encounter
is locked — corrections after lock must go through an addendum workflow that
preserves the original entry and records who/when/why. Flag any code path
that allows direct mutation or deletion of a locked encounter's clinical
content, and confirm an audit-trail entry is written on every create/read/
update/delete of clinical data, not just writes.

## HC-06 — Non-dismissable critical alerts

Critical clinical alerts (drug interactions, red-flag symptoms, out-of-range
vitals) must not be implemented as a dismissable toast/snackbar that a
clinician can miss or swipe away without acknowledgment. Flag any critical
alert implemented with a standard transient-notification pattern instead of
a blocking/modal pattern that requires explicit acknowledgment, and check
whether an override requires a logged reason.

---

## Severity guidance

- 🔴 **CRITICAL** — any confirmed or plausible missed drug interaction,
  wrong clinical score against published spec, PHI exposure (route via
  SEC-06 but keep the severity floor at CRITICAL regardless of exposure
  size), or a silently caught CDSS error. Per the source agent's own rule: a
  single missed interaction is worse than a hundred false alarms — do not
  downgrade for "low likelihood."
- 🟠 **HIGH** — encounter-lock bypass allowing direct edit/delete of a locked
  clinical record without an addendum trail; a critical alert implemented as
  dismissable; a cascade-delete path reachable on a table holding clinical
  data (cross-reference `database-lens.md`, but keep severity at HIGH here
  given the clinical stakes).
- 🟡 **MEDIUM** — HL7/FHIR malformed-message handling that logs but doesn't
  alert; hardcoded reference data with no cited source but a value that
  matches the standard.
- 🔵 **LOW** — inconsistent timestamp timezone handling across clinical
  tables with no observed data-integrity impact yet.
- ⚪ **INFO** — a clinical-logic finding you flagged for human clinical
  review with no code-level defect found — still worth surfacing per the
  caution note above.

## Verdict discipline

When this lens is active, the final report's overall verdict must not read
as a clean clinical sign-off. Use language equivalent to the source agent's
own scale — SAFE TO DEPLOY / NEEDS FIXES / BLOCK — PATIENT SAFETY RISK — and
add "clinical-logic findings pending human clinical review" whenever HC-01,
HC-02, or HC-03 produced any finding, even Low severity ones.
