export type PaymentError =
  | { readonly _tag: "PaymentDeclined"; readonly reason: string }
  | { readonly _tag: "InvalidPaymentToken"; readonly reason: string }
  | { readonly _tag: "PaymentGatewayError"; readonly message: string }
  | { readonly _tag: "InvalidAmount"; readonly cents: number }
  | { readonly _tag: "UnsupportedCurrency"; readonly currency: string };

export const PaymentDeclined = (reason: string): PaymentError => ({
  _tag: "PaymentDeclined",
  reason,
});

export const InvalidPaymentToken = (reason: string): PaymentError => ({
  _tag: "InvalidPaymentToken",
  reason,
});

export const PaymentGatewayError = (message: string): PaymentError => ({
  _tag: "PaymentGatewayError",
  message,
});
