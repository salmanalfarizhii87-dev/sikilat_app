import "server-only";

import { createClient } from "@/lib/supabase/server";
import { fail, type ActionResult } from "@/lib/action-result";

/**
 * Identitas admin yang sudah diverifikasi di server.
 *
 * `email` diambil dari Supabase Auth, `fullName` dari tabel `admins` — dua
 * sumber yang berbeda, jadi jangan tertukar: nama tampilan adalah data domain,
 * email adalah data akun.
 */
export interface AdminSession {
  userId: string;
  email: string;
  fullName: string | null;
  lastSignInAt: string | null;
}

/**
 * Periksa bahwa pemanggil benar-benar admin yang aktif (T2.3).
 *
 * Urutannya penting dan tidak boleh dibalik:
 *
 * 1. `auth.getUser()` — **bukan** `getSession()`. `getSession()` hanya membaca
 *    cookie dan mempercayai isinya; cookie bisa dipalsukan. `getUser()` memanggil
 *    server Auth sehingga token benar-benar diverifikasi tanda tangannya.
 * 2. Baris `admins` dengan `is_active = true` — punya sesi Auth **tidak** berarti
 *    admin. Akun yang dihapus dari tabel `admins` langsung kehilangan akses tanpa
 *    perlu menghapus user Auth-nya.
 *
 * Mengembalikan `ActionResult` yang sudah gagal (UNAUTHENTICATED/FORBIDDEN) atau
 * sesi admin. Aksi admin memakai pola:
 *
 * ```ts
 * const auth = await requireAdmin();
 * if (!auth.ok) return auth;
 * // auth.data.email, auth.data.userId, …
 * ```
 *
 * Catatan: RLS di database tetap menjadi pengaman terakhir. Helper ini menjaga
 * agar aksi tidak jalan sebelum sempat menyentuh database.
 */
export async function requireAdmin(): Promise<ActionResult<AdminSession>> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return fail("UNAUTHENTICATED", "Sesi tidak ditemukan atau sudah berakhir. Silakan masuk kembali.");
  }

  const { data: adminRow, error: adminError } = await supabase
    .from("admins")
    .select("user_id, full_name, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError) {
    /*
     * Kegagalan membaca tabel admins BUKAN "bukan admin". Kalau RLS salah
     * dikonfigurasi, hasilnya sama-sama `null`, dan menampilkan FORBIDDEN akan
     * menutupi bug itu. Bedakan keduanya di log.
     */
    console.error("[requireAdmin] gagal membaca tabel admins:", adminError.message);
    return fail("INTERNAL", "Terjadi gangguan saat memeriksa hak akses. Coba lagi sebentar lagi.");
  }

  if (!adminRow) {
    return fail("FORBIDDEN", "Akun ini tidak terdaftar sebagai admin.");
  }

  if (!adminRow.is_active) {
    return fail("FORBIDDEN", "Akun admin ini dinonaktifkan. Hubungi pengelola sekolah.");
  }

  return {
    ok: true,
    data: {
      userId: user.id,
      email: user.email ?? "",
      fullName: adminRow.full_name,
      lastSignInAt: user.last_sign_in_at ?? null,
    },
  };
}

/**
 * Versi ringkas untuk Server Component: kembalikan sesi atau `null`.
 *
 * Dipakai ketika komponen hanya perlu *menampilkan* identitas dan tidak punya
 * jalur galat yang berarti — guard sebenarnya ada di `proxy.ts`. Untuk aksi yang
 * mengubah data, tetap pakai `requireAdmin()` supaya kode galatnya jelas.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const result = await requireAdmin();
  return result.ok ? result.data : null;
}
