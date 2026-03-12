import { log } from "../../monitoring/logger";
import type { PaymentCommand } from "../domain/payment.commands";
import type { PaymentResult } from "../domain/payment.types";
import type { IPaymentGateway } from "../ports/payment-gateway.port";

const CF_API_URL = process.env.CF_API_URL ?? "http://localhost:3010";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET as string;

export const interpretPaymentCommands = async (
  commands: ReadonlyArray<PaymentCommand>,
  gateway: IPaymentGateway
): Promise<PaymentResult> => {
  let paymentId: string | undefined;
  let success = false;
  let failureReason: string | undefined;

  for (const cmd of commands) {
    switch (cmd._tag) {
      case "ChargeCard": {
        const result = await gateway.charge(cmd.orderId, cmd.amountCents, cmd.currency, cmd.token);
        paymentId = result.paymentId;
        success = result.success;
        failureReason = result.failureReason;

        if (success) {
          await notifyApiSuccess(cmd.orderId, result.paymentId);
        } else {
          await notifyApiFailure(cmd.orderId, result.failureReason ?? "Payment declined");
        }
        break;
      }

      case "RecordPayment": {
        paymentId = cmd.paymentId;
        success = true;
        log.info("Payment recorded", { orderId: cmd.orderId, paymentId: cmd.paymentId });
        break;
      }

      case "NotifySuccess": {
        await notifyApiSuccess(cmd.orderId, cmd.paymentId);
        break;
      }

      case "NotifyFailure": {
        await notifyApiFailure(cmd.orderId, cmd.reason);
        break;
      }

      case "RefundPayment": {
        await gateway.refund(cmd.paymentId, cmd.amountCents);
        log.info("Payment refunded", { paymentId: cmd.paymentId });
        break;
      }
    }
  }

  return {
    orderId: commands[0] ? getOrderId(commands[0]) : "",
    paymentId: paymentId ?? "",
    success,
    ...(failureReason !== undefined && { reason: failureReason }),
  };
};

function getOrderId(cmd: PaymentCommand): string {
  switch (cmd._tag) {
    case "ChargeCard":
      return cmd.orderId;
    case "RecordPayment":
      return cmd.orderId;
    case "NotifySuccess":
      return cmd.orderId;
    case "NotifyFailure":
      return cmd.orderId;
    case "RefundPayment":
      return cmd.paymentId;
  }
}

const NOTIFY_RETRIES = 1;

async function notifyWithRetry(
  body: Record<string, unknown>,
  orderId: string,
  label: string
): Promise<void> {
  for (let attempt = 0; attempt <= NOTIFY_RETRIES; attempt++) {
    try {
      await fetch(`${CF_API_URL}/internal/payment-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL_SECRET },
        body: JSON.stringify(body),
      });
      return;
    } catch (cause) {
      if (attempt < NOTIFY_RETRIES) continue;
      log.warn(`Failed to notify cf-api of payment ${label} after ${NOTIFY_RETRIES + 1} attempts`, {
        orderId,
        error: String(cause),
      });
    }
  }
}

async function notifyApiSuccess(orderId: string, paymentId: string): Promise<void> {
  await notifyWithRetry({ orderId, paymentId, success: true }, orderId, "success");
}

async function notifyApiFailure(orderId: string, reason: string): Promise<void> {
  await notifyWithRetry({ orderId, success: false, reason }, orderId, "failure");
}
