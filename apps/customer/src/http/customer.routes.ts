import { Effect, type Layer } from "effect";
import Elysia, { t } from "elysia";
import { bootRuntime } from "@fabric/effect-http";
import { requireAuth } from "@fabric/auth";
import { type CustomerId } from "../domain/customer.ts";
import { CustomerService } from "../application/customer.service.ts";

const CustomerIdParam = t.Object({ id: t.String() });

const RegisterBody = t.Object({
  email:     t.String({ format: "email" }),
  firstName: t.String({ minLength: 1 }),
  lastName:  t.String({ minLength: 1 }),
  phone:     t.Optional(t.String()),
});

const UpdateBody = t.Object({
  firstName: t.Optional(t.String()),
  lastName:  t.Optional(t.String()),
  phone:     t.Optional(t.String()),
  address:   t.Optional(
    t.Nullable(
      t.Object({
        street:     t.String(),
        city:       t.String(),
        province:   t.String(),
        postalCode: t.String(),
        country:    t.String(),
      })
    )
  ),
});

export const buildCustomerRoutes = async (layer: Layer.Layer<CustomerService>) => {
  const runtime = await bootRuntime(layer);
  const run = <A, E>(effect: Effect.Effect<A, E, CustomerService>): Promise<A> =>
    runtime.runPromise(effect);

  // POST /customers — public registration
  const publicRoutes = new Elysia({ prefix: "/customers" })
    .post(
      "/",
      ({ body, status }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* CustomerService;
            return yield* svc.register(body);
          }).pipe(
            Effect.catchTag("InvalidEmailError", () =>
              Effect.sync(() => status(400, { error: "InvalidEmail" }))
            ),
            Effect.catchTag("EmailAlreadyExistsError", (e) =>
              Effect.sync(() =>
                status(409, { error: "EmailAlreadyExists", email: e.email })
              )
            )
          )
        ),
      { body: RegisterBody }
    );

  // GET/PATCH /customers/:id — require auth; users can only access their own profile
  const authRoutes = new Elysia({ prefix: "/customers" })
    .use(requireAuth())

    .get(
      "/:id",
      ({ params, userId, role, status }) => {
        if (params.id !== userId && role !== "admin") {
          return status(403, { error: "Forbidden" });
        }
        return run(
          Effect.gen(function* () {
            const svc = yield* CustomerService;
            return yield* svc.getById(params.id as CustomerId);
          }).pipe(
            Effect.catchTag("CustomerNotFoundError", () =>
              Effect.sync(() => status(404, { error: "CustomerNotFound" }))
            )
          )
        );
      },
      { params: CustomerIdParam }
    )

    .patch(
      "/:id",
      ({ params, body, userId, role, status }) => {
        if (params.id !== userId && role !== "admin") {
          return status(403, { error: "Forbidden" });
        }
        return run(
          Effect.gen(function* () {
            const svc = yield* CustomerService;
            return yield* svc.update(params.id as CustomerId, body);
          }).pipe(
            Effect.catchTag("CustomerNotFoundError", () =>
              Effect.sync(() => status(404, { error: "CustomerNotFound" }))
            )
          )
        );
      },
      { params: CustomerIdParam, body: UpdateBody }
    );

  return new Elysia().use(publicRoutes).use(authRoutes);
};
