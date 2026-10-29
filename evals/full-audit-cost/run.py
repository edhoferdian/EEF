#!/usr/bin/env python3
"""Cost check for security-review-edho-ferdian's Mode C full audit.

Mode C promises "the fewest agents that cover the ledger, ceiling 5". This
measures what one real run spends and finds: it builds a throwaway git repo
from the seeded-bug security corpus (../review-seeded-bugs/cases-security,
8 seeded vulnerabilities and 2 safe controls, under src/), with
project-memory/audit/ git-ignored so the storage guard passes, installs this
checkout's skills and Claude agents as project files, and runs one headless
Claude Code session that asks for a full audit before production.

Recorded per run: total cost (Claude Code's client-side estimate), agents
spawned and by type, wall time, whether findings.json and the ledger pass
the vendored validators, and recall against the answer key — a seeded bug
counts when a confirmed or needs-validation record has a trace or evidence
entry in its file within the key's line tolerance of the anchor.

    python run.py --dry-run                  # build the repo, show the command, no model call
    python run.py --label first-run          # one real run (spends model usage)

Each run writes a new record, results/runs/<UTC time>-<label>.json; records
are append-only like the review benchmark's. The run directory is copied
under results/raw/<label>/ (git-ignored) for inspection.
"""
import argparse
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
BENCH = HERE.parent / "review-seeded-bugs"

spec = importlib.util.spec_from_file_location("bench", BENCH / "run.py")
bench = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bench)

CORPUS = bench.CORPORA["security"]
VALIDATOR = ROOT / "skills" / "security-review-edho-ferdian" / "scripts" / "validate-audit.cjs"
TOOLS = ["Read", "Grep", "Glob", "Bash", "Write", "Edit", "Skill", "Agent"]

PROMPT = (
    "This repository is about to go to production. Run a full security audit of the "
    "whole repository before production, using the security-review-edho-ferdian skill "
    "in Mode C (references/full-audit.md). The product source is under src/. Work non-interactively: there is no user to "
    "answer questions, so when the skill would ask, take its default and say so in "
    "REPORT.md. Finish with the run directory written and both validators passing."
)


def build_repo(work: Path) -> None:
    src = work / "src"
    src.mkdir(parents=True)
    for case in CORPUS["cases_dir"].iterdir():
        if not case.name.startswith("_"):
            shutil.copy(case, src / case.name)
    # .claude/ is tooling for the session, not part of the audited product.
    (work / ".gitignore").write_text("project-memory/audit/\n.claude/\n", encoding="utf-8")
    shutil.copytree(ROOT / "skills", work / ".claude" / "skills")
    shutil.copytree(ROOT / "dist" / "agents" / "claude", work / ".claude" / "agents")
    git = ["git", "-c", "core.autocrlf=false", "-c", "user.name=eef-eval", "-c", "user.email=eef-eval@example.invalid"]
    subprocess.run(["git", "init", "-q"], cwd=work, check=True)
    subprocess.run([*git, "add", "-A"], cwd=work, check=True)
    subprocess.run([*git, "commit", "-q", "-m", "seeded corpus"], cwd=work, check=True)


def command(exe: str, model: str, effort: str, budget: float) -> list[str]:
    return [
        exe, "-p", PROMPT,
        "--model", model,
        "--effort", effort,
        "--output-format", "json",
        "--tools", ",".join(TOOLS),
        "--allowedTools", *TOOLS,
        "--setting-sources", "project",
        "--strict-mcp-config",
        "--no-session-persistence",
        "--max-budget-usd", str(budget),
    ]


def validate(kind: str, path: Path) -> bool:
    if not path.is_file():
        return False
    return subprocess.run(["node", str(VALIDATOR), kind, str(path)], capture_output=True).returncode == 0


def recall(findings: list, key: dict) -> dict:
    tol = key["tolerance"]
    caught, missed, control_hits = [], [], []
    def lines_in(record: dict, name: str) -> list[int]:
        return [e["line"] for part in ("trace", "evidence") for e in record.get(part, [])
                if str(e.get("file", "")).replace("\\", "/").endswith(name)]
    kept = [f for f in findings if f.get("verdict") in ("confirmed", "needs_validation")]
    for name, case in key["cases"].items():
        hits = [f for f in kept if lines_in(f, name)]
        if not case["bug"]:
            control_hits += [name for f in hits if f.get("verdict") == "confirmed"]
            continue
        near = any(abs(line - anchor) <= tol for f in hits for line in lines_in(f, name)
                   for anchor in case["anchor_lines"])
        (caught if near else missed).append(name)
    return {"bug_cases": len(caught) + len(missed), "caught": caught, "missed": missed,
            "confirmed_on_controls": sorted(set(control_hits))}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model", default="sonnet")
    parser.add_argument("--effort", default="medium")
    parser.add_argument("--budget", type=float, default=15.0, help="--max-budget-usd cap for the whole run")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--label", help="record name (lowercase letters, digits, hyphens); required unless --dry-run")
    args = parser.parse_args()
    if not args.dry_run and not (args.label and bench.LABEL.match(args.label)):
        parser.error("--label is required: lowercase letters, digits and hyphens")

    key = bench.load_key(CORPUS)
    with tempfile.TemporaryDirectory(prefix="eef-full-audit-") as tmp:
        work = Path(tmp)
        build_repo(work)
        cmd = command(bench.claude_bin(), args.model, args.effort, args.budget)
        if args.dry_run:
            print(f"repo built at {work} ({len(list((work / 'src').iterdir()))} files)")
            print(" ".join(c if " " not in c else repr(c) for c in cmd[:2]), "...", " ".join(cmd[3:]))
            return 0
        started = time.monotonic()
        proc = subprocess.run(cmd, cwd=work, capture_output=True, text=True, encoding="utf-8", timeout=5400)
        wall = round(time.monotonic() - started, 1)
        try:
            out = json.loads(proc.stdout)
        except json.JSONDecodeError:
            out = {"parse_error": True, "stdout": proc.stdout[-4000:]}
        runs = sorted((work / "project-memory" / "audit").glob("run-*"))
        run_dir = runs[-1] if runs else None
        raw = HERE / "results" / "raw" / args.label
        if run_dir:
            shutil.copytree(run_dir, raw / run_dir.name, dirs_exist_ok=True)
        raw.mkdir(parents=True, exist_ok=True)
        (raw / "session.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
        findings_path = run_dir / "findings.json" if run_dir else None
        findings = json.loads(findings_path.read_text(encoding="utf-8")) if findings_path and findings_path.is_file() else []
        metadata_path = run_dir / "run-metadata.json" if run_dir else None
        metadata = json.loads(metadata_path.read_text(encoding="utf-8")) if metadata_path and metadata_path.is_file() else {}
        stats = out.get("subagent_stats") or {}
        record = {
            "record_version": 1,
            "label": args.label,
            "created_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "git_sha": bench.git_out("rev-parse", "HEAD"),
            "git_dirty": bool(bench.git_out("status", "--porcelain", "--untracked-files=no")),
            "claude_version": bench.claude_version(),
            "config": {"model": args.model, "effort": args.effort, "budget_usd": args.budget},
            "session": {"returncode": proc.returncode, "is_error": out.get("is_error"),
                        "terminal_reason": out.get("terminal_reason"), "num_turns": out.get("num_turns"),
                        "wall_s": wall, "cost_usd": out.get("total_cost_usd"),
                        "agents_spawned": stats.get("spawned"), "agents_by_type": stats.get("by_type"),
                        "model_usage": out.get("modelUsage")},
            "run_dir": run_dir.name if run_dir else None,
            "agents_planned": metadata.get("agents"),
            "run_status": metadata.get("run_status"),
            "validators": {"findings": validate("findings", findings_path) if findings_path else False,
                           "ledger": validate("ledger", run_dir / "coverage-ledger.json") if run_dir else False},
            "verdicts": {v: sum(f.get("verdict") == v for f in findings)
                         for v in ("confirmed", "needs_validation", "rejected")},
            "recall": recall(findings, key),
        }
    dest = HERE / "results" / "runs"
    dest.mkdir(parents=True, exist_ok=True)
    path = dest / f"{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}-{args.label}.json"
    with path.open("x", encoding="utf-8") as fh:
        json.dump(record, fh, indent=2, ensure_ascii=False)
    print(json.dumps({k: record[k] for k in ("session", "agents_planned", "validators", "verdicts", "recall")}, indent=2))
    print(f"record: {path.relative_to(HERE).as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
