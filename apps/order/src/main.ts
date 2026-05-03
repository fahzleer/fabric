import { Effect, Layer, ManagedRuntime } from "effect";
import Elysia from "elysia";
import { cors } from "@elysiajs/cors";
import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";
import { PgBoss, fromKysely } from "pg-boss";
import type { Job } from "pg-boss";
import type { FabricOrdersDatabase } from "./infrastructure/db/types.ts";
import { Database } from "./infrastructure/db/database.ts";
import { Boss } from "./infrastructure/boss.ts";
import { OrderRepository } from "./infrastructure/db/order.repository.ts";
import { OrderService } from "./application/order.service.ts";
import { buildOrderRoutes } from "./http/order.routes.ts";
import { buildCartRoutes } from "./http/cart.routes.ts";
import { requestLogger, metricsPlugin } from "@fabric/effect-http";
import { createLogger, buildHealthResponse, initTracing } from "@fabric/observability";
import { KafkaConfig, KafkaConsumer, KafkaProducer } from "@fabric/kafka";
import type { OrderId } from "./domain/order.ts";

initTracing("order");

const log = createLogger("order");

// ── Singletons (process-scoped) ───────────────────────────────────────────────

const connectionString =
  process.env["DATABASE_URL"] ??
  "postgresql://postgres:postgres@localhost:5432/fabric_orders";

const pool = new pg.Pool({ connectionString, max: 10 });
const db   = new Kysely<FabricOrdersDatabase>({ dialect: new PostgresDialect({ pool }) });
const boss = new PgBoss({ db: fromKysely(db) });

await boss.start();
boss.on("error", (e: Error) => log.warn("pg-boss error", { error: e.message }));
log.info("pg-boss started");

// ── Kafka Layer ───────────────────────────────────────────────────────────────
// Separate runtime for Kafka producer/consumer so they share connections
// independently of the application service layer (ADR 0008).

const KafkaConfigLayer = Layer.succeed(KafkaConfig, KafkaConfig.fromEnv());
const KafkaLayer = Layer.mergeAll(
  KafkaProducer.layer.pipe(Layer.provide(KafkaConfigLayer)),
  KafkaConsumer.layer.pipe(Layer.provide(KafkaConfigLayer)),
);
const kafkaRuntime = ManagedRuntime.make(KafkaLayer);

const publish = async (topic: string, data: unknown, key?: string) => {
  await kafkaRuntime
    .runPromise(
      Effect.gen(function* () {
        const producer = yield* KafkaProducer;
        yield* producer.publish(topic, data, key ? { key } : undefined).pipe(
          Effect.catchAll(() => Effect.void)
        );
      })
    )
    .catch((e) => log.warn("kafka publish failed", { topic, error: String(e) }));
};

// ── Application Layer ─────────────────────────────────────────────────────────

const DbLayer   = Layer.succeed(Database, db);
const BossLayer = Layer.succeed(Boss, boss);

const AppLayer = OrderService.Default.pipe(
  Layer.provide(OrderRepository.Default),
  Layer.provide(BossLayer),
  Layer.provide(DbLayer),
);
const appRuntime = ManagedRuntime.make(AppLayer);

// ── pg-boss Workers (Transactional Outbox → Kafka) ────────────────────────────
// pg-boss enqueues jobs in the same DB transaction as the order state change,
// guaranteeing at-least-once delivery to Kafka (ADR 0008).

const QUEUES = ["order.placed", "order.confirmed", "order.paid", "order.cancelled"];
for (const q of QUEUES) {
  await boss.createQueue(q).catch(() => { /* already exists */ });
}

// ── Analytics snapshot refresh ────────────────────────────────────────────────

await boss.schedule("analytics-refresh", "*/5 * * * *", {}).catch(() => { /* already scheduled */ });
await boss.work("analytics-refresh", async () => {
  try {
    await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY order_analytics_snapshot`.execute(db);
    log.info("order_analytics_snapshot refreshed");
  } catch (e) {
    log.warn("analytics snapshot refresh failed", { error: String(e) });
  }
});

type OrderJob = Job<{ orderId: string }>;

await boss.work<{ orderId: string }>("order.placed", async (jobs: OrderJob[]) => {
  for (const job of jobs) {
    const { orderId } = job.data;
    log.info("order.placed", { orderId });
    await publish("order.placed", { orderId }, orderId);
  }
});

await boss.work<{ orderId: string }>("order.confirmed", async (jobs: OrderJob[]) => {
  for (const job of jobs) {
    const { orderId } = job.data;
    log.info("order.confirmed", { orderId });
    await publish("order.confirmed", { orderId }, orderId);
  }
});

await boss.work<{ orderId: string }>("order.paid", async (jobs: OrderJob[]) => {
  for (const job of jobs) {
    const { orderId } = job.data;
    log.info("order.paid", { orderId });

    // Include shipping address so shipping service can create the shipment
    // without a separate DB query to order service.
    try {
      const rows = await db
        .selectFrom("orders_projection")
        .select(["shipping"])
        .where("id", "=", orderId)
        .limit(1)
        .execute();

      const shippingAddress = rows[0]
        ? (typeof rows[0].shipping === "string"
            ? JSON.parse(rows[0].shipping)
            : rows[0].shipping)
        : null;

      await publish("order.paid", { orderId, shippingAddress, carrier: "kerry" }, orderId);
    } catch (e) {
      log.warn("order.paid worker failed", { orderId, error: String(e) });
    }
  }
});

await boss.work<{ orderId: string }>("order.cancelled", async (jobs: OrderJob[]) => {
  for (const job of jobs) {
    const { orderId } = job.data;
    log.info("order.cancelled", { orderId });
    await publish("order.cancelled", { orderId }, orderId);
  }
});

// ── Kafka Consumer: payment.succeeded → markPaid ──────────────────────────────
// Replaces the sync HTTP call from payment webhook (ADR 0008).
// payment.succeeded is published by PaymentService.succeed() when Omise
// webhook confirms a successful charge.

await kafkaRuntime.runPromise(
  Effect.gen(function* () {
    const consumer = yield* KafkaConsumer;
    yield* Effect.forkDaemon(
      consumer.subscribe(
        ["payment.succeeded"],
        (msg) =>
          Effect.gen(function* () {
            const data = msg.value as { orderId?: string };
            if (!data.orderId) return;
            log.info("payment.succeeded received", { orderId: data.orderId });
            yield* Effect.promise(() =>
              appRuntime
                .runPromise(
                  Effect.gen(function* () {
                    const svc = yield* OrderService;
                    yield* svc.markPaid(data.orderId as OrderId).pipe(
                      Effect.catchAll((e) =>
                        Effect.sync(() =>
                          log.warn("markPaid failed", {
                            orderId: data.orderId,
                            error:   String(e),
                          })
                        )
                      )
                    );
                  })
                )
                .catch((e) =>
                  log.warn("payment.succeeded handler error", { error: String(e) })
                )
            );
          })
      )
    );
  })
).catch((e) => {
  log.warn("kafka unavailable — payment.succeeded consumer disabled", { error: String(e) });
});

// ── Elysia Server ─────────────────────────────────────────────────────────────

const PORT = Number(process.env["PORT"] ?? 4001);

const gatewayOrigins = (process.env["GATEWAY_URL"] ?? "http://localhost:4000").split(",");
const corsOrigins    = [...gatewayOrigins, "http://localhost:3000"];

const orderRoutes = await buildOrderRoutes(AppLayer);
const cartRoutes  = buildCartRoutes(db);

const app = new Elysia()
  .use(cors({ origin: corsOrigins }))
  .use(requestLogger("order"))
  .use(metricsPlugin("order"))
  .get("/health", () =>
    buildHealthResponse("order", [{
      name:  "db",
      check: () => sql`SELECT 1`.execute(db).then(() => true),
    }])
  )
  .use(orderRoutes)
  .use(cartRoutes)
  .listen(PORT);

log.info("listening", { port: PORT });

process.on("SIGTERM", async () => {
  await boss.stop({ graceful: true });
  await pool.end();
  process.exit(0);
});

export type App = typeof app;
