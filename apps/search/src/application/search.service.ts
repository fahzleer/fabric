import { Context, Effect, Layer } from "effect";
import postgres from "postgres";

// ── Service Shape ─────────────────────────────────────────────────────────────

export interface SearchQuery {
  readonly q?:        string;
  readonly category?: string;
  readonly minPrice?: number;
  readonly maxPrice?: number;
  readonly limit?:    number;
  readonly offset?:   number;
}

interface SearchProduct {
  readonly id:          string;
  readonly name:        string;
  readonly description: string;
  readonly category:    string;
  readonly tags:        string[];
  readonly priceCents:  number;
  readonly currency:    string;
  readonly isActive:    boolean;
  readonly imageUrls:   string[];
}

export interface SearchResult {
  readonly items:  SearchProduct[];
  readonly total:  number;
  readonly offset: number;
  readonly limit:  number;
}

export interface SearchServiceShape {
  readonly search:        (query: SearchQuery) => Effect.Effect<SearchResult, never>;
  readonly startIndexing: () => Effect.Effect<void, never>;
}

export class SearchService extends Context.Tag(
  "@fabric/search/SearchService"
)<SearchService, SearchServiceShape>() {
  static readonly Default: Layer.Layer<SearchService> =
    Layer.effect(
      SearchService,
      Effect.gen(function* () {
        const connectionString =
          process.env["PRODUCT_DATABASE_URL"] ??
          "postgresql://postgres:postgres@localhost:5432/fabric_products";

        const sql = postgres(connectionString, {
          max:            5,
          idle_timeout:   30,
          connect_timeout: 10,
        });

        // ── Search via PostgreSQL tsvector ────────────────────────────────────

        const search = (query: SearchQuery): Effect.Effect<SearchResult, never> =>
          Effect.tryPromise({
            try: async () => {
              const limit  = Math.min(query.limit  ?? 20, 100);
              const offset = query.offset ?? 0;

              // Build dynamic WHERE clauses
              const conditions: postgres.PendingQuery<postgres.Row[]>[] = [
                sql`is_active = TRUE`,
              ];

              if (query.category) {
                conditions.push(sql`category = ${query.category}`);
              }
              if (query.minPrice !== undefined) {
                conditions.push(sql`price_cents >= ${query.minPrice}`);
              }
              if (query.maxPrice !== undefined) {
                conditions.push(sql`price_cents <= ${query.maxPrice}`);
              }
              if (query.q) {
                conditions.push(
                  sql`search_vector @@ plainto_tsquery('simple', ${query.q})`
                );
              }

              const where = conditions.reduce(
                (acc, cond) => sql`${acc} AND ${cond}`
              );

              const orderBy = query.q
                ? sql`ts_rank(search_vector, plainto_tsquery('simple', ${query.q})) DESC, updated_at DESC`
                : sql`updated_at DESC`;

              const [rows, countRows] = await Promise.all([
                sql<{
                  id: string; name: string; description: string; category: string;
                  tags: string[]; price_cents: number; currency: string;
                  is_active: boolean; image_urls: string[];
                }[]>`
                  SELECT id, name, description, category, tags, price_cents,
                         currency, is_active, image_urls
                  FROM   products
                  WHERE  ${where}
                  ORDER BY ${orderBy}
                  LIMIT  ${limit}
                  OFFSET ${offset}
                `,
                sql<{ count: string }[]>`
                  SELECT COUNT(*)::text AS count
                  FROM   products
                  WHERE  ${where}
                `,
              ]);

              const items: SearchProduct[] = rows.map((r) => ({
                id:          r.id,
                name:        r.name,
                description: r.description,
                category:    r.category,
                tags:        Array.isArray(r.tags) ? r.tags : [],
                priceCents:  r.price_cents,
                currency:    r.currency,
                isActive:    r.is_active,
                imageUrls:   Array.isArray(r.image_urls) ? r.image_urls : [],
              }));

              return {
                items,
                total:  Number(countRows[0]?.count ?? 0),
                offset,
                limit,
              };
            },
            catch: (e) => e,
          }).pipe(
            Effect.catchAll((e) =>
              Effect.sync(() => {
                console.error("[search] query error:", e);
                return { items: [], total: 0, offset: query.offset ?? 0, limit: query.limit ?? 20 };
              })
            )
          );

        return {
          search,
          // No background indexing needed — queries go straight to the DB.
          // The product service keeps the products table (and its tsvector column) up-to-date.
          startIndexing: () => Effect.sync(() => {
            console.info("[search] PostgreSQL tsvector mode — no background indexing required");
          }),
        } satisfies SearchServiceShape;
      })
    );
}
