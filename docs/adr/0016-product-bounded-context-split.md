# ADR 0016: Product Bounded Context Split — Catalog vs Inventory

**Status:** Accepted  
**Date:** 2026-04-29

## Context

`apps/product` originally handled both catalog concerns (name, price, images, metadata) and inventory concerns (stock levels, reservations, restocking) inside a single `ProductService`. This created coupling between two distinct change rates:

- **Catalog changes** — rare, merchant-initiated, low throughput (price/description edits)
- **Inventory changes** — frequent, triggered by orders and restocks, high concurrency (stock reservation races, oversell prevention)

Two options were evaluated:

| Option | Deployment | Isolation | Effort |
|--------|-----------|-----------|--------|
| **A — Separate services within same deployment** | Single process, shared DB | Separate `Context.Tag` / `Layer`, separate HTTP routes | Low |
| B — Separate microservices | Two processes, two DBs | Full process isolation | High |

Option B requires cross-service product lookups (inventory service must know about products). Given the current team size and the shared PostgreSQL instance for `fabric_products`, full extraction adds operational cost without proportional benefit.

## Decision

**Option A** — split into two `Context.Tag` services within `apps/product`, sharing the same process and database:

- `ProductService` — catalog CRUD (create, read, update, deactivate). Publishes `product.created`, `product.updated`, `product.deleted` to Kafka.
- `InventoryService` — stock operations (reserveStock, restockSku, getStock). Publishes `product.inventory_changed` to Kafka.

Both services share `ProductRepository` and `KafkaProducer` via Effect's Layer composition.

**HTTP surface:**
- Catalog routes: `GET/POST/PUT/PATCH/DELETE /products/*` — unchanged
- Inventory routes: `POST /products/:id/reserve` (internal secret), `POST /products/:id/restock` (store_owner), `GET /products/:id/stock` (authenticated)

## Consequences

**Positive:**
- Clear ownership: catalog PRs don't touch inventory code and vice versa
- `InventoryService` can be extracted to its own process later with only a Layer change
- Stock reservation (`reserveStock`) errors (`InsufficientInventoryError`) are isolated from catalog errors (`InvalidProductError`)
- `ProductService.Default` no longer depends on inventory domain functions (`hasStock`, `deductInventory`)

**Negative:**
- Same process means a crash affects both catalog and inventory
- Shared DB means an inventory migration can still lock catalog reads (mitigated by short transactions)

## Implementation

- `apps/product/src/application/product.service.ts` — catalog only
- `apps/product/src/application/inventory.service.ts` — inventory operations
- `apps/product/src/http/inventory.routes.ts` — inventory HTTP handlers
- `apps/product/src/main.ts` — separate Layer wiring for each service
