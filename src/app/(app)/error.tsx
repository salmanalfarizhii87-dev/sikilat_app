"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/primitives";

/**
 * Batas galat untuk seluruh rute. Sebelumnya tidak ada `error.tsx`, jadi galat
 * runtime menampilkan layar bawaan Next.js berbahasa Inggris tanpa jalan keluar.
 *
 * Next.js 16 meneruskan `retry`, bukan `reset`. `digest` dipakai untuk mencocokkan
 * laporan dengan log server tanpa membocorkan pesan galat asli ke peserta.
 */
export default function AppError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const digest =
    error instanceof Error && "digest" in error ? String(error.digest ?? "") : "";

  React.useEffect(() => {
    // Tetap catat ke konsol supaya bisa dilacak saat pengembangan.
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-5 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        <div className="mt-6 rounded-card border border-line bg-surface p-5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4.5 shrink-0 text-clay-600" aria-hidden />
            <div className="min-w-0">
              <h1 className="font-heading text-[19px] font-extrabold leading-tight text-ink">
                Halaman ini gagal dimuat
              </h1>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
                Jawaban yang sudah kamu pilih tetap tersimpan di perangkat ini. Coba muat ulang
                halaman; kalau tetap gagal, kembali ke beranda lalu masuk lagi dengan kode ujian.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button size="md" onClick={() => retry()}>
              <RotateCcw className="size-4" aria-hidden /> Coba muat ulang
            </Button>
            <Link
              href="/"
              className="press inline-flex h-11 items-center justify-center gap-1.5 rounded-field border border-line bg-surface px-4 font-heading text-[13px] font-semibold text-ink-soft hover:bg-line-soft"
            >
              Kembali ke beranda
            </Link>
          </div>

          {digest && (
            <p className="mt-3 border-t border-line pt-2.5 font-mono text-[11.5px] text-muted">
              Kode kejadian: {digest}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
