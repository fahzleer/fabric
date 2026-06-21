"use client";

import { useFormStatus } from "react-dom";

export function ProductSubmitButton({ mode }: { mode: "create" | "edit" }) {
  const { pending } = useFormStatus();
  const label = mode === "create" ? "Create product" : "Save changes";
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? `${label}…` : label}
    </button>
  );
}
