# ADR 0002: Firebase RTDB Outbox with onCreate Trigger Instead of Polling

**Status:** Accepted  
**Date:** 2024-01-20

## Context

Payment completion in cf-commerce needs to notify cf-api to record revenue. The original approach was a direct HTTP call from cf-commerce to cf-api at the end of the payment handler. If cf-commerce crashed after payment but before the HTTP call completed, revenue was never recorded — a silent data loss.

Two patterns were evaluated:
1. **Direct HTTP call** — simple, fire-and-forget, loses events on crash
2. **Outbox pattern** — write event to a durable store as part of the same operation, relay asynchronously

For the outbox, two relay mechanisms were considered:
- **Polling** — a scheduled job reads unprocessed outbox entries every N seconds
- **RTDB onCreate trigger** — Firebase Cloud Functions fires automatically when a record appears at `/event_outbox/{id}`

## Decision

Use **Firebase RTDB as the outbox** with an **`onValueCreated` trigger** (Cloud Functions v2) as the relay mechanism.

```
Payment completes → write to /event_outbox/{id} (atomic) 
  → onCreate trigger fires within ~1 second
  → POST to cf-commerce /events
  → on success: delete from /event_outbox
  → on failure (≤10 retries): update retryCount
  → on failure (>10 retries): move to /event_dlq/{id}
```

## Consequences

**Positive:**
- Zero polling latency — triggers fire within 1 second of write
- No separate polling infrastructure needed
- Exponential backoff is handled by Cloud Functions retry semantics
- DLQ at `/event_dlq/{id}` gives visibility into permanently failed events
- RTDB writes are atomic — either the event enters the outbox or it doesn't

**Negative:**
- Cloud Functions cold-start adds ~200ms latency on first trigger after idle
- RTDB is not transactional with PostgreSQL — if payment is recorded in PG but RTDB write fails, outbox entry is missing (mitigated by Phase 4.2 daily reconciliation)
- DLQ events require manual reprocessing via `POST /admin/dlq/:id/reprocess`

## Implementation

- Trigger: `apps/cf-api/functions/event-relay.function.ts`
- DLQ admin route: `apps/cf-api/src/features/admin/dlq.handlers.ts`
- Reconciliation: `apps/cf-api/functions/revenue-reconciliation.function.ts`
