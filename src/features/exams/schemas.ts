import { z } from "zod";

import { EXAM_CODE_ALPHABET, EXAM_CODE_MAX_LENGTH, EXAM_CODE_MIN_LENGTH } from "@/lib/constants";
import { jakartaLocalToIso } from "./datetime";

/**
 * Skema ujian (T3.1) — EXM-02 (field), EXM-04 (pengaturan), EXM-05 (visibilitas
 * hasil), EXM-06 (waktu rilis), EXM-08 (syarat publish).
 *
 * Pesan galat berbahasa Indonesia dan menyebut apa yang harus diperbaiki, bukan
 * apa yang gagal di database. Nada kalimat mengikuti DESIGN.md §1: tenang, tidak
 * menyalahkan.
 *
 * Semua skema di sini **memvalidasi bentuk masukan**, bukan aturan yang butuh
 * data lain (mis. "minimal satu soal"). Aturan semacam itu diperiksa di
 * `actions.ts` setelah data tersedia, karena Zod tidak bisa melihat database.
 */

/**
 * Teks opsional: `""` dan spasi saja dianggap **tidak diisi** (`null`).
 *
 * Ini penting karena kolom `subject_label` dan `instructions` boleh `NULL`, dan
 * menyimpan `""` akan membuat UI menampilkan label kosong alih-alih melewatkan
 * barisnya. `null` dan `""` berbeda artinya di sini.
 */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max} karakter.`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

/** Angka dari input teks (`<input type="number">` mengirim string). */
const intFromInput = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `${label} harus berupa angka.` })
    .int(`${label} harus bilangan bulat.`)
    .min(min, `${label} minimal ${min}.`)
    .max(max, `${label} maksimal ${max}.`);

/**
 * Jadwal: nilai `datetime-local` (jam dinding Jakarta) → instan ISO UTC.
 *
 * String kosong berarti "tanpa jadwal" (`null`), bukan tengah malam. Nilai yang
 * tidak sah (mis. `2026-02-31T10:00`) ditolak, bukan digeser ke tanggal lain.
 */
const scheduleField = (label: string) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const iso = jakartaLocalToIso(value);
      if (!iso) {
        ctx.addIssue({
          code: "custom",
          message: `${label} tidak dikenali. Gunakan format tanggal dan jam yang benar.`,
        });
        return z.NEVER;
      }
      return iso;
    })
    .nullable()
    .optional();

/**
 * Isi ujian yang bisa diubah kapan saja (EXM-02, EXM-04, EXM-05, EXM-06).
 *
 * Dipakai `createExamDraft` dan `updateExam`. `updateExam` memakai `.partial()`
 * sehingga pengaturan dan metadata bisa diubah terpisah — itu yang dibutuhkan
 * EXM-09 (setelah ada attempt, hanya metadata tertentu yang boleh berubah).
 */
const examSettingsBase = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul ujian wajib diisi.")
    .max(160, "Judul ujian maksimal 160 karakter."),

  subjectLabel: optionalText(80, "Mata pelajaran"),
  description: optionalText(1000, "Deskripsi"),
  instructions: optionalText(4000, "Instruksi"),

  opensAt: scheduleField("Waktu buka"),
  closesAt: scheduleField("Waktu tutup"),

  // DB: `duration_minutes > 0`. Batas atas 1440 (24 jam) hanya kewarasan —
  // ujian sekolah tidak berjalan lebih lama dari itu, dan nilai sebesar
  // 99999999 hampir pasti salah ketik.
  durationMinutes: intFromInput("Durasi", 1, 1440),
  maxAttempts: intFromInput("Maksimal percobaan", 1, 20),

  scorePolicy: z.enum(["highest", "latest", "first", "average"], {
    error: "Kebijakan nilai akhir tidak dikenali.",
  }),

  /*
   * `null` = tanpa KKM. Berbeda dari 0 yang berarti "semua lulus".
   *
   * `z.coerce.number()` mengubah `""` menjadi **0** — jadi input kosong harus
   * dijadikan `null` lebih dulu. Tanpa `preprocess` ini, mengosongkan kolom KKM
   * diam-diam berarti "semua peserta lulus", kebalikan dari maksud pengguna.
   */
  passingScore: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z.coerce
      .number({ error: "Nilai kelulusan harus berupa angka." })
      .min(0, "Nilai kelulusan minimal 0.")
      .max(100, "Nilai kelulusan maksimal 100.")
      .nullable(),
  ),

  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  askClass: z.boolean(),

  resultVisibility: z.enum(["hidden", "score_only", "score_and_review"], {
    error: "Visibilitas hasil tidak dikenali.",
  }),
  resultRelease: z.enum(["instant", "after_close", "manual"], {
    error: "Waktu rilis hasil tidak dikenali.",
  }),
});

/**
 * EXM-08: "jadwal valid (tutup setelah buka)".
 *
 * Diperiksa di sini, bukan hanya di database, supaya pesannya menunjuk field
 * yang salah. Constraint `closes_at > opens_at` di tabel tetap ada sebagai
 * jaring terakhir.
 */
function checkSchedule(
  value: { opensAt?: string | null; closesAt?: string | null },
  ctx: z.RefinementCtx,
) {
  if (value.opensAt && value.closesAt && value.closesAt <= value.opensAt) {
    ctx.addIssue({
      code: "custom",
      path: ["closesAt"],
      message: "Waktu tutup harus setelah waktu buka.",
    });
  }
}

export const examSettingsSchema = examSettingsBase.superRefine(checkSchedule);

export type ExamSettingsInput = z.infer<typeof examSettingsSchema>;

/**
 * Payload `updateExam`: semua field opsional.
 *
 * Dibangun dari objek **dasar** (sebelum `superRefine`), bukan dari
 * `examSettingsSchema.innerType()`. Di Zod 4 `.partial()` tersedia pada
 * `ZodObject`; mengambilnya lewat `.innerType()` hanya berlaku untuk skema
 * pembungkus dan akan gagal saat versi Zod naik.
 *
 * Konsekuensinya: aturan "tutup setelah buka" tidak otomatis berjalan di sini,
 * karena perubahan bisa hanya berisi salah satu dari dua waktu itu. `actions.ts`
 * menggabungkan baris lama dengan perubahan lebih dulu, lalu memeriksa hasil
 * gabungannya — itulah pemeriksaan yang benar.
 */
export const examUpdateSchema = examSettingsBase.partial();

export type ExamUpdateInput = z.infer<typeof examUpdateSchema>;

/**
 * Kode ujian (EXM-03): 4–10 karakter, huruf besar/angka, tanpa `0/O/1/I`.
 *
 * Alfabet dibatasi ke `EXAM_CODE_ALPHABET` supaya kode yang diketik ulang dari
 * papan tulis atau dibacakan tidak salah baca. Database mengizinkan `0` dan `1`
 * (constraint-nya `^[A-Z0-9]{4,10}$`), tetapi kode yang dibuat aplikasi tidak
 * akan pernah memakainya.
 */
export const examCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(EXAM_CODE_MIN_LENGTH, `Kode ujian minimal ${EXAM_CODE_MIN_LENGTH} karakter.`)
  .max(EXAM_CODE_MAX_LENGTH, `Kode ujian maksimal ${EXAM_CODE_MAX_LENGTH} karakter.`)
  .regex(
    new RegExp(`^[${EXAM_CODE_ALPHABET}]+$`),
    "Kode hanya boleh huruf dan angka, tanpa 0, O, 1, atau I.",
  );

/** Payload `regenerateExamCode`. */
export const regenerateCodeSchema = z.object({
  examId: z.uuid("ID ujian tidak valid."),
  /**
   * Kode pilihan admin; kosong atau tidak dikirim berarti dibuatkan otomatis.
   *
   * `""` dipetakan ke `undefined` lebih dulu: form yang dikosongkan mengirim
   * string kosong, dan tanpa ini pengguna yang mengosongkan kolom kode akan
   * mendapat galat "minimal 4 karakter" alih-alih kode otomatis.
   */
  code: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    examCodeSchema.optional(),
  ),
});

export type RegenerateCodeInput = z.infer<typeof regenerateCodeSchema>;

/** Payload aksi yang hanya butuh satu ID. */
export const examIdSchema = z.object({
  examId: z.uuid("ID ujian tidak valid."),
});

/** Payload `extendCloseTime` (EXM-12): tambahan menit, bukan waktu absolut. */
export const extendCloseSchema = z.object({
  examId: z.uuid("ID ujian tidak valid."),
  minutes: intFromInput("Tambahan waktu", 1, 1440),
});

export type ExtendCloseInput = z.infer<typeof extendCloseSchema>;

/**
 * Payload `deleteExam` (EXM-13).
 *
 * `titleConfirmation` dibandingkan dengan judul ujian di server. Mengandalkan
 * tombol yang dinonaktifkan di UI tidak cukup: Server Action adalah endpoint
 * HTTP, dan siapa pun yang punya sesi admin bisa memanggilnya tanpa UI.
 */
export const deleteExamSchema = z.object({
  examId: z.uuid("ID ujian tidak valid."),
  titleConfirmation: z.string().trim().min(1, "Ketik judul ujian untuk mengonfirmasi."),
});

export type DeleteExamInput = z.infer<typeof deleteExamSchema>;

/**
 * Parameter daftar ujian dari URL (T3.5).
 *
 * URL adalah masukan pengguna, jadi semuanya di-coerce dan dibatasi. Tanpa batas
 * atas, `?pageSize=1000000` akan meminta seluruh tabel sekaligus.
 */
export const EXAM_PAGE_SIZE_DEFAULT = 20;
export const EXAM_PAGE_SIZE_MAX = 100;

export const examListParamsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(EXAM_PAGE_SIZE_MAX)
    .catch(EXAM_PAGE_SIZE_DEFAULT),
  /*
   * Dipotong, bukan dibuang. `.max(100).catch("")` akan mengubah pencarian 101
   * karakter menjadi **tanpa filter sama sekali** — pengguna melihat semua ujian
   * dan menyimpulkan pencariannya tidak berfungsi. Memotong 100 karakter pertama
   * tetap memberi hasil yang masuk akal.
   */
  search: z
    .string()
    .trim()
    .transform((value) => value.slice(0, 100))
    .catch(""),
  status: z.enum(["all", "draft", "published", "archived"]).catch("all"),
});

export type ExamListParamsInput = z.infer<typeof examListParamsSchema>;
