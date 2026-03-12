# apps/web — Next.js Frontend

**Framework**: Next.js 16.1.6 (React 19.2.4)
**Port (dev)**: 3000
**Styling**: Tailwind CSS 4 (CSS-first, no JavaScript config)
**Auth**: better-auth + Drizzle + PostgreSQL
**State**: @effect-atom/atom-react v0.5.0
**Data fetching**: @orpc/client + @tanstack/react-query
**Offline**: Dexie 4 (IndexedDB)
**Web3**: viem + wagmi
**URL state**: nuqs
**Analytics**: Mixpanel
**Toasts**: Sonner

---

## The Dual-Auth Problem

The system has two authentication worlds that must coexist:

**Web-session world** (better-auth): httpOnly cookie sessions, PostgreSQL-backed, framework-aware. This is where `session.user.role` lives. This is what the Next.js middleware reads.

**API world** (PASETO): stateless Bearer tokens, verified by cf-api's `PasetoVerifierService`. This is what every cf-api route handler checks.

A merchant dashboard request must present both: a valid session cookie to Next.js (to reach the server action) *and* a PASETO token to cf-api (to get data). The bridge is the `createMerchantApi()` function.

### The Bridge

```typescript
// src/lib/merchant-api.ts

export async function createMerchantApi(
  userId: string,
  email: string,
  role: string
): Promise<MerchantApiClient> {
  // Step 1: Issue a PASETO token via the internal bridge
  const token = await issueToken(userId, email, role)
  // POST /internal/issue-token on cf-api
  // Headers: x-internal-secret: INTERNAL_SECRET
  // Body: { userId, email, role }
  // Returns: { accessToken: "v3.local...." }

  // Step 2: Return a typed API client that uses the token
  return {
    async getProducts(): Promise<MerchantProduct[]> {
      const res = await fetch(`${CF_API_URL}/api/products`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.json()
    },
    // ... other methods
  }
}
```

Usage in a Server Action:

```typescript
// src/app/(merchant)/merchant/products/page.tsx
export default async function ProductsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== "store_owner") redirect("/auth/login")

  const api = await createMerchantApi(session.user.id, session.user.email, session.user.role)
  const products = await api.getProducts()

  return <ProductListClient initialProducts={products} />
}
```

**Why not just use session cookies everywhere?** cf-api is a separate Cloud Function. It doesn't share a cookie jar with Next.js. PASETO tokens are the correct mechanism for service-to-service auth. The bridge converts the session-world identity into the token-world identity exactly once per request.

---

## Authentication Setup

`better-auth` is configured in `src/lib/auth.ts`:

```typescript
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  socialProviders: {
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24,    // 24 hours
    updateAge: 60 * 60,          // Extend session if active within last hour
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,            // Cache session in cookie for 5 minutes
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "customer",
      },
    },
  },
  plugins: [admin()],
})
```

**Auth routes** (Next.js): `/auth/login`, `/auth/register`. Not `/sign-in` or `/sign-up`. The paths are canonical.

**Role storage**: `session.user.role` comes from PostgreSQL's `"user".role` column. To grant merchant access, update `"user".role = 'store_owner'` in PostgreSQL. Updating Firebase RTDB alone has no effect on better-auth session role.

**Middleware** (`src/middleware.ts`): Only protects `/products` and `/product/*`. Merchant routes (`/merchant/**`) are not protected at the middleware level — they redirect on the server inside each page component after checking the session role. This is intentional: it allows server actions to handle the redirect with proper error context.

---

## App Router Structure

```
src/app/
├── layout.tsx                              ← Root HTML shell, providers
├── page.tsx                                ← Storefront home
│
├── auth/
│   ├── login/
│   │   ├── page.tsx
│   │   └── _components/login-form.tsx      ← Client component, better-auth client
│   └── register/
│       ├── page.tsx
│       ├── _components/register-form.tsx
│       └── store/                          ← Store owner registration
│           ├── page.tsx
│           └── _components/store-register-form.tsx
│
├── (merchant)/                             ← Route group: merchant portal
│   └── merchant/
│       ├── dashboard/
│       │   └── page.tsx
│       ├── products/
│       │   ├── page.tsx                    ← ProductListClient (3 atom patterns)
│       │   ├── new/page.tsx
│       │   └── [id]/edit/page.tsx
│       ├── billing/
│       │   └── page.tsx
│       ├── payouts/
│       │   └── page.tsx
│       └── analytics/
│           └── page.tsx
│
└── products/                               ← Public product catalog
    └── [id]/page.tsx
```

**No Orders page** in the merchant portal. Dashboard covers order status. This is a product decision, not an oversight.

---

## State Management: @effect-atom/atom-react

### Why Not useState/useContext?

The merchant products page demonstrates three distinct async state patterns that `useState` handles poorly:

1. **Streaming accumulation** — receiving items one-by-one over time, accumulating into an array
2. **Paginated pull** — loading chunks on demand, maintaining a cursor
3. **Imperative fan-out** — writing to multiple atoms from a single effectful computation

`@effect-atom/atom-react` solves all three because its atom model is built on the Effect ecosystem's `Stream` and `Effect.gen` primitives.

### Critical Pitfall: GC Between Phases

**This is the most important thing to understand about @effect-atom/atom-react v0.5.0.**

Atoms have `keepAlive: false` by default. When no subscriber exists, the runtime schedules the atom's node for garbage collection via a microtask. The window where this causes a bug:

```
React renders ProductListClient
  → useLayoutEffect fires (synchronous): setAllProducts(initialProducts) ← seeds the atom
  → React schedules passive effects
  → GC microtask runs: atom node is removed (no subscriber yet!)
  → Passive effect fires: subscribeToStore → creates a new, empty atom node
```

**Result**: The atom that `merchantStreamAtom`, `merchantPageAtom`, and `merchantSearchAtom` read from via `get(merchantAllProductsAtom)` is empty — a fresh `[]` node. All three tabs appear to have no data.

**Fix**: wrap shared source-of-truth atoms with `Atom.keepAlive()`:

```typescript
// ❌ Gets GC'd between useLayoutEffect and passive effect subscription
export const merchantAllProductsAtom = Atom.make<MerchantProduct[]>([])

// ✅ Stays alive
export const merchantAllProductsAtom = Atom.keepAlive(Atom.make<MerchantProduct[]>([]))
```

`keepAlive` prevents the GC microtask from removing the node even when subscriber count is zero.

### Pattern 1: Atom.fn + Stream.scan (Streaming Accumulation)

```typescript
// src/application/atoms/merchant-products.atoms.ts

export const merchantStreamAtom = Atom.fn(
  (query: string, get): Stream.Stream<MerchantProduct[], never, never> =>
    Stream.fromIterable(get(merchantAllProductsAtom)).pipe(
      Stream.filter((p) =>
        query === "" || p.name.toLowerCase().includes(query.toLowerCase())
      ),
      Stream.sleep("60 millis"),           // Simulate network latency between items
      Stream.scan([] as MerchantProduct[], (acc, p) => [...acc, p])
    )
)
```

Usage:
```typescript
const [result, startStream] = useAtom(merchantStreamAtom)
// result: Result<MerchantProduct[][], ...>
// startStream(query) triggers the stream
// Atom rerenders on every Stream emission (each new item)
```

`Atom.fn` wraps a function that returns a `Stream`. The atom's value is the *accumulated state* of that stream — `scan` turns the item-by-item stream into a growing-array-by-item-by-item stream.

**When to use**: real-time feeds, progress indicators, any UI that should update as data arrives.

### Pattern 2: Atom.pull + rechunk (Cursor Pagination)

```typescript
export const merchantPageAtom = Atom.pull<MerchantProduct, never>(
  (get) =>
    Stream.fromIterable(get(merchantAllProductsAtom)).pipe(
      Stream.sleep("350 millis"),         // Simulate page load latency
      Stream.rechunk(PAGE_SIZE)           // Split stream into PAGE_SIZE chunks
    )
)
```

Usage:
```typescript
const [result, loadMore] = useAtom(merchantPageAtom)
// result: Result<PullResult<MerchantProduct>, ...>
// result.value.items: NonEmptyArray<MerchantProduct> (all items loaded so far)
// result.value.done: boolean
// loadMore() pulls the next chunk
```

`Atom.pull` is designed for "load more" patterns. Each `loadMore()` call pulls the next chunk from the stream. `PullResult.items` accumulates across pulls. `PullResult.done` is true when the stream is exhausted.

**When to use**: infinite scroll, paginated lists, any UI where the user controls when to load more.

### Pattern 3: Atom.fn + get.set (Imperative Fan-Out)

```typescript
export const merchantManualResultsAtom = Atom.keepAlive(Atom.make<MerchantProduct[]>([]))

export const merchantSearchAtom = Atom.fn<ProductFilterArg>()(
  ({ query, category, status }, get) =>
    Effect.gen(function* () {
      // Clear results first
      get.set(merchantManualResultsAtom, [])

      // Read from the shared source atom
      const products = get(merchantAllProductsAtom)

      // Filter
      const filtered = products.filter((p) => {
        const matchesQuery = query === "" || p.name.toLowerCase().includes(query.toLowerCase())
        const matchesCategory = category === "all" || p.category === category
        const matchesStatus = status === "all" || p.status === status
        return matchesQuery && matchesCategory && matchesStatus
      })

      // Append results one by one (demonstrates imperative writes to another atom)
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

Usage:
```typescript
const results = useAtomValue(merchantManualResultsAtom)  // Reads results directly
const [actionResult, runSearch] = useAtom(merchantSearchAtom)
// runSearch({ query, category, status }) triggers the Effect.gen
// results updates reactively as each product is appended
```

**Critical**: `merchantManualResultsAtom` must be `keepAlive` — it is written by the fn and read by a separate component. Without `keepAlive`, the GC pitfall described above applies.

**When to use**: search with debouncing, any case where a user action should imperatively update multiple atoms, or where you need both the "running" state (from `actionResult.waiting`) and the accumulated results (from the separate results atom).

---

## Application Layer

### Use Cases

```typescript
// src/application/use-cases/add-to-cart.use-case.ts
export function addToCartUseCase(
  cartPort: CartPort,
  productPort: ProductPort
) {
  return async (input: AddToCartInput): Promise<Result<Cart, CartError>> => {
    const product = await productPort.findById(input.productId)
    if (product._tag === "Err") return product

    const cart = await cartPort.addItem({
      cartId: input.cartId,
      productId: input.productId,
      quantity: input.quantity,
      priceAtAdd: product.value.price,
    })
    return cart
  }
}
```

Use cases live in `src/application/use-cases/`. They depend on port interfaces, not implementations. This keeps them testable without HTTP or database.

### Ports

```typescript
// src/application/ports/cart.port.ts
export interface CartPort {
  addItem(input: AddItemInput): Promise<Result<Cart, CartError>>
  getCart(cartId: CartId): Promise<Result<Cart, CartError>>
  removeItem(cartId: CartId, itemId: ItemId): Promise<Result<Cart, CartError>>
}
```

---

## Offline Support (Dexie 4)

```typescript
// src/lib/sync-cart.ts
// Dexie schema mirrors the Cart type
const db = new Dexie("fabric-cart")
db.version(1).stores({
  carts: "cartId",
  cartItems: "itemId, cartId",
})
```

Cart operations write to both IndexedDB (immediate, offline-capable) and the remote API (eventually consistent). On network reconnect, `sync-cart.ts` reconciles local state with the server. The canonical state is the server — local is the optimistic cache.

---

## Data Fetching

`@orpc/client` + `@tanstack/react-query` for server state. oRPC provides end-to-end type safety from the router contract (`@fabric/contract`) through to the React component without code generation.

```typescript
// Typed fetch — the return type is inferred from the contract
const { data: products } = useQuery(
  orpc.products.list.queryOptions({ page: 1, perPage: 20 })
)
```

`react-query` handles caching, background refetching, stale-while-revalidate, and optimistic updates. `@effect-atom/atom-react` handles *local* reactive state that doesn't map cleanly to a server resource.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql://user@host:5432/fabric` |
| `INTERNAL_SECRET` | ✅ | Shared secret for `/internal/issue-token` |
| `NEXT_PUBLIC_API_URL` | ✅ | Public URL of Cloudflare Worker |
| `BETTER_AUTH_SECRET` | ✅ | better-auth session signing key |
| `BETTER_AUTH_URL` | ✅ | `http://localhost:3000` (dev) |
| `FACEBOOK_CLIENT_ID` | optional | Facebook OAuth |
| `FACEBOOK_CLIENT_SECRET` | optional | Facebook OAuth |
| `GOOGLE_CLIENT_ID` | optional | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | optional | Google OAuth |
| `NEXT_PUBLIC_MIXPANEL_TOKEN` | optional | Mixpanel analytics |

---

## next.config.ts Notable Config

```typescript
// src/next.config.ts
{
  images: {
    dangerouslyAllowSVG: true,      // Required for placeholder SVGs (placehold.co)
    remotePatterns: [
      { hostname: "placehold.co" },  // Dev placeholder images
    ],
  },
}
```

Without `dangerouslyAllowSVG: true`, SVG product placeholder images fail to load in development.

---

## Testing

**E2E**: Cypress with `@cypress-audit/lighthouse`

```bash
cd apps/web
npx cypress open   # Interactive
npx cypress run    # Headless CI
```

Cypress tests cover critical paths: auth flows, product browsing, cart management, checkout. Lighthouse audits run as part of CI to catch performance regressions.
