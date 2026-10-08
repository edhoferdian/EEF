# Contract history, setup detail, and provenance

Moved out of `SKILL.md` so the canonical contracts load lean. None of this
changes what a contract requires — the rules stay in `SKILL.md`. Open this
file when auditing why a contract exists, when changing one, or when
setting up a Context7 API key.

## §7 — Why Language routing was promoted, and its scope

Promoted per R3/D-023 (this is §4 applied to itself): 14 skills carried 5+
mutually inconsistent headings/wordings for the same convention — plain
`## Language routing`, `(fixed — never ask)`, `(fixed — matches
code-review-edho-ferdian's contract)`, `(fixed — matches the rest of this
ecosystem)`, and `dev-kickoff-edho-ferdian`'s richer `(v2.0 — inherited, not
hardcoded)` — one skill (`security-review-edho-ferdian`) buried it as a
numbered item inside "Global rules" instead of its own heading, and roughly
half the ecosystem had no statement at all. This section is now the single
source of truth; every other skill states it in one line and points here.

**Scope — what this governs, and what it does not.** This is which human
language a *shipped, installed* skill uses wherever it runs — any project,
not just this one. It is a different document from this repo's own
`CLAUDE.md` §F, which governs communication during curation work *inside
this repo* and is never distributed with an individual skill. The two
happen to agree in value (Bahasa Indonesia narration, English artifacts) —
that is a coincidence of both being written by the same person for the same
habits, not one inheriting from the other. Do not merge them or delete
either one thinking it is a duplicate.

## §9 — Context7 rate limits and API key setup

**Rate limits.** The anonymous/no-key MCP connection is rate-limited. A free
API key from context7.com/dashboard raises the limit substantially. Add it
by reconfiguring the existing registration: `claude mcp remove context7`
then `claude mcp add context7 -- npx -y @upstash/context7-mcp@latest
--api-key <key>` (or set the `CONTEXT7_API_KEY` env var on the same
command instead of the flag). Key issuance and MCP reconfiguration is a
manual user action — the executor never stores or performs this unattended.

## Provenance

Consolidated into one skill per D-009. Every install-specific path
(a global scripts directory, marketplace assumptions, the `results.json`
cache location) was replaced with this repo's own `skills/` tree.

§6 (packaging) added 2026-09-06 per D-023 (R8 audit finding: no skill in
this ecosystem covered `dist/*.skill` packaging). Native to this ecosystem,
not adapted from an external source.

§7 (language routing canonical contract) added 2026-09-06 per D-023 (R3
audit finding), executed under D-035 override. Native to this ecosystem,
consolidated from the 14 skill-local variants it replaces rather than
adapted from an external source.

§8 (development loop convention) added 2026-09-09 per explicit user
request that the ecosystem's skills auto-invoke each other and that
`dev-kickoff-edho-ferdian`'s Plan-Test-Implement-Review-Verify-Remember
cycle gain a seventh, closing stage (Improve). Native to this ecosystem —
points to `dev-kickoff-edho-ferdian`'s `references/execution-loop.md` v3.0
as the canonical implementation rather than restating it.

§9 (external docs lookup / Context7) added 2026-09-11 per D-044, discussed
and agreed with the user in-session. Native to this ecosystem — Context7
was already connected as a live MCP server and referenced narrowly inside
`api-design-edho-ferdian/references/mcp-tool-surface.md`; this section
promotes that pattern to a canonical contract so the other authoring-time
skills (`frontend-engineering-edho-ferdian`,
`backend-engineering-edho-ferdian`, `build-fix-edho-ferdian`) point to one
definition instead of each restating it.

§10 (surgical changes canonical contract) added 2026-09-17, adapted from
`multica-ai/andrej-karpathy-skills`'s `karpathy-guidelines` skill (fetched
2026-09-17, MIT-licensed per that skill's own frontmatter) at the user's
request to integrate it into this ecosystem. Checked first per this
skill's own §1: 3 of that source's 4 principles ("Think Before Coding",
"Simplicity First", "Goal-Driven Execution") were already covered —
respectively by `safe-execution-edho-ferdian` Gate 1, `code-simplification-
edho-ferdian`, and `dev-kickoff-edho-ferdian`'s execution loop — so nothing
was ported for those three; porting them would have been exactly the
"twelfth variant of something that already exists" failure mode this
section warns against. Only the 4th principle ("Surgical Changes") had no
existing general statement — it was scattered as build-fix-specific
guidance and as two after-the-fact review findings, never as a stated
authoring-time default — so that's the only piece promoted here, phrased
generically rather than copied verbatim from the source's wording.
