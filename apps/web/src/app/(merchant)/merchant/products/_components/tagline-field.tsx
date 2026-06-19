"use client";

import { isOk } from "@fabric/types";
import { forwardRef, useRef, useTransition } from "react";
import { toast } from "sonner";
import { generateProductTaglineAction } from "../_lib/actions";

const inputClass =
  "block w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
const labelClass = "block text-sm font-medium text-gray-300";
const MAX_TAGLINE_CHARS = 80;

export const TaglineField = forwardRef<HTMLInputElement, { defaultValue?: string | undefined }>(
  function TaglineField({ defaultValue }, ref) {
    const localRef = useRef<HTMLInputElement>(null);
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
        const result = await generateProductTaglineAction({
          name,
          category: String(fd.get("category") ?? "basic"),
          description: String(fd.get("description") ?? ""),
        });

        if (isOk(result)) {
          if (localRef.current) localRef.current.value = result.value;
          toast.success("AI ร่าง tagline ให้แล้ว — แก้ไขได้ตามต้องการ");
        } else {
          toast.error(result.error);
        }
      });
    }

    const charLimit = MAX_TAGLINE_CHARS;
    const currentLength = (defaultValue ?? "").length;

    return (
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="tagline" className={labelClass}>
            Tagline
          </label>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-300/30 border-t-emerald-300" />
                กำลังเขียน…
              </>
            ) : (
              <>✨ เขียนด้วย AI</>
            )}
          </button>
        </div>
        <input
          ref={(node) => {
            localRef.current = node;
            if (typeof ref === "function") {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          id="tagline"
          name="tagline"
          type="text"
          maxLength={charLimit}
          defaultValue={defaultValue ?? ""}
          placeholder="ประโยคสั้นๆ ที่โชว์จุดเด่นของสินค้า"
          className={inputClass}
        />
        <p className="mt-1 flex items-center justify-between text-xs text-gray-500">
          <span>แสดงใต้ชื่อสินค้าบนหน้าร้าน กด ✨ เขียนด้วย AI เพื่อให้ Typhoon ช่วยร่าง</span>
          <span className="text-gray-600">
            {currentLength}/{charLimit}
          </span>
        </p>
      </div>
    );
  }
);
