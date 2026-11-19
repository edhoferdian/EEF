# Worked Lens Review — what a stack lens adds on top of code-review

Three short snippets, each reviewed twice: what the general review finds,
then what the stack lens finds that the general review misses. Use this
to calibrate: a lens finding names the framework mechanism, cites the
framework's behaviour, and gives the idiomatic fix.

## Django — the query you don't see

```python
# views.py
def order_list(request):
    orders = Order.objects.filter(store=request.user.store).order_by("-created_at")[:50]
    return render(request, "orders/list.html", {"orders": orders})
```

```django
{# orders/list.html #}
{% for o in orders %}
  <tr><td>{{ o.customer.name }}</td><td>{{ o.items.count }}</td></tr>
{% endfor %}
```

- **General review:** looks fine; scoped by store, limited to 50.
- **Django lens (python-django.md):** 1 + 50 + 50 queries — `o.customer`
  is a lazy FK access and `o.items.count` runs `COUNT` per row.

```python
from django.db.models import Count
orders = (Order.objects.filter(store=request.user.store)
          .select_related("customer")
          .annotate(item_count=Count("items"))
          .order_by("-created_at")[:50])
```

Template uses `{{ o.item_count }}`. Evidence: `django-debug-toolbar` or
`assertNumQueries(2)` in a test.

## FastAPI — blocking the event loop

```python
@app.get("/reports/{id}")
async def get_report(id: int, db: Session = Depends(get_db)):
    report = db.query(Report).get(id)          # sync SQLAlchemy session
    pdf = render_pdf(report)                    # CPU-heavy, sync
    return Response(pdf, media_type="application/pdf")
```

- **General review:** missing 404 when `report` is None.
- **FastAPI lens (python-fastapi.md):** an `async def` endpoint runs on the
  event loop; the sync DB call and the PDF render block every other
  request on that worker.

```python
@app.get("/reports/{id}")
def get_report(id: int, db: Session = Depends(get_db)):        # plain def → runs in the threadpool
    report = db.get(Report, id)
    if report is None:
        raise HTTPException(status_code=404)
    return Response(render_pdf(report), media_type="application/pdf")
```

or keep `async def` with an async session and
`await run_in_threadpool(render_pdf, report)`.

## React — effects that fight each other

```tsx
function ProductPage({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  useEffect(() => { fetch(`/api/products/${id}`).then((r) => r.json()).then(setProduct); }, [id]);
  useEffect(() => { setQty(1); }, [product]);
  …
}
```

- **General review:** no error handling for the fetch.
- **React lens (react.md):**
  1. Race: navigating from product A to B quickly can show A's data after
     B's (no abort/ignore of the stale response).
  2. `setQty(1)` on every `product` change — including a refetch of the
     same product — resets the user's quantity (effect used to sync
     derived state).
  3. Data fetching in `useEffect` instead of the framework's loader /
     React Query.

```tsx
const { data: product, error } = useQuery({ queryKey: ["product", id], queryFn: () => getProduct(id) });
// reset quantity when the product id changes, by keying the form:
<QuantityForm key={id} product={product} />
```

## Go — the goroutine that never ends

```go
func (s *Server) handle(w http.ResponseWriter, r *http.Request) {
	results := make(chan Result)
	go func() { results <- s.slowLookup(r.URL.Query().Get("q")) }()
	select {
	case res := <-results:
		json.NewEncoder(w).Encode(res)
	case <-time.After(2 * time.Second):
		http.Error(w, "timeout", http.StatusGatewayTimeout)
	}
}
```

- **General review:** fine; there's a timeout.
- **Go lens (go.md):** on timeout nobody reads `results`; the goroutine
  blocks forever on an unbuffered send → goroutine leak under load. Also
  `slowLookup` ignores cancellation.

```go
ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
defer cancel()
results := make(chan Result, 1)                       // buffered: the send never blocks
go func() { results <- s.slowLookup(ctx, r.URL.Query().Get("q")) }()
select {
case res := <-results:
	json.NewEncoder(w).Encode(res)
case <-ctx.Done():
	http.Error(w, "timeout", http.StatusGatewayTimeout)
}
```

## What makes a good lens finding

| Part | Example |
|---|---|
| Mechanism | "`async def` runs on the event loop" |
| Evidence | file:line, query count, a failing test, a profile |
| User impact | "every request on that worker waits for the PDF" |
| Idiomatic fix | the framework's own pattern, not a workaround |
| Confidence | confirmed (ran it) / likely (read it) |

A lens finding that could be written without knowing the framework
belongs to the general review instead.
