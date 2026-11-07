import { z } from "zod";

/**
 * Skema masukan modul pengerjaan (Fase 5).
 *
 * Batas panjang di sini **mencerminkan constraint database** supaya peserta
 * mendapat pesan yang jelas sebelum perjalanan ke server, bukan galat Postgres
 * mentah. Batas yang sebenarnya tetap ditegakkan database — ini lapisan pertama,
 * bukan satu-satunya.
 */

/** Nama peserta: 2–60 karakter setelah dirapikan (constraint `attempts`). */
const participantName = z
  .string()
  .trim()
  .min(2, "Nama minimal 2 karakter.")
  .max(60, "Nama maksimal 60 karakter.");

const participantClass = z
  .string()
  .trim()
  .max(30, "Kelas maksimal 30 karakter.")
  .optional()
  .transform((value) => (value ? value : undefined));

export const startAttemptSchema = z.object({
  code: z.string().trim().min(1, "Kode ujian wajib diisi."),
  name: participantName,
  className: participantClass,
});

export const resumeAttemptSchema = z.object({
  code: z.string().trim().min(1, "Kode ujian wajib diisi."),
  name: participantName,
  resumeCode: z
    .string()
    .trim()
    .min(4, "Kode Lanjut minimal 4 karakter.")
    .max(12, "Kode Lanjut maksimal 12 karakter."),
});

/**
 * Satu jawaban.
 *
 * `selectedOptionIds` dan `essayText` boleh kosong bersamaan: pada soal
 * benar/salah, "Salah untuk semua pernyataan" adalah jawaban yang sah dan
 * menghasilkan daftar opsi kosong. Yang membedakannya dari "belum dijawab"
 * adalah barisnya ada di database — karena itu aksi ini selalu menulis baris.
 */
export const saveAnswerSchema = z.object({
  code: z.string().trim().min(1),
  questionId: z.string().uuid("Soal tidak dikenali."),
  selectedOptionIds: z.array(z.string().uuid()).max(26).default([]),
  essayText: z.string().max(20_000, "Jawaban terlalu panjang.").default(""),
  flagged: z.boolean().default(false),
});

export const submitAttemptSchema = z.object({
  code: z.string().trim().min(1),
});

/**
 * Kejadian integritas (INT-02).
 *
 * `type` dibatasi daftar tertutup: nilai bebas akan membuat tabel
 * `attempt_events` menjadi tempat sampah teks yang tidak bisa dianalisis.
 */
export const ATTEMPT_EVENT_TYPES = [
  "tab_hidden",
  "fullscreen_exit",
  "paste",
  "resume",
  "start",
  "report",
] as const;

export const logAttemptEventSchema = z.object({
  code: z.string().trim().min(1),
  type: z.enum(ATTEMPT_EVENT_TYPES),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type StartAttemptInput = z.infer<typeof startAttemptSchema>;
export type ResumeAttemptInput = z.infer<typeof resumeAttemptSchema>;
export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;
