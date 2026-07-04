"use client";

import { Copy } from "lucide-react";
import { useState } from "react";

/** Copies a full ID to the clipboard — pairs with a truncated ID display so
 *  admins can still act on the full value (e.g. Firebase console lookups)
 *  without a separate detail page. */
export function CopyIdButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable (e.g. insecure context) — silently no-op
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied!" : `Copy full ID: ${value}`}
      aria-label={`Copy full ID ${value}`}
      className="inline-flex items-center justify-center rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      <Copy className="h-3 w-3" aria-hidden="true" />
      {copied && <span className="sr-only">Copied</span>}
    </button>
  );
}
