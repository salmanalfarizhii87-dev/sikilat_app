/**
 * Nilai enum yang dipakai bersama klien dan server.
 *
 * Berkas ini dulu juga memuat model `Exam`, `Question`, `Attempt`, dan
 * `ResultSummary` — sisa dari masa sebelum skema database ada. Model-model itu
 * sudah dihapus karena setiap halaman sekarang membaca tipe dari modul
 * fiturnya masing-masing (`features/exams/types.ts`, `features/questions/types.ts`,
 * `features/attempts/types.ts`), dan model lama menyatakan beberapa kolom wajib
 * padahal di database boleh `NULL` — `passing_score` misalnya: `NULL` berarti
 * "tanpa KKM", dan memaksanya menjadi `0` akan berarti "semua peserta lulus".
 *
 * Enum tetap di sini karena nilainya identik di kedua sisi dan berasal langsung
 * dari tipe enum Postgres (migrasi 0001).
 */

export type ExamStatus = "draft" | "published" | "archived";
export type QuestionType = "mcq_single" | "mcq_multiple" | "true_false" | "essay";
export type AttemptStatus = "in_progress" | "needs_grading" | "graded";
export type ScorePolicy = "highest" | "latest" | "first" | "average";
export type ResultVisibility = "hidden" | "score_only" | "score_and_review";
export type ResultRelease = "instant" | "after_close" | "manual";
export type SubmitReason = "manual" | "timeout" | "admin";
