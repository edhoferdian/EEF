#!/usr/bin/env python3
"""Cut an EEF release in one command.

    python scripts/release.py 1.21.0 --summary "what this release is about"
    python scripts/release.py 1.21.0 --dry-run     # checks and plan only

main only accepts commits that passed CI (.github/rulesets/main.json), so
everything lands through pull requests. In order, stopping at the first
step that fails:

 1. preconditions — on main, clean tree, not behind origin/main, the new
    version is higher than package.json's, the tag does not exist yet;
 2. checks — validate_skills.py, every `run_check` script listed in
    .husky/pre-commit (so the two lists cannot drift apart), the
    benchmark-record check, the per-session context budget, and
    `node --check bin/eef.js`;
 3. bump on branch release/vX.Y.Z — package.json/package-lock.json (npm
    version) and the Claude Code plugin version in .claude-plugin/ by the
    same kind of bump (major, minor or patch) — re-run the checks, push,
    open a PR, wait for CI on it, squash-merge it;
 4. create the GitHub release on the commit that landed on main (its full
    SHA), with notes from generate_changelog.py --notes — publishing it
    triggers publish.yml;
 5. wait for the publish workflow and report whether npm authenticated
    through trusted publishing (OIDC) or fell back to NPM_TOKEN;
 6. regenerate CHANGELOG.md with the new tag and land it through a PR the
    same way.

--dry-run runs steps 1-2 and prints the plan. Needs git, gh
(authenticated), npm, node and python on PATH.
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
CHILD_ENV = {**os.environ, "PYTHONIOENCODING": "utf-8"}  # Windows Python defaults to cp1252 output


class ReleaseError(Exception):
    pass


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
    run("python", "evals/review-seeded-bugs/run.py", "--check-records")
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


def land_through_pr(branch: str, paths: list[str], subject: str, body: str) -> str:
    """Commit `paths` on a new branch from main, open a PR, wait for its
    CI, squash-merge it, and return the full SHA that landed on main."""
    run("git", "switch", "-q", "-c", branch)
    try:
        run("git", "add", *paths)
        run("git", "commit", "-q", "-m", subject, "-m", body)
        head = run("git", "rev-parse", "HEAD")
        run("git", "push", "-q", "-u", "origin", branch)
        url = run("gh", "pr", "create", "--base", "main", "--head", branch, "--title", subject, "--body", body)
        print(f"   {url}")
        wait_for_run("ci.yml", commit=head)
        run("gh", "pr", "merge", branch, "--squash", "--delete-branch", "--subject", subject)
    finally:
        run("git", "switch", "-q", "main")
    run("git", "pull", "-q", "--ff-only", "origin", "main")
    if run("git", "branch", "--list", branch):  # gh pr merge --delete-branch usually removed it already
        run("git", "branch", "-q", "-D", branch)
    landed = run("git", "rev-parse", "HEAD")
    if run("git", "rev-parse", "origin/main") != landed:
        raise ReleaseError("local main does not match origin/main after the merge")
    print(f"   merged as {landed[:7]}")
    return landed


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
        ahead = int(run("git", "rev-list", "--count", "origin/main..main"))
        if behind:
            raise ReleaseError(f"main is {behind} commit(s) behind origin/main — another session pushed; integrate it first")
        if ahead:
            raise ReleaseError(f"main has {ahead} commit(s) not on origin/main — land them through a PR first")
        if run("git", "tag", "--list", tag):
            raise ReleaseError(f"tag {tag} already exists")
        current = json.loads((REPO / "package.json").read_text(encoding="utf-8"))["version"]
        kind = bump_kind(parse(current), parse(new))
        old_plugin = plugin_version()
        new_plugin = bumped(old_plugin, kind)
        run("gh", "auth", "status")
        print(f"   npm {current} -> {new} ({kind}); plugin {old_plugin} -> {new_plugin}")

        step("2. Checks (before any change)")
        run_checks()
        print("   validate_skills, every pre-commit export check, benchmark records, context budget, eef.js: all green")

        if args.dry_run:
            print(f"\nDry run: would bump on release/{tag} through a PR, release {tag}, watch publish, "
                  f"and land CHANGELOG.md through a second PR.")
            return 0

        step("3. Bump through a PR")
        run("npm", "version", new, "--no-git-tag-version")
        set_plugin_version(old_plugin, new_plugin)
        run_checks()  # sync_metadata and friends must still pass on the bumped tree
        subject = f"chore: bump version to {new}" + (f" ({args.summary})" if args.summary else "")
        landed = land_through_pr(
            f"release/{tag}",
            ["package.json", "package-lock.json", *[str(p.relative_to(REPO)) for p in PLUGIN_FILES]],
            subject,
            f"npm {current} -> {new} and the Claude Code plugin {old_plugin} -> {new_plugin}.",
        )
        if json.loads(run("git", "show", f"{landed}:package.json"))["version"] != new:
            raise ReleaseError(f"the merged commit {landed[:7]} does not carry version {new}")

        step("4. GitHub release")
        notes = run("python", "scripts/generate_changelog.py", "--notes")
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as fh:
            fh.write(notes + "\n")
        url = run("gh", "release", "create", tag, "--target", landed, "--title", tag, "--notes-file", fh.name)
        print(f"   {url}")

        step("5. npm publish (publish.yml)")
        publish_id = wait_for_run("publish.yml")
        log = run("gh", "run", "view", publish_id, "--log")
        if f"+ eef-install@{new}" not in log:
            raise ReleaseError(f"publish run {publish_id} succeeded but its log does not show + eef-install@{new}")
        via_token = "bypass 2FA" in log
        print(f"   published eef-install@{new} — authenticated via "
              f"{'NPM_TOKEN fallback (trusted publishing not used)' if via_token else 'trusted publishing (OIDC)'}")

        step("6. CHANGELOG.md through a PR")
        run("git", "fetch", "-q", "--tags", "origin")
        run("python", "scripts/generate_changelog.py")
        if run("git", "status", "--porcelain", "CHANGELOG.md"):
            land_through_pr(f"docs/changelog-{tag}", ["CHANGELOG.md"], f"docs: regenerate CHANGELOG.md for {tag}",
                            "Generated by scripts/generate_changelog.py after the release.")
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
