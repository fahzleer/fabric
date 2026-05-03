# ADR 0010 — Cart Data Ownership and Persistence

## Status
Accepted

## Context
The shopping cart is a pre-order construct: a user assembles items before placing an order. Options for where to own it:

- **Separate cart service** with its own database — clean bounded context, independently deployable.
- **Redis** — fast, ephemeral, natural TTL; but no transactional guarantee when converting cart → order.
- **Order service PostgreSQL** (`cart_items` table) — same DB as orders; cart-to-order conversion is a single transaction.

## Decision
Cart lives in the **order service** as a `cart_items` table in `fabric_orders`. When a user checks out, converting the cart to an order is a single PostgreSQL transaction — no distributed write coordination required.

## Consequences
- **+** Checkout is ACID: cart items deducted and order created atomically.
- **+** No separate service or cache dependency for cart reads.
- **−** Cart (high read/write, session-oriented) and orders (low volume, append-only) share the same connection pool and schema — higher contention at scale.
- **−** Cart is not independently scalable from orders.
- **Future**: If cart write volume becomes a bottleneck, extract to a Redis-backed cart service. The checkout HTTP endpoint already isolates this transition point.
