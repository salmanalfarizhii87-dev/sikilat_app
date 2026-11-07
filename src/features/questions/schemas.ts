import { z } from "zod";

/**
 * Skema penyimpanan soal (T4.1).
 *
 * Batasnya mengikuti kolom database (`points numeric(6,2)`, `body text`), bukan
 * angka karangan: batas yang lebih ketat dari database akan menolak data yang
 * sebenarnya sah, dan batas yang lebih longgar hanya memindahkan galat ke
 * pesan Postgres yang tidak bisa ditampilkan per field.
 *
 * Pesan galat menyebut nomor soal. Tanpa itu, admin yang menyimpan 30 soal
 * hanya melihat "opsi masih kosong" dan harus menebak soal mana.
 */

const MAX_QUESTIONS = 500;
const MAX_OPTIONS = 10;

const optionSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Teks opsi tidak boleh kosong.")
    .max(2000, "Teks opsi maksimal 2000 karakter."),
  mediaPath: z.string().trim().max(500).optional(),
  isCorrect: z.boolean(),
});

export const questionInputSchema = z
  .object({
    type: z.enum(["mcq_single", "mcq_multiple", "true_false", "essay"], {
      error: "Tipe soal tidak dikenali.",
    }),
    body: z
      .string()
      .trim()
      .min(1, "Pertanyaan wajib diisi.")
      .max(10000, "Pertanyaan maksimal 10000 karakter."),
    passage: z.string().trim().max(20000, "Teks bacaan maksimal 20000 karakter.").optional(),
    mediaPath: z.string().trim().max(500).optional(),
    points: z.coerce
      .number({ error: "Poin harus berupa angka." })
      .positive("Poin harus lebih dari 0.")
      .max(100, "Poin maksimal 100."),
    wordMin: z.coerce.number().int().min(0).max(10000).optional(),
    wordMax: z.coerce.number().int().min(0).max(10000).optional(),
    referenceAnswer: z.string().trim().max(5000).optional(),
    explanation: z.string().trim().max(5000).optional(),
    options: z.array(optionSchema).max(MAX_OPTIONS, `Maksimal ${MAX_OPTIONS} opsi per soal.`),
  })
  .superRefine((value, ctx) => {
    if (value.type === "essay") {
      if (value.options.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: "Soal esai tidak punya opsi jawaban.",
        });
      }
      if (value.wordMin !== undefined && value.wordMax !== undefined && value.wordMax < value.wordMin) {
        ctx.addIssue({
          code: "custom",
          path: ["wordMax"],
          message: "Batas kata maksimal tidak boleh lebih kecil dari minimal.",
        });
      }
      return;
    }

    if (value.options.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Minimal dua opsi jawaban.",
      });
      return;
    }

    const correct = value.options.filter((option) => option.isCorrect).length;

    if (correct === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Belum ada kunci jawaban.",
      });
      return;
    }

    /*
     * `mcq_single` hanya boleh punya satu kunci. Peserta hanya bisa memilih satu
     * opsi, jadi dua kunci membuat soal itu mustahil dijawab benar — dan
     * penilaian "semua benar" akan menilainya salah selamanya.
     */
    if (value.type === "mcq_single" && correct > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Pilihan ganda satu jawaban hanya boleh punya satu kunci.",
      });
    }
  });

export type QuestionInput = z.infer<typeof questionInputSchema>;

export const saveQuestionsSchema = z.object({
  examId: z.uuid("ID ujian tidak valid."),
  questions: z
    .array(questionInputSchema)
    .max(MAX_QUESTIONS, `Maksimal ${MAX_QUESTIONS} soal per ujian.`),
});

export type SaveQuestionsInput = z.infer<typeof saveQuestionsSchema>;
