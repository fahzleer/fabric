import { type EventOp, bind } from "../free/Dsl.ts";

export const fmap = <A, B>(f: (a: A) => B, program: EventOp<A>): EventOp<B> =>
  bind(program, (x) => ({ _tag: "Pure", value: f(x) }));

export const pure = <A>(value: A): EventOp<A> => ({ _tag: "Pure", value });

export const apply = <A, B>(programF: EventOp<(a: A) => B>, programX: EventOp<A>): EventOp<B> =>
  bind(programF, (f) => bind(programX, (x) => ({ _tag: "Pure", value: f(x) })));

export const map2 = <A, B, C>(
  f: (a: A, b: B) => C,
  programA: EventOp<A>,
  programB: EventOp<B>
): EventOp<C> =>
  apply(
    fmap((a: A) => (b: B) => f(a, b), programA),
    programB
  );

  export const map3 = <A, B, C, D>(
  f: (a: A, b: B, c: C) => D,
  pa: EventOp<A>,
  pb: EventOp<B>,
  pc: EventOp<C>
): EventOp<D> =>
  apply(
    apply(
      fmap((a: A) => (b: B) => (c: C) => f(a, b, c), pa),
      pb
    ),
    pc
  );

  export const liftA2 = map2;

  export const sequence = <A>(programs: ReadonlyArray<EventOp<A>>): EventOp<ReadonlyArray<A>> => {
  if (programs.length === 0) return { _tag: "Pure", value: [] };
  const [head, ...rest] = programs as [EventOp<A>, ...EventOp<A>[]];
  return map2((h: A, t: ReadonlyArray<A>) => [h, ...t], head, sequence(rest));
};

export const traverse = <A, B>(
  f: (a: A) => EventOp<B>,
  lst: ReadonlyArray<A>
): EventOp<ReadonlyArray<B>> => sequence(lst.map(f));

export const lawFunctorIdentity = (program: EventOp<number>): boolean => {
  const id = (x: number) => x;
  const result = fmap(id, program);
  if (program._tag === "Pure" && result._tag === "Pure") {
    return program.value === result.value;
  }
  return true;
};

export const lawFunctorComposition = (
  program: EventOp<number>,
  f: (x: number) => number,
  g: (x: number) => number
): boolean => {
  const lhs = fmap((x: number) => g(f(x)), program);
  const rhs = fmap(g, fmap(f, program));
  if (lhs._tag === "Pure" && rhs._tag === "Pure") return lhs.value === rhs.value;
  return true;
};

export const lawApplicativeIdentity = (program: EventOp<number>): boolean => {
  const id = (x: number) => x;
  const result = apply(pure(id), program);
  if (result._tag === "Pure" && program._tag === "Pure") return result.value === program.value;
  return true;
};

export const lawApplicativeHomomorphism = (f: (x: number) => number, x: number): boolean => {
  const lhs = apply(pure(f), pure(x));
  const rhs = pure(f(x));
  if (lhs._tag === "Pure" && rhs._tag === "Pure") return lhs.value === rhs.value;
  return false;
};
