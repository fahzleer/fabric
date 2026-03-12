# @fabric/cache — Caching Adapters

**Location**: `packages/cache/src/`

Two adapters: Memcached (rate limiting + ephemeral key-value) and Google Cloud Storage (product image uploads).

---

## MemcachedAdapter

```typescript
export class MemcachedAdapter {
  constructor(options: { servers: string })
  // servers: comma-separated "host:port" — "cache1:11211,cache2:11211"

  async get(key: string): Promise<string | null>
  async set(key: string, value: string, ttlSeconds: number): Promise<void>
  async increment(key: string, ttlSeconds: number): Promise<number | null>
  async delete(key: string): Promise<void>
  end(): void   // Graceful shutdown (called by cleanup handler)
}
```

### Rate Limiting Usage

The `throttle` middleware in cf-api uses `increment()` to implement a sliding-window counter:

```typescript
// Key per IP+path, TTL = window duration
const count = await memcached.increment(
  `rate-limit:${ip}:/auth/login`,
  60   // TTL: 60 seconds
)
// count: current request count in this window (null if Memcached unavailable)

if (count !== null && count > 10) {
  return c.json({ error: "rate_limit_exceeded" }, 429)
}
```

If Memcached is unavailable (`increment` returns `null`), rate limiting is bypassed. This is a deliberate design choice: availability (serving legitimate requests) is preferred over strict enforcement during an infrastructure failure. An attacker exploiting this window would need Memcached to be down — a narrow attack surface.

### Cache Key Conventions

```typescript
export const CacheKeys = {
  rateLimitKey:  (ip: string, path: string) => `rate-limit:${ip}:${path}`,
  productKey:    (id: string) => `product:${id}`,
  cartKey:       (id: string) => `cart:${id}`,
}
```

All cache keys are generated via this central registry. Never construct cache keys inline in service code — key format changes must be traceable to a single location.

### TTL Strategy

| Use Case | TTL | Rationale |
|---|---|---|
| Rate limit window | 60s (login) / 120s (register) | Matches the window duration |
| Product detail | 300s (5 min) | Products change infrequently; stale-by-5-min is acceptable |
| Cart | No cache | Carts are mutable and correctness matters more than latency |

---

## GcsStorageAdapter

For product image uploads to Google Cloud Storage:

```typescript
export class GcsStorageAdapter {
  constructor(options: {
    bucketName: string
    projectId: string
  })

  async uploadImage(
    file: File,
    productId: string
  ): Promise<UploadResult>
  // UploadResult: { url: string; publicPath: string }
  // Generates a unique filename: products/{productId}/{uuid}.{ext}
  // Sets Content-Type from file.type
  // Makes the object publicly readable

  async deleteImage(url: string): Promise<void>
  // Parses the GCS public URL to extract the object path
  // Deletes the object from the bucket
}
```

Images are publicly readable objects in GCS. The URL returned by `uploadImage` is the canonical public URL embedded in `ProductImage.url`.

### Why GCS for Images?

Firebase Storage uses GCS underneath. Storing images in GCS directly (not via Firebase Storage SDK) avoids the Firebase Storage security rules overhead and allows the image URL to be a plain HTTPS URL without Firebase auth tokens. Product images are public assets — there's no reason to gate them behind authentication.
