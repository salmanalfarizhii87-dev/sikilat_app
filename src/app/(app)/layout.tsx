import type { Metadata, Viewport } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";

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
  title: {
    default: "siKilat — Ujian Kilat, Tanpa Ribet",
    template: "%s · siKilat",
  },
  description:
    "Platform ujian online ringan: peserta cukup kode ujian dan nama, admin dapat membuat, mengawasi, dan menilai ujian dalam satu tempat.",
  applicationName: "siKilat",
};

export const viewport: Viewport = {
  // Warna bilah peramban di HP: kertas `canvas`, bukan putih, supaya bilah
  // peramban menyatu dengan latar halaman (DESIGN.md §3).
  themeColor: "#f7f6f2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${outfit.variable} ${jakarta.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-canvas text-ink antialiased">
        <QueryProvider>{children}</QueryProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              // Samakan dengan token sistem: radius kartu, garis `line`,
              // dan font isi. Sebelumnya nilai lepas (#e5e7eb, 16px).
              borderRadius: "14px",
              border: "1px solid #dfe3e6",
              fontFamily: "var(--font-jakarta)",
              fontSize: "14px",
            },
          }}
        />
      </body>
    </html>
  );
}
