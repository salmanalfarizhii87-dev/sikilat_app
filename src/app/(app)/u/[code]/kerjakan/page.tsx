import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExamRunnerProvider } from "@/components/exam/exam-store";
import { ExamRunner } from "@/components/exam/exam-runner";
import { getRunnerState } from "@/features/attempts/queries";
import { pageTitle } from "@/lib/page-title";

/**
 * Halaman pengerjaan (T5.6).
 *
 * Server Component: state attempt dibaca dari database lewat cookie sesi
 * peserta, lalu diteruskan ke provider sebagai `initialState`. Tidak ada lagi
 * pembuatan attempt di peramban.
 *
 * Empat keadaan ditangani berurutan:
 * 1. tidak ada sesi / token tidak sah → kembali ke halaman pra-ujian
 * 2. attempt sudah selesai          → langsung ke halaman hasil
 * 3. attempt masih berjalan         → tampilkan runner
 * 4. ujian tanpa soal               → kembali ke pra-ujian (tidak ada yang bisa
 *    dikerjakan, dan runner tanpa soal akan menampilkan layar kosong)
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/u/[code]/kerjakan">): Promise<Metadata> {
  const { code } = await params;

  try {
    const state = await getRunnerState(code);
    return { title: pageTitle(state ? `Mengerjakan ${state.examTitle}` : "Mengerjakan ujian") };
  } catch {
    return { title: pageTitle("Mengerjakan ujian") };
  }
}

export default async function ExamRunPage({ params }: PageProps<"/u/[code]/kerjakan">) {
  const { code } = await params;
  const state = await getRunnerState(code);

  // Tanpa sesi, satu-satunya halaman yang masuk akal adalah pra-ujian.
  if (!state) redirect(`/u/${code}`);

  /*
   * Attempt yang sudah dikumpulkan tidak boleh menampilkan lembar soal lagi:
   * jawabannya sudah dikunci database, dan peserta yang melihat soal setelah
   * waktu habis akan mengira masih bisa mengubahnya.
   */
  if (state.status !== "in_progress") redirect(`/hasil/${state.resultToken}`);

  if (state.questions.length === 0) redirect(`/u/${code}`);

  return (
    <ExamRunnerProvider initialState={state}>
      <ExamRunner />
    </ExamRunnerProvider>
  );
}
