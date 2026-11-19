# Audit Scripts — mechanical checks before the judgment calls

Run these first; they turn half of `audit-checklist.md` into evidence and
leave you the judgment (redundancy, weak triggers, staleness of content).
In this repo, `python scripts/validate_skills.py` and
`python scripts/measure_context.py` already cover the CI-enforced subset —
run them, then these.

## 1. Inventory: size, references, code, last review

```python
#!/usr/bin/env python3
import re
from pathlib import Path

rows = []
for skill_md in sorted(Path("skills").glob("*/SKILL.md")):
    d = skill_md.parent
    text = skill_md.read_text(encoding="utf-8")
    refs = list((d / "references").glob("*.md")) if (d / "references").is_dir() else []
    allmd = text + "".join(r.read_text(encoding="utf-8") for r in refs)
    reviewed = re.search(r'last_reviewed: "(\d{4}-\d{2}-\d{2})"', text)
    rows.append((d.name, len(allmd), len(refs), allmd.count("```") // 2, reviewed.group(1) if reviewed else "—"))

print(f"{'skill':42} {'bytes':>7} {'refs':>4} {'code':>4}  reviewed")
for name, size, nrefs, code, rev in sorted(rows, key=lambda r: r[1]):
    print(f"{name:42} {size:7} {nrefs:4} {code:4}  {rev}")
```

Thin skills (small, no code, no references) are candidates for
deepening; very large ones for splitting into references.

## 2. Description quality

```python
import re
from pathlib import Path

DESC = re.compile(r"^description:\s*>-\n((?:  .+\n?)+)", re.M)
for skill_md in sorted(Path("skills").glob("*/SKILL.md")):
    m = DESC.search(skill_md.read_text(encoding="utf-8"))
    desc = " ".join(l.strip() for l in m.group(1).splitlines()) if m else ""
    quoted = re.findall(r'"([^"]+)"', desc)
    has_use = "Use for" in desc or "Use when" in desc
    flags = []
    if len(desc) > 450: flags.append(f"too long ({len(desc)})")
    if not has_use: flags.append("no 'Use for/when'")
    if len(quoted) < 3: flags.append(f"only {len(quoted)} trigger phrases")
    if not any(re.search(r"\b(yang|gak|ini|buat|bikin|kenapa|cek)\b", q) for q in quoted): flags.append("no Indonesian trigger")
    if flags:
        print(f"{skill_md.parent.name}: {', '.join(flags)}")
```

## 3. Trigger overlap between skills

High word overlap between two descriptions predicts the model picking the
wrong one.

```python
import itertools, re
from pathlib import Path

STOP = set("the a an and or of for to in on with use this that is it as by be from your you".split())
def words(text):
    return {w for w in re.findall(r"[a-z][a-z-]{2,}", text.lower()) if w not in STOP}

descs = {}
for p in Path("skills").glob("*/SKILL.md"):
    fm = p.read_text(encoding="utf-8").split("---")[1]
    descs[p.parent.name] = words(fm)

pairs = []
for a, b in itertools.combinations(descs, 2):
    j = len(descs[a] & descs[b]) / len(descs[a] | descs[b])
    pairs.append((j, a, b))
for j, a, b in sorted(pairs, reverse=True)[:10]:
    print(f"{j:.2f}  {a}  ↔  {b}  shared: {sorted(descs[a] & descs[b])[:8]}")
```

Above ~0.30, read both descriptions side by side and make each one's
trigger phrases distinct, or add a boundary line to each SKILL.md.

## 4. Cross-references that point nowhere

```bash
# Skill names mentioned anywhere that have no folder
rg -o --no-filename "[a-z0-9-]+-edho-ferdian" skills rules | sort -u > /tmp/mentioned
ls skills > /tmp/existing
comm -23 /tmp/mentioned /tmp/existing

# reference files mentioned but missing (the validator checks this too)
rg -n -o "references/[A-Za-z0-9_./-]+\.md" skills | while IFS=: read -r f l ref; do
  dir=$(dirname "$f"); [ -f "$dir/$ref" ] || [ -f "$(dirname "$dir")/$ref" ] || echo "$f:$l $ref"
done
```

## 5. Every skill reachable

- **Hands-off coverage:** every skill appears as a target in at least one
  other skill's "Hands off to" list (or is an entry point like
  `dev-kickoff`):

```bash
for s in $(ls skills); do
  n=$(rg -l "\`$s\`" skills/*/SKILL.md | grep -v "skills/$s/" | wc -l)
  [ "$n" -eq 0 ] && echo "nobody hands off to $s"
done
```

- **Router coverage:** `node --test tests/hooks.test.js` includes a test
  that every skill has a `skill-router` route.

## 6. Staleness signals

```bash
# Skills not reviewed in 90+ days
rg -n 'last_reviewed: "' skills/*/SKILL.md
# References naming versions — check them against current releases
rg -n "v[0-9]+\.[0-9]+|[Vv]ersion [0-9]+" skills/*/references | head -50
# Mentions of deprecated APIs you know about
rg -n "getServerSideProps|componentWillMount|ObservableObject|runOnJS" skills
```

Each hit is a lead, not a finding — confirm against current docs before
reporting it stale.
