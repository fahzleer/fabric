import { Context, Effect, Layer } from "effect";
import { KafkaProducer } from "@fabric/kafka";
import {
  type Customer,
  type CustomerId,
  type Email,
  type CustomerAddress,
  CustomerNotFoundError,
  EmailAlreadyExistsError,
  InvalidEmailError,
  makeCustomerId,
  validateEmail,
} from "../domain/customer.ts";
import { CustomerRepository } from "../infrastructure/db/customer.repository.ts";

// ── Kafka topics ──────────────────────────────────────────────────────────────

const TOPIC = {
  REGISTERED: "customer.registered",
  UPDATED:    "customer.updated",
} as const;

// ── Service Shape ─────────────────────────────────────────────────────────────

export interface RegisterCustomerInput {
  readonly email:     string;
  readonly firstName: string;
  readonly lastName:  string;
  readonly phone?:    string;
}

export interface UpdateCustomerInput {
  readonly firstName?: string;
  readonly lastName?:  string;
  readonly phone?:     string;
  readonly address?:   CustomerAddress | null;
}

export interface CustomerServiceShape {
  readonly register:     (input: RegisterCustomerInput) => Effect.Effect<Customer, InvalidEmailError | EmailAlreadyExistsError>;
  readonly getById:      (id: CustomerId) => Effect.Effect<Customer, CustomerNotFoundError>;
  readonly getByEmail:   (email: string) => Effect.Effect<Customer, InvalidEmailError | CustomerNotFoundError>;
  readonly update:       (id: CustomerId, input: UpdateCustomerInput) => Effect.Effect<Customer, CustomerNotFoundError>;
}

// ── Service Tag ───────────────────────────────────────────────────────────────

export class CustomerService extends Context.Tag(
  "@fabric/customer/CustomerService"
)<CustomerService, CustomerServiceShape>() {
  static readonly Default: Layer.Layer<
    CustomerService,
    never,
    CustomerRepository | KafkaProducer
  > = Layer.effect(
    CustomerService,
    Effect.gen(function* () {
      const repo     = yield* CustomerRepository;
      const producer = yield* KafkaProducer;

      return {
        register: (input) =>
          Effect.gen(function* () {
            const email = validateEmail(input.email);
            if (!email) {
              return yield* Effect.fail(
                new InvalidEmailError({ email: input.email })
              );
            }
            const now      = new Date().toISOString();
            const customer: Customer = {
              id:        makeCustomerId(),
              email,
              firstName: input.firstName,
              lastName:  input.lastName,
              phone:     input.phone ?? "",
              address:   null,
              createdAt: now,
              updatedAt: now,
            };
            yield* repo.save(customer);
            yield* producer
              .publish(TOPIC.REGISTERED, customer, { key: customer.id })
              .pipe(Effect.catchAll(() => Effect.void));
            return customer;
          }),

        getById: (id) => repo.findById(id),

        getByEmail: (raw) =>
          Effect.gen(function* () {
            const email = validateEmail(raw);
            if (!email) {
              return yield* Effect.fail(new InvalidEmailError({ email: raw }));
            }
            return yield* repo.findByEmail(email);
          }),

        update: (id, input) =>
          Effect.gen(function* () {
            const existing = yield* repo.findById(id);
            const updated: Customer = {
              ...existing,
              firstName: input.firstName ?? existing.firstName,
              lastName:  input.lastName  ?? existing.lastName,
              phone:     input.phone     ?? existing.phone,
              address:   input.address !== undefined ? input.address : existing.address,
              updatedAt: new Date().toISOString(),
            };
            const saved = yield* repo.update(updated);
            yield* producer
              .publish(TOPIC.UPDATED, saved, { key: id })
              .pipe(Effect.catchAll(() => Effect.void));
            return saved;
          }),
      } satisfies CustomerServiceShape;
    })
  );
}
