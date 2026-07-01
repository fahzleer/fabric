"use client";

import { isOk } from "@fabric/types";
import { forwardRef, useRef, useTransition } from "react";
import { toast } from "sonner";
import { generateProductDescriptionAction } from "../_lib/actions";

const inputClass =
  "block w-full rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const labelClass = "block text-sm font-medium text-foreground";

export const DescriptionField = forwardRef<
  HTMLTextAreaElement,
  { defaultValue?: string | undefined }
>(function DescriptionField({ defaultValue }, ref) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const [pending, startTransition] = useTransition();

  function handleGenerate() {
    const form = localRef.current?.form;
    if (!form) return;

    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) {
      toast.error("กรุณากรอกชื่อสินค้าก่อนจึงจะให้ AI ช่วยเขียนได้");
      return;
    }

    startTransition(async () => {
      const result = await generateProductDescriptionAction({
        name,
        category: String(fd.get("category") ?? "basic"),
        price: Number.parseFloat(String(fd.get("price") ?? "0")),
        currency: String(fd.get("priceCurrency") ?? "THB"),
      });

      if (isOk(result)) {
        if (localRef.current) localRef.current.value = result.value;
        toast.success("AI ร่างคำบรรยายให้แล้ว — แก้ไขได้ตามต้องการ");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-2.5 py-1 text-xs font-medium text-success transition-colors hover:bg-success/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-success/30 border-t-emerald-300" />
              กำลังเขียน…
            </>
          ) : (
            <>✨ เขียนด้วย AI</>
          )}
        </button>
      </div>
      <textarea
        ref={(node) => {
          localRef.current = node;
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        id="description"
        name="description"
        rows={3}
        defaultValue={defaultValue ?? ""}
        placeholder="Product description…"
        className={inputClass}
      />
      <p className="mt-1 text-xs text-muted-foreground">
        กด “เขียนด้วย AI” เพื่อให้ Typhoon ช่วยร่างคำบรรยายจากชื่อและหมวดหมู่สินค้า
      </p>
    </div>
  );
});
