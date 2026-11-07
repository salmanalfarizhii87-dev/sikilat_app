import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info, Lock } from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { ExamTabs } from "@/components/admin/exam-tabs";
import { getExam, examHasAttempts } from "@/features/exams/queries";
import { getExamQuestions } from "@/features/questions/queries";
import { ExamDetailActions } from "../exam-detail-actions";
import { ExamQuestionsEditor } from "./editor-client";

/**
 * Editor soal ujian (T3.9, T4.2).
 *
 * Sebelumnya halaman ini komponen klien yang mengisi dirinya dari
 * `demoQuestions` dan menulis `const locked = true`, lalu tombol simpannya
 * hanya memunculkan toast "belum tersambung ke server". Akibatnya: membuka
 * paket bank soal menampilkan 20 soal contoh, dan setiap ujian tampak terkunci
 * meski belum pernah dikerjakan.
 *
 * Sekarang `locked` dihitung dari `examHasAttempts` — EXM-09 menyatakan isi soal
 * terkunci **setelah** percobaan pertama, bukan selamanya.
 */
export const metadata: Metadata = { title: "Soal ujian" };

export default async function ExamQuestionsPage({
  params,
}: PageProps<"/admin/exams/[id]/questions">) {
  const { id } = await params;

  const exam = await getExam(id);
  if (!exam) notFound();

  const [questions, hasAttempts] = await Promise.all([
    getExamQuestions(exam.id),
    examHasAttempts(exam.id),
  ]);

  const list = questions ?? [];
  const imageCount = list.filter(
    (question) => question.mediaPath || question.options.some((option) => option.mediaPath),
  ).length;

  return (
    <>
      <PageHeader
        title="Soal ujian"
        description={
          hasAttempts
            ? "Soal terkunci karena ujian ini sudah punya percobaan. Isi soal tidak bisa diubah lagi."
            : "Tambah, ubah, dan urutkan soal. Simpan sekaligus — semua perubahan masuk dalam satu transaksi."
        }
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

      {hasAttempts ? (
        <div className="mb-3 flex flex-wrap items-start gap-2 rounded-field border border-accent-200 bg-accent-50 px-3 py-2">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-accent-900" aria-hidden />
          <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-accent-900">
            <strong className="font-semibold">Soal dan opsi hanya-baca.</strong> Setelah percobaan
            pertama masuk, isi soal tidak bisa diubah agar penilaian tetap adil. Pengaturan ujian —
            durasi, KKM, cara hasil dirilis — masih bisa diubah di tab Pengaturan. Buat ujian baru
            bila perlu revisi besar.
          </p>
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap items-start gap-2 rounded-field border border-line bg-canvas px-3 py-2">
          <Info className="mt-0.5 size-3.5 shrink-0 text-navy-600" aria-hidden />
          <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-muted">
            Soal bisa disunting sampai peserta pertama mulai mengerjakan.{" "}
            {imageCount > 0 && (
              <>
                {imageCount} soal punya gambar; gambarnya dipertahankan saat kamu menyimpan.{" "}
              </>
            )}
            Mengubah urutan di sini juga mengubah urutan yang dilihat peserta (kecuali ujian
            memakai pengaturan acak).
          </p>
        </div>
      )}

      <ExamQuestionsEditor
        examId={exam.id}
        initialQuestions={list}
        locked={hasAttempts}
      />

      <Link
        href={`/admin/exams/${exam.id}`}
        className="press mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-field px-2 text-[12.5px] font-semibold text-muted hover:bg-line-soft hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Kembali ke ringkasan
      </Link>
    </>
  );
}
