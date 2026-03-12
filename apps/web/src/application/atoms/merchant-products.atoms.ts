import type { MerchantProduct } from "@/lib/merchant-api";
import { Atom } from "@effect-atom/atom-react";
import { Effect, Stream } from "effect";

export const merchantAllProductsAtom = Atom.keepAlive(Atom.make<MerchantProduct[]>([]));

export const merchantStreamAtom = Atom.fn(
  (query: string, get): Stream.Stream<MerchantProduct[], never, never> => {
    const products = get(merchantAllProductsAtom);
    return Stream.fromIterable(products).pipe(
      Stream.filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase())),
      Stream.tap(() => Effect.sleep("60 millis")),
      Stream.scan([] as MerchantProduct[], (acc, p) => [...acc, p])
    );
  }
);

export const PAGE_SIZE = 5;

export const merchantPageAtom = Atom.pull<MerchantProduct, never>((get) => {
  const products = get(merchantAllProductsAtom);
  return Stream.fromIterable(products).pipe(
    Stream.tap(() => Effect.sleep("350 millis")),
    Stream.rechunk(PAGE_SIZE)
  );
});

export type ProductFilterArg = {
  readonly query: string;
  readonly category: string;
  readonly status: string;
};

export const merchantManualResultsAtom = Atom.make<MerchantProduct[]>([]);

export const merchantSearchAtom = Atom.fn<ProductFilterArg>()(({ query, category, status }, get) =>
  Effect.gen(function* () {
    get.set(merchantManualResultsAtom, []);

    const products = get(merchantAllProductsAtom);
    const filtered = products.filter((p) => {
      const matchesQuery = query === "" || p.name.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = category === "all" || p.category === category;
      const matchesStatus = status === "all" || p.status === status;
      return matchesQuery && matchesCategory && matchesStatus;
    });

    yield* Stream.fromIterable(filtered).pipe(
      Stream.tap(() => Effect.sleep("30 millis")),
      Stream.runForEach((product) =>
        Effect.sync(() => {
          const current = get(merchantManualResultsAtom);
          get.set(merchantManualResultsAtom, [...current, product]);
        })
      )
    );
  })
);
