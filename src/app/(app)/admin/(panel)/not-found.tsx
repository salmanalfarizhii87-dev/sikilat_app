import Link from "next/link";
import { Compass, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 404 di dalam panel admin.
 *
 * Berbeda dari 404 peserta (`(app)/not-found.tsx` yang menawarkan form kode
 * ujian), di sini penggunanya guru yang sedang bekerja. Karena itu yang
 * ditawarkan adalah jalan kembali ke area kerja, bukan form kode.
 *
 * Diletakkan di bawah `(panel)` supaya tetap memakai `AdminShell` — sidebar dan
 * breadcrumb tetap ada, jadi pengguna tidak kehilangan konteks.
 */
export default function AdminNotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-card bg-line-soft text-navy-700">
          <Compass className="size-5" aria-hidden />
        </div>

        <p className="mt-4 text-[12.5px] font-medium text-muted">Galat 404</p>
        <h1 className="mt-1.5 font-heading text-[22px] font-extrabold leading-tight text-ink">
          Halaman admin tidak ditemukan
        </h1>
        <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-muted">
          Alamat ini tidak ada di panel admin. Mungkin ujiannya sudah dihapus, atau tautannya salah
          ketik.
        </p>

        <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Link href="/admin">
            <Button variant="secondary" size="md">
              Ke dashboard
            </Button>
          </Link>
          <Link href="/admin/exams">
            <Button size="md">
              <FilePlus2 className="size-4" aria-hidden /> Daftar ujian
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
