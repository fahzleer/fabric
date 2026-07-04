export interface FirebaseUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: "customer" | "admin" | "store_owner";
  displayName: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FirebaseProductRecord {
  id: string;
  rev: number;
  ownerId: string;
  name: string;
  description: string;
  tagline: string;
  price: number;
  currency: string;
  category: string;
  genre?: string;
  status: "draft" | "active" | "archived";
  stock: Record<string, number>;
  imageUrls: string[];
  isPrimaryImageFirst: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FirebaseOrderRecord {
  id: string;
  userId: string | null;
  guestEmail: string | null;
  cartId: string;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  totalCents: number;
  shippingCents: number;
  discountCents: number;
  currency: string;
  items: Record<string, FirebaseOrderItemRecord>;
  shippingAddress: FirebaseShippingAddressRecord;
  voucherCode: string | null;
  placedAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  shippedAt: string | null;
  trackingNumber: string | null;
  cancelledAt: string | null;
  paymentId: string | null;
}

export interface FirebaseOrderItemRecord {
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  unitPriceCents: number;
}

export interface FirebaseShippingAddressRecord {
  street: string;
  city: string;
  province: string;
  country: string;
  postalCode: string;
  recipientName: string;
  phone: string;
}

export interface FirebaseCartItemRecord {
  qty: number;
  priceCents: number;
  productName: string;
  size: string;
  addedAt: string;
}

export interface FirebaseVoucherRecord {
  code: string;
  discountTag: "PercentOff" | "FixedOff" | "FreeShipping" | "BuyXGetY";
  discountPct: number;
  discountAmount: number;
  discountBuy: number;
  discountGet: number;
  minOrderCents: number;
  maxUsages: number;
  currentUsages: number;
  validUntilEpoch: number;
  isActive: boolean;
  createdAt: string;
}

export interface FirebaseInventoryReceiptRecord {
  productId: string;
  size: string;
  qty: number;
  type: "restock" | "sale" | "return" | "adjustment";
  createdAt: string;
}

export interface FirebaseEventLogRecord {
  eventId: string;
  eventType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  schemaVersion: number;
  occurredAt: string;
  processedAt: string | null;
}

export interface FirebaseProcessedEventRecord {
  processedAt: string;
}

export interface FirebaseProductsCurrentRecord {
  productId: string;
  ownerId: string;
  name: string;
  price: number;
  currency: string;
  category: string;
  status: string;
  rev: number;
  lastEventAt: string;
}

export interface FirebaseRefreshTokenRecord {
  userId: string;
  tokenFamily: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface FirebaseTokenBlacklistRecord {
  expiresAt: string;
  revokedAt: string;
}

export interface FirebaseLoginAttemptRecord {
  attemptCount: number;
  firstAttemptAt: string;
  lockedUntil: string | null;
  updatedAt: string;
}

export interface FirebaseActivityLogRecord {
  userId: string | null;
  sessionId: string | null;
  eventType: string;
  eventData: Record<string, unknown> | null;
  ipAddress: string;
  userAgent: string;
  occurredAt: string;
}

export interface FirebaseMerchantRecord {
  userId: string;
  storeName: string;
  email: string;
  plan: "free" | "starter" | "professional" | "enterprise";
  planStatus: "active" | "trialing" | "past_due" | "cancelled";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  productCount: number;
  completedOrderCount: number;
  totalRevenueCents: number;
  createdAt: string;
  updatedAt: string;
  planExpiresAt: string | null;
  storeSlug: string | null;
}

export interface FirebaseAffiliateRecord {
  userId: string;
  code: string;
  commissionRate: number;
  totalEarnings: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
