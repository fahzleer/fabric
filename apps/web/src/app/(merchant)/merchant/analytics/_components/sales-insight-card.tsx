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
    <div className="rounded-xl border border-info/30 bg-gradient-to-br from-info/10 to-transparent p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span aria-hidden>✨</span> AI Insight
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">สรุปและวิเคราะห์ยอดขายด้วย Typhoon</p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-info/40 bg-info/10 px-3 py-1.5 text-xs font-medium text-info transition-colors hover:bg-info/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-info/30 border-t-violet-300" />
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
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {text && (
        <div className="mt-4 space-y-3">
          {text
            .split(/\n\n+/)
            .map((block) => block.trim())
            .filter(Boolean)
            .map((block) => {
              const lines = block
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean);
              const heading = lines[0] ?? block.slice(0, 20);
              const body = lines.slice(1).join(" ");
              return (
                <div key={heading}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-info">
                    {heading}
                  </p>
                  {body && <p className="mt-0.5 text-sm leading-relaxed text-foreground">{body}</p>}
                </div>
              );
            })}
        </div>
      )}

      {!(text || error || pending) && (
        <p className="mt-4 text-xs text-muted-foreground">
          {hasData
            ? "กดปุ่มเพื่อให้ AI สรุปภาพรวมยอดขายและแนะนำสิ่งที่ควรทำต่อ"
            : "ยังไม่มีออเดอร์สำเร็จ — AI จะวิเคราะห์ได้เมื่อมียอดขายแล้ว"}
        </p>
      )}
    </div>
  );
}
