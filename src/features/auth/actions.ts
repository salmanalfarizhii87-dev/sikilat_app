"use server";

import {
  fail,
  ok,
  validationFail,
  type ActionResult,
} from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { peekLoginRateLimit, recordLoginFailure } from "./rate-limit";
import { signInSchema, updatePasswordSchema } from "./schemas";

/**
 * Masuk sebagai admin (T2.1).
 *
 * Tiga lapis pemeriksaan, dan urutannya disengaja:
 *
 * 1. **Validasi bentuk** (Zod) — tidak menyentuh jaringan.
 * 2. **Supabase Auth** — memverifikasi email + password.
 * 3. **Tabel `admins`** — memastikan akun ini memang admin dan masih aktif.
 *
 * Lapis 3 penting: `signInWithPassword` akan berhasil untuk **setiap** user yang
 * ada di Supabase Auth, termasuk akun non-admin. Tanpa pemeriksaan ini, siapa pun
 * yang punya akun Auth bisa masuk ke panel.
 *
 * Bila lapis 3 menolak, sesi yang sudah terbentuk **dicabut lagi**. Tanpa itu,
 * cookie sesi non-admin tertinggal di browser dan `proxy.ts` akan menganggapnya
 * "sudah login" — pengguna terjebak di lingkaran redirect.
 *
 * `email` dan `password` sengaja mengembalikan kode yang sama (`UNAUTHENTICATED`)
 * untuk email salah maupun password salah. Membedakan keduanya akan memberi tahu
 * penyerang email mana yang terdaftar.
 */
export async function signIn(input: unknown): Promise<ActionResult<{ signedIn: true }>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const { email, password } = parsed.data;

  /*
   * T2.7 (AUTH-05): tolak sebelum menghubungi Supabase Auth bila kuota tebakan
   * untuk pasangan IP+email ini sudah habis. Memeriksa lebih dulu membatasi
   * beban ke Supabase dan mempercepat penolakan.
   */
  const quota = await peekLoginRateLimit(email);
  if (!quota.allowed) {
    return fail(
      "RATE_LIMITED",
      `Terlalu banyak percobaan masuk. Coba lagi dalam ${quota.retryAfterMinutes} menit.`,
    );
  }

  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    /*
     * Supabase mengembalikan `invalid_credentials` untuk email tidak dikenal dan
     * password salah. `email_not_confirmed` dibedakan karena itu masalah akun
     * yang bisa diperbaiki pengelola, bukan tebakan kredensial.
     */
    if (authError?.code === "email_not_confirmed") {
      return fail(
        "UNAUTHENTICATED",
        "Email ini belum dikonfirmasi. Hubungi pengelola sekolah untuk mengaktifkannya.",
      );
    }

    if (authError?.status === 429) {
      return fail("RATE_LIMITED", "Terlalu banyak percobaan masuk. Tunggu beberapa menit lalu coba lagi.");
    }

    /*
     * Catat kegagalan **setelah** Supabase menolak — bukan sebelum. Bila dicatat
     * sebelum, percobaan yang berhasil pun ikut memakan kuota.
     */
    const after = await recordLoginFailure(email);
    if (!after.allowed) {
      return fail(
        "RATE_LIMITED",
        `Terlalu banyak percobaan masuk. Coba lagi dalam ${after.retryAfterMinutes} menit.`,
      );
    }

    return fail("UNAUTHENTICATED", "Email atau kata sandi salah.");
  }

  // Lapis 3: apakah akun ini admin yang aktif?
  const { data: adminRow, error: adminError } = await supabase
    .from("admins")
    .select("is_active")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (adminError) {
    console.error("[signIn] gagal membaca tabel admins:", adminError.message);
    await supabase.auth.signOut();
    return fail("INTERNAL", "Terjadi gangguan saat memeriksa hak akses. Coba lagi sebentar lagi.");
  }

  if (!adminRow) {
    await supabase.auth.signOut();
    return fail(
      "FORBIDDEN",
      "Akun ini tidak terdaftar sebagai admin. Hubungi pengelola sekolah bila ini keliru.",
    );
  }

  if (!adminRow.is_active) {
    await supabase.auth.signOut();
    return fail("FORBIDDEN", "Akun admin ini dinonaktifkan. Hubungi pengelola sekolah.");
  }

  /*
   * Tidak mengembalikan URL tujuan. Halaman login yang menentukan tujuan akhir
   * (menghormati `?next=`), jadi mengembalikannya dari sini hanya menciptakan
   * dua sumber kebenaran yang cepat atau lambat berbeda.
   */
  return ok({ signedIn: true });
}

/**
 * Keluar dari sesi admin (T2.1).
 *
 * `signOut()` dipanggil dengan klien berbasis cookie sehingga cookie sesi ikut
 * dihapus **di server**. Cookie itu tidak pernah bisa dihapus dengan benar dari
 * JavaScript peramban, dan pemanggil yang menentukan tujuan setelahnya.
 */
export async function signOut(): Promise<ActionResult<{ signedOut: true }>> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("[signOut] gagal mengakhiri sesi:", error.message);
    return fail("INTERNAL", "Gagal keluar. Coba lagi.");
  }

  return ok({ signedOut: true });
}

/**
 * Ganti kata sandi admin yang sedang masuk (T2.6).
 *
 * Urutan: verifikasi password lama → perbarui → akhiri sesi.
 *
 * Memverifikasi password lama bukan sekadar formalitas: tanpa itu, siapa pun yang
 * menemukan perangkat dalam keadaan login bisa mengunci pemiliknya sendiri.
 * Sesi diakhiri supaya perangkat lain yang mungkin memakai password lama ikut
 * terputus dan harus masuk ulang dengan password baru.
 */
export async function updatePassword(input: unknown): Promise<ActionResult<{ signedOut: true }>> {
  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return fail("UNAUTHENTICATED", "Sesi tidak ditemukan atau sudah berakhir. Silakan masuk kembali.");
  }

  // Verifikasi password lama dengan percobaan masuk ulang memakai email sendiri.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });

  if (verifyError) {
    if (verifyError.status === 429) {
      return fail("RATE_LIMITED", "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.");
    }
    return fail("UNAUTHENTICATED", "Kata sandi saat ini salah.", {
      currentPassword: ["Kata sandi saat ini salah."],
    });
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });

  if (updateError) {
    console.error("[updatePassword] gagal memperbarui:", updateError.message);

    if (updateError.status === 422) {
      return fail("VALIDATION", "Kata sandi baru ditolak. Gunakan kata sandi yang lebih kuat.", {
        newPassword: ["Kata sandi baru ditolak oleh server. Gunakan kata sandi yang lebih kuat."],
      });
    }

    return fail("INTERNAL", "Gagal menyimpan kata sandi baru. Coba lagi.");
  }

  await supabase.auth.signOut();
  return ok({ signedOut: true });
}
