"use client";

import { useRouter } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useRef } from "react";

interface ModalProps {
  children: React.ReactNode;
}

export function Modal({ children }: ModalProps) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);

  const closeModal = useCallback(() => {
    router.back();
  }, [router]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeModal();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeModal]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        closeModal();
      }
    },
    [closeModal]
  );

  const handleOverlayKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
      }
    },
    [closeModal]
  );

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
      aria-label="Modal dialog"
    >
      <div className="relative max-w-2xl w-full bg-card rounded-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
        <button
          onClick={closeModal}
          className="absolute top-4 right-4 z-10 rounded-full bg-background/80 p-2 hover:bg-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close modal"
          type="button"
        >
          <svg
            className="h-6 w-6 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {children}
      </div>
    </div>
  );
}
