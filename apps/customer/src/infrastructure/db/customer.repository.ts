import { Context, Effect, Layer } from "effect";
import { eq } from "drizzle-orm";
import { Database } from "./database.ts";
import { customers } from "./schema.ts";
import {
  type Customer,
  type CustomerId,
  type Email,
  type CustomerAddress,
  CustomerNotFoundError,
  EmailAlreadyExistsError,
} from "../../domain/customer.ts";

export interface CustomerRepositoryShape {
  readonly save:        (customer: Customer) => Effect.Effect<void, EmailAlreadyExistsError>;
  readonly findById:    (id: CustomerId) => Effect.Effect<Customer, CustomerNotFoundError>;
  readonly findByEmail: (email: Email) => Effect.Effect<Customer, CustomerNotFoundError>;
  readonly update:      (customer: Customer) => Effect.Effect<Customer, CustomerNotFoundError>;
}

export class CustomerRepository extends Context.Tag(
  "@fabric/customer/CustomerRepository"
)<CustomerRepository, CustomerRepositoryShape>() {
  static readonly Default: Layer.Layer<CustomerRepository, never, Database> =
    Layer.effect(
      CustomerRepository,
      Effect.gen(function* () {
        const db = yield* Database;

        const rowToCustomer = (row: typeof customers.$inferSelect): Customer => ({
          id:        row.id as CustomerId,
          email:     row.email as Email,
          firstName: row.firstName,
          lastName:  row.lastName,
          phone:     row.phone,
          address:   row.address as CustomerAddress | null,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        });

        return {
          save: (customer) =>
            Effect.tryPromise({
              try: () =>
                db.insert(customers).values({
                  id:        customer.id,
                  email:     customer.email,
                  firstName: customer.firstName,
                  lastName:  customer.lastName,
                  phone:     customer.phone,
                  address:   customer.address,
                  createdAt: customer.createdAt,
                  updatedAt: customer.updatedAt,
                }),
              catch: () =>
                new EmailAlreadyExistsError({ email: customer.email }),
            }).pipe(Effect.asVoid),

          findById: (id) =>
            Effect.tryPromise({
              try: () =>
                db.select().from(customers).where(eq(customers.id, id)).limit(1),
              catch: () => new CustomerNotFoundError({ customerId: id }),
            }).pipe(
              Effect.flatMap((rows) =>
                rows[0]
                  ? Effect.succeed(rowToCustomer(rows[0]))
                  : Effect.fail(new CustomerNotFoundError({ customerId: id }))
              )
            ),

          findByEmail: (email) =>
            Effect.tryPromise({
              try: () =>
                db.select().from(customers).where(eq(customers.email, email)).limit(1),
              catch: () =>
                new CustomerNotFoundError({ customerId: "" as CustomerId }),
            }).pipe(
              Effect.flatMap((rows) =>
                rows[0]
                  ? Effect.succeed(rowToCustomer(rows[0]))
                  : Effect.fail(
                      new CustomerNotFoundError({ customerId: "" as CustomerId })
                    )
              )
            ),

          update: (customer) =>
            Effect.tryPromise({
              try: () =>
                db
                  .update(customers)
                  .set({
                    firstName: customer.firstName,
                    lastName:  customer.lastName,
                    phone:     customer.phone,
                    address:   customer.address,
                    updatedAt: customer.updatedAt,
                  })
                  .where(eq(customers.id, customer.id))
                  .returning(),
              catch: () =>
                new CustomerNotFoundError({ customerId: customer.id }),
            }).pipe(
              Effect.flatMap((rows) =>
                rows[0]
                  ? Effect.succeed(rowToCustomer(rows[0]))
                  : Effect.fail(
                      new CustomerNotFoundError({ customerId: customer.id })
                    )
              )
            ),
        } satisfies CustomerRepositoryShape;
      })
    );
}
