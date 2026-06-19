"use client";

import { isOk } from "@fabric/types";
import { useState, useTransition } from "react";
import { generateSalesInsightAction } from "../_lib/actions";

export function SalesInsightCard({ hasData }: { hasData: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await generateSalesInsightAction();
      if (isOk(result)) {
        setText(result.value);
      } else {
        setText(null);
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-transparent p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <span aria-hidden>✨</span> AI Insight
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">สรุปและวิเคราะห์ยอดขายด้วย Typhoon</p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-violet-300/30 border-t-violet-300" />
              กำลังวิเคราะห์…
            </>
          ) : text ? (
            "วิเคราะห์ใหม่"
          ) : (
            "วิเคราะห์ด้วย AI"
          )}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {text && (
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-gray-200">{text}</p>
      )}

      {!(text || error || pending) && (
        <p className="mt-4 text-xs text-gray-500">
          {hasData
            ? "กดปุ่มเพื่อให้ AI สรุปภาพรวมยอดขายและแนะนำสิ่งที่ควรทำต่อ"
            : "ยังไม่มีออเดอร์สำเร็จ — AI จะวิเคราะห์ได้เมื่อมียอดขายแล้ว"}
        </p>
      )}
    </div>
  );
}
