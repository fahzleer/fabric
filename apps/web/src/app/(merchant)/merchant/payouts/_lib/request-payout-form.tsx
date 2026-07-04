"use client";

import { useActionState } from "react";
import { type RequestPayoutState, requestPayoutAction } from "./actions";

const INITIAL_STATE: RequestPayoutState = {};
const MINIMUM_PAYOUT_CENTS = 10_000;

const BANKS = [
  "Kasikorn Bank (KBank)",
  "Siam Commercial Bank (SCB)",
  "Bangkok Bank",
  "Krungthai Bank",
  "Bank of Ayudhya (Krungsri)",
  "TMBThanachart Bank (ttb)",
  "Other",
] as const;

const inputClass =
  "w-full rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const labelClass = "block text-sm font-medium text-foreground mb-1.5";

export function RequestPayoutForm({ availableBalanceCents }: { availableBalanceCents: number }) {
  const [state, formAction, pending] = useActionState(requestPayoutAction, INITIAL_STATE);

  const availableBaht = (availableBalanceCents / 100).toFixed(2);
  const belowMinimum = availableBalanceCents < MINIMUM_PAYOUT_CENTS;

  if (state.success) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-5 text-sm text-success space-y-1">
        <p className="font-semibold">✓ Withdrawal request submitted</p>
        <p className="text-success/70">We'll review it within 2 business days.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* Amount field */}
      <div>
        <label htmlFor="amountBaht" className={labelClass}>
          Withdrawal amount (฿)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
            ฿
          </span>
          <input
            id="amountBaht"
            name="amountBaht"
            type="number"
            min={100}
            max={availableBalanceCents / 100}
            step={1}
            placeholder="500"
            required
            disabled={belowMinimum}
            className="w-full rounded-lg border border-border bg-muted pl-8 pr-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Minimum withdrawal: ฿100</p>
      </div>

      {/* Bank account details — structured fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="bankName" className={labelClass}>
            Bank
          </label>
          <select
            id="bankName"
            name="bankName"
            required
            disabled={belowMinimum}
            className={inputClass}
          >
            <option value="">Select bank…</option>
            {BANKS.map((bank) => (
              <option key={bank} value={bank}>
                {bank}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="accountNumber" className={labelClass}>
            Account number
          </label>
          <input
            id="accountNumber"
            name="accountNumber"
            type="text"
            inputMode="numeric"
            placeholder="123-4-56789-0"
            required
            disabled={belowMinimum}
            className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
          />
        </div>
        <div>
          <label htmlFor="accountHolder" className={labelClass}>
            Account holder name
          </label>
          <input
            id="accountHolder"
            name="accountHolder"
            type="text"
            placeholder="John Doe"
            required
            disabled={belowMinimum}
            className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
          />
        </div>
      </div>

      {belowMinimum && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning">
          Your available balance (฿{availableBaht}) is below the ฿100 minimum — keep selling to
          unlock withdrawals.
        </div>
      )}

      {/* Error feedback */}
      {state.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || belowMinimum}
        className="w-full rounded-lg bg-success px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-success disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        {pending ? "Submitting…" : "Request withdrawal"}
      </button>
    </form>
  );
}
