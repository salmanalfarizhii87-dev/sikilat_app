import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, FileText, ListChecks, Target, Users } from "lucide-react";
import { Logo } from "@/components/ui/primitives";
import { StartForm } from "@/components/participant/start-form";
import { ClosedNotice } from "@/components/participant/closed-notice";
import { getExamByCode } from "@/features/exams/queries";
import { pageTitle } from "@/lib/page-title";
import { formatDateTimeId, formatMinutes } from "@/lib/utils";

/**
 * Halaman pra-ujian (T5.2, GST-08).
 *
 * Empat keadaan ditentukan oleh **jadwal di database**, bukan oleh nilai yang
 * ditulis di kode:
 *
 * 1. kode tidak dikenal        → 404
 * 2. `opens_at` masih di depan → hitung mundur
 * 3. sedang berlangsung        → formulir mulai
 * 4. `closes_at` sudah lewat   → pemberitahuan ditutup
 *
 * `getExamByCode` menyaring `status = 'draft'` dan mengembalikan `null` untuk
 * kode yang tidak ada. Peserta tidak boleh bisa membedakan "kode salah" dari
 * "ujian masih draft" — keduanya sama-sama bukan urusannya.
 *
 * `force-dynamic` dipakai karena halaman ini bergantung pada `now()`: halaman
 * yang di-cache akan terus menampilkan "belum dibuka" setelah jadwalnya tiba.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/u/[code]">): Promise<Metadata> {
  const { code } = await params;

  try {
    const exam = await getExamByCode(code);
    return { title: pageTitle(exam ? exam.title : "Ujian tidak ditemukan") };
  } catch {
    return { title: pageTitle("Pra-ujian") };
  }
}

type ExamState = "open" | "scheduled" | "closed";

/** Tentukan keadaan ujian dari jadwalnya. */
function resolveState(exam: {
  status: string;
  opensAt: string | null;
  closesAt: string | null;
}): ExamState {
  const now = Date.now();

  // Arsip selalu tertutup, apa pun tanggalnya.
  if (exam.status === "archived") return "closed";
  if (exam.closesAt && new Date(exam.closesAt).getTime() <= now) return "closed";
  if (exam.opensAt && new Date(exam.opensAt).getTime() > now) return "scheduled";
  return "open";
}

export default async function PreExamPage({ params }: PageProps<"/u/[code]">) {
  const { code } = await params;
  const exam = await getExamByCode(code);

  if (!exam) notFound();

  const state = resolveState(exam);

  const stateLabel = {
    open: "Ujian dibuka",
    scheduled: "Belum dibuka",
    closed: "Sudah ditutup",
  }[state];

  const facts = [
    { icon: Clock3, label: "Durasi", value: formatMinutes(exam.durationMinutes) },
    {
      icon: ListChecks,
      label: "Jumlah soal",
      value: `${exam.questionCount} butir · ${exam.totalPoints} poin`,
    },
    { icon: Users, label: "Kesempatan", value: `${exam.maxAttempts} kali per nama` },
    {
      icon: Target,
      label: "Nilai minimum",
      // `null` = tanpa KKM. Menampilkannya sebagai 0 akan berarti
      // "semua peserta lulus", yang berbeda artinya.
      value: exam.passingScore === null ? "Tidak ada KKM" : `${exam.passingScore} dari 100`,
    },
  ];

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-3.5">
          <Link
            href="/"
            className="press flex h-11 items-center gap-2 rounded-field pr-2 text-ink-soft hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <Logo size="sm" />
          </Link>
          <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
            <span
              className={
                state === "open"
                  ? "size-1.5 rounded-full bg-leaf-600"
                  : state === "scheduled"
                    ? "size-1.5 rounded-full bg-accent-600"
                    : "size-1.5 rounded-full bg-clay-500"
              }
              aria-hidden
            />
            {stateLabel}
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 py-7">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div>
              <p className="text-[12.5px] font-medium text-muted">
                {exam.subjectLabel ?? "Ujian"}
                {exam.code ? ` · Kode ${exam.code}` : ""}
              </p>
              <h1 className="mt-1 font-heading text-[26px] font-extrabold leading-tight text-ink sm:text-[30px]">
                {exam.title}
              </h1>
              {exam.description && (
                <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-ink-soft">
                  {exam.description}
                </p>
              )}
            </div>

            {/* Fakta ujian sebagai daftar definisi, bukan empat kartu ikon:
                yang dicari peserta adalah angkanya, bukan ikonnya. */}
            <dl className="divide-y divide-line rounded-card border border-line bg-surface">
              {facts.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                  <dt className="flex items-center gap-2 text-[13px] text-muted">
                    <row.icon className="size-3.5 shrink-0 text-navy-600" aria-hidden />
                    {row.label}
                  </dt>
                  <dd className="text-right font-heading text-[13.5px] font-semibold text-ink">
                    {row.value}
                  </dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                <dt className="text-[13px] text-muted">Jadwal</dt>
                <dd className="text-right font-heading text-[13.5px] font-semibold text-ink">
                  {exam.opensAt
                    ? `${formatDateTimeId(exam.opensAt)} WIB`
                    : "Langsung setelah dibagikan"}
                  {exam.closesAt && ` — ${formatDateTimeId(exam.closesAt)} WIB`}
                </dd>
              </div>
            </dl>

            <section className="rounded-card border border-line bg-surface p-4 sm:p-5">
              <h2 className="font-heading text-[15px] font-bold text-ink">Sebelum mulai</h2>
              {exam.instructions && (
                <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-soft">
                  {exam.instructions}
                </p>
              )}
              <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-soft">
                {[
                  "Jawaban tersimpan di server saat kamu memilih, jadi aman kalau tab tertutup.",
                  "Tandai soal yang ingin ditinjau ulang dengan tombol Ragu.",
                  "Sisa waktu dihitung dari jam server, bukan jam perangkatmu.",
                  exam.essayCount > 0
                    ? `${exam.essayCount} soal esai dinilai manual setelah kamu mengumpulkan.`
                    : "Semua soal dinilai otomatis saat dikumpulkan.",
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-navy-600" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start">
            {state === "open" ? (
              <StartForm exam={exam} />
            ) : (
              <ClosedNotice
                state={state}
                opensAt={exam.opensAt ?? undefined}
                closesAt={exam.closesAt ?? undefined}
              />
            )}
          </div>
        </div>

        {exam.questionCount === 0 && (
          <p className="mt-6 flex items-start gap-2 rounded-field border border-accent-200 bg-accent-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-accent-900">
            <FileText className="mt-px size-4 shrink-0" aria-hidden />
            Ujian ini belum punya soal. Hubungi gurumu sebelum memulai.
          </p>
        )}
      </main>
    </div>
  );
}
