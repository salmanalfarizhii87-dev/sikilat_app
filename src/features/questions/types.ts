import type { QuestionType } from "@/lib/types";

/**
 * Soal seperti yang boleh dilihat **admin** — termasuk kunci jawaban.
 *
 * Modul ini sengaja terpisah dari `features/attempts` yang melayani peserta:
 * tipe `AttemptQuestion` di sana tidak punya `isCorrect`, `referenceAnswer`,
 * maupun `explanation`, dan perbedaan itu harus terlihat di tipe, bukan hanya
 * di ingatan orang. Kalau satu tipe dipakai bersama, cepat atau lambat ada
 * layar peserta yang menerima kunci jawaban lewat satu properti tambahan.
 */
export interface AdminQuestionOption {
  id: string;
  body: string;
  /** Path di bucket privat; hanya untuk ditandatangani, tidak ditampilkan. */
  mediaPath: string | null;
  /** URL bertanda tangan berumur pendek, `null` bila tidak ada gambar. */
  mediaUrl: string | null;
  isCorrect: boolean;
}

export interface AdminQuestion {
  id: string;
  position: number;
  type: QuestionType;
  body: string;
  passage: string | null;
  mediaPath: string | null;
  mediaUrl: string | null;
  points: number;
  wordMin: number | null;
  wordMax: number | null;
  referenceAnswer: string | null;
  explanation: string | null;
  options: AdminQuestionOption[];
}

/** Soal yang dikirim balik ke server saat menyimpan. */
export interface QuestionSavePayload {
  type: QuestionType;
  body: string;
  passage?: string;
  /**
   * Dipertahankan apa adanya. Editor belum bisa mengunggah gambar (T4.4), dan
   * mengosongkan kolom ini akan menghapus gambar dari 45 soal bank soal.
   */
  mediaPath?: string;
  points: number;
  wordMin?: number;
  wordMax?: number;
  referenceAnswer?: string;
  explanation?: string;
  options: {
    body: string;
    mediaPath?: string;
    isCorrect: boolean;
  }[];
}
