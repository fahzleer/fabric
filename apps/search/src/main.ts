import { Effect, Layer, ManagedRuntime } from "effect";
import Elysia from "elysia";
import { cors } from "@elysiajs/cors";
import { requestLogger, metricsPlugin } from "@fabric/effect-http";
import { initTracing } from "@fabric/observability";
import { SearchService } from "./application/search.service.ts";
import { buildSearchRoutes } from "./http/search.routes.ts";

initTracing("search");

const AppLayer = SearchService.Default.pipe(Layer.orDie);

// startIndexing is a no-op in tsvector mode but kept for interface compatibility
const runtime = ManagedRuntime.make(AppLayer);
runtime.runPromise(
  Effect.gen(function* () {
    const svc = yield* SearchService;
    yield* svc.startIndexing();
  })
).catch((e) => console.error("[search] init error:", e));

const PORT = Number(process.env["PORT"] ?? 4007);

const gatewayOrigins = (process.env["GATEWAY_URL"] ?? "http://localhost:4000").split(",");
const corsOrigins    = [...gatewayOrigins, "http://localhost:3000"];

const searchRoutes = await buildSearchRoutes(AppLayer);

const app = new Elysia()
  .use(cors({ origin: corsOrigins }))
  .use(requestLogger("search"))
  .use(metricsPlugin("search"))
  .get("/health", () => ({ status: "ok", service: "search" }))
  .use(searchRoutes)
  .listen(PORT);

console.log(`[search] listening on http://localhost:${PORT}`);

export type App = typeof app;
