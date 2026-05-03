import { Context, Effect, Layer } from "effect";
import { eq, isNull, or, sql, and } from "drizzle-orm";
import { Database } from "./database.ts";
import { promotions } from "./schema.ts";
import {
  type Promotion,
  type PromotionId,
  type CouponCode,
  type DiscountType,
  PromotionNotFoundError,
  CouponExhaustedError,
} from "../../domain/promotion.ts";

export interface PromotionRepositoryShape {
  readonly save:             (promo: Promotion) => Effect.Effect<void, never>;
  readonly findByCode:       (code: string) => Effect.Effect<Promotion, PromotionNotFoundError>;
  readonly update:           (promo: Promotion) => Effect.Effect<Promotion, PromotionNotFoundError>;
  readonly atomicIncrement:  (code: string, now: string) => Effect.Effect<Promotion, PromotionNotFoundError | CouponExhaustedError>;
  readonly listAll:          () => Effect.Effect<Promotion[], never>;
}

export class PromotionRepository extends Context.Tag(
  "@fabric/promotion/PromotionRepository"
)<PromotionRepository, PromotionRepositoryShape>() {
  static readonly Default: Layer.Layer<PromotionRepository, never, Database> =
    Layer.effect(
      PromotionRepository,
      Effect.gen(function* () {
        const db = yield* Database;

        const rowToPromotion = (row: typeof promotions.$inferSelect): Promotion => ({
          id:              row.id as PromotionId,
          code:            row.code as CouponCode,
          description:     row.description,
          discountType:    row.discountType as DiscountType,
          discountValue:   row.discountValue,
          minimumCents:    row.minimumCents,
          maxUsageTotal:   row.maxUsageTotal,
          maxUsagePerUser: row.maxUsagePerUser,
          usageCount:      row.usageCount,
          startsAt:        row.startsAt,
          expiresAt:       row.expiresAt,
          isActive:        row.isActive,
          createdAt:       row.createdAt,
          updatedAt:       row.updatedAt,
        });

        return {
          save: (promo) =>
            Effect.tryPromise({
              try: () =>
                db.insert(promotions).values({
                  id:              promo.id,
                  code:            promo.code,
                  description:     promo.description,
                  discountType:    promo.discountType,
                  discountValue:   promo.discountValue,
                  minimumCents:    promo.minimumCents,
                  maxUsageTotal:   promo.maxUsageTotal,
                  maxUsagePerUser: promo.maxUsagePerUser,
                  usageCount:      promo.usageCount,
                  startsAt:        promo.startsAt,
                  expiresAt:       promo.expiresAt,
                  isActive:        promo.isActive,
                  createdAt:       promo.createdAt,
                  updatedAt:       promo.updatedAt,
                }),
              catch: () => new Error("insert failed"),
            }).pipe(Effect.asVoid, Effect.orDie),

          findByCode: (code) =>
            Effect.tryPromise({
              try: () =>
                db
                  .select()
                  .from(promotions)
                  .where(eq(promotions.code, code.toUpperCase()))
                  .limit(1),
              catch: () =>
                new PromotionNotFoundError({ code: code.toUpperCase() as CouponCode }),
            }).pipe(
              Effect.flatMap((rows) =>
                rows[0]
                  ? Effect.succeed(rowToPromotion(rows[0]))
                  : Effect.fail(
                      new PromotionNotFoundError({ code: code.toUpperCase() as CouponCode })
                    )
              )
            ),

          update: (promo) =>
            Effect.tryPromise({
              try: () =>
                db
                  .update(promotions)
                  .set({
                    description:     promo.description,
                    isActive:        promo.isActive,
                    usageCount:      promo.usageCount,
                    updatedAt:       promo.updatedAt,
                  })
                  .where(eq(promotions.code, promo.code))
                  .returning(),
              catch: () =>
                new PromotionNotFoundError({ code: promo.code }),
            }).pipe(
              Effect.flatMap((rows) =>
                rows[0]
                  ? Effect.succeed(rowToPromotion(rows[0]))
                  : Effect.fail(new PromotionNotFoundError({ code: promo.code }))
              )
            ),

          atomicIncrement: (code, now) =>
            Effect.tryPromise({
              try: () =>
                db
                  .update(promotions)
                  .set({
                    usageCount: sql`${promotions.usageCount} + 1`,
                    updatedAt:  now,
                  })
                  .where(
                    and(
                      eq(promotions.code, code.toUpperCase()),
                      eq(promotions.isActive, true),
                      or(
                        isNull(promotions.maxUsageTotal),
                        sql`${promotions.usageCount} < ${promotions.maxUsageTotal}`
                      )
                    )
                  )
                  .returning(),
              catch: () =>
                new CouponExhaustedError({ code: code.toUpperCase() as CouponCode }),
            }).pipe(
              Effect.flatMap((rows) =>
                rows[0]
                  ? Effect.succeed(rowToPromotion(rows[0]))
                  : Effect.fail(
                      new CouponExhaustedError({ code: code.toUpperCase() as CouponCode })
                    )
              )
            ),

          listAll: () =>
            Effect.tryPromise({
              try: () => db.select().from(promotions),
              catch: () => new Error("listAll failed"),
            }).pipe(
              Effect.map((rows) => rows.map(rowToPromotion)),
              Effect.orDie
            ),
        } satisfies PromotionRepositoryShape;
      })
    );
}
