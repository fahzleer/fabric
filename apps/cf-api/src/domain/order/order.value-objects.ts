export type {
  OrderId,
  OrderStatus,
  ShippingAddress,
  ShippingAddressError,
} from "@fabric/types";

export {
  makeOrderId,
  makeShippingAddress,
  VALID_ORDER_STATUS_TRANSITIONS,
  canTransitionOrderStatus,
} from "@fabric/types";
