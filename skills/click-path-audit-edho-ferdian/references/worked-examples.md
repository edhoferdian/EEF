# Worked Examples — the six bug patterns, traced

One example per pattern from SKILL.md Step 2: the buggy handler, the
numbered trace that proves it, the minimal fix, and the regression test
that hands off to `test-authoring-edho-ferdian` / `e2e-testing-edho-ferdian`.
Code is React + Zustand because that is where these show up most; the
traces work the same for Vue/Pinia, Svelte stores or Redux.

---

## 1. Sequential undo — a later call resets an earlier one

```ts
// store.ts
export const useEditor = create<EditorState>((set) => ({
  selectedId: null,
  panelOpen: false,
  select: (id) => set({ selectedId: id, panelOpen: true }),
  resetSelection: () => set({ selectedId: null, panelOpen: false }),
}));

// Toolbar.tsx — "Duplicate" should duplicate the item and open its panel
function onDuplicate(item: Item) {
  const copy = duplicate(item);
  select(copy.id);          // (1) selectedId = copy.id, panelOpen = true
  refreshList();            // (2) refreshList() calls resetSelection() internally
}
```

**Trace**

```
1. select(copy.id)        → selectedId = "c2", panelOpen = true
2. refreshList()           → resetSelection() → selectedId = null, panelOpen = false
Final: panel closed, nothing selected. Label "Duplicate and edit" not met.
```

**Fix** — order the calls, or stop `refreshList` from resetting state it
doesn't own:

```ts
function onDuplicate(item: Item) {
  const copy = duplicate(item);
  refreshList();
  select(copy.id);
}
```

**Regression test (component)**

```tsx
it("duplicate opens the copy's panel", async () => {
  render(<Editor items={[item]} />);
  await userEvent.click(screen.getByRole("button", { name: /duplicate/i }));
  expect(screen.getByRole("region", { name: /item panel/i })).toBeVisible();
  expect(useEditor.getState().selectedId).not.toBeNull();
});
```

---

## 2. Async race — two writers, last one wins

```ts
async function onSave() {
  setStatus("saving");
  void saveDraft(form);                    // fire-and-forget, resolves later
  const res = await publish(form);         // (a)
  setStatus(res.ok ? "published" : "error");
}

async function saveDraft(form) {
  await api.put("/draft", form);
  setStatus("draft-saved");                // (b) may land AFTER (a)
}
```

**Trace**

```
1. setStatus("saving")
2. saveDraft starts (request A)
3. publish starts (request B)
4. B resolves first → setStatus("published")
5. A resolves      → setStatus("draft-saved")    ← overwrites
Final: badge says "Draft saved" after a successful publish.
```

**Fix** — await in order, or ignore stale writers with a request token:

```ts
let latest = 0;
async function onSave() {
  const token = ++latest;
  setStatus("saving");
  await saveDraft(form, { silent: true });
  const res = await publish(form);
  if (token === latest) setStatus(res.ok ? "published" : "error");
}
```

**E2E test** — make the draft request slow to force the race:

```ts
test("publish status survives a slow draft save", async ({ page }) => {
  await page.route("**/draft", async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    await route.fulfill({ status: 200, body: "{}" });
  });
  await page.goto("/editor/1");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("status")).toHaveText("Published");
  await page.waitForTimeout(1000);                       // let the slow draft land
  await expect(page.getByTestId("status")).toHaveText("Published");
});
```

---

## 3. Stale closure — memoised handler reads an old value

```tsx
const [count, setCount] = useState(0);
const addTwice = useCallback(() => {
  setCount(count + 1);    // count captured as 0
  setCount(count + 1);    // still 0
}, []);                   // empty deps freeze `count`
```

**Trace**

```
Click 1: count = 0 → setCount(1), setCount(1) → 1   (label says +2)
Click 2: closure still sees count = 0 → 1 again
```

**Fix** — functional updates (and honest deps):

```tsx
const addTwice = useCallback(() => {
  setCount((c) => c + 1);
  setCount((c) => c + 1);
}, []);
```

Same family: an event listener added in `useEffect(() => {...}, [])` that
reads props; a `setInterval` callback reading state. Fix with refs
(`useLatest`) or functional updates.

---

## 4. Missing transition — the handler never moves the state

```ts
async function onSubmitPayment() {
  if (!form.valid) return setError("Check the card details");
  track("payment_submitted");
  await api.post("/payments", form);
  // missing: setStep("confirmation")
}
```

**Trace**

```
1. form.valid = true
2. track(...)
3. POST /payments → 201
Final: step stays "payment"; the user sees the same form and pays again.
```

**Fix** — the transition the label promises, plus disabling double submit:

```ts
async function onSubmitPayment() {
  if (!form.valid) return setError("Check the card details");
  setSubmitting(true);
  try {
    await api.post("/payments", form, { headers: { "Idempotency-Key": form.attemptId } });
    setStep("confirmation");
  } finally {
    setSubmitting(false);
  }
}
```

---

## 5. Conditional dead path — the real work is unreachable

```ts
function onExport(format: "csv" | "xlsx") {
  if (format === "CSV") return exportCsv(rows);   // case mismatch: never true
  return exportXlsx(rows);
}
```

**Trace**

```
Label "Export CSV" calls onExport("csv")
1. "csv" === "CSV" → false
2. exportXlsx(rows) runs
Final: the user gets an .xlsx for the CSV button.
```

Look for: case/typing mismatches, feature flags defaulting off,
`if (user?.role === "admin")` where `role` is never loaded, early returns
added during debugging.

---

## 6. Effect interference — a watcher undoes the handler

```tsx
function Filters() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");

  useEffect(() => { setPage(1); }, [query]);         // reset page when query changes

  function onJumpToResult(q: string, targetPage: number) {
    setQuery(q);           // (1)
    setPage(targetPage);   // (2)
  }                        // (3) effect runs after render: setPage(1)
}
```

**Trace**

```
1. setQuery("shoes")
2. setPage(4)
3. render → effect [query changed] → setPage(1)
Final: page 1, not page 4.
```

**Fix** — derive instead of syncing, or reset in the event that changes
the query rather than in an effect:

```tsx
function onQueryInput(q: string) { setQuery(q); setPage(1); }   // reset lives in the event
function onJumpToResult(q: string, targetPage: number) { setQuery(q); setPage(targetPage); }
```

---

## Side-effect map — what Step 1 looks like on paper

```
Store: useCart (src/store/cart.ts)
| Function        | Writes                                | Calls                    |
|-----------------|---------------------------------------|--------------------------|
| addItem(id)     | items[], total                        | recalc()                 |
| recalc()        | total, discount                       | —                        |
| applyCoupon(c)  | coupon, discount                      | recalc() ← resets discount|
| clear()         | items=[], total=0, coupon=null, discount=0 | —                  |

Effects:
- CartPage: useEffect([items]) → setShippingOption(null)
- Header: subscribes to total
```

The interference is already visible in the map: `applyCoupon` sets
`discount`, then `recalc()` overwrites it. Build the map first, then the
traces become a lookup.

## Report entry template

```markdown
### F2 — "Apply coupon" shows no discount  (Severity: HIGH)

Touchpoint: `CartSummary.tsx:58` button "Apply"
Label promise: discount applied and shown

Trace:
1. applyCoupon("HEMAT10") → coupon = "HEMAT10", discount = 10000
2. applyCoupon → recalc() → discount = computeDiscount(items, null) = 0
Final state: coupon set, discount 0 — label not met.

Pattern: sequential undo (store-internal)
Fix direction: recalc() must read the stored coupon (computeDiscount(items, coupon)).
Regression test: cart with coupon shows discount line (component test).
```
