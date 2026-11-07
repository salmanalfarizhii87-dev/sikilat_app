import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  FilePlus2,
  FileStack,
  SearchX,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { PageHeader, StatusBadge, CopyButton, Panel } from "@/components/admin/ui";
import { getExamStatusCounts, listExams, parseExamListParams } from "@/features/exams/queries";
import type { ExamListItem } from "@/features/exams/types";
import { formatDateId } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ExamPagination, ExamResetFilters, ExamSearchInput, ExamStatusFilter } from "./exam-filters";
import { ExamRowMenu } from "./exam-row-menu";

/**
 * Daftar ujian (T3.5).
 *
 * Server Component: pencarian, filter, dan paginasi dikerjakan **di database**
 * lewat `listExams`, dan keadaannya disimpan di URL. Sebelumnya halaman ini
 * komponen klien yang memuat tiga ujian contoh lalu menyaringnya dengan
 * `useState` — tidak akan pernah bekerja untuk data sungguhan.
 *
 * `searchParams` dibaca sebagai Promise (Next.js 16) dan dinormalkan lewat
 * `parseExamListParams`, sehingga URL aneh (`?page=0`, `?status=ngawur`)
 * menampilkan halaman pertama alih-alih error.
 */
export default async function AdminExamsPage({ searchParams }: PageProps<"/admin/exams">) {
  const params = parseExamListParams(await searchParams);

  /*
   * Dua query berjalan paralel. `getExamStatusCounts` menghitung seluruh tabel
   * per status (untuk chip), `listExams` hanya mengambil satu halaman.
   * Dijalankan berurutan akan menambah satu perjalanan penuh ke database tanpa
   * alasan.
   */
  const [list, counts] = await Promise.all([listExams(params), getExamStatusCounts()]);

  const filtering = params.search !== "" || params.status !== "all";

  return (
    <>
      <PageHeader
        title="Daftar ujian"
        description="Bagikan kode, duplikat untuk kelas lain, atau arsipkan ujian yang sudah selesai."
        actions={
          <Link href="/admin/exams/new">
            <Button size="md">
              <FilePlus2 className="size-4" aria-hidden /> Buat ujian
            </Button>
          </Link>
        }
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="sm:max-w-[340px] sm:flex-1">
          <ExamSearchInput
            value={params.search}
            placeholder="Cari judul, kode, atau mata pelajaran"
          />
        </div>
        <ExamStatusFilter value={params.status} counts={counts} />
      </div>

      {list.rows.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<SearchX className="size-6" aria-hidden />}
            title={filtering ? "Tidak ada ujian yang cocok" : "Belum ada ujian"}
            description={
              filtering
                ? "Coba kata kunci lain, atau kembali ke semua ujian."
                : "Ujian yang kamu buat akan muncul di sini sebagai draft."
            }
            action={
              filtering ? (
                <ExamResetFilters />
              ) : (
                <Link href="/admin/exams/new">
                  <Button size="md">
                    <FilePlus2 className="size-4" aria-hidden /> Buat ujian
                  </Button>
                </Link>
              )
            }
          />
        </Panel>
      ) : (
        <div className="space-y-2.5">
          {list.rows.map((exam) => (
            <ExamRow key={exam.id} exam={exam} />
          ))}
        </div>
      )}

      <ExamPagination page={list.page} pageSize={list.pageSize} total={list.total} />
    </>
  );
}

function ExamRow({ exam }: { exam: ExamListItem }) {
  return (
    <div className="relative rounded-card border border-line bg-surface p-3.5 sm:p-4">
      <div className="flex flex-wrap items-start gap-3">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-card font-heading text-[12px] font-extrabold",
            exam.status === "published"
              ? "bg-navy-900 text-accent-400"
              : exam.status === "draft"
                ? "bg-accent-100 text-accent-900"
                : "bg-line-soft text-muted",
          )}
          aria-hidden
        >
          {exam.code.slice(0, 2)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={exam.status} />
            <span className="rounded-xs bg-line-soft px-1.5 py-0.5 font-heading text-[11px] font-bold text-ink-soft">
              {exam.code}
            </span>
            {exam.subjectLabel && (
              <span className="text-[12px] text-muted">{exam.subjectLabel}</span>
            )}
          </div>
          {/* Judul adalah tautan utama ke detail ujian, jadi seluruh barisnya
              harus bisa disentuh (44 px), bukan hanya tinggi teksnya. */}
          <Link
            href={`/admin/exams/${exam.id}`}
            className="-mx-1 flex min-h-11 min-w-0 items-center truncate rounded-field px-1 font-heading text-[14.5px] font-bold text-ink hover:text-navy-700"
          >
            {exam.title}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
            <span className="flex items-center gap-1">
              <FileStack className="size-3.5" aria-hidden /> {exam.questionCount} soal
            </span>
            <span className="flex items-center gap-1">
              <CalendarClock className="size-3.5" aria-hidden /> {exam.durationMinutes} menit
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-3.5" aria-hidden /> {exam.attemptCount} peserta
            </span>
            <span className="hidden sm:inline">Dibuat {formatDateId(exam.createdAt)}</span>
          </div>
        </div>

        {/* Di HP tombol aksi tidak muat sebaris dengan judul, dan karena
            `flex-1` boleh menyusut sampai nol, judul ujian sempat tinggal 23 px.
            Aksi dipaksa turun ke baris sendiri di bawah `sm`. */}
        <div className="flex w-full items-center gap-1.5 sm:w-auto">
          <CopyButton value={exam.code} label="Salin kode" />
          <Link
            href={`/admin/exams/${exam.id}`}
            className="press inline-flex h-11 items-center gap-1 rounded-field border border-line bg-surface px-3 font-heading text-[12.5px] font-semibold text-ink-soft hover:bg-line-soft"
          >
            Kelola <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
          <ExamRowMenu
            examId={exam.id}
            code={exam.code}
            title={exam.title}
            status={exam.status}
            attemptCount={exam.attemptCount}
          />
        </div>
      </div>
    </div>
  );
}
