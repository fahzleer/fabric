import { Data } from "effect";

// ── Value Objects ─────────────────────────────────────────────────────────────

export type CustomerId = string & { readonly _brand: "CustomerId" };
export type Email      = string & { readonly _brand: "Email" };

export const makeCustomerId = (): CustomerId => crypto.randomUUID() as CustomerId;

// ── Domain Errors ─────────────────────────────────────────────────────────────

export class CustomerNotFoundError extends Data.TaggedError("CustomerNotFoundError")<{
  readonly customerId: CustomerId;
}> {}

export class EmailAlreadyExistsError extends Data.TaggedError("EmailAlreadyExistsError")<{
  readonly email: Email;
}> {}

export class InvalidEmailError extends Data.TaggedError("InvalidEmailError")<{
  readonly email: string;
}> {}

// ── Aggregate ─────────────────────────────────────────────────────────────────

export interface CustomerAddress {
  readonly street:     string;
  readonly city:       string;
  readonly province:   string;
  readonly postalCode: string;
  readonly country:    string;
}

export interface Customer {
  readonly id:          CustomerId;
  readonly email:       Email;
  readonly firstName:   string;
  readonly lastName:    string;
  readonly phone:       string;
  readonly address:     CustomerAddress | null;
  readonly createdAt:   string;
  readonly updatedAt:   string;
}

// ── Domain Logic ──────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateEmail = (raw: string): Email | null =>
  EMAIL_RE.test(raw) ? (raw.toLowerCase() as Email) : null;
