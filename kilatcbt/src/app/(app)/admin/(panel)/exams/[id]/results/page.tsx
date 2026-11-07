"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownUp,
  ArrowUpRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SampleDataNote } from "@/components/ui/primitives";
import { PageHeader, StatCard, Panel, FilterChips, StatusBadge } from "@/components/admin/ui";
import { ExamTabs } from "@/components/admin/exam-tabs";
import { demoExam, demoQuestions } from "@/lib/mock-data";
import { attemptPercent, demoAttempts, examSummary, scoreBands } from "@/lib/admin-data";
import { formatClock } from "@/lib/utils";

type SortKey = "name" | "score" | "time";
type Filter = "all" | "passed" | "failed" | "pending";

export default function ExamResultsPage({ params }: PageProps<"/admin/exams/[id]">) {
  const { id } = React.use(params);
  const summary = examSummary();
  const [sort, setSort] = React.useState<SortKey>("score");
  const [asc, setAsc] = React.useState(false);
  const [filter, setFilter] = React.useState<Filter>("all");

  const graded = demoAttempts.filter((a) => a.status === "graded");
  const bands = scoreBands.map((band) => ({
    ...band,
    count: graded.filter((a) => {
      const pct = attemptPercent(a);
      return pct >= band.min && pct <= band.max;
    }).length,
  }));
  const maxBand = Math.max(1, ...bands.map((b) => b.count));

  const rows = demoAttempts
    .filter((a) => {
      if (filter === "passed")
        return a.status === "graded" && attemptPercent(a) >= demoExam.passingScore;
      if (filter === "failed")
        return a.status === "graded" && attemptPercent(a) < demoExam.passingScore;
      if (filter === "pending") return a.status !== "graded";
      return true;
    })
    .sort((a, b) => {
      let diff = 0;
      if (sort === "name") diff = a.participantName.localeCompare(b.participantName);
      if (sort === "score") diff = attemptPercent(a) - attemptPercent(b);
      if (sort === "time") diff = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
      return asc ? diff : -diff;
    });

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc((v) => !v);
    else {
      setSort(key);
      setAsc(key === "name");
    }
  };

  /* CSV dibuat dan diunduh di perangkat ini, jadi unduhannya benar-benar terjadi. */
  const exportCsv = () => {
    const header = "nama,kelas,status,nilai_otomatis,nilai_manual,total,maks,persen,mulai,selesai";
    const lines = demoAttempts.map((a) =>
      [
        `"${a.participantName}"`,
        a.participantClass ?? "",
        a.status,
        a.scoreAuto,
        a.scoreManual,
        a.scoreAuto + a.scoreManual,
        a.maxScore,
        attemptPercent(a),
        a.startedAt,
        a.submittedAt ?? "",
      ].join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rekap-${demoExam.code}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Rekap CSV diunduh");
  };

  return (
    <>
      <PageHeader
        title="Rekap nilai"
        description={`${demoAttempts.length} peserta, KKM ${demoExam.passingScore}, ${demoQuestions.length} soal.`}
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => toast("Ekspor XLSX belum tersedia di mode demo. Pakai CSV.")}
            >
              <FileSpreadsheet className="size-4" aria-hidden /> XLSX
            </Button>
            <Button size="md" onClick={exportCsv}>
              <Download className="size-4" aria-hidden /> Unduh CSV
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
        Semua nama dan nilai di halaman ini adalah data contoh, bukan hasil ujian sungguhan.
      </SampleDataNote>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Rata-rata"
          value={summary.average}
          hint={`median ${summary.median}`}
          tone="navy"
          marker
        />
        <StatCard label="Tertinggi" value={summary.highest} hint="dari 100" tone="green" />
        <StatCard label="Terendah" value={summary.lowest} hint="dari 100" />
        <StatCard
          label="Persen lulus"
          value={`${summary.passRate}%`}
          hint={`${summary.passCount} dari ${summary.graded}`}
          tone="amber"
        />
        <StatCard
          label="Sudah dinilai"
          value={`${summary.graded}/${demoAttempts.length}`}
          hint={`${summary.pending} menunggu esai`}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.5fr]">
        <Panel title="Distribusi nilai" description="Hanya attempt yang sudah dinilai penuh.">
          <div className="flex h-40 items-end gap-2">
            {bands.map((band) => (
              <div key={band.label} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                <span className="font-heading text-[11.5px] font-bold tabular text-ink-soft">
                  {band.count}
                </span>
                <div
                  className={cn(
                    "w-full rounded-t-xs",
                    band.min >= demoExam.passingScore ? "bg-leaf-600" : "bg-accent-500",
                  )}
                  style={{ height: `${Math.max(6, (band.count / maxBand) * 104)}px` }}
                />
                <span className="text-[11px] font-medium tabular text-muted">{band.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-field bg-line-soft px-3 py-2">
            <span className="flex items-center gap-1.5 text-[12px] text-muted">
              <span className="size-2.5 rounded-xs bg-leaf-600" aria-hidden /> Mencapai KKM
            </span>
            <span className="flex items-center gap-1.5 text-[12px] text-muted">
              <span className="size-2.5 rounded-xs bg-accent-500" aria-hidden /> Di bawah KKM
            </span>
          </div>
        </Panel>

        <Panel title="Sebaran kelas" description="Rata-rata nilai per kelas.">
          <ul className="space-y-2.5">
            {["7A", "7B", "7C"].map((kelas) => {
              const list = graded.filter((a) => a.participantClass === kelas);
              const avg = list.length
                ? Math.round((list.reduce((s, a) => s + attemptPercent(a), 0) / list.length) * 10) / 10
                : 0;
              return (
                <li key={kelas}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-heading font-semibold text-ink">Kelas {kelas}</span>
                    <span className="tabular text-muted">
                      {avg} · {list.length} peserta
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-line-soft">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        avg >= demoExam.passingScore ? "bg-leaf-600" : "bg-accent-500",
                      )}
                      style={{ width: `${avg}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 rounded-field border border-accent-200 bg-accent-50 px-3 py-2">
            <p className="text-[12px] leading-relaxed text-accent-900">
              {summary.pending} percobaan belum final karena esai belum dinilai. Nilai pada tabel masih
              sementara.
            </p>
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel
          padded={false}
          title="Tabel peserta"
          description={`${rows.length} baris`}
          action={
            <FilterChips
              label="Filter hasil"
              value={filter}
              onChange={setFilter}
              options={[
                { key: "all", label: "Semua", count: demoAttempts.length },
                { key: "passed", label: "Lulus", count: summary.passCount },
                {
                  key: "failed",
                  label: "Belum lulus",
                  count: summary.graded - summary.passCount,
                },
                { key: "pending", label: "Belum final", count: summary.pending + summary.active },
              ]}
            />
          }
        >
          <div className="scroll-thin relative overflow-x-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead>
                <tr className="border-b border-line bg-canvas text-[12px] text-muted">
                  <th scope="col" className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => toggleSort("name")}
                      className="-mx-1 flex min-h-11 min-w-11 items-center gap-1 px-1 font-heading font-semibold hover:text-ink"
                    >
                      Peserta <ArrowDownUp className="size-3" aria-hidden />
                    </button>
                  </th>
                  <th scope="col" className="px-3 py-2 font-heading font-semibold">
                    Kelas
                  </th>
                  <th scope="col" className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleSort("score")}
                      className="-mx-1 flex min-h-11 min-w-11 items-center gap-1 px-1 font-heading font-semibold hover:text-ink"
                    >
                      Nilai <ArrowDownUp className="size-3" aria-hidden />
                    </button>
                  </th>
                  <th scope="col" className="px-3 py-2 font-heading font-semibold">
                    PG
                  </th>
                  <th scope="col" className="px-3 py-2 font-heading font-semibold">
                    Esai
                  </th>
                  <th scope="col" className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleSort("time")}
                      className="-mx-1 flex min-h-11 min-w-11 items-center gap-1 px-1 font-heading font-semibold hover:text-ink"
                    >
                      Dikumpulkan <ArrowDownUp className="size-3" aria-hidden />
                    </button>
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
                  const pct = attemptPercent(attempt);
                  const passed = pct >= demoExam.passingScore;
                  return (
                    <tr key={attempt.id} className="hover:bg-canvas">
                      <td className="px-4 py-2.5">
                        <p className="text-[12.5px] font-semibold text-ink">
                          {attempt.participantName}
                        </p>
                        <p className="text-[11.5px] text-muted">
                          {attempt.submitReason === "timeout"
                            ? "Waktu habis"
                            : `Percobaan ${attempt.attemptNo}`}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-muted">
                        {attempt.participantClass}
                      </td>
                      <td className="px-3 py-2.5">
                        {attempt.status === "in_progress" ? (
                          <span className="text-[11.5px] text-muted">-</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "font-heading text-[13px] font-bold tabular",
                                attempt.status === "graded"
                                  ? passed
                                    ? "text-leaf-800"
                                    : "text-clay-700"
                                  : "text-muted",
                              )}
                            >
                              {pct}
                            </span>
                            {attempt.status === "graded" && (
                              <span
                                className={cn(
                                  "size-1.5 rounded-full",
                                  passed ? "bg-leaf-600" : "bg-clay-500",
                                )}
                                aria-hidden
                              />
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px] tabular text-muted">
                        {attempt.scoreAuto}
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px] tabular text-muted">
                        {attempt.status === "graded" ? attempt.scoreManual : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px] tabular text-muted">
                        {attempt.submittedAt ? formatClock(attempt.submittedAt) : "-"}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={attempt.status} />
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/admin/exams/${id}/grading/${attempt.id}`}
                          className="press inline-flex items-center gap-1 rounded-field px-2 py-1 font-heading text-[11.5px] font-semibold text-navy-700 hover:bg-line-soft"
                        >
                          Detail <ArrowUpRight className="size-3" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-muted">
        <CheckCircle2 className="size-3.5" aria-hidden /> Nilai dihitung ulang setiap kali esai
        dinilai.
      </p>
    </>
  );
}
