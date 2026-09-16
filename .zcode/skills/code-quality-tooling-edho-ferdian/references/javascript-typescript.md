# Setup Guide — Lint/Format + Husky + lint-staged (JS/TS)

## 1. Biome or ESLint+Prettier — pick one before setting up anything

Don't run both stacks in the same project — they'll fight over the same
files. Default to Biome; use the decision guide below rather than picking
by habit.

| | Biome (default) | ESLint + Prettier |
|---|---|---|
| Tools to install/maintain | 1 (`@biomejs/biome`) | 2-4 (`eslint`, `prettier`, `eslint-config-prettier`, plus plugins) |
| Lint/format conflicts | None by construction — one tool owns both | Real risk — mitigated by `eslint-config-prettier`, but still two config files to keep in sync |
| Plugin/rule ecosystem | Smaller, growing fast, but missing some framework-specific rule sets | Much larger — `eslint-plugin-jsx-a11y`, framework- and library-specific rule sets, easy custom rules |
| Speed | Faster (Rust) | Slower (JS), rarely the bottleneck in practice |
| Best for | A new project with no legacy config to migrate | A project that needs a specific ESLint plugin Biome doesn't cover yet, or already has a large ESLint config not worth migrating |

This matches `config-hygiene-edho-ferdian`'s existing language/tool gate
table (Biome-first for `.ts`/`.tsx`/`.js`/`.jsx`) — that table is a
fact-check reference for its own tamper-detection scans, this file is the
setup guide; keep both in sync if the ecosystem's default ever changes.

## 2a. Biome setup (default path)

```bash
npm install -D @biomejs/biome
npx @biomejs/biome init
```

`biome.json` (generated, then trim to what the team actually wants to
override — Biome's defaults are deliberately sane, same philosophy as
Prettier's):

```json
{
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "formatter": { "enabled": true, "indentStyle": "space" }
}
```

Because setup steps and the exact rule-config shape change across Biome's
own releases, resolve the current CLI flags/config schema live via
Context7 (this skill's canonical contract, §9) rather than trusting a
memorized version.

`package.json` scripts:

```json
{
  "scripts": {
    "check": "biome check --write ."
  }
}
```

## 2b. ESLint + Prettier setup (alternative path)

### Prettier

```bash
npm install -D prettier
```

`.prettierrc.json` (start minimal — Prettier's defaults are deliberately
opinionated and good; only override what the team actually disagrees on):

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all"
}
```

Add a `.prettierignore` (build output, lockfiles, generated code) —
formatting a generated file is wasted work and can even break it.

### ESLint (flat config, v9+)

Flat config (`eslint.config.js`, an array of config objects) replaced the
old `.eslintrc.*` cascading format. If the project still has a
`.eslintrc.json`/`.js`, that's the legacy format — migrating is worth doing
alongside a fresh setup rather than bolting flat config on top of it. Don't
memorize the exact package list here; resolve it live via Context7 (this
skill's canonical contract, §9) since the plugin ecosystem's flat-config
compatibility layer is still actively evolving. Typical shape for a
React+TS project:

```js
// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs['recommended-latest'],
  prettierConfig, // must be last — turns off rules that fight Prettier
];
```

**`eslint-config-prettier` must be the last entry** — flat config applies
later entries' rule overrides on top of earlier ones, so anything before it
that sets a formatting-related rule gets correctly disabled; putting it
first would let a later config re-enable a rule Prettier already owns.

## 3. Husky (same for either path)

```bash
npm install -D husky
npx husky init      # writes .husky/pre-commit, adds "prepare": "husky" to package.json
```

`husky init` is the current (v9+) command — older tutorials describing
`husky install` or `husky add` are the pre-v9 API and will not match a
fresh install. The `prepare` script is what makes hooks install
automatically for every contributor on `npm install`, not just the person
who ran `husky init`.

## 4. lint-staged

```bash
npm install -D lint-staged
```

`package.json` — Biome path:

```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx,json,md,css}": ["biome check --write --no-errors-on-unmatched"]
  }
}
```

`package.json` — ESLint+Prettier path:

```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,css}": ["prettier --write"]
  }
}
```

`.husky/pre-commit` (identical for either path):

```sh
npx lint-staged
```

## 5. Pre-push hook (optional but recommended once the project has tests)

`.husky/pre-push`:

```sh
npm run typecheck && npm run test -- --run
```

Keep this fast — a slow pre-push hook is the one contributors will
`--no-verify` around. If the full suite takes more than ~30 seconds, push
only a fast/changed-files subset locally and let CI run the rest.

## Common failure modes

- **ESLint and Prettier fighting over the same line** (quote style,
  trailing commas) — means `eslint-config-prettier` is missing or not last
  in the config array. Fix the config, don't hand-disable the individual
  ESLint rule. (Not possible on the Biome path by construction — one more
  reason it's the default.)
- **Hook doesn't run for anyone but the person who set it up** — `husky
  init`'s `prepare` script wasn't committed, or someone ran `npm install
  --ignore-scripts`. Check `package.json`'s `scripts.prepare` is present
  and committed.
- **CI passes but a broken commit already landed** — the hook was bypassed
  with `--no-verify`, or the hook wasn't installed before the commit (fresh
  clone, hooks not yet installed because `npm install` hadn't run). CI is
  the backstop precisely for this — don't treat the local hook as the only
  gate.
- **A rule got quietly loosened instead of the code being fixed** (an
  ESLint rule downgraded to `"warn"`, a Biome rule disabled, an ignore
  pattern widened) right after it started failing — that's config
  tampering, not a setup decision. See `config-hygiene-edho-ferdian`'s
  "Config tamper guard" for the detection side of this.
