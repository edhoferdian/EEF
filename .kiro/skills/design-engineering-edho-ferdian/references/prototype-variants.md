# Prototype Variants — several versions behind a live picker

**Manual mode:** run when the user asks for options ("kasih beberapa
versi", "give me a few options", "prototype this").

Builds several genuinely different versions of one UI piece, renders them
in the real app behind a small picker so the user can flip between them
live, then promotes the chosen one into the codebase.

## Process

1. **Pin down the piece.** One component or section, its real data and
   its states. Ask one question if the target is unclear.
2. **Choose the axes of difference.** Variants must differ in an idea, not
   in a colour: layout (list vs cards vs table), hierarchy (what leads),
   density, interaction model (inline edit vs dialog), motion approach.
   Write one line per variant naming its idea before building.
3. **Build 3 variants** by default (2–5 if the user asks). Each meets the
   full craft bar on its own — correct curves and durations, states,
   accessibility, responsive — no "rough draft" variant.
4. **Picker.** Render the variants in place, in the real page, with a
   small floating switcher (dev-only):
   - Fixed in a corner, above other UI, unobtrusive.
   - Buttons or a segmented control labelled with each variant's idea;
     keyboard shortcuts (e.g. `1`–`5`, or `[` / `]`) to cycle.
   - Remembers the current choice across reloads (`localStorage`, guarded
     with try/catch).
   - Excluded from production builds (env check or a dev-only import).
   Keep variants in a folder next to the component
   (`Component.variants/VariantA.tsx …`) with a small switch component.
5. **Hand over.** Tell the user the shortcut, one line per variant, and
   what to look for.
6. **Promote.** When the user picks one: move it into the real component,
   delete the other variants and the picker, and clean imports. Optionally
   keep a note of what was rejected and why.

## Rules

- Same data, same states for all variants — a fair comparison.
- Don't change shared code (tokens, layout shell) to make one variant
  work; keep variants isolated.
- If the user mixes ("A's layout with C's header"), build that as a new
  variant and keep the picker until they settle.
