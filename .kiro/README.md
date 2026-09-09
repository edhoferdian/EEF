# EEF skills for Kiro

`skills/` here is a generated copy of this repo's root `skills/` directory
(see `scripts/export_kiro.py` — regenerated from source on every run, never
hand-edited, and checked in CI so it can't silently drift).

## Install

Copy into your Kiro project or your global Kiro config:

```bash
# Project-local
cp -r .kiro/skills/* /path/to/your/project/.kiro/skills/

# Global (all Kiro projects)
cp -r .kiro/skills/* ~/.kiro/skills/
```

The commands above overwrite an existing skill of the same name at the
destination. Use `cp -rn` instead of `cp -r` if you'd rather skip any
skill that already exists there than replace it.
