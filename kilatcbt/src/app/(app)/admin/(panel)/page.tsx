import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ClipboardCheck,
  FilePlus2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SampleDataNote } from "@/components/ui/primitives";
import { PageHeader, StatCard, StatusBadge, Panel, ExamLinkRow } from "@/components/admin/ui";
import { demoExam, demoExams, demoQuestions } from "@/lib/mock-data";
import {
  activeAttempts,
  answeredIn,
  demoAttempts,
  examSummary,
  pendingAttempts,
  remainingMinutes,
  attemptPercent,
} from "@/lib/admin-data";
import { formatClock } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default function AdminDashboardPage() {
  const summary = examSummary();
  const recent = demoAttempts
    .filter((a) => a.status !== "in_progress")
    .slice(-6)
    .reverse();

  return (
    <>
      <PageHeader
        title="Ringkasan"
        description="Ujian yang sedang berjalan dan pekerjaan yang menunggu."
        actions={
          <>
            <Link href="/admin/exams">
              <Button variant="secondary" size="md">
                Semua ujian
              </Button>
            </Link>
            <Link href="/admin/exams/new">
              <Button size="md">
                <FilePlus2 className="size-4" aria-hidden /> Buat ujian
              </Button>
            </Link>
          </>
        }
      />

      <SampleDataNote className="mb-3" />

      {/* Satu kartu gelap sebagai titik fokus; sisanya tenang. */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard
          label="Sedang mengerjakan"
          value={summary.active}
          hint={`dari ${summary.total} peserta`}
          tone="navy"
          marker
        />
        <StatCard
          label="Menunggu nilai"
          value={summary.pending}
          hint="esai belum dinilai"
        />
        <StatCard
          label="Rata-rata nilai"
          value={summary.average}
          hint={`KKM ${demoExam.passingScore}, ${summary.passRate}% lulus`}
        />
        <StatCard
          label="Ujian aktif"
          value={demoExams.filter((e) => e.status === "published").length}
          hint={`${demoExams.length} ujian total`}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Ujian yang berjalan"
          description="Peserta yang masih mengerjakan."
          action={
            <Link
              href={`/admin/exams/${demoExam.id}/monitor`}
              className="press inline-flex h-11 items-center gap-1 rounded-field px-2.5 font-heading text-[12.5px] font-semibold text-navy-700 hover:bg-line-soft"
            >
              Buka monitor <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          }
          padded={false}
        >
          <div className="border-b border-line bg-canvas px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StatusBadge status={demoExam.status} />
                  <span className="rounded-xs bg-line-soft px-1.5 py-0.5 font-heading text-[11px] font-bold text-ink-soft">
                    {demoExam.code}
                  </span>
                </div>
                <p className="mt-1.5 truncate font-heading text-[14px] font-bold text-ink">
                  {demoExam.title}
                </p>
                <p className="text-[12px] text-muted">
                  {demoExam.subjectLabel} · {demoQuestions.length} soal ·{" "}
                  {demoExam.durationMinutes} menit
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Link href={`/admin/exams/${demoExam.id}/results`}>
                  <Button variant="secondary" size="sm">
                    Rekap
                  </Button>
                </Link>
                <Link href={`/admin/exams/${demoExam.id}`}>
                  <Button size="sm">Kelola</Button>
                </Link>
              </div>
            </div>
          </div>

          <ul className="divide-y divide-line">
            {activeAttempts.slice(0, 5).map((attempt) => {
              const answered = answeredIn(attempt);
              const left = remainingMinutes(attempt);
              return (
                <li key={attempt.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xs bg-line-soft font-heading text-[11px] font-bold text-ink-soft">
                    {attempt.participantClass}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink">
                      {attempt.participantName}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line-soft">
                        <div
                          className="h-full rounded-full bg-navy-700"
                          style={{ width: `${(answered / demoQuestions.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-[11.5px] tabular text-muted">
                        {answered}/{demoQuestions.length} soal
                      </span>
                    </div>
                  </div>
                  <span
                    className={
                      left <= 10
                        ? "font-heading text-[12px] font-bold tabular text-clay-600"
                        : "font-heading text-[12px] font-semibold tabular text-ink-soft"
                    }
                  >
                    {left} mnt
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className="space-y-4">
          <Panel title="Perlu tindakan" description="Pekerjaan yang menunggu.">
            <ul className="space-y-2">
              <li>
                <Link
                  href={`/admin/exams/${demoExam.id}/grading/${pendingAttempts[0]?.id ?? "att_13"}`}
                  className="press flex items-center gap-3 rounded-field border border-accent-200 bg-accent-50 px-3 py-2.5 hover:bg-accent-100"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-xs bg-accent-400 text-navy-900">
                    <ClipboardCheck className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-heading text-[13px] font-bold text-ink">
                      {summary.pending} esai belum dinilai
                    </span>
                    <span className="block text-[11.5px] text-muted">Mulai dari yang terbaru</span>
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/exams/exm_02"
                  className="press flex items-center gap-3 rounded-field border border-line bg-surface px-3 py-2.5 hover:bg-line-soft"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-xs bg-line-soft text-ink-soft">
                    <CalendarDays className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-heading text-[13px] font-bold text-ink">
                      1 draft belum dipublikasikan
                    </span>
                    <span className="block text-[11.5px] text-muted">
                      Latihan Tryout Bahasa Indonesia
                    </span>
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            </ul>
          </Panel>

          <Panel title="Bagikan kode ujian">
            <div className="flex items-center justify-between rounded-field bg-navy-900 px-3.5 py-3">
              <div>
                <p className="text-[11.5px] text-white/70">Kode ujian</p>
                <p className="font-heading text-[22px] font-extrabold tracking-[0.18em] text-white">
                  {demoExam.code}
                </p>
              </div>
              <Users className="size-5 text-accent-400" aria-hidden />
            </div>
            <div className="mt-2">
              <ExamLinkRow code={demoExam.code} />
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Aktivitas terbaru" description="Percobaan yang baru selesai." padded={false}>
          <div className="scroll-thin relative overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead>
                <tr className="border-b border-line text-[12px] text-muted">
                  <th scope="col" className="px-4 py-2 font-heading font-semibold">
                    Peserta
                  </th>
                  <th scope="col" className="px-4 py-2 font-heading font-semibold">
                    Selesai
                  </th>
                  <th scope="col" className="px-4 py-2 font-heading font-semibold">
                    Nilai
                  </th>
                  <th scope="col" className="px-4 py-2 font-heading font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recent.map((attempt) => {
                  const pct = attemptPercent(attempt);
                  return (
                    <tr key={attempt.id} className="hover:bg-canvas">
                      <td className="px-4 py-2.5">
                        <p className="text-[12.5px] font-semibold text-ink">
                          {attempt.participantName}
                        </p>
                        <p className="text-[11.5px] text-muted">Kelas {attempt.participantClass}</p>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] tabular text-muted">
                        {attempt.submittedAt ? formatClock(attempt.submittedAt) : "-"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-heading text-[13px] font-bold tabular text-ink">
                          {pct}
                        </span>
                        <span className="text-[11.5px] text-muted"> /100</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={attempt.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Semua ujian" description="Tiga ujian terakhir." padded={false}>
          <ul className="divide-y divide-line">
            {demoExams.map((exam) => (
              <li key={exam.id}>
                <Link
                  href={`/admin/exams/${exam.id}`}
                  className="press flex items-center gap-3 px-4 py-3 hover:bg-canvas"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xs bg-line-soft font-heading text-[11px] font-bold text-ink-soft">
                    {exam.code.slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-ink">
                      {exam.title}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <StatusBadge status={exam.status} />
                      <span className="text-[11.5px] text-muted">{exam.durationMinutes} menit</span>
                    </span>
                  </span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
