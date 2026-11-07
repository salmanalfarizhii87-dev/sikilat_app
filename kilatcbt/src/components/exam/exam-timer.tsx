"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCountdown } from "./use-countdown";

/**
 * Timer ujian. Angka memakai tabular supaya lebar tidak berubah setiap detik,
 * dan warna status selalu disertai perubahan latar, bukan hanya teks, agar
 * terbaca walau peserta panik (PRD §9.2).
 */
export function ExamTimer({
  expiresAt,
  hidden,
  onToggle,
  onExpire,
  showWarning = false,
}: {
  expiresAt: string | null;
  hidden?: boolean;
  onToggle?: () => void;
  onExpire?: () => void;
  showWarning?: boolean;
}) {
  const time = useCountdown(expiresAt);
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    if (time.expired && !firedRef.current) {
      firedRef.current = true;
      onExpire?.();
    }
  }, [time.expired, onExpire]);

  if (hidden) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label="Tampilkan waktu"
        className="press flex h-11 items-center gap-1.5 rounded-field px-3 font-heading text-[13px] font-semibold text-muted hover:bg-line-soft"
      >
        <Clock className="size-4" aria-hidden />
        <span className="hidden sm:inline">Waktu</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={onToggle}
        aria-label={onToggle ? "Sembunyikan waktu" : undefined}
        className={cn(
          "press flex h-11 items-center gap-2 rounded-field border px-3 font-heading text-[16px] font-bold tabular transition-colors",
          time.isCritical
            ? "border-clay-200 bg-clay-50 text-clay-700 hover:bg-clay-100"
            : time.isWarning
              ? "border-accent-300 bg-accent-100 text-accent-900 hover:bg-accent-200"
              : "border-line bg-surface text-ink hover:bg-line-soft",
        )}
      >
        <Clock className="size-4 shrink-0" strokeWidth={2.4} aria-hidden />
        <span role="timer" aria-live="polite" className="tracking-tight">
          {time.label}
        </span>
      </button>
      {showWarning && time.isWarning && (
        <span className="mt-0.5 text-[11.5px] font-semibold text-clay-700">
          {time.isCritical ? "Waktu hampir habis" : "Sisa waktu 5 menit"}
        </span>
      )}
    </div>
  );
}
