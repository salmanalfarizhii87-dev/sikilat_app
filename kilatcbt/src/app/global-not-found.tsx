import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import "./(app)/globals.css";

/**
 * 404 global untuk seluruh aplikasi.
 *
 * Sejak landing page punya root layout sendiri (`(landing)`) dan aplikasi punya
 * root layout sendiri (`(app)`), tidak ada satu layout yang bisa membungkus 404
 * untuk semua rute. Next.js 16 menyediakan `global-not-found` untuk kasus ini:
 * file ini mengembalikan dokumen HTML penuh dan melewati layout mana pun, jadi
 * font dan CSS harus diimpor sendiri di sini.
 *
 * Gaya visualnya mengikuti aplikasi (navy, kertas, amber), bukan landing page,
 * karena URL yang salah paling sering berasal dari tautan ujian atau kode yang
 * salah ketik.
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

export const metadata: Metadata = {
  title: "Halaman tidak ditemukan · siKilat",
  description: "Alamat ini tidak ada. Periksa kembali tautan atau kode ujian yang kamu pakai.",
};

export default function GlobalNotFound() {
  return (
    <html lang="id" className={`${outfit.variable} ${jakarta.variable} h-full`}>
      <body className="min-h-full bg-canvas text-ink antialiased">
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-16">
          <p className="font-heading text-[12.5px] font-bold text-muted">Galat 404</p>
          <h1 className="mt-2 font-heading text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
            Halaman ini tidak ada
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
            Alamat yang kamu buka tidak ditemukan. Kalau ini tautan ujian, minta gurumu mengirim
            ulang. Kalau kamu memasukkan kode, periksa lagi huruf dan angkanya.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/"
              className="press inline-flex h-11 items-center rounded-field bg-navy-900 px-4 font-heading text-[13.5px] font-semibold text-white"
            >
              Kembali ke beranda
            </Link>
            <Link
              href="/admin/login"
              className="press inline-flex h-11 items-center rounded-field border border-line bg-surface px-4 font-heading text-[13.5px] font-semibold text-ink-soft"
            >
              Masuk admin
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
