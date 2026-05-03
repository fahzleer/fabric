import { Context, Effect, Layer } from "effect";
import { KafkaProducer } from "@fabric/kafka";
import {
  type Promotion,
  type PromotionId,
  type CouponCode,
  type DiscountType,
  PromotionNotFoundError,
  CouponExpiredError,
  CouponExhaustedError,
  MinimumOrderNotMetError,
  makePromotionId,
  isValid,
  calculateDiscount,
} from "../domain/promotion.ts";
import { PromotionRepository } from "../infrastructure/db/promotion.repository.ts";

const TOPIC = {
  APPLIED:  "promotion.applied",
  CREATED:  "promotion.created",
  DISABLED: "promotion.disabled",
} as const;

export interface CreatePromotionInput {
  readonly code:             string;
  readonly description:      string;
  readonly discountType:     DiscountType;
  readonly discountValue:    number;
  readonly minimumCents?:    number;
  readonly maxUsageTotal?:   number | null;
  readonly maxUsagePerUser?: number;
  readonly startsAt?:        string;
  readonly expiresAt?:       string | null;
}

export interface ApplyResult {
  readonly discountCents:  number;
  readonly finalCents:     number;
  readonly discountType:   DiscountType;
  readonly promotionCode:  CouponCode;
}

export interface PromotionServiceShape {
  readonly create:    (input: CreatePromotionInput) => Effect.Effect<Promotion, never>;
  readonly getByCode: (code: string) => Effect.Effect<Promotion, PromotionNotFoundError>;
  readonly apply:     (code: string, orderCents: number, userId: string) => Effect.Effect<ApplyResult, PromotionNotFoundError | CouponExpiredError | CouponExhaustedError | MinimumOrderNotMetError>;
  readonly disable:   (code: string) => Effect.Effect<Promotion, PromotionNotFoundError>;
  readonly listAll:   () => Effect.Effect<Promotion[], never>;
}

export class PromotionService extends Context.Tag(
  "@fabric/promotion/PromotionService"
)<PromotionService, PromotionServiceShape>() {
  static readonly Default: Layer.Layer<PromotionService, never, KafkaProducer | PromotionRepository> =
    Layer.effect(
      PromotionService,
      Effect.gen(function* () {
        const producer = yield* KafkaProducer;
        const repo     = yield* PromotionRepository;

        const publish = (topic: string, payload: unknown, key: string) =>
          producer.publish(topic, payload, { key }).pipe(Effect.catchAll(() => Effect.void));

        return {
          create: (input) =>
            Effect.gen(function* () {
              const now = new Date().toISOString();
              const promo: Promotion = {
                id:              makePromotionId(),
                code:            input.code.toUpperCase() as CouponCode,
                description:     input.description,
                discountType:    input.discountType,
                discountValue:   input.discountValue,
                minimumCents:    input.minimumCents ?? 0,
                maxUsageTotal:   input.maxUsageTotal ?? null,
                maxUsagePerUser: input.maxUsagePerUser ?? 1,
                usageCount:      0,
                startsAt:        input.startsAt ?? now,
                expiresAt:       input.expiresAt ?? null,
                isActive:        true,
                createdAt:       now,
                updatedAt:       now,
              };
              yield* repo.save(promo);
              yield* publish(TOPIC.CREATED, promo, promo.id);
              return promo;
            }),

          getByCode: (code) => repo.findByCode(code),

          apply: (code, orderCents, userId) =>
            Effect.gen(function* () {
              const promo = yield* repo.findByCode(code);
              const now   = new Date().toISOString();

              if (!isValid(promo, now)) {
                if (promo.expiresAt && promo.expiresAt < now) {
                  return yield* Effect.fail(new CouponExpiredError({ code: promo.code }));
                }
                return yield* Effect.fail(new CouponExhaustedError({ code: promo.code }));
              }

              if (orderCents < promo.minimumCents) {
                return yield* Effect.fail(
                  new MinimumOrderNotMetError({
                    code:         promo.code,
                    minimumCents: promo.minimumCents,
                    orderCents,
                  })
                );
              }

              const updated      = yield* repo.atomicIncrement(promo.code, now);
              const discountCents = calculateDiscount(updated, orderCents);

              yield* publish(TOPIC.APPLIED, {
                promotionId:  promo.id,
                code:         promo.code,
                userId,
                orderCents,
                discountCents,
                appliedAt:    now,
              }, promo.id);

              return {
                discountCents,
                finalCents:   Math.max(0, orderCents - discountCents),
                discountType:  promo.discountType,
                promotionCode: promo.code,
              } satisfies ApplyResult;
            }),

          disable: (code) =>
            Effect.gen(function* () {
              const promo   = yield* repo.findByCode(code);
              const updated = yield* repo.update({
                ...promo,
                isActive:  false,
                updatedAt: new Date().toISOString(),
              });
              yield* publish(TOPIC.DISABLED, updated, promo.id);
              return updated;
            }),

          listAll: () => repo.listAll(),
        } satisfies PromotionServiceShape;
      })
    );
}
