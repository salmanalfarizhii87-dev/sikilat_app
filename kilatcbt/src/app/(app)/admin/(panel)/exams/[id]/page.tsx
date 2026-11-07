"use client";

import * as React from "react";
import Link from "next/link";
import {
  Archive,
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  Clock3,
  Copy,
  Eye,
  FileStack,
  KeyRound,
  Lock,
  Pause,
  Play,
  RefreshCw,
  Settings2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, SampleDataNote } from "@/components/ui/primitives";
import {
  PageHeader,
  StatCard,
  Panel,
  ExamLinkRow,
  CopyButton,
  StatusBadge,
} from "@/components/admin/ui";
import { ExamTabs } from "@/components/admin/exam-tabs";
import { demoExam, demoQuestions } from "@/lib/mock-data";
import {
  activeAttempts,
  answeredIn,
  attemptPercent,
  demoAttempts,
  examSummary,
  pendingAttempts,
  remainingMinutes,
} from "@/lib/admin-data";
import { formatDateTimeId, formatDuration } from "@/lib/utils";

/** Semua aksi di halaman ini butuh server; toast-nya menyebut itu apa adanya. */
const OFFLINE = "Belum tersambung ke server. Tidak ada yang berubah.";

export default function ExamDetailPage({ params }: PageProps<"/admin/exams/[id]">) {
  const { id } = React.use(params);
  const exam = demoExam;
  const summary = examSummary();
  // Ujian demo selalu terbuka; ini meniru apa yang akan dikontrol tombolnya.
  const open = exam.status === "published";
  const totalPoints = demoQuestions.reduce((s, q) => s + q.points, 0);

  return (
    <>
      <PageHeader
        title={exam.title}
        description={exam.description}
        actions={
          <>
            <Button variant="secondary" size="md" onClick={() => toast(OFFLINE)}>
              {open ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
              {open ? "Tutup sekarang" : "Buka sekarang"}
            </Button>
            <Link href={`/admin/exams/${id}/questions`}>
              <Button size="md">
                <ClipboardList className="size-4" aria-hidden /> Kelola soal
              </Button>
            </Link>
          </>
        }
      >
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
          <StatusBadge status={exam.status} />
          <span className="rounded-xs bg-line-soft px-1.5 py-0.5 font-heading text-[11px] font-bold text-ink-soft">
            {exam.code}
          </span>
          {exam.subjectLabel}
        </p>
      </PageHeader>

      <ExamTabs examId={id} />

      <SampleDataNote className="mb-3">
        Ujian ini contoh bawaan. Angka peserta dan nilai di bawah berasal dari data contoh.
      </SampleDataNote>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard
          label="Status"
          value={open ? "Aktif" : "Ditutup"}
          hint={open ? "Peserta bisa masuk" : "Peserta ditolak"}
          tone={open ? "green" : "plain"}
          marker
        />
        <StatCard
          label="Peserta"
          value={demoAttempts.length}
          hint={`${summary.active} sedang mengerjakan`}
        />
        <StatCard label="Rata-rata" value={summary.average} hint={`${summary.passRate}% lulus KKM`} />
        <StatCard
          label="Perlu dinilai"
          value={summary.pending}
          hint="percobaan dengan esai"
          tone="amber"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          <Panel title="Kode dan tautan peserta">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-card bg-navy-900 px-4 py-3">
                <p className="text-[11.5px] font-medium text-white/75">Kode ujian</p>
                <p className="font-heading text-[26px] font-extrabold tracking-[0.16em] text-white">
                  {exam.code}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <CopyButton value={exam.code} label="Salin kode" size="md" variant="dark" />
                <button
                  type="button"
                  onClick={() => toast(OFFLINE)}
                  className="press inline-flex h-11 items-center gap-1.5 rounded-field px-2.5 font-heading text-[12px] font-semibold text-muted hover:bg-line-soft"
                >
                  <RefreshCw className="size-3.5" aria-hidden /> Buat kode baru
                </button>
              </div>
            </div>

            <div className="mt-3">
              <ExamLinkRow code={exam.code} />
            </div>

            <p className="mt-2.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-muted">
              <KeyRound className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Kode baru tidak menghapus pengerjaan yang sedang berjalan. Peserta lama tetap bisa
              melanjutkan dengan Kode Lanjut.
            </p>
          </Panel>

          <Panel title="Jadwal dan durasi">
            <dl className="grid gap-2 sm:grid-cols-2">
              {[
                { icon: Clock3, label: "Durasi", value: formatDuration(exam.durationMinutes * 60) },
                {
                  icon: CalendarClock,
                  label: "Dibuka",
                  value: exam.opensAt ? formatDateTimeId(exam.opensAt) : "Buka manual",
                },
                {
                  icon: CalendarClock,
                  label: "Ditutup",
                  value: exam.closesAt ? formatDateTimeId(exam.closesAt) : "Tutup manual",
                },
                { icon: Users, label: "Maks percobaan", value: `${exam.maxAttempts} kali per nama` },
              ].map((item) => (
                <div key={item.label} className="rounded-field border border-line px-3 py-2">
                  <dt className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
                    <item.icon className="size-3.5" aria-hidden /> {item.label}
                  </dt>
                  <dd className="mt-0.5 font-heading text-[13px] font-bold text-ink">{item.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone={exam.shuffleQuestions ? "navy" : "outline"}>
                {exam.shuffleQuestions ? "Soal diacak" : "Soal berurutan"}
              </Badge>
              <Badge tone={exam.shuffleOptions ? "navy" : "outline"}>
                {exam.shuffleOptions ? "Opsi diacak" : "Opsi berurutan"}
              </Badge>
              <Badge tone={exam.askClass ? "amber" : "outline"}>
                {exam.askClass ? "Kelas diminta" : "Tanpa kelas"}
              </Badge>
              <Badge tone="outline">
                {exam.resultVisibility === "score_and_review" ? "Skor dan pembahasan" : "Skor saja"}
              </Badge>
              <Badge tone="outline">KKM {exam.passingScore}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/admin/exams/${id}/settings`}>
                <Button variant="secondary" size="sm">
                  <Settings2 className="size-3.5" aria-hidden /> Ubah pengaturan
                </Button>
              </Link>
              <Link href={`/u/${exam.code}`} target="_blank" rel="noreferrer">
                <Button variant="ghost" size="sm">
                  <Eye className="size-3.5" aria-hidden /> Lihat sebagai peserta
                </Button>
              </Link>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Isi ujian">
            <dl className="space-y-2 text-[12.5px]">
              {[
                { label: "Jumlah soal", value: `${demoQuestions.length} soal`, icon: FileStack },
                { label: "Total poin", value: `${totalPoints} poin`, icon: ClipboardList },
                {
                  label: "Soal esai",
                  value: `${demoQuestions.filter((q) => q.type === "essay").length} soal`,
                  icon: ClipboardList,
                },
                {
                  label: "PG banyak jawaban",
                  value: `${demoQuestions.filter((q) => q.type === "mcq_multiple").length} soal`,
                  icon: Copy,
                },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-1.5 text-muted">
                    <row.icon className="size-3.5 text-navy-600" aria-hidden /> {row.label}
                  </dt>
                  <dd className="font-heading font-bold text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 rounded-field border border-accent-200 bg-accent-50 px-3 py-2">
              <p className="flex items-center gap-1.5 font-heading text-[12px] font-bold text-accent-900">
                <Lock className="size-3.5" aria-hidden /> Soal terkunci
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-accent-900">
                Sudah ada {demoAttempts.length} percobaan. Isi soal tidak bisa diubah lagi.
              </p>
            </div>
          </Panel>

          <Panel
            title="Peserta terbaru"
            padded={false}
            action={
              <Link
                href={`/admin/exams/${id}/monitor`}
                className="press inline-flex min-h-11 items-center gap-1 rounded-field px-2.5 py-1 font-heading text-[12px] font-semibold text-navy-700 hover:bg-line-soft"
              >
                Monitor <ArrowUpRight className="size-3" aria-hidden />
              </Link>
            }
          >
            <ul className="divide-y divide-line">
              {[...activeAttempts.slice(0, 3), ...pendingAttempts.slice(0, 2)].map((attempt) => (
                <li key={attempt.id} className="flex items-center gap-2.5 px-4 py-2.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-xs bg-line-soft font-heading text-[11px] font-bold text-ink-soft">
                    {attempt.participantClass}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-ink">
                      {attempt.participantName}
                    </p>
                    <p className="text-[11.5px] text-muted">
                      {attempt.status === "in_progress"
                        ? `${answeredIn(attempt)}/${demoQuestions.length} terjawab, sisa ${remainingMinutes(attempt)} mnt`
                        : `Nilai ${attemptPercent(attempt)}, perlu dinilai`}
                    </p>
                  </div>
                  <StatusBadge status={attempt.status} />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Zona berbahaya" description="Aksi di sini belum bisa dibatalkan.">
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => toast(OFFLINE)}
                className="press flex min-h-11 w-full items-center gap-2 rounded-field border border-line px-3 py-2 text-left text-[12.5px] text-ink-soft hover:bg-line-soft"
              >
                <Copy className="size-3.5" aria-hidden /> Duplikat ujian ini
              </button>
              <button
                type="button"
                onClick={() => toast(OFFLINE)}
                className="press flex min-h-11 w-full items-center gap-2 rounded-field border border-line px-3 py-2 text-left text-[12.5px] text-ink-soft hover:bg-line-soft"
              >
                <Archive className="size-3.5" aria-hidden /> Arsipkan ujian
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
