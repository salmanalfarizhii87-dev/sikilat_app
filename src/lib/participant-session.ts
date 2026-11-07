import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { COOKIE_ATTEMPT_PREFIX } from "@/lib/constants";

/**
 * Sesi peserta (PRD §7.3).
 *
 * Peserta tidak punya akun. Identitasnya adalah **token acak** yang disimpan
 * sebagai cookie dan, di database, hanya sebagai **hash SHA-256**-nya
 * (`attempts.token_hash`). Alasannya: kalau isi database bocor, hash tidak bisa
 * dipakai untuk membajak attempt yang sedang berjalan — token aslinya hanya ada
 * di perangkat peserta.
 *
 * Kenapa `httpOnly: true` di sini padahal cookie sesi admin sengaja tidak:
 * token ini tidak pernah perlu dibaca JavaScript. Runner tidak lagi menyimpan
 * jawaban di localStorage, jadi tidak ada kode klien yang butuh nilainya. Dengan
 * `httpOnly`, satu celah XSS tidak cukup untuk mencuri attempt orang lain.
 *
 * Nama cookie memuat kode ujian (`kilat_attempt_<KODE>`) supaya satu perangkat
 * bisa mengerjakan beberapa ujian tanpa saling menimpa.
 *
 * Yang disimpan di cookie hanyalah token. **Tidak** ada nama, kelas, atau nilai —
 * semuanya dibaca ulang dari server setiap permintaan, sehingga peserta tidak
 * bisa mengubah kelasnya sendiri lewat DevTools.
 */

const TOKEN_BYTES = 32;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function attemptCookieName(examCode: string) {
  return `${COOKIE_ATTEMPT_PREFIX}${examCode.toUpperCase()}`;
}

/** Token acak 256-bit, base64url supaya aman di cookie tanpa escaping. */
export function generateAttemptToken() {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Hash token untuk disimpan/dicari di database.
 *
 * SHA-256 tanpa garam dipakai dengan sengaja: nilainya harus **deterministik**
 * agar RPC bisa mencari attempt lewat `where token_hash = p_token_hash`. Token
 * ini 256 bit acak, jadi serangan kamus tidak berlaku — tidak seperti kata sandi
 * manusia yang wajib memakai algoritma lambat bergaram.
 */
export function hashAttemptToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Token mentah untuk kode ujian ini, atau `null` bila belum pernah mulai. */
export async function readAttemptToken(examCode: string): Promise<string | null> {
  const store = await cookies();
  const value = store.get(attemptCookieName(examCode))?.value;
  return value && value.length > 0 ? value : null;
}

/** Hash token aktif, siap dikirim ke RPC. `null` bila belum ada sesi. */
export async function readAttemptTokenHash(examCode: string): Promise<string | null> {
  const token = await readAttemptToken(examCode);
  return token ? hashAttemptToken(token) : null;
}

/**
 * Simpan token ke cookie.
 *
 * Hanya boleh dipanggil dari Server Action atau Route Handler: Server Component
 * tidak diizinkan menulis cookie di Next.js.
 *
 * `sameSite: "lax"` — bukan `strict` — karena peserta bisa datang dari tautan
 * yang dibagikan guru lewat WhatsApp. Dengan `strict`, cookie tidak terkirim
 * pada navigasi dari situs lain dan peserta akan tampak "kehilangan" attempt
 * yang sedang berjalan.
 */
export async function writeAttemptCookie(examCode: string, token: string) {
  const store = await cookies();
  store.set(attemptCookieName(examCode), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Hapus sesi peserta untuk ujian ini (dipakai setelah attempt selesai/ditolak). */
export async function clearAttemptCookie(examCode: string) {
  const store = await cookies();
  store.delete(attemptCookieName(examCode));
}

/**
 * Token hasil (bukan token attempt) untuk halaman `/hasil/<token>`.
 *
 * Disimpan terpisah karena umurnya lebih panjang daripada sesi pengerjaan:
 * peserta menutup browser lalu membuka tautan hasilnya lagi berhari-hari
 * kemudian. Nilainya bukan rahasia sesi — `get_result` hanya mengembalikan data
 * yang memang boleh dilihat pemilik tautan itu.
 */
export function resultPath(resultToken: string) {
  return `/hasil/${resultToken}`;
}
