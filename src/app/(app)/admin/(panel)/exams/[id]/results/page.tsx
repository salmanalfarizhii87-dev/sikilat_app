import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { ExamTabs } from "@/components/admin/exam-tabs";
import { getExam, examHasAttempts } from "@/features/exams/queries";
import { listAttempts, summarizeAttempts } from "@/features/attempts/queries";
import { ExamDetailActions } from "../exam-detail-actions";
import { ResultsClient } from "./results-client";

/**
 * Rekap nilai (T6.2, T6.6).
 *
 * Sebelumnya halaman ini komponen klien yang membaca `demoAttempts` dan
 * menampilkan pemberitahuan bahwa semua nama adalah data contoh. Sekarang
 * barisnya berasal dari `listAttempts`; bila belum ada peserta, yang tampil
 * adalah keadaan kosong, bukan dua belas nama karangan.
 */
export const metadata: Metadata = { title: "Rekap nilai" };

export default async function ExamResultsPage({ params }: PageProps<"/admin/exams/[id]/results">) {
  const { id } = await params;

  const exam = await getExam(id);
  if (!exam) notFound();

  const [attempts, hasAttempts] = await Promise.all([listAttempts(exam.id), examHasAttempts(exam.id)]);

  const summary = summarizeAttempts(attempts, exam.passingScore);

  return (
    <>
      <PageHeader
        title="Rekap nilai"
        description={
          attempts.length === 0
            ? "Belum ada peserta yang mengumpulkan jawaban."
            : `${attempts.length} percobaan, ${exam.questionCount} soal, ${
                exam.passingScore === null ? "tanpa KKM" : `KKM ${exam.passingScore}`
              }.`
        }
        actions={
          <ExamDetailActions
            examId={exam.id}
            code={exam.code}
            title={exam.title}
            status={exam.status}
            phase={
              exam.status === "archived" ? "archived" : exam.status === "draft" ? "draft" : "open"
            }
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

      <ResultsClient
        examId={exam.id}
        examCode={exam.code}
        passingScore={exam.passingScore}
        resultRelease={exam.resultRelease}
        resultsReleasedAt={exam.resultsReleasedAt}
        attempts={attempts}
        summary={summary}
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
