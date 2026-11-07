"use client";

import Link from "next/link";
import { ArrowLeft, Copy, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useOriginLabel } from "@/lib/client-hooks";

/*
 * Sapaan memakai nama yang tercatat di attempt, dikirim server sebagai prop.
 * Sebelumnya nama dibaca dari `localStorage` — cara itu menampilkan sapaan
 * netral untuk peserta yang membuka tautan hasil di perangkat lain, dan bisa
 * dimanipulasi lewat DevTools.
 */
export function ResultGreeting({ name }: { name: string }) {
  return (
    <h1 className="mt-1.5 font-heading text-[24px] font-extrabold leading-tight text-ink sm:text-[26px]">
      Selesai, {name}.
    </h1>
  );
}

/** Baris tautan hasil: domain diambil dari perangkat, bukan dikarang. */
export function ResultLink({ token }: { token: string }) {
  const origin = useOriginLabel();
  const url = `https://${origin}/hasil/${token}`;

  return (
    <div className="mt-2.5 flex items-center gap-2 rounded-field border border-line bg-canvas px-3 py-2">
      <code className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink-soft">{url}</code>
      <Button
        size="md"
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            toast.success("Tautan hasil disalin");
          } catch {
            toast.error("Gagal menyalin. Salin manual dari kotak di atas.");
          }
        }}
      >
        <Copy className="size-3.5" aria-hidden /> Salin
      </Button>
    </div>
  );
}

/**
 * Cetak/simpan PDF lewat dialog cetak peramban.
 *
 * Sebelumnya tombol ini hanya memunculkan toast "belum tersedia di mode demo".
 * Pembuatan PDF di server belum ada (butuh pustaka tambahan dan template), tetapi
 * mencetak halaman yang sedang terbuka benar-benar berfungsi dan menghasilkan
 * berkas PDF yang sama isinya. Tombol yang bekerja lebih baik daripada tombol
 * yang menjelaskan bahwa ia tidak bekerja.
 */
export function ResultPrint() {
  return (
    <Button variant="secondary" size="md" onClick={() => window.print()}>
      <Printer className="size-3.5" aria-hidden /> Cetak / simpan PDF
    </Button>
  );
}

export function BackHomeLink() {
  return (
    <Link
      href="/"
      className="press inline-flex h-11 items-center justify-center gap-1.5 rounded-field border border-line bg-surface px-4 font-heading text-[13px] font-semibold text-ink-soft hover:bg-line-soft"
    >
      <ArrowLeft className="size-4" aria-hidden /> Kembali ke beranda
    </Link>
  );
}
