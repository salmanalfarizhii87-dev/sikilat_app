"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Flag,
  Loader2,
  MessageSquareText,
  RotateCcw,
  Save,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { cn, countWords, formatClock, optionLabel } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/primitives";
import { PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { ExamTabs } from "@/components/admin/exam-tabs";
import { gradeEssay, resetAttempt } from "@/features/grading/actions";
import type { GradingAttempt } from "@/features/grading/queries";

/**
 * Halaman penilaian esai (T6.2, T6.3).
 *
 * Sebelumnya komponen ini membaca `demoQuestions` dan `demoAttempts`, lalu
 * tombol simpannya hanya memunculkan toast "belum dikirim ke server". Nilai yang
 * diketik admin tidak pernah sampai ke database.
 *
 * Sekarang nilai awal datang dari `getAttemptForGrading` dan setiap simpan
 * memanggil `gradeEssay` — RPC `grade_essay` yang menulis `points_awarded`,
 * menghitung ulang `score_manual`, dan memindahkan status attempt bila semua
 * esai sudah dinilai. Halaman ini tidak menghitung nilai sendiri.
 */
export function GradingClient({ attempt }: { attempt: GradingAttempt }) {
  const router = useRouter();

  const essays = React.useMemo(
    () => attempt.questions.filter((question) => question.type === "essay"),
    [attempt.questions],
  );
  const objectives = React.useMemo(
    () => attempt.questions.filter((question) => question.type !== "essay"),
    [attempt.questions],
  );

  const [index, setIndex] = React.useState(0);

  /*
   * Nilai awal diambil dari jawaban yang sudah dinilai di server, sehingga
   * membuka ulang halaman menampilkan nilai yang benar — bukan 0. `null` berarti
   * belum dinilai, dan itu berbeda dari 0 poin.
   */
  const [scores, setScores] = React.useState<Record<string, number | null>>(() =>
    Object.fromEntries(essays.map((question) => [question.id, question.answer?.pointsAwarded ?? null])),
  );
  const [notes, setNotes] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(essays.map((question) => [question.id, question.answer?.feedback ?? ""])),
  );

  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showMcq, setShowMcq] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);

  const question = essays[index];
  const gradedCount = essays.filter((item) => scores[item.id] !== null && scores[item.id] !== undefined)
    .length;

  const save = async (advance: boolean) => {
    if (!question) return;

    const value = scores[question.id];
    if (value === null || value === undefined) {
      toast.error("Pilih nilai untuk soal ini dulu.");
      return;
    }

    setPending(true);
    setError(null);

    const result = await gradeEssay({
      attemptId: attempt.id,
      questionId: question.id,
      points: value,
      feedback: notes[question.id] ?? "",
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success(
      result.data.pendingEssay === 0
        ? "Nilai tersimpan. Semua esai sudah dinilai."
        : `Nilai tersimpan. ${result.data.pendingEssay} esai masih menunggu.`,
    );

    // Data di server berubah (status attempt, total nilai), jadi halaman harus
    // dimuat ulang. `refresh()` menjaga posisi pilihan soal tetap di tempatnya.
    router.refresh();

    if (advance && index < essays.length - 1) {
      setIndex(index + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const doReset = async (mode: "delete" | "extra") => {
    setPending(true);
    const result = await resetAttempt({ attemptId: attempt.id, mode });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    toast.success("Percobaan peserta dihapus. Peserta bisa mengerjakan lagi.");
    setResetOpen(false);
    router.push(`/admin/exams/${attempt.examId}/monitor`);
  };

  if (!question) {
    return (
      <>
        <PageHeader
          title="Penilaian"
          description="Ujian ini tidak punya soal esai, jadi tidak ada yang perlu dinilai manual."
          actions={
            <Link href={`/admin/exams/${attempt.examId}/results`}>
              <Button variant="secondary" size="md">
                <ArrowLeft className="size-4" aria-hidden /> Kembali ke rekap
              </Button>
            </Link>
          }
        />
        <ExamTabs examId={attempt.examId} />
        <Panel title="Semua soal dinilai otomatis">
          <p className="text-[12.5px] leading-relaxed text-muted">
            Nilai attempt ini dihitung seluruhnya dari soal objektif. Tidak ada tindakan yang
            diperlukan di halaman ini.
          </p>
        </Panel>
      </>
    );
  }

  const words = countWords(question.answer?.essayText ?? "");
  const current = scores[question.id] ?? 0;
  const maxPoints = question.points;

  return (
    <>
      <PageHeader
        title="Penilaian esai"
        description="Bandingkan jawaban peserta dengan kunci acuan, lalu beri nilai dan komentar."
        actions={
          <>
            <Link href={`/admin/exams/${attempt.examId}/results`}>
              <Button variant="secondary" size="md">
                <ArrowLeft className="size-4" aria-hidden /> Rekap nilai
              </Button>
            </Link>
            <Button variant="ghost" size="md" onClick={() => setResetOpen(true)}>
              <RotateCcw className="size-4" aria-hidden /> Reset percobaan
            </Button>
          </>
        }
      >
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
          <StatusBadge status={attempt.status} />
          <span className="rounded-xs bg-line-soft px-1.5 py-0.5 font-heading text-[11px] font-bold text-ink-soft">
            {attempt.examCode}
          </span>
          <span>{attempt.examTitle}</span>
        </p>
      </PageHeader>

      <ExamTabs examId={attempt.examId} />

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-navy-900 font-heading text-[13px] font-bold text-white">
          {attempt.participantName
            .split(" ")
            .slice(0, 2)
            .map((part) => part[0])
            .join("")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 font-heading text-[14px] font-bold text-ink">
            {attempt.participantName}
            <span className="font-medium text-muted">percobaan {attempt.attemptNo}</span>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-muted">
            <span className="flex items-center gap-1">
              <UserRound className="size-3.5" aria-hidden /> Kelas{" "}
              {attempt.participantClass ?? "-"}
            </span>
            <span className="flex items-center gap-1">
              <Clock3 className="size-3.5" aria-hidden /> Dikumpulkan{" "}
              {attempt.submittedAt ? formatClock(attempt.submittedAt) : "belum"}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquareText className="size-3.5" aria-hidden /> {essays.length} esai,{" "}
              {gradedCount}/{essays.length} dinilai
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-field bg-line-soft px-3 py-1.5">
          <div>
            <p className="text-[11px] font-medium text-muted">Otomatis</p>
            <p className="font-heading text-[13px] font-bold tabular text-ink">
              {attempt.scoreAuto}
            </p>
          </div>
          <div className="h-7 w-px bg-line" />
          <div>
            <p className="text-[11px] font-medium text-muted">Esai</p>
            <p className="font-heading text-[13px] font-bold tabular text-ink">
              {attempt.scoreManual}
            </p>
          </div>
          <div className="h-7 w-px bg-line" />
          <div>
            <p className="text-[11px] font-medium text-muted">Total</p>
            <p className="font-heading text-[13px] font-bold tabular text-ink">
              {attempt.totalScore}/{attempt.maxScore}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-3 rounded-field border border-clay-200 bg-clay-50 px-3 py-2 text-[12.5px] font-medium text-clay-700"
        >
          {error}
        </p>
      )}

      <div
        className="scroll-thin mb-3 flex gap-1.5 overflow-x-auto pb-0.5"
        role="group"
        aria-label="Pilih soal esai"
      >
        {essays.map((item, i) => {
          const value = scores[item.id];
          const done = value !== null && value !== undefined;
          return (
            <button
              key={item.id}
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
                {done ? value : "-"}/{item.points}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {question.passage && (
            <Panel title="Teks bacaan">
              <p className="scroll-thin max-h-56 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">
                {question.passage}
              </p>
            </Panel>
          )}

          <Panel title={`Soal ${question.position} · ${question.points} poin`}>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{question.body}</p>
            {(question.wordMin !== null || question.wordMax !== null) && (
              <p className="mt-2 text-[12px] text-muted">
                Batas kata: {question.wordMin ?? 0} sampai{" "}
                {question.wordMax ?? "tanpa batas"} kata
              </p>
            )}
          </Panel>

          <Panel
            title="Jawaban peserta"
            description={`${words} kata`}
            action={
              question.answer?.flagged ? (
                <Badge tone="amber">
                  <Flag className="size-2.5 fill-current" aria-hidden /> Ditandai ragu
                </Badge>
              ) : null
            }
          >
            {question.answer?.essayText ? (
              <p className="whitespace-pre-wrap rounded-field border border-line bg-canvas px-3.5 py-3 text-[14px] leading-relaxed text-ink">
                {question.answer.essayText}
              </p>
            ) : (
              <p className="rounded-field border border-dashed border-line bg-canvas px-3.5 py-6 text-center text-[12.5px] text-muted">
                Peserta tidak menjawab soal ini. Kamu tetap bisa memberi 0 poin agar soalnya
                tercatat sudah dinilai.
              </p>
            )}
          </Panel>

          <Panel title="Kunci acuan" description="Hanya terlihat admin">
            {question.referenceAnswer ? (
              <p className="whitespace-pre-wrap rounded-field border border-leaf-200 bg-leaf-50 px-3.5 py-3 text-[13px] leading-relaxed text-leaf-900">
                {question.referenceAnswer}
              </p>
            ) : (
              <p className="rounded-field border border-dashed border-line bg-canvas px-3.5 py-3 text-[12.5px] text-muted">
                Soal ini tidak punya kunci acuan. Nilai sepenuhnya berdasarkan penilaianmu.
              </p>
            )}
            {question.explanation && (
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                <strong className="font-semibold text-ink-soft">Catatan penilaian:</strong>{" "}
                {question.explanation}
              </p>
            )}
          </Panel>

          {objectives.length > 0 && (
            <div className="overflow-hidden rounded-card border border-line bg-surface">
              <button
                type="button"
                onClick={() => setShowMcq((value) => !value)}
                aria-expanded={showMcq}
                className="press flex min-h-11 w-full items-center justify-between gap-2 px-4 py-3 text-left"
              >
                <span className="font-heading text-[13px] font-bold text-ink">
                  Lihat jawaban pilihan ganda ({objectives.length} soal)
                </span>
                <ChevronDown
                  className={cn("size-4 text-muted transition-transform", showMcq && "rotate-180")}
                  aria-hidden
                />
              </button>
              {showMcq && (
                <ul className="scroll-thin max-h-80 divide-y divide-line overflow-y-auto border-t border-line">
                  {objectives.map((item) => {
                    const selected = item.answer?.selectedOptionIds ?? [];
                    const correctIds = item.options.filter((o) => o.isCorrect).map((o) => o.id);
                    const ok =
                      selected.length > 0 &&
                      selected.length === correctIds.length &&
                      [...selected].sort().join(",") === [...correctIds].sort().join(",");
                    return (
                      <li key={item.id} className="flex items-start gap-2 px-4 py-2">
                        <span
                          className={cn(
                            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                            item.answer === null
                              ? "bg-line-soft text-muted"
                              : ok
                                ? "bg-leaf-100 text-leaf-800"
                                : "bg-clay-50 text-clay-700",
                          )}
                        >
                          {item.answer === null ? "–" : ok ? <Check className="size-3" strokeWidth={3} aria-hidden /> : "×"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[12px] text-ink">{item.body}</p>
                          <p className="text-[11.5px] text-muted">
                            Jawab:{" "}
                            {selected.length
                              ? item.options
                                  .map((option, oi) =>
                                    selected.includes(option.id) ? optionLabel(oi) : null,
                                  )
                                  .filter(Boolean)
                                  .join(", ")
                              : "kosong"}{" "}
                            · Kunci:{" "}
                            {item.options
                              .map((option, oi) => (option.isCorrect ? optionLabel(oi) : null))
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11.5px] tabular text-muted">
                          {item.answer?.pointsAwarded ?? 0}/{item.points}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {attempt.events.length > 0 && (
            <Panel title="Log kejadian" description="Catatan integritas selama pengerjaan">
              <ul className="space-y-1.5">
                {attempt.events.map((event, i) => (
                  <li
                    key={`${event.type}-${event.at}-${i}`}
                    className="flex items-center justify-between gap-2 text-[12px]"
                  >
                    <span className="text-ink-soft">{eventLabel(event.type)}</span>
                    <span className="tabular text-muted">{formatClock(event.at)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Panel title="Beri nilai">
            <div className="text-center">
              <p className="text-[12px] font-medium text-muted">Nilai soal ini</p>
              <div className="mt-2 flex items-baseline justify-center gap-1">
                <span className="font-heading text-[40px] font-extrabold leading-none tabular text-ink">
                  {current}
                </span>
                <span className="font-heading text-[16px] font-bold text-muted">/ {maxPoints}</span>
              </div>

              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {Array.from({ length: Math.floor(maxPoints) + 1 }, (_, i) => (
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
                  onChange={(event) =>
                    setScores((prev) => ({ ...prev, [question.id]: Number(event.target.value) }))
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
                onChange={(event) =>
                  setNotes((prev) => ({ ...prev, [question.id]: event.target.value }))
                }
                placeholder="Mis. Langkah substitusi sudah benar, tetapi hasil akhir kurang teliti."
                className="mt-1.5 min-h-24 w-full resize-y rounded-field border border-line bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-ink placeholder:text-muted focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-900/15"
              />
              <p className="mt-1 text-[11px] text-muted">
                Komentar tampil di halaman hasil peserta bila ujian memakai visibilitas
                &ldquo;skor dan pembahasan&rdquo;.
              </p>
            </div>

            <div className="mt-3 space-y-1.5">
              <Button block size="md" onClick={() => save(true)} disabled={pending}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="size-4" aria-hidden />
                )}
                {pending ? "Menyimpan…" : "Simpan dan lanjut"}
              </Button>
              <Button
                block
                size="md"
                variant="secondary"
                onClick={() => save(false)}
                disabled={pending}
              >
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

            <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-leaf-700" aria-hidden />
              Attempt otomatis berpindah ke &ldquo;Selesai&rdquo; setelah esai terakhir dinilai.
              Nilai total dihitung server.
            </p>

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

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        size="sm"
        title="Reset percobaan peserta?"
        description={
          <>
            Percobaan <strong className="font-semibold text-ink">{attempt.participantName}</strong>{" "}
            beserta seluruh jawaban dan nilainya akan dihapus. Tindakan ini tercatat di audit.
          </>
        }
        icon={
          <span className="grid size-9 place-items-center rounded-xs bg-clay-50 text-clay-600">
            <AlertTriangle className="size-4" aria-hidden />
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetOpen(false)}>
              Batal
            </Button>
            <Button variant="danger" disabled={pending} onClick={() => doReset("delete")}>
              {pending ? "Menghapus…" : "Hapus percobaan"}
            </Button>
          </>
        }
      >
        <p className="text-[12.5px] leading-relaxed text-muted">
          Setelah dihapus, peserta bisa memulai percobaan baru dan kuota percobaannya kembali
          seperti sebelum attempt ini dibuat.
        </p>
      </Modal>
    </>
  );
}

/** Label manusia untuk tipe kejadian integritas. */
function eventLabel(type: string) {
  const map: Record<string, string> = {
    tab_hidden: "Berpindah tab atau mengecilkan jendela",
    fullscreen_exit: "Keluar dari layar penuh",
    paste: "Menempel teks",
    report: "Melaporkan soal bermasalah",
  };
  return map[type] ?? type;
}
