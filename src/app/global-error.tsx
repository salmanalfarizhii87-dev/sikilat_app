"use client";

import * as React from "react";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./(app)/globals.css";

/**
 * Batas galat paling luar.
 *
 * `error.tsx` di dalam route group hanya menangkap galat di bawah layout-nya.
 * Kalau root layout sendiri yang gagal (mis. impor font atau provider rusak),
 * Next.js memakai `global-error.tsx`, yang **menggantikan** root layout sehingga
 * wajib menulis `<html>` dan `<body>` sendiri beserta impor font dan CSS-nya.
 *
 * Karena layout sudah digantikan, komponen apa pun dari aplikasi tidak boleh
 * diasumsikan tersedia di sini. Isi file ini sengaja hanya memakai elemen HTML
 * biasa dan kelas Tailwind yang sudah ada di `globals.css`.
 *
 * Tidak ada tombol "kembali ke beranda" berupa `<Link>`: pada kegagalan sedalam
 * ini, navigasi klien belum tentu hidup. Yang dipakai adalah `window.location`
 * supaya benar-benar memuat ulang dokumen dari server.
 */

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export default function GlobalError({
  error,
}: {
  error: unknown;
  retry: () => void;
}) {
  const digest =
    error instanceof Error && "digest" in error ? String(error.digest ?? "") : "";

  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="id" className={`${outfit.variable} ${jakarta.variable} h-full`}>
      <body className="min-h-full bg-canvas text-ink antialiased">
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-16">
          <p className="font-heading text-[12.5px] font-bold text-clay-600">Galat 500</p>
          <h1 className="mt-2 font-heading text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
            Aplikasi gagal dimuat
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
            Ada gangguan yang membuat halaman ini tidak bisa ditampilkan. Coba muat ulang; kalau
            masih sama, tunggu beberapa menit lalu buka lagi.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="press inline-flex h-11 items-center rounded-field bg-navy-900 px-4 font-heading text-[13.5px] font-semibold text-white"
            >
              Muat ulang halaman
            </button>
          </div>

          {digest && (
            <p className="mt-5 border-t border-line pt-3 font-mono text-[11.5px] text-muted">
              Kode kejadian: {digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
