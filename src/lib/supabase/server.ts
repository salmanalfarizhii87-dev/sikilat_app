import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database.types";

/**
 * Klien Supabase untuk dipakai di server dengan **sesi admin** (cookie).
 *
 * Dipakai di Server Component, Server Action, dan Route Handler saat operasi
 * harus tunduk pada RLS sebagai admin yang sedang login.
 *
 * Kenapa `cookies()` di-`await`: di Next.js 16 `cookies()` bersifat asinkron.
 *
 * Kenapa `setAll` dibungkus `try/catch`: Server Component tidak boleh menulis
 * cookie. Saat token perlu di-refresh, Supabase mencoba menulis dan gagal. Itu
 * wajar — refresh tetap terjadi di `proxy.ts` (guard `/admin/*`) dan di Server
 * Action, jadi kegagalan di sini diabaikan, bukan ditelan tanpa alasan.
 *
 * Kunci yang dipakai tetap kunci **publik**; hak akses ditentukan RLS lewat
 * `auth.uid()` dari cookie sesi, bukan oleh kunci ini.
 */
export async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local (lihat .env.example).",
    );
  }

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Dipanggil dari Server Component: menulis cookie tidak diizinkan.
          // Refresh sesi ditangani `proxy.ts`, jadi aman diabaikan di sini.
        }
      },
    },
  });
}
