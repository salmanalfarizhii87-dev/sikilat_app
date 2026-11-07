import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * Klien Supabase dengan **service role** — melewati RLS sepenuhnya.
 *
 * Hanya untuk dua keperluan yang memang tidak bisa dilakukan peran lain:
 * 1. Memanggil RPC peserta (`start_attempt`, `save_answer`, `submit_attempt`, …)
 *    yang `execute`-nya sudah dicabut dari `anon`/`authenticated`.
 * 2. Menandatangani URL Storage `question-media` saat attempt aktif.
 *
 * Aturan yang tidak boleh dilanggar:
 * - Jangan pernah mengimpor berkas ini dari komponen klien. `import "server-only"`
 *   di atas membuat impor semacam itu menjadi **error build**, bukan kebocoran
 *   kunci yang lolos diam-diam.
 * - Jangan pakai klien ini untuk operasi admin biasa (baca/tulis tabel admin).
 *   Untuk itu pakai `server.ts`, supaya RLS tetap menjadi pengaman terakhir bila
 *   ada bug otorisasi di kode.
 * - Jangan meneruskan hasil mentah klien ini ke klien tanpa disaring. Kolom
 *   rahasia (`is_correct`, `reference_answer`) hanya boleh hidup di server.
 *
 * `persistSession: false` dan `autoRefreshToken: false` karena tidak ada sesi
 * pengguna di sini — kunci service role adalah identitasnya.
 */
export function createAdminClient() {
  const env = serverEnv();

  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
