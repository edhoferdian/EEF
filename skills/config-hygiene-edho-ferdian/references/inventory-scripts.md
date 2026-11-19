# Inventory Scripts — measure ~/.claude before changing it

Read-only scripts for the scan channels in SKILL.md. Every change that
follows them goes one item at a time, with a backup and an undo path.
Paths are under the user's own `~/.claude`; never search from a drive or
home root.

## 1. Skills: what loads, and what each costs in the listing

```python
#!/usr/bin/env python3
import re
from pathlib import Path

home = Path.home() / ".claude"
DESC = re.compile(r"^description:\s*(?:>-\n((?:  .+\n?)+)|(.+))", re.M)

def desc(skill_md: Path) -> str:
    fm = skill_md.read_text(encoding="utf-8", errors="ignore").split("---")
    m = DESC.search(fm[1] if len(fm) > 2 else "")
    if not m:
        return ""
    return " ".join(l.strip() for l in (m.group(1) or m.group(2)).splitlines())

rows = []
for root in [home / "skills", *(home / "plugins").glob("**/skills")]:
    for s in root.glob("*/SKILL.md"):
        rows.append((len(desc(s)) + len(s.parent.name), s.parent.name, str(root.relative_to(home))))

total = sum(r[0] for r in rows)
print(f"{len(rows)} skills, ~{total} chars in the listing (~{total // 4} tokens)")
for size, name, where in sorted(rows, reverse=True)[:15]:
    print(f"{size:5}  {name:45} {where}")
```

Compare the total with the listing budget (about 1 % of the context
window). Above it, descriptions of the least-used skills get dropped.

## 2. Duplicates — the same skill from two sources

```bash
# Same folder name in user skills and in a plugin
comm -12 <(ls ~/.claude/skills | sort) \
         <(find ~/.claude/plugins -path '*/skills/*/SKILL.md' -printf '%h\n' 2>/dev/null | xargs -n1 basename | sort)
```

A skill installed by `eef-install` and also by the EEF plugin shows up
twice; keep one (`eef-install doctor` warns about this).

## 3. Settings audit

```python
import json
from pathlib import Path

s = json.loads((Path.home() / ".claude" / "settings.json").read_text(encoding="utf-8"))
print("model:", s.get("model"))
print("enabledPlugins:", {k: v for k, v in (s.get("enabledPlugins") or {}).items()})
print("skillOverrides:", len(s.get("skillOverrides") or {}))
perms = s.get("permissions") or {}
print("allow:", len(perms.get("allow", [])), "deny:", len(perms.get("deny", [])))
for event, groups in (s.get("hooks") or {}).items():
    for g in groups:
        for h in g.get("hooks", []):
            cmd = h.get("command", "")
            exists = any(Path(p).exists() for p in cmd.replace('"', " ").split() if p.endswith((".js", ".py", ".sh", ".ps1")))
            print(f"hook {event:18} {g.get('matcher','*'):30} {'ok ' if exists else 'MISSING'} {cmd[:70]}")
```

Look for: hooks pointing at deleted files, overly broad `allow` rules
(`Bash(*)`), duplicated hook registrations, plugins enabled but unused.

## 4. MCP servers

```bash
claude mcp list            # configured servers and their status
```

Each connected MCP server adds its tool descriptions to context. Servers
that fail to connect or are never used are removal candidates — ask first.

## 5. Memory files

```bash
wc -c ~/.claude/CLAUDE.md ~/.claude/rules/**/*.md 2>/dev/null | sort -n | tail
ls ~/.claude/projects/*/memory/ 2>/dev/null | head
```

Always-loaded files (`CLAUDE.md`, rules) cost every session; memory index
files too. Merge duplicates, delete facts that are no longer true.

## 6. Caches and disk

```bash
du -sh ~/.claude/projects ~/.claude/plugins ~/.claude/shell-snapshots ~/.claude/todos 2>/dev/null
ls -t ~/.claude/projects | tail -20     # oldest project transcript folders
```

Transcripts are the user's history: never delete them without an explicit
yes for the specific folders.

## 7. Change log entry (one per change)

```markdown
| When | Item | Change | Backup | Undo |
|---|---|---|---|---|
| 2026-11-19 | skillOverrides | `ui-ux-pro-max` → name-only | settings.json.before-uiux | restore the backup or delete the key |
```

## 8. Before/after proof

```bash
claude -p "/skill-doctor" > before.txt     # in Git Bash: MSYS_NO_PATHCONV=1 claude -p "/skill-doctor"
# make one change
claude -p "/skill-doctor" > after.txt
diff before.txt after.txt
```
