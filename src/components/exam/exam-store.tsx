"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { logAttemptEvent, saveAnswer, submitAttempt } from "@/features/attempts/actions";
import type { AttemptAnswerState, AttemptState, AttemptQuestion } from "@/features/attempts/types";

/**
 * State runner peserta (T5.6, T5.8, T5.15).
 *
 * Sebelumnya modul ini adalah mesin ujian yang berjalan **seluruhnya di
 * peramban**: attempt dibuat dari `localStorage`, jawaban disimpan di sana, dan
 * nilai dihitung di klien dengan membandingkan `correctOptionIds`. Tiga hal itu
 * sekarang hilang:
 *
 * 1. **Tidak ada kunci jawaban di peramban.** `get_attempt_state` memang tidak
 *    pernah mengirimnya, jadi skor tidak bisa dihitung di sini — dan memang tidak
 *    boleh. Nilai ditentukan database saat peserta mengumpulkan.
 * 2. **Jawaban disimpan ke server**, bukan ke perangkat. Menutup tab lalu
 *    membuka di perangkat lain tetap memulihkan lembar yang sama lewat cookie.
 * 3. **Tidak ada attempt lokal.** Attempt hanya ada kalau server membuatnya.
 *
 * State di memori tetap dipakai supaya layar langsung bereaksi saat peserta
 * memilih opsi; server menyusul 800 ms kemudian (debounce). Kalau penyimpanan
 * gagal, perubahan lokal **tidak** dibatalkan — membuang pilihan peserta karena
 * jaringan putus jauh lebih buruk daripada menampilkan jawaban yang belum
 * tersimpan, asalkan indikatornya jujur.
 */

const SAVE_DEBOUNCE_MS = 800;

export type SaveState = "idle" | "saving" | "saved" | "error";

/** Jawaban lokal, dengan `touched` yang selalu true karena entri dibuat saat disentuh. */
export interface LocalAnswer extends AttemptAnswerState {
  touched: boolean;
}

interface ExamRunnerStore {
  exam: {
    code: string;
    title: string;
    subjectLabel: string | null;
    instructions: string | null;
  };
  questions: AttemptQuestion[];
  attempt: AttemptState | null;
  ready: boolean;
  saveState: SaveState;
  /** Seluruh jawaban yang sudah disentuh, untuk navigasi dan hitungan. */
  answers: Record<string, LocalAnswer>;
  answerFor: (questionId: string) => LocalAnswer | undefined;
  setAnswer: (questionId: string, patch: Partial<LocalAnswer>) => void;
  toggleFlag: (questionId: string) => void;
  submit: () => Promise<{ ok: boolean; resultToken?: string; message?: string }>;
  answeredCount: number;
  flaggedCount: number;
  progress: number;
}

const ExamRunnerContext = createContext<ExamRunnerStore | null>(null);

/**
 * Bentuk jawaban dari server menjadi bentuk yang dipakai komponen.
 *
 * Setiap entri yang dikirim server berarti soalnya **sudah disentuh** — RPC
 * hanya mengirim soal yang punya baris `attempt_answers`. Itulah sebabnya
 * `touched` di sini selalu true, dan soal yang belum disentuh tidak muncul
 * sama sekali (bukan muncul dengan nilai kosong).
 */
function toLocalAnswers(state: AttemptState): Record<string, LocalAnswer> {
  const out: Record<string, LocalAnswer> = {};
  for (const [questionId, answer] of Object.entries(state.answers ?? {})) {
    out[questionId] = {
      selectedOptionIds: answer.selectedOptionIds ?? [],
      essayText: answer.essayText ?? "",
      flagged: answer.flagged ?? false,
      touched: true,
    };
  }
  return out;
}

export function ExamRunnerProvider({
  children,
  initialState,
}: {
  children: React.ReactNode;
  initialState: AttemptState;
}) {
  const router = useRouter();

  const [attempt, setAttempt] = useState<AttemptState>(initialState);
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>(() =>
    toLocalAnswers(initialState),
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");

  /*
   * Antrean simpan per soal. Satu timer per soal berarti peserta yang mengubah
   * soal A lalu cepat pindah ke soal B tidak membatalkan simpanan A.
   */
  const timers = useRef(new Map<string, number>());
  const latest = useRef(new Map<string, LocalAnswer>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    /*
     * Salinan referensi map diambil di dalam efek. Objek `Map`-nya dibuat sekali
     * dan tidak pernah diganti — yang berubah hanya isinya — tetapi membaca
     * `timers.current` langsung di fungsi pembersih membuat React menduga ref
     * itu sudah menunjuk node lain saat cleanup berjalan.
     */
    const pendingTimers = timers.current;
    return () => {
      mounted.current = false;
      for (const timer of pendingTimers.values()) window.clearTimeout(timer);
      pendingTimers.clear();
    };
  }, []);

  /** Kirim satu jawaban ke server. */
  const flush = useCallback(
    async (questionId: string) => {
      const payload = latest.current.get(questionId);
      if (!payload) return;

      setSaveState("saving");

      const result = await saveAnswer({
        code: initialState.examCode,
        questionId,
        selectedOptionIds: payload.selectedOptionIds,
        essayText: payload.essayText,
        flagged: payload.flagged,
      });

      if (!mounted.current) return;

      if (result.ok) {
        setSaveState("saved");
        window.setTimeout(() => {
          if (mounted.current) setSaveState((current) => (current === "saved" ? "idle" : current));
        }, 2400);
      } else if (result.error.code === "ATTEMPT_EXPIRED") {
        /*
         * Waktu habis di server. Peserta tidak bisa menyimpan lagi, dan
         * jawaban yang ada sudah dikumpulkan otomatis oleh database. Arahkan
         * ke halaman hasil alih-alih membiarkannya terus menekan opsi.
         */
        setSaveState("error");
        router.replace(`/hasil/${attempt.resultToken}`);
      } else {
        setSaveState("error");
      }
    },
    [initialState.examCode, attempt.resultToken, router],
  );

  /** Jadwalkan simpan dengan debounce; jawaban terakhir yang menang. */
  const schedule = useCallback(
    (questionId: string, payload: LocalAnswer) => {
      latest.current.set(questionId, payload);

      const existing = timers.current.get(questionId);
      if (existing) window.clearTimeout(existing);

      const timer = window.setTimeout(() => {
        timers.current.delete(questionId);
        void flush(questionId);
      }, SAVE_DEBOUNCE_MS);

      timers.current.set(questionId, timer);
    },
    [flush],
  );

  const setAnswer = useCallback(
    (questionId: string, patch: Partial<LocalAnswer>) => {
      setAnswers((prev) => {
        const existing: LocalAnswer = prev[questionId] ?? {
          selectedOptionIds: [],
          essayText: "",
          flagged: false,
          touched: true,
        };
        const next: LocalAnswer = { ...existing, ...patch, touched: true };
        schedule(questionId, next);
        return { ...prev, [questionId]: next };
      });
    },
    [schedule],
  );

  const toggleFlag = useCallback(
    (questionId: string) => {
      setAnswers((prev) => {
        const existing: LocalAnswer = prev[questionId] ?? {
          selectedOptionIds: [],
          essayText: "",
          flagged: false,
          touched: true,
        };
        const next: LocalAnswer = { ...existing, flagged: !existing.flagged, touched: true };
        schedule(questionId, next);
        return { ...prev, [questionId]: next };
      });
    },
    [schedule],
  );

  /**
   * Kumpulkan jawaban (T5.11).
   *
   * Semua simpanan yang masih menunggu dikirim **lebih dulu**, supaya jawaban
   * yang baru diketik beberapa ratus milidetik lalu tidak hilang. Kalau ada yang
   * gagal, pengumpulan dibatalkan dan peserta diberi tahu — mengumpulkan dengan
   * jawaban yang belum tersimpan akan membuatnya kehilangan pekerjaan tanpa
   * sadar.
   */
  const submit = useCallback(async () => {
    const pending = [...timers.current.entries()];
    for (const [questionId, timer] of pending) {
      window.clearTimeout(timer);
      timers.current.delete(questionId);
    }

    for (const questionId of pending.map(([id]) => id)) {
      const payload = latest.current.get(questionId);
      if (!payload) continue;

      const result = await saveAnswer({
        code: initialState.examCode,
        questionId,
        selectedOptionIds: payload.selectedOptionIds,
        essayText: payload.essayText,
        flagged: payload.flagged,
      });

      if (!result.ok && result.error.code !== "ATTEMPT_EXPIRED") {
        setSaveState("error");
        return { ok: false, message: "Ada jawaban yang belum tersimpan. Periksa koneksi lalu coba lagi." };
      }
    }

    const result = await submitAttempt({ code: initialState.examCode });

    if (!result.ok) {
      setSaveState("error");
      return { ok: false, message: result.error.message };
    }

    setAttempt((prev) => ({ ...prev, status: result.data.status }));
    return { ok: true, resultToken: result.data.resultToken };
  }, [initialState.examCode]);

  const answerFor = useCallback((questionId: string) => answers[questionId], [answers]);

  const answeredCount = useMemo(() => {
    return initialState.questions.filter((question) => {
      const answer = answers[question.id];
      if (!answer) return false;
      if (question.type === "essay") return answer.essayText.trim().length > 0;
      // Daftar opsi kosong tetap dihitung terjawab bila soalnya sudah disentuh:
      // itulah jawaban "Salah untuk semua pernyataan" pada soal benar/salah.
      return answer.selectedOptionIds.length > 0 || answer.touched;
    }).length;
  }, [answers, initialState.questions]);

  const flaggedCount = useMemo(
    () => initialState.questions.filter((question) => answers[question.id]?.flagged).length,
    [answers, initialState.questions],
  );

  const value = useMemo<ExamRunnerStore>(
    () => ({
      exam: {
        code: initialState.examCode,
        title: initialState.examTitle,
        subjectLabel: initialState.examSubject,
        instructions: initialState.instructions,
      },
      questions: initialState.questions,
      attempt,
      ready: true,
      saveState,
      answers,
      answerFor,
      setAnswer,
      toggleFlag,
      submit,
      answeredCount,
      flaggedCount,
      progress: initialState.questions.length
        ? (answeredCount / initialState.questions.length) * 100
        : 0,
    }),
    [
      initialState,
      attempt,
      saveState,
      answers,
      answerFor,
      setAnswer,
      toggleFlag,
      submit,
      answeredCount,
      flaggedCount,
    ],
  );

  /*
   * Kejadian integritas (INT-02). Dikirim tanpa menunggu hasil: pencatatan yang
   * gagal tidak boleh mengganggu pengerjaan.
   */
  useEffect(() => {
    const code = initialState.examCode;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        void logAttemptEvent({ code, type: "tab_hidden" });
      }
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        void logAttemptEvent({ code, type: "fullscreen_exit" });
      }
    };

    const onPaste = (event: ClipboardEvent) => {
      // Tempel hanya relevan sebagai sinyal bila terjadi di luar kotak esai.
      const target = event.target as HTMLElement | null;
      if (target?.tagName !== "TEXTAREA" && target?.tagName !== "INPUT") {
        void logAttemptEvent({ code, type: "paste" });
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("paste", onPaste);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("paste", onPaste);
    };
  }, [initialState.examCode]);

  return <ExamRunnerContext.Provider value={value}>{children}</ExamRunnerContext.Provider>;
}

export function useExamRunner() {
  const ctx = useContext(ExamRunnerContext);
  if (!ctx) throw new Error("useExamRunner must be used inside ExamRunnerProvider");
  return ctx;
}
