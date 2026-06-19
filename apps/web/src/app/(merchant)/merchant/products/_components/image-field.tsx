"use client";

import { isOk } from "@fabric/types";
import { forwardRef, useImperativeHandle, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { generateImageAltTextAction } from "../_lib/actions";

const inputClass =
  "block w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
const labelClass = "block text-sm font-medium text-gray-300";
const PLACEHOLDER = "https://placehold.co/400x400";
const DEFAULT_ALT = "Product image";

type Img = { url: string; alt: string; isPrimary: boolean; order: number };

export type ImageFieldHandle = {
  setAlt: (value: string) => void;
};

export const ImageField = forwardRef<ImageFieldHandle, { defaultImages?: Img[] | undefined }>(
  function ImageField({ defaultImages }, ref) {
    const primary = defaultImages?.find((i) => i.isPrimary) ?? defaultImages?.[0];
    const urlRef = useRef<HTMLInputElement>(null);
    const [url, setUrl] = useState(primary?.url ?? "");
    const [alt, setAlt] = useState(primary && primary.alt !== DEFAULT_ALT ? primary.alt : "");
    const [pending, startTransition] = useTransition();

    useImperativeHandle(ref, () => ({
      setAlt: (value: string) => setAlt(value),
    }));

    const imagesJson = JSON.stringify([
      {
        url: url.trim() || PLACEHOLDER,
        alt: alt.trim() || DEFAULT_ALT,
        isPrimary: true,
        order: 0,
      },
    ]);

    function handleGenerate() {
      const form = urlRef.current?.form;
      if (!form) return;

      const fd = new FormData(form);
      const name = String(fd.get("name") ?? "").trim();
      if (!name) {
        toast.error("กรุณากรอกชื่อสินค้าก่อนจึงจะให้ AI ช่วยเขียนได้");
        return;
      }

      startTransition(async () => {
        const result = await generateImageAltTextAction({
          name,
          category: String(fd.get("category") ?? "basic"),
        });

        if (isOk(result)) {
          setAlt(result.value);
          toast.success("AI สร้าง alt text ให้แล้ว — แก้ไขได้ตามต้องการ");
        } else {
          toast.error(result.error);
        }
      });
    }

    return (
      <div className="space-y-3">
        <div>
          <label htmlFor="imageUrl" className={`${labelClass} mb-1`}>
            Primary image URL
          </label>
          <input
            ref={urlRef}
            id="imageUrl"
            type="url"
            placeholder="https://…"
            className={inputClass}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="imageAlt" className={labelClass}>
              Image alt text
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
                <>✨ สร้าง alt text</>
              )}
            </button>
          </div>
          <input
            id="imageAlt"
            type="text"
            maxLength={100}
            placeholder="คำอธิบายรูปเพื่อ accessibility และ SEO"
            className={inputClass}
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
          />
        </div>

        <input type="hidden" name="images" value={imagesJson} />
      </div>
    );
  }
);
