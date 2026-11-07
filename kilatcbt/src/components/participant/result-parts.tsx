"use client";

import Link from "next/link";
import { ArrowLeft, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useOriginLabel } from "@/lib/client-hooks";
import { useParticipantName } from "@/lib/participant-identity";

/*
 * Sapaan memakai nama yang benar-benar diisi peserta di form awal.
 * Kalau perangkat ini belum pernah mengisi form, yang tampil adalah sapaan
 * netral, bukan nama contoh (DESIGN.md §9).
 */
export function ResultGreeting() {
  const identity = useParticipantName();

  return (
    <h1 className="mt-1.5 font-heading text-[24px] font-extrabold leading-tight text-ink sm:text-[26px]">
      {identity ? `Selesai, ${identity.name}.` : "Ujian sudah dikumpulkan."}
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

/** Unduhan belum punya generator PDF di sisi server, jadi dikatakan apa adanya. */
export function ResultDownload() {
  return (
    <Button
      variant="secondary"
      size="md"
      onClick={() => toast("Unduhan ringkasan belum tersedia di mode demo.")}
    >
      <Download className="size-3.5" aria-hidden /> Unduh ringkasan
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
