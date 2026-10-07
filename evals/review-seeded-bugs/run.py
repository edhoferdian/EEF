#!/usr/bin/env python3
"""Seeded-bug benchmark for the code-review-edho-ferdian skill (D-060).

Runs the review skill over every file in cases/ at several model/effort
configurations through headless Claude Code, then scores it against
answer-key.json:

  recall        seeded bugs caught (a finding within `tolerance` lines of
                an anchor line), out of the bug cases
  recall@high   the same, counting only findings rated high or critical —
                a bug reported as a nit is a bug that ships
  control FP    high/critical findings on the clean control files
  cost          Claude Code's own client-side estimate (total_cost_usd);
                on a subscription this is usage, not a bill

Each run happens in a fresh temp directory holding only that one file, with
tools limited to Read/Grep/Glob/Skill: no subagents, so the configured
model is the only model doing the review (the skill's critique pass then
runs inline, as it does on harnesses without delegation), and no MCP
servers. Raw output lands in results/raw/<config>/<case>.json; an existing
file is reused, so an interrupted run resumes where it stopped.

Every real run spends model usage. --dry-run validates the corpus and
prints the plan without calling a model.

Usage:
    python run.py --dry-run
    python run.py --configs sonnet-medium --cases 01-paginate.js   # pilot
    python run.py                                                  # everything
    python run.py --score-only                                     # rescore saved runs
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
CASES_DIR = HERE / "cases"
RAW_DIR = HERE / "results" / "raw"
KEY_PATH = HERE / "answer-key.json"
SCORES_PATH = HERE / "results" / "scores.json"

CONFIGS = {
    "opus-high": ("opus", "high"),        # current deep tier
    "sonnet-high": ("sonnet", "high"),    # standard tier, high effort
    "sonnet-medium": ("sonnet", "medium"),
}

FINDINGS_SCHEMA = {
    "type": "object",
    "properties": {
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "line": {"type": "integer", "description": "1-based line in the reviewed file"},
                    "severity": {"type": "string", "enum": ["critical", "high", "medium", "low", "info"]},
                    "category": {"type": "string"},
                    "summary": {"type": "string"},
                },
                "required": ["line", "severity", "summary"],
            },
        }
    },
    "required": ["findings"],
}

PROMPT = (
    "A pull request adds the file `{name}` (it is the only file in the working "
    "directory). Review it using the code-review-edho-ferdian skill. There is no "
    "other context — no tests, specs or other files exist — so do not ask for "
    "them. Report every issue you would raise on this PR, each with the line it "
    "is on and a severity."
)

STRONG = {"critical", "high"}


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


def load_key() -> dict:
    key = json.loads(KEY_PATH.read_text(encoding="utf-8"))
    for name, case in key["cases"].items():
        lines = (CASES_DIR / name).read_text(encoding="utf-8").splitlines()
        case["anchor_lines"] = []
        for anchor in case["anchors"]:
            hits = [i for i, line in enumerate(lines, 1) if anchor in line]
            if len(hits) != 1:
                sys.exit(f"answer-key: anchor {anchor!r} in {name} matches {len(hits)} lines, need exactly 1")
            case["anchor_lines"].append(hits[0])
        if case["bug"] and not case["anchor_lines"]:
            sys.exit(f"answer-key: bug case {name} has no anchors")
    missing = {p.name for p in CASES_DIR.iterdir()} - set(key["cases"])
    if missing:
        sys.exit(f"answer-key: no entry for {sorted(missing)}")
    return key


def run_one(exe: str, config: str, case: str, budget: float) -> dict:
    model, effort = CONFIGS[config]
    with tempfile.TemporaryDirectory(prefix="eef-review-bench-") as work:
        shutil.copy(CASES_DIR / case, Path(work) / case)
        cmd = [
            exe, "-p", PROMPT.format(name=case),
            "--model", model,
            "--effort", effort,
            "--output-format", "json",
            "--json-schema", json.dumps(FINDINGS_SCHEMA),
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
    out["_meta"] = {"config": config, "model": model, "effort": effort, "case": case,
                    "returncode": proc.returncode, "stderr": proc.stderr[-2000:], "wall_s": round(elapsed, 1)}
    return out


def findings_of(raw: dict) -> list[dict] | None:
    structured = raw.get("structured_output")
    if isinstance(structured, dict) and isinstance(structured.get("findings"), list):
        return structured["findings"]
    return None


def score(key: dict) -> dict:
    tol = key["tolerance"]
    report = {}
    for config in CONFIGS:
        rows, cost, wall = [], 0.0, 0.0
        for name, case in key["cases"].items():
            path = RAW_DIR / config / f"{name}.json"
            if not path.exists():
                continue
            raw = json.loads(path.read_text(encoding="utf-8"))
            cost += raw.get("total_cost_usd") or 0.0
            wall += raw["_meta"]["wall_s"]
            found = findings_of(raw)
            row = {"case": name, "bug": bool(case["bug"]), "valid": found is not None,
                   "cost_usd": raw.get("total_cost_usd"), "findings": len(found or [])}
            if found is not None:
                near = [f for f in found if any(abs(int(f.get("line", -99)) - a) <= tol for a in case["anchor_lines"])]
                row["caught"] = bool(near)
                row["caught_high"] = any(f.get("severity") in STRONG for f in near)
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
    parser.add_argument("--configs", nargs="*", default=list(CONFIGS), choices=list(CONFIGS))
    parser.add_argument("--cases", nargs="*", help="case file names (default: all)")
    parser.add_argument("--budget-per-run", type=float, default=3.0, help="--max-budget-usd cap per run")
    parser.add_argument("--dry-run", action="store_true", help="validate and print the plan; no model calls")
    parser.add_argument("--score-only", action="store_true", help="rescore saved runs; no model calls")
    args = parser.parse_args()

    key = load_key()
    cases = args.cases or list(key["cases"])
    unknown = set(cases) - set(key["cases"])
    if unknown:
        sys.exit(f"unknown case(s): {sorted(unknown)}")

    if not args.score_only:
        plan = [(c, n) for c in args.configs for n in cases if not (RAW_DIR / c / f"{n}.json").exists()]
        print(f"corpus OK: {sum(bool(k['bug']) for k in key['cases'].values())} bug cases, "
              f"{sum(not k['bug'] for k in key['cases'].values())} controls")
        print(f"{len(plan)} run(s) to do (saved runs are reused), cap ${args.budget_per_run:.2f} each")
        if args.dry_run:
            for c, n in plan:
                print(f"  {c:14} {n}")
            return 0
        exe = claude_bin()
        for i, (config, name) in enumerate(plan, 1):
            print(f"[{i}/{len(plan)}] {config} {name} ...", end=" ", flush=True)
            raw = run_one(exe, config, name, args.budget_per_run)
            if raw.get("is_error") or raw.get("parse_error"):
                # Auth expiry, a rate limit or an unavailable model fails
                # every remaining run the same way: stop, and save nothing,
                # so a rerun retries this item instead of reusing a failure.
                reason = raw.get("result") or raw.get("stdout") or raw["_meta"]["stderr"]
                print(f"FAILED — stopping. {str(reason).strip()[:300]}")
                return 1
            dest = RAW_DIR / config / f"{name}.json"
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(json.dumps(raw, indent=2, ensure_ascii=False), encoding="utf-8")
            found = findings_of(raw)
            status = f"{len(found)} findings" if found is not None else "NO STRUCTURED OUTPUT"
            print(f"{status}, ${raw.get('total_cost_usd') or 0:.3f}, {raw['_meta']['wall_s']}s")

    report = score(key)
    SCORES_PATH.parent.mkdir(parents=True, exist_ok=True)
    SCORES_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print_table(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
