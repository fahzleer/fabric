# Offline-First Cart (Dexie + Firebase Sync)

The web storefront allows customers to add items to a cart without being logged in, and without any network requests. Cart state lives locally in IndexedDB (Dexie), syncs to Firebase on demand, and merges on checkout.

---

## Architecture

```
Customer Browser
  │
  ├── Dexie IndexedDB ("fabric-cart" database)
  │     └── cartItems table
  │           key: "${productId}:${size}"
  │           fields: qty, unitPriceCents, currency, productName, productImageUrl, addedAt
  │
  └── Firebase RTDB (carts/{userId}/items/{productId}_{size})
        └── synced on checkout submission only
```

The local Dexie cart is the **source of truth** during browsing. Firebase is authoritative at **order placement**.

---

## Dexie Schema

```typescript
// apps/web/src/infrastructure/dexie/cart.db.ts
class CartDatabase extends Dexie {
  cartItems!: Table<DexieCartItem>

  constructor() {
    super("fabric-cart")
    this.version(1).stores({
      cartItems: "key, productId, size, addedAt",
      //         ^ primary key is composite: "${productId}:${size}"
    })
  }
}

interface DexieCartItem {
  key: string         // "${productId}:${size}"
  productId: string
  size: string
  qty: number
  unitPriceCents: number
  currency: string
  productName: string
  productImageUrl: string
  addedAt: string     // ISO timestamp
}
```

### Why Dexie?

- IndexedDB survives page refresh without a network round-trip
- Works fully offline (service worker not required for basic cart functionality)
- `useLiveQuery()` from `dexie-react-hooks` provides reactive updates — the cart UI re-renders when Dexie writes happen, no explicit state management
- Handles concurrent tab writes correctly (IndexedDB transactions)

---

## Cart State (atoms)

Dexie's live query hooks push updates into @effect-atom/atom-react atoms:

```typescript
// apps/web/src/application/atoms/cart.atoms.ts
export const cartAtom = Atom.make<Option.None | Option.Some<ShoppingCart>>(Option.none())
export const cartLoadingAtom = Atom.make(true)
export const cartErrorAtom = Atom.make<string | null>(null)
```

The sync hook (`use-dexie-cart-sync.ts`) runs at page root and keeps atoms in sync with Dexie's live query:

```typescript
// Called once in the root layout
function useDexieCartSync() {
  const items = useLiveQuery(() => db.cartItems.toArray())
  const [, setCart] = useAtom(cartAtom)

  useEffect(() => {
    if (items === undefined) return
    const cart = dexieItemsToCart(items)
    setCart(Option.some(cart))
  }, [items])
}
```

---

## Cart Operations (Effect-based)

All cart mutations go through `dexie-cart.adapter.ts`, which wraps Dexie in Effect:

```typescript
// apps/web/src/infrastructure/dexie/dexie-cart.adapter.ts

export const addItem = (item: CartItemInput): Effect.Effect<ShoppingCart, CartError> =>
  Effect.tryPromise({
    try: async () => {
      const existing = await db.cartItems.get(`${item.productId}:${item.size}`)
      const newQty = new BigNumber(existing?.qty ?? 0).plus(item.quantity).toNumber()
      if (newQty > 99) throw new InvalidQuantityError()

      await db.cartItems.put({
        key: `${item.productId}:${item.size}`,
        productId: item.productId,
        size: item.size,
        qty: newQty,
        unitPriceCents: item.unitPriceCents,
        currency: item.currency,
        productName: item.productName,
        productImageUrl: item.productImageUrl,
        addedAt: new Date().toISOString(),
      })
      return dexieItemsToCart(await db.cartItems.toArray())
    },
    catch: (e) => mapDexieError(e),
  })
```

BigNumber is used for quantity arithmetic to avoid floating-point errors.

### Use case layer

```typescript
// apps/web/src/application/use-cases/add-to-cart.use-case.ts
export const addToCartUseCase = (input: AddToCartInput, deps: AddToCartDeps) =>
  pipe(
    deps.cart.addItem(input),
    Effect.tap((cart) =>
      Effect.forkDaemon(deps.eventBus.publish({ _type: "ItemAddedToCart", payload: input }))
    )
  )
```

The analytics event is fire-and-forked — cart mutations never block on event delivery.

---

## Sync to Firebase (On Checkout)

When the customer proceeds to checkout, the local Dexie cart is synced to Firebase RTDB:

```typescript
// apps/web/src/lib/sync-cart.ts
export async function syncCartToFirebase(userId: string, token: string): Promise<boolean> {
  const items = await db.cartItems.toArray()
  if (items.length === 0) return true

  // 1. Delete existing Firebase cart for this user
  await fetch(`${CF_API_URL}/api/carts/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })

  // 2. Re-add all local items
  for (const item of items) {
    await fetch(`${CF_API_URL}/api/carts/${userId}/items`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: item.productId,
        size: item.size,
        quantity: item.qty,
        unitPriceCents: item.unitPriceCents,
      }),
    })
  }

  return true
}
```

This is called by `omise-card-form.tsx` and `promptpay-form.tsx` before submitting the order. The x402 (USDC) flow does not sync because crypto orders are placed directly with the Dexie cart ID `"local"`.

### Why sync at checkout time (not continuously)?

- **UX:** Cart operations must be instant. Writing to Firebase on every add-to-cart adds latency and requires auth.
- **Guest cart:** Unauthenticated users can use the cart freely. Firebase sync requires a user ID.
- **Cost:** Firebase RTDB charges per write. Syncing once at checkout is significantly cheaper than syncing every mutation.

---

## CartId = "local" Pattern

The web frontend sends `cartId: "local"` in all order requests:

```typescript
// checkout form
await fetch("/orders", {
  body: JSON.stringify({
    cartId: "local",   // ← signal to OrderService to resolve by userId
    paymentMethod: "card",
    ...
  }),
})
```

`OrderService.placeOrder()` detects `cartId === "local"` and resolves the cart by `userId` via `cartRepo.findByUserId()` instead of `cartRepo.findById()`.

This allows the Dexie cart (which has no Firebase cart ID) to be resolved server-side after sync.

---

## Post-Order Cleanup

After a successful order:

1. `OrderService.placeOrder()` calls `clearCart(cart)` → saves empty cart to Firebase
2. Client-side: `db.cartItems.clear()` — empties Dexie

The Firebase cart is cleared server-side first, then the local Dexie cart is cleared on the success screen. If the client crashes between steps 1 and 2, the user sees an empty Firebase cart and a local cart. This is acceptable — the order was placed successfully.

---

## ISR Cache (Product Data)

Product data fetched for the storefront uses Next.js ISR (Incremental Static Regeneration):

```typescript
// apps/web/src/infrastructure/http-product-api.adapter.ts
const products = await unstable_cache(
  () => fetch(`${CF_API_URL}/api/products`).then(r => r.json()),
  ["products"],
  { tags: ["products"], revalidate: 300 }  // 5-minute ISR
)()
```

Tag-based revalidation via `POST /api/revalidate` is called from cf-api after product mutations (create, update, archive). Redis is used as the ISR cache store (with in-memory fallback).

Cache tags:
- `"products"` — all product listings
- `"product:${productId}"` — individual product pages
- `"store:${slug}"` — per-store product grids

---

## PWA Configuration

```typescript
// apps/web/src/app/manifest.ts
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fabric — Premium T-Shirts",
    short_name: "Fabric",
    display: "standalone",
    background_color: "#030712",
    theme_color: "#10b981",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
```

The PWA manifest enables "Add to Home Screen" on mobile. The app shell loads without network; product data requires network. There is no service worker for offline product browsing — this is intentional (product prices change frequently and stale prices are harmful).

---

## Limitations & Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| Cart sync is not atomic | Medium | If sync fails midway, partial items end up in Firebase. Next sync is destructive (delete-all + re-add). |
| No conflict resolution | Low | If the user has both a local Dexie cart and an existing Firebase cart, the Firebase cart is overwritten. |
| Dexie cart survives logout | Low | Local cart is not cleared on sign-out — intentional for guest-to-registered conversion. |
| No offline order placement | By design | Order placement requires network (Firebase + Omise). Dexie only buffers the cart. |

Tracked in `docs/TECH_DEBT.md`.
