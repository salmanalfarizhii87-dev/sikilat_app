import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { ExamTabs } from "@/components/admin/exam-tabs";
import { getExam, examHasAttempts } from "@/features/exams/queries";
import { listAttempts, summarizeAttempts } from "@/features/attempts/queries";
import { ExamDetailActions } from "../exam-detail-actions";
import { MonitorClient } from "./monitor-client";

/**
 * Monitor peserta (T5.3).
 *
 * Halaman ini dulu komponen klien yang membaca `demoAttempts` dan menampilkan
 * pemberitahuan "daftar peserta di bawah adalah data contoh". Sekarang seluruh
 * barisnya berasal dari `listAttempts`, dan saat ujian belum punya peserta yang
 * tampil adalah keadaan kosong yang jujur — bukan nama-nama karangan.
 *
 * Penyegaran berkala dikerjakan klien lewat `router.refresh()`, sehingga angka
 * yang terlihat selalu angka yang baru dibaca server.
 */
export const metadata: Metadata = { title: "Monitor peserta" };

export default async function ExamMonitorPage({ params }: PageProps<"/admin/exams/[id]/monitor">) {
  const { id } = await params;

  const exam = await getExam(id);
  if (!exam) notFound();

  const [attempts, hasAttempts] = await Promise.all([listAttempts(exam.id), examHasAttempts(exam.id)]);

  const summary = summarizeAttempts(attempts, exam.passingScore);

  return (
    <>
      <PageHeader
        title="Monitor peserta"
        description="Peserta yang mengerjakan ujian ini, lengkap dengan sisa waktu dan catatan pelanggaran."
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

      <MonitorClient examId={exam.id} attempts={attempts} summary={summary} />

      <Link
        href={`/admin/exams/${exam.id}`}
        className="press mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-field px-2 text-[12.5px] font-semibold text-muted hover:bg-line-soft hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Kembali ke ringkasan
      </Link>
    </>
  );
}
