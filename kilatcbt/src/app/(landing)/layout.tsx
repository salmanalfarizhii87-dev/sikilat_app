import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-outfit",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "siKilat — Ujian Kilat, Tanpa Ribet",
  description:
    "Buat ujian, bagikan kode, dan lihat hasilnya hari itu juga. Peserta cukup isi nama tanpa akun. Timer dari server, jawaban tersimpan otomatis, penilaian pilihan ganda seketika.",
  openGraph: {
    title: "siKilat — Ujian Kilat, Tanpa Ribet",
    description:
      "Peserta cukup kode ujian dan nama. Admin dapat skor pilihan ganda seketika dan rekap siap unduh.",
    type: "website",
    locale: "id_ID",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={`${outfit.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
