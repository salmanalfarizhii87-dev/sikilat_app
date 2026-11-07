"use client";

import * as React from "react";
import Link from "next/link";
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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SampleDataNote } from "@/components/ui/primitives";
import { PageHeader, StatCard, Panel, SearchInput, StatusBadge } from "@/components/admin/ui";
import { ExamTabs } from "@/components/admin/exam-tabs";
import { demoExam, demoQuestions } from "@/lib/mock-data";
import {
  activeAttempts,
  answeredIn,
  demoAttempts,
  pendingAttempts,
  remainingMinutes,
} from "@/lib/admin-data";
import { formatClock } from "@/lib/utils";
import type { Attempt } from "@/lib/types";

type Tab = "all" | "in_progress" | "needs_grading" | "graded";

const OFFLINE = "Belum tersambung ke server. Tidak ada yang berubah.";

/** Jam dinding WIB, dihitung di perangkat saat dipanggil. */
function clockNow() {
  return new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

export default function ExamMonitorPage({ params }: PageProps<"/admin/exams/[id]">) {
  const { id } = React.use(params);
  const [tab, setTab] = React.useState<Tab>("all");
  const [query, setQuery] = React.useState("");
  const [, refresh] = React.useState(0);
  const [live, setLive] = React.useState(true);
  const [detail, setDetail] = React.useState<Attempt | null>(null);
  const [resetTarget, setResetTarget] = React.useState<Attempt | null>(null);
  // `null` sampai sinkronisasi pertama di browser. Merender jam saat SSR tidak
  // akan cocok dengan klien.
  const [syncedAt, setSyncedAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => {
      refresh((t) => t + 1);
      setSyncedAt(clockNow());
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [live]);

  const syncNow = () => {
    refresh((t) => t + 1);
    setSyncedAt(clockNow());
  };

  const rows = demoAttempts.filter((a) => {
    if (tab !== "all" && a.status !== tab) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      a.participantName.toLowerCase().includes(q) ||
      (a.participantClass ?? "").toLowerCase().includes(q)
    );
  });

  const summary = {
    active: activeAttempts.length,
    pending: pendingAttempts.length,
    graded: demoAttempts.filter((a) => a.status === "graded").length,
    notStarted: 3,
  };

  const filters: [Tab, string, number][] = [
    ["all", "Semua", demoAttempts.length],
    ["in_progress", "Mengerjakan", summary.active],
    ["needs_grading", "Perlu dinilai", summary.pending],
    ["graded", "Selesai", summary.graded],
  ];

  return (
    <>
      <PageHeader
        title="Monitor peserta"
        description="Daftar peserta yang sedang mengerjakan, lengkap dengan sisa waktu dan catatan pelanggaran."
        actions={
          <>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-heading text-[11.5px] font-semibold",
                live
                  ? "border-leaf-200 bg-leaf-50 text-leaf-800"
                  : "border-line bg-line-soft text-muted",
              )}
            >
              {/* Titik statis: denyut berulang adalah gerak tanpa peristiwa. */}
              <span
                className={cn("size-1.5 rounded-full", live ? "bg-leaf-700" : "bg-faint")}
                aria-hidden
              />
              {live ? "Diperbarui tiap 10 detik" : "Dijeda"}
            </span>
            <Button variant="secondary" size="md" onClick={() => setLive((v) => !v)}>
              {live ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
              {live ? "Jeda" : "Lanjutkan"}
            </Button>
            <Button size="md" onClick={syncNow}>
              <RefreshCw className="size-4" aria-hidden /> Segarkan
            </Button>
          </>
        }
      >
        <p className="mt-2 text-[12.5px] text-muted">
          {demoExam.subjectLabel} · {demoExam.code}
        </p>
      </PageHeader>

      <ExamTabs examId={id} />

      <SampleDataNote className="mb-3">
        Daftar peserta di bawah adalah data contoh. Tidak ada peserta sungguhan yang terhubung.
      </SampleDataNote>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label="Mengerjakan" value={summary.active} hint="percobaan aktif" tone="navy" marker />
        <StatCard label="Perlu dinilai" value={summary.pending} hint="esai menunggu" tone="amber" />
        <StatCard label="Selesai" value={summary.graded} hint="sudah dinilai penuh" tone="green" />
        <StatCard
          label="Belum mulai"
          value={summary.notStarted}
          hint={`dari ${demoAttempts.length + summary.notStarted} nama`}
        />
      </div>

      <div className="mt-4">
        <Panel
          padded={false}
          title="Peserta"
          description={
            syncedAt ? `Terakhir disinkron ${syncedAt} WIB` : "Menunggu sinkronisasi pertama"
          }
          action={
            <SearchInput
              value={query}
              onChange={setQuery}
              label="Cari peserta"
              placeholder="Cari nama atau kelas"
              className="w-[180px]"
            />
          }
        >
          <div
            className="scroll-thin flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2"
            role="group"
            aria-label="Filter status peserta"
          >
            {filters.map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-pressed={tab === key}
                className={cn(
                  "press flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-heading text-[12px] font-semibold transition-colors",
                  tab === key
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-line bg-surface text-ink-soft hover:bg-line-soft",
                )}
              >
                {label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10.5px] tabular",
                    tab === key ? "bg-white/20 text-white" : "bg-line-soft text-muted",
                  )}
                >
                  {count}
                </span>
              </button>
            ))}
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
                  const answered = answeredIn(attempt);
                  const left = remainingMinutes(attempt);
                  const violations = attempt.events.filter(
                    (e) => e.type === "tab_hidden" || e.type === "fullscreen_exit",
                  ).length;
                  return (
                    <tr key={attempt.id} className="cursor-pointer hover:bg-canvas">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="grid size-7 shrink-0 place-items-center rounded-xs bg-line-soft font-heading text-[11px] font-bold text-ink-soft">
                            {attempt.participantClass}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-semibold text-ink">
                              {attempt.participantName}
                            </p>
                            <p className="text-[11.5px] text-muted">
                              Percobaan {attempt.attemptNo}, kode {attempt.resumeCode}
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
                              style={{ width: `${(answered / demoQuestions.length) * 100}%` }}
                            />
                          </div>
                          <span className="text-[11.5px] tabular text-muted">
                            {answered}/{demoQuestions.length}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px] tabular text-muted">
                        {formatClock(attempt.startedAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        {attempt.status === "in_progress" ? (
                          <span
                            className={cn(
                              "font-heading text-[12px] font-bold tabular",
                              left <= 10 ? "text-clay-600" : "text-ink-soft",
                            )}
                          >
                            {left} mnt
                          </span>
                        ) : (
                          <span className="text-[11.5px] text-muted">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {violations > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-xs border border-clay-200 bg-clay-50 px-1.5 py-0.5 text-[11px] font-semibold text-clay-700">
                            <AlertTriangle className="size-3" aria-hidden /> {violations}
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

          {rows.length === 0 && (
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
            ? `Kelas ${detail.participantClass ?? "-"}, percobaan ${detail.id}`
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
            <Link href={`/admin/exams/${id}/grading/${detail?.id ?? "att_13"}`}>
              <Button>
                <Eye className="size-4" aria-hidden /> Buka penilaian
              </Button>
            </Link>
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
                ["Progres", `${answeredIn(detail)}/${demoQuestions.length} soal`],
                ["Mulai", formatClock(detail.startedAt)],
                [
                  "Sisa",
                  detail.status === "in_progress" ? `${remainingMinutes(detail)} menit` : "-",
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
              <ul className="mt-1.5 space-y-1.5">
                {detail.events.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-center justify-between gap-2 rounded-field bg-line-soft px-2.5 py-1.5 text-[11.5px]"
                  >
                    <span className="flex items-center gap-1.5 text-ink-soft">
                      {event.type === "tab_hidden" ? (
                        <AlertTriangle className="size-3 text-clay-600" aria-hidden />
                      ) : (
                        <CheckCircle2 className="size-3 text-leaf-700" aria-hidden />
                      )}
                      {event.type === "start"
                        ? "Mulai ujian"
                        : event.type === "submit"
                          ? "Kumpulkan"
                          : event.type === "tab_hidden"
                            ? "Pindah tab terdeteksi"
                            : event.type === "paste"
                              ? "Tempel teks"
                              : event.type === "fullscreen_exit"
                                ? "Keluar layar penuh"
                                : "Melanjutkan"}
                    </span>
                    <span className="tabular text-muted">{formatClock(event.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title="Reset percobaan?"
        description="Jawaban peserta akan dihapus dan percobaan ditandai dibatalkan. Peserta dapat memulai lagi bila masih ada sisa percobaan."
        icon={
          <span className="grid size-10 place-items-center rounded-card bg-clay-50 text-clay-600">
            <RotateCcw className="size-5" aria-hidden />
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetTarget(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                toast(OFFLINE);
                setResetTarget(null);
              }}
            >
              Ya, reset
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-muted">
          Peserta: <strong className="text-ink">{resetTarget?.participantName}</strong> (kelas{" "}
          {resetTarget?.participantClass ?? "-"}). Tindakan ini akan tercatat di log admin.
        </p>
      </Modal>
    </>
  );
}
