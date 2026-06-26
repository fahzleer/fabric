"use client";

import { Button } from "@fabric/ui";
import { useFormStatus } from "react-dom";

export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="success" disabled={pending} className="w-full">
      {pending ? "Creating store…" : "Create store"}
    </Button>
  );
}
