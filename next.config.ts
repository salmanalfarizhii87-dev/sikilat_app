import type { NextConfig } from "next";

/**
 * Header keamanan (PRD §5.11, T7.6).
 *
 * Catatan penting soal CSP: `script-src` masih memuat `'unsafe-inline'` karena
 * Next.js menyuntikkan skrip inline untuk data hidrasi, dan versi ini belum
 * memakai `proxy.ts` untuk menyisipkan nonce per-permintaan (itu bagian Fase 2).
 * Tanpa `'unsafe-inline'`, aplikasi gagal hidrasi — halaman tampil tapi tidak
 * interaktif, persis gejala yang pernah terjadi saat dev origin diblokir.
 *
 * Yang tetap ditegakkan walau begitu: skrip hanya boleh dari origin sendiri
 * (tidak ada CDN atau domain pihak ketiga), `object-src 'none'` menutup embed
 * Flash/plugin, `base-uri 'self'` mencegah pembajakan URL relatif, dan
 * `frame-ancestors 'none'` menutup clickjacking. Begitu nonce tersedia, ganti
 * `'unsafe-inline'` pada `script-src` menjadi `'nonce-<nilai>' 'strict-dynamic'`.
 */

const isDev = process.env.NODE_ENV !== "production";

/**
 * Saat pengembangan, Turbopack memakai WebSocket untuk HMR dan `eval` untuk
 * source map, jadi dua hal itu dilonggarkan **hanya di dev**. Build produksi
 * tidak pernah memuatnya.
 */
const scriptSrc = ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])];

const connectSrc = [
  "'self'",
  // Supabase self-hosted di VPS: HTTPS ke domain sendiri. Dibuka selebar https:
  // karena domainnya belum diketahui saat build; batasi ke domain pasti setelah
  // URL produksi ditetapkan.
  "https:",
  ...(isDev ? ["ws:", "wss:"] : []),
];

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc.join(" ")}`,
  // React menulis atribut `style` inline (20 tempat), jadi style inline diizinkan.
  "style-src 'self' 'unsafe-inline'",
  // `data:` dan `blob:` untuk pratinjau gambar soal sebelum diunggah (K5).
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src ${connectSrc.join(" ")}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Berpasangan dengan frame-ancestors di atas untuk peramban lama.
  { key: "X-Frame-Options", value: "DENY" },
  // Jangan bocorkan path lengkap ke domain lain, tapi tetap kirim origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Cegah peramban menebak MIME type yang bisa berubah jadi skrip.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Tutup fitur perangkat yang tidak dipakai aplikasi ujian.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
    /*
     * Landing page dan aplikasi punya root layout masing-masing (route group
     * `(landing)` dan `(app)`), jadi tidak ada satu layout yang bisa membungkus
     * halaman 404 untuk seluruh rute. Flag ini mengaktifkan `global-not-found.tsx`.
     */
    globalNotFound: true,
  },
  /*
   * Indikator dev Next.js menutupi tombol di sudut kiri bawah pada layar kecil
   * (terbukti menutup tombol Batal di wizard saat diuji di 390px). Error
   * kompilasi dan runtime tetap muncul walau indikator ini dimatikan.
   */
  devIndicators: false,
  /*
   * Akses dev lewat IP LAN (mis. membuka aplikasi dari HP di Wi-Fi yang sama)
   * diblokir Next.js secara default: bundel klien dan koneksi HMR ditolak
   * sebagai cross-origin, sehingga React tidak pernah hydrate. Gejalanya
   * menyesatkan — halaman tampil normal tapi form melakukan submit HTML biasa,
   * jadi login seperti "tidak mengarah ke dashboard" (URL berakhir di
   * `/admin/login?`).
   *
   * Daftar ini hanya berpengaruh pada `next dev`, bukan build produksi.
   * Tambahkan IP LAN mesin ini bila berubah (`ipconfig`).
   */
  allowedDevOrigins: ["192.168.1.72", "localhost", "127.0.0.1"],

  async headers() {
    return [
      {
        // Semua rute, termasuk aset statis dan halaman error.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
