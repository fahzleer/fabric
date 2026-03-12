import { describe, expect, test } from "bun:test";
import { Either } from "effect";
import { processPaymentLogic } from "./process-payment.logic.ts";

const BASE_CARD_REQUEST = {
  orderId: "order-001",
  totalCents: 50000,
  currency: "THB",
  userId: "user-001",
  paymentToken: "tok_visa_4242",
  paymentMethod: "card" as const,
};

const BASE_CRYPTO_REQUEST = {
  orderId: "order-002",
  totalCents: 100000,
  currency: "USD",
  userId: "user-001",
  paymentMethod: "crypto" as const,
};

const BASE_PROMPTPAY_REQUEST = {
  orderId: "order-003",
  totalCents: 25000,
  currency: "THB",
  userId: "user-001",
  paymentMethod: "promptpay" as const,
};

describe("processPaymentLogic — Branch 1: invalid amount", () => {
  test("totalCents = 0 → Left(InvalidAmount)", () => {
    const result = processPaymentLogic({ ...BASE_CARD_REQUEST, totalCents: 0 });
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("InvalidAmount");
    }
  });

  test("totalCents < 0 → Left(InvalidAmount)", () => {
    const result = processPaymentLogic({ ...BASE_CARD_REQUEST, totalCents: -1 });
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("InvalidAmount");
    }
  });
});

describe("processPaymentLogic — Branch 2: missing payment token", () => {
  test("card payment without token → Left(InvalidPaymentToken)", () => {
    const { paymentToken: _pt, ...cardWithoutToken } = BASE_CARD_REQUEST;
    const result = processPaymentLogic(cardWithoutToken);
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("InvalidPaymentToken");
    }
  });

  test("promptpay without token is valid (no token required)", () => {
    const result = processPaymentLogic(BASE_PROMPTPAY_REQUEST);
    expect(Either.isRight(result)).toBe(true);
  });

  test("crypto without token is valid (no token required)", () => {
    const result = processPaymentLogic(BASE_CRYPTO_REQUEST);
    expect(Either.isRight(result)).toBe(true);
  });
});

describe("processPaymentLogic — Branch 3: crypto payment", () => {
  test("crypto → Right([RecordPayment, NotifySuccess])", () => {
    const result = processPaymentLogic(BASE_CRYPTO_REQUEST);
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      const commands = result.right;
      expect(commands).toHaveLength(2);
      expect(commands[0]?._tag).toBe("RecordPayment");
      expect(commands[1]?._tag).toBe("NotifySuccess");
      if (commands[0]?._tag === "RecordPayment") {
        expect(commands[0].orderId).toBe("order-002");
        expect(commands[0].amountCents).toBe(100000);
      }
    }
  });
});

describe("processPaymentLogic — Branch 4: card payment", () => {
  test("card with token → Right([ChargeCard])", () => {
    const result = processPaymentLogic(BASE_CARD_REQUEST);
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      const commands = result.right;
      expect(commands).toHaveLength(1);
      expect(commands[0]?._tag).toBe("ChargeCard");
      if (commands[0]?._tag === "ChargeCard") {
        expect(commands[0].orderId).toBe("order-001");
        expect(commands[0].amountCents).toBe(50000);
        expect(commands[0].token).toBe("tok_visa_4242");
        expect(commands[0].currency).toBe("THB");
      }
    }
  });
});

describe("processPaymentLogic — Branch 5: PromptPay payment", () => {
  test("promptpay → Right([RecordPayment]) with NO NotifySuccess", () => {
    const result = processPaymentLogic(BASE_PROMPTPAY_REQUEST);
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      const commands = result.right;
      expect(commands).toHaveLength(1);
      expect(commands[0]?._tag).toBe("RecordPayment");
      if (commands[0]?._tag === "RecordPayment") {
        expect(commands[0].orderId).toBe("order-003");
        expect(commands[0].amountCents).toBe(25000);
        expect(commands[0].paymentId).toMatch(/^promptpay_pending_/);
      }
    }
  });

  test("promptpay with zero amount → Left(InvalidAmount)", () => {
    const result = processPaymentLogic({ ...BASE_PROMPTPAY_REQUEST, totalCents: 0 });
    expect(Either.isLeft(result)).toBe(true);
  });

  test("promptpay paymentId contains the orderId", () => {
    const result = processPaymentLogic(BASE_PROMPTPAY_REQUEST);
    if (Either.isRight(result)) {
      const cmd = result.right[0];
      if (cmd?._tag === "RecordPayment") {
        expect(cmd.paymentId).toContain("order-003");
      }
    }
  });
});
