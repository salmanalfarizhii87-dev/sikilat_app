"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Flag,
  MessageSquareText,
  Save,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { cn, countWords, formatClock } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge, SampleDataNote } from "@/components/ui/primitives";
import { PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { ExamTabs } from "@/components/admin/exam-tabs";
import { demoExam, demoQuestions, optionLabel } from "@/lib/mock-data";
import { demoAttempts } from "@/lib/admin-data";

/** Skor di halaman ini hanya hidup di memori peramban, jadi dikatakan apa adanya. */
const LOCAL_ONLY = "Nilai tersimpan di halaman ini saja. Belum dikirim ke server.";

export default function GradingPage({
  params,
}: PageProps<"/admin/exams/[id]/grading/[attemptId]">) {
  const { id, attemptId } = React.use(params);
  const attempt = demoAttempts.find((a) => a.id === attemptId) ?? demoAttempts[12];
  const essays = demoQuestions.filter((q) => q.type === "essay");
  const [index, setIndex] = React.useState(0);
  const [scores, setScores] = React.useState<Record<string, number>>({});
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [showMcq, setShowMcq] = React.useState(false);

  const question = essays[index];
  const answer = attempt.answers[question.id];
  const words = countWords(answer?.essayText ?? "");
  const maxPoints = question.points;
  const current = scores[question.id] ?? 0;
  const gradedCount = essays.filter((q) => scores[q.id] !== undefined).length;

  const save = (advance: boolean) => {
    setScores((prev) => ({ ...prev, [question.id]: current }));
    toast(LOCAL_ONLY);
    if (advance && index < essays.length - 1) {
      setIndex(index + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <>
      <PageHeader
        title="Penilaian esai"
        description="Bandingkan jawaban peserta dengan kunci acuan, lalu beri skor dan komentar."
        actions={
          <Link href={`/admin/exams/${id}/results`}>
            <Button variant="secondary" size="md">
              <ArrowLeft className="size-4" aria-hidden /> Kembali ke rekap
            </Button>
          </Link>
        }
      >
        <p className="mt-2 text-[12.5px] text-muted">
          {demoExam.subjectLabel} · {demoExam.code}
        </p>
      </PageHeader>

      <ExamTabs examId={id} />

      <SampleDataNote className="mb-3">
        Jawaban yang dinilai di sini adalah jawaban contoh, bukan tulisan peserta sungguhan.
      </SampleDataNote>

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-3">
        <span className="grid size-10 place-items-center rounded-full bg-navy-900 font-heading text-[13px] font-bold text-white">
          {attempt.participantName
            .split(" ")
            .slice(0, 2)
            .map((p) => p[0])
            .join("")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 font-heading text-[14px] font-bold text-ink">
            {attempt.participantName}
            <StatusBadge status={attempt.status} />
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-muted">
            <span className="flex items-center gap-1">
              <UserRound className="size-3.5" aria-hidden /> Kelas {attempt.participantClass ?? "-"}
            </span>
            <span className="flex items-center gap-1">
              <Clock3 className="size-3.5" aria-hidden /> Dikumpulkan{" "}
              {attempt.submittedAt ? formatClock(attempt.submittedAt) : "-"}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquareText className="size-3.5" aria-hidden /> {essays.length} esai,{" "}
              {gradedCount}/{essays.length} dinilai
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-field bg-line-soft px-3 py-1.5">
          <span className="text-[12px] font-medium text-muted">Skor PG</span>
          <span className="font-heading text-[13px] font-bold tabular text-ink">
            {attempt.scoreAuto}
          </span>
        </div>
      </div>

      <div
        className="scroll-thin mb-3 flex gap-1.5 overflow-x-auto pb-0.5"
        role="group"
        aria-label="Pilih soal esai"
      >
        {essays.map((q, i) => {
          const done = scores[q.id] !== undefined;
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-pressed={i === index}
              className={cn(
                "press flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-heading text-[12px] font-semibold transition-colors",
                i === index
                  ? "border-navy-900 bg-navy-900 text-white"
                  : done
                    ? "border-leaf-200 bg-leaf-50 text-leaf-800"
                    : "border-line bg-surface text-ink-soft hover:bg-line-soft",
              )}
            >
              {done && <Check className="size-3" strokeWidth={3} aria-hidden />}
              Esai {i + 1}
              <span className={cn("text-[11px]", i === index ? "text-white/75" : "text-muted")}>
                {scores[q.id] ?? "-"}/{q.points}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Panel title={`Soal ${question.position}, ${question.points} poin`}>
            <p className="text-[15px] leading-relaxed text-ink">{question.body}</p>
            {question.wordMin || question.wordMax ? (
              <p className="mt-2 text-[12px] text-muted">
                Batas kata: {question.wordMin ?? 0} sampai {question.wordMax ?? "tanpa batas"} kata
              </p>
            ) : null}
          </Panel>

          <Panel
            title="Jawaban peserta"
            description={`${words} kata`}
            action={
              answer?.flagged ? (
                <Badge tone="amber">
                  <Flag className="size-2.5 fill-current" aria-hidden /> Ditandai ragu
                </Badge>
              ) : null
            }
          >
            {answer?.essayText ? (
              <p className="whitespace-pre-wrap rounded-field border border-line bg-canvas px-3.5 py-3 text-[14px] leading-relaxed text-ink">
                {answer.essayText}
              </p>
            ) : (
              <p className="rounded-field border border-dashed border-line bg-canvas px-3.5 py-6 text-center text-[12.5px] text-muted">
                Peserta tidak menjawab soal ini.
              </p>
            )}
          </Panel>

          <Panel title="Kunci acuan" description="Hanya terlihat admin">
            <p className="rounded-field border border-leaf-200 bg-leaf-50 px-3.5 py-3 text-[13px] leading-relaxed text-leaf-900">
              {question.referenceAnswer}
            </p>
            {question.explanation && (
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                <strong className="font-semibold text-ink-soft">Catatan penilaian:</strong>{" "}
                {question.explanation}
              </p>
            )}
          </Panel>

          <div className="overflow-hidden rounded-card border border-line bg-surface">
            <button
              type="button"
              onClick={() => setShowMcq((v) => !v)}
              aria-expanded={showMcq}
              className="press flex min-h-11 w-full items-center justify-between gap-2 px-4 py-3 text-left"
            >
              <span className="font-heading text-[13px] font-bold text-ink">
                Lihat jawaban pilihan ganda
              </span>
              <ChevronDown
                className={cn("size-4 text-muted transition-transform", showMcq && "rotate-180")}
                aria-hidden
              />
            </button>
            {showMcq && (
              <ul className="scroll-thin max-h-72 divide-y divide-line overflow-y-auto border-t border-line">
                {demoQuestions
                  .filter((q) => q.type !== "essay")
                  .map((q) => {
                    const ans = attempt.answers[q.id];
                    const selected = ans?.selectedOptionIds ?? [];
                    const correct = [...q.correctOptionIds].sort().join(",");
                    const given = [...selected].sort().join(",");
                    const ok = given === correct;
                    return (
                      <li key={q.id} className="flex items-start gap-2 px-4 py-2">
                        <span
                          className={cn(
                            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                            ok ? "bg-leaf-100 text-leaf-800" : "bg-clay-50 text-clay-700",
                          )}
                        >
                          {ok ? <Check className="size-3" strokeWidth={3} aria-hidden /> : "x"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] text-ink">{q.body}</p>
                          <p className="text-[11.5px] text-muted">
                            Jawab:{" "}
                            {selected.length
                              ? q.options
                                  .map((o, oi) => (selected.includes(o.id) ? optionLabel(oi) : null))
                                  .filter(Boolean)
                                  .join(", ")
                              : "kosong"}{" "}
                            · Kunci:{" "}
                            {q.options
                              .map((o, oi) =>
                                q.correctOptionIds.includes(o.id) ? optionLabel(oi) : null,
                              )
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11.5px] tabular text-muted">
                          {ok ? q.points : 0}/{q.points}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Panel title="Beri nilai">
            <div className="text-center">
              <p className="text-[12px] font-medium text-muted">Skor soal ini</p>
              <div className="mt-2 flex items-baseline justify-center gap-1">
                <span className="font-heading text-[40px] font-extrabold leading-none tabular text-ink">
                  {current}
                </span>
                <span className="font-heading text-[16px] font-bold text-muted">/ {maxPoints}</span>
              </div>

              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {Array.from({ length: maxPoints + 1 }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setScores((prev) => ({ ...prev, [question.id]: i }))}
                    aria-label={`Beri ${i} poin`}
                    aria-pressed={current === i}
                    className={cn(
                      "press grid size-11 place-items-center rounded-field border font-heading text-[12px] font-bold transition-colors",
                      current === i
                        ? "border-navy-900 bg-navy-900 text-white"
                        : "border-line bg-surface text-ink-soft hover:border-navy-300 hover:bg-line-soft",
                    )}
                  >
                    {i}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={maxPoints}
                  step={0.5}
                  value={current}
                  onChange={(e) =>
                    setScores((prev) => ({ ...prev, [question.id]: Number(e.target.value) }))
                  }
                  className="h-11 flex-1 accent-navy-700"
                  aria-label="Geser untuk memberi nilai"
                />
                <span className="w-10 text-right font-heading text-[12px] font-bold tabular text-ink">
                  {current}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="komentar" className="text-[12.5px] font-semibold text-ink">
                Komentar untuk peserta
              </label>
              <textarea
                id="komentar"
                value={notes[question.id] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [question.id]: e.target.value }))}
                placeholder="Mis. Langkah substitusi sudah benar, tetapi hasil akhir kurang teliti."
                className="mt-1.5 min-h-24 w-full resize-y rounded-field border border-line bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-ink placeholder:text-muted focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-900/15"
              />
            </div>

            <div className="mt-3 space-y-1.5">
              <Button block size="md" onClick={() => save(true)}>
                <Save className="size-4" aria-hidden /> Simpan dan lanjut
              </Button>
              <Button block size="md" variant="secondary" onClick={() => save(false)}>
                Simpan saja
              </Button>
            </div>

            <div className="mt-3 rounded-field bg-line-soft px-3 py-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted">Progres penilaian</span>
                <span className="font-heading font-bold tabular text-ink">
                  {gradedCount}/{essays.length}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-leaf-600"
                  style={{ width: `${(gradedCount / essays.length) * 100}%` }}
                />
              </div>
            </div>

            <Button
              block
              size="md"
              variant="dark"
              className="mt-2"
              onClick={() => toast("Belum tersambung ke server. Nilai akhir belum disimpan.")}
            >
              <CheckCircle2 className="size-4" aria-hidden /> Selesaikan penilaian
            </Button>

            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                className="press inline-flex min-h-11 items-center gap-1 rounded-field px-2.5 py-1.5 text-[12px] font-semibold text-muted hover:bg-line-soft disabled:opacity-40"
              >
                <ArrowLeft className="size-3.5" aria-hidden /> Sebelumnya
              </button>
              <button
                type="button"
                disabled={index === essays.length - 1}
                onClick={() => setIndex((i) => Math.min(essays.length - 1, i + 1))}
                className="press inline-flex min-h-11 items-center gap-1 rounded-field px-2.5 py-1.5 text-[12px] font-semibold text-muted hover:bg-line-soft disabled:opacity-40"
              >
                Berikutnya <ArrowRight className="size-3.5" aria-hidden />
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
