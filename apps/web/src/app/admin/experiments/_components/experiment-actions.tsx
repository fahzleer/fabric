"use client";

import type { Experiment } from "@/lib/ab-testing";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  experimentId: string;
  currentStatus: Experiment["status"];
};

export function ExperimentActions({ experimentId, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function changeStatus(status: Experiment["status"]) {
    setLoading(true);
    await fetch(`/api/ab/experiments/${experimentId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(false);
    router.refresh();
  }

  if (currentStatus === "completed") return null;

  return (
    <div className="flex shrink-0 gap-2">
      {currentStatus === "draft" && (
        <button
          type="button"
          onClick={() => changeStatus("running")}
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Start
        </button>
      )}
      {currentStatus === "running" && (
        <>
          <button
            type="button"
            onClick={() => changeStatus("paused")}
            disabled={loading}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
          >
            Pause
          </button>
          <button
            type="button"
            onClick={() => changeStatus("completed")}
            disabled={loading}
            className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
          >
            Complete
          </button>
        </>
      )}
      {currentStatus === "paused" && (
        <button
          type="button"
          onClick={() => changeStatus("running")}
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Resume
        </button>
      )}
    </div>
  );
}
