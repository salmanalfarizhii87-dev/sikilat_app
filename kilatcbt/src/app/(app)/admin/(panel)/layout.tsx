import { AdminShell } from "@/components/admin/admin-shell";

/**
 * Layout ini sengaja tidak mengekspor `metadata`.
 *
 * `title.template: "%s · siKilat"` hanya bertahan sampai ada layout antara yang
 * menulis `title` sebagai string: Next.js menyimpan template dari layout terakhir
 * yang punya `title.template`, jadi string di sini menghapus template induk dan
 * semua segmen admin kehilangan akhiran "· siKilat" (terbukti sebelum perbaikan:
 * /admin/exams berjudul "Daftar ujian"). Judul ditulis di layout tiap segmen.
 */
export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
