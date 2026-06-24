"use client";

import { isOk } from "@fabric/types";
import Link from "next/link";
import { useQueryState } from "nuqs";
import { memo, useRef, useTransition } from "react";
import { toast } from "sonner";
import {
  createProductAction,
  generateProductContentAction,
  updateProductAction,
} from "../_lib/actions";
import { DescriptionField } from "./description-field";
import { ImageField, type ImageFieldHandle } from "./image-field";
import { ProductSubmitButton } from "./product-submit-button";
import { TaglineField } from "./tagline-field";

const CATEGORIES = [
  { value: "basic", label: "Basic" },
  { value: "premium", label: "Premium" },
  { value: "limited_edition", label: "Limited Edition" },
  { value: "custom", label: "Custom" },
] as const;

const GENRES = [
  { value: "", label: "— ไม่ระบุ —" },
  { value: "emo", label: "Emo" },
  { value: "deathcore", label: "Deathcore" },
  { value: "punk", label: "Punk" },
  { value: "metal", label: "Metal" },
  { value: "hardcore", label: "Hardcore" },
] as const;

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
] as const;

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export interface ProductFormProps {
  mode: "create" | "edit";
  productId?: string;
  defaultValues?: {
    name?: string;
    tagline?: string;
    description?: string;
    price?: number;
    priceCurrency?: string;
    category?: string;
    genre?: string;
    status?: string;
    stock?: Record<string, number>;
    images?: { url: string; alt: string; isPrimary: boolean; order: number }[];
  };
  cancelHref?: string;
  formAction?: (formData: FormData) => Promise<void>;
}

const inputClass =
  "block w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
const labelClass = "block text-sm font-medium text-gray-300 mb-1";

export const ProductForm = memo(function ProductForm({
  mode,
  productId,
  defaultValues = {},
  cancelHref = "/merchant/products",
  formAction: formActionProp,
}: ProductFormProps) {
  const [errorMsg] = useQueryState("error");
  const [pendingAll, startAllTransition] = useTransition();

  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const taglineRef = useRef<HTMLInputElement>(null);
  const imageFieldRef = useRef<ImageFieldHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const action =
    formActionProp ??
    (mode === "create" ? createProductAction : updateProductAction.bind(null, productId ?? ""));

  const d = defaultValues;

  function handleGenerateAll() {
    const form = formRef.current;
    if (!form) return;

    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) {
      toast.error("กรุณากรอกชื่อสินค้าก่อนจึงจะให้ AI ช่วยเขียนได้");
      return;
    }

    startAllTransition(async () => {
      const result = await generateProductContentAction({
        name,
        category: String(fd.get("category") ?? "basic"),
        price: Number.parseFloat(String(fd.get("price") ?? "0")),
        currency: String(fd.get("priceCurrency") ?? "THB"),
      });

      if (isOk(result)) {
        if (taglineRef.current) taglineRef.current.value = result.value.tagline;
        if (descriptionRef.current) descriptionRef.current.value = result.value.description;
        imageFieldRef.current?.setAlt(result.value.altText);
        toast.success("AI ร่างเนื้อหาทั้งหมดให้แล้ว — แก้ไขได้ตามต้องการ");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-6 rounded-xl border border-white/10 bg-gray-800/50 p-8"
    >
      {errorMsg && errorMsg !== "" && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{errorMsg}</p>
        </div>
      )}

      {/* AI bundle generator */}
      <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-emerald-300">✨ AI Draft</p>
          <p className="text-xs text-emerald-300/70">
            Generate tagline, description, and alt text in one click
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerateAll}
          disabled={pendingAll}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendingAll ? "กำลังเขียน…" : "Generate all"}
        </button>
      </div>

      {/* Name */}
      <div>
        <label htmlFor="name" className={labelClass}>
          Product name *
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={d.name ?? ""}
          placeholder="T-Shirt, Hoodie…"
          className={inputClass}
        />
      </div>

      {/* Tagline (with AI assist) */}
      <TaglineField ref={taglineRef} defaultValue={d.tagline} />

      {/* Description (with AI assist) */}
      <DescriptionField ref={descriptionRef} defaultValue={d.description} />

      {/* Price + Currency */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="price" className={labelClass}>
            Price *
          </label>
          <input
            id="price"
            name="price"
            type="number"
            required
            min="0.01"
            step="0.01"
            defaultValue={d.price ?? ""}
            placeholder="599.00"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-500">Enter price in baht (e.g., 599 = ฿599.00)</p>
        </div>
        <div>
          <label htmlFor="priceCurrency" className={labelClass}>
            Currency
          </label>
          <select
            id="priceCurrency"
            name="priceCurrency"
            defaultValue={d.priceCurrency ?? "THB"}
            className={inputClass}
          >
            <option value="THB">THB — Thai Baht</option>
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="SGD">SGD — Singapore Dollar</option>
          </select>
        </div>
      </div>

      {/* Category + Genre */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="category" className={labelClass}>
            Category *
          </label>
          <select
            id="category"
            name="category"
            required
            defaultValue={d.category ?? "basic"}
            className={inputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="genre" className={labelClass}>
            Genre
          </label>
          <select id="genre" name="genre" defaultValue={d.genre ?? ""} className={inputClass}>
            {GENRES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status (edit mode only) */}
      {mode === "edit" && (
        <div>
          <label htmlFor="status" className={labelClass}>
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={d.status ?? "draft"}
            className={inputClass}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Stock by size */}
      <fieldset>
        <legend className="text-sm font-medium text-gray-300 mb-3">Stock per size</legend>
        <div className="grid grid-cols-3 gap-3">
          {SIZES.map((size) => (
            <div key={size}>
              <label htmlFor={`stock-${size}`} className="block text-xs text-gray-400 mb-1">
                {size}
              </label>
              <input
                id={`stock-${size}`}
                name={`stock[${size}]`}
                type="number"
                min="0"
                defaultValue={d.stock?.[size] ?? 0}
                className={inputClass}
              />
            </div>
          ))}
        </div>
      </fieldset>

      {/* Images (with AI alt-text assist) */}
      <ImageField ref={imageFieldRef} defaultImages={d.images} />

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Link
          href={cancelHref}
          className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-center text-sm font-medium text-gray-300 hover:bg-white/5"
        >
          Cancel
        </Link>
        <ProductSubmitButton mode={mode} />
      </div>
    </form>
  );
});
