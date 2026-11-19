# Learn Taste — turn design corrections into rules

**Manual mode:** run when the user asks ("simpan koreksi desain tadi",
"learn-taste", "jangan ulangi kesalahan itu"), ideally at the end of a
session, before it is cleared.

## 1. Collect the corrections

Read the current conversation from the start. A correction is any moment
the user changed a design decision:

- Explicit feedback ("too slow", "make the corners smaller", "don't use
  shadows").
- Edits the user made to files themselves — compare the files with what
  you wrote earlier in the session.
- Rejected options (a variant not picked, a suggestion turned down).

Read earlier sessions only if the user names them and their transcripts
are readable.

## 2. Turn each into a rule with its why

For each correction write:

- **Rule** — imperative, specific, testable ("Dropdowns open in 160 ms with
  `--ease-out`", not "make things snappier").
- **Why** — the user's reason if stated; otherwise your inferred reason,
  marked as inferred.
- **Scope** — this component, this project, or everywhere.

Merge corrections that are the same rule. Drop one-off content changes
that aren't taste (a typo, a copy change).

## 3. Choose where each rule lives

| Rule is… | Put it in |
|---|---|
| A value or convention for this project | The project's `DESIGN.md` (create it if missing, short sections) |
| A repeatable process or set of checks for this project | A project skill (`.claude/skills/<name>/SKILL.md`) |
| Mechanically checkable (no `transition: all`, no `ease-in`) | A lint rule / stylelint rule / test |
| True for every project | The user's global rules — ask where those live before writing |

Prefer extending an existing file over creating a new one. Never write
outside the project without asking.

## 4. Confirm before writing

Show the list: rule, why (inferred marked), scope, destination. Ask one
line per uncertain item (inferred why, unclear scope, global-or-project),
with your recommendation. Write only after the user confirms. Then show
what was written where.
