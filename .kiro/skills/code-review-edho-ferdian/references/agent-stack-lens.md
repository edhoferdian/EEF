# Agent Stack Lens

Applies when the code under review **is** an agent or LLM feature —
a tool-calling loop, a wrapper over a model API, an autonomous worker, an
MCP server, or any feature whose behaviour is produced by a model rather
than by the code you are reading. It does not apply to code that merely
calls an LLM once for a string.

Sits alongside `rag-lens.md` (retrieval quality) and `mle-lens.md`
(training/serving) — a RAG-backed agent usually needs both this lens and
`rag-lens`.

## Part 1 — Static audit: the layers where agent bugs hide

Agent stacks fail in places ordinary code review does not look, because the
failure is in the *seam* between layers, and every layer individually
appears to work:

| Layer | What goes wrong | What to look for in the diff |
|---|---|---|
| **Wrapper / prompt assembly** | A wrapper silently rewrites, truncates, or reorders what the caller passed — behaviour regresses with no code change at the call site | String concatenation of prompts across several functions; truncation with no logging; system-prompt edits with no version marker |
| **Memory / state** | Stale or polluted context carried between turns; one request's data leaking into another's | Mutable module-level or session-level state; conversation history appended without bound; no isolation between concurrent sessions |
| **Tool definitions** | Descriptions the model cannot act on; overlapping tools; missing or lying error returns | Two tools whose descriptions could match the same intent; a tool that returns a bare string on failure and on success; parameters with no schema |
| **Tool discipline** | The loop retries a failing call indefinitely, or swallows failure and continues on a fabricated result | Retry with no cap or backoff; a `try/except` around a tool call that returns a default; no distinction between "tool failed" and "tool returned nothing" |
| **Hidden repair loops** | The system quietly re-asks the model until output parses, hiding a systematic prompt defect and multiplying cost | Parse-then-retry with no counter or metric; a JSON repair pass with no logging |
| **Transport / rendering** | Output corrupted after generation — streaming chunk boundaries, escaping applied twice, markdown mangled | Chunk handling that assumes token boundaries align with character boundaries; escaping in more than one layer |
| **Cost / termination** | No bound on tokens, turns, or wall time | A loop whose only exit is success |

Two review rules specific to this lens:

- **A silent fallback in an agent stack is a defect, not resilience.** The
  same standard `silent-failure-lens.md` applies to ordinary code applies
  harder here, because a fabricated-but-plausible result is
  indistinguishable from a real one downstream.
- **Non-determinism is not an excuse for missing tests.** Tool-call
  sequences, parsers, prompt assembly, and error paths are all
  deterministic and testable; only the model's text is not.

## Part 2 — Runtime introspection: when a run is already failing

Use when an agent run loops, burns tokens without progress, or drifts.
Reproducible diagnosis, not a retry:

1. **Capture** — the full tool-call sequence with arguments and returns,
   the assembled prompt at the point of divergence, and where it first
   deviated from intent. Retrying without capturing destroys the evidence.
2. **Diagnose against Part 1's layer table** — name the layer before
   proposing a fix. "The model is confused" is not a diagnosis.
3. **Contain the recovery** — change one layer, re-run, compare against the
   captured trace. Changing the prompt and the tool schema and the retry
   policy at once teaches nothing.
4. **Report** — what failed, at which layer, the evidence, and what would
   make the same failure visible sooner next time (usually a log line or a
   counter that does not exist yet).

Rule: **a retry is not a diagnosis.** An agent bug that was fixed by
running it again was not fixed.
