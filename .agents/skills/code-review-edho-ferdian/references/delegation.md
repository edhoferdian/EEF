# Delegation — Reviewer and Critic as separate agents

Moved out of `SKILL.md`: read this when the review runs through delegated
sub-agents (or when deciding whether it should), not on an inline review.

## Why two agents

"Skill Edition" because this same review discipline also exists as two
real sub-agents for harnesses that support delegation:
`code-reviewer-edho-ferdian` (Phases 0-3, Agent A of Phase 4) and
`code-critic-edho-ferdian` (Agent B of Phase 4) —
`dev-kickoff-edho-ferdian`'s REVIEW stage prefers the Reviewer agent when
one is available, since a delegated sub-agent gets genuine context
isolation from the implementer's reasoning, not just a same-session
re-read; `SKILL.md`'s Phase 4 explains why the Critic is a second, separate
agent rather than the Reviewer critiquing itself. `SKILL.md` stays the
single source of truth for review criteria either way; both agents are
thin wrappers that load and follow it, never forks with their own copy.
Invoke this skill directly when no delegation primitive exists, or when
reviewing outside dev-kickoff's own loop.

The Reviewer agent runs at the `standard` tier: on the seeded-bug
benchmark (`evals/review-seeded-bugs/`), Sonnet caught every seeded bug in
small single- and multi-file PRs at about half Opus's cost. Large PRs were
not tested, so when you delegate one — roughly ten or more changed files,
a change spanning several modules, or a review the Critic disputes — run
that Reviewer one tier up (on Claude Code, pass `model: "opus"` on that
Agent call), per config-hygiene-edho-ferdian's
`references/harness-operation.md` §4.2. The Critic stays `deep` either way.

## Phase 4 implementation per harness

**Implementation:** on a harness with sub-agent delegation, Agent A is
`code-reviewer-edho-ferdian` and Agent B is `code-critic-edho-ferdian` —
two separate agents, each getting only what its role needs: A gets the
code and produces the draft; B gets the code and A's draft report, never
A's internal reasoning. This is a real independence guarantee, not a
role-play framing.

On **Claude Code specifically**, this is nested delegation, confirmed
against Claude Code's own docs: a subagent can delegate further (up to 3
layers below the main conversation by default) when its `tools:` list
includes `Agent` — `code-reviewer-edho-ferdian`'s does, so A delegates
directly to B and performs Correction itself once B's critique returns.
On **any other harness**, that nested capability hasn't been verified
here — whatever is orchestrating the review (dev-kickoff-edho-ferdian,
another agent, or the user) makes both delegations instead, handing A's
draft to B and B's critique back to A.

On a harness with no delegation primitive at all, role-play the two parts
sequentially in one context — less independent, still valuable. Note
which mode you used in the report either way.
