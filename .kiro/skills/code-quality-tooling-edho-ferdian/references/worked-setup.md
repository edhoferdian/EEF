# Worked Setup — a quality gate from zero, verified

A full setup on an existing Next.js + TypeScript repo with Biome, Husky
and lint-staged, then the Python equivalent with Ruff and pre-commit.
Includes how to roll it out without a 3,000-line formatting diff in the
middle of feature work. Check current versions and config keys before
copying (Biome's config schema changes between majors).

## TypeScript repo — Biome + Husky + lint-staged

```bash
npm i -D --save-exact @biomejs/biome husky lint-staged
npx @biomejs/biome init
npx husky init
```

```jsonc
// biome.json
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "ignore": [".next", "dist", "coverage", "src/generated/**"] },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": { "noExplicitAny": "warn" },
      "correctness": { "noUnusedImports": "error", "useExhaustiveDependencies": "warn" }
    }
  },
  "javascript": { "formatter": { "quoteStyle": "double", "semicolons": "always" } }
}
```

```json
// package.json (scripts + lint-staged)
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "typecheck": "tsc --noEmit",
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx,json,css}": "biome check --write --no-errors-on-unmatched"
  }
}
```

```bash
# .husky/pre-commit
npx lint-staged
```

```bash
# .husky/pre-push — slower checks, before code leaves the machine
npm run typecheck
```

Keep `tsc` out of pre-commit: it type-checks the whole project and makes
every commit slow. CI runs everything anyway.

## Rolling it out on an existing codebase

1. **One formatting commit, alone.** Separate PR: `biome format --write .`,
   commit as `style: apply biome formatting`, merge quickly while few
   branches are open.
2. **Hide it from blame:**

   ```bash
   git rev-parse HEAD >> .git-blame-ignore-revs
   git config blame.ignoreRevsFile .git-blame-ignore-revs
   ```

3. **Lint rules: start as warnings** for rules with many hits; fix in
   small PRs; then flip to `error`.
4. Tell everyone with open branches to rebase onto the formatting commit
   and run `npm run lint:fix`.

## CI — the same commands as local

```yaml
- run: npm ci
- run: npx biome ci .          # read-only, fails on formatting or lint errors
- run: npm run typecheck
```

## ESLint + Prettier instead (when the project needs ESLint plugins)

```js
// eslint.config.js (flat config)
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: [".next", "dist", "coverage"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { plugins: { "@next/next": nextPlugin }, rules: { ...nextPlugin.configs.recommended.rules } },
  prettier,                        // last: turns off rules that fight Prettier
);
```

```json
"lint-staged": { "*.{ts,tsx}": ["eslint --fix", "prettier --write"], "*.{json,md,css}": "prettier --write" }
```

## Python — Ruff + pre-commit

```toml
# pyproject.toml
[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM", "DJ"]   # pycodestyle, pyflakes, isort, pyupgrade, bugbear, simplify, django
ignore = ["E501"]                                  # formatter owns line length

[tool.ruff.format]
quote-style = "double"
```

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0                     # pin; update with `pre-commit autoupdate`
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
```

```bash
pip install pre-commit && pre-commit install
pre-commit run --all-files          # once, for the formatting commit
```

## Editor: format on save that matches CI

```json
// .vscode/settings.json (committed)
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome",
  "editor.codeActionsOnSave": { "source.organizeImports.biome": "explicit", "quickfix.biome": "explicit" },
  "[python]": { "editor.defaultFormatter": "charliermarsh.ruff" }
}
```

```json
// .vscode/extensions.json
{ "recommendations": ["biomejs.biome", "charliermarsh.ruff"] }
```

## Verify the gate works

```bash
echo 'const  x = 1' > src/__probe.ts && git add src/__probe.ts && git commit -m "probe"
# expected: lint-staged reformats or blocks; then
git reset --soft HEAD~1 2>/dev/null; git restore --staged src/__probe.ts; rm src/__probe.ts
```

Report: which tools, which hooks run what, the formatting commit hash, and
the CI step names.

## "My commit is blocked by the linter"

1. Read the error — it names the file, line and rule.
2. `npm run lint:fix` (or `ruff check --fix`) for auto-fixable ones.
3. Fix the rest by hand. Disabling a rule needs a reason in the PR; a
   per-line disable needs a comment saying why.
4. Never `git commit --no-verify` to get past it.
