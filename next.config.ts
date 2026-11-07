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
};

export default nextConfig;
