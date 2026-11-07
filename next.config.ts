import type { NextConfig } from "next";

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
};

export default nextConfig;
