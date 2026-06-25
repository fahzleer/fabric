import type { Either } from "effect";
import { Either as E } from "effect";
import type { PaymentCommand } from "../domain/payment.commands";
import type { PaymentError } from "../domain/payment.errors";
import { InvalidPaymentToken } from "../domain/payment.errors";
import type { PaymentRequest } from "../domain/payment.types";

export const processPaymentLogic = (
  request: PaymentRequest
): Either.Either<ReadonlyArray<PaymentCommand>, PaymentError> => {
  if (request.totalCents <= 0) {
    return E.left({ _tag: "InvalidAmount" as const, cents: request.totalCents });
  }

  const isAsyncMethod = request.paymentMethod === "crypto" || request.paymentMethod === "promptpay";

  if (!(request.paymentToken || isAsyncMethod)) {
    return E.left(InvalidPaymentToken("Payment token is required for card payments"));
  }

  const commands: PaymentCommand[] = [];

  if (request.paymentMethod === "crypto") {
    const paymentId = `crypto_${crypto.randomUUID()}`;
    commands.push({
      _tag: "RecordPayment",
      orderId: request.orderId,
      paymentId,
      amountCents: request.totalCents,
    });
    commands.push({ _tag: "NotifySuccess", orderId: request.orderId, paymentId });
  } else if (request.paymentMethod === "promptpay") {
    const paymentId = `promptpay_pending_${request.orderId}`;
    commands.push({
      _tag: "RecordPayment",
      orderId: request.orderId,
      paymentId,
      amountCents: request.totalCents,
    });
  } else {
    commands.push({
      _tag: "ChargeCard",
      orderId: request.orderId,
      amountCents: request.totalCents,
      currency: request.currency,
      token: request.paymentToken ?? "",
    });
  }

  return E.right(commands);
};
