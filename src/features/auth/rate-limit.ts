import "server-only";

import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Rate limit untuk percobaan masuk admin (T2.7, PRD AUTH-05).
 *
 * Kebijakan: **5 gagal per 15 menit**, dihitung per pasangan IP + email.
 *
 * Kenapa menghitung **kegagalan saja**, bukan setiap percobaan: menghitung semua
 * percobaan akan mengunci admin yang sah hanya karena membuka halaman login
 * berulang kali, atau karena beberapa orang di satu sekolah berbagi satu IP
 * publik. Yang berbahaya adalah tebakan password, jadi hanya itu yang dihitung.
 *
 * Kenapa IP **dan** email: IP saja melukai pengguna sah di balik NAT sekolah;
 * email saja memudahkan penyerang mengunci akun orang lain. Pasangan keduanya
 * menahan tebakan password untuk satu akun tanpa mengunci seluruh sekolah.
 *
 * Memakai `rate_limit_consume` atomik di Postgres (keputusan K2) lewat klien
 * service role, karena `execute` sudah dicabut dari `anon`/`authenticated`.
 */

/** Jendela dan ambang sesuai PRD AUTH-05. */
export const LOGIN_RATE_LIMIT = { limit: 5, windowSecs: 15 * 60 } as const;

const BUCKET_FAIL = "auth_login_fail";

/**
 * Alamat IP pemanggil.
 *
 * Di Vercel, `x-forwarded-for` bisa berisi daftar (`klien, proksi1, proksi2`);
 * entri pertama adalah klien asli. Header ini **bisa dipalsukan** bila aplikasi
 * tidak berada di belakang proksi yang menulisnya. Karena itu nilai ini hanya
 * dipakai sebagai *salah satu* penanda rate limit, tidak pernah untuk otorisasi.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() || "tidak-diketahui";
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Menit sampai jendela berikutnya, untuk pesan ke pengguna. */
  retryAfterMinutes: number;
}

/**
 * Catat satu kegagalan masuk.
 *
 * Dipanggil **hanya** setelah Supabase menolak kredensial — bukan di setiap
 * percobaan. Menghitung percobaan yang berhasil akan mengunci admin yang sah
 * hanya karena sering masuk.
 *
 * Mengembalikan keadaan kuota **setelah** kegagalan ini dicatat, supaya pemanggil
 * bisa langsung memberi tahu pengguna berapa lama harus menunggu.
 */
export async function recordLoginFailure(email: string): Promise<RateLimitResult> {
  const ip = await clientIp();
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("rate_limit_consume", {
    p_bucket: BUCKET_FAIL,
    p_identifier: `${ip}|${email}`,
    p_limit: LOGIN_RATE_LIMIT.limit,
    p_window_secs: LOGIN_RATE_LIMIT.windowSecs,
  });

  if (error) {
    console.error("[rateLimit] gagal mencatat kegagalan:", error.message);
    return { allowed: true, remaining: LOGIN_RATE_LIMIT.limit, retryAfterMinutes: 0 };
  }

  return interpret(data);
}

/**
 * Baca sisa kuota dari jendela sungguhan **tanpa menambah counter**.
 *
 * `rate_limit_consume` tidak punya varian baca-saja, dan memakainya untuk sekadar
 * membaca akan mempercepat penguncian. Karena itu dibaca langsung dari tabel
 * dengan rumus jendela yang sama persis seperti di SQL
 * (`floor(epoch / window) * window`), memakai service role.
 */
export async function peekLoginRateLimit(email: string): Promise<RateLimitResult> {
  const ip = await clientIp();
  const admin = createAdminClient();

  const nowSecs = Math.floor(Date.now() / 1000);
  const windowStartSecs =
    Math.floor(nowSecs / LOGIN_RATE_LIMIT.windowSecs) * LOGIN_RATE_LIMIT.windowSecs;
  const windowStart = new Date(windowStartSecs * 1000).toISOString();

  const { data, error } = await admin
    .from("rate_limits")
    .select("counter")
    .eq("bucket", BUCKET_FAIL)
    .eq("identifier", `${ip}|${email}`)
    .eq("window_start", windowStart)
    .maybeSingle();

  if (error) {
    /*
     * Gagal membaca rate limit BUKAN alasan memblokir admin yang sah. Kegagalan
     * dicatat ke log dan permintaan diteruskan — pilihan sadar: mengunci panel
     * karena satu query gagal lebih merugikan daripada meloloskan satu percobaan.
     */
    console.error("[rateLimit] gagal membaca sisa kuota:", error.message);
    return { allowed: true, remaining: LOGIN_RATE_LIMIT.limit, retryAfterMinutes: 0 };
  }

  const used = data?.counter ?? 0;
  const remaining = Math.max(0, LOGIN_RATE_LIMIT.limit - used);

  return {
    allowed: remaining > 0,
    remaining,
    retryAfterMinutes: minutesUntil(windowStartSecs + LOGIN_RATE_LIMIT.windowSecs),
  };
}

/** Ubah hasil `rate_limit_consume` menjadi bentuk yang sama dengan `peek`. */
function interpret(data: unknown): RateLimitResult {
  const value = (data ?? {}) as { allowed?: boolean; remaining?: number; reset_at?: string };
  const remaining = typeof value.remaining === "number" ? value.remaining : LOGIN_RATE_LIMIT.limit;
  const resetAt = value.reset_at ? new Date(value.reset_at) : null;

  return {
    allowed: value.allowed !== false && remaining > 0,
    remaining,
    retryAfterMinutes: resetAt
      ? Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 60_000))
      : Math.ceil(LOGIN_RATE_LIMIT.windowSecs / 60),
  };
}

function minutesUntil(endSecs: number): number {
  return Math.max(1, Math.ceil((endSecs - Math.floor(Date.now() / 1000)) / 60));
}
