import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { Badge, Logo } from "@/components/ui/primitives";
import { ResultGreeting, ResultLink, ResultDownload, BackHomeLink } from "@/components/participant/result-parts";
import { demoExam, demoQuestions } from "@/lib/mock-data";
import { ClientTime } from "@/components/participant/client-time";

export const metadata: Metadata = { title: "Hasil ujian" };

export default async function ResultPage({ params }: PageProps<"/hasil/[resultToken]">) {
  const { resultToken } = await params;

  const maxScore = demoQuestions.reduce((s, q) => s + q.points, 0);
  const scoreAuto = 8;
  const percentage = Math.round((scoreAuto / maxScore) * 1000) / 10;
  const passed = percentage >= demoExam.passingScore;

  const perSection = [
    { label: "Pilihan ganda", correct: 8, total: 17, tone: "bg-leaf-600" },
    { label: "Esai (menunggu)", correct: 0, total: 3, tone: "bg-accent-500" },
  ];

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="press flex h-11 items-center gap-2 rounded-field pr-2 text-ink-soft hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden />
            <Logo size="sm" />
          </Link>
          <Badge tone={passed ? "green" : "red"}>
            {passed ? <Check className="size-3" aria-hidden /> : null}
            {passed ? "Lulus KKM" : "Belum lulus KKM"}
          </Badge>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-7">
        <div className="animate-rise rounded-card border border-line bg-surface p-5 sm:p-7">
          <p className="text-[12.5px] font-medium text-muted">Ujian selesai</p>
          <ResultGreeting />
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
            {demoExam.title}, dikumpulkan <ClientTime /> WIB
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="relative grid size-[132px] place-items-center">
              <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
                <circle cx="60" cy="60" r="52" fill="none" stroke="#f0f1f0" strokeWidth="11" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke={passed ? "#6b8340" : "#d9b53c"}
                  strokeWidth="11"
                  strokeLinecap="round"
                  strokeDasharray={`${(percentage / 100) * 327} 327`}
                />
              </svg>
              <div className="text-center">
                <p className="font-heading text-[30px] font-extrabold tabular leading-none text-ink">
                  {percentage}
                </p>
                <p className="mt-1 text-[11.5px] font-medium text-muted">dari 100</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-field bg-line-soft px-3 py-2">
                <span className="text-[12.5px] text-muted">Skor otomatis (PG)</span>
                <span className="font-heading text-[13.5px] font-bold tabular text-ink">
                  {scoreAuto} / {maxScore}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-field bg-accent-50 px-3 py-2">
                <span className="text-[12.5px] text-accent-900">Esai menunggu penilaian</span>
                <span className="font-heading text-[13.5px] font-bold text-accent-900">3 soal</span>
              </div>
              <p className="text-[12px] leading-relaxed text-muted">
                Skor sementara belum termasuk esai. Nilai akhir diperbarui setelah guru selesai
                menilai.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            {perSection.map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-medium text-ink-soft">{row.label}</span>
                  <span className="tabular text-muted">
                    {row.correct}/{row.total}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line-soft">
                  <div
                    className={`h-full rounded-full ${row.tone}`}
                    style={{ width: `${(row.correct / row.total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <BackHomeLink />
          </div>
        </div>

        <div className="mt-4 rounded-card border border-line bg-surface p-4">
          <h2 className="font-heading text-[14px] font-bold text-ink">Simpan tautan hasil</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            Tautan ini hanya bisa dibaca dan tidak memberi akses mengubah jawaban. Bagikan ke guru
            bila diminta.
          </p>
          <ResultLink token={resultToken} />
        </div>

        <div className="mt-4">
          <ResultDownload />
        </div>

        <p className="mt-4 rounded-field border border-line bg-line-soft px-3 py-2 text-[12px] leading-relaxed text-muted">
          Halaman ini masih memakai data contoh: skor di atas bukan hasil penilaian sungguhan.
        </p>
      </main>
    </div>
  );
}
