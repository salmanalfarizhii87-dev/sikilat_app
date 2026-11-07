import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Clock3, X } from "lucide-react";
import { Badge, Logo } from "@/components/ui/primitives";
import { ResultGreeting, ResultLink, ResultPrint, BackHomeLink } from "@/components/participant/result-parts";
import { getResult } from "@/features/attempts/queries";
import { pageTitle } from "@/lib/page-title";
import { formatDateTimeId } from "@/lib/utils";

/**
 * Halaman hasil peserta (T5.12, RUN-10).
 *
 * Seluruh isi berasal dari RPC `get_result`. Tiga hal yang **tidak** dilakukan
 * halaman ini, dan itu disengaja:
 *
 * 1. Tidak menghitung persentase sendiri. Rumusnya ada di database supaya angka
 *    di sini sama dengan angka di rekap guru.
 * 2. Tidak menebak nilai ketika `released = false`. Peserta melihat "menunggu
 *    rilis", bukan 0 — nol berarti gagal, dan itu tuduhan yang salah.
 * 3. Tidak menampilkan kunci jawaban kecuali `result_visibility` adalah
 *    `score_and_review`. RPC yang menyaringnya, jadi tidak ada cabang di sini
 *    yang bisa lupa.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/hasil/[resultToken]">): Promise<Metadata> {
  const { resultToken } = await params;

  try {
    const result = await getResult(resultToken);
    return { title: pageTitle(result ? `Hasil ${result.examTitle}` : "Hasil ujian") };
  } catch {
    return { title: pageTitle("Hasil ujian") };
  }
}

/** Warna dan ikon mengikuti hasil; `null` (tanpa KKM) diperlakukan netral. */
function verdict(passed: boolean | null | undefined) {
  if (passed === true) return { label: "Lulus KKM", tone: "green" as const };
  if (passed === false) return { label: "Belum lulus KKM", tone: "red" as const };
  return { label: "Tanpa KKM", tone: "outline" as const };
}

export default async function ResultPage({ params }: PageProps<"/hasil/[resultToken]">) {
  const { resultToken } = await params;
  const result = await getResult(resultToken);

  if (!result) notFound();

  const showScore = result.released && typeof result.percentage === "number";
  const badge = showScore ? verdict(result.passed) : { label: "Menunggu rilis", tone: "outline" as const };

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface print:hidden">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-3.5">
          <Link
            href="/"
            className="press flex h-11 items-center gap-2 rounded-field pr-2 text-ink-soft hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <Logo size="sm" />
          </Link>
          <Badge tone={badge.tone}>
            {showScore && result.passed ? <Check className="size-3" aria-hidden /> : null}
            {badge.label}
          </Badge>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-7">
        <div className="animate-rise rounded-card border border-line bg-surface p-5 sm:p-7">
          <p className="text-[12.5px] font-medium text-muted">{result.examTitle}</p>
          <ResultGreeting name={result.participantName} />

          {showScore ? (
            <>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
                Dikumpulkan {result.releasedAt ? `${formatDateTimeId(result.releasedAt)} WIB` : "—"}
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
                      stroke={result.passed === false ? "#d9b53c" : "#6b8340"}
                      strokeWidth="11"
                      strokeLinecap="round"
                      strokeDasharray={`${((result.percentage ?? 0) / 100) * 327} 327`}
                    />
                  </svg>
                  <div className="text-center">
                    <p className="font-heading text-[30px] font-extrabold tabular leading-none text-ink">
                      {Math.round((result.percentage ?? 0) * 10) / 10}
                    </p>
                    <p className="mt-1 text-[11.5px] font-medium text-muted">dari 100</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-field bg-line-soft px-3 py-2">
                    <span className="text-[12.5px] text-muted">Skor total</span>
                    <span className="font-heading text-[13.5px] font-bold tabular text-ink">
                      {result.score} / {result.maxScore}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-field bg-line-soft px-3 py-2">
                    <span className="text-[12.5px] text-muted">Nilai minimum</span>
                    <span className="font-heading text-[13.5px] font-bold tabular text-ink">
                      {result.passingScore === null || result.passingScore === undefined
                        ? "Tidak ada"
                        : `${result.passingScore} dari 100`}
                    </span>
                  </div>
                  {result.status === "needs_grading" && (
                    <p className="rounded-field bg-accent-50 px-3 py-2 text-[12px] leading-relaxed text-accent-900">
                      Sebagian jawaban esai belum dinilai. Nilai di atas masih bisa berubah.
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-field border border-line bg-line-soft px-4 py-4">
              <p className="flex items-center gap-2 font-heading text-[13.5px] font-semibold text-ink">
                <Clock3 className="size-4 shrink-0 text-navy-600" aria-hidden />
                {result.status === "needs_grading"
                  ? "Jawabanmu sudah diterima dan sedang dinilai."
                  : "Jawabanmu sudah diterima."}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                Nilai belum bisa ditampilkan sekarang. Buka lagi tautan ini nanti, atau tanyakan
                kepada gurumu kapan nilainya dirilis.
              </p>
            </div>
          )}

          {result.details && result.details.length > 0 && (
            <div className="mt-6 border-t border-line pt-4">
              <h2 className="font-heading text-[14px] font-bold text-ink">Rincian jawaban</h2>
              <ol className="mt-2.5 space-y-2">
                {result.details.map((detail, index) => (
                  <li
                    key={detail.questionId}
                    className="rounded-field border border-line bg-canvas px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-[13px] leading-relaxed text-ink-soft">
                        <span className="mr-1.5 font-heading text-[12px] font-bold text-muted">
                          {index + 1}.
                        </span>
                        {detail.body}
                      </p>
                      <span
                        className={
                          detail.isCorrect === true
                            ? "shrink-0 rounded-full bg-leaf-50 px-2 py-0.5 text-[11px] font-semibold text-leaf-800"
                            : detail.isCorrect === false
                              ? "shrink-0 rounded-full bg-clay-50 px-2 py-0.5 text-[11px] font-semibold text-clay-700"
                              : "shrink-0 rounded-full bg-line-soft px-2 py-0.5 text-[11px] font-semibold text-muted"
                        }
                      >
                        {detail.pointsAwarded ?? 0}/{detail.points}
                      </span>
                    </div>
                    {detail.feedback && (
                      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                        Catatan guru: {detail.feedback}
                      </p>
                    )}
                    {detail.explanation && (
                      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                        Pembahasan: {detail.explanation}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row print:hidden">
            <BackHomeLink />
            {showScore && <ResultPrint />}
          </div>
        </div>

        <div className="mt-4 rounded-card border border-line bg-surface p-4 print:hidden">
          <h2 className="font-heading text-[14px] font-bold text-ink">Simpan tautan hasil</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            Tautan ini hanya bisa dibaca dan tidak memberi akses mengubah jawaban. Bagikan ke guru
            bila diminta.
          </p>
          <ResultLink token={resultToken} />
        </div>

        {!showScore && (
          <p className="mt-4 flex items-start gap-2 rounded-field border border-line bg-line-soft px-3 py-2 text-[12px] leading-relaxed text-muted">
            <X className="mt-px size-3.5 shrink-0" aria-hidden />
            Nilai disembunyikan sesuai pengaturan ujian ini. Hubungi gurumu bila kamu perlu
            melihatnya.
          </p>
        )}
      </main>
    </div>
  );
}
