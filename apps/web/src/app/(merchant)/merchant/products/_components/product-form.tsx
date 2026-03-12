"use client";

import Link from "next/link";
import { useQueryState } from "nuqs";
import { createProductAction, updateProductAction } from "../_lib/actions";

const CATEGORIES = [
  { value: "basic", label: "Basic" },
  { value: "premium", label: "Premium" },
  { value: "limited_edition", label: "Limited Edition" },
  { value: "custom", label: "Custom" },
] as const;

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
] as const;

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

interface ProductFormProps {
  mode: "create" | "edit";
  productId?: string;
  defaultValues?: {
    name?: string;
    description?: string;
    price?: number;
    priceCurrency?: string;
    category?: string;
    status?: string;
    stock?: Record<string, number>;
    images?: { url: string; alt: string; isPrimary: boolean; order: number }[];
  };
}

const inputClass =
  "block w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
const labelClass = "block text-sm font-medium text-gray-300 mb-1";

export function ProductForm({ mode, productId, defaultValues = {} }: ProductFormProps) {
  const [errorMsg] = useQueryState("error");

  const action =
    mode === "create" ? createProductAction : updateProductAction.bind(null, productId ?? "");

  const d = defaultValues;

  return (
    <form
      action={action}
      className="space-y-6 rounded-xl border border-white/10 bg-gray-800/50 p-8"
    >
      {errorMsg && errorMsg !== "" && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{errorMsg}</p>
        </div>
      )}

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

      {/* Description */}
      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={d.description ?? ""}
          placeholder="Product description…"
          className={inputClass}
        />
      </div>

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

      {/* Category */}
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

      {/* Images (JSON hidden field — simplified) */}
      <div>
        <label htmlFor="imageUrl" className={labelClass}>
          Primary image URL
        </label>
        <input
          id="imageUrl"
          type="url"
          placeholder="https://…"
          className={inputClass}
          defaultValue={d.images?.find((i) => i.isPrimary)?.url ?? ""}
          onChange={(e) => {
            const url = e.target.value.trim();
            const hiddenInput =
              e.currentTarget.form?.querySelector<HTMLInputElement>('input[name="images"]');
            if (hiddenInput) {
              hiddenInput.value = JSON.stringify([
                {
                  url: url || "https://placehold.co/400x400",
                  alt: "Product image",
                  isPrimary: true,
                  order: 0,
                },
              ]);
            }
          }}
        />
        <input
          type="hidden"
          name="images"
          defaultValue={JSON.stringify(
            d.images && d.images.length > 0
              ? d.images
              : [
                  {
                    url: "https://placehold.co/400x400",
                    alt: "Product image",
                    isPrimary: true,
                    order: 0,
                  },
                ]
          )}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Link
          href="/merchant/products"
          className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-center text-sm font-medium text-gray-300 hover:bg-white/5"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
        >
          {mode === "create" ? "Create product" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
