"use client";

import { useActionState } from "react";
import { type RequestPayoutState, requestPayoutAction } from "./actions";

const INITIAL_STATE: RequestPayoutState = {};

export function RequestPayoutForm({ availableBalanceCents }: { availableBalanceCents: number }) {
  const [state, formAction, pending] = useActionState(requestPayoutAction, INITIAL_STATE);

  const availableBaht = (availableBalanceCents / 100).toFixed(2);

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
        <label htmlFor="amountBaht" className="block text-sm font-medium text-foreground mb-1.5">
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
            className="w-full rounded-lg border border-border bg-muted pl-8 pr-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:border-success focus:outline-none focus:ring-1 focus:ring-success"
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Min ฿100 · Available: ฿{availableBaht}</p>
      </div>

      {/* Bank info field */}
      <div>
        <label htmlFor="bankInfo" className="block text-sm font-medium text-foreground mb-1.5">
          Bank account details
        </label>
        <textarea
          id="bankInfo"
          name="bankInfo"
          rows={2}
          placeholder="e.g. Kasikorn Bank — 123-4-56789-0 — John Doe"
          required
          minLength={5}
          maxLength={200}
          className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:border-success focus:outline-none focus:ring-1 focus:ring-success resize-none"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Bank name, account number, and account holder name
        </p>
      </div>

      {/* Error feedback */}
      {state.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || availableBalanceCents < 10_000}
        className="w-full rounded-lg bg-success px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-success disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        {pending ? "Submitting…" : "Request withdrawal"}
      </button>
    </form>
  );
}
