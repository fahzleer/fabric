# Web3 / USDC Crypto Checkout (x402 Protocol)

Fabric supports USDC payments on Base (Ethereum L2) via the x402 protocol. This is a distinct payment path from Omise (card) and PromptPay.

---

## Overview

```
Customer selects USDC → connects MetaMask/wallet
  │
  ├── 1. Probe POST /orders (expect 402 Payment Required)
  │         ← 402 with X-Payment-Required header (amount, currency, address)
  │
  ├── 2. Sign EIP-3009 TransferWithAuthorization (offline, no gas yet)
  │
  ├── 3. Submit POST /orders with X-Payment header
  │         → cf-api verifies signature → creates order with status "confirmed"
  │         ← 200 with orderId
  │
  └── 4. Order confirmed immediately (no webhook)
```

Unlike card payments (async via webhook), crypto orders are synchronously confirmed at order placement.

---

## x402 Protocol

x402 is an HTTP payment protocol. The server returns `402 Payment Required` with machine-readable payment requirements; the client signs an authorization offline and retries with the signed payment in a header.

**HTTP 402 response headers:**
```
X-Payment-Required: version=1
X-Payment-Amount: 10.50
X-Payment-Currency: USDC
X-Payment-Recipient: 0xYourWalletAddress
X-Payment-Chain: base
X-Payment-Deadline: 1720000000   (Unix timestamp)
```

**Client retry with payment:**
```
POST /orders
X-Payment: v=1;from=0xCustomer;to=0xRecipient;amount=10500000;deadline=...;signature=0x...
```

---

## EIP-3009 TransferWithAuthorization

Fabric uses EIP-3009 (`transferWithAuthorization`) rather than the standard ERC-20 approve + transfer pattern. This has two advantages:

1. **No separate approval transaction** — the authorization is signed offline (no gas)
2. **Gasless UX** — the recipient (Fabric) can submit the transfer; the customer never pays gas

### Signing flow (apps/web)

```typescript
// apps/web/src/app/(shop)/checkout/_components/x402-payment-form.tsx

// 1. Get the USDC contract address for Base
const usdcAddress = BASE_USDC_ADDRESS  // "0x..." from wagmi config

// 2. Build the EIP-712 typed data for TransferWithAuthorization
const domain = {
  name: "USD Coin",
  version: "2",
  chainId: base.id,
  verifyingContract: usdcAddress,
}

const types = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
}

const message = {
  from: walletAddress,
  to: FABRIC_WALLET_ADDRESS,
  value: usdcAmountInAtomicUnits,   // 6 decimals for USDC
  validAfter: 0,
  validBefore: deadline,            // Unix timestamp
  nonce: crypto.getRandomValues(new Uint8Array(32)),
}

// 3. Sign (user sees MetaMask popup)
const signature = await signTypedData({ domain, types, message })

// 4. Submit with signature in X-Payment header
const xPaymentHeader = encodeXPayment({ ...message, signature })
```

---

## USDC Decimal Handling

USDC has 6 decimal places. 1 USDC = 1,000,000 atomic units.

```typescript
// 10.50 USDC in atomic units
const atomicUnits = BigInt(Math.round(10.50 * 1_000_000))  // 10500000n
```

The reactive USDC estimate atom fetches the THB→USDC rate from CoinGecko and converts the order total:

```typescript
// checkout.atoms.ts
export const usdcEstimateAtom = Atom.fn((get) =>
  Effect.gen(function* () {
    const preview = yield* get(pricingPreviewAtom)
    const rate = yield* fetchUsdcRate()  // GET /api/crypto/rate
    const thbAmount = preview.totalCents / 100
    return thbAmount / rate  // USDC amount
  })
)
```

The `/api/crypto/rate` route proxies CoinGecko with a 2-minute cache and falls back to 35 THB/USDC if unavailable.

---

## Chain Configuration

```typescript
// wagmi config (apps/web)
const chains = [base, baseSepolia]  // mainnet + testnet

// USDC contract addresses
const USDC_ADDRESSES = {
  [base.id]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",        // Base mainnet
  [baseSepolia.id]: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",  // Base Sepolia testnet
}
```

The active chain is determined by `NEXT_PUBLIC_CHAIN` env var (`"base"` or `"base-sepolia"`).

---

## Order Placement (Crypto Path)

In `OrderService.placeOrder()`, crypto orders bypass the async payment flow:

```typescript
const initialStatus = paymentMethod === "crypto" ? "confirmed" : "pending"
```

The order is created with `status: "confirmed"` immediately. No webhook callback is needed because the signature was validated before the order was saved.

cf-api verifies the x402 signature server-side before calling `placeOrder`. The signature verification is done in the order handler (`order.handlers.ts`), not the service, to keep the service free of Web3 dependencies.

---

## Wallet Connection (wagmi + viem)

```typescript
// wagmi config
import { createConfig, http } from "wagmi"
import { base, baseSepolia } from "wagmi/chains"
import { injected, metaMask } from "wagmi/connectors"

export const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  connectors: [injected(), metaMask()],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
})
```

The form displays:
1. **Connect Wallet** button (if no wallet connected)
2. **Switch Network** button (if wrong chain)
3. **Confirm Payment** button (shows USDC amount + gas estimate)
4. Loading state while signature is pending
5. Success redirect on order confirmation

---

## USDC Rate API

```typescript
// apps/web/src/app/api/crypto/rate/route.ts
export async function GET() {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=thb",
    { next: { revalidate: 120 } }  // 2-minute ISR cache
  )

  if (!response.ok) {
    return Response.json({ rate: 35 })  // fallback: 35 THB/USDC
  }

  const data = await response.json()
  return Response.json({ rate: data["usd-coin"].thb })
}
```

The fallback rate of 35 THB/USDC is conservative. If CoinGecko is unavailable, customers may see a slightly stale estimate.

---

## Security Considerations

1. **Signature verification is server-side.** cf-api verifies the EIP-3009 signature cryptographically before accepting the order. A tampered amount would produce an invalid signature.

2. **Deadline enforcement.** The `validBefore` timestamp is checked server-side. Stale signatures (e.g., from a browser crash recovery) are rejected.

3. **Nonce uniqueness.** The `nonce` in TransferWithAuthorization is a random 32-byte value. Reusing a nonce would fail on-chain even if cf-api accepted the signature.

4. **No private keys on the server.** Fabric holds the recipient wallet address only. The actual on-chain transfer is submitted by the customer's wallet (or via a relayer — not implemented yet).

5. **Price accuracy.** The USDC amount shown to the customer is based on the CoinGecko rate at display time. The signed amount is what the customer approves — there is no slippage tolerance. This means the merchant receives exactly what the customer signed.

---

## Development & Testing

For local development, use Base Sepolia (testnet):

```bash
# .env.local
NEXT_PUBLIC_CHAIN=base-sepolia
```

Get testnet USDC from the Base Sepolia faucet. Use MetaMask with the Base Sepolia network.

To test the 402 flow without a real wallet, use `curl`:

```bash
# Probe for payment requirements
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"cartId":"local","paymentMethod":"crypto"}'
# → 402 with X-Payment-Required header
```

---

## Known Limitations

- **No gas abstraction.** Customers pay their own gas for the on-chain transfer after signing. This is a future improvement (EIP-4337 account abstraction or a gasless relayer).
- **THB/USDC rate risk.** Between when the customer sees the estimate and when the order is placed, the rate may shift. There is no on-chain oracle — the signed amount is fixed at signing time.
- **No refund automation.** Crypto refunds require a manual on-chain transfer from the Fabric wallet. No automated refund flow exists yet.
- **MetaMask only (effectively).** `injected()` connector works with most wallets, but only MetaMask and Coinbase Wallet are tested.

Tracked in `docs/TECH_DEBT.md`.
