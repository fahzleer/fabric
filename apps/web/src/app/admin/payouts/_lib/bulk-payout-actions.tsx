"use client";

import { Atom, useAtom } from "@effect-atom/atom-react";
import { Button } from "@fabric/ui";
import { useTransition } from "react";
import { approvePayoutAction } from "./actions";

/** requestId -> ownerUserId, for whichever pending rows are checked. */
const selectedPayoutsAtom = Atom.make<Record<string, string>>({});

export function PayoutSelectCheckbox({
  requestId,
  ownerUserId,
}: {
  requestId: string;
  ownerUserId: string;
}) {
  const [selected, setSelected] = useAtom(selectedPayoutsAtom);
  const checked = requestId in selected;

  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => {
        setSelected((prev) => {
          const next = { ...prev };
          if (e.target.checked) next[requestId] = ownerUserId;
          else delete next[requestId];
          return next;
        });
      }}
      aria-label={`Select payout ${requestId.slice(0, 8)}`}
      className="h-4 w-4 rounded border-border accent-success"
    />
  );
}

export function PayoutSelectAllCheckbox({
  payouts,
}: {
  payouts: { id: string; userId: string }[];
}) {
  const [selected, setSelected] = useAtom(selectedPayoutsAtom);
  const allSelected = payouts.length > 0 && payouts.every((p) => p.id in selected);

  return (
    <input
      type="checkbox"
      checked={allSelected}
      onChange={(e) => {
        if (e.target.checked) {
          setSelected(Object.fromEntries(payouts.map((p) => [p.id, p.userId])));
        } else {
          setSelected({});
        }
      }}
      aria-label="Select all pending payouts"
      className="h-4 w-4 rounded border-border accent-success"
    />
  );
}

export function BulkApproveBar() {
  const [selected, setSelected] = useAtom(selectedPayoutsAtom);
  const [isPending, startTransition] = useTransition();
  const entries = Object.entries(selected);

  if (entries.length === 0) return null;

  function handleBulkApprove() {
    startTransition(async () => {
      await Promise.all(
        entries.map(([requestId, ownerUserId]) => approvePayoutAction(requestId, ownerUserId))
      );
      setSelected({});
    });
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success/10 px-4 py-2.5">
      <span className="text-sm font-medium text-success">
        {entries.length} payout{entries.length !== 1 ? "s" : ""} selected
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSelected({})}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
        <Button
          type="button"
          variant="success"
          size="sm"
          onClick={handleBulkApprove}
          disabled={isPending}
          className="h-7 px-3 text-xs"
        >
          {isPending ? "Approving…" : `Approve ${entries.length} selected`}
        </Button>
      </div>
    </div>
  );
}
