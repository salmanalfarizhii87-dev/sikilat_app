"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Eye,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatClock } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useClock } from "@/lib/client-hooks";
import { Panel, SearchInput, StatCard, StatusBadge } from "@/components/admin/ui";
import { resetAttempt } from "@/features/grading/actions";
import type { AdminAttemptRow, ExamAttemptSummary } from "@/features/attempts/queries";

/**
 * Monitor peserta (T5.3, GRD-04).
 *
 * Sebelumnya halaman ini membaca `demoAttempts` dan `demoExam`, menulis
 * "Belum tersambung ke server" pada tombol reset, dan menghitung "belum mulai"
 * dari angka karangan. Sekarang seluruh barisnya datang dari `listAttempts`,
 * dan yang tidak ada di database tidak ditampilkan sama sekali.
 *
 * Penyegaran memakai `router.refresh()`, bukan state lokal: data peserta adalah
 * data server, dan menghitung ulang di peramban akan menampilkan angka yang
 * berbeda dari yang dilihat admin lain.
 */

type Tab = "all" | "in_progress" | "needs_grading" | "graded";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "in_progress", label: "Mengerjakan" },
  { key: "needs_grading", label: "Perlu dinilai" },
  { key: "graded", label: "Selesai" },
];

/** Selisih menit menuju `expiresAt`; negatif berarti sudah lewat. */
function minutesLeft(expiresAt: string, now: number) {
  return Math.round((new Date(expiresAt).getTime() - now) / 60_000);
}

export function MonitorClient({
  examId,
  attempts,
  summary,
}: {
  examId: string;
  attempts: AdminAttemptRow[];
  summary: ExamAttemptSummary;
}) {
  const router = useRouter();

  const [tab, setTab] = React.useState<Tab>("all");
  const [query, setQuery] = React.useState("");
  const [live, setLive] = React.useState(true);
  const [detail, setDetail] = React.useState<AdminAttemptRow | null>(null);
  const [resetTarget, setResetTarget] = React.useState<AdminAttemptRow | null>(null);
  const [pending, setPending] = React.useState(false);

  /*
   * Waktu "sekarang" datang dari store bersama di `useClock()`, bukan dari state
   * yang disetel di dalam efek. Menyetel state di badan efek memicu render
   * berantai, dan `Date.now()` saat SSR tidak akan pernah sama dengan nilai di
   * peramban — `useClock()` mengembalikan `null` sampai hidrasi selesai, dan
   * hitungan mundur ditampilkan sebagai tanda hubung sampai saat itu.
   */
  const now = useClock();

  React.useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => router.refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [live, router]);

  const counts = {
    all: attempts.length,
    in_progress: summary.inProgress,
    needs_grading: summary.needsGrading,
    graded: summary.graded,
  };

  const rows = attempts.filter((attempt) => {
    if (tab !== "all" && attempt.status !== tab) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      attempt.participantName.toLowerCase().includes(q) ||
      (attempt.participantClass ?? "").toLowerCase().includes(q)
    );
  });

  const syncedAt =
    now === null
      ? null
      : new Date(now).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Jakarta",
        });

  const doReset = async () => {
    if (!resetTarget) return;

    setPending(true);
    const result = await resetAttempt({ attemptId: resetTarget.id, mode: "delete" });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    toast.success(`Percobaan ${resetTarget.participantName} dihapus.`);
    setResetTarget(null);
    router.refresh();
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <StatCard
          label="Mengerjakan"
          value={summary.inProgress}
          hint="percobaan aktif"
          tone="navy"
          marker
        />
        <StatCard
          label="Perlu dinilai"
          value={summary.needsGrading}
          hint="esai menunggu"
          tone="amber"
        />
        <StatCard label="Selesai" value={summary.graded} hint="sudah dinilai penuh" tone="green" />
      </div>

      <div className="mt-4">
        <Panel
          padded={false}
          title="Peserta"
          description={
            syncedAt ? `Terakhir disinkron ${syncedAt} WIB` : "Menunggu sinkronisasi pertama"
          }
          action={
            <div className="flex flex-wrap items-center gap-1.5">
              <Button variant="secondary" size="md" onClick={() => setLive((v) => !v)}>
                {live ? (
                  <Pause className="size-4" aria-hidden />
                ) : (
                  <Play className="size-4" aria-hidden />
                )}
                {live ? "Jeda" : "Lanjutkan"}
              </Button>
              <Button size="md" onClick={() => router.refresh()}>
                <RefreshCw className="size-4" aria-hidden /> Segarkan
              </Button>
            </div>
          }
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
            <div
              className="scroll-thin flex flex-1 gap-1.5 overflow-x-auto"
              role="group"
              aria-label="Filter status peserta"
            >
              {TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  aria-pressed={tab === item.key}
                  className={cn(
                    "press flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-heading text-[12px] font-semibold transition-colors",
                    tab === item.key
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-line bg-surface text-ink-soft hover:bg-line-soft",
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10.5px] tabular",
                      tab === item.key ? "bg-white/20 text-white" : "bg-line-soft text-muted",
                    )}
                  >
                    {counts[item.key]}
                  </span>
                </button>
              ))}
            </div>
            <SearchInput
              value={query}
              onChange={setQuery}
              label="Cari peserta"
              placeholder="Cari nama atau kelas"
              className="w-[180px]"
            />
          </div>

          <div className="scroll-thin relative overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-line bg-canvas text-[12px] text-muted">
                  <th scope="col" className="px-4 py-2 font-heading font-semibold">
                    Peserta
                  </th>
                  <th scope="col" className="px-3 py-2 font-heading font-semibold">
                    Progres
                  </th>
                  <th scope="col" className="px-3 py-2 font-heading font-semibold">
                    Mulai
                  </th>
                  <th scope="col" className="px-3 py-2 font-heading font-semibold">
                    Sisa waktu
                  </th>
                  <th scope="col" className="px-3 py-2 font-heading font-semibold">
                    Pelanggaran
                  </th>
                  <th scope="col" className="px-3 py-2 font-heading font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2">
                    <span className="sr-only">Detail</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((attempt) => {
                  const left = now === null ? null : minutesLeft(attempt.expiresAt, now);
                  const progress =
                    attempt.questionCount > 0
                      ? (attempt.answeredCount / attempt.questionCount) * 100
                      : 0;

                  return (
                    <tr key={attempt.id} className="hover:bg-canvas">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="grid size-7 shrink-0 place-items-center rounded-xs bg-line-soft font-heading text-[10px] font-bold text-ink-soft">
                            {attempt.participantClass?.slice(0, 3).toUpperCase() ?? "—"}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-semibold text-ink">
                              {attempt.participantName}
                            </p>
                            <p className="text-[11.5px] text-muted">
                              Percobaan {attempt.attemptNo}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line-soft">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                attempt.status === "in_progress" ? "bg-navy-700" : "bg-leaf-600",
                              )}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-[11.5px] tabular text-muted">
                            {attempt.answeredCount}/{attempt.questionCount}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px] tabular text-muted">
                        {formatClock(attempt.startedAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        {attempt.status === "in_progress" && left !== null ? (
                          <span
                            className={cn(
                              "font-heading text-[12px] font-bold tabular",
                              left <= 10 ? "text-clay-600" : "text-ink-soft",
                            )}
                          >
                            {left > 0 ? `${left} mnt` : "habis"}
                          </span>
                        ) : (
                          <span className="text-[11.5px] text-muted">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {attempt.violationCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-xs border border-clay-200 bg-clay-50 px-1.5 py-0.5 text-[11px] font-semibold text-clay-700">
                            <AlertTriangle className="size-3" aria-hidden />{" "}
                            {attempt.violationCount}
                          </span>
                        ) : (
                          <span className="text-[11.5px] text-muted">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={attempt.status} />
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => setDetail(attempt)}
                          className="press grid size-11 place-items-center rounded-field text-muted hover:bg-line-soft hover:text-ink"
                          aria-label={`Lihat detail ${attempt.participantName}`}
                        >
                          <ChevronRight className="size-4" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {attempts.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="font-heading text-[13px] font-bold text-ink">Belum ada peserta</p>
              <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted">
                Peserta akan muncul di sini begitu mereka membuka tautan ujian dan menekan Mulai.
                Bagikan tautannya dari tab Ringkasan.
              </p>
            </div>
          )}

          {attempts.length > 0 && rows.length === 0 && (
            <p className="px-4 py-8 text-center text-[12.5px] text-muted">
              Tidak ada peserta yang cocok dengan filter ini.
            </p>
          )}
        </Panel>
      </div>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.participantName ?? ""}
        description={
          detail
            ? `Kelas ${detail.participantClass ?? "-"} · percobaan ${detail.attemptNo}`
            : undefined
        }
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDetail(null)}>
              Tutup
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setResetTarget(detail);
                setDetail(null);
              }}
            >
              <RotateCcw className="size-4" aria-hidden /> Reset percobaan
            </Button>
            {detail && (
              <Link href={`/admin/exams/${examId}/grading/${detail.id}`}>
                <Button>
                  <Eye className="size-4" aria-hidden /> Buka penilaian
                </Button>
              </Link>
            )}
          </>
        }
      >
        {detail && (
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-2">
              {[
                [
                  "Status",
                  detail.status === "in_progress"
                    ? "Mengerjakan"
                    : detail.status === "needs_grading"
                      ? "Perlu dinilai"
                      : "Selesai",
                ],
                ["Progres", `${detail.answeredCount}/${detail.questionCount} soal`],
                ["Mulai", formatClock(detail.startedAt)],
                [
                  "Dikumpulkan",
                  detail.submittedAt ? formatClock(detail.submittedAt) : "belum",
                ],
                [
                  "Nilai",
                  detail.status === "graded"
                    ? `${detail.totalScore}/${detail.maxScore}`
                    : `${detail.totalScore}/${detail.maxScore} (sementara)`,
                ],
                [
                  "Esai menunggu",
                  detail.pendingEssayCount > 0 ? `${detail.pendingEssayCount} soal` : "tidak ada",
                ],
              ].map(([label, value]) => (
                <div key={label} className="rounded-field border border-line px-3 py-2">
                  <dt className="text-[12px] font-medium text-muted">{label}</dt>
                  <dd className="mt-0.5 font-heading text-[12.5px] font-bold text-ink">{value}</dd>
                </div>
              ))}
            </dl>

            <div>
              <p className="font-heading text-[12px] font-bold text-ink">Riwayat peristiwa</p>
              {detail.events.length === 0 ? (
                <p className="mt-1.5 text-[12px] text-muted">Belum ada peristiwa tercatat.</p>
              ) : (
                <ul className="mt-1.5 space-y-1.5">
                  {detail.events.map((event, i) => (
                    <li
                      key={`${event.type}-${event.at}-${i}`}
                      className="flex items-center justify-between gap-2 rounded-field bg-line-soft px-2.5 py-1.5 text-[11.5px]"
                    >
                      <span className="flex items-center gap-1.5 text-ink-soft">
                        {event.type === "tab_hidden" || event.type === "fullscreen_exit" ? (
                          <AlertTriangle className="size-3 text-clay-600" aria-hidden />
                        ) : (
                          <CheckCircle2 className="size-3 text-leaf-700" aria-hidden />
                        )}
                        {eventLabel(event.type)}
                      </span>
                      <span className="tabular text-muted">{formatClock(event.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title="Reset percobaan?"
        description="Jawaban dan nilai percobaan ini dihapus, lalu peserta bisa mengerjakan lagi selama kuota percobaannya masih ada."
        icon={
          <span className="grid size-10 place-items-center rounded-card bg-clay-50 text-clay-600">
            <RotateCcw className="size-5" aria-hidden />
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetTarget(null)} disabled={pending}>
              Batal
            </Button>
            <Button variant="danger" onClick={doReset} disabled={pending}>
              {pending ? "Menghapus…" : "Ya, reset"}
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-muted">
          Peserta: <strong className="text-ink">{resetTarget?.participantName}</strong> (kelas{" "}
          {resetTarget?.participantClass ?? "-"}). Tindakan ini tercatat di log admin.
        </p>
      </Modal>
    </>
  );
}

/** Label manusia untuk tipe kejadian integritas. */
function eventLabel(type: string) {
  const map: Record<string, string> = {
    start: "Mulai ujian",
    submit: "Mengumpulkan",
    tab_hidden: "Pindah tab terdeteksi",
    fullscreen_exit: "Keluar layar penuh",
    paste: "Menempel teks",
    report: "Melaporkan soal bermasalah",
    resume: "Melanjutkan sesi",
  };
  return map[type] ?? type;
}
