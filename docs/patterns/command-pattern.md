# Command Pattern — Payment Processing

> "The single most important thing in payment systems is that every operation is auditable, reversible, and testable. A payment bug that you cannot reproduce in a test is a bug that will destroy trust, trigger chargebacks, and possibly violate PCI-DSS."

---

## The Core Problem

Payment logic is uniquely dangerous for two reasons:

1. **Irreversibility**: A double-charge is not a bug you fix by deploying a patch. It requires contacting the customer, initiating a refund, and explaining to them why you charged them twice.

2. **External side effects**: Payment gateway calls are the definition of a side effect. You cannot undo a network call. If your logic is wrong, you find out only after the money has moved.

The Command Pattern solves this by separating the *decision of what to do* from *the execution of doing it*:

```
processPaymentLogic(order, request)
  → pure function, no side effects
  → returns List<PaymentCommand>   ← a description of what should happen

interpretPaymentCommands(commands, gateway)
  → executes the commands against the real gateway
  → side effects happen here and only here
```

---

## PaymentCommand — The Command ADT

```typescript
// payment/domain/payment.commands.ts

type PaymentCommand =
  | {
      readonly _tag: "ChargeCard"
      readonly orderId: string
      readonly amountCents: number
      readonly currency: string
      readonly cardToken: string       // Omise one-time card token
    }
  | {
      readonly _tag: "RecordPayment"
      readonly orderId: string
      readonly paymentId: string       // Gateway-assigned ID
      readonly amountCents: number
    }
  | {
      readonly _tag: "NotifySuccess"
      readonly orderId: string
      readonly paymentId: string
    }
  | {
      readonly _tag: "NotifyFailure"
      readonly orderId: string
      readonly reason: string
    }
  | {
      readonly _tag: "RefundPayment"
      readonly paymentId: string
      readonly amountCents: number
    }
```

Commands are plain data structures. You can serialize them, log them, store them in a database, or pass them across network boundaries. They have zero behavior — they are pure data.

---

## Pure Logic Layer

```typescript
// payment/logic/process-payment.logic.ts

function processPaymentLogic(
  order: Order,
  request: PaymentRequest
): PaymentCommand[] {
  // Guard: order must be in payable state
  if (order.status !== "pending") {
    return [{
      _tag: "NotifyFailure",
      orderId: order.id,
      reason: `order_not_payable: status is ${order.status}`,
    }]
  }

  // Guard: amount must be positive
  if (order.amountCents <= 0) {
    return [{
      _tag: "NotifyFailure",
      orderId: order.id,
      reason: "invalid_amount: zero or negative",
    }]
  }

  // Guard: card token must be present for card payments
  if (order.paymentMethod === "card" && !request.cardToken) {
    return [{
      _tag: "NotifyFailure",
      orderId: order.id,
      reason: "missing_card_token",
    }]
  }

  // Happy path: charge the card
  return [{
    _tag: "ChargeCard",
    orderId: order.id,
    amountCents: order.amountCents,
    currency: order.currency,
    cardToken: request.cardToken!,
  }]
  // Note: RecordPayment and NotifySuccess are emitted dynamically by the
  // interpreter after ChargeCard succeeds. They cannot be determined upfront
  // because the paymentId is assigned by the gateway, not by us.
}
```

This is a pure function. It has no side effects. It takes data in, returns an array of commands out. It can be tested with a single call, no mocking required.

---

## The Interpreter

```typescript
// payment/interpreters/payment.interpreter.ts

async function interpretPaymentCommands(
  commands: PaymentCommand[],
  gateway: PaymentGatewayPort,
  cfApiUrl: string,
  internalSecret: string
): Promise<void> {
  for (const cmd of commands) {
    switch (cmd._tag) {
      case "ChargeCard": {
        const result = await gateway.charge({
          orderId: cmd.orderId,
          amountCents: cmd.amountCents,
          currency: cmd.currency,
          cardToken: cmd.cardToken,
        })

        if (result._tag === "Ok") {
          // Charge succeeded — record it and notify
          await interpretPaymentCommands(
            [
              { _tag: "RecordPayment",  orderId: cmd.orderId, paymentId: result.value.paymentId, amountCents: cmd.amountCents },
              { _tag: "NotifySuccess",  orderId: cmd.orderId, paymentId: result.value.paymentId },
            ],
            gateway,
            cfApiUrl,
            internalSecret
          )
        } else {
          // Charge failed — notify failure
          await interpretPaymentCommands(
            [{ _tag: "NotifyFailure", orderId: cmd.orderId, reason: result.error.message }],
            gateway,
            cfApiUrl,
            internalSecret
          )
        }
        break
      }

      case "RecordPayment": {
        // Write payment record to RTDB
        await db.ref(`payments/${cmd.orderId}`).set({
          paymentId: cmd.paymentId,
          amountCents: cmd.amountCents,
          recordedAt: new Date().toISOString(),
        })
        break
      }

      case "NotifySuccess": {
        // Callback to cf-api (1 retry)
        await callWithRetry(
          () => fetch(`${cfApiUrl}/internal/payment-result`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-secret": internalSecret,
            },
            body: JSON.stringify({
              orderId: cmd.orderId,
              paymentId: cmd.paymentId,
              status: "success",
            }),
          }),
          { maxAttempts: 2, delayMs: 500 }
        )
        break
      }

      case "NotifyFailure": {
        await callWithRetry(
          () => fetch(`${cfApiUrl}/internal/payment-result`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-secret": internalSecret,
            },
            body: JSON.stringify({
              orderId: cmd.orderId,
              status: "failure",
              reason: cmd.reason,
            }),
          }),
          { maxAttempts: 2, delayMs: 500 }
        )
        break
      }

      case "RefundPayment": {
        await gateway.refund(cmd.paymentId, cmd.amountCents)
        break
      }
    }
  }
}
```

---

## Payment Gateway Port

```typescript
// payment/ports/payment-gateway.port.ts

interface PaymentGatewayPort {
  charge(req: ChargeRequest): Promise<Result<ChargeSuccess, PaymentGatewayError>>
  refund(paymentId: string, amountCents: number): Promise<Result<RefundSuccess, PaymentGatewayError>>
}

type ChargeRequest = {
  orderId: string
  amountCents: number
  currency: string
  cardToken: string
}

type ChargeSuccess = {
  paymentId: string    // Gateway-assigned ID
  status: "successful"
}
```

### OmisePaymentGateway (Production)

Uses `fetch` directly. No Omise SDK. The SDK adds abstraction over a straightforward REST API, introduces version lock-in, and has error handling quirks that are easier to control by calling the API directly.

```typescript
class OmisePaymentGateway implements PaymentGatewayPort {
  constructor(private secretKey: string) {}

  async charge(req: ChargeRequest): Promise<Result<ChargeSuccess, PaymentGatewayError>> {
    const response = await fetch("https://api.omise.co/charges", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(this.secretKey + ":")}`
        Content-Type: "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        amount: req.amountCents.toString(),
        currency: req.currency.toLowerCase(),
        card: req.cardToken,
        description: `Order ${req.orderId}`,
        capture: "true",
      }),
    })

    const body = await response.json()

    if (!response.ok || body.object === "error") {
      return Err({ _tag: "GatewayError", message: body.message ?? "charge failed", code: body.code })
    }

    return Ok({ paymentId: body.id, status: "successful" })
  }
}
```

### MockPaymentGateway (Development)

```typescript
class MockPaymentGateway implements PaymentGatewayPort {
  public charges: ChargeRequest[] = []   // Inspect in tests

  constructor(private successRate = 0.95) {}

  async charge(req: ChargeRequest): Promise<Result<ChargeSuccess, PaymentGatewayError>> {
    this.charges.push(req)

    // Simulate network latency
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 300))

    if (Math.random() > this.successRate) {
      return Err({ _tag: "GatewayError", message: "mock: card declined", code: "insufficient_fund" })
    }

    return Ok({ paymentId: `mock_pay_${crypto.randomUUID()}`, status: "successful" })
  }
}
```

Selected via `PAYMENT_GATEWAY` env var: `"omise"` → `OmisePaymentGateway`, anything else → `MockPaymentGateway`.

---

## Testing

The command pattern makes testing trivial:

```typescript
describe("processPaymentLogic", () => {
  test("returns ChargeCard command for valid pending order", () => {
    const order = buildOrder({ status: "pending", amountCents: 5000, currency: "THB" })
    const request = { cardToken: "tok_test_12345" }

    const commands = processPaymentLogic(order, request)

    expect(commands).toHaveLength(1)
    expect(commands[0]._tag).toBe("ChargeCard")
    expect((commands[0] as any).amountCents).toBe(5000)
  })

  test("returns NotifyFailure for non-pending order", () => {
    const order = buildOrder({ status: "confirmed" })

    const commands = processPaymentLogic(order, {})

    expect(commands[0]._tag).toBe("NotifyFailure")
    expect((commands[0] as any).reason).toContain("order_not_payable")
  })

  test("returns NotifyFailure when card token is missing", () => {
    const order = buildOrder({ status: "pending", paymentMethod: "card" })

    const commands = processPaymentLogic(order, { cardToken: undefined })

    expect(commands[0]._tag).toBe("NotifyFailure")
  })
})

describe("interpretPaymentCommands", () => {
  test("charges gateway and records payment on success", async () => {
    const gateway = new MockPaymentGateway({ successRate: 1.0 })
    const commands: PaymentCommand[] = [
      { _tag: "ChargeCard", orderId: "ord_1", amountCents: 5000, currency: "THB", cardToken: "tok_1" }
    ]

    await interpretPaymentCommands(commands, gateway, mockCfApiUrl, mockSecret)

    expect(gateway.charges).toHaveLength(1)
    expect(gateway.charges[0].amountCents).toBe(5000)
  })

  test("calls NotifyFailure when charge fails", async () => {
    const gateway = new MockPaymentGateway({ successRate: 0.0 })  // Always fail
    const notifyCalls: unknown[] = []
    // Intercept cf-api callback
    // ...

    const commands: PaymentCommand[] = [
      { _tag: "ChargeCard", orderId: "ord_1", amountCents: 5000, currency: "THB", cardToken: "tok_1" }
    ]

    await interpretPaymentCommands(commands, gateway, mockCfApiUrl, mockSecret)

    // Verify NotifyFailure was called (not NotifySuccess)
    expect(notifyCalls[0]).toMatchObject({ status: "failure" })
  })
})
```

The logic layer tests are pure function calls. The interpreter tests use `MockPaymentGateway` — no Omise API, no network, no credentials required in CI.
