import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Archive, Lock } from "lucide-react";
import { PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { ExamTabs } from "@/components/admin/exam-tabs";
import { getExam, examHasAttempts } from "@/features/exams/queries";
import { ExamDetailActions } from "../exam-detail-actions";
import { ExamSettingsForm } from "./settings-form";

/**
 * Pengaturan ujian (EXM-04, EXM-09).
 *
 * Server Component yang membaca ujian dari database lalu menyerahkan nilainya ke
 * formulir klien. Halaman ini sebelumnya mengisi dirinya dari `demoExam`, jadi
 * membuka pengaturan ujian sungguhan akan menampilkan judul ujian contoh — dan
 * menyimpannya akan menimpa ujian itu dengan data palsu.
 *
 * Aksi berisiko (arsip, hapus) tetap di `ExamDetailActions` supaya hanya ada
 * satu tempat yang meminta konfirmasi judul.
 */
export const metadata: Metadata = { title: "Pengaturan ujian" };

export default async function ExamSettingsPage({ params }: PageProps<"/admin/exams/[id]/settings">) {
  const { id } = await params;

  const exam = await getExam(id);
  if (!exam) notFound();

  const hasAttempts = await examHasAttempts(exam.id);

  return (
    <>
      <PageHeader
        title="Pengaturan ujian"
        description="Judul, durasi, dan aturan penilaian masih bisa diubah walau soal sudah terkunci."
        actions={
          <ExamDetailActions
            examId={exam.id}
            code={exam.code}
            title={exam.title}
            status={exam.status}
            phase={exam.status === "archived" ? "archived" : exam.status === "draft" ? "draft" : "open"}
            hasAttempts={hasAttempts}
          />
        }
      >
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
          <StatusBadge status={exam.status} />
          <span className="rounded-xs bg-line-soft px-1.5 py-0.5 font-heading text-[11px] font-bold text-ink-soft">
            {exam.code}
          </span>
          {exam.subjectLabel && <span>{exam.subjectLabel}</span>}
        </p>
      </PageHeader>

      <ExamTabs examId={exam.id} />

      {hasAttempts && (
        <p className="mb-4 flex items-start gap-2 rounded-field border border-accent-200 bg-accent-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-accent-900">
          <Lock className="mt-px size-4 shrink-0" aria-hidden />
          <span>
            Ujian ini sudah punya percobaan. Soal dan kunci jawabannya terkunci, tetapi pengaturan
            di halaman ini — termasuk KKM, durasi, dan cara hasil dirilis — masih boleh diubah.
          </span>
        </p>
      )}

      <ExamSettingsForm exam={exam} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Panel title="Arsip">
          <p className="text-[12.5px] leading-relaxed text-muted">
            Mengarsipkan ujian menutup akses peserta tanpa menghapus nilai yang sudah masuk. Ujian
            berstatus arsip bisa dikembalikan sebagai draft.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ink-soft">
            <Archive className="size-3.5 shrink-0 text-navy-600" aria-hidden />
            Status sekarang: <strong className="font-heading font-bold">{exam.status}</strong>
          </p>
        </Panel>

        <div className="rounded-card border border-clay-200 bg-clay-50 p-4">
          <p className="flex items-center gap-1.5 font-heading text-[12.5px] font-bold text-clay-700">
            <AlertTriangle className="size-4" aria-hidden /> Hapus ujian
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-clay-700">
            Hanya bisa dilakukan pada ujian berstatus arsip yang belum punya percobaan. Semua soal
            ikut terhapus dan tidak bisa dikembalikan.
          </p>
          <p className="mt-2 text-[11.5px] leading-relaxed text-clay-700">
            {hasAttempts
              ? "Ujian ini sudah punya percobaan, jadi tidak bisa dihapus permanen — arsipkan saja."
              : "Tombol hapus ada di menu Lainnya pada bagian atas halaman, setelah ujian diarsipkan."}
          </p>
          {!hasAttempts && exam.status !== "archived" && (
            <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-clay-700">
              <Archive className="size-3.5 shrink-0" aria-hidden /> Arsipkan dulu untuk membuka
              tombol hapus.
            </p>
          )}
        </div>
      </div>

      <Link
        href={`/admin/exams/${exam.id}`}
        className="press mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-field px-2 text-[12.5px] font-semibold text-muted hover:bg-line-soft hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Kembali ke ringkasan
      </Link>
    </>
  );
}
