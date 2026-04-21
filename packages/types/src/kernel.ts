export type Brand<T, K extends string> = T & { readonly __brand: K };

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

export type NonEmptyArray<T> = readonly [T, ...T[]];

export const isNonEmpty = <T>(arr: readonly T[]): arr is NonEmptyArray<T> => arr.length > 0;

export const makeNonEmpty = <T>(head: T, ...tail: T[]): NonEmptyArray<T> => [head, ...tail];

export type CurrencyCode = "THB" | "USD" | "EUR" | "GBP" | "JPY" | "SGD";

export interface TaggedError<TTag extends string> {
  readonly _tag: TTag;
  readonly message: string;
}
