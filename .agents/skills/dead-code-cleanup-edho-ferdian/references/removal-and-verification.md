# Staged removal, verification loop, and commit discipline

Structured around this skill's SAFE/CAREFUL/RISKY classification and the
Salak cross-check.

## Order of removal (fixed)

Always in this order, one category fully completed (including its test run
and commit) before starting the next:

1. **Unused dependencies**
2. **Unused exports**
3. **Unused files**
4. **Duplicate code** (consolidation)

Rationale for the order: dependencies are the lowest-blast-radius category
(removing an unused package cannot break code that never referenced it,
almost by definition once classification confirmed SAFE) — start there to
build confidence and surface a broken assumption early and cheaply. Duplicate
consolidation is last because it's the only category that changes call
sites, not just deletes — highest chance of a subtle behavior change, so it
runs last with everything else already verified clean.

## Per-category loop

For each category:

1. Remove every item in this category currently classified SAFE (post-Salak
   cross-check). Surface CAREFUL items to the user with the specific reason
   before removing; leave RISKY items untouched and reported.
2. Run the build (if the stack has a separate build step).
3. Run the full test suite — not just tests touching the removed code.
   A dead-code removal can break something the tool's dependency model
   didn't surface (see `salak-cross-check.md` for why static tools miss
   edges).
4. If tests fail: revert this category's removal (not the whole pass),
   re-classify the failing item (it was likely CAREFUL or RISKY misclassified
   as SAFE — treat the failure itself as evidence for `salak-cross-check.md`
   Step 3's downgrade rule going forward), and continue with the rest of the
   category.
5. If tests pass: commit this category alone, with a message naming the
   category and count, e.g. `chore: remove 4 unused dependencies (dead-code
   cleanup)`. **One category = one commit** (or one small set of commits),
   never bundled with the next category or with unrelated work.

## Safety checklist (before removing anything)

- [ ] Detection tool confirms unused (Phase 1).
- [ ] Manual grep confirms no reference, including a string-literal search
      for the bare identifier (catches likely dynamic references).
- [ ] Salak cross-check run if Salak is installed; classification updated
      per its downgrade rule.
- [ ] Not part of a published/public API surface (or, if it is, classified
      CAREFUL minimum per the Reflection gate in SKILL.md).
- [ ] Test suite is runnable in this repo right now (if not, get explicit
      user confirmation before proceeding past the dependencies category).

## After each batch

- [ ] Build succeeds.
- [ ] Full test suite passes.
- [ ] Committed alone, with a descriptive message, isolatable from any
      unrelated change.

## Hard rule — isolatable and revertable

Never delete in the same commit or pass as an unrelated change. If the user
asked for a feature and a cleanup in the same request, sequence them as
separate commits (cleanup first or last, not interleaved) so either can be
reverted independently without touching the other.

## When NOT to run this skill

- During active feature development on the same files (merge conflicts with
  in-flight work, and "unused" can be transiently true mid-refactor).
- Immediately before a production deploy — a regression from cleanup is the
  worst time to discover one.
- On a repo with no test coverage and no user willingness to review each
  removal manually — say this explicitly rather than proceeding anyway.
- On code the person driving this doesn't understand well enough to judge a
  CAREFUL/RISKY call — escalate to a human review of that specific item
  instead of guessing.

## Success criteria

- All tests passing after every category, not just at the end.
- Build succeeds.
- No regressions introduced.
- Bundle/binary size reduced where measurable.
- Every removal traceable to a specific commit with its category and count.
