"use client";

import { Atom, useAtom } from "@effect-atom/atom-react";
import { type Maybe, None, Some, isSome } from "@fabric/types";
import { useTransition } from "react";
import { approvePayoutAction, rejectPayoutAction } from "./actions";

type Feedback = { type: "ok" | "err"; msg: string };

const activeRejectIdAtom = Atom.make<Maybe<string>>(None());
const rejectReasonAtom = Atom.make("");
const feedbackMapAtom = Atom.make<Record<string, Maybe<Feedback>>>({});

interface Props {
  requestId: string;
  ownerUserId: string;
}

export function PayoutActionButtons({ requestId, ownerUserId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [activeRejectId, setActiveRejectId] = useAtom(activeRejectIdAtom);
  const [reason, setReason] = useAtom(rejectReasonAtom);
  const [feedbackMap, setFeedbackMap] = useAtom(feedbackMapAtom);

  const showRejectForm = isSome(activeRejectId) && activeRejectId.value === requestId;
  const feedback = feedbackMap[requestId] ?? None();

  function openRejectForm() {
    setReason("");
    setActiveRejectId(Some(requestId));
  }

  function closeRejectForm() {
    setActiveRejectId(None());
  }

  function setFeedback(value: Maybe<Feedback>) {
    setFeedbackMap((prev) => ({ ...prev, [requestId]: value }));
  }

  function handleApprove() {
    startTransition(async () => {
      const result = await approvePayoutAction(requestId, ownerUserId);
      if (result.error) setFeedback(Some({ type: "err", msg: result.error }));
      else setFeedback(Some({ type: "ok", msg: "Approved ✓" }));
    });
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectPayoutAction(requestId, ownerUserId, reason);
      if (result.error) setFeedback(Some({ type: "err", msg: result.error }));
      else {
        setFeedback(Some({ type: "ok", msg: "Rejected" }));
        closeRejectForm();
      }
    });
  }

  if (isSome(feedback)) {
    return (
      <span
        className={`text-xs font-medium ${feedback.value.type === "ok" ? "text-emerald-400" : "text-red-400"}`}
      >
        {feedback.value.msg}
      </span>
    );
  }

  if (showRejectForm) {
    return (
      <div className="flex flex-col gap-1.5 min-w-50">
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Rejection reason…"
          className="rounded border border-white/10 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 focus:border-red-400 focus:outline-none"
        />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleReject}
            disabled={isPending || !reason.trim()}
            className="flex-1 rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
          >
            {isPending ? "…" : "Confirm reject"}
          </button>
          <button
            type="button"
            onClick={closeRejectForm}
            className="rounded border border-white/10 px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={handleApprove}
        disabled={isPending}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
      >
        {isPending ? "…" : "Approve"}
      </button>
      <button
        type="button"
        onClick={openRejectForm}
        disabled={isPending}
        className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
      >
        Reject
      </button>
    </div>
  );
}
