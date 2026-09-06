# Spec Format — Blocks, Metadata Fields, Requirement vs Invariant

Reference for Phase 3 of spec-mining-edho-ferdian v1.0. Ported from ECC
spec-miner's block format, which is tool-agnostic and kept as-is — only the
output location and the OpenSpec coupling changed. Read `mining-protocol.md`
for how the content in these blocks gets mined.

---

## Output location

One file per mined capability:

```
/project-memory/mined-specs/<capability>.md
```

This differs from ECC's original, which writes
`openspec/specs/<capability>/spec.md` and assumes OpenSpec's delta-tooling
folder layout. This skill has no OpenSpec dependency — `mined-specs/` is a
flat directory inside the memory structure `dev-kickoff-edho-ferdian` already
owns (`/project-memory/00-master-plan.md`, `01-decision-register.md`, etc.),
so a mined spec is discoverable the same way. See §OpenSpec compatibility
below for the optional export path.

If `/project-memory/` doesn't exist yet in the target repo, create just the
`mined-specs/` subdirectory. Do not scaffold the rest of
`dev-kickoff-edho-ferdian`'s memory files — that's a different skill's job,
and doing it here would blur ownership of files this skill doesn't maintain
long-term.

---

## File header

```markdown
# Spec: [capability-name]

> Auto-extracted by spec-mining-edho-ferdian. Last mined: YYYY-MM-DD.
> Source: [key files analyzed]
> Last verified: YYYY-MM-DD (commit abc1234)
```

`Last verified` is mandatory and MUST include the actual git commit hash
mined at (`git rev-parse --short HEAD` or equivalent) — this is the anchor
that makes a future freshness check possible. Never leave it blank or
approximate.

---

## Block format

**Only two block types exist at the `###` level: `### Requirement:` and
`### Invariant:`.** No "API Contracts" chapter, no "Business Rules" section,
no "State Machines" grouping. Type information lives in the description text
and the `entities` metadata, not in a heading.

```markdown
### Requirement: [behavior name]
<!-- id: FileName.methodName -->
<!-- entities: EntityA, EntityB -->
<!-- depends_on: [optional: prerequisite Requirement name, same capability only] [Salak-verified | inferred, unverified] -->
<!-- triggers: [optional: downstream Requirement name, same capability only] [Salak-verified | inferred, unverified] -->
<!-- enforced: FileName.methodName() -->

[Concise description of the behavior using SHALL/MUST. One paragraph.]

#### Scenario: [scenario name]
<!-- test: [optional: TestClass.testMethod()] -->
- **WHEN** [precise condition — inputs, entity state, context]
- **THEN** [observable outcome — return value, state change, side effect, error]

#### Scenario: [another scenario]
- **WHEN** [different condition]
- **THEN** [different outcome]

---

### Invariant: [invariant name]
<!-- entities: EntityA -->
<!-- enforced: FileName.methodName() -->
<!-- verified_by: [optional: TestClass.testMethod()] -->

[What must ALWAYS be true, regardless of triggers. Use SHALL.]

> Last verified: YYYY-MM-DD (commit abc1234)
```

Separate each block with a horizontal rule (`---`).

### Document-level metadata comments

Two special keys carry their payload after the colon and apply to the whole
file, placed at the bottom:

```markdown
<!-- deferred: file1.ts (reached external boundary), file2.ts (read budget exhausted) -->
<!-- uncertainty: docstring at OrderService.cancel() claims refund is automatic, but no caller triggers a refund path -->
```

---

## Requirement vs Invariant

| | Requirement | Invariant |
|---|---|---|
| Nature | Triggered by an action or event | True at all times, regardless of triggers |
| Example | "When user submits order, system creates order record" | "Account balance must always equal sum of transactions" |
| Example | "When stock is insufficient, return error INSUFFICIENT_STOCK" | "Inventory quantity must never be negative" |
| Example | "When payment succeeds, activate subscription" | "Order total must equal sum of line item amounts" |
| Scenarios | Has at least one `#### Scenario:` (WHEN/THEN) | Has no Scenarios |
| Test reference | Via `<!-- test: -->` inside each Scenario | Via `<!-- verified_by: -->` on the Invariant itself, if a test exists |

**Every Requirement MUST have at least one Scenario.** Invariants never have
Scenarios — if you're about to write a WHEN/THEN under an `### Invariant:`
heading, it's actually a Requirement.

---

## Metadata field reference

| Field | Where | Required? | Format | Notes |
|---|---|---|---|---|
| `id` | Requirement | when `enforced` is known | `FileName.methodName` | Stable anchor; does not change when the human-readable name changes. Omit if `enforced` is unknown — never guess an anchor. |
| `entities` | Requirement, Invariant | yes, when determinable | `EntityA, EntityB` | Domain entity names as they appear in code (camelCase/PascalCase as written). |
| `enforced` | Requirement, Invariant | yes, when determinable | `FileName.methodName()` | Precise enough to jump to directly. Minimum bar for a Requirement to be trustworthy — see Guardrail 5 in SKILL.md. |
| `test` | Scenario | optional | `TestClass.testMethodName()` | Only if a real test exists; don't invent one. |
| `verified_by` | Invariant | optional | `TestClass.testMethodName()` | Same rule — only if real. |
| `depends_on` | Requirement | optional | Requirement name, same capability only, plus `[Salak-verified]` or `[inferred, unverified]` label | Never cross-capability; never unlabeled. See `mining-protocol.md` §Salak integration. |
| `triggers` | Requirement | optional | same shape as `depends_on` | Same constraints. |
| `deferred` | document-level | when applicable | `file, reason` pairs | Files the sample-and-expand budget didn't reach. Never silently drop instead. |
| `uncertainty` | document-level | when applicable | free text | Genuine ambiguity the code doesn't resolve. Prefer this over a confident-sounding wrong Requirement. |

Format rules (unchanged from ECC's original, still load-bearing):

1. `<!-- -->` comments are machine-parseable metadata: one `key: value` per
   line.
2. `#### Scenario:` uses exactly 4 hashtags.
3. `entities` lists names as they appear in code, not translated or
   normalized.
4. `enforced` format is `FileName.methodName()` — precise enough for a
   reader (human or agent) to jump straight to it.

---

## OpenSpec compatibility (optional export target, not a dependency)

This skill's flat `### Requirement:`/`### Invariant:` block format happens
to be compatible with OpenSpec's delta-tooling conventions (the same
4-hashtag `#### Scenario:` depth, the same flat non-chaptered structure) —
that compatibility is inherited from ECC's original design, not something
this skill builds toward. If a project later adopts OpenSpec, a mined spec
file under `/project-memory/mined-specs/<capability>.md` can be copied or
symlinked into `openspec/specs/<capability>/spec.md` largely as-is, and
`## ADDED Requirements` / `## MODIFIED Requirements` / `## REMOVED
Requirements` delta blocks can reference this file's `id` anchors directly.
This skill does not create that folder, does not require OpenSpec to be
installed, and does not check for it — it is mentioned here only so a future
session doesn't have to rediscover the compatibility from scratch.
