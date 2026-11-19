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

## Example — from corrections to rules

Session corrections:

1. User: "dropdown-nya kelamaan" → you changed 300 ms to 160 ms.
2. User edited `Card.tsx` themselves: removed `shadow-lg`, added
   `border border-border`.
3. User rejected the variant with a gradient header.
4. User: "jangan pakai ease-in, rasanya lambat".

Proposed rules:

| # | Rule | Why | Scope | Destination |
|---|---|---|---|---|
| 1 | Dropdowns and popovers open in 150–180 ms with `--ease-out` | User: 300 ms felt slow | Project | DESIGN.md → Motion |
| 2 | Cards use a 1 px `border-border`, no drop shadow | Inferred: user prefers flat, quiet surfaces | Project | DESIGN.md → Surfaces |
| 3 | No gradient headers | Inferred: rejected variant; reads as decorative | Project | DESIGN.md → Avoid |
| 4 | Never use `ease-in` on UI transitions | User: feels slow | Everywhere | Lint rule + global rules (ask where) |

## DESIGN.md skeleton

```markdown
# Design rules — <project>

Each rule has its reason. Change a rule by changing its reason first.

## Motion
- Dropdowns/popovers: 150–180 ms, `--ease-out`, from the trigger. — 300 ms felt slow (2026-11-19).
- No `ease-in` on UI. — It delays the moment the user is watching.

## Surfaces
- Cards: 1 px `border-border`, radius `--radius-lg`, no shadow. — Quiet, flat look preferred.

## Typography
## Color
## Components
## Avoid
- Gradient headers. — Decorative; rejected in variant review.
```

## Lint rules for mechanical checks

```js
// stylelint.config.js — block the mechanical mistakes
export default {
  rules: {
    "declaration-property-value-disallowed-list": {
      transition: ["/\\ball\\b/", "/ease-in(?!-out)/"],
      "transition-timing-function": ["/^ease-in$/"],
      "animation-timing-function": ["/^ease-in$/"],
    },
  },
};
```

For Tailwind, an ESLint rule (`no-restricted-syntax` on className
literals, or the Tailwind plugin's class restrictions) can ban
`transition-all` and `ease-in`.

## Project skill (when the rules are a process)

```markdown
---
name: <project>-design-review
description: Check UI changes in <project> against DESIGN.md before calling them done. Use after editing components, styles or animations.
---

1. Read DESIGN.md.
2. For each changed component, check every rule; list violations with file:line.
3. Fix violations that are mechanical; ask about the rest.
```
