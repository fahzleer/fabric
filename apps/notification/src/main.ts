import { Effect, Layer, ManagedRuntime } from "effect";
import Elysia from "elysia";
import { cors } from "@elysiajs/cors";
import { KafkaConfig, KafkaConsumer, KafkaProducer } from "@fabric/kafka";
import { requestLogger, metricsPlugin } from "@fabric/effect-http";
import { initTracing } from "@fabric/observability";
import { NotificationService } from "./application/notification.service.ts";
import { EmailAdapter }         from "./adapters/email.adapter.ts";
import { SmsAdapter }           from "./adapters/sms.adapter.ts";
import { PushAdapter }          from "./adapters/push.adapter.ts";

initTracing("notification");

const KafkaConfigLayer = Layer.succeed(KafkaConfig, KafkaConfig.fromEnv());

const KafkaLayer = Layer.mergeAll(
  KafkaConsumer.layer.pipe(Layer.provide(KafkaConfigLayer)),
  KafkaProducer.layer.pipe(Layer.provide(KafkaConfigLayer))
);

const AdapterLayer = Layer.mergeAll(
  EmailAdapter.SendGrid,
  SmsAdapter.Twilio,
  PushAdapter.FCM
);

const AppLayer = NotificationService.Default.pipe(
  Layer.provide(KafkaLayer),
  Layer.provide(AdapterLayer),
  Layer.orDie
);

// ── Start Kafka consumer (forked — must not block HTTP server startup) ────────

const runtime = ManagedRuntime.make(AppLayer);

await runtime.runPromise(
  Effect.gen(function* () {
    const svc = yield* NotificationService;
    // forkDaemon: consumer runs forever in background; this Effect returns
    // immediately so the Elysia server below can start.
    yield* Effect.forkDaemon(svc.startListening());
  })
);

// ── HTTP server ───────────────────────────────────────────────────────────────

const PORT = Number(process.env["PORT"] ?? 4005);

const gatewayOrigins = (process.env["GATEWAY_URL"] ?? "http://localhost:4000").split(",");
const corsOrigins    = [...gatewayOrigins, "http://localhost:3000"];

new Elysia()
  .use(cors({ origin: corsOrigins }))
  .use(requestLogger("notification"))
  .use(metricsPlugin("notification"))
  .get("/health", () => ({ status: "ok", service: "notification" }))
  .listen(PORT);

console.log(`[notification] listening on http://localhost:${PORT}`);
