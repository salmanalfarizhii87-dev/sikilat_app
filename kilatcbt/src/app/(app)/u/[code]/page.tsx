import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/primitives";
import { StartForm } from "@/components/participant/start-form";
import { ClosedNotice } from "@/components/participant/closed-notice";
import { demoExam, demoQuestions } from "@/lib/mock-data";
import { formatDateTimeId, formatMinutes } from "@/lib/utils";

export const metadata: Metadata = { title: "Pra-ujian" };

type ExamState = "open" | "scheduled" | "closed";

export default async function PreExamPage({ params }: PageProps<"/u/[code]">) {
  const { code } = await params;
  const normalized = code.toUpperCase();

  if (normalized !== demoExam.code && normalized !== "DEMO01") {
    notFound();
  }

  const state: ExamState =
    demoExam.status === "archived" ? "closed" : demoExam.status === "draft" ? "scheduled" : "open";

  const totalPoints = demoQuestions.reduce((sum, q) => sum + q.points, 0);
  const essayCount = demoQuestions.filter((q) => q.type === "essay").length;

  const stateLabel = {
    open: "Ujian dibuka",
    scheduled: "Belum dibuka",
    closed: "Sudah ditutup",
  }[state];

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="press flex h-11 items-center gap-2 rounded-field pr-2 text-ink-soft hover:text-ink">
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
              <p className="text-[12.5px] font-medium text-muted">{demoExam.subjectLabel}</p>
              <h1 className="mt-1 font-heading text-[26px] font-extrabold leading-tight text-ink sm:text-[30px]">
                {demoExam.title}
              </h1>
              <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-ink-soft">
                {demoExam.description}
              </p>
            </div>

            {/* Fakta ujian sebagai daftar definisi, bukan empat kartu ikon:
                yang dicari peserta adalah angkanya, bukan ikonnya. */}
            <dl className="divide-y divide-line rounded-card border border-line bg-surface">
              {[
                { label: "Durasi", value: formatMinutes(demoExam.durationMinutes) },
                { label: "Jumlah soal", value: `${demoQuestions.length} butir` },
                {
                  label: "Total poin",
                  value: `${totalPoints} poin`,
                },
                { label: "Kesempatan", value: `${demoExam.maxAttempts} kali per nama` },
                {
                  label: "Dibuka",
                  value: demoExam.opensAt
                    ? `${formatDateTimeId(demoExam.opensAt)} WIB`
                    : "Langsung setelah dibagikan",
                },
                {
                  label: "Nilai minimum",
                  value: `${demoExam.passingScore} dari 100`,
                },
              ].map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                  <dt className="text-[13px] text-muted">{row.label}</dt>
                  <dd className="text-right font-heading text-[13.5px] font-semibold text-ink">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>

            <section className="rounded-card border border-line bg-surface p-4 sm:p-5">
              <h2 className="font-heading text-[15px] font-bold text-ink">Sebelum mulai</h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
                {demoExam.instructions}
              </p>
              <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-soft">
                {[
                  "Jawaban tersimpan di perangkat ini. Kamu boleh menutup tab lalu melanjutkan di perangkat yang sama.",
                  "Tandai soal yang ingin ditinjau ulang dengan tombol Ragu.",
                  "Selama mode demo, waktu dihitung dari jam perangkat ini. Setelah backend terpasang, sisa waktu dihitung server.",
                  essayCount > 0
                    ? `${essayCount} soal esai dinilai manual setelah kamu mengumpulkan.`
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
              <StartForm exam={demoExam} />
            ) : (
              <ClosedNotice state={state} opensAt={demoExam.opensAt} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
