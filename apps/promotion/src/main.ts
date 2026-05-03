import { Effect, Layer } from "effect";
import Elysia from "elysia";
import { cors } from "@elysiajs/cors";
import { KafkaConfig, KafkaProducer } from "@fabric/kafka";
import { requestLogger, metricsPlugin } from "@fabric/effect-http";
import { initTracing } from "@fabric/observability";

initTracing("promotion");
import { PromotionService } from "./application/promotion.service.ts";
import { Database } from "./infrastructure/db/database.ts";
import { PromotionRepository } from "./infrastructure/db/promotion.repository.ts";
import { buildPromotionRoutes } from "./http/promotion.routes.ts";

// No-op producer used when Kafka is not reachable in dev
const noopKafkaProducer: typeof KafkaProducer.Service = {
  publish:      () => Effect.void,
  publishBatch: () => Effect.void,
};

const KafkaLayer = KafkaProducer.layer.pipe(
  Layer.provide(Layer.succeed(KafkaConfig, KafkaConfig.fromEnv())),
  Layer.catchAll(() => Layer.succeed(KafkaProducer, noopKafkaProducer))
);

const DbLayer   = Database.layer();
const RepoLayer = PromotionRepository.Default.pipe(Layer.provide(DbLayer));

const AppLayer = PromotionService.Default.pipe(
  Layer.provide(KafkaLayer),
  Layer.provide(RepoLayer),
  Layer.orDie
);

const PORT = Number(process.env["PORT"] ?? 4008);

const gatewayOrigins = (process.env["GATEWAY_URL"] ?? "http://localhost:4000").split(",");
const corsOrigins    = [...gatewayOrigins, "http://localhost:3000"];

const promotionRoutes = await buildPromotionRoutes(AppLayer);

const app = new Elysia()
  .use(cors({ origin: corsOrigins }))
  .use(requestLogger("promotion"))
  .use(metricsPlugin("promotion"))
  .get("/health", () => ({ status: "ok", service: "promotion" }))
  .use(promotionRoutes)
  .listen(PORT);

console.log(`[promotion] listening on http://localhost:${PORT}`);

export type App = typeof app;
