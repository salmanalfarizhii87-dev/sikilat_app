"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Attempt, AttemptAnswer, Exam, Question } from "@/lib/types";
import { demoExam, demoQuestions } from "@/lib/mock-data";
import { useMounted } from "@/lib/client-hooks";

const STORAGE_KEY = "kilat_attempt_v1";
const IDENTITY_KEY = "kilat_participant";

interface PersistedState {
  attempt: Attempt | null;
  exam: Exam | null;
}

interface ExamRunnerStore {
  exam: Exam;
  questions: Question[];
  attempt: Attempt | null;
  ready: boolean;
  answerFor: (questionId: string) => AttemptAnswer | undefined;
  setAnswer: (questionId: string, patch: Partial<AttemptAnswer>) => void;
  toggleFlag: (questionId: string) => void;
  toggleCrossout: (questionId: string, optionId: string) => void;
  start: (name: string, className?: string) => void;
  submit: (reason: "manual" | "timeout") => void;
  reset: () => void;
  answeredCount: number;
  flaggedCount: number;
  progress: number;
}

const ExamRunnerContext = createContext<ExamRunnerStore | null>(null);

/**
 * Kode Lanjut dibuat unik per attempt. Sebelumnya nilainya tetap "K7M2QP"
 * untuk semua orang, sehingga kode apa pun bisa dipakai masuk.
 */
function makeResumeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function makeAttempt(
  name: string,
  className: string | undefined,
  exam: Exam,
  questions: Question[],
): Attempt {
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + exam.durationMinutes * 60_000);
  return {
    id: "att_local",
    examId: exam.id,
    participantName: name,
    participantClass: className,
    attemptNo: 1,
    status: "in_progress",
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    questionOrder: questions.map((q) => q.id),
    answers: {},
    scoreAuto: 0,
    scoreManual: 0,
    maxScore: questions.reduce((sum, q) => sum + q.points, 0),
    resumeCode: makeResumeCode(),
    resultToken: "demo-result-token",
    events: [{ id: "e1", type: "start", at: startedAt.toISOString() }],
  };
}

/**
 * Reads the persisted attempt for this exam, or bootstraps a fresh one from the
 * identity captured on the pre-exam screen. Runs only in the browser; the caller
 * guards rendering with `ready` so SSR and hydration always match.
 */
function loadAttempt(exam: Exam, questions: Question[]): Attempt | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.attempt && parsed.attempt.examId === exam.id) return parsed.attempt;
    }
    const identityRaw = window.localStorage.getItem(IDENTITY_KEY);
    const identity = identityRaw
      ? (JSON.parse(identityRaw) as { name?: string; className?: string })
      : null;
    return makeAttempt(
      identity?.name?.trim() || "Peserta",
      identity?.className?.trim() || undefined,
      exam,
      questions,
    );
  } catch {
    return null;
  }
}

export function ExamRunnerProvider({
  children,
  exam = demoExam,
  questions = demoQuestions,
  resumeCode,
}: {
  children: React.ReactNode;
  exam?: Exam;
  questions?: Question[];
  resumeCode?: string;
}) {
  const mounted = useMounted();

  // The attempt is loaded lazily on the client only. During SSR (and during the
  // hydration render) `mounted` is false and the caller renders a skeleton, so
  // the markup still matches even though this value is computed differently.
  const [attempt, setAttempt] = useState<Attempt | null>(() =>
    typeof window === "undefined" ? null : loadAttempt(exam, questions),
  );

  useEffect(() => {
    if (!mounted) return;
    try {
      if (attempt) {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ attempt, exam } satisfies PersistedState),
        );
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // storage full or blocked
    }
  }, [attempt, exam, mounted]);

  const setAnswer = useCallback((questionId: string, patch: Partial<AttemptAnswer>) => {
    setAttempt((prev) => {
      if (!prev) return prev;
      const existing: AttemptAnswer =
        prev.answers[questionId] ??
        {
          questionId,
          selectedOptionIds: [],
          essayText: "",
          flagged: false,
          crossouts: [],
          updatedAt: new Date().toISOString(),
        };
      return {
        ...prev,
        answers: {
          ...prev.answers,
          [questionId]: { ...existing, ...patch, updatedAt: new Date().toISOString() },
        },
      };
    });
  }, []);

  const toggleFlag = useCallback((questionId: string) => {
    setAttempt((prev) => {
      if (!prev) return prev;
      const existing: AttemptAnswer =
        prev.answers[questionId] ??
        {
          questionId,
          selectedOptionIds: [],
          essayText: "",
          flagged: false,
          crossouts: [],
          updatedAt: new Date().toISOString(),
        };
      return {
        ...prev,
        answers: {
          ...prev.answers,
          [questionId]: {
            ...existing,
            flagged: !existing.flagged,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  }, []);

  const toggleCrossout = useCallback((questionId: string, optionId: string) => {
    setAttempt((prev) => {
      if (!prev) return prev;
      const existing: AttemptAnswer =
        prev.answers[questionId] ??
        {
          questionId,
          selectedOptionIds: [],
          essayText: "",
          flagged: false,
          crossouts: [],
          updatedAt: new Date().toISOString(),
        };
      const crossouts = existing.crossouts.includes(optionId)
        ? existing.crossouts.filter((id) => id !== optionId)
        : [...existing.crossouts, optionId];
      return {
        ...prev,
        answers: {
          ...prev.answers,
          [questionId]: { ...existing, crossouts, updatedAt: new Date().toISOString() },
        },
      };
    });
  }, []);

  const start = useCallback(
    (name: string, className?: string) => {
      setAttempt(makeAttempt(name, className, exam, questions));
    },
    [exam, questions],
  );

  const submit = useCallback(
    (reason: "manual" | "timeout") => {
      setAttempt((prev) => {
        if (!prev) return prev;
        let auto = 0;
        for (const q of questions) {
          const ans = prev.answers[q.id];
          if (!ans) continue;
          if (q.type === "essay") continue;
          const selected = [...ans.selectedOptionIds].sort().join(",");
          const correct = [...q.correctOptionIds].sort().join(",");
          if (selected && selected === correct) auto += q.points;
        }
        const hasEssay = questions.some((q) => q.type === "essay");
        return {
          ...prev,
          status: hasEssay ? "needs_grading" : "graded",
          submitReason: reason,
          submittedAt: new Date().toISOString(),
          scoreAuto: auto,
          events: [
            ...prev.events,
            { id: `e${prev.events.length + 1}`, type: "submit", at: new Date().toISOString() },
          ],
        };
      });
    },
    [questions],
  );

  const reset = useCallback(() => {
    setAttempt(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // noop
    }
  }, []);

  const answerFor = useCallback(
    (questionId: string) => attempt?.answers[questionId],
    [attempt],
  );

  const answeredCount = useMemo(() => {
    if (!attempt) return 0;
    return questions.filter((q) => {
      const ans = attempt.answers[q.id];
      if (!ans) return false;
      if (q.type === "essay") return ans.essayText.trim().length > 0;
      return ans.selectedOptionIds.length > 0;
    }).length;
  }, [attempt, questions]);

  const flaggedCount = useMemo(() => {
    if (!attempt) return 0;
    return questions.filter((q) => attempt.answers[q.id]?.flagged).length;
  }, [attempt, questions]);

  const value = useMemo<ExamRunnerStore>(
    () => ({
      exam,
      questions,
      attempt: mounted && attempt ? { ...attempt, resumeCode: resumeCode ?? attempt.resumeCode } : null,
      ready: mounted,
      answerFor,
      setAnswer,
      toggleFlag,
      toggleCrossout,
      start,
      submit,
      reset,
      answeredCount,
      flaggedCount,
      progress: questions.length ? (answeredCount / questions.length) * 100 : 0,
    }),
    [
      exam,
      questions,
      attempt,
      mounted,
      resumeCode,
      answerFor,
      setAnswer,
      toggleFlag,
      toggleCrossout,
      start,
      submit,
      reset,
      answeredCount,
      flaggedCount,
    ],
  );

  return <ExamRunnerContext.Provider value={value}>{children}</ExamRunnerContext.Provider>;
}

export function useExamRunner() {
  const ctx = useContext(ExamRunnerContext);
  if (!ctx) throw new Error("useExamRunner must be used inside ExamRunnerProvider");
  return ctx;
}
