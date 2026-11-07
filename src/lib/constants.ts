/**
 * Konstanta lintas modul.
 *
 * Semua nilai yang dipakai lebih dari satu tempat dan tidak boleh berubah tanpa
 * sadar ada di sini. Sumber: PRD §1.5 (identitas), §5.10 (variabel lingkungan),
 * §8.1 (kode error), §7.2 (batas panjang kode ujian).
 */

/** Nama produk untuk teks UI dan metadata. */
export const APP_NAME = "siKilat";

/**
 * Zona waktu operasional. Semua tampilan tanggal memakai ini; perhitungan
 * jadwal ujian dilakukan di database dengan `now()`, bukan jam perangkat.
 */
export const APP_TIMEZONE = "Asia/Jakarta";

/**
 * Prefiks cookie. `attempt_token` disimpan sebagai `kilat_attempt_<kode>`
 * (PRD §7.3) supaya beberapa ujian bisa dikerjakan di perangkat yang sama
 * tanpa saling menimpa.
 */
export const COOKIE_PREFIX = "kilat_";

export const COOKIE_ATTEMPT_PREFIX = `${COOKIE_PREFIX}attempt_`;

/**
 * Kode error standar (PRD §8.1). Dipakai sebagai nilai `error.code` pada
 * `ActionResult`, sehingga UI bisa memetakan pesan tanpa mencocokkan teks.
 */
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "VALIDATION",
  "NOT_FOUND",
  "CONFLICT",
  "EXAM_NOT_FOUND",
  "EXAM_NOT_OPEN",
  "EXAM_CLOSED",
  "NO_ATTEMPTS_LEFT",
  "NAME_IN_USE",
  "INVALID_RESUME_CODE",
  "ATTEMPT_EXPIRED",
  "RATE_LIMITED",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * Pesan bahasa Indonesia untuk setiap kode error. Nada kalimat mengikuti
 * DESIGN.md §1: tenang, jelas, tidak menyalahkan pengguna.
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Kamu perlu masuk dulu untuk membuka halaman ini.",
  FORBIDDEN: "Akun ini tidak punya akses ke halaman tersebut.",
  VALIDATION: "Ada isian yang belum benar. Periksa lagi ya.",
  NOT_FOUND: "Yang kamu cari tidak ditemukan.",
  CONFLICT: "Data sudah berubah. Muat ulang halaman lalu coba lagi.",
  EXAM_NOT_FOUND: "Kode ujian tidak dikenali.",
  EXAM_NOT_OPEN: "Ujian ini belum dibuka. Coba lagi sesuai jadwal.",
  EXAM_CLOSED: "Ujian ini sudah ditutup.",
  NO_ATTEMPTS_LEFT: "Kesempatan mengerjakan ujian ini sudah habis.",
  NAME_IN_USE: "Nama ini sedang dipakai di perangkat lain. Pakai Kode Lanjut.",
  INVALID_RESUME_CODE: "Kode Lanjut tidak cocok. Periksa lagi.",
  ATTEMPT_EXPIRED: "Waktu pengerjaan sudah habis dan jawaban sudah dikumpulkan.",
  RATE_LIMITED: "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.",
  INTERNAL: "Ada gangguan di server. Coba lagi beberapa saat lagi.",
};

/**
 * Batas panjang kode ujian, sesuai constraint database
 * `code ~ '^[A-Z0-9]{4,10}$'` (PRD §7.2).
 */
export const EXAM_CODE_MIN_LENGTH = 4;
export const EXAM_CODE_MAX_LENGTH = 10;

/**
 * Alfabet kode ujian: tanpa `0/O` dan `1/I` karena mudah tertukar saat
 * dibacakan atau ditulis tangan.
 */
export const EXAM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Batas ukuran gambar soal (PRD §6, K5). */
export const MAX_QUESTION_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_QUESTION_IMAGE_EDGE = 1600;
