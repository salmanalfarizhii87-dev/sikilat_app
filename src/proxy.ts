import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Guard rute `/admin/*` (T2.2).
 *
 * Dua tugas, dan urutannya penting:
 *
 * 1. **Menyegarkan sesi** lewat `getUser()`. Token akses Supabase berumur pendek
 *    (±1 jam). Di sinilah cookie diperbarui. Tanpa ini, admin yang sedang bekerja
 *    tiba-tiba kehilangan sesi di tengah pengeditan.
 *    `getUser()` dipakai, bukan `getSession()`: hanya `getUser()` yang
 *    memverifikasi tanda tangan token ke server Auth. `getSession()` sekadar
 *    mempercayai isi cookie, jadi cookie palsu akan lolos.
 * 2. **Mengalihkan** pengunjung tanpa sesi ke halaman masuk, dan admin yang sudah
 *    masuk menjauh dari halaman masuk.
 *
 * Catatan soal flag cookie: `@supabase/ssr` memakai `httpOnly: false` secara
 * bawaan, dan itu memang disengaja — klien browser membaca cookie sesi lewat
 * `document.cookie` untuk menyegarkan token. Memaksakan `httpOnly: true` akan
 * memutus penyegaran token di browser dan mengeluarkan admin diam-diam di tengah
 * pengerjaan.
 *
 * Risiko sisanya adalah XSS yang membaca token, dan itu ditekan oleh CSP ketat di
 * `next.config.ts` (`script-src 'self'`, tanpa skrip pihak ketiga). Begitu CSP
 * berbasis nonce terpasang, tinjau lagi apakah sesi bisa dipindah ke cookie
 * httpOnly dengan penyegaran hanya di server.
 *
 * Batasan yang disengaja: berkas ini **hanya** menanyakan "ada sesi atau tidak".
 * Ia tidak menanyakan "apakah akun ini admin", karena setiap permintaan akan
 * memicu satu query ke tabel `admins` — mahal, dan itu tugas `requireAdmin()` di
 * Server Component/Action yang memang butuh kepastian itu. RLS di database tetap
 * menjadi pengaman terakhir untuk data.
 *
 * Catatan Next.js 16: berkas ini bernama `proxy.ts` (dulu `middleware.ts`) dan
 * berjalan di runtime Node.js. `matcher` di bawah memastikan berkas statis dan
 * halaman peserta tidak ikut diproses — halaman peserta justru harus bisa dibuka
 * tanpa sesi.
 */

const LOGIN_PATH = "/admin/login";

/** Cocokkan `/admin` dan `/admin/...`, tapi bukan `/admin/login`. */
function isProtectedAdminPath(pathname: string): boolean {
  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) return false;
  return pathname !== LOGIN_PATH;
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  /*
   * Tanpa konfigurasi Supabase, jangan menebak. Meneruskan permintaan lebih baik
   * daripada redirect tanpa akhir: halaman akan menampilkan galat konfigurasi
   * yang jelas, bukan lingkaran pengalihan.
   */
  if (!url || !anonKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Tulis ke request agar Server Component pada permintaan ini ikut melihat
        // token yang sudah disegarkan, lalu ke response agar peramban menyimpannya.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isLoginPage = pathname === LOGIN_PATH;

  // Belum masuk dan membuka halaman terlindungi → ke halaman masuk, ingat tujuan.
  if (!user && isProtectedAdminPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = LOGIN_PATH;
    redirectUrl.search = "";
    // Hanya path, bukan URL lengkap: mencegah open redirect ke domain lain.
    if (pathname !== "/admin") {
      redirectUrl.searchParams.set("next", pathname + search);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // Sudah masuk tapi membuka halaman masuk → kembali ke panel.
  if (user && isLoginPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/admin";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  /*
   * Hanya `/admin` dan turunannya. Rute peserta (`/u/*`, `/hasil/*`) sengaja
   * dilewati: peserta tidak punya sesi, dan guard di sini akan memblokir mereka.
   */
  matcher: ["/admin", "/admin/:path*"],
};
