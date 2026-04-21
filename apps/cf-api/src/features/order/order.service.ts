import type { NonEmptyArray, PaymentMethod } from "@fabric/types";
import { makePriceChangedError } from "@fabric/types";
import { None } from "@fabric/types";
import { Temporal } from "@js-temporal/polyfill";
import BigNumber from "bignumber.js";
import type { ActivityRepositoryPort } from "../../application/ports/activity.repository.port";
import type { CartRepositoryPort } from "../../application/ports/cart.repository.port";
import type { EventPublisherPort } from "../../application/ports/event-publisher.port";
import type { MerchantRepositoryPort } from "../../application/ports/merchant.repository.port";
import type { OrderRepositoryPort } from "../../application/ports/order.repository.port";
import type { PaymentPort } from "../../application/ports/payment.port";
import type {
  CheckoutCalculation,
  PricingPort,
  VoucherForRoc,
} from "../../application/ports/pricing.port";
import type { ProductRepositoryPort } from "../../application/ports/product.repository.port";
import type { PaginationInput } from "../../application/ports/product.repository.port";
import type { VoucherRepositoryPort } from "../../application/ports/voucher.repository.port";
import { clearCart } from "../../domain/cart/cart.entity";
import type { CartItem } from "../../domain/cart/cart.entity";
import type { CartId } from "../../domain/cart/cart.value-objects";
import { transitionOrderStatus } from "../../domain/order/order.entity";
import type { Order, OrderLine } from "../../domain/order/order.entity";
import type { OrderId, ShippingAddress } from "../../domain/order/order.value-objects";
import type { UserId } from "../../domain/user/user.value-objects";
import { log } from "../../infrastructure/monitoring/logger";
import { presentDomainError } from "../shared/http-error.presenter";

export type CheckoutPreview = CheckoutCalculation & {
  taxCents: number;
  voucherError: string | null;
};

export class OrderService {
  constructor(
    private readonly orderRepo: OrderRepositoryPort,
    private readonly cartRepo: CartRepositoryPort,
    private readonly payment: PaymentPort,
    private readonly productRepo: ProductRepositoryPort,
    private readonly pricing: PricingPort,
    private readonly voucherRepo: VoucherRepositoryPort,
    private readonly eventPublisher: EventPublisherPort,
    private readonly activity: ActivityRepositoryPort,
    private readonly merchantRepo: MerchantRepositoryPort
  ) {}

  async previewCheckout(
    userId: UserId,
    cartId: string,
    country: string,
    province: string,
    voucherCode?: string
  ): Promise<CheckoutPreview> {
    const cartResult = await this.resolveCart(userId, cartId);
    if (cartResult._tag === "Err") return presentDomainError(cartResult.error);
    const cart = cartResult.value;
    if (cart.items.length === 0)
      return presentDomainError({ _tag: "EmptyOrderError", message: "Cart is empty" });

    const currency = cart.items[0]?.unitPrice.currency ?? "THB";
    const shippingAddress = { country, province };
    const toPreview = (
      calc: CheckoutCalculation,
      voucherError: string | null
    ): CheckoutPreview => ({
      ...calc,
      taxCents: Math.max(
        0,
        calc.totalCents - (calc.subtotalCents - calc.discountCents + calc.shippingCents)
      ),
      voucherError,
    });

    const resolvedVoucher = await this.resolveVoucher(voucherCode);
    if (voucherCode && resolvedVoucher === undefined) {
      const retryResult = await this.pricing.calculateCheckout(
        cart.items,
        undefined,
        shippingAddress,
        currency
      );
      const calc =
        retryResult._tag === "Ok"
          ? retryResult.value
          : this.subtotalOnlyFallback(cart.items, currency);
      return toPreview(calc, `Voucher "${voucherCode}" was not found`);
    }

    const result = await this.pricing.calculateCheckout(
      cart.items,
      resolvedVoucher,
      shippingAddress,
      currency
    );
    if (result._tag === "Ok") return toPreview(result.value, null);

    if (this.isVoucherError(result.error._tag) && voucherCode) {
      log.warn(
        `previewCheckout: voucher rejected (${result.error._tag}), retrying without voucher`
      );
      const retryResult = await this.pricing.calculateCheckout(
        cart.items,
        undefined,
        shippingAddress,
        currency
      );
      const calc =
        retryResult._tag === "Ok"
          ? retryResult.value
          : this.subtotalOnlyFallback(cart.items, currency);
      return toPreview(calc, this.voucherErrorMessage(result.error._tag, voucherCode));
    }

    log.warn(`previewCheckout: pricing error (${result.error._tag}), using subtotal fallback`);
    return toPreview(this.subtotalOnlyFallback(cart.items, currency), null);
  }

  async placeOrder(
    userId: UserId,
    cartId: string,
    shippingAddress: ShippingAddress,
    paymentToken: string | undefined,
    paymentMethod: PaymentMethod = "card",
    voucherCode?: string
  ): Promise<Order> {
    const cartResult = await this.resolveCart(userId, cartId);
    if (cartResult._tag === "Err") return presentDomainError(cartResult.error);
    const cart = cartResult.value;
    if (cart.items.length === 0)
      return presentDomainError({
        _tag: "EmptyOrderError",
        message: "Cannot place an order with an empty cart",
      });

    for (const item of cart.items) {
      const productResult = await this.productRepo.findById(item.productId);
      if (productResult._tag === "Err") {
        log.warn(`placeOrder: cannot validate price for product ${item.productId}`);
        continue;
      }
      if (item.unitPrice.displayAmount !== productResult.value.price.displayAmount) {
        return presentDomainError(
          makePriceChangedError(
            item.productName,
            item.unitPrice.displayAmount,
            productResult.value.price.displayAmount
          )
        );
      }
    }

    const currency = cart.items[0]?.unitPrice.currency ?? "THB";
    const resolvedVoucher = await this.resolveVoucher(voucherCode);
    const pricingResult = await this.pricing.calculateCheckout(
      cart.items,
      resolvedVoucher,
      { country: shippingAddress.country, province: shippingAddress.province ?? "" },
      currency
    );

    let totalCents: number;
    let shippingCents: number;
    let discountCents: number;

    if (pricingResult._tag === "Ok") {
      totalCents = pricingResult.value.totalCents;
      shippingCents = pricingResult.value.shippingCents;
      discountCents = pricingResult.value.discountCents;
    } else {
      log.warn(`placeOrder: pricing error (${pricingResult.error._tag}) — subtotal fallback`);
      const subtotal = cart.items.reduce(
        (acc, item) =>
          acc.plus(
            new BigNumber(Math.round(item.unitPrice.displayAmount * 100)).times(item.quantity)
          ),
        new BigNumber(0)
      );
      totalCents = subtotal.toNumber();
      shippingCents = 0;
      discountCents = 0;
    }

    const orderLines: OrderLine[] = cart.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice,
      size: item.size,
      quantity: item.quantity,
    }));

    const orderId = crypto.randomUUID();
    const now = Temporal.Now.instant();
    const initialStatus = paymentMethod === "crypto" ? "confirmed" : "pending";

    const order: Order = {
      id: orderId as OrderId,
      userId,
      cartId,
      lines: orderLines as unknown as NonEmptyArray<OrderLine>,
      status: initialStatus,
      shippingAddress,
      totalAmountInCents: totalCents,
      shippingCents,
      discountCents,
      currency,
      placedAt: now,
      updatedAt: now,
      shippedAt: None(),
      trackingNumber: None(),
    };

    const stockItems = cart.items.map((item) => ({
      id: item.productId,
      size: item.size,
      quantity: item.quantity,
    }));
    const atomicResult = await this.orderRepo.atomicReserveAndSave(order, stockItems);
    if (atomicResult._tag === "Err") return presentDomainError(atomicResult.error);

    if (paymentMethod === "card") {
      await this.payment.initiatePayment(orderId, totalCents, currency, userId, paymentToken);
      log.info(`Order placed (pending): orderId=${orderId} total=${totalCents} ${currency}`);
    } else {
      log.info(`Order placed (x402 confirmed): orderId=${orderId} total=${totalCents} ${currency}`);
    }

    const clearedCart = clearCart(cart);
    await this.cartRepo.save(clearedCart);

    void this.eventPublisher.publish({
      event_id: crypto.randomUUID(),
      event_type: "OrderPlaced",
      aggregate_id: orderId,
      occurred_at: now.toString(),
      schema_version: 1,
      payload: {
        order_id: orderId,
        user_id: userId,
        total_cents: totalCents,
        currency,
        status: initialStatus,
      },
    });

    void this.activity.track({
      id: crypto.randomUUID(),
      userId: userId,
      eventType: "order_placed",
      eventData: { orderId, totalCents, currency, paymentMethod, itemCount: cart.items.length },
    });

    return atomicResult.value;
  }

  async getOrder(userId: UserId, orderId: string): Promise<Order> {
    const result = await this.orderRepo.findById(orderId as OrderId);
    if (result._tag === "Err") return presentDomainError(result.error);
    if (result.value.userId !== userId) {
      return presentDomainError({
        _tag: "OrderNotFoundError",
        message: `Order ${orderId} not found`,
      });
    }
    return result.value;
  }

  async getUserOrders(userId: UserId, pagination: PaginationInput) {
    const result = await this.orderRepo.findByUserId(userId, pagination);
    if (result._tag === "Err") return presentDomainError(result.error);
    return result.value;
  }

  async confirmOrder(orderId: string): Promise<void> {
    const result = await this.orderRepo.findById(orderId as OrderId);
    if (result._tag === "Err") {
      log.error(`confirmOrder: order not found orderId=${orderId}`);
      return;
    }
    const transitioned = transitionOrderStatus(result.value, "confirmed");
    if (transitioned._tag === "Err") {
      log.debug(`confirmOrder: duplicate callback orderId=${orderId}`);
      return;
    }
    await this.orderRepo.save(transitioned.value);
    log.info(`Order confirmed: orderId=${orderId}`);
    void this.activity.track({
      id: crypto.randomUUID(),
      eventType: "order_confirmed",
      eventData: { orderId },
    });
    void (async () => {
      const order = transitioned.value;
      const revenueByOwner = new Map<string, number>();
      for (const line of order.lines) {
        const prod = await this.productRepo.findById(line.productId);
        if (prod._tag === "Ok" && prod.value.ownerId) {
          const prev = revenueByOwner.get(prod.value.ownerId) ?? 0;
          revenueByOwner.set(
            prod.value.ownerId,
            prev + Math.round(line.unitPrice.displayAmount * 100) * line.quantity
          );
        }
      }
      for (const [ownerId, revenue] of revenueByOwner) {
        const r = await this.merchantRepo.recordCompletedOrder(ownerId, revenue);
        if (r._tag === "Err") {
          log.warn(`confirmOrder: failed to record revenue for merchant ${ownerId}`, { orderId });
        }
      }
    })();
  }

  async failOrder(orderId: string, reason: string): Promise<void> {
    const result = await this.orderRepo.findById(orderId as OrderId);
    if (result._tag === "Err") {
      log.error(`failOrder: order not found orderId=${orderId}`);
      return;
    }
    const transitioned = transitionOrderStatus(result.value, "cancelled");
    if (transitioned._tag === "Err") {
      log.debug(`failOrder: duplicate callback orderId=${orderId}`);
      return;
    }
    await this.orderRepo.save(transitioned.value);
    log.warn(`Order failed: orderId=${orderId} reason=${reason}`);
    void this.activity.track({
      id: crypto.randomUUID(),
      eventType: "order_failed",
      eventData: { orderId, reason },
    });
  }

  private async resolveCart(userId: UserId, cartId: string) {
    if (cartId !== "local") {
      return this.cartRepo.findById(cartId as CartId);
    }
    const byUserResult = await this.cartRepo.findByUserId(userId);
    if (byUserResult._tag === "Err") return presentDomainError(byUserResult.error);
    if (byUserResult.value._tag === "None")
      return presentDomainError({ _tag: "CartNotFoundError", message: "Cart not found for user" });
    return { _tag: "Ok" as const, value: byUserResult.value.value };
  }

  private async resolveVoucher(code: string | undefined): Promise<VoucherForRoc | undefined> {
    if (!code) return undefined;
    const result = await this.voucherRepo.findByCode(code);
    return result._tag === "Ok" ? result.value : undefined;
  }

  private isVoucherError(tag: string): boolean {
    return [
      "VoucherNotFound",
      "VoucherExpired",
      "VoucherExhausted",
      "OrderBelowMinimum",
      "InvalidDiscount",
    ].includes(tag);
  }

  private voucherErrorMessage(tag: string, code: string): string {
    const msgs: Record<string, string> = {
      VoucherNotFound: `Voucher "${code}" was not found`,
      VoucherExpired: `Voucher "${code}" has expired`,
      VoucherExhausted: `Voucher "${code}" has been fully redeemed`,
      OrderBelowMinimum: `Order total is below the minimum required for "${code}"`,
      InvalidDiscount: `Voucher "${code}" has an invalid discount configuration`,
    };
    return msgs[tag] ?? `Voucher "${code}" could not be applied`;
  }

  private subtotalOnlyFallback(
    items: ReadonlyArray<CartItem>,
    currency: string
  ): CheckoutCalculation {
    const subtotalCents = items.reduce(
      (acc, item) => acc + Math.round(item.unitPrice.displayAmount * 100) * item.quantity,
      0
    );
    return {
      subtotalCents,
      discountCents: 0,
      shippingCents: 0,
      totalCents: subtotalCents,
      currency,
      lines: items.map((item) => ({
        productId: item.productId,
        unitCents: Math.round(item.unitPrice.displayAmount * 100),
        quantity: item.quantity,
      })),
    };
  }
}
