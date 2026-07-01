"use client";

import { EASE } from "@/lib/motion";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ModalProps {
  children: React.ReactNode;
}

/**
 * Quick-view modal for the intercepted `/product/[id]` route. Close is
 * two-phase: set `isOpen(false)` to let the exit transition play, then
 * `router.back()` fires from `onExitComplete` — so the overlay animates out
 * before Next.js unmounts the parallel route (unmounting immediately would
 * cut the exit animation short).
 */
export function Modal({ children }: ModalProps) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(true);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

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
    <AnimatePresence onExitComplete={() => router.back()}>
      {isOpen && (
        <motion.div
          key="modal-overlay"
          ref={overlayRef}
          onClick={handleOverlayClick}
          onKeyDown={handleOverlayKeyDown}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-8"
          aria-label="Modal dialog"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE.smooth }}
        >
          <motion.div
            className="relative max-w-2xl w-full bg-card rounded-lg shadow-xl overflow-hidden"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25, ease: EASE.editorial }}
          >
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
