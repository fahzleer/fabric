# apps/worker — Cloudflare Worker (Edge Router)

**Runtime**: Cloudflare Workers (V8 isolates, global edge network)
**Role**: URL-based reverse proxy. Zero business logic.
**Dev server**: Wrangler (Bun)

---

## What This Is (And What It Is Not)

The worker is a **dumb router**. Its entire responsibility is to look at the URL path of an incoming request and forward it to the correct upstream service. It does not parse request bodies. It does not verify tokens. It does not make business decisions.

This design is deliberate. Cloudflare Workers run at 300+ PoPs globally. The latency advantage of Cloudflare edge comes from its network proximity, not from running application logic at the edge. Running application logic (auth, DB calls, business rules) at the edge requires your data to also be at the edge, which introduces a different class of consistency problems. For Fabric's scale and requirements, the correct tradeoff is: use the edge for what it is genuinely good at (TCP termination, TLS offload, DDoS mitigation, routing) and keep business logic in a single, well-understood region.

If you find yourself tempted to add a cache lookup or a JWT verification to this file, stop. That code belongs in cf-api.

---

## Routing Table

```typescript
const API_PREFIXES      = ["/api/", "/auth/", "/token/"]
const COMMERCE_PREFIXES = ["/checkout/", "/pricing/", "/inventory/",
                           "/voucher/", "/events/", "/sse/", "/payment/"]

// Everything else → FIREBASE_HOSTING_URL (Next.js web app)
```

| Path prefix | Upstream | Service |
|---|---|---|
| `/api/**` | `CF_API_URL` | cf-api (Hono) |
| `/auth/**` | `CF_API_URL` | cf-api auth routes |
| `/token/**` | `CF_API_URL` | cf-api token routes |
| `/checkout/**` | `CF_COMMERCE_URL` | cf-commerce pricing |
| `/pricing/**` | `CF_COMMERCE_URL` | cf-commerce pricing |
| `/inventory/**` | `CF_COMMERCE_URL` | cf-commerce inventory |
| `/voucher/**` | `CF_COMMERCE_URL` | cf-commerce voucher |
| `/events/**` | `CF_COMMERCE_URL` | cf-commerce CQRS events |
| `/sse/**` | `CF_COMMERCE_URL` | cf-commerce SSE stream |
| `/payment/**` | `CF_COMMERCE_URL` | cf-commerce payment |
| `/**` | `FIREBASE_HOSTING_URL` | Next.js web app |

**Important**: `/internal/**` is **not in the routing table**. The worker does not proxy internal routes. Internal routes (`/internal/issue-token`, `/internal/payment-result`) are direct service-to-service calls between cf-api and cf-commerce — they are not accessible from the public internet via the worker.

---

## Implementation

```typescript
// src/index.ts
export interface Env {
  CF_API_URL: string            // e.g. https://cfapi-xxxx-uc.a.run.app
  CF_COMMERCE_URL: string       // e.g. https://cfcommerce-xxxx-uc.a.run.app
  FIREBASE_HOSTING_URL: string  // e.g. https://fabric-xxxx.web.app
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Determine upstream
    const targetBase =
      API_PREFIXES.some((p) => url.pathname.startsWith(p))
        ? env.CF_API_URL
        : COMMERCE_PREFIXES.some((p) => url.pathname.startsWith(p))
          ? env.CF_COMMERCE_URL
          : env.FIREBASE_HOSTING_URL

    // Forward request
    const upstreamUrl = `${targetBase}${url.pathname}${url.search}`
    const upstreamRequest = new Request(upstreamUrl, {
      method: request.method,
      headers: buildUpstreamHeaders(request),
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      duplex: "half",  // Required for streaming request bodies
    })

    try {
      const response = await fetch(upstreamRequest)
      return addSecurityHeaders(response)
    } catch {
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      )
    }
  },
}
```

---

## Headers

### Forwarded Headers (Worker → Upstream)

```typescript
function buildUpstreamHeaders(request: Request): Headers {
  const headers = new Headers(request.headers)
  headers.set("x-forwarded-for", request.headers.get("cf-connecting-ip") ?? "")
  headers.set("x-cf-country", request.headers.get("cf-ipcountry") ?? "")
  return headers
}
```

`cf-connecting-ip` is Cloudflare's header containing the real client IP (bypasses Cloudflare's own IP). cf-api's rate limiter reads `x-forwarded-for` to get the true client IP for per-IP rate limiting.

`cf-ipcountry` is Cloudflare's two-letter country code header. Forwarded as `x-cf-country` for upstream geo-based logic (e.g., shipping availability to specific countries).

### Security Headers (Worker → Client Response)

Added to every response coming back from upstream:

```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Note: cf-api sets its own security headers as well. The worker setting headers is defense-in-depth — if a bug in cf-api causes headers to be stripped, the worker re-asserts them. Both layers set similar but not identical headers (`HSTS max-age` differs: worker uses 1 year, cf-api uses 2 years — cf-api wins for clients that hit cf-api headers after a redirect).

---

## Dev Server

```bash
cd apps/worker
bun run dev   # Wrangler dev, port 8787
```

`wrangler.toml` defines the local environment variables. The worker runs locally against local cf-api (`:3010`) and cf-commerce (`:8082`).

**Elysia is a dev-only dependency** (`src/server.ts`). It is not the Cloudflare Worker. The production export is `apps/worker/src/index.ts` — the `fetch` handler. Elysia's dev server is a local convenience wrapper for testing the routing logic without Wrangler.

---

## Wrangler Configuration

```toml
# wrangler.toml
name = "fabric-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
CF_API_URL = "http://localhost:3010"
CF_COMMERCE_URL = "http://localhost:8082"
FIREBASE_HOSTING_URL = "http://localhost:3000"
```

Production values are set via Cloudflare dashboard or `wrangler secret put` — never committed to source.

---

## Error Handling

If the upstream is unreachable (network error, cold start timeout), the worker returns:

```json
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{ "error": "Service temporarily unavailable" }
```

No raw upstream error is exposed to the client. This prevents information leakage (stack traces, internal URLs, service names) from appearing in browser error messages.

---

## Operational Notes

### SSE (Server-Sent Events)

`GET /sse/:userId` is proxied to cf-commerce. SSE connections are long-lived (minutes to hours). Cloudflare Workers support streaming responses — the worker proxies the SSE stream byte-by-byte without buffering.

Cloudflare's default request timeout is 30 seconds for CPU time, but response *streaming* is not subject to this limit. However, if the upstream connection idles (no SSE events) for more than Cloudflare's idle timeout, the connection may be dropped. Clients should implement automatic reconnection.

### WebSocket

Not currently used. If WebSocket support is needed, Cloudflare Workers support WebSocket upgrades via `WebSocketPair`. The routing table would need entries for WebSocket paths.
