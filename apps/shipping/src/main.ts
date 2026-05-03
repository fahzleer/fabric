import { Effect, Layer, ManagedRuntime } from "effect";
import Elysia from "elysia";
import { cors } from "@elysiajs/cors";
import { KafkaConfig, KafkaConsumer, KafkaProducer } from "@fabric/kafka";
import { requestLogger, metricsPlugin } from "@fabric/effect-http";
import { initTracing } from "@fabric/observability";

initTracing("shipping");
import { ShippingService } from "./application/shipping.service.ts";
import { Database } from "./infrastructure/db/database.ts";
import { ShipmentRepository } from "./infrastructure/db/shipment.repository.ts";
import { buildShippingRoutes } from "./http/shipping.routes.ts";
import type { OrderId, Carrier, ShippingAddress } from "./domain/shipment.ts";

const KafkaConfigLayer = Layer.succeed(KafkaConfig, KafkaConfig.fromEnv());

const KafkaProducerLayer = KafkaProducer.layer.pipe(Layer.provide(KafkaConfigLayer));
const KafkaConsumerLayer = KafkaConsumer.layer.pipe(Layer.provide(KafkaConfigLayer));

const DbLayer   = Database.layer();
const RepoLayer = ShipmentRepository.Default.pipe(Layer.provide(DbLayer));

const AppLayer = ShippingService.Default.pipe(
  Layer.provide(KafkaProducerLayer),
  Layer.provide(RepoLayer),
  Layer.orDie
);
const appRuntime = ManagedRuntime.make(AppLayer);

// ── Kafka Consumer: order.paid → create shipment ──────────────────────────────
// Replaces the sync HTTP call from order service worker (ADR 0008).
// order.paid event includes shippingAddress so no cross-service DB query needed.

const consumerRuntime = ManagedRuntime.make(KafkaConsumerLayer);

await consumerRuntime.runPromise(
  Effect.gen(function* () {
    const consumer = yield* KafkaConsumer;
    yield* Effect.forkDaemon(
      consumer.subscribe(
        ["order.paid"],
        (msg) =>
          Effect.gen(function* () {
            const data = msg.value as {
              orderId?:         string;
              shippingAddress?: ShippingAddress;
              carrier?:         string;
            };

            if (!data.orderId || !data.shippingAddress) return;

            yield* Effect.promise(() =>
              appRuntime
                .runPromise(
                  Effect.gen(function* () {
                    const svc = yield* ShippingService;
                    yield* svc
                      .create({
                        orderId: data.orderId  as OrderId,
                        carrier: (data.carrier ?? "kerry") as Carrier,
                        address: data.shippingAddress!,
                      })
                      .pipe(Effect.catchAll(() => Effect.void));
                  })
                )
                .catch(() => undefined)
            );
          })
      )
    );
  })
);

// ── Elysia Server ─────────────────────────────────────────────────────────────

const PORT = Number(process.env["PORT"] ?? 4004);

const gatewayOrigins = (process.env["GATEWAY_URL"] ?? "http://localhost:4000").split(",");
const corsOrigins    = [...gatewayOrigins, "http://localhost:3000"];

const shippingRoutes = await buildShippingRoutes(AppLayer);

const app = new Elysia()
  .use(cors({ origin: corsOrigins }))
  .use(requestLogger("shipping"))
  .use(metricsPlugin("shipping"))
  .get("/health", () => ({ status: "ok", service: "shipping" }))
  .use(shippingRoutes)
  .listen(PORT);

console.log(`[shipping] listening on http://localhost:${PORT}`);

export type App = typeof app;
