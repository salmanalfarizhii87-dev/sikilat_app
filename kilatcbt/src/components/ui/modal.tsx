"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  icon,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  dismissible?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
      // Dialog modal harus menahan Tab di dalamnya. Tanpa ini, fokus bisa
      // berjalan ke konten di belakang scrim yang tidak terlihat.
      if (e.key !== "Tab") return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const restoreTo = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        "button, [href], input, textarea, [tabindex]:not([tabindex='-1'])",
      );
      focusable?.focus();
    }, 40);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      window.clearTimeout(timer);
      // Kembalikan fokus ke elemen pemicu supaya pengguna keyboard tidak
      // kehilangan posisi setelah dialog ditutup.
      restoreTo?.focus?.();
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;

  const widths = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-2xl",
  } as const;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      {/* Scrim solid, tanpa blur: satu-satunya lapisan yang boleh menutupi konten. */}
      <div
        className="animate-fade absolute inset-0 bg-navy-900/55"
        onClick={() => dismissible && onClose()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={cn(
          "animate-sheet relative z-10 max-h-[92vh] w-full overflow-hidden rounded-t-card border border-line bg-surface shadow-pop sm:rounded-card",
          widths[size],
        )}
      >
        <div className="flex items-start gap-3 px-5 pt-5 sm:px-6">
          {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-[17px] font-bold leading-tight text-ink">{title}</h2>
            {description && (
              <div className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{description}</div>
            )}
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="press -mr-1 flex size-11 shrink-0 items-center justify-center rounded-field text-muted hover:bg-line-soft hover:text-ink"
            >
              <X className="size-4.5" aria-hidden />
            </button>
          )}
        </div>
        {children && (
          <div className="scroll-thin max-h-[62vh] overflow-y-auto px-5 pb-1 pt-4 sm:px-6">
            {children}
          </div>
        )}
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
