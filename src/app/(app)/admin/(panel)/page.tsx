import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ClipboardCheck,
  FilePlus2,
  Inbox,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { PageHeader, StatCard, StatusBadge, Panel, ExamLinkRow } from "@/components/admin/ui";
import { getAdminOverview } from "@/features/attempts/queries";
import { getExamStatusCounts, listExams } from "@/features/exams/queries";
import { formatClock } from "@/lib/utils";

/**
 * Dashboard admin.
 *
 * Server Component: seluruh angka berasal dari database lewat `getAdminOverview`
 * dan `getExamStatusCounts`. Tidak ada lagi `demoExam`, `demoAttempts`, atau
 * `NAMES` — versi sebelumnya menampilkan 26 siswa fiktif dan nilai karangan, dan
 * satu-satunya cara mengetahuinya adalah membaca kode.
 *
 * Tiga aturan yang dipegang di sini:
 *
 * 1. **Nol berarti nol.** Kalau belum ada peserta, yang tampil adalah 0 dan
 *    ajakan memulai — bukan contoh data supaya halaman "terlihat hidup".
 * 2. **Tanpa KKM tidak dihitung lulus/gagal.** Persentase lulus hanya muncul
 *    bila ada attempt pada ujian yang memang punya `passing_score`.
 * 3. **Waktu tidak dihitung ulang di klien.** Batas waktu ditampilkan sebagai
 *    jam, bukan "sisa 12 menit" yang akan salah begitu halaman dibiarkan
 *    terbuka.
 */
export const metadata: Metadata = { title: "Dashboard" };

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [overview, counts, recentExams] = await Promise.all([
    getAdminOverview(),
    getExamStatusCounts(),
    listExams({ page: 1, pageSize: 4 }),
  ]);

  const { counts: attemptCounts, live, recent } = overview;

  /*
   * Attempt yang menunggu dinilai dipakai sebagai pintu masuk halaman penilaian.
   * Kalau tidak ada, panel "Perlu tindakan" menyatakan tidak ada — bukan
   * menautkan ke attempt karangan yang tidak pernah ada di database.
   */
  const firstPending = recent.find((row) => row.status === "needs_grading") ?? null;

  /*
   * Kode ujian yang dibagikan diambil dari ujian aktif terbaru. Kalau belum ada
   * ujian aktif, panel itu diganti ajakan mempublikasikan — mencetak kode
   * contoh akan menyesatkan peserta yang mencoba memakainya.
   */
  const shareableExam = recentExams.rows.find((exam) => exam.status === "published") ?? null;

  const passRate =
    overview.withKkmCount > 0
      ? (overview.passedCount / overview.withKkmCount) * 100
      : null;

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

      {/* Satu kartu gelap sebagai titik fokus; sisanya tenang. */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard
          label="Sedang mengerjakan"
          value={attemptCounts.inProgress}
          hint={`dari ${attemptCounts.total} percobaan`}
          tone="navy"
          marker
          progress={
            attemptCounts.total > 0 ? (attemptCounts.inProgress / attemptCounts.total) * 100 : 0
          }
        />
        <StatCard
          label="Menunggu nilai"
          value={attemptCounts.needsGrading}
          hint={
            attemptCounts.needsGrading > 0 ? "esai belum dinilai" : "tidak ada yang menunggu"
          }
        />
        <StatCard
          label="Rata-rata nilai"
          value={
            overview.averagePercentage === null
              ? "—"
              : Math.round(overview.averagePercentage * 10) / 10
          }
          hint={
            passRate === null
              ? "Belum ada nilai yang final"
              : `KKM tercapai ${Math.round(passRate)}%`
          }
          progress={passRate ?? undefined}
        />
        <StatCard
          label="Ujian aktif"
          value={counts.published}
          hint={`${counts.all} ujian total`}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Peserta yang mengerjakan"
          description={
            live.length > 0 ? "Paling lama memulai lebih dulu." : "Belum ada yang sedang mengerjakan."
          }
          action={
            <Link
              href="/admin/exams"
              className="press inline-flex h-11 items-center gap-1 rounded-field px-2.5 font-heading text-[12.5px] font-semibold text-navy-700 hover:bg-line-soft"
            >
              Pilih ujian <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          }
          padded={false}
        >
          {live.length === 0 ? (
            <EmptyState
              icon={<Users className="size-6" aria-hidden />}
              title="Belum ada peserta"
              description="Begitu peserta memasukkan kode ujian dan menekan Mulai, namanya muncul di sini."
              action={
                shareableExam ? (
                  <ExamLinkRow code={shareableExam.code} />
                ) : (
                  <Link href="/admin/exams">
                    <Button size="md" variant="secondary">
                      Buka daftar ujian
                    </Button>
                  </Link>
                )
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {live.slice(0, 6).map((row) => {
                const progress =
                  row.questionCount > 0 ? (row.answeredCount / row.questionCount) * 100 : 0;
                return (
                  <li key={row.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-xs bg-line-soft font-heading text-[11px] font-bold text-ink-soft">
                      {row.participantClass ?? "—"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink">
                        {row.participantName}
                      </p>
                      <p className="truncate text-[11.5px] text-muted">{row.examTitle}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line-soft">
                          <div
                            className="h-full rounded-full bg-navy-700"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-[11.5px] tabular text-muted">
                          {row.answeredCount}/{row.questionCount} soal
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 text-right">
                      <span className="block font-heading text-[12px] font-semibold tabular text-ink-soft">
                        {formatClock(row.expiresAt)}
                      </span>
                      <span className="block text-[10.5px] text-muted">batas waktu</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {live.length > 6 && (
            <div className="border-t border-line bg-canvas px-4 py-2">
              <p className="text-[12px] text-muted">
                Dan {live.length - 6} peserta lain. Daftar lengkap ada di tab Monitor tiap ujian.
              </p>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Perlu tindakan" description="Pekerjaan yang menunggu.">
            {attemptCounts.needsGrading > 0 && firstPending ? (
              <ul className="space-y-2">
                <li>
                  <Link
                    href={`/admin/exams/${firstPending.examId}/grading/${firstPending.id}`}
                    className="press flex items-center gap-3 rounded-field border border-accent-200 bg-accent-50 px-3 py-2.5 hover:bg-accent-100"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-xs bg-accent-400 text-navy-900">
                      <ClipboardCheck className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-heading text-[13px] font-bold text-ink">
                        {attemptCounts.needsGrading} percobaan belum dinilai
                      </span>
                      <span className="block truncate text-[11.5px] text-muted">
                        {firstPending.participantName} · {firstPending.examTitle}
                      </span>
                    </span>
                    <ArrowRight className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
                  </Link>
                </li>
              </ul>
            ) : (
              <p className="flex items-start gap-2 rounded-field bg-line-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-soft">
                <Inbox className="mt-px size-4 shrink-0 text-muted" aria-hidden />
                Tidak ada yang menunggu. Semua jawaban esai sudah dinilai.
              </p>
            )}
          </Panel>

          <Panel title="Bagikan kode ujian">
            {shareableExam ? (
              <>
                <div className="flex items-center justify-between rounded-field bg-navy-900 px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="text-[11.5px] text-white/70">Kode ujian</p>
                    <p className="font-heading text-[22px] font-extrabold tracking-[0.18em] text-white">
                      {shareableExam.code}
                    </p>
                    <p className="mt-0.5 truncate text-[11.5px] text-white/60">
                      {shareableExam.title}
                    </p>
                  </div>
                  <Users className="size-5 shrink-0 text-accent-400" aria-hidden />
                </div>
                <div className="mt-2">
                  <ExamLinkRow code={shareableExam.code} />
                </div>
              </>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-muted">
                Belum ada ujian yang aktif. Publikasikan ujian dulu, lalu kodenya muncul di sini
                untuk dibagikan ke peserta.
              </p>
            )}
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Aktivitas terbaru"
          description="Percobaan yang baru dikumpulkan."
          padded={false}
        >
          {recent.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="size-6" aria-hidden />}
              title="Belum ada yang dikumpulkan"
              description="Nilai akan muncul di sini setelah peserta menekan Kumpulkan."
            />
          ) : (
            <div className="scroll-thin relative overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line text-[12px] text-muted">
                    <th scope="col" className="px-4 py-2 font-heading font-semibold">
                      Peserta
                    </th>
                    {/* Kolom waktu disembunyikan di HP: nilai dan status lebih penting. */}
                    <th
                      scope="col"
                      className="hidden px-4 py-2 font-heading font-semibold sm:table-cell"
                    >
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
                  {recent.map((row) => {
                    const percentage =
                      row.maxScore > 0 ? (row.totalScore / row.maxScore) * 100 : null;
                    const passed =
                      row.status === "graded" && row.passingScore !== null && percentage !== null
                        ? percentage >= row.passingScore
                        : null;

                    return (
                      <tr key={row.id} className="hover:bg-canvas">
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/admin/exams/${row.examId}/results`}
                            className="text-[12.5px] font-semibold text-ink hover:text-navy-700"
                          >
                            {row.participantName}
                          </Link>
                          <p className="truncate text-[11.5px] text-muted">
                            {row.participantClass ? `Kelas ${row.participantClass} · ` : ""}
                            {row.examTitle}
                          </p>
                        </td>
                        <td className="hidden px-4 py-2.5 text-[12px] tabular text-muted sm:table-cell">
                          {row.submittedAt ? formatClock(row.submittedAt) : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-heading text-[13px] font-bold tabular text-ink">
                            {percentage === null ? "—" : Math.round(percentage * 10) / 10}
                          </span>
                          <span className="text-[11.5px] text-muted"> /100</span>
                          {/* Penanda lulus hanya bila nilainya sudah final dan ujian punya KKM. */}
                          {passed !== null && (
                            <span
                              className={
                                passed
                                  ? "ml-1.5 font-heading text-[11px] font-semibold text-leaf-700"
                                  : "ml-1.5 font-heading text-[11px] font-semibold text-clay-600"
                              }
                            >
                              {passed ? "lulus" : "di bawah KKM"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          title="Ujian terbaru"
          description="Yang paling akhir dibuat."
          padded={false}
          action={
            <Link
              href="/admin/exams"
              className="press inline-flex h-11 items-center gap-1 rounded-field px-2.5 font-heading text-[12.5px] font-semibold text-navy-700 hover:bg-line-soft"
            >
              Semua <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
        >
          {recentExams.rows.length === 0 ? (
            <EmptyState
              icon={<FilePlus2 className="size-6" aria-hidden />}
              title="Belum ada ujian"
              description="Ujian yang kamu buat akan muncul di sini sebagai draft."
              action={
                <Link href="/admin/exams/new">
                  <Button size="md">
                    <FilePlus2 className="size-4" aria-hidden /> Buat ujian
                  </Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {recentExams.rows.map((exam) => (
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
                        <span className="text-[11.5px] text-muted">
                          {exam.questionCount} soal · {exam.attemptCount} peserta
                        </span>
                      </span>
                    </span>
                    <ArrowUpRight className="size-3.5 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
