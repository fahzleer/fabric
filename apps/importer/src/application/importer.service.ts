import { Context, Effect, Layer } from "effect";
import { Data } from "effect";
import { KafkaProducer } from "@fabric/kafka";

// ── Domain types ──────────────────────────────────────────────────────────────

export class ImportError extends Data.TaggedError("ImportError")<{
  readonly row:     number;
  readonly message: string;
}> {}

export type ImportStatus = "pending" | "processing" | "done" | "failed";

export interface ImportJob {
  readonly id:         string;
  readonly type:       "products" | "customers" | "inventory";
  readonly status:     ImportStatus;
  readonly totalRows:  number;
  readonly processed:  number;
  readonly errors:     Array<{ row: number; message: string }>;
  readonly startedAt:  string;
  readonly finishedAt: string | null;
}

export interface ProductRow {
  readonly name:        string;
  readonly description: string;
  readonly priceCents:  number;
  readonly currency?:   string;
  readonly category:    string;
  readonly tags?:       string;     // comma-separated
  readonly inventory:   string;     // JSON string: {"S":10,"M":5}
  readonly merchantId:  string;
}

// ── Job registry (in-memory) ──────────────────────────────────────────────────

const jobs = new Map<string, ImportJob>();

// ── Service ───────────────────────────────────────────────────────────────────

export interface ImporterServiceShape {
  readonly importProducts: (rows: ProductRow[], merchantId: string) => Effect.Effect<ImportJob, never>;
  readonly getJob:         (id: string) => Effect.Effect<ImportJob | null, never>;
  readonly listJobs:       () => Effect.Effect<ImportJob[], never>;
}

export class ImporterService extends Context.Tag(
  "@fabric/importer/ImporterService"
)<ImporterService, ImporterServiceShape>() {
  static readonly Default: Layer.Layer<ImporterService, never, KafkaProducer> =
    Layer.effect(
      ImporterService,
      Effect.gen(function* () {
        const producer = yield* KafkaProducer;

        return {
          importProducts: (rows, merchantId) =>
            Effect.gen(function* () {
              const jobId = crypto.randomUUID();
              const now   = new Date().toISOString();

              const job: ImportJob = {
                id:         jobId,
                type:       "products",
                status:     "processing",
                totalRows:  rows.length,
                processed:  0,
                errors:     [],
                startedAt:  now,
                finishedAt: null,
              };
              jobs.set(jobId, job);

              // Process rows — publish product.created events directly
              // The product service will upsert based on these events
              const errors: Array<{ row: number; message: string }> = [];
              let processed = 0;

              for (let i = 0; i < rows.length; i++) {
                const row = rows[i]!;
                try {
                  const inventory = JSON.parse(row.inventory) as Record<string, number>;
                  const event = {
                    _type:       "product.created" as const,
                    id:          crypto.randomUUID(),
                    name:        row.name,
                    description: row.description,
                    priceCents:  row.priceCents,
                    currency:    row.currency ?? "THB",
                    category:    row.category,
                    tags:        row.tags ? row.tags.split(",").map((t) => t.trim()) : [],
                    inventory,
                    imageUrls:   [],
                    createdAt:   now,
                  };
                  yield* producer
                    .publish("product.created", event, { key: event.id })
                    .pipe(Effect.catchAll(() => Effect.void));
                  processed++;
                } catch {
                  errors.push({ row: i + 1, message: `Invalid row data (row ${i + 1})` });
                }
              }

              const finished: ImportJob = {
                ...job,
                status:     errors.length === rows.length ? "failed" : "done",
                processed,
                errors,
                finishedAt: new Date().toISOString(),
              };
              jobs.set(jobId, finished);
              return finished;
            }),

          getJob: (id) =>
            Effect.sync(() => jobs.get(id) ?? null),

          listJobs: () =>
            Effect.sync(() => [...jobs.values()].sort((a, b) =>
              b.startedAt.localeCompare(a.startedAt)
            )),
        } satisfies ImporterServiceShape;
      })
    );
}
