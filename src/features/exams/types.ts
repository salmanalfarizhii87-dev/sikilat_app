import type {
  ExamStatus,
  ResultRelease,
  ResultVisibility,
  ScorePolicy,
} from "@/lib/types";

/**
 * Tipe modul ujian (T3.1).
 *
 * Tipe di sini mengikuti **bentuk database apa adanya** (nullable, snake_case
 * sudah dipetakan ke camelCase) alih-alih memakai `Exam` di `src/lib/types.ts`.
 * Alasannya: `Exam` adalah model demo yang dibuat sebelum skema ada, sehingga
 * ia menyatakan `subjectLabel`, `instructions`, dan `passingScore` sebagai wajib
 * padahal di database ketiganya boleh `NULL`. Memaksa `NULL` menjadi `""` atau
 * `0` akan mengubah arti data: `passing_score = NULL` berarti "tanpa KKM",
 * bukan "KKM 0" — dan 0 berarti **semua peserta lulus**. Perbedaan itu tidak
 * boleh hilang di lapisan tipe.
 *
 * `src/lib/types.ts` tetap dipakai komponen yang belum tersambung server
 * (runner peserta, dsb.) sampai fase berikutnya memindahkannya.
 */

/** Baris ringkas untuk daftar ujian (T3.5). */
export interface ExamListItem {
  id: string;
  code: string;
  title: string;
  subjectLabel: string | null;
  status: ExamStatus;
  durationMinutes: number;
  createdAt: string;
  questionCount: number;
  attemptCount: number;
}

/** Satu baris ujian lengkap, untuk halaman ringkasan/pengaturan. */
export interface ExamDetail {
  id: string;
  code: string;
  title: string;
  subjectLabel: string | null;
  description: string | null;
  instructions: string | null;
  status: ExamStatus;
  opensAt: string | null;
  closesAt: string | null;
  durationMinutes: number;
  maxAttempts: number;
  scorePolicy: ScorePolicy;
  /** `null` = tanpa KKM. Bukan 0. */
  passingScore: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  askClass: boolean;
  resultVisibility: ResultVisibility;
  resultRelease: ResultRelease;
  resultsReleasedAt: string | null;
  createdAt: string;
  updatedAt: string;
  questionCount: number;
  attemptCount: number;
}

/**
 * Ujian seperti yang boleh dilihat **peserta** (halaman pra-ujian).
 *
 * Tidak memuat `created_by`, `results_released_at`, maupun kolom rahasia soal.
 * Daftar kolomnya sengaja ditulis eksplisit di `queries.ts` — memilih `*` lalu
 * menyaring di JavaScript berarti kolom rahasia tetap terkirim melewati jaringan.
 */
export interface PublicExam {
  id: string;
  code: string;
  title: string;
  subjectLabel: string | null;
  description: string | null;
  instructions: string | null;
  status: ExamStatus;
  opensAt: string | null;
  closesAt: string | null;
  durationMinutes: number;
  maxAttempts: number;
  passingScore: number | null;
  askClass: boolean;
  resultVisibility: ResultVisibility;
  resultRelease: ResultRelease;
  questionCount: number;
  totalPoints: number;
  essayCount: number;
}

/** Parameter daftar ujian (PRD §8.3). */
export interface ExamListParams {
  page: number;
  pageSize: number;
  search: string;
  status: ExamStatus | "all";
}

/** Bentuk respons daftar (PRD §8.3). */
export interface ExamListResult {
  rows: ExamListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** Jumlah ujian per status, untuk chip filter. */
export type ExamStatusCounts = Record<ExamStatus | "all", number>;
