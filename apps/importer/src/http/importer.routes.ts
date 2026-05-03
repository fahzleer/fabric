import { Effect, type Layer } from "effect";
import Elysia, { t } from "elysia";
import { bootRuntime } from "@fabric/effect-http";
import { requireRole } from "@fabric/auth";
import { ImporterService } from "../application/importer.service.ts";

const JobIdParam = t.Object({ id: t.String() });

const ProductRowSchema = t.Object({
  name:        t.String(),
  description: t.String(),
  priceCents:  t.Number({ minimum: 0 }),
  currency:    t.Optional(t.String()),
  category:    t.String(),
  tags:        t.Optional(t.String()),
  inventory:   t.String(),   // JSON: {"S":10,"M":5}
  merchantId:  t.String(),
});

const ImportProductsBody = t.Object({
  merchantId: t.String(),
  rows:       t.Array(ProductRowSchema, { minItems: 1 }),
});

export const buildImporterRoutes = async (layer: Layer.Layer<ImporterService>) => {
  const runtime = await bootRuntime(layer);
  const run = <A, E>(effect: Effect.Effect<A, E, ImporterService>): Promise<A> =>
    runtime.runPromise(effect);

  return new Elysia({ prefix: "/import" })
    .use(requireRole("admin"))

    // GET /import/jobs — list all jobs
    .get(
      "/jobs",
      () =>
        run(
          Effect.gen(function* () {
            const svc = yield* ImporterService;
            return yield* svc.listJobs();
          })
        )
    )

    // GET /import/jobs/:id — get specific job status
    .get(
      "/jobs/:id",
      ({ params, status }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* ImporterService;
            const job = yield* svc.getJob(params.id);
            return job ?? status(404, { error: "JobNotFound" });
          })
        ),
      { params: JobIdParam }
    )

    // POST /import/products — bulk import products via JSON
    .post(
      "/products",
      ({ body }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* ImporterService;
            return yield* svc.importProducts(body.rows, body.merchantId);
          })
        ),
      { body: ImportProductsBody }
    );
};
