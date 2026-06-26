"use client";

import { Button } from "@fabric/ui";
import { useFormStatus } from "react-dom";

export function ProductSubmitButton({ mode }: { mode: "create" | "edit" }) {
  const { pending } = useFormStatus();
  const label = mode === "create" ? "Create product" : "Save changes";
  return (
    <Button type="submit" variant="success" disabled={pending} className="flex-1">
      {pending ? `${label}…` : label}
    </Button>
  );
}
