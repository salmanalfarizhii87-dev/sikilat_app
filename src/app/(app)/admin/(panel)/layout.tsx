import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminSession } from "@/lib/auth/require-admin";

/**
 * Layout ini sengaja tidak mengekspor `metadata`.
 *
 * `title.template: "%s · siKilat"` hanya bertahan sampai ada layout antara yang
 * menulis `title` sebagai string: Next.js menyimpan template dari layout terakhir
 * yang punya `title.template`, jadi string di sini menghapus template induk dan
 * semua segmen admin kehilangan akhiran "· siKilat" (terbukti sebelum perbaikan:
 * /admin/exams berjudul "Daftar ujian"). Judul ditulis di layout tiap segmen.
 *
 * Identitas admin dibaca di **server** dan diteruskan sebagai prop. Membacanya di
 * peramban (mis. dari `localStorage`) berarti menampilkan nilai yang bisa diubah
 * siapa pun tanpa verifikasi apa pun.
 *
 * Catatan: layout ini **bukan** pengaman. Ia berjalan untuk setiap segmen admin
 * dan sengaja tidak melakukan `redirect` — guard ada di `proxy.ts`, sedangkan
 * otorisasi data ada di `requireAdmin()` pada tiap aksi dan di RLS database.
 */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminSession();

  return (
    <AdminShell admin={admin ? { email: admin.email, fullName: admin.fullName } : null}>
      {children}
    </AdminShell>
  );
}
