# LLM pipelines: regex-first parsing and cost-aware routing

## Principles

1. **Regex first, LLM for what's left over.** For structured, repeating text
   (quiz questions, forms, invoices, tables) a regex parser handles the large
   majority of cases deterministically and for free. An LLM call is reserved
   for the fraction regex can't confidently parse — never the default path.
2. **Confidence scoring is the gate, not a judgment call.** Whether an item
   goes to the LLM is decided by a programmatic score against a threshold,
   not by "does this look weird." That keeps the split reproducible and
   testable.
3. **Route by task complexity, not by habit.** Once an LLM call is
   warranted, pick the cheapest model that can do the job; escalate to a
   larger model only when the input crosses a defined complexity threshold.
4. **Cost and retry state are tracked, never mutated.** A cost tracker and a
   retry loop are both places bugs hide when they mutate shared state —
   return new instances instead (see `error-and-resilience.md` for the
   parallel rule on error state).

## Decision framework: regex vs LLM

```
Is the text format consistent and repeating?
├── Yes (>90% follows a pattern) → Start with regex
│   ├── Regex handles it confidently → done, no LLM needed
│   └── Regex leaves low-confidence items → LLM validates only those
└── No (free-form, highly variable) → use LLM directly, regex won't hold
```

Pipeline shape:

```
Source Text
    │
    ▼
[Regex Parser] ─── extracts structure, cheap and deterministic
    │
    ▼
[Text Cleaner] ─── strips noise (markers, page numbers, artifacts)
    │
    ▼
[Confidence Scorer] ─── flags low-confidence extractions
    │
    ├── High confidence → direct output
    │
    └── Low confidence → [LLM Validator] → output
```

### Confidence scoring as the gate

Score each parsed item programmatically and only route items below the
threshold to the LLM:

```python
@dataclass(frozen=True)
class ConfidenceFlag:
    item_id: str
    score: float
    reasons: tuple[str, ...]

def score_confidence(item: ParsedItem) -> ConfidenceFlag:
    reasons = []
    score = 1.0
    if len(item.choices) < 3:
        reasons.append("few_choices")
        score -= 0.3
    if not item.answer:
        reasons.append("missing_answer")
        score -= 0.5
    if len(item.text) < 10:
        reasons.append("short_text")
        score -= 0.2
    return ConfidenceFlag(item_id=item.id, score=max(0.0, score), reasons=tuple(reasons))

def identify_low_confidence(
    items: list[ParsedItem], threshold: float = 0.95,
) -> list[ConfidenceFlag]:
    flags = [score_confidence(item) for item in items]
    return [f for f in flags if f.score < threshold]
```

Only flagged items get an LLM call, using the cheapest model capable of the
correction task — never the same model tier used for the primary workload.

### Real-world numbers (verify against your own pipeline before quoting)

From a production quiz-parsing pipeline (410 items):

| Metric | Value |
|--------|-------|
| Regex success rate | 98.0% |
| Low-confidence items | 8 (2.0%) |
| LLM calls needed | ~5 |
| Cost savings vs all-LLM | ~95% |
| Test coverage | 93% |

Read this as evidence for the *shape* of the tradeoff (a well-formed regex
pass typically clears 95%+ of a consistent-format corpus), not as a number
that transfers unchanged to a different document type — recompute it for
your own data before citing it externally.

## Cost-aware pipeline: routing, budget, retry, caching

### Model routing by task complexity

Select the cheaper model by default; escalate only past a defined
complexity threshold (text length, item count, or an explicit override):

```python
_SONNET_TEXT_THRESHOLD = 10_000  # chars
_SONNET_ITEM_THRESHOLD = 30      # items

def select_model(
    text_length: int, item_count: int, force_model: str | None = None,
) -> str:
    if force_model is not None:
        return force_model
    if text_length >= _SONNET_TEXT_THRESHOLD or item_count >= _SONNET_ITEM_THRESHOLD:
        return MODEL_SONNET   # complex task
    return MODEL_HAIKU        # simple task, several times cheaper
```

### Budget tracking (immutable)

Track cumulative spend as new instances, not in-place mutation — same
immutability discipline as the parsed items above:

```python
@dataclass(frozen=True, slots=True)
class CostRecord:
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float

@dataclass(frozen=True, slots=True)
class CostTracker:
    budget_limit: float = 1.00
    records: tuple[CostRecord, ...] = ()

    def add(self, record: CostRecord) -> "CostTracker":
        return CostTracker(budget_limit=self.budget_limit, records=(*self.records, record))

    @property
    def total_cost(self) -> float:
        return sum(r.cost_usd for r in self.records)

    @property
    def over_budget(self) -> bool:
        return self.total_cost > self.budget_limit
```

Check `tracker.over_budget` before dispatching each call and fail fast —
don't discover the overrun after the batch has finished.

### Retry policy

Same rule as `error-and-resilience.md`: retry only transient failures, never
auth or validation failures, and back off exponentially.

```python
_RETRYABLE_ERRORS = (APIConnectionError, RateLimitError, InternalServerError)
_MAX_RETRIES = 3

def call_with_retry(func, *, max_retries: int = _MAX_RETRIES):
    for attempt in range(max_retries):
        try:
            return func()
        except _RETRYABLE_ERRORS:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)
    # AuthenticationError, BadRequestError, etc. raise immediately, uncaught
```

### Prompt caching

Cache the long, stable part of a prompt (system instructions, schema
definitions) and keep only the variable part outside the cached block —
worthwhile once the cached portion exceeds roughly 1024 tokens:

```python
messages = [
    {
        "role": "user",
        "content": [
            {"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": user_input},
        ],
    }
]
```

### Composition

```python
def process(text: str, config: Config, tracker: CostTracker) -> tuple[Result, CostTracker]:
    model = select_model(len(text), estimated_items, config.force_model)
    if tracker.over_budget:
        raise BudgetExceededError(tracker.total_cost, tracker.budget_limit)
    response = call_with_retry(lambda: client.messages.create(
        model=model, messages=build_cached_messages(system_prompt, text),
    ))
    record = CostRecord(model=model, input_tokens=..., output_tokens=..., cost_usd=...)
    return parse_result(response), tracker.add(record)
```

## Anti-patterns

| Anti-pattern | Why it hurts | Instead |
|---|---|---|
| Sending every item to an LLM when regex would clear 95%+ of a consistent-format corpus | Expensive and slower for no accuracy gain on the easy majority | Regex first; LLM only for confidence-scored edge cases |
| Reaching for regex on free-form, highly variable text | Regex fights the format instead of matching it; brittle and unmaintainable | Use the LLM directly when the input isn't structured/repeating |
| Skipping confidence scoring and hoping the regex pass "just works" | No way to know what's silently wrong; failures surface downstream instead of at the parse step | Score every extraction; route only what fails the threshold |
| Using the most expensive model for every request regardless of complexity | Pays premium pricing for work a cheaper model handles fine | Route by an explicit complexity threshold (text length, item count) |
| Retrying on every error type, including auth and validation failures | Burns budget and retry time on failures that will never succeed | Retry only transient errors (network, rate limit, 5xx); fail fast otherwise |
| Mutating cost-tracker or parsed-item state in place | Makes spend auditing and debugging unreliable | Return new immutable instances from every update |
| Ignoring prompt caching on a large, repeated system prompt | Pays full input-token cost on the same static content every call | Cache the stable portion once it exceeds ~1024 tokens |
