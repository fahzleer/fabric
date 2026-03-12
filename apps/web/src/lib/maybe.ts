export type Some<T> = { readonly _tag: "Some"; readonly value: T };
export type None = { readonly _tag: "None" };
export type Maybe<T> = Some<T> | None;

export const Some = <T>(value: T): Some<T> => ({ _tag: "Some", value });
export const None = <T = never>(): Maybe<T> => ({ _tag: "None" });
export const isSome = <T>(maybe: Maybe<T>): maybe is Some<T> => maybe._tag === "Some";
export const isNone = <T>(maybe: Maybe<T>): maybe is None => maybe._tag === "None";
export const getOrElse = <T>(maybe: Maybe<T>, fallback: T): T =>
  isSome(maybe) ? maybe.value : fallback;
export const mapMaybe = <T, U>(maybe: Maybe<T>, fn: (value: T) => U): Maybe<U> =>
  isSome(maybe) ? Some(fn(maybe.value)) : None<U>();
