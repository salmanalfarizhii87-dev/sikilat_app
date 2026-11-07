/**
 * Tipe database hasil generate.
 *
 * ⚠️  BERKAS INI DI-GENERATE — jangan diedit manual.
 *
 * Isi sebenarnya baru terisi setelah project Supabase dibuat (T0.0) dan
 * di-link (T0.3). Regenerasi dengan:
 *
 *     npm run db:types
 *
 * Selama project belum ada, berkas ini berisi skema kosong yang sah supaya
 * `tsc --noEmit` tetap hijau dan klien Supabase di `src/lib/supabase/` bisa
 * dikompilasi. Jangan menambahkan tabel manual di sini — definisi skema hidup di
 * `supabase/migrations/`, dan berkas ini hanya cerminannya.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];

export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];
