import { Effect, type Layer } from "effect";
import Elysia from "elysia";
import { bootRuntime } from "@fabric/effect-http";
import { SearchService } from "../application/search.service.ts";

export const buildSearchRoutes = async (layer: Layer.Layer<SearchService>) => {
  const runtime = await bootRuntime(layer);
  const run = <A, E>(effect: Effect.Effect<A, E, SearchService>): Promise<A> =>
    runtime.runPromise(effect);

  return new Elysia({ prefix: "/search" })

    // GET /search?q=shirt&category=clothing&minPrice=100&maxPrice=5000&limit=20&offset=0
    .get(
      "/",
      ({ query }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* SearchService;
            return yield* svc.search({
              q:        query["q"],
              category: query["category"],
              minPrice: query["minPrice"] ? Number(query["minPrice"]) : undefined,
              maxPrice: query["maxPrice"] ? Number(query["maxPrice"]) : undefined,
              limit:    query["limit"]    ? Number(query["limit"])    : undefined,
              offset:   query["offset"]   ? Number(query["offset"])   : undefined,
            });
          })
        )
    );
};
