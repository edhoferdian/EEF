# Authoring Guide — React Component Composition

Adapted from ECC `react-patterns`, fetched 2026-09-04.

**This is authoring guidance, not a review checklist.** It tells you how to
shape a new component, where to put a new piece of state, and how to wire up
data fetching *before* you write the code — not how to spot these problems
after the fact. If you're reviewing existing code instead, use
`language-code-review-edho-ferdian/references/react.md`, which covers the
same territory from the opposite direction (what to flag, at what severity,
with what confidence).

---

## Render is a pure function of props and state

Derive values during render. Don't stash a computed value in `useState` and
sync it with `useEffect` — that adds a render cycle, risks desync, and hides
the data flow:

```tsx
// Write it this way from the start
function Cart({ items }: { items: CartItem[] }) {
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  return <span>{formatMoney(total)}</span>;
}
```

Side effects (mutations, network calls, subscriptions) belong in event
handlers or `useEffect` — never in the render body itself.

## The state-location decision framework

Decide where new state lives *before* you write the `useState` call. Walk
this ladder from the top every time; stopping at the first rung that fits is
the correct default, not a compromise:

1. **Component-local (`useState`/`useReducer`)** — the default for anything
   used by one component. Don't reach further just because a sibling
   *might* want it later — that's speculative generality (YAGNI), not
   design foresight.
2. **Lift to the nearest common parent** — only once a second, already-
   existing component genuinely needs the same state right now.
3. **React Context** — only once prop drilling would otherwise cross **3+
   levels** of components that don't themselves use the value (pure
   pass-through). One or two levels of drilling is normal React, not a
   design smell.
4. **External store (Zustand, Jotai, Redux Toolkit)** — only when the state
   must survive route changes, or is genuinely shared across otherwise-
   unrelated subtrees that Context can't reasonably wrap.
5. **Server-state library (TanStack Query, SWR, RSC `fetch`)** — whenever the
   state's source of truth is a server, not user interaction. Don't model
   server data as local `useState` + a manual fetch (see below).

Picking a rung higher than the data currently needs is itself a design
mistake — it adds re-render fan-out and indirection you'll have to justify
later. Most pages need nothing past rung 1 or 2.

## Data fetching: build it right from the start

**Don't reach for `useEffect` + `fetch` for application data.** It's the
pattern every project eventually regrets:

```tsx
// Avoid writing this for new code
function UserProfile({ id }: { id: string }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetch(`/api/users/${id}`).then(r => r.json()).then(setUser);
  }, [id]);
  return user ? <Profile user={user} /> : <Spinner />;
}
```

It has no cache, no de-duplication, no retry, and no Suspense integration —
and it's prone to race conditions on rapid re-render (an earlier in-flight
request can resolve after a later one and overwrite fresher state, since
nothing cancels or sequences them).

**Pick the right tool up front, by where the data lives:**

| Data source | Tool |
|---|---|
| Per-request data in a Next.js App Router Server Component | `await fetch()` directly in the Server Component |
| Client-side data with cache + mutations + invalidation | TanStack Query |
| Lightweight client cache + revalidation | SWR |
| React 19+, want to read a promise directly in a component | the `use()` hook, wrapped in `<Suspense>` |
| Real-time | Server-Sent Events, WebSockets, or the library's own subscription API |
| One-off fire-and-forget (not render-blocking) | `fetch()` inside an event handler is fine — the anti-pattern is specifically fetching *render-critical* data via `useEffect` |

### Suspense boundaries and `use()`

Place `<Suspense>` boundaries close to the data that's loading, not at the
route root — that lets the rest of the page render immediately while only
the slow part shows a fallback:

```tsx
<ErrorBoundary fallback={<ErrorView />}>
  <Suspense fallback={<UserSkeleton />}>
    <UserDetail id={id} />
  </Suspense>
</ErrorBoundary>
```

On React 19+, `use()` lets a component read a promise (or a Context) directly
during render, unwrapped by the nearest Suspense boundary — this replaces a
lot of what `useEffect`+`fetch` used to do by hand:

```tsx
// Parent creates/passes the promise (e.g. from a Server Component or a cache)
function UserDetail({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise); // suspends until resolved
  return <Profile user={user} />;
}
```

Design the boundary so the promise is created once (in a parent, a cache, or
a Server Component) and passed down — don't create a new promise on every
render inside the component calling `use()`, or you'll suspend forever.

An Error Boundary only catches errors thrown during rendering, lifecycle
methods, and constructors — **not** inside event handlers, `.then()`
callbacks, `setTimeout`, or during SSR. When designing a component that does
async work outside of Suspense-driven rendering (a submit handler, a
background poll), give it its own local `try`/`catch` and error state — don't
design it to lean on a nearby Error Boundary for those cases.

## Composition patterns to avoid prop-drilling

Reach for these before reaching for Context — they solve most "prop drilling"
problems structurally, without adding a new state layer:

### Slot via `children`

```tsx
<Layout>
  <Header />
  <Main>{content}</Main>
</Layout>
```

`Layout` never needs to know what's inside `<Main>` — the composition itself
avoids passing content-shaped props down through layers that don't use them.

### Named slots

```tsx
<Page header={<Nav />} sidebar={<Filters />}>
  <Results />
</Page>
```

Useful when a component needs more than one distinct content region.

### Compound components (shared state via a co-located Context)

```tsx
<Tabs defaultValue="profile">
  <Tabs.List>
    <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
    <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Panel value="profile"><Profile /></Tabs.Panel>
  <Tabs.Panel value="settings"><Settings /></Tabs.Panel>
</Tabs>
```

This is a case where Context is the right tool even below the "3+ levels"
threshold above — the Context here is internal implementation detail of one
compound component, not a cross-cutting app concern, and every consumer is a
direct child that uses the value (no pure pass-through).

### Render prop / function-as-child

Useful specifically when the parent needs to hand the child computed data
that only the parent has:

```tsx
<DataLoader id={id}>
  {({ data, isLoading }) => isLoading ? <Spinner /> : <UserCard user={data} />}
</DataLoader>
```

For new code, prefer a custom hook (`useData(id)`) returning the same shape —
it's usually cleaner and composes better with other hooks.

## Custom hook design principles

- **Extract a hook only when the same hook sequence appears in 2+
  components.** A hook wrapping a single `useState` used in one place is
  indirection without payoff.
- **Return a small, stable shape.** Prefer `{ data, error, loading, refetch }`
  over exposing internal state pieces the caller shouldn't touch directly.
- **Keep the latest closures in refs when a returned callback must stay
  referentially stable across renders** — otherwise callers who pass inline
  functions/objects will trigger effect loops downstream:

```tsx
function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
```

- **Name hooks for what they return, not how they're implemented** —
  `useDebounce`, `useToggle`, `useMedia`, not `useEffectWrapper`.
- **Don't memoize by default.** Default position: no `useMemo`/`useCallback`.
  Add them only once a profiler or a known dependency chain (e.g. a value
  passed to a `React.memo`-wrapped child) proves it matters. In a codebase
  that has adopted the React Compiler, skip manual memoization entirely —
  the compiler does this automatically and a stale manual dependency array
  can silently disagree with its analysis.

## Designing the Server/Client Component boundary

Decide the boundary shape before writing either side:

```tsx
// Server Component — default, async, ships no JS for itself
export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await db.product.findUnique({ where: { id: params.id } });
  if (!product) notFound();
  return <ProductView product={product} />;
}

// Client Component — opt in explicitly with "use client"
"use client";
export function AddToCartButton({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button disabled={pending} onClick={() => startTransition(() => addToCart(productId))}>
      {pending ? "Adding..." : "Add to cart"}
    </button>
  );
}
```

Design rules to follow while writing the boundary, not just to catch after
the fact:

- **Push `"use client"` as far down the tree as possible.** Mark only the
  leaf that actually needs interactivity (a button, a form) — wrapping a
  whole page or layout in `"use client"` drags every child it imports into
  the client bundle, even children that didn't need to be there.
- **Server → Client crosses only via serializable props or `children`.**
  Don't design a Client Component to expect a function, a class instance, or
  a Date object from a Server Component parent — pass primitives, plain
  objects/arrays, or pre-rendered JSX via `children`.
- **Client → Server crosses via Server Actions** — `<form action={...}>` for
  the declarative path, or an imperative call from an event handler. Design
  the action itself to validate its own input; never trust that the calling
  client already validated it.
- **Never plan for a Client Component to `import` a Server Component
  directly.** If a Client Component needs server-rendered content inside it,
  design the composition so a Server Component parent passes that content
  down via `children` or a prop — the Client Component itself only ever
  receives it, never imports it.
- **Keep data-shaping on the server side of the boundary.** Fetch and select
  only the fields the Client Component actually needs before crossing —
  don't hand a full server record across the boundary and filter fields on
  the client; that both over-serializes and risks exposing fields you meant
  to keep server-only.

## Forms (React 19+)

For new forms, prefer `useActionState` over hand-rolled pending/error state:

```tsx
"use client";
import { useActionState } from "react";

const initial = { error: null as string | null };

async function updateUserAction(_prev: typeof initial, formData: FormData) {
  "use server";
  const parsed = UserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid input" };
  await db.user.update({ where: { id: parsed.data.id }, data: parsed.data });
  return { error: null };
}

export function UserForm() {
  const [state, formAction, pending] = useActionState(updateUserAction, initial);
  return (
    <form action={formAction}>
      <input name="name" required />
      <button type="submit" disabled={pending}>Save</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
```

For optimistic UI, design around `useOptimistic` rather than a manual
"set-then-revert-on-failure" state machine:

```tsx
"use client";
import { useOptimistic } from "react";

export function MessageList({ messages }: { messages: Message[] }) {
  const [optimistic, addOptimistic] = useOptimistic(
    messages,
    (state, newMessage: Message) => [...state, newMessage],
  );

  async function send(formData: FormData) {
    const text = String(formData.get("text"));
    addOptimistic({ id: "pending", text, sender: "me" });
    await saveMessage(text);
  }

  return (
    <>
      <ul>{optimistic.map((m) => <li key={m.id}>{m.text}</li>)}</ul>
      <form action={send}>
        <input name="text" />
        <button type="submit">Send</button>
      </form>
    </>
  );
}
```

For multi-step forms, dynamic field arrays, or cross-field validation, design
around a form library (React Hook Form, TanStack Form) from the start —
hand-rolling form state past trivial complexity is a maintenance trap you'll
pay for later, not a shortcut now.

## Lists and keys, decided up front

Give every list item a stable identifier-based `key` (a database id, not the
array index) from the first line of code — this isn't a fix to apply after a
bug report, it's a default to write in immediately, because index keys only
break once the list becomes reorderable/filterable/insertable, which is easy
to not anticipate when the list is first written.

## Related

- `references/composition-and-ux.md` in this skill — animation and focus
  management craft that sits on top of the components you compose here.
- `language-code-review-edho-ferdian/references/react.md` — the review-time
  mirror of this file: same territory, opposite direction (what to flag,
  at what severity).
