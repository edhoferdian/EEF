#!/usr/bin/env python3
"""Seeded-bug benchmark for the code-review-edho-ferdian skill (D-060).

Runs the review skill over every case at several model/effort
configurations through headless Claude Code, then scores it against the
corpus's answer key. Two corpora:

  v1  cases/, answer-key.json — one short file per case, the bug visible
      within a few lines. Run 1 hit a ceiling here (every tier 16/16).
  v2  cases-v2/, answer-key-v2.json — one folder per case, a small PR: one
      changed file plus existing context files, and a bug that can only be
      seen with that context (a spec, a caller, a test, a config, another
      service).

Metrics:

  recall        seeded bugs caught, out of the bug cases. v1: a finding
                within `tolerance` lines of an anchor. v2: also on the right
                file, and its summary must contain one of the case's
                keywords, so a nearby finding about something else does not
                count.
  recall@high   the same, counting only findings rated high or critical —
                a bug reported as a nit is a bug that ships
  control FP    high/critical findings on the clean controls
  cost          Claude Code's own client-side estimate (total_cost_usd);
                on a subscription this is usage, not a bill

Each run happens in a fresh temp directory holding only that case, with
tools limited to Read/Grep/Glob/Skill: no subagents, so the configured
model is the only model doing the review (the skill's critique pass then
runs inline, as it does on harnesses without delegation), and no MCP
servers. Raw output lands in <results>/raw/<config>/<case>.json; an
existing file is reused, so an interrupted run resumes where it stopped,
and the runner stops at the first failed run without saving it.

Every real run spends model usage. --dry-run validates the corpus and
prints the plan without calling a model.

Usage:
    python run.py --dry-run                                   # v1 (default)
    python run.py --corpus v2 --dry-run
    python run.py --corpus v2 --cases 01-refunds              # pilot
    python run.py --corpus v2                                 # everything not yet run
    python run.py --corpus v2 --score-only                    # rescore saved runs
"""
import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent

CONFIGS = {
    "opus-high": ("opus", "high"),        # current deep tier
    "sonnet-high": ("sonnet", "high"),    # standard tier, high effort
    "sonnet-medium": ("sonnet", "medium"),
}

STRONG = {"critical", "high"}

FINDING_PROPS = {
    "line": {"type": "integer", "description": "1-based line in the file the finding is about"},
    "severity": {"type": "string", "enum": ["critical", "high", "medium", "low", "info"]},
    "category": {"type": "string"},
    "summary": {"type": "string"},
}

V1_PROMPT = (
    "A pull request adds the file `{changed}` (it is the only file in the working "
    "directory). Review it using the code-review-edho-ferdian skill. There is no "
    "other context — no tests, specs or other files exist — so do not ask for "
    "them. Report every issue you would raise on this PR, each with the line it "
    "is on and a severity."
)

V2_PROMPT = (
    "This working directory is a repository with one pull request applied: the "
    "PR adds or modifies `{changed}`. Every other file is existing code and "
    "documentation already on the main branch, there as context. Modules that "
    "are imported but not present exist and are simply not shown. Review the "
    "change in `{changed}` using the code-review-edho-ferdian skill, reading the "
    "other files as you need. There are no other files, specs or tests beyond "
    "these, so do not ask for them. Report every issue you would raise on this "
    "PR, each with the file it is in (path relative to the working directory), "
    "the line, and a severity."
)

V3_PROMPT = (
    "This working directory is a repository with one pull request applied. The "
    "PR adds or modifies these {count} files:\n{changed}\n"
    "Every other file is existing code and documentation already on the main "
    "branch, there as context. Modules that are imported but not present exist "
    "and are simply not shown. Review the whole PR using the "
    "code-review-edho-ferdian skill, reading the other files as you need. There "
    "are no other files, specs or tests beyond these, so do not ask for them. "
    "Report every issue you would raise on this PR, each with the file it is in "
    "(path relative to the working directory), the line, and a severity."
)

CORPORA = {
    "v1": {
        "cases_dir": HERE / "cases",
        "key": HERE / "answer-key.json",
        "results": HERE / "results",
        "prompt": V1_PROMPT,
        "with_file": False,
    },
    "v2": {
        "cases_dir": HERE / "cases-v2",
        "key": HERE / "answer-key-v2.json",
        "results": HERE / "results-v2",
        "prompt": V2_PROMPT,
        "with_file": True,
    },
    # A case folder holds only the PR's files; run_one lays them over
    # cases-v3/_bases/<base>/ so 8 large PRs share two base projects.
    "v3": {
        "cases_dir": HERE / "cases-v3",
        "key": HERE / "answer-key-v3.json",
        "results": HERE / "results-v3",
        "prompt": V3_PROMPT,
        "with_file": True,
    },
}


def render_prompt(corpus: dict, case: dict) -> str:
    changed = case["changed"]
    if isinstance(changed, list):
        return corpus["prompt"].format(count=len(changed), changed="\n".join(f"- `{c}`" for c in changed))
    return corpus["prompt"].format(changed=changed)


def findings_schema(with_file: bool) -> dict:
    props = dict(FINDING_PROPS)
    required = ["line", "severity", "summary"]
    if with_file:
        props = {"file": {"type": "string", "description": "path relative to the working directory"}, **props}
        required = ["file", *required]
    return {
        "type": "object",
        "properties": {"findings": {"type": "array", "items": {"type": "object", "properties": props, "required": required}}},
        "required": ["findings"],
    }


def claude_bin() -> str:
    """The native claude executable. On Windows npm installs a .CMD shim
    whose cmd.exe argument handling mangles a JSON argument, so call the
    .exe it wraps directly."""
    found = shutil.which("claude")
    if not found:
        sys.exit("claude CLI not found on PATH")
    if found.lower().endswith(".cmd"):
        exe = Path(found).parent / "node_modules" / "@anthropic-ai" / "claude-code" / "bin" / "claude.exe"
        if exe.exists():
            return str(exe)
    return found


def load_key(corpus: dict) -> dict:
    """Load the answer key and resolve every anchor to its line, failing on
    a missing or ambiguous anchor. v1 cases are files; v2 cases are folders
    and name the changed file and the file holding the bug; v3 cases name a
    base project and a list of changed files, all in the case folder."""
    key = json.loads(corpus["key"].read_text(encoding="utf-8"))
    cases_dir = corpus["cases_dir"]
    for name, case in key["cases"].items():
        case.setdefault("changed", name)
        case.setdefault("file", name if case["bug"] else None)
        case.setdefault("keywords", [])
        root = cases_dir / name
        if "base" in case and not (cases_dir / "_bases" / case["base"]).is_dir():
            sys.exit(f"answer-key: {name} names base {case['base']!r}, which does not exist")
        for changed in case["changed"] if isinstance(case["changed"], list) else [case["changed"]]:
            if not (root / changed if root.is_dir() else root).exists():
                sys.exit(f"answer-key: {name} names changed file {changed!r}, which does not exist")
        case["anchor_lines"] = []
        if case["bug"]:
            bug_path = root / case["file"] if root.is_dir() else root
            lines = bug_path.read_text(encoding="utf-8").splitlines()
            for anchor in case["anchors"]:
                hits = [i for i, line in enumerate(lines, 1) if anchor in line]
                if len(hits) != 1:
                    sys.exit(f"answer-key: anchor {anchor!r} in {name} matches {len(hits)} lines, need exactly 1")
                case["anchor_lines"].append(hits[0])
            if not case["anchor_lines"]:
                sys.exit(f"answer-key: bug case {name} has no anchors")
    missing = {p.name for p in cases_dir.iterdir() if not p.name.startswith("_")} - set(key["cases"])
    if missing:
        sys.exit(f"answer-key: no entry for {sorted(missing)}")
    return key


def run_one(exe: str, corpus: dict, config: str, name: str, case: dict, budget: float) -> dict:
    model, effort = CONFIGS[config]
    src = corpus["cases_dir"] / name
    with tempfile.TemporaryDirectory(prefix="eef-review-bench-") as work:
        if "base" in case:
            shutil.copytree(corpus["cases_dir"] / "_bases" / case["base"], work, dirs_exist_ok=True)
        if src.is_dir():
            shutil.copytree(src, work, dirs_exist_ok=True)
        else:
            shutil.copy(src, Path(work) / name)
        cmd = [
            exe, "-p", render_prompt(corpus, case),
            "--model", model,
            "--effort", effort,
            "--output-format", "json",
            "--json-schema", json.dumps(findings_schema(corpus["with_file"])),
            "--tools", "Read,Grep,Glob,Skill",
            "--allowedTools", "Read", "Grep", "Glob", "Skill",
            "--strict-mcp-config",
            "--no-session-persistence",
            "--max-budget-usd", str(budget),
        ]
        started = time.monotonic()
        proc = subprocess.run(cmd, cwd=work, capture_output=True, text=True, encoding="utf-8", timeout=1800)
        elapsed = time.monotonic() - started
    try:
        out = json.loads(proc.stdout)
    except json.JSONDecodeError:
        out = {"parse_error": True, "stdout": proc.stdout[-4000:]}
    out["_meta"] = {"config": config, "model": model, "effort": effort, "case": name,
                    "returncode": proc.returncode, "stderr": proc.stderr[-2000:], "wall_s": round(elapsed, 1)}
    return out


def findings_of(raw: dict) -> list[dict] | None:
    structured = raw.get("structured_output")
    if isinstance(structured, dict) and isinstance(structured.get("findings"), list):
        return structured["findings"]
    return None


def same_file(reported: str | None, expected: str) -> bool:
    """A reported path matches when it ends with the expected relative path
    (reviewers may prefix ./ or an absolute temp-dir path)."""
    if not reported:
        return False
    norm = reported.replace("\\", "/").lstrip("./")
    return norm == expected or norm.endswith("/" + expected)


def matches(finding: dict, case: dict, tol: int, with_file: bool) -> tuple[bool, bool]:
    """(near, meaningful): near = right file and within tolerance of an
    anchor line; meaningful = near and the summary carries a keyword (v1
    has no keywords, so near is enough)."""
    if with_file and not same_file(finding.get("file"), case["file"]):
        return False, False
    try:
        line = int(finding.get("line", -99))
    except (TypeError, ValueError):
        return False, False
    near = any(abs(line - a) <= tol for a in case["anchor_lines"])
    if not near or not case["keywords"]:
        return near, near
    text = (finding.get("summary", "") + " " + finding.get("category", "")).lower()
    return True, any(k.lower() in text for k in case["keywords"])


def score(corpus: dict, key: dict) -> dict:
    tol = key["tolerance"]
    raw_dir = corpus["results"] / "raw"
    report = {}
    for config in CONFIGS:
        rows, cost, wall = [], 0.0, 0.0
        for name, case in key["cases"].items():
            path = raw_dir / config / f"{name}.json"
            if not path.exists():
                continue
            raw = json.loads(path.read_text(encoding="utf-8"))
            cost += raw.get("total_cost_usd") or 0.0
            wall += raw["_meta"]["wall_s"]
            found = findings_of(raw)
            row = {"case": name, "bug": bool(case["bug"]), "valid": found is not None,
                   "cost_usd": raw.get("total_cost_usd"), "findings": len(found or [])}
            if found is not None:
                judged = [(f, *matches(f, case, tol, corpus["with_file"])) for f in found] if case["bug"] else []
                caught = [f for f, _, ok in judged if ok]
                row["caught"] = bool(caught)
                row["caught_high"] = any(f.get("severity") in STRONG for f in caught)
                # Near the bug but without a keyword: kept for a hand check,
                # since a keyword list can miss an unusual but correct wording.
                row["near_no_keyword"] = [f.get("summary", "")[:200] for f, near, ok in judged if near and not ok]
                row["strong_findings"] = sum(f.get("severity") in STRONG for f in found)
                row["medium_findings"] = sum(f.get("severity") == "medium" for f in found)
            rows.append(row)
        bug_rows = [r for r in rows if r["bug"] and r["valid"]]
        ctl_rows = [r for r in rows if not r["bug"] and r["valid"]]
        report[config] = {
            "runs": len(rows),
            "invalid_runs": sum(not r["valid"] for r in rows),
            "bug_cases": len(bug_rows),
            "caught": sum(r["caught"] for r in bug_rows),
            "caught_high": sum(r["caught_high"] for r in bug_rows),
            "control_cases": len(ctl_rows),
            "control_strong_fp": sum(r["strong_findings"] for r in ctl_rows),
            "control_medium": sum(r["medium_findings"] for r in ctl_rows),
            "cost_usd": round(cost, 4),
            "cost_per_case_usd": round(cost / len(rows), 4) if rows else None,
            "wall_s": round(wall, 1),
            "missed": [r["case"] for r in bug_rows if not r["caught"]],
            "rows": rows,
        }
    return report


def print_table(report: dict) -> None:
    print("\n| config | recall | recall@high | control FP (high+) | control medium | cost (est.) | $/case | invalid |")
    print("|---|---|---|---|---|---|---|---|")
    for config, r in report.items():
        if not r["runs"]:
            continue
        n = r["bug_cases"]
        print(f"| {config} | {r['caught']}/{n} | {r['caught_high']}/{n} | {r['control_strong_fp']} "
              f"| {r['control_medium']} | ${r['cost_usd']:.2f} | ${r['cost_per_case_usd'] or 0:.3f} | {r['invalid_runs']} |")
    for config, r in report.items():
        if r["missed"]:
            print(f"  {config} missed: {', '.join(r['missed'])}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--corpus", choices=list(CORPORA), default="v1")
    parser.add_argument("--configs", nargs="*", default=list(CONFIGS), choices=list(CONFIGS))
    parser.add_argument("--cases", nargs="*", help="case names (default: all)")
    parser.add_argument("--budget-per-run", type=float, default=3.0, help="--max-budget-usd cap per run")
    parser.add_argument("--dry-run", action="store_true", help="validate and print the plan; no model calls")
    parser.add_argument("--score-only", action="store_true", help="rescore saved runs; no model calls")
    args = parser.parse_args()

    corpus = CORPORA[args.corpus]
    key = load_key(corpus)
    cases = args.cases or list(key["cases"])
    unknown = set(cases) - set(key["cases"])
    if unknown:
        sys.exit(f"unknown case(s): {sorted(unknown)}")
    raw_dir = corpus["results"] / "raw"

    if not args.score_only:
        plan = [(c, n) for c in args.configs for n in cases if not (raw_dir / c / f"{n}.json").exists()]
        print(f"corpus {args.corpus} OK: {sum(bool(k['bug']) for k in key['cases'].values())} bug cases, "
              f"{sum(not k['bug'] for k in key['cases'].values())} controls")
        print(f"{len(plan)} run(s) to do (saved runs are reused), cap ${args.budget_per_run:.2f} each")
        if args.dry_run:
            for c, n in plan:
                print(f"  {c:14} {n}")
            return 0
        exe = claude_bin()
        for i, (config, name) in enumerate(plan, 1):
            print(f"[{i}/{len(plan)}] {config} {name} ...", end=" ", flush=True)
            raw = run_one(exe, corpus, config, name, key["cases"][name], args.budget_per_run)
            if raw.get("is_error") or raw.get("parse_error"):
                # Auth expiry, a rate limit or an unavailable model fails
                # every remaining run the same way: stop, and save nothing,
                # so a rerun retries this item instead of reusing a failure.
                reason = raw.get("result") or raw.get("stdout") or raw["_meta"]["stderr"]
                print(f"FAILED — stopping. {str(reason).strip()[:300]}")
                return 1
            dest = raw_dir / config / f"{name}.json"
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(json.dumps(raw, indent=2, ensure_ascii=False), encoding="utf-8")
            found = findings_of(raw)
            status = f"{len(found)} findings" if found is not None else "NO STRUCTURED OUTPUT"
            print(f"{status}, ${raw.get('total_cost_usd') or 0:.3f}, {raw['_meta']['wall_s']}s")

    report = score(corpus, key)
    scores_path = corpus["results"] / "scores.json"
    scores_path.parent.mkdir(parents=True, exist_ok=True)
    scores_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print_table(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
