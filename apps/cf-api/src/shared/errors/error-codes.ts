export interface ErrorDescriptor {
  readonly code: string;
  readonly status: number;
  readonly message: string;
}

export const ERROR_CODES = {
  UNAUTHORIZED: { code: "UNAUTHORIZED", status: 401, message: "Authentication required" },
  INVALID_CREDENTIALS: {
    code: "INVALID_CREDENTIALS",
    status: 401,
    message: "Invalid email or password",
  },
  TOKEN_EXPIRED: { code: "TOKEN_EXPIRED", status: 401, message: "Token has expired" },
  TOKEN_REVOKED: { code: "TOKEN_REVOKED", status: 401, message: "Token has been revoked" },
  FORBIDDEN: { code: "FORBIDDEN", status: 403, message: "Insufficient permissions" },
  ACCOUNT_LOCKED: { code: "ACCOUNT_LOCKED", status: 423, message: "Account temporarily locked" },

  NOT_FOUND: { code: "NOT_FOUND", status: 404, message: "Resource not found" },
  PRODUCT_NOT_FOUND: { code: "PRODUCT_NOT_FOUND", status: 404, message: "Product not found" },
  ORDER_NOT_FOUND: { code: "ORDER_NOT_FOUND", status: 404, message: "Order not found" },
  CART_NOT_FOUND: { code: "CART_NOT_FOUND", status: 404, message: "Cart not found" },
  VOUCHER_NOT_FOUND: { code: "VOUCHER_NOT_FOUND", status: 404, message: "Voucher not found" },
  USER_NOT_FOUND: { code: "USER_NOT_FOUND", status: 404, message: "User not found" },

  CONFLICT: { code: "CONFLICT", status: 409, message: "Resource conflict" },
  PRODUCT_OUT_OF_STOCK: {
    code: "PRODUCT_OUT_OF_STOCK",
    status: 409,
    message: "Product out of stock",
  },
  VOUCHER_EXPIRED: { code: "VOUCHER_EXPIRED", status: 409, message: "Voucher has expired" },
  VOUCHER_USED: { code: "VOUCHER_USED", status: 409, message: "Voucher has already been used" },
  EMAIL_TAKEN: { code: "EMAIL_TAKEN", status: 409, message: "Email address already registered" },

  VALIDATION_ERROR: { code: "VALIDATION_ERROR", status: 422, message: "Validation failed" },

  RATE_LIMITED: { code: "RATE_LIMITED", status: 429, message: "Too many requests" },

  INTERNAL: { code: "INTERNAL_ERROR", status: 500, message: "Internal server error" },
  REPOSITORY_ERROR: { code: "REPOSITORY_ERROR", status: 500, message: "Data store error" },
  SERVICE_UNAVAILABLE: {
    code: "SERVICE_UNAVAILABLE",
    status: 503,
    message: "Service temporarily unavailable",
  },
} as const satisfies Record<string, ErrorDescriptor>;

export type ErrorCode = keyof typeof ERROR_CODES;

export function domainErrorToDescriptor(tag: string): ErrorDescriptor {
  switch (tag) {
    case "ProductNotFoundError":
      return ERROR_CODES.PRODUCT_NOT_FOUND;
    case "OrderNotFoundError":
      return ERROR_CODES.ORDER_NOT_FOUND;
    case "CartNotFoundError":
      return ERROR_CODES.CART_NOT_FOUND;
    case "VoucherNotFoundError":
      return ERROR_CODES.VOUCHER_NOT_FOUND;
    case "UserNotFoundError":
      return ERROR_CODES.USER_NOT_FOUND;
    case "ProductOutOfStockError":
      return ERROR_CODES.PRODUCT_OUT_OF_STOCK;
    case "VoucherExpiredError":
      return ERROR_CODES.VOUCHER_EXPIRED;
    case "VoucherAlreadyUsedError":
      return ERROR_CODES.VOUCHER_USED;
    case "EmailAlreadyTakenError":
      return ERROR_CODES.EMAIL_TAKEN;
    case "InvalidCredentialsError":
      return ERROR_CODES.INVALID_CREDENTIALS;
    case "AccountLockedError":
      return ERROR_CODES.ACCOUNT_LOCKED;
    case "RepositoryError":
      return ERROR_CODES.REPOSITORY_ERROR;
    default:
      return ERROR_CODES.INTERNAL;
  }
}
