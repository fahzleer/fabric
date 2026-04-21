import { type } from "arktype";
import { Result } from "better-result";

export class EnvValidationError extends Error {
  readonly _tag = "EnvValidationError" as const;
  constructor(
    message: string,
    readonly issues: readonly string[]
  ) {
    super(message);
    this.name = "EnvValidationError";
  }
}

export type EnvSource = Record<string, string | undefined>;

export function parseEnv<T extends type<unknown>>(
  schema: T,
  source: EnvSource = process.env as EnvSource
) {
  type Out = T["infer"];
  const out = schema(source);
  if (out instanceof type.errors) {
    return Result.err<Out, EnvValidationError>(
      new EnvValidationError("Invalid environment", out.summary.split("\n"))
    );
  }
  return Result.ok<Out, EnvValidationError>(out as Out);
}

export const pasetoKey = type("/^[0-9a-fA-F]{64}$/").describe(
  "PASETO_KEY must be 64 hex chars (32 bytes)"
);

export const nonEmpty = type("string > 0").describe("must be a non-empty string");

export const httpUrl = type("string.url").narrow((s, ctx) =>
  /^https?:\/\//.test(s) ? true : ctx.mustBe("an http(s) URL")
);

export const portNumber = type("string.integer.parse").narrow((n, ctx) =>
  n >= 1 && n <= 65535 ? true : ctx.mustBe("a port 1–65535")
);

export const positiveInt = type("string.integer.parse").narrow((n, ctx) =>
  n > 0 ? true : ctx.mustBe("a positive integer")
);
