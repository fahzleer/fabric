export type Some<T> = { readonly _tag: "Some"; readonly value: T };
export type None = { readonly _tag: "None" };
export type Maybe<T> = Some<T> | None;

export const Some = <T>(value: T): Some<T> => ({ _tag: "Some", value });
export const None = <T = never>(): Maybe<T> => ({ _tag: "None" });

export const isSome = <T>(maybe: Maybe<T>): maybe is Some<T> => maybe._tag === "Some";

export const isNone = <T>(maybe: Maybe<T>): maybe is None => maybe._tag === "None";

export const mapMaybe = <T, U>(maybe: Maybe<T>, fn: (value: T) => U): Maybe<U> =>
  isSome(maybe) ? Some(fn(maybe.value)) : None<U>();

export const getOrElse = <T>(maybe: Maybe<T>, fallback: T): T =>
  isSome(maybe) ? maybe.value : fallback;

export type Ok<T> = { readonly _tag: "Ok"; readonly value: T };
export type Err<E> = { readonly _tag: "Err"; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const Ok = <T>(value: T): Ok<T> => ({ _tag: "Ok", value });
export const Err = <E>(error: E): Err<E> => ({ _tag: "Err", error });

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result._tag === "Ok";

export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => result._tag === "Err";

export const mapResult = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
  isOk(result) ? Ok(fn(result.value)) : result;

export const tryCatch = <T, E = unknown>(fn: () => T): Result<T, E> => {
  try {
    return Ok(fn());
  } catch (error) {
    return Err(error as E);
  }
};

export const tryCatchAsync = async <T, E = unknown>(
  fn: () => Promise<T>
): Promise<Result<T, E>> => {
  try {
    return Ok(await fn());
  } catch (error) {
    return Err(error as E);
  }
};

export type NonEmptyArray<T> = readonly [T, ...T[]];

export const isNonEmpty = <T>(arr: readonly T[]): arr is NonEmptyArray<T> => arr.length > 0;

export const makeNonEmpty = <T>(head: T, ...tail: T[]): NonEmptyArray<T> => [head, ...tail];

export type BrandedId<TBrand extends string> = {
  readonly __brand: TBrand;
  readonly value: string;
};

export const makeBrandedId = <TBrand extends string>(
  brand: TBrand,
  value: string
): BrandedId<TBrand> => ({ __brand: brand, value });

/**
 * Single source of truth for supported currencies — the runtime tuple drives
 * both the `CurrencyCode` type and the `isCurrencyCode` guard, so apps never
 * hand-roll their own divergent currency lists.
 */
export const CURRENCY_CODES = ["THB", "USD", "EUR", "GBP", "JPY", "SGD", "MYR"] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const isCurrencyCode = (code: string): code is CurrencyCode =>
  (CURRENCY_CODES as readonly string[]).includes(code);

export interface TaggedError<TTag extends string> {
  readonly _tag: TTag;
  readonly message: string;
}

export const isTaggedError = <TTag extends string>(
  value: unknown,
  tag: TTag
): value is TaggedError<TTag> =>
  typeof value === "object" &&
  value !== null &&
  "_tag" in value &&
  (value as Record<string, unknown>)._tag === tag &&
  "message" in value &&
  typeof (value as Record<string, unknown>).message === "string";
