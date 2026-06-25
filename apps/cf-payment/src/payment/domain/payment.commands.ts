export type PaymentCommand =
  | {
      readonly _tag: "ChargeCard";
      readonly orderId: string;
      readonly amountCents: number;
      readonly currency: string;
      readonly token: string;
    }
  | {
      readonly _tag: "RecordPayment";
      readonly orderId: string;
      readonly paymentId: string;
      readonly amountCents: number;
    }
  | { readonly _tag: "NotifySuccess"; readonly orderId: string; readonly paymentId: string }
  | { readonly _tag: "NotifyFailure"; readonly orderId: string; readonly reason: string }
  | { readonly _tag: "RefundPayment"; readonly paymentId: string; readonly amountCents: number };
