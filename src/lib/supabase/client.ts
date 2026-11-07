"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database.types";

/**
 * Klien Supabase untuk komponen klien (browser).
 *
 * Memakai kunci **publik** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), jadi aman ikut ke
 * bundel. Yang menahan akses bukan kerahasiaan kunci ini, melainkan RLS di
 * database: tanpa policy, kunci ini tidak bisa membaca apa pun.
 *
 * Fungsi ini sengaja tidak di-cache di level modul oleh kita sendiri karena
 * `createBrowserClient` dari `@supabase/ssr` sudah menyimpan satu instance per
 * tab. Membuat instance baru setiap render akan memicu peringatan
 * "Multiple GoTrueClient instances".
 *
 * Nilai `NEXT_PUBLIC_*` dibaca langsung dari `process.env` (bukan lewat
 * `lib/env.ts`) karena Next.js meng-inline nilainya saat build; `lib/env.ts`
 * memakai `server-only` dan tidak boleh diimpor dari sini.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local (lihat .env.example).",
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}
