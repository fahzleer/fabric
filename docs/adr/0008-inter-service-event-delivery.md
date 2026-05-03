# ADR 0008 — Inter-Service Event Delivery: Transactional Outbox via pg-boss → Kafka

## Status
Accepted

## Context
When an order state changes (placed, paid, cancelled), downstream services (notification, shipping) must be notified. Two options existed:

- **Direct Kafka publish** from the domain service — fast but not transactional: if the publish succeeds but the DB write fails (or vice versa), state diverges.
- **Transactional Outbox** — enqueue a job in the same DB transaction as the state change, then a worker publishes to Kafka.

The order service already uses pg-boss backed by the same PostgreSQL database as the domain_events and orders_projection tables. This made pg-boss the natural outbox store.

## Decision
Use **pg-boss as a transactional outbox**: order state transitions enqueue a pg-boss job in the same Kysely transaction that writes the domain event and projection. A pg-boss worker then publishes the corresponding Kafka event (e.g. `order.placed`, `order.paid`) to be consumed by notification and shipping services.

For payment confirmation, `PaymentService.succeed()` already publishes `payment.succeeded` directly to Kafka (payment service has no pg-boss). The order service consumes `payment.succeeded` via a Kafka consumer and calls `orderService.markPaid()`.

All inter-service fan-out is **asynchronous** — no service calls another service's HTTP endpoint for event delivery.

## Consequences
- **+** At-least-once delivery: if the pg-boss worker crashes before publishing, pg-boss retries on restart.
- **+** No sync HTTP coupling between order ↔ notification ↔ shipping.
- **+** payment → order flow is fully async and loss-proof (Omise webhook → Kafka → order consumer).
- **−** Kafka must be running in all environments (including local dev).
- **−** Two hops for order events: DB → pg-boss worker → Kafka → consumer.
