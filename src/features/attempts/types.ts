/**
 * Tipe modul pengerjaan (Fase 5).
 *
 * Bentuk di sini **mengikuti apa yang benar-benar dikirim RPC**, bukan model
 * demo `src/lib/types.ts`. Bedanya penting:
 *
 * - `mediaPath` (path Storage) bukan `mediaCaption`. Runner harus meminta URL
 *   bertanda tangan ke server; path mentah tidak bisa dibuka peramban.
 * - Tidak ada `correctOptionIds` maupun `referenceAnswer`. RPC memang tidak
 *   pernah mengirimnya, dan tipe yang menyatakan sebaliknya akan membuat
 *   seseorang menulis kode yang mengira kunci jawaban ada di peramban.
 */

import type { AttemptStatus, QuestionType, ResultVisibility, SubmitReason } from "@/lib/types";

/** Satu opsi seperti yang dikirim `get_attempt_state`. */
export interface AttemptOption {
  id: string;
  body: string;
  /** Path di bucket `question-media`; `null` bila opsi tanpa gambar. */
  mediaPath: string | null;
  /**
   * URL bertanda tangan untuk `mediaPath`, diisi lapisan server.
   *
   * `null`/`undefined` berarti opsi ini memang tanpa gambar **atau** gambar
   * gagal ditandatangani. Runner memperlakukan keduanya sama: tidak menampilkan
   * gambar. Path mentah tidak pernah dipakai peramban.
   */
  mediaUrl?: string | null;
}

/** Satu soal seperti yang dikirim `get_attempt_state`. */
export interface AttemptQuestion {
  id: string;
  type: QuestionType;
  body: string;
  passage: string | null;
  mediaPath: string | null;
  /** Lihat catatan `mediaUrl` pada `AttemptOption`. */
  mediaUrl?: string | null;
  points: number;
  wordMin: number | null;
  wordMax: number | null;
  options: AttemptOption[];
}

/** Jawaban tersimpan. Kehadiran entri = soal sudah disentuh peserta. */
export interface AttemptAnswerState {
  selectedOptionIds: string[];
  essayText: string;
  flagged: boolean;
}

/** Seluruh state attempt yang boleh diketahui peserta. */
export interface AttemptState {
  attemptId: string;
  examId: string;
  examCode: string;
  examTitle: string;
  examSubject: string | null;
  instructions: string | null;
  participantName: string;
  participantClass: string | null;
  attemptNo: number;
  /** Kode Lanjut yang ditampilkan ke peserta. */
  resumeCode: string;
  /**
   * Token tautan hasil.
   *
   * Dikirim bersama state supaya peserta yang memuat ulang halaman setelah
   * mengumpulkan tetap bisa diarahkan ke `/hasil/<token>`. Tanpa ini nilainya
   * hanya ada sekali di respons `submit_attempt` lalu hilang.
   */
  resultToken: string;
  status: AttemptStatus;
  startedAt: string;
  expiresAt: string;
  /** Jam server saat state dibaca; dipakai untuk mengoreksi jam perangkat. */
  serverNow: string;
  questions: AttemptQuestion[];
  answers: Record<string, AttemptAnswerState>;
}

/** Hasil `submit_attempt`. */
export interface SubmitResult {
  attemptId: string;
  status: AttemptStatus;
  submittedAt: string | null;
  resultToken: string;
  scoreAuto: number;
  maxScore: number;
}

/** Rincian satu soal pada halaman hasil (`score_and_review`). */
export interface ResultDetail {
  questionId: string;
  body: string;
  type: QuestionType;
  points: number;
  pointsAwarded: number | null;
  isCorrect: boolean | null;
  essayText: string | null;
  feedback: string | null;
  explanation: string | null;
}

/**
 * Hasil ujian seperti yang dikirim `get_result`.
 *
 * `released: false` berarti peserta sudah mengumpulkan tetapi nilainya belum
 * boleh dilihat. Dalam keadaan itu `score` dan `percentage` memang **tidak ada**
 * — bukan nol. Menampilkan 0 akan membuat peserta mengira dirinya gagal.
 */
export interface ResultState {
  examTitle: string;
  participantName: string;
  status: AttemptStatus;
  released: boolean;
  visibility: ResultVisibility;
  releasedAt?: string | null;
  score?: number;
  maxScore?: number;
  percentage?: number | null;
  passingScore?: number | null;
  passed?: boolean | null;
  details?: ResultDetail[] | null;
}

/** Baris peserta untuk monitor/rekap admin. */
export interface AttemptRow {
  id: string;
  participantName: string;
  participantClass: string | null;
  attemptNo: number;
  status: AttemptStatus;
  submitReason: SubmitReason | null;
  startedAt: string;
  submittedAt: string | null;
  expiresAt: string;
  scoreAuto: number;
  scoreManual: number;
  totalScore: number;
  maxScore: number;
  /** Jumlah soal yang sudah punya baris jawaban. */
  answeredCount: number;
  questionCount: number;
  /** Jumlah esai yang belum dinilai (0 bila tidak ada esai). */
  pendingEssayCount: number;
  /** Jumlah kejadian mencurigakan (pindah tab, keluar fullscreen, …). */
  eventCount: number;
}
