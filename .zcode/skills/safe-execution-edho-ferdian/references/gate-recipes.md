# Gate Recipes — blast radius, rollback, and safer alternatives

Concrete material for Gate 2 (destructive commands) and Gate 3 (freeze).
Before a destructive command, write three lines: **what it touches**,
**how to undo it**, **the safer alternative you considered**. If you can't
write the undo, don't run it.

## Gate 2 — common destructive commands

| Command | Blast radius | Rollback prepared first | Safer alternative |
|---|---|---|---|
| `git reset --hard <ref>` | Uncommitted changes and commits after `<ref>` on this branch | `git branch backup/$(date +%s)` (and `git stash -u` for uncommitted) | `git restore --staged`, `git revert <sha>` |
| `git push --force` | Remote branch history for everyone | Note the remote SHA: `git rev-parse origin/<branch>` | `git push --force-with-lease` on your own branch only |
| `git clean -fdx` | All untracked and ignored files (incl. `.env`, build caches) | `git clean -ndx` to list first; copy anything needed | `git clean -nd` then delete specific paths |
| `git checkout .` / `git restore .` | All unstaged edits | `git stash push -u -m before-restore` | Restore single files |
| `rm -rf <dir>` | Everything under `<dir>` | List it: `ls -la <dir>`; copy or move to a trash dir | `mv <dir> /tmp/trash-$(date +%s)/` |
| `DROP TABLE` / `TRUNCATE` | All rows (and dependants with CASCADE) | `pg_dump -t <table> > backup.sql`; confirm environment | Rename table, or soft-delete |
| Down migration | Columns/data the migration drops | DB snapshot / backup; migration tested on a copy | Expand-contract migration |
| `docker system prune -a --volumes` | All unused images, containers, **volumes (data)** | `docker volume ls`; back up named volumes | `docker image prune` / remove specific items |
| `kubectl delete ns|deploy|pvc` | Running workloads; PVCs can delete data | `kubectl get <res> -o yaml > backup.yaml` | Scale to 0; delete one resource |
| `terraform destroy` / apply with replacements | Real infrastructure | `terraform plan` reviewed; state backup | Targeted change, `prevent_destroy` |
| `npm publish` / `gh release create` | Public, effectively permanent | Version and contents checked (`npm pack --dry-run`) | Dry run, pre-release tag |
| `chmod -R` / `chown -R` | Permissions of a whole tree | Record current: `stat` / `getfacl -R` | Change specific files |

### The written statement (before running)

```text
Destructive: git reset --hard origin/main on branch feat/x
Touches: 3 local commits (a1b2c3d..e4f5a6b) and 2 modified files
Rollback: created backup/feat-x-1732012345 at e4f5a6b; stash@{0} holds the modified files
Why not safer: the 3 commits are experiments the user asked to discard
```

### Environment check before data commands

```bash
# Never assume the environment — print it
echo "$DATABASE_URL" | sed -E 's#//[^@]+@#//***@#'   # host/db only, credentials masked
psql "$DATABASE_URL" -c "select current_database(), inet_server_addr();"
kubectl config current-context
terraform workspace show
```

A command against production needs the user's explicit yes in chat, every
time.

## Gate 3 — freeze the write surface

For autonomous or parallel agents, state the allowed write paths up front
and enforce them.

### Claude Code permission rules (settings.json)

```json
{
  "permissions": {
    "allow": ["Edit(src/payments/**)", "Write(src/payments/**)", "Edit(tests/payments/**)"],
    "deny":  ["Edit(src/auth/**)", "Edit(.github/**)", "Edit(**/*.env*)", "Bash(git push:*)"]
  }
}
```

### Freeze as a PreToolUse hook (blocks edits outside the scope)

```js
#!/usr/bin/env node
// freeze-scope.js — PreToolUse on Edit|Write|MultiEdit
const path = require("path");
const ALLOWED = (process.env.FREEZE_PATHS || "").split(",").filter(Boolean).map((p) => path.resolve(p));
let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  try {
    const { tool_input } = JSON.parse(raw);
    const file = path.resolve(tool_input.file_path || "");
    if (!ALLOWED.length || ALLOWED.some((a) => file.startsWith(a + path.sep) || file === a)) return;
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `Outside the frozen scope (${ALLOWED.join(", ")}): ${file}`,
      },
    }));
  } catch { /* fail open */ }
});
```

Run with `FREEZE_PATHS=src/payments,tests/payments`.

### Git worktrees for parallel agents

```bash
git worktree add ../proj-agent-a -b agent/a
git worktree add ../proj-agent-b -b agent/b
# each agent works only in its own worktree; merge through PRs
git worktree remove ../proj-agent-a   # after merge
```

## Gate 1 — fact-forcing questions (quick form)

Before the first edit of a file, answer in the response:

1. Who calls this? (`rg -n "functionName\(" src/`, Salak `query callers`)
2. What does it return / mutate, and who depends on that?
3. Is there a test that covers it? Which command runs it?
4. What else changes if this signature changes?

## Gate 4 — stop-gate checklist

- [ ] The proving command ran and its output is quoted (tests, build, the
      failing case).
- [ ] Project memory / progress note updated where the project keeps one.
- [ ] Anything skipped is listed with the reason.
- [ ] State reported precisely: changed locally / verified / committed /
      pushed.
