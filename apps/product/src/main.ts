import { Effect, Layer } from "effect";
import Elysia from "elysia";
import { cors } from "@elysiajs/cors";
import { KafkaConfig, KafkaProducer } from "@fabric/kafka";
import { requestLogger, metricsPlugin } from "@fabric/effect-http";
import { buildHealthResponse, initTracing } from "@fabric/observability";

initTracing("product");
import postgres from "postgres";
import { Database } from "./infrastructure/db/database.ts";
import { ProductRepository } from "./infrastructure/db/product.repository.ts";
import { ProductService } from "./application/product.service.ts";
import { InventoryService } from "./application/inventory.service.ts";
import { buildProductRoutes } from "./http/product.routes.ts";
import { buildInventoryRoutes } from "./http/inventory.routes.ts";

// No-op producer — used when Kafka broker is unavailable (dev without Kafka)
const noopKafkaProducer = Layer.succeed(KafkaProducer, {
  publish:      () => Effect.void,
  publishBatch: () => Effect.void,
});

const KafkaLayer = KafkaProducer.layer.pipe(
  Layer.provide(Layer.succeed(KafkaConfig, KafkaConfig.fromEnv())),
  Layer.catchAll((e) => {
    console.warn(`[product] Kafka unavailable (${e.message ?? e}), events disabled`);
    return noopKafkaProducer;
  })
);

// Shared infra layers — single DB connection pool, single Kafka producer
const DbLayer   = Database.layer();
const RepoLayer = ProductRepository.Default.pipe(Layer.provide(DbLayer));

const AppLayer = ProductService.Default.pipe(
  Layer.provide(RepoLayer),
  Layer.provide(KafkaLayer),
  Layer.orDie
);

const InventoryAppLayer = InventoryService.Default.pipe(
  Layer.provide(RepoLayer),
  Layer.provide(KafkaLayer),
  Layer.orDie
);

// Minimal pool for health check only
const healthDb = postgres(
  process.env["DATABASE_URL"] ?? "postgres://localhost:5432/fabric_products",
  { max: 1 }
);

const PORT = Number(process.env["PORT"] ?? 4006);

const productRoutes   = await buildProductRoutes(AppLayer);
const inventoryRoutes = await buildInventoryRoutes(InventoryAppLayer);

const gatewayOrigins = (process.env["GATEWAY_URL"] ?? "http://localhost:4000").split(",");
const corsOrigins    = [...gatewayOrigins, "http://localhost:3000"];

const app = new Elysia()
  .use(cors({ origin: corsOrigins }))
  .use(requestLogger("product"))
  .use(metricsPlugin("product"))
  .get("/health", () =>
    buildHealthResponse("product", [{
      name:  "db",
      check: () => healthDb`SELECT 1`.then(() => true),
    }])
  )
  .use(productRoutes)
  .use(inventoryRoutes)
  .listen(PORT);

console.log(`[product] listening on http://localhost:${PORT}`);

export type App = typeof app;
