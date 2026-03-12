# Admin Operations Guide

This guide covers the admin portal functionality, day-to-day operational tasks, and backend-only admin procedures.

---

## Admin Portal Overview

The admin portal lives at `/admin/**` in apps/web. Access requires `role: "admin"` in the PostgreSQL `user` table.

```
/admin/dashboard    — platform metrics (orders, revenue, buyers, churn)
/admin/payouts      — pending payout queue with approve/reject actions
/admin/inventory    — inventory balance, shrinkage detection, audit reports
/admin/affiliates   — affiliate program management (UI complete, backend pending)
/admin/invoices     — invoice listing
```

### Granting admin access

```sql
-- Direct PostgreSQL update (no UI for this)
UPDATE "user" SET role = 'admin' WHERE email = 'ops@fabric.co';
```

After updating PostgreSQL, the user must log out and log back in (better-auth session is cached for 5 minutes; the role is re-read on next full session validation).

---

## Payout Queue

### Workflow

1. Merchant requests a payout via `/merchant/payouts/request` (minimum ฿100)
2. Request appears in the pending queue at `GET /admin/payouts`
3. Admin reviews: amount, bank details, merchant ID, request date
4. Admin clicks **Approve** or **Reject with reason**

### Admin portal UI (`/admin/payouts`)

Displays a table of pending payouts with:
- Date submitted
- Merchant user ID (truncated)
- Amount in baht (converted from cents)
- Bank details (free text — manual verification required)
- Status badge
- Action buttons: Approve | Reject

Footer shows total pending amount.

### Backend calls

**Approve:**
```
PATCH /admin/payouts/:requestId/approve
Header: Authorization: Bearer <admin PASETO token>
Body: { ownerUserId: string }
```

**Reject:**
```
PATCH /admin/payouts/:requestId/reject
Header: Authorization: Bearer <admin PASETO token>
Body: { ownerUserId: string, reason: string }
```

Both actions call server actions in `admin/payouts/_lib/actions.ts`:

```typescript
// actions.ts
export async function approvePayoutAction(requestId: string, ownerUserId: string) {
  const api = await createMerchantApi()
  if (api.role !== "admin") return { error: "Forbidden" }

  const result = await api.approvePayout(requestId, ownerUserId)
  if (!result.ok) return { error: result.error }

  revalidatePath("/admin/payouts")
  return { success: true }
}
```

### Firebase state on approval

`approvePayout()` in `PayoutService` calls `payoutRepo.approvePayout()`, which:
1. Reads current payout request at `payouts/{requestId}` (validates `status === "pending"`)
2. Sets `status: "approved"`, `approvedAt: now`, `approvedBy: adminUserId`
3. Atomically increments `merchants/{ownerUserId}/paidOutCents` by the payout amount
4. Dual-writes: updates both `payouts/{requestId}` and the merchant's copy

**No automated bank transfer is implemented.** The "approve" action only marks the database record. Actual money movement is manual (bank transfer by the operations team).

---

## Inventory Control (`/admin/inventory`)

### Data sources

Inventory data comes from **PostgreSQL** (not Firebase RTDB). The `admin-db.ts` client connects to the `fabric` database with a 3-connection pool.

Tables used:
- `inventory_balance` view — `total_received - total_sold = expected_on_hand`
- `stock_audit` table — audit records with variance calculations
- `shrinkage_charge` table — shrinkage charge records

### Page features

- **Summary cards:** Products tracked, total on-hand (expected), total shrinkage in ฿ (90-day window)
- **Audit type pills:** spot_10pct, full_50pct, full_100pct with counts and variance summaries
- **Balance table:** Per-SKU running balance with last audit date, last count, variance, and ฿ shrinkage
- **Shrinkage highlighting:** Rows with negative variance (`last_variance_units < 0`) show red background

### Submitting inventory

There is no UI for submitting inventory receipts or audits. Use the API directly:

```bash
# Record a stock receipt (delivery arrived)
curl -X POST https://api.fabric.co/inventory/receipts \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "abc-123",
    "storeId": "store-456",
    "quantity": 100,
    "unitCostBaht": 150,
    "lotId": "LOT-2026-03",
    "receivedAt": "2026-03-11T10:00:00Z"
  }'

# Record a stock audit
curl -X POST https://api.fabric.co/inventory/audits \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "abc-123",
    "storeId": "store-456",
    "countedQuantity": 95,
    "auditType": "spot_10pct",
    "auditedAt": "2026-03-11T14:00:00Z"
  }'
```

### Shrinkage calculation

`variance_units = last_counted_quantity - expected_on_hand`

Negative variance = shrinkage.

`shrinkage_baht = |variance_units| × unit_price_baht`

The admin charges shrinkage to employees via `POST /inventory/shrinkage-charges`. This records the charge but does not deduct from payroll automatically.

---

## Dashboard Metrics (`/admin/dashboard`)

Four key metrics fetched from `getDashboardStats()` in `admin/dashboard/_lib/queries.ts` (PostgreSQL queries):

| Metric | Calculation |
|--------|-------------|
| Total Orders | `SELECT COUNT(*) FROM orders` |
| Total Revenue | `SELECT SUM(total_amount_cents) FROM orders WHERE status = 'confirmed'` |
| Active Buyers (30d) | `SELECT COUNT(DISTINCT user_id) FROM orders WHERE placed_at > now() - interval '30 days'` |
| Churn Rate | Estimated from last-30-day vs prior-30-day active buyer delta |

---

## Affiliates (`/admin/affiliates`)

The affiliates page is **UI-complete but uses mock data**. The affiliate domain types exist in `packages/types/src/affiliate.types.ts` but no backend service or routes exist yet.

Current sections (all mock data):
- **Summary Report:** all-time, YTD, MTD revenue attribution
- **Earnings per Affiliate:** program, commission %, earnings breakdown
- **Affiliate Links:** per-platform URLs (TikTok, YouTube, Instagram, Facebook, X, LinkedIn)
- **Payout Tracking:** monthly payout history
- **Content Pipeline:** Kanban board (draft → creating → editing → ready_to_post → published)
- **Platform Management:** platform settings
- **Contacts Management:** prospect tracking with ContactStatus FSM

Do not build backend features for affiliates until Phase 6.

---

## Manual Admin Procedures

### Force-cancel a stuck order

If an order is stuck in `pending` (payment webhook was never received):

```bash
# Direct Firebase write — use with extreme caution
firebase database:update /orders/<orderId> \
  --data '{"status":"cancelled","updatedAt":"2026-03-11T10:00:00Z"}'
```

Then restore the reserved stock manually (update `product_current/{productId}/stock/{size}` in Firebase).

### Manually issue a PASETO token (admin)

For one-off API testing without going through the browser:

```bash
# From apps/cf-api directory
bun run scripts/issue-admin-token.ts --userId=<uid> --role=admin
```

Token expires in 15 minutes.

### View activity audit log

```bash
# All events for a user (Firebase CLI)
firebase database:get /activity_log \
  --orderBy=userId \
  --equalTo=<userId> \
  --limitToLast=50
```

### Inspect token blacklist

```bash
firebase database:get /token_blacklist/<jti>
```

Returns the blacklist entry if the token was revoked, null otherwise.

### Check rate limit state

Memcached keys follow the pattern `rate_limit:<path>:<ip>`. Use `memcached-tool` or a client to inspect:

```
stats
get rate_limit:/auth/login:1.2.3.4
```

---

## Operational Checklist (New Merchant Onboarding)

1. Merchant registers at `/auth/register/store` (creates PostgreSQL `user` + Firebase `users/{id}` + `merchants/{id}`)
2. Verify merchant profile exists: `firebase database:get /merchants/<userId>`
3. Confirm plan is `free` and `planStatus` is `active`
4. If upgrading to paid plan, ensure `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PROFESSIONAL` env vars are set in Firebase Functions config
5. After first paid subscription, `stripeCustomerId` will be populated in `merchants/{userId}`

## Operational Checklist (Payout Processing)

1. Check `/admin/payouts` for pending requests
2. Verify bank details with the merchant out-of-band (phone/email) — the `bankInfo` field is free text
3. Perform manual bank transfer (PromptPay QR or bank wire)
4. Click **Approve** in the admin portal — this updates `paidOutCents` atomically
5. Merchant's available balance updates immediately

If you reject a payout, the merchant sees the rejection reason in their payout history. Their available balance is unchanged.
