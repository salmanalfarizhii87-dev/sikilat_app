"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  Cloud,
  CloudOff,
  Flag,
  Grid2x2,
  Highlighter,
  Loader2,
  MessageSquareWarning,
  Send,
  WifiOff,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/primitives";
import { ExamTimer } from "./exam-timer";
import { OptionRow, EssayAnswer } from "./question-parts";
import { QuestionGrid, NavLegend, questionState, type NavFilter } from "./question-nav";
import { BuramLayer } from "./buram-layer";
import { useExamRunner } from "./exam-store";
import { useFocusTrap } from "@/components/ui/use-focus-trap";
import { useOnline } from "@/lib/client-hooks";

type SaveState = "idle" | "saving" | "saved" | "offline" | "error";

export function ExamRunner() {
  const router = useRouter();
  const {
    exam,
    questions,
    attempt,
    ready,
    setAnswer,
    toggleFlag,
    toggleCrossout,
    progress,
    submit,
  } = useExamRunner();

  const [index, setIndex] = React.useState(0);
  const [navOpen, setNavOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<NavFilter>("all");
  const [crossoutMode, setCrossoutMode] = React.useState(false);
  const [buram, setBuram] = React.useState(false);
  const [timerHidden, setTimerHidden] = React.useState(false);
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const online = useOnline();
  const [submitOpen, setSubmitOpen] = React.useState(false);
  const [exitOpen, setExitOpen] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [timeUpOpen, setTimeUpOpen] = React.useState(false);
  const [showHint, setShowHint] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const buramRef = React.useRef<HTMLDivElement>(null);
  const navRef = React.useRef<HTMLDivElement>(null);
  const saveTimer = React.useRef<number | null>(null);

  useFocusTrap(navOpen, navRef, () => setNavOpen(false));

  const question = questions[index];
  const answer = attempt?.answers[question?.id ?? ""];
  const state = question ? questionState(question, attempt) : { answered: false, flagged: false };

  const answered = questions.filter((q) => questionState(q, attempt).answered).length;
  const flagged = questions.filter((q) => questionState(q, attempt).flagged).length;
  const unanswered = questions.length - answered;

  React.useEffect(() => {
    if (ready && !attempt) {
      router.replace(`/u/${exam.code}`);
    }
  }, [ready, attempt, exam.code, router]);

  // PRD §9.3: tombol Back peramban tidak boleh meninggalkan attempt tanpa
  // konfirmasi. Kita dorong satu entri riwayat penjaga supaya Back pertama
  // membuka dialog keluar, bukan berpindah halaman.
  React.useEffect(() => {
    if (!attempt || attempt.status !== "in_progress") return;
    window.history.pushState({ kilatGuard: true }, "");
    const onPop = () => {
      window.history.pushState({ kilatGuard: true }, "");
      setExitOpen(true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [attempt]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [index]);

  const markSaving = React.useCallback(() => {
    if (!navigator.onLine) {
      setSaveState("offline");
      return;
    }
    setSaveState("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      setSaveState("saved");
      window.setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2400);
    }, 700);
  }, []);

  const goTo = React.useCallback(
    (next: number) => {
      setIndex(Math.min(questions.length - 1, Math.max(0, next)));
    },
    [questions.length],
  );

  const jumpTo = (id: string) => {
    const target = questions.findIndex((q) => q.id === id);
    if (target >= 0) setIndex(target);
    setNavOpen(false);
  };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (navOpen) {
          setNavOpen(false);
          return;
        }
        if (buram) {
          setBuram(false);
          return;
        }
        if (crossoutMode) {
          setCrossoutMode(false);
          return;
        }
      }
      if (submitOpen || exitOpen || reportOpen || timeUpOpen || navOpen || buram) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") goTo(index + 1);
      if (e.key === "ArrowLeft") goTo(index - 1);
      if (question?.type !== "essay" && /^[a-eA-E]$/.test(e.key)) {
        const opt = question.options["abcde".indexOf(e.key.toLowerCase())];
        if (opt) {
          setAnswer(question.id, { selectedOptionIds: [opt.id] });
          markSaving();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    index,
    question,
    setAnswer,
    goTo,
    submitOpen,
    exitOpen,
    reportOpen,
    timeUpOpen,
    navOpen,
    buram,
    crossoutMode,
    markSaving,
  ]);

  if (!attempt || !question) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas">
        <div className="flex items-center gap-2 text-[13.5px] text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Memuat lembar ujian
        </div>
      </div>
    );
  }

  const selectOption = (optionId: string) => {
    if (question.type === "mcq_multiple") {
      const current = answer?.selectedOptionIds ?? [];
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      setAnswer(question.id, { selectedOptionIds: next });
    } else {
      setAnswer(question.id, { selectedOptionIds: [optionId] });
    }
    markSaving();
  };

  const doSubmit = () => {
    submit("manual");
    setSubmitOpen(false);
    router.push(`/hasil/demo-result-token`);
  };

  const finishTimeout = () => {
    submit("timeout");
    setTimeUpOpen(false);
    router.push(`/hasil/demo-result-token`);
  };

  const filters: [NavFilter, string][] = [
    ["all", `Semua ${questions.length}`],
    ["answered", `Terisi ${answered}`],
    ["empty", `Kosong ${unanswered}`],
    ["flagged", `Ragu ${flagged}`],
  ];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
      <header className="relative z-40 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-2 sm:px-4">
        <div className="flex min-w-11 flex-1 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setExitOpen(true)}
            aria-label="Keluar dari ujian"
            className="press grid size-11 shrink-0 place-items-center rounded-field text-ink-soft hover:bg-line-soft hover:text-ink"
          >
            <ChevronLeft className="size-5" strokeWidth={2.4} aria-hidden />
          </button>
          <div className="min-w-0">
            {/* Di HP ruang header sempit: nama peserta lebih penting daripada
                judul mapel, jadi mapel hanya tampil mulai layar sm. */}
            <h1 className="truncate font-heading text-[14px] font-bold leading-tight text-ink sm:text-[15px]">
              {attempt.participantName}
            </h1>
            <p className="hidden truncate text-[12px] text-muted sm:block">
              {exam.subjectLabel.split("·")[0]?.trim() || exam.title}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-center">
          <ExamTimer
            expiresAt={attempt.expiresAt}
            hidden={timerHidden}
            onToggle={() => setTimerHidden((v) => !v)}
            onExpire={() => setTimeUpOpen(true)}
          />
        </div>

        {/* Sisi kanan hanya berisi indikator simpan (>=sm) dan tombol navigasi,
            jadi tidak perlu mengambil sisa lebar. Ruang itu dipakai nama peserta. */}
        <div className="flex shrink-0 items-center justify-end gap-1.5">
          <SaveIndicator state={saveState} online={online} />
          <button
            type="button"
            onClick={() => setBuram((v) => !v)}
            aria-pressed={buram}
            className={cn(
              "press hidden h-11 shrink-0 items-center gap-1.5 rounded-field border px-3.5 font-heading text-[13px] font-semibold transition-colors md:flex",
              buram
                ? "border-navy-900 bg-navy-900 text-white"
                : "border-line bg-surface text-ink-soft hover:bg-line-soft",
            )}
          >
            <Highlighter className="size-4" aria-hidden />
            Buram
          </button>
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label={`Navigasi soal, ${index + 1} dari ${questions.length}`}
            className="press flex h-11 items-center gap-2 rounded-field border border-line bg-surface px-3 font-heading text-[13px] font-semibold tabular text-ink-soft hover:bg-line-soft sm:px-4"
          >
            <span>
              {index + 1}/{questions.length}
            </span>
            <Grid2x2 className="size-4" aria-hidden />
          </button>
        </div>
      </header>

      {/* Motif identitas: satu garis progres tipis di bawah header (DESIGN.md §10). */}
      <div className="relative z-30 h-[3px] w-full overflow-hidden bg-line-soft">
        <div
          className={cn(
            "h-full transition-all duration-500",
            answered === questions.length ? "bg-navy-800" : "bg-accent-500",
          )}
          style={{ width: `${Math.max(2, progress)}%` }}
        />
      </div>

      {!online && (
        <div className="animate-rise flex items-center justify-center gap-2 border-b border-accent-200 bg-accent-100 px-4 py-2 text-[12.5px] font-semibold text-accent-900">
          <WifiOff className="size-3.5" aria-hidden /> Tidak ada koneksi. Jawaban tersimpan di
          perangkat ini dan dikirim saat online.
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            className="scroll-thin relative flex-1 overflow-y-auto px-4 pb-6 pt-5 sm:px-6 sm:pt-6"
          >
            <div
              ref={buramRef}
              className="relative mx-auto flex min-h-full w-full max-w-[720px] flex-col"
            >
              <div key={question.id} className="animate-rise">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3.5">
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-[17px] font-bold text-ink">
                      Soal {index + 1}
                      <span className="font-medium text-muted"> dari {questions.length}</span>
                    </h2>
                    <span className="rounded-xs bg-line-soft px-1.5 py-0.5 font-heading text-[11px] font-semibold text-muted">
                      {question.type === "essay" ? "Esai" : `${question.points} poin`}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        toggleFlag(question.id);
                        markSaving();
                      }}
                      aria-pressed={state.flagged}
                      className={cn(
                        "press flex min-h-11 items-center gap-1.5 rounded-field px-3 font-heading text-[12.5px] font-semibold transition-colors",
                        state.flagged
                          ? "bg-accent-200 text-accent-900 ring-1 ring-accent-700"
                          : "bg-line-soft text-ink-soft hover:bg-line",
                      )}
                    >
                      <Flag
                        className={cn("size-3.5", state.flagged && "fill-accent-800")}
                        strokeWidth={2.6}
                        aria-hidden
                      />
                      Ragu
                    </button>
                    <button
                      type="button"
                      onClick={() => setCrossoutMode((v) => !v)}
                      aria-pressed={crossoutMode}
                      aria-label="Mode coret opsi"
                      className={cn(
                        "press flex min-h-11 items-center gap-1.5 rounded-field px-3 font-heading text-[12.5px] font-semibold transition-colors",
                        crossoutMode
                          ? "bg-navy-900 text-white"
                          : "bg-line-soft text-ink-soft hover:bg-line",
                      )}
                    >
                      <X className="size-3.5" strokeWidth={2.8} aria-hidden />
                      Coret
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportOpen(true)}
                      className="press hidden min-h-11 items-center gap-1.5 rounded-field bg-line-soft px-3 font-heading text-[12.5px] font-semibold text-ink-soft transition-colors hover:bg-line sm:flex"
                    >
                      <MessageSquareWarning className="size-3.5" strokeWidth={2.4} aria-hidden />
                      Laporkan
                    </button>
                    <button
                      type="button"
                      onClick={() => setBuram(true)}
                      aria-pressed={buram}
                      className="press flex min-h-11 items-center gap-1.5 rounded-field bg-line-soft px-3 font-heading text-[12.5px] font-semibold text-ink-soft transition-colors hover:bg-line md:hidden"
                    >
                      <Highlighter className="size-3.5" strokeWidth={2.4} aria-hidden />
                      Buram
                    </button>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <p className="text-[16px] leading-[1.75] text-ink">{question.body}</p>

                  {question.mediaCaption && (
                    <figure className="overflow-hidden rounded-card border border-line bg-surface p-3">
                      <div className="grid h-40 place-items-center rounded-field bg-line-soft text-[12px] text-muted">
                        Gambar soal: {question.mediaCaption}
                      </div>
                      <figcaption className="mt-2 text-center text-[12px] text-muted">
                        Gambar belum tersedia di mode demo.
                      </figcaption>
                    </figure>
                  )}

                  {question.type === "essay" ? (
                    <EssayAnswer
                      value={answer?.essayText ?? ""}
                      wordMin={question.wordMin}
                      wordMax={question.wordMax}
                      onChange={(next) => {
                        setAnswer(question.id, { essayText: next });
                        markSaving();
                      }}
                    />
                  ) : (
                    <div className="space-y-2.5">
                      {question.type === "mcq_multiple" && (
                        <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-navy-700">
                          <Check className="size-3.5" aria-hidden /> Bisa pilih lebih dari satu
                          jawaban
                        </p>
                      )}
                      {question.options.map((opt, i) => (
                        <OptionRow
                          key={opt.id}
                          option={opt}
                          index={i}
                          selected={(answer?.selectedOptionIds ?? []).includes(opt.id)}
                          crossed={(answer?.crossouts ?? []).includes(opt.id)}
                          crossoutMode={crossoutMode}
                          multi={question.type === "mcq_multiple"}
                          onSelect={() => selectOption(opt.id)}
                          onToggleCrossout={() => {
                            toggleCrossout(question.id, opt.id);
                            markSaving();
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <BuramLayer active={buram} onClose={() => setBuram(false)} containerRef={buramRef} />
            </div>
          </div>

          <div className="relative z-30 flex shrink-0 items-center gap-2 border-t border-line bg-surface px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              aria-label="Soal sebelumnya"
              className="press grid size-11 shrink-0 place-items-center rounded-field border border-line bg-surface text-ink-soft transition-colors hover:bg-line-soft disabled:text-muted disabled:opacity-60"
            >
              <ArrowLeft className="size-4.5" aria-hidden />
            </button>

            <div className="mx-auto hidden items-center gap-2 text-[12px] font-medium text-muted sm:flex">
              <span>{answered} terjawab</span>
              <span className="text-line" aria-hidden>
                ·
              </span>
              <span>{unanswered} kosong</span>
              {flagged > 0 && (
                <>
                  <span className="text-line" aria-hidden>
                    ·
                  </span>
                  <span className="text-accent-900">{flagged} ragu</span>
                </>
              )}
            </div>

            {index === questions.length - 1 ? (
              <Button size="md" onClick={() => setSubmitOpen(true)} className="ml-auto sm:ml-0">
                <Send className="size-4" aria-hidden /> Kumpulkan
              </Button>
            ) : (
              <Button size="md" onClick={() => goTo(index + 1)} className="ml-auto min-w-[140px] sm:ml-0">
                Selanjutnya <ArrowRight className="size-4" aria-hidden />
              </Button>
            )}

            <Button
              variant="secondary"
              size="md"
              onClick={() => setSubmitOpen(true)}
              className="hidden sm:inline-flex"
            >
              Kumpulkan
            </Button>
          </div>
        </div>

        <aside className="hidden w-[300px] shrink-0 border-l border-line bg-surface xl:block">
          <div className="flex h-full flex-col">
            <div className="border-b border-line px-4 py-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-[13.5px] font-bold text-ink">Navigasi soal</h3>
                <Badge tone="outline">{questions.length} soal</Badge>
              </div>
              <div className="mt-3 flex gap-1.5">
                {filters.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    aria-pressed={filter === key}
                    className={cn(
                      "press flex-1 rounded-full border px-2 py-1.5 font-heading text-[11px] font-semibold transition-colors",
                      filter === key
                        ? "border-navy-900 bg-navy-900 text-white"
                        : "border-line bg-surface text-muted hover:bg-line-soft",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="scroll-thin flex-1 overflow-y-auto px-4 py-4">
              <QuestionGrid
                questions={questions}
                attempt={attempt}
                currentId={question.id}
                onJump={jumpTo}
                filter={filter}
              />
            </div>

            <div className="border-t border-line px-4 py-3">
              <NavLegend />
              <div className="mt-3 rounded-field bg-line-soft px-3 py-2">
                <p className="text-[11.5px] font-medium text-muted">Kode Lanjut</p>
                <p className="font-heading text-base font-bold tracking-[0.14em] text-ink">
                  {attempt.resumeCode}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted">
                  Simpan kode ini untuk membuka pengerjaan ini lagi di perangkat yang sama.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {navOpen && (
        <div className="fixed inset-0 z-[70] xl:hidden">
          <div
            onClick={() => setNavOpen(false)}
            className="animate-fade absolute inset-0 bg-navy-900/55"
            aria-hidden
          />
          <div
            ref={navRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigasi soal"
            className="animate-sheet absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-hidden rounded-t-card border-t border-line bg-surface"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h3 className="font-heading text-[15px] font-bold text-ink">Navigasi soal</h3>
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                aria-label="Tutup"
                className="press grid size-11 place-items-center rounded-field text-muted hover:bg-line-soft"
              >
                <X className="size-4.5" aria-hidden />
              </button>
            </div>
            <div className="flex gap-1.5 px-4 pt-3">
              {filters.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  aria-pressed={filter === key}
                  className={cn(
                    "press flex-1 rounded-full border px-2 py-1.5 font-heading text-[11.5px] font-semibold transition-colors",
                    filter === key
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-line bg-surface text-muted hover:bg-line-soft",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="scroll-thin max-h-[48dvh] overflow-y-auto px-4 py-3">
              <QuestionGrid
                questions={questions}
                attempt={attempt}
                currentId={question.id}
                onJump={jumpTo}
                filter={filter}
              />
            </div>
            <div className="border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <NavLegend />
              <div className="mt-2.5 flex gap-2">
                <Button variant="secondary" size="md" onClick={() => setNavOpen(false)}>
                  Tutup
                </Button>
                <Button
                  size="md"
                  block
                  onClick={() => {
                    setNavOpen(false);
                    setSubmitOpen(true);
                  }}
                >
                  <Send className="size-4" aria-hidden /> Kumpulkan
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        title="Kumpulkan ujian?"
        description="Setelah dikumpulkan, jawaban tidak bisa diubah lagi."
        icon={
          <span className="grid size-10 place-items-center rounded-card bg-accent-100 text-accent-900">
            <Send className="size-5" aria-hidden />
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setSubmitOpen(false)}>
              Periksa lagi
            </Button>
            <Button onClick={doSubmit}>Ya, kumpulkan</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Terjawab", value: answered, tone: "text-leaf-800 bg-leaf-50 border-leaf-200" },
              { label: "Kosong", value: unanswered, tone: "text-clay-700 bg-clay-50 border-clay-200" },
              { label: "Ragu", value: flagged, tone: "text-accent-900 bg-accent-50 border-accent-200" },
            ].map((item) => (
              <div
                key={item.label}
                className={cn("rounded-field border px-3 py-2.5 text-center", item.tone)}
              >
                <p className="font-heading text-xl font-bold tabular">{item.value}</p>
                <p className="text-[11.5px] font-semibold">{item.label}</p>
              </div>
            ))}
          </div>
          {unanswered > 0 && (
            <p className="rounded-field bg-line-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-soft">
              Masih ada <strong>{unanswered} soal</strong> yang belum dijawab. Soal kosong dinilai 0,
              tanpa pengurangan nilai.
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        title="Keluar dari ujian?"
        description="Jawaban kamu tersimpan di perangkat ini dan bisa dilanjutkan. Waktu ujian tetap berjalan."
        icon={
          <span className="grid size-10 place-items-center rounded-card bg-accent-100 text-accent-900">
            <ArrowLeft className="size-5" aria-hidden />
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setExitOpen(false)}>
              Tetap di sini
            </Button>
            <Button onClick={() => router.push(`/u/${exam.code}`)}>Simpan dan keluar</Button>
          </>
        }
      >
        <div className="rounded-field border border-line bg-canvas px-3.5 py-3">
          <p className="text-[12px] font-medium text-muted">Kode Lanjut</p>
          <p className="font-heading text-2xl font-extrabold tracking-[0.16em] text-ink">
            {attempt.resumeCode}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            Catat kode ini. Kamu perlu kode ini untuk membuka pengerjaan ini lagi di perangkat yang sama.
          </p>
        </div>
      </Modal>

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Laporkan masalah"
        description={`Soal ${index + 1} · ${exam.subjectLabel}`}
        icon={
          <span className="grid size-10 place-items-center rounded-card bg-accent-100 text-accent-900">
            <MessageSquareWarning className="size-5" aria-hidden />
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setReportOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => {
                setReportOpen(false);
                setShowHint(true);
                window.setTimeout(() => setShowHint(false), 2600);
              }}
            >
              Kirim laporan
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          {[
            "Kunci jawaban salah",
            "Salah ketik",
            "Soal membingungkan",
            "Gambar atau tabel tidak muncul",
            "Aplikasi bermasalah",
          ].map((reason) => (
            <label
              key={reason}
              className="press flex min-h-11 items-center gap-2.5 rounded-field border border-line px-3 text-[13.5px] text-ink-soft hover:bg-line-soft"
            >
              <input type="radio" name="report" className="accent-navy-700" />
              {reason}
            </label>
          ))}
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-muted">
          Laporan hanya tercatat di perangkat ini selama mode demo.
        </p>
      </Modal>

      <Modal
        open={timeUpOpen}
        onClose={finishTimeout}
        title="Waktu habis"
        description="Jawabanmu dikumpulkan otomatis. Kamu akan diarahkan ke halaman hasil."
        dismissible={false}
        icon={
          <span className="grid size-10 place-items-center rounded-card bg-clay-50 text-clay-600">
            <X className="size-5" aria-hidden />
          </span>
        }
        footer={<Button onClick={finishTimeout}>Lihat hasil</Button>}
      />

      {showHint && (
        <div className="animate-rise fixed bottom-24 left-1/2 z-[90] -translate-x-1/2 rounded-field bg-navy-900 px-4 py-2 text-[12.5px] font-semibold text-white shadow-pop">
          Laporan tercatat di perangkat ini
        </div>
      )}
    </div>
  );
}

/**
 * Indikator simpan menyebut tempat penyimpanan yang sebenarnya. Menulis
 * "tersimpan" tanpa kualifikasi akan membuat peserta mengira jawabannya sudah
 * ada di server (DESIGN.md §9).
 */
function SaveIndicator({ state, online }: { state: SaveState; online: boolean }) {
  if (!online) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-accent-100 px-2.5 py-1 text-[11.5px] font-semibold text-accent-900">
        <CloudOff className="size-3.5" aria-hidden /> Offline
      </span>
    );
  }
  if (state === "saving") {
    return (
      <span className="hidden items-center gap-1.5 rounded-full px-2 py-1 text-[11.5px] font-semibold text-muted sm:flex">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Menyimpan
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="hidden items-center gap-1.5 rounded-full bg-leaf-50 px-2 py-1 text-[11.5px] font-semibold text-leaf-800 sm:flex">
        <Check className="size-3.5" strokeWidth={3} aria-hidden /> Tersimpan
      </span>
    );
  }
  return (
    <span className="hidden items-center gap-1.5 rounded-full px-2 py-1 text-[11.5px] font-semibold text-muted sm:flex">
      <Cloud className="size-3.5" aria-hidden /> Tersimpan di perangkat
    </span>
  );
}
