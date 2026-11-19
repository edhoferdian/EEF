# Automated Checks — paths, links, snippets, and CLI help

Scripts that turn Step 3 (doc freshness) into evidence. Run them from the
project root; adapt globs to the repo. They read only.

## 1. Every path a doc mentions exists

```python
#!/usr/bin/env python3
"""check_doc_paths.py — report backticked paths in Markdown that don't exist."""
import re, sys
from pathlib import Path

ROOT = Path.cwd()
PATH_RE = re.compile(r"`((?:\.{0,2}/)?[\w.-]+(?:/[\w.@-]+)+/?)`")   # `src/app/page.tsx`, `docs/setup.md`
missing = []
for md in ROOT.rglob("*.md"):
    if any(part in {"node_modules", ".git", "dist", "build"} for part in md.parts):
        continue
    for lineno, line in enumerate(md.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
        for m in PATH_RE.finditer(line):
            ref = m.group(1).rstrip("/")
            if "*" in ref or ref.startswith(("http", "~", "$")):
                continue
            if not (ROOT / ref).exists() and not (md.parent / ref).exists():
                missing.append(f"{md.relative_to(ROOT)}:{lineno}: `{ref}` not found")
print("\n".join(missing) or "All referenced paths exist.")
sys.exit(1 if missing else 0)
```

## 2. Links resolve

```bash
# lychee (fast, checks external + relative links)
npx --yes @lycheeverse/lychee-bin --no-progress --exclude-mail './**/*.md'
# or markdown-link-check per file
npx --yes markdown-link-check README.md docs/*.md
```

Treat 429/timeouts as "unknown", not broken. Relative links and anchors
(`#section`) must all resolve.

## 3. Code snippets still compile

TypeScript blocks from the README, type-checked against the real package:

```bash
mkdir -p .doc-snippets
node -e '
const fs = require("fs");
const md = fs.readFileSync("README.md", "utf8");
let i = 0;
for (const m of md.matchAll(/```(?:ts|tsx|typescript)\n([\s\S]*?)```/g)) {
  fs.writeFileSync(`.doc-snippets/snippet-${++i}.ts`, m[1]);
}
console.log(`${i} snippet(s) extracted`);
'
npx tsc --noEmit --skipLibCheck --moduleResolution bundler --module esnext --target es2022 .doc-snippets/*.ts
rm -rf .doc-snippets
```

Python blocks:

```bash
python - <<'PY'
import re, ast, pathlib
md = pathlib.Path("README.md").read_text(encoding="utf-8")
for i, block in enumerate(re.findall(r"```python\n(.*?)```", md, re.S), 1):
    try:
        ast.parse(block)
    except SyntaxError as e:
        print(f"snippet {i}: {e}")
PY
```

Snippets that are intentionally partial: mark them (```ts title="partial"```)
and skip them in the script, rather than leaving known-broken code in docs.

## 4. CLI help and README agree

```bash
# Options the CLI really has vs options the README mentions
node cli.js --help | grep -oE -- '--[a-z][a-z-]+' | sort -u > /tmp/cli-flags
grep -oE -- '--[a-z][a-z-]+' README.md | sort -u > /tmp/doc-flags
comm -13 /tmp/cli-flags /tmp/doc-flags   # documented but not real
comm -23 /tmp/cli-flags /tmp/doc-flags   # real but undocumented
```

Same idea for environment variables (`rg -o "process\.env\.[A-Z_]+"` vs
the README's env table) and npm scripts (`package.json` scripts vs the
"Development" section).

## 5. Versions and commands

```bash
node -p 'require("./package.json").engines'   # vs "Requires Node X" in README
grep -n "npm install\|pnpm add\|yarn add" README.md   # match the lockfile in the repo
ls package-lock.json pnpm-lock.yaml yarn.lock bun.lockb 2>/dev/null
```

A README that says `npm install` in a pnpm repo is stale.

## README skeleton (when one is missing or unusable)

```markdown
# <Project>

One sentence: what it is and who it's for.

## Quick start
<the shortest working path: install, configure, run — copy-paste commands>

## Configuration
| Variable | Required | Default | Purpose |
|---|---|---|---|

## Development
<install, test, lint, build commands exactly as in package.json / Makefile>

## Architecture
<link to the codemap; 3–6 bullet overview of the main modules>

## Deployment
<or a link to where it lives>

## License
```

## Freshness report row

```markdown
| Doc | Finding | Evidence | Fix |
|---|---|---|---|
| README.md:42 | Path moved | `src/lib/auth.ts` → now `src/server/auth.ts` (git log --follow) | Update path |
| docs/api.md:10 | Flag removed | `--legacy` absent from `cli --help` | Remove the row |
| README.md:88 | Snippet doesn't compile | tsc: Property 'connect' does not exist on type 'Client' | Use `client.open()` (v3 API) |
```
