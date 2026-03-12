import type { RepositoryError, Result } from "@fabric/types";

export type ActivityEventType =
  | "product_viewed"
  | "product_created"
  | "product_updated"
  | "product_deleted"
  | "cart_item_added"
  | "cart_item_removed"
  | "cart_item_quantity_updated"
  | "checkout_started"
  | "order_placed"
  | "order_confirmed"
  | "order_failed"
  | "page_viewed"
  | "user_registered"
  | "user_logged_in"
  | "user_logged_out"
  | "user_login_failed";

export type ActivityEvent = {
  readonly id: string;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly eventType: ActivityEventType;
  readonly eventData?: Record<string, unknown>;
  readonly ipAddress?: string;
  readonly userAgent?: string;
};

export interface ActivityRepositoryPort {
  track(event: ActivityEvent): Promise<Result<void, RepositoryError>>;
}

export const ACTIVITY_REPOSITORY = Symbol("ACTIVITY_REPOSITORY");
