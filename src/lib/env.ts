import "server-only";
import { z } from "zod";

/**
 * Validasi variabel lingkungan (PRD §5.10).
 *
 * Tujuan modul ini bukan sekadar membaca `process.env`: tujuannya membuat build
 * atau boot **gagal dengan pesan jelas** saat variabel wajib belum diisi, alih-alih
 * meledak jauh di dalam kode dengan pesan seperti "fetch failed" atau
 * "Cannot read properties of undefined".
 *
 * Modul ini `server-only` karena memegang `SUPABASE_SERVICE_ROLE_KEY`. Kunci itu
 * tidak boleh pernah ikut ke bundel klien; impor modul ini dari komponen klien
 * akan menjadi error build, bukan kebocoran diam-diam.
 *
 * Catatan pemisahan: nilai `NEXT_PUBLIC_*` tetap dibaca langsung di tempat yang
 * membutuhkannya bila itu terjadi di klien, karena Next.js meng-inline nilai itu
 * saat build. Yang divalidasi di sini adalah ketersediaannya di sisi server.
 */

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL harus berupa URL lengkap, mis. https://supabase.contoh.id"),

  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi"),

  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY belum diisi (rahasia, hanya untuk server)"),

  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL harus berupa URL lengkap, mis. http://localhost:3000"),

  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("siKilat"),

  APP_TIMEZONE: z.string().min(1).default("Asia/Jakarta"),
});

export type ServerEnv = z.infer<typeof schema>;

/**
 * Pesan galat dikumpulkan per variabel supaya pengembang langsung tahu mana yang
 * kurang, tanpa harus menebak dari stack trace.
 */
function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const key = issue.path.join(".") || "(akar)";
      return `  - ${key}: ${issue.message}`;
    })
    .join("\n");
}

let cached: ServerEnv | null = null;

/**
 * Baca dan validasi variabel lingkungan server.
 *
 * Hasilnya di-cache supaya validasi tidak diulang setiap pemanggilan, tapi
 * kegagalan tidak di-cache agar pesannya tetap muncul saat diperbaiki.
 */
export function serverEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(
      [
        "Variabel lingkungan belum lengkap atau tidak valid.",
        "Salin `.env.example` menjadi `.env.local` lalu isi nilainya.",
        "",
        formatIssues(parsed.error),
      ].join("\n"),
    );
  }

  cached = parsed.data;
  return cached;
}

/**
 * Apakah variabel lingkungan sudah lengkap.
 *
 * Dipakai untuk menampilkan peringatan yang ramah di UI selama fase transisi
 * (backend belum terpasang), bukan untuk melewati validasi di jalur yang
 * benar-benar membutuhkannya.
 */
export function isServerEnvConfigured(): boolean {
  return schema.safeParse(process.env).success;
}
