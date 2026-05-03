# ADR 0011 — Database Deployment Topology: Single PostgreSQL Instance

## Status
Accepted

## Context
Each microservice owns a logical database (`fabric_orders`, `fabric_products`, `fabric_customers`, etc.) but all databases live on the same PostgreSQL server. Options:

- **One PostgreSQL instance per service** — true data isolation; independent failover and scaling per service.
- **Single PostgreSQL instance, separate databases** — logical isolation; operationally simpler; one connection pool to manage.
- **Single PostgreSQL instance, separate schemas** — lighter isolation; easiest migration path.

## Decision
Use a **single PostgreSQL instance** with **separate databases** per service domain (one database per service). Services connect with distinct `DATABASE_URL` values pointing to their own database (e.g. `fabric_orders`, `fabric_products`). No service connects to another service's database **except** the search service which holds a read-only connection to `fabric_products` (documented separately in ADR 0014).

## Consequences
- **+** Operationally simple: one PostgreSQL server to provision, back up, and monitor.
- **+** No inter-service database access (search service read-only exception notwithstanding).
- **−** Connection pool exhaustion in one service's connection pool can starve PostgreSQL's `max_connections` for all services.
- **−** A long-running migration or VACUUM on one database can cause I/O contention affecting other databases on the same server.
- **−** Cannot independently scale database resources (CPU, disk) per service.
- **Future**: Extract high-traffic services (order, product) to dedicated PostgreSQL instances when connection contention or I/O saturation is observed in production metrics.
