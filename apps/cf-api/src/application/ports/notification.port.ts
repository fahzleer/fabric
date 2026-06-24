export interface OrderPlacedPayload {
  orderId: string;
  userId: string;
  userEmail?: string;
  customerPhone?: string;
  recipientName?: string;
  totalCents: number;
  currency: string;
  itemCount: number;
}

export interface NotificationPort {
  notifyOrderPlaced(payload: OrderPlacedPayload): Promise<void>;
}
