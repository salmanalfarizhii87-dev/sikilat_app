"use client";

import * as React from "react";

/**
 * Menahan Tab di dalam lapisan yang menyatakan `aria-modal`.
 *
 * `Modal` sudah punya penanganan sendiri, tetapi drawer navigasi peserta dan
 * menu admin dibangun terpisah. Tanpa hook ini, fokus keyboard bisa berjalan
 * ke konten di belakang scrim yang tidak terlihat.
 */
export function useFocusTrap(
  active: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
  onEscape?: () => void,
) {
  const escapeRef = React.useRef(onEscape);

  React.useEffect(() => {
    escapeRef.current = onEscape;
  }, [onEscape]);

  React.useEffect(() => {
    if (!active) return;

    const selector =
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        escapeRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = containerRef.current?.querySelectorAll<HTMLElement>(selector);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const current = document.activeElement as HTMLElement | null;
      const inside = !!containerRef.current?.contains(current);

      if (!e.shiftKey && (!inside || current === last)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (!inside || current === first)) {
        e.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const restoreTo = document.activeElement as HTMLElement | null;

    const timer = window.setTimeout(() => {
      containerRef.current?.querySelector<HTMLElement>(selector)?.focus();
    }, 40);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
      restoreTo?.focus?.();
    };
  }, [active, containerRef]);
}
