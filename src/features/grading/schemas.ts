import { z } from "zod";

/**
 * Skema penilaian (T6.1, T6.4, T6.5, T6.6).
 *
 * Batas poin atas **tidak** ditulis di sini karena bergantung pada soal yang
 * dinilai; `grade_essay` yang memeriksanya terhadap `questions.points`. Menulis
 * batas di dua tempat akan membuat keduanya menyimpang begitu poin soal diubah.
 */

export const gradeEssaySchema = z.object({
  attemptId: z.uuid("ID percobaan tidak valid."),
  questionId: z.uuid("ID soal tidak valid."),
  points: z.coerce
    .number({ error: "Nilai harus berupa angka." })
    .min(0, "Nilai tidak boleh negatif.")
    .max(1000, "Nilai terlalu besar."),
  feedback: z.string().trim().max(2000, "Komentar maksimal 2000 karakter.").optional(),
});

export type GradeEssayInput = z.infer<typeof gradeEssaySchema>;

export const resetAttemptSchema = z.object({
  attemptId: z.uuid("ID percobaan tidak valid."),
  mode: z.enum(["delete", "extra"], { error: "Mode reset tidak dikenali." }),
});

export const releaseResultsSchema = z.object({
  examId: z.uuid("ID ujian tidak valid."),
});
