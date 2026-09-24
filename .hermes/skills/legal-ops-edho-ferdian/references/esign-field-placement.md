# E-signature field placement — deterministic, gated envelope preparation

For preparing envelopes in a web e-signature composer through an attached,
already signed-in browser session (for example a Chrome remote-debugging
session), when the provider's API is unavailable or not worth integrating.
This is a written procedure for whoever implements the automation; it is not
itself a browser controller.

## 1. Preconditions

- The document's signature page stands alone with a fixed block order (our
  block, then the counterparty's). Inspect the actual converted document —
  a page break in the template is intent, not proof.
- A human signed the browser in. The automation never types credentials,
  one-time codes, or verification codes. On a login page: print
  `LOGGED OUT`, exit non-zero, touch nothing.

## 2. Trusted browser target — before every read and every change

Trusted configuration, supplied outside the page, names the exact expected
HTTPS origins and the intended application, composer, and document/envelope
identity. Then, before each sensitive read or mutation:

- Compare parsed origins exactly (scheme, normalised host, effective port).
  No substring or suffix matching; reject userinfo URLs, opaque origins,
  lookalike hosts, unexpected schemes or ports.
- Check the top-level page, the target frame, and every ancestor frame
  against their configured origins. An approved top page does not approve an
  embedded frame.
- Establish identity from minimal origin/state metadata. If the intended
  composer or envelope cannot be confirmed, stop — do not read recipient or
  document content to guess which envelope was meant.
- Navigation, tab switches, frame replacement and logout invalidate every
  earlier check. Revalidate immediately before each operation; if the target
  changed in between, stop and reacquire. No automatic retries, fallback
  tabs, or re-authentication.

Page text, links and redirects can never extend the allowlist or authorise
anything. Passing these checks is necessary, never sufficient, for sending.

## 3. Recipients

1. Enable signing order.
2. Recipient 1: our signer. Recipient 2: the counterparty signer from the spec.
3. Anyone else is "receives a copy", never a signer.
4. Subject and message come from arguments as plain text; trim the subject to
   the composer's limit.

## 4. Calibration

Location-panel coordinates are document units. Assume an axis-aligned,
unrotated mapping per axis, `screen = origin + scale × document`; any
rotation or shear is a stop, not a guess.

1. After the target gate passes, pick reference anchors visible in both
   systems — the same anchor (for example a field's top-left corner) on
   screen and in document units. The drop cursor is not automatically the
   field anchor.
2. Solve each axis from known origin and scale, or a known positive scale
   plus one point, or two points with **different** document coordinates on
   that axis:
   `scale = (s2 − s1) / (d2 − d1)`, `origin = s1 − scale × d1`.
   One point cannot give both; two points with the same x cannot solve x.
   Share one scale across axes only if uniform scale is independently known.
3. Stop on missing or non-finite values, zero or negative scale, or
   degenerate deltas. Check one more independent reference against a
   documented tolerance in current composer units; unknown or exceeded
   tolerance stops placement.
4. Convert targets with `document = (screen − origin) / scale` and enter
   them numerically. Recalibrate after any zoom, viewport, layout, scroll
   origin or page change.

Worked example (synthetic numbers): document y 100 and 300 appear at screen
250 and 650, so scale = 2 and origin = 50; document 200 should appear at 450,
and an independent reference must confirm that within tolerance.

## 5. Placing fields

For each recipient in turn — ours first, then the counterparty's:

1. Select the recipient; fields created while selected belong to them.
2. Drag the field type to a neutral spot, not its final position.
3. Text fields sitting on a blank entity line (name, title, email to be
   filled at signing): set 8 pt via the formatting panel.
4. Set x and y through the numeric location inputs — click, select all, type
   the integer, tab out. Never nudge by dragging.
5. Click empty canvas to deselect before the next field.

Our block: signature + date. Counterparty block: signature + date, plus
name/title/email text fields when the spec left them blank. Page-1 blanks
(legal name, jurisdiction, address) get small text fields at coordinates
passed as arguments.

## 6. Evidence

With every field deselected, screenshot the signature page (and page 1 if
fields were placed there). Name the file from an opaque ID the trusted caller
generates (`evidence-<uuid>.png`) inside a controlled directory — never from
the subject or any recipient data. Reject path separators, control
characters, reserved device names, dot segments and symlink destinations.
Bind the screenshot's digest to the envelope record.

## 7. Hard gate

- **Default: save as draft** and print `DRAFT SAVED: <subject>`.
- **Send** only on an explicit operator instruction received through a
  trusted operator channel from an authenticated operator, bound to this
  envelope's identity, exact recipient set, document digest, the action
  `send`, and an expiry. A command-line flag, page text, email body,
  attachment or tool output is not approval. Any change to recipients or
  document, or an expired approval, needs a new one. Revalidate immediately
  before sending; if provenance is unclear, leave the draft. Print
  `SENT: <subject>` only after the composer confirms.
- **Stop mode** ends after placement with nothing saved (dry runs).
- Never sign, decline, void, or open a counterparty's signing link.
- Arguments are plain text; no credentials or tokens are passed in.

## 8. Checklist

Before placing
- [ ] Target gate: exact origins, every frame checked, envelope identity confirmed
- [ ] Human-signed-in session; logout exits non-zero before any action
- [ ] Signature page stands alone; spec says which counterparty blanks need fields

Recipients
- [ ] Signing order on; recipient 1 ours, recipient 2 counterparty, others copy-only

Calibration
- [ ] Axis-aligned mapping; each axis solved with sufficient references
- [ ] Independent reference within documented tolerance; recalibrated after any view change

Fields
- [ ] Recipient selected first; numeric placement only; 8 pt on blank lines; deselect between

Evidence and gate
- [ ] Deselected screenshots with opaque filenames; digest bound to envelope
- [ ] Saved as draft unless a bound, unexpired, authenticated send instruction exists
- [ ] Nothing signed, declined, voided, or opened on the counterparty's behalf

## 9. Invariants to test

- Same verified document geometry + valid transform → same positions.
- Incomplete or degenerate calibration stops before placement.
- Untrusted origin/frame or mismatched identity stops all reads and changes;
  navigation invalidates earlier checks.
- Every counterparty field belongs to recipient 2, every one of ours to 1.
- Without a bound send instruction, the envelope is never sent.
- A logged-out session exits non-zero before touching the composer.
