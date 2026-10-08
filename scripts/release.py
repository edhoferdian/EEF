#!/usr/bin/env python3
"""Cut an EEF release in one command.

    python scripts/release.py 1.21.0 --summary "what this release is about"
    python scripts/release.py 1.21.0 --dry-run     # checks and plan only

Runs, in order, and stops at the first step that fails:

 1. preconditions — on main, clean tree, not behind origin/main, the new
    version is higher than package.json's, the tag does not exist yet;
 2. bump — package.json/package-lock.json (npm version) and the Claude Code
    plugin version in .claude-plugin/ by the same kind of bump (major,
    minor or patch);
 3. checks — validate_skills.py, every `run_check` script listed in
    .husky/pre-commit (so the two lists cannot drift apart), the
    per-session context budget, and `node --check bin/eef.js`;
 4. commit the bump and push main;
 5. wait for CI on that exact commit and require it green;
 6. create the GitHub release from that commit, with notes from
    generate_changelog.py --notes — publishing it triggers publish.yml;
 7. wait for the publish workflow and report whether npm authenticated
    through trusted publishing (OIDC) or fell back to NPM_TOKEN;
 8. regenerate CHANGELOG.md with the new tag, commit and push it.

Every step that writes or publishes is skipped with --dry-run. Needs git,
gh (authenticated), npm, node and python on PATH.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PLUGIN_FILES = [REPO / ".claude-plugin" / "plugin.json", REPO / ".claude-plugin" / "marketplace.json"]
CONTEXT_BUDGET = "13500"  # keep equal to ci.yml's measure_context.py --budget


class ReleaseError(Exception):
    pass


CHILD_ENV = {**os.environ, "PYTHONIOENCODING": "utf-8"}  # Windows Python defaults to cp1252 output


def run(*cmd: str, capture: bool = True) -> str:
    exe = shutil.which(cmd[0]) or cmd[0]
    proc = subprocess.run([exe, *cmd[1:]], cwd=REPO, capture_output=capture, text=True, encoding="utf-8",
                          errors="replace", env=CHILD_ENV)
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "").strip() if capture else ""
        raise ReleaseError(f"`{' '.join(cmd)}` failed (exit {proc.returncode}). {detail[-800:]}")
    return (proc.stdout or "").strip() if capture else ""


def step(title: str) -> None:
    print(f"\n== {title}", flush=True)


def parse(version: str) -> tuple[int, int, int]:
    m = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", version)
    if not m:
        raise ReleaseError(f"version must look like 1.21.0, got {version!r}")
    return tuple(int(x) for x in m.groups())


def bump_kind(old: tuple, new: tuple) -> str:
    if new <= old:
        raise ReleaseError(f"{'.'.join(map(str, new))} is not higher than the current {'.'.join(map(str, old))}")
    return "major" if new[0] > old[0] else "minor" if new[1] > old[1] else "patch"


def bumped(version: str, kind: str) -> str:
    major, minor, patch = parse(version)
    return {"major": f"{major + 1}.0.0", "minor": f"{major}.{minor + 1}.0", "patch": f"{major}.{minor}.{patch + 1}"}[kind]


def plugin_version() -> str:
    return json.loads(PLUGIN_FILES[0].read_text(encoding="utf-8"))["version"]


def set_plugin_version(old: str, new: str) -> None:
    """Change the plugin's version in plugin.json and its entry in
    marketplace.json — not the marketplace's own version, which differs."""
    for path in PLUGIN_FILES:
        text = path.read_text(encoding="utf-8")
        target = f'"version": "{old}"'
        if text.count(target) != 1:
            raise ReleaseError(f"{path.name}: expected exactly one {target}")
        path.write_text(text.replace(target, f'"version": "{new}"'), encoding="utf-8", newline="\n")


def check_scripts() -> list[str]:
    hook = (REPO / ".husky" / "pre-commit").read_text(encoding="utf-8")
    names = re.findall(r"^run_check (\w+)\s*$", hook, re.M)
    if not names:
        raise ReleaseError(".husky/pre-commit lists no run_check scripts — refusing to release unchecked")
    return names


def run_checks() -> None:
    run("python", "scripts/validate_skills.py")
    for name in check_scripts():
        run("python", f"scripts/{name}.py", "--check")
    run("python", "scripts/measure_context.py", "--budget", CONTEXT_BUDGET)
    run("node", "--check", "bin/eef.js")


def wait_for_run(workflow: str, *, commit: str | None = None, timeout_s: int = 1800) -> str:
    """Find the workflow run (for a commit, or the newest), wait for it to
    finish, and return its id. Raises unless it concluded successfully."""
    deadline = time.monotonic() + 180
    run_id = None
    while run_id is None:
        args = ["gh", "run", "list", "--workflow", workflow, "--limit", "1", "--json", "databaseId"]
        if commit:
            args += ["--commit", commit]
        found = json.loads(run(*args) or "[]")
        if found:
            run_id = str(found[0]["databaseId"])
        elif time.monotonic() > deadline:
            raise ReleaseError(f"no {workflow} run appeared for {commit or 'the release'} within 3 minutes")
        else:
            time.sleep(10)
    print(f"   waiting for {workflow} run {run_id} ...", flush=True)
    watch = subprocess.run([shutil.which("gh") or "gh", "run", "watch", run_id, "--exit-status"],
                           cwd=REPO, capture_output=True, text=True, encoding="utf-8", errors="replace",
                           timeout=timeout_s)
    conclusion = run("gh", "run", "view", run_id, "--json", "conclusion", "--jq", ".conclusion")
    if watch.returncode != 0 or conclusion != "success":
        raise ReleaseError(f"{workflow} run {run_id} ended {conclusion or 'unsuccessfully'} — see `gh run view {run_id} --log-failed`")
    return run_id


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("version", help="new version, e.g. 1.21.0")
    parser.add_argument("--summary", default="", help="short summary for the bump commit subject")
    parser.add_argument("--dry-run", action="store_true", help="run preconditions and checks, print the plan, write nothing")
    args = parser.parse_args()
    new = args.version
    tag = f"v{new}"

    try:
        step("1. Preconditions")
        if run("git", "rev-parse", "--abbrev-ref", "HEAD") != "main":
            raise ReleaseError("not on main")
        if run("git", "status", "--porcelain"):
            raise ReleaseError("working tree is not clean — commit or stash first")
        run("git", "fetch", "-q", "--tags", "origin")
        behind = int(run("git", "rev-list", "--count", "main..origin/main"))
        if behind:
            raise ReleaseError(f"main is {behind} commit(s) behind origin/main — another session pushed; integrate it first")
        if run("git", "tag", "--list", tag):
            raise ReleaseError(f"tag {tag} already exists")
        current = json.loads((REPO / "package.json").read_text(encoding="utf-8"))["version"]
        kind = bump_kind(parse(current), parse(new))
        old_plugin = plugin_version()
        new_plugin = bumped(old_plugin, kind)
        run("gh", "auth", "status")
        print(f"   npm {current} -> {new} ({kind}); plugin {old_plugin} -> {new_plugin}")

        step("2-3. Checks (before any change)")
        run_checks()
        print("   validate_skills, every pre-commit export check, context budget, eef.js: all green")

        if args.dry_run:
            print(f"\nDry run: would bump, commit, push, wait for CI, release {tag}, watch publish, regenerate CHANGELOG.md.")
            return 0

        step("2. Bump versions")
        run("npm", "version", new, "--no-git-tag-version")
        set_plugin_version(old_plugin, new_plugin)
        run_checks()  # sync_metadata and friends must still pass on the bumped tree

        step("4. Commit and push")
        subject = f"chore: bump version to {new}" + (f" ({args.summary})" if args.summary else "")
        run("git", "add", "package.json", "package-lock.json", *[str(p.relative_to(REPO)) for p in PLUGIN_FILES])
        run("git", "commit", "-q", "-m", subject, "-m",
            f"npm {current} -> {new} and the Claude Code plugin {old_plugin} -> {new_plugin}.")
        sha = run("git", "rev-parse", "HEAD")
        run("git", "push", "-q", "origin", "main")
        print(f"   pushed {sha[:7]}")

        step("5. CI on the release commit")
        wait_for_run("ci.yml", commit=sha)
        print("   CI green")

        step("6. GitHub release")
        run("git", "fetch", "-q", "origin")
        if run("git", "rev-parse", "origin/main") != sha:
            raise ReleaseError("origin/main moved after the push — release that commit by hand after checking what landed")
        notes = run("python", "scripts/generate_changelog.py", "--notes")
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as fh:
            fh.write(notes + "\n")
        url = run("gh", "release", "create", tag, "--target", "main", "--title", tag, "--notes-file", fh.name)
        print(f"   {url}")

        step("7. npm publish (publish.yml)")
        publish_id = wait_for_run("publish.yml")
        log = run("gh", "run", "view", publish_id, "--log")
        if f"+ eef-install@{new}" not in log:
            raise ReleaseError(f"publish run {publish_id} succeeded but its log does not show + eef-install@{new}")
        via_token = "bypass 2FA" in log
        print(f"   published eef-install@{new} — authenticated via "
              f"{'NPM_TOKEN fallback (trusted publishing not used)' if via_token else 'trusted publishing (OIDC)'}")

        step("8. CHANGELOG.md")
        run("git", "fetch", "-q", "--tags", "origin")
        run("python", "scripts/generate_changelog.py")
        if run("git", "status", "--porcelain", "CHANGELOG.md"):
            run("git", "commit", "-q", "-m", f"docs: regenerate CHANGELOG.md for {tag}", "--", "CHANGELOG.md")
            run("git", "push", "-q", "origin", "main")
            print("   committed and pushed")
        print(f"\nReleased {tag}. npm may take a few minutes to show it (`npm view eef-install version`).")
        if not via_token:
            print("Trusted publishing works: on npmjs.com set 'Require two-factor authentication and disallow tokens', "
                  "revoke the automation token, and delete the NPM_TOKEN secret (`gh secret delete NPM_TOKEN`).")
        return 0
    except ReleaseError as err:
        print(f"\nSTOPPED: {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
