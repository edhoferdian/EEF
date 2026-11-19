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

---

## Recon commands

Run from the project root (never from a drive or home root):

```bash
# Where motion lives
rg -n "transition|animation|@keyframes|cubic-bezier|will-change" --type css --type scss
rg -n "motion\.|AnimatePresence|useAnimate|layoutId|animate=\{|transition=\{" --glob "*.{ts,tsx,js,jsx}"
rg -n "requestAnimationFrame|\.animate\(|startViewTransition" --glob "*.{ts,tsx,js,jsx}"
rg -n "duration-|ease-|animate-|transition-" --glob "*.{tsx,jsx,html}"   # Tailwind utilities
rg -n "prefers-reduced-motion|useReducedMotion|reducedMotion" .
```

Record findings per surface: file:line, trigger, frequency tier, current
values, and what it should be.

## Audit categories in detail

| Category | Look for | Typical target |
|---|---|---|
| Purpose & frequency | Motion on keyboard actions, typing, list navigation, command palettes; decoration on frequent surfaces | Remove or reduce to opacity ≤ 120 ms |
| Easing | `ease-in` on entrances, keyword easings where tokens exist, linear on UI | ease-out token; ease-in-out for A → B |
| Duration | UI > 300 ms, exits ≥ enters, inconsistent values for the same element type | Table in `motion-review.md` |
| Properties & performance | width/height/top/left, `transition: all`, per-frame state, heavy blur | transform/opacity, explicit lists |
| Origin & direction | Popovers from centre, modals from corners, inconsistent navigation direction | transform-origin at trigger |
| Interruption & exits | Keyframes on toggles, missing exits, UI waiting on animation end | transitions/springs, AnimatePresence |
| Cohesion & tokens | Five near-identical cubic-beziers, durations typed inline | Shared tokens, one spring set |
| Accessibility | No reduced-motion handling, hover-only affordances, autoplay without pause | Fade fallback, focus parity, pause control |

## Prioritising

Score each finding: **impact** (how often seen × how wrong it feels) and
**effort** (files touched, risk). Order: high impact / low effort first
(token swaps, removing motion from frequent surfaces), then structural
fixes (exits, interruptibility), then polish. Group findings that share
the same fix into one plan.

## Plan template (fill completely)

```markdown
# NNN — <short title>

Priority: P0 | P1 | P2        Category: <category>        Effort: S | M | L

## Context
What the user experiences now, and why it feels wrong. One paragraph,
no jargon the executor would need to look up.

## Files
- `src/components/Menu.tsx` lines 40–72 (the trigger and content)
- `src/styles/tokens.css` (curve tokens)

## Conventions to follow
- Curves come from `--ease-out` / `--ease-in-out` in tokens.css; add new
  ones there, never inline.
- Components use Radix data-state attributes for enter/exit.
- Imitate `src/components/Popover.tsx` (already correct).

## Change
1. In `Menu.tsx`, replace `transition: all 300ms ease-in` with
   `transition: opacity 150ms var(--ease-out), transform 150ms var(--ease-out)`.
2. Set `transform-origin: var(--radix-dropdown-menu-content-transform-origin)`.
3. Enter from `scale(0.96)`; exit to `scale(0.97)` in 120 ms.
4. Under `prefers-reduced-motion: reduce`, opacity only.

## Verify
- Open the menu with the mouse: it grows from the trigger in ~150 ms.
- Open and close it rapidly five times: no restart or flicker.
- Open with the keyboard (Enter/Space): same behaviour, focus in first item.
- Turn on reduced motion in the OS: fade only.

## Out of scope
- Menu item hover styles, the submenu, any other component.
```

A plan is ready when an executor who has never seen the codebase could
finish it without asking a question.

## Find-opportunities output example

```markdown
| # | Surface | What the user loses today | Suggested motion | Values |
|---|---|---|---|---|
| 1 | `CartButton.tsx:31` count badge | Count changes silently after "Add" | Number roll + badge pulse | y 60% → 0, 200 ms ease-out; scale 1 → 1.1 → 1, 220 ms |
| 2 | `Filters.tsx:88` results list | Results swap with a jump | Height + crossfade | 200 ms ease-out, opacity leads on exit |

Rejected
- Sidebar links hover slide — frequent surface, decoration only.
- Search results stagger — updates on every keystroke.
```
