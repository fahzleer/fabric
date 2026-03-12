"use client";

import { useQueryState } from "nuqs";
import { useRef } from "react";
import { toast } from "sonner";

export function ToastListener() {
  const [successMsg, setSuccessMsg] = useQueryState("success");
  const [errorMsg, setErrorMsg] = useQueryState("toast_error");

  const prevSuccessRef = useRef<string | null | undefined>(undefined);
  const prevErrorRef = useRef<string | null | undefined>(undefined);

  if (successMsg !== prevSuccessRef.current) {
    prevSuccessRef.current = successMsg;
    if (successMsg) {
      const msg = successMsg;
      queueMicrotask(() => {
        toast.success(msg);
        void setSuccessMsg(null);
      });
    }
  }

  if (errorMsg !== prevErrorRef.current) {
    prevErrorRef.current = errorMsg;
    if (errorMsg) {
      const msg = errorMsg;
      queueMicrotask(() => {
        toast.error(msg);
        void setErrorMsg(null);
      });
    }
  }

  return null;
}
