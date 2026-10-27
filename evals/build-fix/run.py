#!/usr/bin/env python3
"""Outcome benchmark for build-fix-edho-ferdian: does the fix make the
build green without hiding the error?

The trigger evals only show the skill loads. This measures what it
produces. Each case under cases/ is a tiny zero-dependency project
(Python stdlib unittest or node:test) that fails its `verify` command with
one real build/startup error. A headless Claude Code session fixes it in a
temp copy; the scorer then runs `verify` itself and diffs the result:

| check          | passes when                                                    |
|----------------|----------------------------------------------------------------|
| green          | `verify` exits 0 after the session                             |
| no_suppression | no added line matches `forbidden_added` (bare except, ignores, |
|                | skips, catch-alls) — the anti-suppression gate in the skill   |
| tests_intact   | every `protected` path is byte-identical (tests not edited)    |
| minimal        | added+removed lines <= `max_changed_lines`                     |
| clean_fix      | all four                                                       |

Records follow ../review-seeded-bugs/: raw output under results/raw/
(git-ignored, reused so an interrupted run resumes), one new record per
scoring pass under results/runs/, never modified (--check-records).

Every real run spends model usage. --dry-run and --self-test call no model:
--dry-run checks every case fails `verify` as committed; --self-test also
applies each case's reference fix (must score clean) and suppression fix
(must not).

Usage:
    python run.py --dry-run
    python run.py --self-test
    python run.py --configs sonnet-medium --cases b03-esm-require --label pilot
    python run.py --label full-run
    python run.py --score-only --label rescore
    python run.py --check-records [BASE]
"""
import argparse
import difflib
import importlib.util
import itertools
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
CASES = HERE / "cases"
RESULTS = HERE / "results"
KEY = HERE / "answer-key.json"

# Shared with the seeded-bug benchmark: model configs, label/record rules and
# the claude/git helpers. Loaded by path — both files are named run.py.
_spec = importlib.util.spec_from_file_location("seeded_bugs_run", HERE.parent / "review-seeded-bugs" / "run.py")
_seeded = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_seeded)
CONFIGS, LABEL, RECORD_PATH = _seeded.CONFIGS, _seeded.LABEL, _seeded.RECORD_PATH
claude_bin, claude_version, git_out = _seeded.claude_bin, _seeded.claude_version, _seeded.git_out

PROMPT = (
    "The tests in this project no longer run: `{verify}` fails with\n\n    {error}\n\n"
    "Fix it using the build-fix-edho-ferdian skill. This working directory is the "
    "whole project; there is no network and nothing to install. Run `{verify}` "
    "yourself to confirm the fix. Report the root cause and the files you changed."
)

SCHEMA = {
    "type": "object",
    "properties": {
        "root_cause": {"type": "string"},
        "files_changed": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["root_cause", "files_changed"],
}


def load_key() -> dict:
    key = json.loads(KEY.read_text(encoding="utf-8"))
    on_disk = {p.name for p in CASES.iterdir() if p.is_dir()}
    if on_disk != set(key["cases"]):
        sys.exit(f"answer-key and cases/ disagree: {sorted(on_disk ^ set(key['cases']))}")
    key["forbidden"] = [re.compile(p) for p in key["forbidden_added"]]
    return key


def tool(cmd: list[str]) -> list[str]:
    exe = shutil.which(cmd[0])
    return [exe or cmd[0], *cmd[1:]]


def verify(case: dict, root: Path) -> tuple[bool, str]:
    proc = subprocess.run(tool(case["verify"]), cwd=root, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=120)
    return proc.returncode == 0, (proc.stdout + proc.stderr)[-1500:]


def files_of(root: Path) -> dict[str, bytes]:
    return {p.relative_to(root).as_posix(): p.read_bytes()
            for p in root.rglob("*") if p.is_file() and "__pycache__" not in p.parts}


def score_tree(key: dict, case: dict, before: Path, after: Path) -> dict:
    ok, tail = verify(case, after)
    old, new = files_of(before), files_of(after)
    added, changed_lines = [], 0
    for path in sorted(set(old) | set(new)):
        a = old.get(path, b"").decode("utf-8", errors="replace").splitlines()
        b = new.get(path, b"").decode("utf-8", errors="replace").splitlines()
        for line in difflib.unified_diff(a, b, lineterm="", n=0):
            if line.startswith(("+++", "---", "@@")):
                continue
            changed_lines += 1
            if line.startswith("+"):
                added.append((path, line[1:]))
    suppressions = [f"{p}: {l.strip()}" for p, l in added if any(rx.search(l) for rx in key["forbidden"])]
    touched = sorted(p for p in set(old) | set(new)
                     if any(p.startswith(prot) for prot in case["protected"]) and old.get(p) != new.get(p))
    row = {
        "green": ok,
        "no_suppression": not suppressions,
        "tests_intact": not touched,
        "minimal": changed_lines <= case["max_changed_lines"],
        "changed_lines": changed_lines,
        "suppressions": suppressions,
        "protected_touched": touched,
        "verify_tail": "" if ok else tail,
    }
    row["clean_fix"] = all(row[k] for k in ("green", "no_suppression", "tests_intact", "minimal"))
    return row


def apply_fix(root: Path, fix: list[list[str]]) -> None:
    for rel, old, new in fix:
        path = root / rel
        text = path.read_text(encoding="utf-8")
        if text.count(old) != 1:
            sys.exit(f"fix for {rel}: {old!r} matches {text.count(old)} times, need exactly 1")
        path.write_text(text.replace(old, new), encoding="utf-8", newline="\n")


def self_test(key: dict, names: list[str]) -> int:
    failures = 0
    for name in names:
        case = key["cases"][name]
        src = CASES / name
        broken_ok, _ = verify(case, src)
        checks = {"fails as committed": not broken_ok}
        for kind, want_clean in (("reference_fix", True), ("suppression_fix", False)):
            if kind not in case:
                continue
            with tempfile.TemporaryDirectory(prefix="eef-buildfix-self-") as work:
                shutil.copytree(src, work, dirs_exist_ok=True)
                apply_fix(Path(work), case[kind])
                row = score_tree(key, case, src, Path(work))
            checks[f"{kind} {'scores clean' if want_clean else 'is rejected'}"] = row["clean_fix"] == want_clean
        bad = [c for c, ok in checks.items() if not ok]
        failures += bool(bad)
        print(f"  {name:22} {'OK' if not bad else 'FAIL: ' + ', '.join(bad)}")
    return 1 if failures else 0


def run_one(exe: str, config: str, name: str, case: dict, budget: float) -> dict:
    model, effort = CONFIGS[config]
    with tempfile.TemporaryDirectory(prefix="eef-buildfix-") as work:
        shutil.copytree(CASES / name, work, dirs_exist_ok=True)
        cmd = [
            exe, "-p", PROMPT.format(verify=" ".join(case["verify"]), error=case["error"]),
            "--model", model,
            "--effort", effort,
            "--output-format", "json",
            "--json-schema", json.dumps(SCHEMA),
            "--tools", "Read,Grep,Glob,Skill,Edit,Write,Bash",
            "--allowedTools", "Read", "Grep", "Glob", "Skill", "Edit", "Write",
            "Bash(python:*)", "Bash(python3:*)", "Bash(node:*)",
            "--strict-mcp-config",
            "--no-session-persistence",
            "--max-budget-usd", str(budget),
        ]
        started = time.monotonic()
        proc = subprocess.run(cmd, cwd=work, capture_output=True, text=True, encoding="utf-8", timeout=1800)
        elapsed = time.monotonic() - started
        row = score_tree(load_key(), case, CASES / name, Path(work))
    try:
        out = json.loads(proc.stdout)
    except json.JSONDecodeError:
        out = {"parse_error": True, "stdout": proc.stdout[-4000:]}
    out["_meta"] = {"config": config, "model": model, "effort": effort, "case": name,
                    "returncode": proc.returncode, "stderr": proc.stderr[-2000:], "wall_s": round(elapsed, 1)}
    out["_score"] = row
    return out


def score(key: dict) -> dict:
    report = {}
    for config in CONFIGS:
        rows, cost = [], 0.0
        for name in key["cases"]:
            path = RESULTS / "raw" / config / f"{name}.json"
            if not path.exists():
                continue
            raw = json.loads(path.read_text(encoding="utf-8"))
            cost += raw.get("total_cost_usd") or 0.0
            rows.append({"case": name, "cost_usd": raw.get("total_cost_usd"), **raw["_score"]})
        report[config] = {
            "runs": len(rows),
            **{k: sum(r[k] for r in rows) for k in ("green", "no_suppression", "tests_intact", "minimal", "clean_fix")},
            "cost_usd": round(cost, 4),
            "not_clean": [r["case"] for r in rows if not r["clean_fix"]],
            "rows": rows,
        }
    return report


def write_record(report: dict, label: str) -> Path:
    now = datetime.now(timezone.utc)
    record = {
        "record_version": 1,
        "corpus": "build-fix",
        "label": label,
        "created_utc": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "git_sha": git_out("rev-parse", "HEAD"),
        "git_dirty": bool(git_out("status", "--porcelain", "--untracked-files=no")),
        "claude_version": claude_version(),
        "configs": {c: dict(zip(("model", "effort"), CONFIGS[c])) for c, r in report.items() if r["runs"]},
        "scores": report,
    }
    runs = RESULTS / "runs"
    runs.mkdir(parents=True, exist_ok=True)
    stem = f"{now.strftime('%Y%m%dT%H%M%SZ')}-{label}"
    for n in itertools.count(1):
        path = runs / (f"{stem}.json" if n == 1 else f"{stem}-{n}.json")
        try:
            with path.open("x", encoding="utf-8") as fh:
                fh.write(json.dumps(record, indent=2) + "\n")
            return path
        except FileExistsError:
            continue


def check_records(base: str) -> int:
    cmd = ["diff", "--name-status", "--no-renames", *([f"{base}...HEAD"] if base else ["--cached"])]
    out = subprocess.run(["git", *cmd, "--", "."], cwd=HERE, capture_output=True, text=True)
    if out.returncode != 0:
        print(f"check-records: `git {' '.join(cmd)}` failed (is {base or 'the index'} reachable?)")
        return 1
    bad = [line for line in out.stdout.splitlines()
           if RECORD_PATH.search(line.partition("\t")[2]) and not line.startswith("A\t")]
    if bad:
        print("check-records: build-fix records are append-only; these change or remove one:")
        print("\n".join(f"  {b}" for b in bad))
        return 1
    print("check-records: OK, build-fix records are only added")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--configs", nargs="*", default=list(CONFIGS), choices=list(CONFIGS))
    parser.add_argument("--cases", nargs="*", help="case names (default: all)")
    parser.add_argument("--budget-per-run", type=float, default=2.0, help="--max-budget-usd cap per run")
    parser.add_argument("--dry-run", action="store_true", help="check every case fails as committed; no model calls")
    parser.add_argument("--self-test", action="store_true", help="also prove reference/suppression fixes score right")
    parser.add_argument("--score-only", action="store_true", help="rescore saved runs; no model calls")
    parser.add_argument("--label", help="name for this pass's record (required unless --dry-run/--self-test)")
    parser.add_argument("--check-records", nargs="?", const="", metavar="BASE")
    args = parser.parse_args()

    if args.check_records is not None:
        return check_records(args.check_records)
    key = load_key()
    cases = args.cases or list(key["cases"])
    unknown = set(cases) - set(key["cases"])
    if unknown:
        sys.exit(f"unknown case(s): {sorted(unknown)}")
    if args.self_test:
        print(f"self-test: {len(cases)} case(s)")
        return self_test(key, cases)
    if args.dry_run:
        plan = [(c, n) for c in args.configs for n in cases if not (RESULTS / "raw" / c / f"{n}.json").exists()]
        broken = [n for n in cases if verify(key["cases"][n], CASES / n)[0]]
        if broken:
            print(f"these cases already pass verify, so they test nothing: {broken}")
            return 1
        print(f"{len(cases)} case(s) fail verify as committed; {len(plan)} run(s) to do, cap ${args.budget_per_run:.2f} each")
        return 0
    if not args.label or not LABEL.match(args.label):
        parser.error("--label is required (lowercase letters, digits, hyphens): every scoring pass writes a new record")

    if not args.score_only:
        exe = claude_bin()
        plan = [(c, n) for c in args.configs for n in cases if not (RESULTS / "raw" / c / f"{n}.json").exists()]
        for i, (config, name) in enumerate(plan, 1):
            print(f"[{i}/{len(plan)}] {config} {name} ...", end=" ", flush=True)
            raw = run_one(exe, config, name, key["cases"][name], args.budget_per_run)
            if raw.get("is_error") or raw.get("parse_error"):
                reason = raw.get("result") or raw.get("stdout") or raw["_meta"]["stderr"]
                print(f"FAILED — stopping. {str(reason).strip()[:300]}")
                return 1
            dest = RESULTS / "raw" / config / f"{name}.json"
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(json.dumps(raw, indent=2, ensure_ascii=False), encoding="utf-8")
            print(f"{'clean' if raw['_score']['clean_fix'] else 'NOT clean'}, ${raw.get('total_cost_usd') or 0:.3f}")

    report = score(key)
    if not any(r["runs"] for r in report.values()):
        print("no saved runs under results/raw/ — no record written")
        return 1
    print("\n| config | clean fix | green | no suppression | tests intact | minimal | cost |")
    print("|---|---|---|---|---|---|---|")
    for config, r in report.items():
        if r["runs"]:
            n = r["runs"]
            print(f"| {config} | {r['clean_fix']}/{n} | {r['green']}/{n} | {r['no_suppression']}/{n} "
                  f"| {r['tests_intact']}/{n} | {r['minimal']}/{n} | ${r['cost_usd']:.2f} |")
    print(f"\nrecord: {write_record(report, args.label).relative_to(HERE).as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
