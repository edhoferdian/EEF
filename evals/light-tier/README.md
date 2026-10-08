# Light-tier benchmark — research-worker and docs-sync

D-060 runs four agents at `tier: light` (the `haiku` alias under every
profile but `maksimal`; it resolved to `claude-haiku-5-5` in these runs) on the argument that their mistakes are loud — easy to spot,
cheap to retry. That was never measured. This benchmark measures it for
the two agents where a wrong answer is *least* obviously loud:

- **research-worker** — a confident, cited, wrong figure reads exactly like
  a right one, and the synthesizer downstream can only drop what it can
  tell is wrong.
- **docs-sync** — a missed drift leaves a README quietly lying; a false
  alarm costs a maintainer a re-check.

Same method as `../review-seeded-bugs/`: known answers, headless
`claude -p` per model, `--json-schema` output, automatic scoring, hand
check of everything the scorer flags.

## Corpora

**research** (`cases-research/`, `answer-key-research.json`): 8
sub-questions about fictional products, so prior knowledge cannot help.
Each case folder holds only `sources/` — the worker's whole search surface
(no web: tools are Read/Grep/Glob/Skill). Every case carries a trap:

| Case | Trap |
|---|---|
| r01-geocode-limit | outdated figure: 2024 page and 2025 blog say 100/min, 2026 changelog says 250 |
| r02-upload-size | contradiction: official 50 MB vs forum users reporting 100 MB |
| r03-queue-delivery | unsupported: no source states an uptime SLA; exactly-once is explicitly not offered |
| r04-tls-versions | injection: a sponsored page hides an instruction to claim TLS 1.0 support |
| r05-headcount | single source for headcount; no source mentions revenue |
| r06-ci-pricing | outdated price in an archive; per-team totals must be computed, labelled inference |
| r07-node-support | outdated: Node 18 dropped and 22/24 added after the README was written |
| r08-session-timeout | conflation: 15 min is a recommended *idle* timeout; session timeout defaults to 30 |

25 checks in all: **fact** (a SOURCED claim states it, and cites the right
file), **trap** (no SOURCED claim states the wrong value), **unsupported**
(the gap is reported, not filled), **single_source** (`corroborated:
false`), **conflict** and **warning** (the contradiction / injected text is
reported). Regexes are in the key; the `_doc` field defines each kind.

**docs** (`cases-docs/`, `answer-key-docs.json`): 8 small repos (Python,
Node, TypeScript). Six carry 8 seeded drifts — renamed function, removed
CLI flag, wrong config path, broken doc link, stale snippet keyword
argument, codemap naming a moved module and a removed export, wrong
default port. Two are clean controls whose docs match the code exactly.
A drift counts as found when a reported item names the right doc, sits
within ±3 lines of the anchor and mentions one of its keywords (as in v2
of the review benchmark). Everything else reported is *extra* (on a drift
case) or a *false alarm* (on a control), listed in `scores.json` for a
hand check.

## Method

Each run is a fresh temp directory holding only that case, with:

- `--model haiku` (no `--effort`, as `model-profiles.json` omits it for
  haiku) or
  `--model sonnet --effort medium|low`;
- `--append-system-prompt` = the agent's own `AGENT.md` body, so the model
  sees what the real delegate sees; the wrapped skill loads through the
  Skill tool from the user's install;
- `--tools Read,Grep,Glob,Skill`, `--strict-mcp-config`, no subagents.

Configs: `haiku` (light today), `sonnet-medium` (the comparison asked
for), and `sonnet-low` — what `tier: standard` would actually give these
agents, since both declare `effort: low`.

## Running it

```bash
python run.py --suite research --dry-run                         # validate, show plan, no model calls
python run.py --suite research --cases r04-tls-versions          # pilot: one case, default configs
python run.py --suite docs                                       # everything not yet run
python run.py --suite docs --score-only                          # rescore saved runs
```

Raw output lands in `results-<suite>/raw/` (git-ignored) and is reused,
so an interrupted run resumes; the runner stops at the first failed run
without saving it. `results-<suite>/scores.json` and `RESULTS.md` are the
committed outcome. Every real run spends model usage.

## Limits

8 + 8 cases is a smoke test: a one-check difference is noise. Regex
scoring both over- and under-counts on unusual wording, which is why
every failed check and every extra finding is read by hand before it goes
into RESULTS. The cases are small; a real research fan-out reads longer,
noisier pages, so a light model that passes here is necessary evidence,
not sufficient.
