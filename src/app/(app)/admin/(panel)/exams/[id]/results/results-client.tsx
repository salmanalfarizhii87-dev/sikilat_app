"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownUp,
  ArrowUpRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatClock } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FilterChips, Panel, StatCard, StatusBadge } from "@/components/admin/ui";
import { releaseResults } from "@/features/grading/actions";
import type { AdminAttemptRow, ExamAttemptSummary } from "@/features/attempts/queries";

/**
 * Rekap nilai (T6.2, T6.6).
 *
 * Sebelumnya halaman ini menampilkan `demoAttempts` — 12 nama karangan — dan
 * tombol XLSX hanya memunculkan toast "belum tersedia di mode demo". Sekarang
 * barisnya berasal dari `listAttempts`, dan kedua tombol ekspor benar-benar
 * membuat berkas dari data yang tampil.
 *
 * Persentase dihitung dari `totalScore / maxScore` **setiap attempt**, bukan dari
 * satu `maxScore` ujian: attempt lama bisa punya jumlah soal berbeda bila soal
 * ujian diubah sebelum ada percobaan. Memakai satu penyebut bersama akan membuat
 * nilai attempt lama tampak lebih tinggi atau lebih rendah dari yang sebenarnya.
 */

type SortKey = "name" | "score" | "time";
type Filter = "all" | "passed" | "failed" | "pending";

const BANDS = [
  { label: "0–59", min: 0, max: 59.99 },
  { label: "60–69", min: 60, max: 69.99 },
  { label: "70–79", min: 70, max: 79.99 },
  { label: "80–89", min: 80, max: 89.99 },
  { label: "90–100", min: 90, max: 100 },
];

/** Persentase satu attempt; `null` bila `maxScore` 0 (tidak bisa dibagi). */
function percentOf(row: AdminAttemptRow): number | null {
  if (row.maxScore <= 0) return null;
  return Math.round((row.totalScore / row.maxScore) * 1000) / 10;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function ResultsClient({
  examId,
  examCode,
  passingScore,
  resultRelease,
  resultsReleasedAt,
  attempts,
  summary,
}: {
  examId: string;
  examCode: string;
  passingScore: number | null;
  resultRelease: "instant" | "after_close" | "manual";
  resultsReleasedAt: string | null;
  attempts: AdminAttemptRow[];
  summary: ExamAttemptSummary;
}) {
  const router = useRouter();

  const [sort, setSort] = React.useState<SortKey>("score");
  const [asc, setAsc] = React.useState(false);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [pending, setPending] = React.useState(false);

  /* Hanya attempt yang sudah dinilai penuh yang punya angka final. */
  const graded = attempts.filter((row) => row.status === "graded");

  const percentages = graded
    .map(percentOf)
    .filter((value): value is number => value !== null);

  const average =
    percentages.length > 0
      ? Math.round((percentages.reduce((sum, value) => sum + value, 0) / percentages.length) * 10) / 10
      : null;
  const highest = percentages.length > 0 ? Math.max(...percentages) : null;
  const lowest = percentages.length > 0 ? Math.min(...percentages) : null;
  const medianValue = median(percentages);

  const passed = passingScore === null ? [] : graded.filter((row) => (percentOf(row) ?? 0) >= passingScore);
  const failed = passingScore === null ? [] : graded.filter((row) => (percentOf(row) ?? 0) < passingScore);

  const bands = BANDS.map((band) => ({
    ...band,
    count: percentages.filter((value) => value >= band.min && value <= band.max).length,
  }));
  const maxBand = Math.max(1, ...bands.map((band) => band.count));

  /*
   * Sebaran kelas dihitung dari data yang ada, bukan dari daftar kelas tetap.
   *
   * Tidak dibungkus `useMemo`: `graded` adalah array baru setiap render, jadi
   * dependensinya selalu berubah dan memo tidak pernah menolong. React Compiler
   * menolak memo dengan dependensi yang berubah seperti itu — lebih baik
   * menghitungnya langsung.
   */
  const classRows = (() => {
    const byClass = new Map<string, number[]>();
    for (const row of graded) {
      const value = percentOf(row);
      if (value === null) continue;
      const key = row.participantClass?.trim() || "Tanpa kelas";
      const list = byClass.get(key) ?? [];
      list.push(value);
      byClass.set(key, list);
    }

    return [...byClass.entries()]
      .map(([label, list]) => ({
        label,
        count: list.length,
        average: Math.round((list.reduce((sum, value) => sum + value, 0) / list.length) * 10) / 10,
      }))
      .sort((a, b) => b.average - a.average);
  })();

  const rows = attempts
    .filter((row) => {
      if (filter === "passed") return row.status === "graded" && (percentOf(row) ?? 0) >= (passingScore ?? 0);
      if (filter === "failed") return row.status === "graded" && (percentOf(row) ?? 0) < (passingScore ?? 0);
      if (filter === "pending") return row.status !== "graded";
      return true;
    })
    .sort((a, b) => {
      let diff = 0;
      if (sort === "name") diff = a.participantName.localeCompare(b.participantName);
      if (sort === "score") diff = (percentOf(a) ?? -1) - (percentOf(b) ?? -1);
      if (sort === "time")
        diff =
          new Date(a.submittedAt ?? a.startedAt).getTime() -
          new Date(b.submittedAt ?? b.startedAt).getTime();
      return asc ? diff : -diff;
    });

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc((value) => !value);
    else {
      setSort(key);
      setAsc(key === "name");
    }
  };

  const exportRows = () =>
    rows.map((row) => ({
      nama: row.participantName,
      kelas: row.participantClass ?? "",
      status: row.status,
      nilai_otomatis: row.scoreAuto,
      nilai_manual: row.scoreManual,
      total: row.totalScore,
      maks: row.maxScore,
      persen: percentOf(row) ?? "",
      lulus:
        passingScore === null || row.status !== "graded"
          ? ""
          : (percentOf(row) ?? 0) >= passingScore
            ? "ya"
            : "tidak",
      mulai: row.startedAt,
      dikumpulkan: row.submittedAt ?? "",
    }));

  const exportCsv = () => {
    const data = exportRows();
    if (data.length === 0) {
      toast.error("Belum ada baris untuk diekspor.");
      return;
    }

    const header = Object.keys(data[0]).join(",");
    const lines = data.map((row) =>
      Object.values(row)
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    );

    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rekap-${examCode}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`${data.length} baris diunduh sebagai CSV.`);
  };

  /*
   * XLSX dimuat saat diklik, bukan di awal. Pustaka `xlsx` cukup besar, dan
   * sebagian besar kunjungan ke halaman ini tidak menekan tombol ekspor.
   */
  const exportXlsx = async () => {
    const data = exportRows();
    if (data.length === 0) {
      toast.error("Belum ada baris untuk diekspor.");
      return;
    }

    try {
      const XLSX = await import("xlsx");
      const sheet = XLSX.utils.json_to_sheet(data);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Rekap");
      XLSX.writeFile(book, `rekap-${examCode}.xlsx`);
      toast.success(`${data.length} baris diunduh sebagai XLSX.`);
    } catch (error) {
      console.error("[results] gagal membuat XLSX:", error);
      toast.error("Gagal membuat XLSX. Pakai CSV sebagai gantinya.");
    }
  };

  const doRelease = async () => {
    setPending(true);
    const result = await releaseResults(examId);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    toast.success("Hasil dirilis. Peserta sekarang bisa melihat nilainya.");
    router.refresh();
  };

  const pendingCount = summary.inProgress + summary.needsGrading;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="md" onClick={exportXlsx}>
          <FileSpreadsheet className="size-4" aria-hidden /> XLSX
        </Button>
        <Button size="md" onClick={exportCsv}>
          <Download className="size-4" aria-hidden /> Unduh CSV
        </Button>
        {resultRelease === "manual" && (
          <Button size="md" variant="dark" onClick={doRelease} disabled={pending}>
            <Send className="size-4" aria-hidden />
            {pending ? "Merilis…" : resultsReleasedAt ? "Rilis ulang" : "Rilis hasil"}
          </Button>
        )}
      </div>

      {resultRelease === "manual" && (
        <div className="mb-3 rounded-field border border-line bg-canvas px-3 py-2">
          <p className="text-[12px] leading-relaxed text-muted">
            {resultsReleasedAt ? (
              <>
                Hasil sudah dirilis pada{" "}
                <strong className="font-semibold text-ink-soft">
                  {formatClock(resultsReleasedAt)} WIB
                </strong>
                . Peserta bisa melihat nilainya. Merilis ulang hanya memperbarui waktunya.
              </>
            ) : (
              <>
                Ujian ini memakai rilis manual. Peserta melihat &ldquo;menunggu hasil&rdquo; sampai
                kamu menekan <strong className="font-semibold text-ink-soft">Rilis hasil</strong>.
              </>
            )}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Rata-rata"
          value={average === null ? "—" : average}
          hint={medianValue === null ? "belum ada nilai" : `median ${medianValue}`}
          tone="navy"
          marker
        />
        <StatCard
          label="Tertinggi"
          value={highest === null ? "—" : highest}
          hint="dari 100"
          tone="green"
        />
        <StatCard label="Terendah" value={lowest === null ? "—" : lowest} hint="dari 100" />
        <StatCard
          label="Persen lulus"
          value={
            passingScore === null
              ? "—"
              : graded.length > 0
                ? `${Math.round((passed.length / graded.length) * 100)}%`
                : "—"
          }
          hint={
            passingScore === null
              ? "ujian tanpa KKM"
              : `${passed.length} dari ${graded.length}`
          }
          tone="amber"
        />
        <StatCard
          label="Sudah dinilai"
          value={`${summary.graded}/${summary.total}`}
          hint={pendingCount > 0 ? `${pendingCount} belum final` : "semua final"}
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
                    passingScore === null
                      ? "bg-navy-700"
                      : band.min >= passingScore
                        ? "bg-leaf-600"
                        : "bg-accent-500",
                  )}
                  style={{ height: `${Math.max(6, (band.count / maxBand) * 104)}px` }}
                />
                <span className="text-[11px] font-medium tabular text-muted">{band.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-field bg-line-soft px-3 py-2">
            {passingScore === null ? (
              <span className="text-[12px] text-muted">
                Ujian ini tidak memakai KKM, jadi tidak ada batas lulus.
              </span>
            ) : (
              <>
                <span className="flex items-center gap-1.5 text-[12px] text-muted">
                  <span className="size-2.5 rounded-xs bg-leaf-600" aria-hidden /> Mencapai KKM (
                  {passingScore})
                </span>
                <span className="flex items-center gap-1.5 text-[12px] text-muted">
                  <span className="size-2.5 rounded-xs bg-accent-500" aria-hidden /> Di bawah KKM
                </span>
              </>
            )}
          </div>
        </Panel>

        <Panel title="Sebaran kelas" description="Rata-rata nilai per kelas, dari attempt final.">
          {classRows.length === 0 ? (
            <p className="rounded-field border border-dashed border-line bg-canvas px-3 py-6 text-center text-[12.5px] text-muted">
              Belum ada nilai final untuk dikelompokkan.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {classRows.map((item) => (
                <li key={item.label}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-heading font-semibold text-ink">{item.label}</span>
                    <span className="tabular text-muted">
                      {item.average} · {item.count} peserta
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-line-soft">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        passingScore === null || item.average >= passingScore
                          ? "bg-leaf-600"
                          : "bg-accent-500",
                      )}
                      style={{ width: `${Math.min(100, item.average)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {pendingCount > 0 && (
            <div className="mt-3 rounded-field border border-accent-200 bg-accent-50 px-3 py-2">
              <p className="text-[12px] leading-relaxed text-accent-900">
                {pendingCount} percobaan belum final karena esai belum dinilai. Nilainya belum masuk
                rata-rata maupun persen lulus.
              </p>
            </div>
          )}
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
                { key: "all", label: "Semua", count: attempts.length },
                { key: "passed", label: "Lulus", count: passed.length },
                { key: "failed", label: "Belum lulus", count: failed.length },
                { key: "pending", label: "Belum final", count: pendingCount },
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
                    Otomatis
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
                {rows.map((row) => {
                  const value = percentOf(row);
                  const isPassed =
                    passingScore !== null && row.status === "graded" && (value ?? 0) >= passingScore;

                  return (
                    <tr key={row.id} className="hover:bg-canvas">
                      <td className="px-4 py-2.5">
                        <p className="text-[12.5px] font-semibold text-ink">{row.participantName}</p>
                        <p className="text-[11.5px] text-muted">
                          {row.submitReason === "timeout"
                            ? "Waktu habis"
                            : row.submitReason === "admin"
                              ? "Ditutup admin"
                              : `Percobaan ${row.attemptNo}`}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-muted">
                        {row.participantClass ?? "-"}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.status === "in_progress" || value === null ? (
                          <span className="text-[11.5px] text-muted">-</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "font-heading text-[13px] font-bold tabular",
                                row.status !== "graded"
                                  ? "text-muted"
                                  : passingScore === null
                                    ? "text-ink"
                                    : isPassed
                                      ? "text-leaf-800"
                                      : "text-clay-700",
                              )}
                            >
                              {value}
                            </span>
                            {row.status === "graded" && passingScore !== null && (
                              <span
                                className={cn(
                                  "size-1.5 rounded-full",
                                  isPassed ? "bg-leaf-600" : "bg-clay-500",
                                )}
                                aria-hidden
                              />
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px] tabular text-muted">{row.scoreAuto}</td>
                      <td className="px-3 py-2.5 text-[11.5px] tabular text-muted">
                        {row.status === "graded" ? row.scoreManual : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px] tabular text-muted">
                        {row.submittedAt ? formatClock(row.submittedAt) : "-"}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/admin/exams/${examId}/grading/${row.id}`}
                          className="press inline-flex min-h-11 items-center gap-1 rounded-field px-2 font-heading text-[11.5px] font-semibold text-navy-700 hover:bg-line-soft"
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

          {attempts.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="font-heading text-[13px] font-bold text-ink">Belum ada peserta</p>
              <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted">
                Rekap ini terisi setelah peserta mengumpulkan jawabannya. Selama belum ada peserta,
                tidak ada yang bisa dirata-ratakan.
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

      <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-muted">
        <CheckCircle2 className="size-3.5" aria-hidden /> Nilai dihitung ulang setiap kali esai
        dinilai.
      </p>
    </>
  );
}
