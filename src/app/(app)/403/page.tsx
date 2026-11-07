import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/primitives";

/**
 * Halaman 403 — dipakai saat pengguna sudah dikenali tapi tidak berhak.
 *
 * Berbeda dari 404 (alamatnya memang tidak ada) dan 401 (belum masuk): di sini
 * pengguna valid, hanya tidak punya izin. Pembedaan ini penting supaya guru
 * tidak bingung antara "salah tautan" dan "akun saya tidak punya akses".
 *
 * Rute statis, belum terhubung ke pengecekan sesi sungguhan. Saat Fase 2
 * terpasang, halaman ini yang diarahkan oleh `proxy.ts` ketika peran tidak
 * mencukupi.
 */

export const metadata: Metadata = {
  title: "Akses ditolak",
  robots: { index: false, follow: false },
};

export default function ForbiddenPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-5 py-10">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        <div className="mx-auto mt-6 grid size-12 place-items-center rounded-card bg-clay-50 text-clay-600">
          <ShieldAlert className="size-5" aria-hidden />
        </div>

        <p className="mt-4 text-[12.5px] font-medium text-muted">Galat 403</p>
        <h1 className="mt-1.5 font-heading text-[24px] font-extrabold leading-tight text-ink">
          Kamu tidak punya akses
        </h1>
        <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-muted">
          Halaman ini hanya untuk admin yang sudah masuk. Kalau kamu merasa seharusnya bisa membuka,
          masuk ulang dengan akun yang diberikan pengelola sekolah.
        </p>

        <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Link href="/admin/login">
            <Button size="md">Masuk sebagai admin</Button>
          </Link>
          <Link href="/">
            <Button variant="secondary" size="md">
              Ke beranda
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
