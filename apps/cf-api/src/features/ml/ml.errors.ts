import { Either } from "effect";

export type MLError =
  | { readonly _tag: "InvalidInput"; readonly message: string }
  | { readonly _tag: "NoActiveChannels" };

export const MLError = {
  invalidInput: (message: string): MLError => ({ _tag: "InvalidInput", message }),
  noActiveChannels: (): MLError => ({ _tag: "NoActiveChannels" }),
} as const;

export const toHttpError = (err: MLError): { status: 400 | 422; body: { error: string } } => {
  switch (err._tag) {
    case "InvalidInput":
      return { status: 400, body: { error: err.message } };
    case "NoActiveChannels":
      return {
        status: 422,
        body: { error: "No active channels with matching-length non-zero spend data" },
      };
  }
};

export const eitherToResponse = <T>(
  result: Either.Either<T, MLError>
): { status: number; body: unknown } =>
  Either.isRight(result) ? { status: 200, body: result.right } : toHttpError(result.left);
