# Why Fabric

The client said it'd take a month.

Products, a cart, checkout. Dead simple.

Every dev has heard that one.

---

Shopify first. Thai payment gateways aren't supported — custom integration it is.
Then the client wants PromptPay. Stripe doesn't cover it.
So you wire in a second gateway. Now pricing lives in one service, payment in another, and neither knows what the other is doing.
Switch to WooCommerce. Every plugin update breaks something else.

Each piece has its own SDK. Its own idea of what a price looks like. Nothing lines up.

---

Launch night. 2am.

Webhook fires from Omise. Order never confirms.
Client's ringing. You're alone at the terminal.

You trace it back to one field.

Payment service sends `price.cents`. Order service reads `price.amount`.
One field. Entire flow down.

That's when it clicked — if the thinking doesn't change, this keeps happening.

---

So we built it right. One rule.

Domain types live in one place. Every service reads the same shape.

`ProductPrice` has `.amount`. That's it.
`makeProductPriceFromCents(10_000, "THB")` → `{ amount: 100, currency: "THB" }`.
No `.cents`. No `.priceInCents`. No guessing.

`ProductId` and `OrderId` are branded types. You can't swap them — not even by accident. TypeScript catches it before the code runs.

---

Once the type system is the single source of truth, everything else follows.

Pricing is Railway Oriented — `Either<PricingError, T>`. Thirteen error variants, all known at compile time. No exceptions turning up uninvited.

Events use Free Monad — the program says *what should happen*, the interpreter handles *how*. Tests run against an in-memory map. No Firebase, no mocks, no setup.

Three payment methods — Omise, PromptPay, USDC x402 — one `PaymentMethod` type across the whole codebase.

---

But here's what actually changed everything.

`bun test`. 720 tests. Green on every commit.

No more 2am calls over a mismatched field.
No more production down because two services disagreed on a type.

Fabric is the codebase that already made the right decisions — so you don't have to make them at 2am.
