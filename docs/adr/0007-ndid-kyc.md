# ADR 0007: NDID (Thai National Digital ID) for KYC

**Status:** Accepted  
**Date:** 2024-02-10

## Context

Fabric targets the Thai market and requires KYC (Know Your Customer) verification for merchant onboarding. KYC verifies merchant identity before enabling payout withdrawals.

Options evaluated:

| Provider | Region | Method | Thai coverage |
|---|---|---|---|
| BlueDot | Global | Document scan + liveness | No Thai National ID |
| IDWall | Brazil/LatAm | Document + biometric | No Thai support |
| Jumio | Global | Document scan | Thai passport only (not National ID) |
| **NDID** | Thailand | National Digital ID infrastructure | Thai National ID + bank biometric |

**NDID** (National Digital ID Co., Ltd.) is the Thai government-backed digital identity platform. It links to the national ID database (Department of Provincial Administration) and allows biometric verification via Thai bank mobile apps (which already have certified NDID nodes).

## Decision

Use **NDID** as the KYC verification provider for merchant onboarding.

The NDID flow:
1. Merchant enters their Thai National ID number in the admin UI
2. cf-api calls NDID's Relying Party API to initiate verification
3. Merchant receives an in-app notification from their Thai bank app (NDID node)
4. Merchant approves the identity disclosure request in their bank app
5. NDID returns a verification result to cf-api webhook
6. On success, merchant's status is updated to `kyc_verified` in Firebase

## Consequences

**Positive:**
- Thai National ID is the authoritative identity document — higher confidence than document scan
- Verification uses bank-grade biometrics already trusted by Thai citizens
- No document images stored on Fabric servers — NDID handles all PII
- Legally compliant with Thai PDPA (Personal Data Protection Act)

**Negative:**
- NDID requires a Relying Party licence from NDID Co., Ltd. — approval takes 4-8 weeks
- Only works for Thai nationals and Thai bank account holders
- International merchants require a separate KYC flow (not yet implemented)
- NDID sandbox environment has limited test accounts

## Implementation

- Port: `apps/cf-api/src/application/ports/kyc.port.ts`
- Adapter: `apps/cf-api/src/infrastructure/kyc/ndid-kyc.adapter.ts`
- Admin UI: `apps/web/src/app/admin/kyc/`
