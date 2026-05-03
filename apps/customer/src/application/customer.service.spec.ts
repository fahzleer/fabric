import { describe, it, expect } from "bun:test";
import { Effect, Layer } from "effect";
import { CustomerService } from "./customer.service.ts";
import { CustomerRepository, type CustomerRepositoryShape } from "../infrastructure/db/customer.repository.ts";
import { KafkaProducer, type KafkaProducerShape } from "@fabric/kafka";
import {
  type Customer,
  type CustomerId,
  type Email,
  CustomerNotFoundError,
  EmailAlreadyExistsError,
} from "../domain/customer.ts";

// ── Test doubles ──────────────────────────────────────────────────────────────

const makeInMemoryRepo = (): CustomerRepositoryShape => {
  const byId    = new Map<string, Customer>();
  const byEmail = new Map<string, Customer>();

  return {
    save: (customer) =>
      Effect.suspend(() => {
        if (byEmail.has(customer.email)) {
          return Effect.fail(new EmailAlreadyExistsError({ email: customer.email }));
        }
        byId.set(customer.id, customer);
        byEmail.set(customer.email, customer);
        return Effect.void;
      }),

    findById: (id) =>
      Effect.suspend(() => {
        const c = byId.get(id);
        return c
          ? Effect.succeed(c)
          : Effect.fail(new CustomerNotFoundError({ customerId: id }));
      }),

    findByEmail: (email) =>
      Effect.suspend(() => {
        const c = byEmail.get(email);
        return c
          ? Effect.succeed(c)
          : Effect.fail(new CustomerNotFoundError({ customerId: "" as CustomerId }));
      }),

    update: (customer) =>
      Effect.suspend(() => {
        if (!byId.has(customer.id)) {
          return Effect.fail(new CustomerNotFoundError({ customerId: customer.id }));
        }
        byId.set(customer.id, customer);
        byEmail.set(customer.email, customer);
        return Effect.succeed(customer);
      }),
  };
};

const silentProducer = (): KafkaProducerShape => ({
  publish:      () => Effect.void,
  publishBatch: () => Effect.void,
});

const makeTestLayer = () =>
  CustomerService.Default.pipe(
    Layer.provide(Layer.succeed(CustomerRepository, makeInMemoryRepo())),
    Layer.provide(Layer.succeed(KafkaProducer, silentProducer()))
  );

const run = <A, E>(effect: Effect.Effect<A, E, CustomerService>) =>
  Effect.runPromise(Effect.provide(effect, makeTestLayer()));

const runEither = <A, E>(effect: Effect.Effect<A, E, CustomerService>) =>
  Effect.runPromise(Effect.provide(effect, makeTestLayer()).pipe(Effect.either));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CustomerService", () => {
  describe("register", () => {
    it("creates a customer with valid email", async () => {
      const c = await run(
        Effect.gen(function* () {
          const svc = yield* CustomerService;
          return yield* svc.register({
            email:     "test@example.com",
            firstName: "Saifah",
            lastName:  "Dev",
          });
        })
      );
      expect(c.email as string).toBe("test@example.com");
      expect(c.firstName).toBe("Saifah");
      expect(c.id).toBeTruthy();
    });

    it("normalises email to lowercase", async () => {
      const c = await run(
        Effect.gen(function* () {
          const svc = yield* CustomerService;
          return yield* svc.register({
            email:     "TEST@EXAMPLE.COM",
            firstName: "A",
            lastName:  "B",
          });
        })
      );
      expect(c.email as string).toBe("test@example.com");
    });

    it("fails with InvalidEmailError for bad email", async () => {
      const result = await runEither(
        Effect.gen(function* () {
          const svc = yield* CustomerService;
          return yield* svc.register({ email: "not-an-email", firstName: "A", lastName: "B" });
        })
      );
      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect((result.left as { _tag: string })._tag).toBe("InvalidEmailError");
      }
    });

    it("fails with EmailAlreadyExistsError on duplicate", async () => {
      const layer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* CustomerService;
          yield* svc.register({ email: "dup@example.com", firstName: "A", lastName: "B" });
          return yield* svc.register({ email: "dup@example.com", firstName: "C", lastName: "D" });
        }).pipe(Effect.provide(layer), Effect.either)
      );
      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect((result.left as { _tag: string })._tag).toBe("EmailAlreadyExistsError");
      }
    });
  });

  describe("getById", () => {
    it("returns existing customer", async () => {
      const layer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* CustomerService;
          const created = yield* svc.register({ email: "a@b.com", firstName: "A", lastName: "B" });
          return yield* svc.getById(created.id);
        }).pipe(Effect.provide(layer))
      );
      expect(result.email as string).toBe("a@b.com");
    });

    it("fails with CustomerNotFoundError for unknown id", async () => {
      const result = await runEither(
        Effect.gen(function* () {
          const svc = yield* CustomerService;
          return yield* svc.getById("no-such-id" as CustomerId);
        })
      );
      expect(result._tag).toBe("Left");
    });
  });

  describe("update", () => {
    it("updates fields correctly", async () => {
      const layer = makeTestLayer();
      const updated = await Effect.runPromise(
        Effect.gen(function* () {
          const svc     = yield* CustomerService;
          const created = yield* svc.register({ email: "up@date.com", firstName: "Old", lastName: "Name" });
          return yield* svc.update(created.id, { firstName: "New", phone: "0812345678" });
        }).pipe(Effect.provide(layer))
      );
      expect(updated.firstName).toBe("New");
      expect(updated.phone).toBe("0812345678");
      expect(updated.lastName).toBe("Name"); // unchanged
    });
  });

  describe("getByEmail", () => {
    it("finds customer by email", async () => {
      const layer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* CustomerService;
          yield* svc.register({ email: "find@me.com", firstName: "Find", lastName: "Me" });
          return yield* svc.getByEmail("find@me.com");
        }).pipe(Effect.provide(layer))
      );
      expect(result.firstName).toBe("Find");
    });

    it("fails with InvalidEmailError for malformed email", async () => {
      const result = await runEither(
        Effect.gen(function* () {
          const svc = yield* CustomerService;
          return yield* svc.getByEmail("not-valid");
        })
      );
      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect((result.left as { _tag: string })._tag).toBe("InvalidEmailError");
      }
    });
  });
});
