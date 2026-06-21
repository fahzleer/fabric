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
import { makeEmptyCart } from "../../domain/cart/cart.entity";
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
        log.warn(`placeOrder: cannot validate price for product ${item.productId.value}`);
        continue;
      }
      if (item.unitPrice.amount !== productResult.value.price.amount) {
        return presentDomainError(
          makePriceChangedError(
            item.productName,
            item.unitPrice.amount,
            productResult.value.price.amount
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

    const { totalCents, shippingCents, discountCents } = this.resolvePricingTotals(
      pricingResult,
      cart.items
    );

    const orderLines: OrderLine[] = cart.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice,
      size: item.size,
      quantity: item.quantity.value,
    }));

    const orderId = crypto.randomUUID();
    const now = Temporal.Now.instant();
    const initialStatus = paymentMethod === "crypto" ? "confirmed" : "pending";

    const order: Order = {
      id: { __brand: "OrderId" as const, value: orderId } as OrderId,
      userId,
      cartId: cart.id.value,
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
      quantity: item.quantity.value,
    }));
    const atomicResult = await this.orderRepo.atomicReserveAndSave(order, stockItems);
    if (atomicResult._tag === "Err") return presentDomainError(atomicResult.error);

    if (paymentMethod === "card") {
      await this.payment.initiatePayment(orderId, totalCents, currency, userId.value, paymentToken);
      log.info(`Order placed (pending): orderId=${orderId} total=${totalCents} ${currency}`);
    } else {
      log.info(`Order placed (x402 confirmed): orderId=${orderId} total=${totalCents} ${currency}`);
      // Non-card orders are immediately confirmed — record revenue per product owner
      await this.recordRevenueByOwner(orderLines);
    }

    const freshCart = makeEmptyCart(
      { __brand: "CartId" as const, value: crypto.randomUUID() } as CartId,
      cart.userId
    );
    await this.cartRepo.save(freshCart);

    void this.eventPublisher.publish({
      event_id: crypto.randomUUID(),
      event_type: "OrderPlaced",
      aggregate_id: orderId,
      occurred_at: now.toString(),
      schema_version: 1,
      payload: {
        order_id: orderId,
        user_id: userId.value,
        total_cents: totalCents,
        currency,
        status: initialStatus,
      },
    });

    void this.activity.track({
      id: crypto.randomUUID(),
      userId: userId.value,
      eventType: "order_placed",
      eventData: { orderId, totalCents, currency, paymentMethod, itemCount: cart.items.length },
    });

    return atomicResult.value;
  }

  async getOrder(userId: UserId, orderId: string): Promise<Order> {
    const result = await this.orderRepo.findById({
      __brand: "OrderId" as const,
      value: orderId,
    } as OrderId);
    if (result._tag === "Err") return presentDomainError(result.error);
    if (result.value.userId.value !== userId.value) {
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

  async updateMerchantOrderStatus(
    merchantUserId: UserId,
    orderId: string,
    newStatus: "shipped" | "delivered"
  ): Promise<Order> {
    const productsResult = await this.productRepo.findByOwner(merchantUserId.value, {
      page: 1,
      perPage: 1000,
    });
    if (productsResult._tag === "Err") return presentDomainError(productsResult.error);
    const productIds = new Set(productsResult.value.items.map((p) => p.id.value));
    const result = await this.orderRepo.findById({
      __brand: "OrderId" as const,
      value: orderId,
    } as OrderId);
    if (result._tag === "Err") return presentDomainError(result.error);
    const hasOwnProduct = result.value.lines.some((l) => productIds.has(l.productId.value));
    if (!hasOwnProduct)
      return presentDomainError({
        _tag: "OrderNotFoundError",
        message: `Order ${orderId} not found`,
      });
    // confirmed → processing → shipped requires two steps; auto-bridge the gap
    let intermediate = result.value;
    if (newStatus === "shipped" && result.value.status === "confirmed") {
      const toProcessing = transitionOrderStatus(result.value, "processing");
      if (toProcessing._tag === "Err") return presentDomainError(toProcessing.error);
      intermediate = toProcessing.value;
    }
    const transitioned = transitionOrderStatus(intermediate, newStatus);
    if (transitioned._tag === "Err") return presentDomainError(transitioned.error);
    const saved = await this.orderRepo.save(transitioned.value);
    if (saved._tag === "Err") return presentDomainError(saved.error);
    log.info(`Order status updated: orderId=${orderId} newStatus=${newStatus}`);
    return saved.value;
  }

  async getAdminStats(): Promise<{
    totalOrders: number;
    totalRevenueCents: number;
    currency: string;
    confirmedOrders: number;
    pendingOrders: number;
  }> {
    const result = await this.orderRepo.findAll({ page: 1, perPage: 10000 });
    if (result._tag === "Err")
      return {
        totalOrders: 0,
        totalRevenueCents: 0,
        currency: "THB",
        confirmedOrders: 0,
        pendingOrders: 0,
      };
    const orders = result.value.items;
    const active = orders.filter((o) => !["cancelled"].includes(o.status));
    const confirmed = orders.filter((o) =>
      ["confirmed", "shipped", "delivered"].includes(o.status)
    );
    const pending = orders.filter((o) => o.status === "pending");
    return {
      totalOrders: active.length,
      totalRevenueCents: confirmed.reduce((s, o) => s + o.totalAmountInCents, 0),
      currency: orders[0]?.currency ?? "THB",
      confirmedOrders: confirmed.length,
      pendingOrders: pending.length,
    };
  }

  async getAdminOrders(pagination: { page: number; perPage: number }): Promise<unknown> {
    const result = await this.orderRepo.findAll(pagination);
    if (result._tag === "Err") return presentDomainError(result.error);
    return {
      items: result.value.items.map((o) => ({
        id: o.id.value,
        status: o.status,
        totalAmountInCents: o.totalAmountInCents,
        currency: o.currency,
        itemCount: o.lines.reduce((s, l) => s + l.quantity, 0),
        placedAt: o.placedAt.toString(),
        customerId: o.userId.value,
      })),
      total: result.value.total,
      page: result.value.page,
      perPage: result.value.perPage,
    };
  }

  async getMerchantOrders(
    merchantUserId: UserId,
    pagination: { page: number; perPage: number }
  ): Promise<unknown> {
    const productsResult = await this.productRepo.findByOwner(merchantUserId.value, {
      page: 1,
      perPage: 1000,
    });
    if (productsResult._tag === "Err") return presentDomainError(productsResult.error);
    const productIds = productsResult.value.items.map((p) => p.id.value);
    if (productIds.length === 0)
      return { items: [], total: 0, page: pagination.page, perPage: pagination.perPage };
    const result = await this.orderRepo.findForMerchant(productIds, pagination);
    if (result._tag === "Err") return presentDomainError(result.error);
    return result.value;
  }

  async getAdminAnalytics(): Promise<unknown> {
    const [ordersResult, merchantsResult] = await Promise.all([
      this.orderRepo.findAll({ page: 1, perPage: 10000 }),
      this.merchantRepo.findAllForAdmin(),
    ]);
    const orders = ordersResult._tag === "Ok" ? ordersResult.value.items : [];
    const merchants = merchantsResult._tag === "Ok" ? merchantsResult.value : [];

    const byStatus = orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    }, {});
    const revenueOrders = orders.filter((o) =>
      ["confirmed", "processing", "shipped", "delivered"].includes(o.status)
    );
    const totalRevenueCents = revenueOrders.reduce((s, o) => s + o.totalAmountInCents, 0);
    const totalMerchantRevenueCents = merchants.reduce((s, m) => s + m.totalRevenueCents, 0);

    return {
      totalOrders: orders.length,
      totalRevenueCents,
      ordersByStatus: byStatus,
      totalMerchants: merchants.length,
      totalMerchantRevenueCents,
      currency: orders[0]?.currency ?? "THB",
    };
  }

  async getAdminMerchants(): Promise<unknown> {
    const merchantsResult = await this.merchantRepo.findAllForAdmin();
    if (merchantsResult._tag === "Err") return { merchants: [] };
    return {
      merchants: merchantsResult.value.map((m) => ({
        ...m,
        availableBalanceCents: Math.max(0, Math.round(m.totalRevenueCents * 0.95) - m.paidOutCents),
      })),
    };
  }

  async getMerchantOrder(merchantUserId: UserId, orderId: string): Promise<Order> {
    const productsResult = await this.productRepo.findByOwner(merchantUserId.value, {
      page: 1,
      perPage: 1000,
    });
    if (productsResult._tag === "Err") return presentDomainError(productsResult.error);
    const productIds = new Set(productsResult.value.items.map((p) => p.id.value));
    const result = await this.orderRepo.findById({
      __brand: "OrderId" as const,
      value: orderId,
    } as OrderId);
    if (result._tag === "Err") return presentDomainError(result.error);
    const hasOwnProduct = result.value.lines.some((l) => productIds.has(l.productId.value));
    if (!hasOwnProduct)
      return presentDomainError({
        _tag: "OrderNotFoundError",
        message: `Order ${orderId} not found`,
      });
    return result.value;
  }

  async confirmOrder(orderId: string): Promise<void> {
    const result = await this.orderRepo.findById({
      __brand: "OrderId" as const,
      value: orderId,
    } as OrderId);
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
            prev + Math.round(line.unitPrice.amount * 100) * line.quantity
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
    const result = await this.orderRepo.findById({
      __brand: "OrderId" as const,
      value: orderId,
    } as OrderId);
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
      return this.cartRepo.findById({ __brand: "CartId" as const, value: cartId } as CartId);
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

  private resolvePricingTotals(
    pricingResult: Awaited<ReturnType<PricingPort["calculateCheckout"]>>,
    items: ReadonlyArray<CartItem>
  ): { totalCents: number; shippingCents: number; discountCents: number } {
    if (pricingResult._tag === "Ok") {
      return {
        totalCents: pricingResult.value.totalCents,
        shippingCents: pricingResult.value.shippingCents,
        discountCents: pricingResult.value.discountCents,
      };
    }
    log.warn(`placeOrder: pricing error (${pricingResult.error._tag}) — subtotal fallback`);
    const subtotal = items.reduce(
      (acc, item) =>
        acc.plus(
          new BigNumber(Math.round(item.unitPrice.amount * 100)).times(item.quantity.value)
        ),
      new BigNumber(0)
    );
    return { totalCents: subtotal.toNumber(), shippingCents: 0, discountCents: 0 };
  }

  private async recordRevenueByOwner(orderLines: OrderLine[]): Promise<void> {
    const revenueByOwner = new Map<string, number>();
    for (const item of orderLines) {
      const prod = await this.productRepo.findById(item.productId);
      if (prod._tag === "Ok" && prod.value.ownerId) {
        const prev = revenueByOwner.get(prod.value.ownerId) ?? 0;
        revenueByOwner.set(
          prod.value.ownerId,
          prev + Math.round(item.unitPrice.amount * 100) * item.quantity
        );
      }
    }
    for (const [ownerId, revenue] of revenueByOwner) {
      void this.merchantRepo.recordCompletedOrder(ownerId, revenue);
    }
  }

  private subtotalOnlyFallback(
    items: ReadonlyArray<CartItem>,
    currency: string
  ): CheckoutCalculation {
    const subtotalCents = items.reduce(
      (acc, item) => acc + Math.round(item.unitPrice.amount * 100) * item.quantity.value,
      0
    );
    return {
      subtotalCents,
      discountCents: 0,
      shippingCents: 0,
      totalCents: subtotalCents,
      currency,
      lines: items.map((item) => ({
        productId: item.productId.value,
        unitCents: Math.round(item.unitPrice.amount * 100),
        quantity: item.quantity.value,
      })),
    };
  }
}
