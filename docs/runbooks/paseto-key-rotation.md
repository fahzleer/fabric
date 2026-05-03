# PASETO Key Rotation Runbook

## Overview

Fabric uses PASETO v3.local tokens with symmetric AES-256-CTR + HMAC-SHA384. The key is a 64-character hex string stored in GCP Secret Manager under the name `PASETO_KEY`.

The verifier supports a rolling rotation window: a `previous` key remains valid for **8 days** after a new `current` key is set, giving all active sessions time to expire naturally (access tokens: 15 min; refresh tokens: 7 days).

## Rotation Steps

### 1. Generate a new key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or using the key manager utility in the codebase:
```bash
cd packages/auth && bun -e "import { generateKeyHex } from './src/paseto/key-manager'; console.log(generateKeyHex())"
```

### 2. Stage the new key in Secret Manager

```bash
# Add a new version of the secret with the new key
echo -n "<NEW_HEX_KEY>" | gcloud secrets versions add PASETO_KEY \
  --data-file=- \
  --project=<GCP_PROJECT_ID>
```

### 3. Update environment configuration

For cf-api (Firebase Functions), the secret is loaded automatically from Secret Manager.

For local development, update `.env`:
```
PASETO_KEY=<NEW_HEX_KEY>
```

### 4. Deploy cf-api with the new key

```bash
cd apps/cf-api && bun run deploy
```

The `PasetoVerifierService` constructor accepts fallback keys for the rotation window:

```typescript
// Primary key = new key, fallback = old key (valid for 8 days)
const verifier = new PasetoVerifierService(newKey, [oldKey]);
```

### 5. Monitor for verification failures

Watch logs for `"Token verification failed with all keys"` warnings:

```bash
gcloud logging read 'resource.type="cloud_function" AND textPayload:"Token verification failed"' \
  --project=<GCP_PROJECT_ID> \
  --limit=50
```

### 6. Remove old key after rotation window

After 8 days, remove the fallback key reference and disable the old Secret Manager version:

```bash
gcloud secrets versions disable <OLD_VERSION_NUMBER> \
  --secret=PASETO_KEY \
  --project=<GCP_PROJECT_ID>
```

## Emergency Key Rotation (Compromise)

If the key is suspected to be compromised:

1. Generate a new key immediately (Step 1 above).
2. Deploy with ONLY the new key — do NOT include the old key as fallback.
3. All existing tokens are immediately invalidated. Users must log in again.
4. Revoke all refresh tokens in Firebase RTDB (`/refresh_tokens/*`).
5. Notify affected users if required by your security policy.

## Key Format Requirements

- Must be exactly 64 hexadecimal characters (32 bytes)
- Must be cryptographically random — never derive from passwords or predictable data
- Never commit to source control
- Never log or include in error messages

## Related Files

- `packages/auth/src/paseto/key-manager.ts` — key set management and rotation utilities
- `apps/cf-api/src/infrastructure/auth/paseto-verifier.service.ts` — multi-key verifier
- `apps/cf-api/src/infrastructure/secrets/secret-manager.service.ts` — Secret Manager loader
