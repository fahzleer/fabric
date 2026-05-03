import { Layer } from "effect";
import Elysia from "elysia";
import { cors } from "@elysiajs/cors";
import { KafkaConfig, KafkaProducer } from "@fabric/kafka";
import { requestLogger, metricsPlugin } from "@fabric/effect-http";
import { initTracing } from "@fabric/observability";

initTracing("importer");
import { ImporterService } from "./application/importer.service.ts";
import { buildImporterRoutes } from "./http/importer.routes.ts";

const KafkaLayer = KafkaProducer.layer.pipe(
  Layer.provide(Layer.succeed(KafkaConfig, KafkaConfig.fromEnv()))
);

const AppLayer = ImporterService.Default.pipe(
  Layer.provide(KafkaLayer),
  Layer.orDie
);

const PORT = Number(process.env["PORT"] ?? 4009);

const gatewayOrigins = (process.env["GATEWAY_URL"] ?? "http://localhost:4000").split(",");
const corsOrigins    = [...gatewayOrigins, "http://localhost:3000"];

const importerRoutes = await buildImporterRoutes(AppLayer);

const app = new Elysia()
  .use(cors({ origin: corsOrigins }))
  .use(requestLogger("importer"))
  .use(metricsPlugin("importer"))
  .get("/health", () => ({ status: "ok", service: "importer" }))
  .use(importerRoutes)
  .listen(PORT);

console.log(`[importer] listening on http://localhost:${PORT}`);

export type App = typeof app;
