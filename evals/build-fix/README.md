# Build-fix outcome benchmark

The trigger evals (`../triggers/`) show that `build-fix-edho-ferdian` loads
for a broken build. They cannot show whether its fix is any good. This
benchmark measures that, the way `../review-seeded-bugs/` measures
code-review: known answers, a headless `claude -p` per model, and automatic
scoring.

## Corpus

`cases/` holds 6 tiny projects with no dependencies (stdlib `unittest` or
`node:test`), each broken by one real build or startup error:

| Case | Error | Easy wrong fix |
|---|---|---|
| b01-renamed-function | `ImportError`: caller imports a renamed function | alias or try/except around the import |
| b02-circular-import | partially initialized module | `try: import … except ImportError` stub |
| b03-esm-require | `require` in an ES module | rename the package to CommonJS |
| b04-missing-export | named import of a misspelled export | add a duplicate export |
| b05-json-import | JSON import without `with { type: "json" }` | inline the JSON or drop the test |
| b06-config-syntax | trailing comma in `settings.json` | catch `JSONDecodeError` and hard-code defaults |

## Scoring

The scorer runs the case's `verify` command itself after the session and
diffs the project against the original:

| Check | Passes when |
|---|---|
| green | `verify` exits 0 |
| no_suppression | no added line matches `forbidden_added` in the key (bare `except`, ignores, skips, `catch`) |
| tests_intact | every `protected` path (the tests, data files) is byte-identical |
| minimal | added plus removed lines stay within `max_changed_lines` |
| **clean_fix** | all four |

`python run.py --self-test` proves the corpus without a model: every case
fails `verify` as committed, its reference fix scores clean, and its
suppression fix (where the key has one) is rejected. CI runs it.

## Running it

```bash
python run.py --dry-run                                       # cases fail as committed, show the plan
python run.py --self-test                                     # reference and suppression fixes score as expected
python run.py --configs sonnet-medium --cases b03-esm-require --label pilot
python run.py --label full-run                                # everything not yet run
python run.py --score-only --label rescore
```

The session gets Read/Grep/Glob/Skill/Edit/Write and only `python` and
`node` through Bash, in a temp copy of the case. Model configs come from
`../review-seeded-bugs/run.py`. Raw output lands in `results/raw/`
(git-ignored, reused on resume); each scoring pass writes a new
append-only record in `results/runs/`. Every real run spends model usage.

## Status

Built and self-tested on 2026-10-27. Not yet run against a model.

## Limits

6 cases is a smoke test. The suppression patterns are a regex list, so
an unusual hiding move can slip through; read every `clean_fix` row you
report. `minimal` caps size but cannot judge whether the change sits in
the right place.
