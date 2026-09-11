# MCP tool surface design

**Deliberately free of SDK signatures** — the MCP SDK's registration API has changed shape
more than once, and the source skill itself defers to live docs. Resolve
current signatures via Context7 (`resolve-library-id` → `query-docs`) at
authoring time — full contract, session/fallback discipline, and rate-limit
handling: `skill-authoring-edho-ferdian` §9. The rules below are what stays
true across versions.

An MCP server is an API surface whose client happens to be a model. Everything
in `rest-conventions.md` about naming, error shape, and versioning applies —
these are the additions specific to a model consumer.

## The three surfaces

| Surface | Meaning | Design rule |
|---|---|---|
| Tool | An action the model may invoke | Schema-first; the description is the model's only documentation |
| Resource | Read-only data the model may fetch | Addressed by URI; no side effects, ever |
| Prompt | A parameterised template the client surfaces | Keep it a template, not a workflow |

## Rules

- **Schema first.** Every tool declares a validated input schema (Zod or the
  SDK's equivalent). An unvalidated tool argument is an injection surface —
  a model's input is untrusted input.
- **The description is the contract.** A model chooses a tool from its
  description alone. State what it does, what it costs, and what it mutates.
  Ambiguous descriptions produce wrong tool calls, not error messages.
- **Errors are for the model to read.** Return a structured, actionable
  message — never a raw stack trace, never a bare boolean.
- **Prefer idempotent tools** so a retry is safe; if a tool cannot be
  idempotent, say so in its description.
- **Cost and rate limits belong in the description** for any tool that calls
  an external API.
- **Transport:** stdio for local clients; Streamable HTTP for remote. Keep
  tool/resource logic independent of transport so the entrypoint is the only
  thing that changes.
- **Pin the SDK version** and read release notes before upgrading.

Boundary: *whether* a capability should be an MCP tool at all (versus a rule,
a skill, or a plain CLI/API call) is a routing decision — take it to
`system-design-edho-ferdian`, not here.
