"use client";

import Link from "next/link";
import { CalendarClock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCountdown } from "@/components/exam/use-countdown";
import { formatDateTimeId } from "@/lib/utils";

/**
 * Ditampilkan sebagai ganti formulir mulai ketika ujian belum dibuka atau sudah
 * ditutup. Ujian berjadwal menghitung mundur ke `opensAt`; yang ditutup
 * menjelaskan langkah berikutnya.
 */
export function ClosedNotice({
  state,
  opensAt,
  closesAt,
}: {
  state: "scheduled" | "closed";
  opensAt?: string;
  closesAt?: string;
}) {
  const time = useCountdown(state === "scheduled" ? (opensAt ?? null) : null);

  if (state === "closed") {
    return (
      <div className="rounded-card border border-line bg-surface p-4 sm:p-5">
        <h2 className="font-heading text-[16px] font-bold text-ink">Ujian sudah ditutup</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
          Peserta baru tidak bisa masuk lagi. Kalau kamu sudah mengerjakan, buka tautan hasil yang
          diberikan pembuat ujian untuk melihat nilaimu.
        </p>

        {closesAt && (
          <p className="mt-2 text-[12px] text-muted">
            Ditutup sejak {formatDateTimeId(closesAt)} WIB.
          </p>
        )}

        <div className="mt-4 space-y-2">
          <Button block size="md" variant="secondary" disabled>
            <Lock className="size-4" aria-hidden /> Ujian ditutup
          </Button>
          <Link href="/" className="block">
            <Button block size="md" variant="ghost">
              Kembali ke beranda
            </Button>
          </Link>
        </div>

        <p className="mt-3 rounded-field bg-line-soft px-3 py-2 text-[12px] leading-relaxed text-muted">
          Perlu mengerjakan ulang? Hubungi gurumu untuk membuka ujian kembali atau membuat ujian
          baru.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-accent-200 bg-accent-50 p-4 sm:p-5">
      <h2 className="font-heading text-[16px] font-bold text-ink">Ujian belum dibuka</h2>
      <p className="mt-0.5 text-[12.5px] text-muted">
        Kamu boleh menunggu di halaman ini, tidak perlu memuat ulang.
      </p>

      <div className="mt-3.5 rounded-field border border-accent-200 bg-surface px-4 py-3 text-center">
        <p className="text-[12px] text-muted">Dibuka dalam</p>
        <p
          role="timer"
          aria-live="polite"
          className="mt-1 font-heading text-[30px] font-extrabold tabular leading-none text-ink"
        >
          {opensAt ? time.label : "--:--"}
        </p>
        {opensAt && (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-muted">
            <CalendarClock className="size-3.5" aria-hidden />
            {new Intl.DateTimeFormat("id-ID", {
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Jakarta",
            }).format(new Date(opensAt))}{" "}
            WIB
          </p>
        )}
      </div>

      <Button block size="md" className="mt-3" disabled>
        Menunggu jadwal dibuka
      </Button>
    </div>
  );
}
