# @effect-atom/atom-react — Three Patterns

> The fundamental insight: `useState` is synchronous. `useEffect` is asynchronous. The gap between them is where async state management bugs live.

**Library**: `@effect-atom/atom-react` v0.5.0
**Ecosystem**: Effect (Stream, Effect.gen, Runtime)
**Location**: `apps/web/src/application/atoms/merchant-products.atoms.ts`

---

## Why Standard React State Falls Short

React's built-in model works well for three things: local component state, derived synchronous state, and one-shot async fetches. It breaks down under:

1. **Streaming accumulation**: An atom that grows item-by-item as a Stream emits. React's `setState` with batching is not designed for high-frequency streaming updates.

2. **Cursor-based pagination with shared state**: "Load more" that accumulates results across pulls, shared between a button and a display component.

3. **Cross-atom writes from a single effect**: A search action that resets one atom and then appends to it multiple times as results arrive.

`@effect-atom/atom-react` models all three correctly because it integrates natively with Effect's `Stream` and `Effect.gen` — the same runtime that powers the server-side code.

---

## The GC Pitfall (Critical)

**This is the most important thing to understand about `@effect-atom/atom-react` v0.5.0.**

Atoms created with `Atom.make<T>(initialValue)` have `keepAlive: false` by default. When no subscriber exists, the runtime schedules the atom for GC via a microtask.

The hazardous sequence:

```
1. React renders ProductListClient (synchronous)
2. useLayoutEffect runs (synchronous, before paint):
      setAllProducts(initialProducts)    ← seeds the atom with server data
3. React schedules passive effects (will run after paint)
4. GC microtask runs (this is the bug):
      No subscriber exists yet → atom node is GC'd, reset to []
5. Passive effects run:
      subscribeToStore → creates a new, empty atom node ← too late
```

**Result**: The atom that derived atoms (`merchantStreamAtom`, `merchantPageAtom`, `merchantSearchAtom`) read via `get(merchantAllProductsAtom)` is an empty `[]` node. Every tab shows zero results.

**Fix**:
```typescript
// ❌ Gets GC'd between seeding and subscription
export const merchantAllProductsAtom = Atom.make<MerchantProduct[]>([])

// ✅ Pinned in memory until explicitly released
export const merchantAllProductsAtom = Atom.keepAlive(Atom.make<MerchantProduct[]>([]))
```

`Atom.keepAlive()` prevents the GC microtask from removing the node even when subscriber count is zero. This is required for any atom that is:
- Seeded in `useLayoutEffect`
- Read by atoms that are subscribed in passive effects

---

## Pattern 1: Atom.fn + Stream.scan (Streaming Accumulation)

**Use case**: Display items arriving one by one from a stream. UI updates on every emission.

```typescript
export const merchantStreamAtom = Atom.fn(
  (query: string, get): Stream.Stream<MerchantProduct[], never, never> =>
    Stream.fromIterable(get(merchantAllProductsAtom)).pipe(
      Stream.filter((p) =>
        query === "" || p.name.toLowerCase().includes(query.toLowerCase())
      ),
      Stream.sleep("60 millis"),           // Simulates real-time emission latency
      Stream.scan([] as MerchantProduct[], (acc, p) => [...acc, p])
      //          ↑ initial value            ↑ accumulator: grows with each item
    )
)
```

**How it works**:
- `Atom.fn` wraps a function that, given arguments and a `get` reader, returns a `Stream`.
- The atom's value is the *current state of the stream's scan accumulator*.
- Every time the stream emits, the atom's value updates — triggering a re-render.
- Calling `startStream(query)` re-runs the function with the new query argument, restarting the stream from scratch.

**Usage**:
```tsx
const [result, startStream] = useAtom(merchantStreamAtom)

// result is Result<MerchantProduct[], ...>
// When waiting (stream running): result.waiting === true
// When done: Result.isSuccess(result) && result.value contains all items

{Result.match(result, {
  onInitial: (r) =>
    r.waiting
      ? <Spinner />
      : <button onClick={() => startStream("")}>Start stream</button>,

  onSuccess: (r) => (
    <>
      <ProgressBar count={r.value.length} total={total} />
      <ProductTable products={r.value} />
    </>
  ),

  onFailure: () => <ErrorMessage />,
})}
```

**When to use**:
- Real-time data feeds (price tickers, live notifications)
- Progress animations (loading with items appearing one by one)
- Search results that stream in as they're computed

---

## Pattern 2: Atom.pull + rechunk (Cursor Pagination)

**Use case**: "Load more" pagination where each user action fetches the next page.

```typescript
export const PAGE_SIZE = 5

export const merchantPageAtom = Atom.pull<MerchantProduct, never>(
  (get) =>
    Stream.fromIterable(get(merchantAllProductsAtom)).pipe(
      Stream.sleep("350 millis"),         // Simulates page load latency
      Stream.rechunk(PAGE_SIZE)           // Groups the stream into chunks of PAGE_SIZE
    )
)
```

**How it works**:
- `Atom.pull` creates a pull-based stream atom. The stream is paused between pulls.
- Each call to `loadMore()` pulls the *next chunk* from the stream.
- `PullResult.items` is a `NonEmptyArray<T>` that grows with each pull (accumulates across calls).
- `PullResult.done` is `true` when the stream is exhausted.
- `Stream.rechunk(PAGE_SIZE)` segments a continuous stream into discrete chunks of `PAGE_SIZE` items.

**Usage**:
```tsx
const [result, loadMore] = useAtom(merchantPageAtom)

{Result.match(result, {
  onInitial: (r) =>
    r.waiting
      ? <Spinner />
      : <button onClick={() => loadMore()}>Load products</button>,

  onSuccess: (r) => (
    <>
      <span>{r.value.items.length} / {total} products loaded</span>
      <ProductTable products={Array.from(r.value.items)} />

      {r.value.done
        ? <p>All products loaded</p>
        : <button onClick={() => loadMore()} disabled={r.waiting}>
            {r.waiting ? "Loading…" : `Load more (+${PAGE_SIZE})`}
          </button>
      }
    </>
  ),

  onFailure: () => <ErrorMessage />,
})}
```

**When to use**:
- Infinite scroll
- "Load more" buttons
- Paginated data where the user controls when to fetch next page

**Note**: `PullResult.items` is `NonEmptyArray<T>` — it is never empty inside `onSuccess`. TypeScript knows the array has at least one element. You can safely access `items[0]` without a length check.

---

## Pattern 3: Atom.fn + get.set (Imperative Fan-Out)

**Use case**: A user-triggered action that imperatively writes to multiple atoms.

```typescript
// Results are stored in a separate, shared atom
export const merchantManualResultsAtom = Atom.keepAlive(Atom.make<MerchantProduct[]>([]))

export const merchantSearchAtom = Atom.fn<ProductFilterArg>()(
  ({ query, category, status }, get) =>
    Effect.gen(function* () {
      // Step 1: Clear previous results
      get.set(merchantManualResultsAtom, [])

      // Step 2: Read from the shared source atom
      const products = get(merchantAllProductsAtom)

      // Step 3: Filter
      const filtered = products.filter((p) => {
        const matchesQuery =
          query === "" || p.name.toLowerCase().includes(query.toLowerCase())
        const matchesCategory = category === "all" || p.category === category
        const matchesStatus   = status   === "all" || p.status   === status
        return matchesQuery && matchesCategory && matchesStatus
      })

      // Step 4: Append results one by one via imperative writes
      yield* Stream.fromIterable(filtered).pipe(
        Stream.runForEach((product) =>
          Effect.sync(() => {
            const current = get(merchantManualResultsAtom)
            get.set(merchantManualResultsAtom, [...current, product])
          })
        )
      )
    })
)
```

**Why `get.set` instead of returning a value?**

In Pattern 1 and Pattern 2, the stream IS the atom value — the atom's value updates as the stream emits. In Pattern 3, results are stored in a *separate* atom (`merchantManualResultsAtom`). This separation allows:
1. Reading the results from a different component without subscribing to the search action atom
2. Persisting results across multiple search calls (until explicitly cleared)
3. Showing the "searching" state (`actionResult.waiting`) and the results simultaneously

**Critical**: `merchantManualResultsAtom` MUST be `keepAlive`. It is:
- Written by `merchantSearchAtom`'s Effect.gen
- Read by the `FilterTab` component via `useAtomValue`
- If not `keepAlive`, it will be GC'd between the write and the subscription

**Usage**:
```tsx
// These two subscriptions are independent
const results = useAtomValue(merchantManualResultsAtom)  // The accumulated results
const [actionResult, runSearch] = useAtom(merchantSearchAtom)  // The search action state

const search = (overrides?: Partial<ProductFilterArg>) =>
  runSearch({ query, category, status, ...overrides })

// actionResult.waiting = true while Effect.gen is running
// results updates reactively as each product is appended

<>
  <input onChange={(e) => { setQuery(e.target.value); search({ query: e.target.value }) }} />

  {actionResult.waiting && <Spinner />}

  <span>{results.length} results</span>
  <ProductTable products={results} />
</>
```

**When to use**:
- Search with multiple filters where results should be accessible from multiple places
- Any user action that should update multiple atoms
- Cases where you need both "is running" and "current results" simultaneously

---

## Atom Architecture Conventions

```typescript
// atoms/merchant-products.atoms.ts

// ── Source Atoms (data sources) ──────────────────────────────────────────────
// Must be keepAlive if seeded in useLayoutEffect
export const merchantAllProductsAtom = Atom.keepAlive(Atom.make<MerchantProduct[]>([]))

// ── Action/Result Atoms (derived, computed on demand) ────────────────────────
// Created with Atom.fn or Atom.pull — re-computed on each invocation
export const merchantStreamAtom = Atom.fn(...)
export const merchantPageAtom   = Atom.pull(...)
export const merchantSearchAtom = Atom.fn<ProductFilterArg>()(...)

// ── State Atoms (written by actions, read by consumers) ──────────────────────
// Must be keepAlive if written before subscription
export const merchantManualResultsAtom = Atom.keepAlive(Atom.make<MerchantProduct[]>([]))

// ── UI State Atoms (ephemeral, module-level) ──────────────────────────────────
// Not keepAlive — GC is fine when the component unmounts
const activeTabAtom      = Atom.make<Tab>("stream")
const filterQueryAtom    = Atom.make("")
const filterCategoryAtom = Atom.make("all")
const filterStatusAtom   = Atom.make("all")
```

**Rule**: If an atom is read in `useLayoutEffect` or written before passive effects run → `keepAlive`. If an atom lives in a single component's lifecycle → no `keepAlive`.

---

## The Seeding Pattern

Server-rendered pages need to seed client atoms with data from the server:

```tsx
// Server component
export default async function ProductsPage() {
  const api = await createMerchantApi(...)
  const initialProducts = await api.getProducts()

  return <ProductListClient initialProducts={initialProducts} />
}

// Client component
export function ProductListClient({ initialProducts }: { initialProducts: MerchantProduct[] }) {
  const [, setAllProducts] = useAtom(merchantAllProductsAtom)

  // Seed the atom with server data on every mount/navigation
  // useLayoutEffect is synchronous — runs before any passive effect can
  // subscribe to the atom. Combined with keepAlive, this is safe.
  useLayoutEffect(() => {
    setAllProducts(initialProducts)
  }, [initialProducts, setAllProducts])

  // ...
}
```

`useLayoutEffect` (not `useEffect`) ensures the seed happens *synchronously before passive effects run*. With `keepAlive`, the atom node is retained between the seed write and the subscription passive effect. Without both of these together, the seed data is lost.
