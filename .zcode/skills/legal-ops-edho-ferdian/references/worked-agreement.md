# Worked Agreement — one template, two counterparties, one renderer

The flow from `agreement-drafting.md` with code: a JSON spec per
counterparty, a renderer that fills the master template and refuses to
guess, a Schedule A for deals, and an e-sign envelope prepared as a draft
(`esign-field-placement.md`). Not legal advice — the template's wording is
the owner's (or their lawyer's); this only fills it consistently.

## Spec per counterparty

```json
// deals/pt-maju-referral.json
{
  "agreement_type": "referral_fee",
  "effective_date": "2026-12-01",
  "governing_law": "Republic of Indonesia",
  "parties": {
    "provider": { "name": "Edho Ferdian", "address": "Bandung", "signatory": "Edho Ferdian", "email": "${PROVIDER_EMAIL}" },
    "partner":  { "name": "PT Maju Bersama", "address": "Jl. Asia Afrika 10, Bandung", "signatory": "Sari Wulandari", "title": "Direktur", "email": "sari@example.co.id" }
  },
  "terms": { "fee_percent": 10, "fee_cap_idr": 15000000, "payment_days": 30, "term_months": 12, "non_circumvention_months": 12 },
  "schedule_a": [
    { "deal_id": "A-001", "client": "Kedai Senja", "service": "Kasirku setup + 12 months", "value_idr": 6000000, "introduced_on": "2026-11-20" }
  ]
}
```

Personal contact details for the provider come from the environment or a
private file, not from a spec committed to a repo.

## Renderer — fill placeholders, fail on anything missing

```python
#!/usr/bin/env python3
"""render_agreement.py spec.json template.md out.md"""
import json, os, re, sys
from string import Template

spec = json.loads(open(sys.argv[1], encoding="utf-8").read())
template = open(sys.argv[2], encoding="utf-8").read()

def flatten(d, prefix=""):
    out = {}
    for k, v in d.items():
        key = f"{prefix}{k}"
        if isinstance(v, dict):
            out.update(flatten(v, key + "__"))
        elif not isinstance(v, list):
            out[key] = os.path.expandvars(str(v))
    return out

values = flatten(spec)
values["fee_cap_idr_fmt"] = f"Rp{int(spec['terms']['fee_cap_idr']):,}".replace(",", ".")

rows = ["| Deal | Client | Service | Value | Introduced |", "|---|---|---|---|---|"]
for d in spec.get("schedule_a", []):
    rows.append(f"| {d['deal_id']} | {d['client']} | {d['service']} | Rp{d['value_idr']:,} | {d['introduced_on']} |".replace(",", "."))
values["schedule_a_table"] = "\n".join(rows)

needed = set(re.findall(r"\$\{?([a-zA-Z0-9_]+)\}?", template))
missing = sorted(n for n in needed if n not in values or values[n] in ("", "None") or "${" in values[n])
if missing:
    sys.exit(f"Refusing to render: missing values for {', '.join(missing)}")

open(sys.argv[3], "w", encoding="utf-8").write(Template(template).substitute(values))
print(f"rendered {sys.argv[3]}")
```

Template excerpt (`master-template.example.md` style):

```markdown
This Referral Agreement is made on ${effective_date} between ${parties__provider__name}
("Provider") and ${parties__partner__name}, represented by ${parties__partner__signatory},
${parties__partner__title} ("Partner").

3.1 Provider shall pay Partner ${terms__fee_percent}% of the fees actually received for each
Referred Deal listed in Schedule A, capped at ${fee_cap_idr_fmt} per deal, within
${terms__payment_days} days of receipt.

## Schedule A — Referred Deals
${schedule_a_table}
```

```bash
python render_agreement.py deals/pt-maju-referral.json templates/referral.md out/pt-maju-referral.md
```

## Adding a deal later (Schedule A only, no re-negotiation)

```bash
python - <<'PY'
import json
p = "deals/pt-maju-referral.json"
spec = json.load(open(p, encoding="utf-8"))
spec["schedule_a"].append({"deal_id": "A-002", "client": "Warung Kopi Pagi", "service": "Kasirku 12 months",
                           "value_idr": 588000, "introduced_on": "2027-01-08"})
json.dump(spec, open(p, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
PY
python render_agreement.py deals/pt-maju-referral.json templates/schedule-a-amendment.md out/pt-maju-schedule-a-002.md
```

Every rendered file goes into the review diff: the owner reads the actual
text, not the JSON.

## E-sign envelope — prepared as a draft, never sent by the agent

```json
// out/pt-maju-envelope.json  (provider-neutral shape; map to the e-sign API in use)
{
  "status": "draft",
  "document": "out/pt-maju-referral.pdf",
  "subject": "Referral Agreement — PT Maju Bersama",
  "signers": [
    { "role": "Partner",  "name": "Sari Wulandari", "email": "sari@example.co.id", "order": 1,
      "fields": [{ "type": "signature", "anchor": "/sig_partner/" }, { "type": "date", "anchor": "/date_partner/" }] },
    { "role": "Provider", "name": "Edho Ferdian", "email": "${PROVIDER_EMAIL}", "order": 2,
      "fields": [{ "type": "signature", "anchor": "/sig_provider/" }, { "type": "date", "anchor": "/date_provider/" }] }
  ]
}
```

Anchor text (`/sig_partner/`) is placed in the template in white text so
fields land in the right place even if pagination changes. The envelope
stays a draft; sending it is the owner's action in the e-sign tool.

## Checks before handing to the owner

- [ ] Renderer exited without "missing values".
- [ ] Party names, titles and addresses match the counterparty's documents.
- [ ] Numbers formatted for Indonesia (Rp, dots as thousands separators).
- [ ] Schedule A total and cap match the spec.
- [ ] Envelope status is `draft`; signer order correct.
- [ ] A note that this is a drafting aid, not legal advice; unusual terms flagged for a lawyer.
