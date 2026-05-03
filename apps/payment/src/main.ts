import { Layer } from "effect";
import Elysia from "elysia";
import { cors } from "@elysiajs/cors";
import { KafkaConfig, KafkaProducer } from "@fabric/kafka";
import { requestLogger, metricsPlugin } from "@fabric/effect-http";
import { initTracing } from "@fabric/observability";

initTracing("payment");
import { PaymentService } from "./application/payment.service.ts";
import { Database } from "./infrastructure/db/database.ts";
import { PaymentRepository } from "./infrastructure/db/payment.repository.ts";
import { buildPaymentRoutes } from "./http/payment.routes.ts";
import { buildOmiseRoutes } from "./http/omise.routes.ts";

const KafkaLayer = KafkaProducer.layer.pipe(
  Layer.provide(Layer.succeed(KafkaConfig, KafkaConfig.fromEnv()))
);

const DbLayer   = Database.layer();
const RepoLayer = PaymentRepository.Default.pipe(Layer.provide(DbLayer));

const AppLayer = PaymentService.Default.pipe(
  Layer.provide(KafkaLayer),
  Layer.provide(RepoLayer),
  Layer.orDie
);

const PORT = Number(process.env["PORT"] ?? 4003);

const paymentRoutes = await buildPaymentRoutes(AppLayer);
const omiseRoutes   = await buildOmiseRoutes(AppLayer);

const gatewayOrigins = (process.env["GATEWAY_URL"] ?? "http://localhost:4000").split(",");
const corsOrigins    = [...gatewayOrigins, "http://localhost:3000"];

const app = new Elysia()
  .use(cors({ origin: corsOrigins }))
  .use(requestLogger("payment"))
  .use(metricsPlugin("payment"))
  .get("/health", () => ({ status: "ok", service: "payment" }))
  .use(paymentRoutes)
  .use(omiseRoutes)
  .listen(PORT);

console.log(`[payment] listening on http://localhost:${PORT}`);

export type App = typeof app;
