import { Layer } from "effect";
import Elysia from "elysia";
import { cors } from "@elysiajs/cors";
import { KafkaConfig, KafkaProducer } from "@fabric/kafka";
import { requestLogger, metricsPlugin } from "@fabric/effect-http";
import { buildHealthResponse, initTracing } from "@fabric/observability";

initTracing("customer");
import postgres from "postgres";
import { Database } from "./infrastructure/db/database.ts";
import { CustomerRepository } from "./infrastructure/db/customer.repository.ts";
import { CustomerService } from "./application/customer.service.ts";
import { buildCustomerRoutes } from "./http/customer.routes.ts";
import { buildPlatformRoutes } from "./http/platform.routes.ts";

const KafkaLayer = KafkaProducer.layer.pipe(
  Layer.provide(Layer.succeed(KafkaConfig, KafkaConfig.fromEnv()))
);

const AppLayer = CustomerService.Default.pipe(
  Layer.provide(CustomerRepository.Default),
  Layer.provide(KafkaLayer),
  Layer.provide(Database.layer()),
  Layer.orDie
);

// Minimal pool for health check only
const healthDb = postgres(
  process.env["DATABASE_URL"] ?? "postgres://localhost:5432/fabric_customers",
  { max: 1 }
);

const PORT = Number(process.env["PORT"] ?? 4002);

const customerRoutes = await buildCustomerRoutes(AppLayer);
const platformRoutes = buildPlatformRoutes();

const gatewayOrigins = (process.env["GATEWAY_URL"] ?? "http://localhost:4000").split(",");
const corsOrigins    = [...gatewayOrigins, "http://localhost:3000"];

const app = new Elysia()
  .use(cors({ origin: corsOrigins }))
  .use(requestLogger("customer"))
  .use(metricsPlugin("customer"))
  .get("/health", () =>
    buildHealthResponse("customer", [{
      name:  "db",
      check: () => healthDb`SELECT 1`.then(() => true),
    }])
  )
  .use(customerRoutes)
  .use(platformRoutes)
  .listen(PORT);

console.log(`[customer] listening on http://localhost:${PORT}`);

export type App = typeof app;
