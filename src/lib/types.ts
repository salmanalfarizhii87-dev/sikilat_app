export type ExamStatus = "draft" | "published" | "archived";
export type QuestionType = "mcq_single" | "mcq_multiple" | "true_false" | "essay";
export type AttemptStatus = "in_progress" | "needs_grading" | "graded";
export type ScorePolicy = "highest" | "latest" | "first" | "average";
export type ResultVisibility = "hidden" | "score_only" | "score_and_review";
export type ResultRelease = "instant" | "after_close" | "manual";
export type SubmitReason = "manual" | "timeout" | "admin";

export interface Option {
  id: string;
  position: number;
  body: string;
}

export interface Question {
  id: string;
  examId: string;
  position: number;
  type: QuestionType;
  body: string;
  /**
   * Teks bacaan bersama. Hanya dipakai soal berbasis teks (mis. Bahasa
   * Indonesia); null untuk soal yang tidak memerlukannya.
   */
  passage?: string;
  mediaCaption?: string;
  points: number;
  options: Option[];
  correctOptionIds: string[];
  wordMin?: number;
  wordMax?: number;
  referenceAnswer?: string;
  explanation?: string;
}

export interface Exam {
  id: string;
  code: string;
  title: string;
  subjectLabel: string;
  description?: string;
  instructions: string;
  status: ExamStatus;
  opensAt?: string;
  closesAt?: string;
  durationMinutes: number;
  maxAttempts: number;
  scorePolicy: ScorePolicy;
  passingScore: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  askClass: boolean;
  resultVisibility: ResultVisibility;
  resultRelease: ResultRelease;
  resultsReleasedAt?: string;
  createdAt: string;
}

export interface AttemptAnswer {
  questionId: string;
  selectedOptionIds: string[];
  essayText: string;
  flagged: boolean;
  crossouts: string[];
  /**
   * Peserta sudah menyentuh soal ini.
   *
   * Diperlukan karena soal Benar/Salah bisa dijawab "Salah" untuk semua
   * pernyataan, dan jawaban itu menghasilkan `selectedOptionIds` kosong — sama
   * persis dengan soal yang belum dijawab. Tanpa penanda ini, soal yang sudah
   * dijawab penuh akan tampil sebagai "kosong" di navigasi dan ikut dihitung
   * sebagai belum dijawab pada peringatan sebelum kirim.
   */
  touched?: boolean;
  updatedAt: string;
}

export interface Attempt {
  id: string;
  examId: string;
  participantName: string;
  participantClass?: string;
  attemptNo: number;
  status: AttemptStatus;
  submitReason?: SubmitReason;
  startedAt: string;
  expiresAt: string;
  submittedAt?: string;
  questionOrder: string[];
  answers: Record<string, AttemptAnswer>;
  scoreAuto: number;
  scoreManual: number;
  maxScore: number;
  resumeCode: string;
  resultToken: string;
  events: AttemptEvent[];
}

export interface AttemptEvent {
  id: string;
  type: "tab_hidden" | "fullscreen_exit" | "paste" | "start" | "submit" | "resume";
  at: string;
}

export interface ResultSummary {
  attempt: Attempt;
  exam: Exam;
  questions: Question[];
  percentage: number;
  passed: boolean;
}
