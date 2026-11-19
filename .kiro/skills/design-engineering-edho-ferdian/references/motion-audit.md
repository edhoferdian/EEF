# Motion Audit — improve, find, remove

Three codebase-wide modes. If the user only says "the motion feels off",
ask which problem they have: **bad** motion (improve), **missing** motion
(find), or **too much** motion (remove).

All three start with the same recon:

1. **Stack** — framework, motion libraries and versions, component
   library.
2. **Where motion lives** — global CSS and tokens (`--ease-*`,
   `--duration-*`), Tailwind config, keyframes, Motion props, gesture
   handlers.
3. **Conventions** — existing curves, durations, springs. Every proposal
   extends these; a parallel system is a defect.
4. **Personality** — productivity tool (restrained), consumer app (some
   warmth), marketing site (more expressive).
5. **Frequency tier** for every animated surface (`motion-foundations.md`
   §1).

Run it inline. Split work across agents only when the user asks for it.

---

## Mode A — Improve (audit + plans)

Read-only on source. Output is an audit and implementation plans another
session (or a cheaper model) can execute.

**Audit categories:** purpose & frequency · easing · duration ·
properties & performance · origin & direction · interruption & exits ·
cohesion & tokens · accessibility (reduced motion, hover on touch).

**Audit output** (`plans/motion-audit.md` unless the user names a place):

```
# Motion audit — <project>
Stack · motion libs · tokens found · personality

| # | Priority | Surface (file:line) | Category | Problem | Target value |
|---|---|---|---|---|---|
| 1 | P0 | ... | Easing | ease-in on dropdown | --ease-out, 180ms |
```

Priority: **P0** feels broken or slow on a frequent surface · **P1**
noticeably off · **P2** polish.

**Plans** — one file per finding (or per group sharing the same files and
fix), `plans/NNN-short-slug.md`, self-contained:

```
# NNN — <title>
Priority: P0 | Category: <category>

## Context
What the user experiences now, and why it's wrong (one paragraph).

## Files
- path/to/file.tsx (lines)

## Conventions to follow
Existing tokens, file placement, prop patterns to imitate.

## Change
Exact steps with exact values. No "tweak until it feels right".

## Verify
How to check it: what to click, what should happen, reduced-motion check.

## Out of scope
What not to touch.
```

Never edit source in this mode. To execute a plan, the user asks for it;
then follow it and `motion-foundations.md`.

---

## Mode B — Find opportunities

Read-only. Restraint first: most candidates are rejected.

Look for moments where the user loses orientation or confirmation:
- Content that appears/disappears abruptly (conditional renders without
  exit, list insertions/removals).
- State changes that are easy to miss (saved, copied, error).
- Layout jumps (accordion, tabs, loading → content).
- Spatial relationships hidden (popover with no origin, sheet with no
  edge).

Reject anything on a high-frequency or keyboard-driven surface, anything
purely decorative, anything that would delay a task.

**Output:** a short table — surface (file:line), what the user loses
today, suggested motion with exact values (property, curve token,
duration), and a "rejected" list with one-line reasons. Build accepted
ones with `motion-foundations.md` / `motion-recipes.md`.

---

## Mode C — Remove

Edits code, but only to subtract. Never adds or retunes motion.

Remove:
- Motion on keyboard-triggered results and high-frequency surfaces
  (command palettes, menus used constantly, list navigation, typing).
- Animation on functional data (tables, numbers being read, charts that
  re-animate on every update).
- Decoration with no job (floating, pulsing, parallax, hover lifts on
  everything, entrance animations on every scroll).
- Delays that make the user wait.

For each removal: delete the motion and its leftovers (unused keyframes,
variants, wrapper components, imports, `will-change`). When the last
import of a motion package disappears, report it and suggest dropping the
package — leave `package.json` alone unless the user agrees.

**Output:** list of removals (file:line, what, why), then the diff.
Verify the UI still works: the element appears, focus moves, nothing
waits on a removed `onAnimationComplete`.
