import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ExamStatus } from "@/lib/types";
import {
  EXAM_PAGE_SIZE_DEFAULT,
  examListParamsSchema,
  type ExamListParamsInput,
} from "./schemas";
import type {
  ExamDetail,
  ExamListItem,
  ExamListParams,
  ExamListResult,
  ExamStatusCounts,
  PublicExam,
} from "./types";

/**
 * Query modul ujian (T3.1).
 *
 * Dua jalur akses yang sengaja dipisah:
 *
 * - **Admin** (`listExams`, `getExam`, `getExamStatusCounts`) memakai
 *   `createClient()` â€” klien ber-cookie yang tunduk RLS. Kalau ada bug
 *   otorisasi di kode, RLS masih menolak.
 * - **Peserta** (`getExamByCode`) memakai `createAdminClient()` karena peran
 *   `anon` tidak punya GRANT apa pun. Fungsi ini **wajib** memilih kolom satu per
 *   satu; `select("*")` akan mengirim `created_by` dan kolom internal lain ke
 *   peramban peserta.
 *
 * Tidak ada query di sini yang mengembalikan kolom rahasia soal (`is_correct`,
 * `reference_answer`). Halaman soal memakai modul `features/questions` (Fase 4).
 */

/* -------------------------------------------------------------------------- */
/* Konvensi query key (PRD Â§5.7)                                              */
/* -------------------------------------------------------------------------- */

/**
 * Kunci cache mengikuti PRD Â§5.7 persis, supaya `invalidateQueries` di Server
 * Action mengenai semua turunan tanpa harus tahu halaman mana yang terbuka.
 *
 * `['exams']` adalah prefiks sengaja: membatalkan `['exams']` ikut membatalkan
 * semua kombinasi filter/paginasi.
 */
export const examKeys = {
  all: ["exams"] as const,
  list: (params: ExamListParams) =>
    ["exams", { page: params.page, pageSize: params.pageSize, search: params.search, status: params.status }] as const,
  counts: () => ["exams", "counts"] as const,
  detail: (examId: string) => ["exam", examId] as const,
  questions: (examId: string) => ["exam", examId, "questions"] as const,
} as const;

/* -------------------------------------------------------------------------- */
/* Pembantu                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Saring karakter yang punya arti khusus di PostgREST dan di `ILIKE`.
 *
 * Empat karakter, dan semuanya perlu:
 *
 * 1. `\` adalah karakter escape PostgREST sendiri, jadi harus di-escape lebih
 *    dulu â€” kalau tidak, `\` yang kita sisipkan untuk karakter lain ikut
 *    termakan.
 * 2. `%` dan `_` adalah wildcard `ILIKE`. Membiarkannya berarti pencarian `%`
 *    mengembalikan semua ujian.
 * 3. `*` adalah wildcard `ILIKE` versi PostgREST (padanan `%`). Ini yang paling
 *    mudah terlewat: `*` tidak terlihat seperti wildcard, tetapi PostgREST
 *    menafsirkannya begitu â€” pencarian `*` akan mencocokkan semua baris.
 *
 * Karakter struktur filter (`,` `(` `)` `"`) **tidak** perlu di-escape di sini:
 * `buildSearchFilter` membungkus nilainya dengan tanda kutip, dan di dalam
 * kutip PostgREST memperlakukannya sebagai teks biasa. Itu sudah diuji: cari
 * `,`, `(`, `)`, `"` menghasilkan 0 baris, bukan galat parser.
 */
function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_*]/g, (char) => `\\${char}`);
}

/** Bungkus nilai `or=(...)` dalam tanda kutip ganda, escape kutip di dalamnya. */
function quoteFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Bangun filter pencarian untuk judul, kode, dan mata pelajaran.
 *
 * `*` adalah wildcard `ILIKE` di PostgREST (padanan `%`). Dipakai di sini karena
 * `%` di dalam query string rawan diubah oleh lapisan lain.
 */
function buildSearchFilter(search: string): string | null {
  const term = search.trim();
  if (!term) return null;

  const pattern = quoteFilterValue(`*${escapeLikePattern(term)}*`);
  return [
    `title.ilike.${pattern}`,
    `code.ilike.${pattern}`,
    `subject_label.ilike.${pattern}`,
  ].join(",");
}

/* -------------------------------------------------------------------------- */
/* Pemetaan baris database â†’ tipe modul                                       */
/* -------------------------------------------------------------------------- */

/** Bentuk baris yang dipilih `listExams`. Ditulis eksplisit agar tipenya nyata. */
interface ExamListRow {
  id: string;
  code: string;
  title: string;
  subject_label: string | null;
  status: ExamStatus;
  duration_minutes: number;
  created_at: string;
  questions: { count: number }[];
  attempts: { count: number }[];
}

interface ExamDetailRow extends Omit<ExamListRow, "questions" | "attempts"> {
  description: string | null;
  instructions: string | null;
  opens_at: string | null;
  closes_at: string | null;
  max_attempts: number;
  score_policy: ExamDetail["scorePolicy"];
  passing_score: number | null;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  ask_class: boolean;
  result_visibility: ExamDetail["resultVisibility"];
  result_release: ExamDetail["resultRelease"];
  results_released_at: string | null;
  updated_at: string;
  questions: { count: number }[];
  attempts: { count: number }[];
}

/**
 * `count` dari agregat PostgREST berupa angka, tetapi bila tidak ada baris anak
 * ia tetap mengembalikan `[{ count: 0 }]`. `[0]?.count ?? 0` menangani keduanya
 * sekaligus kasus array kosong yang mungkin muncul di versi PostgREST lain.
 */
function embeddedCount(rows: { count: number }[] | null | undefined): number {
  return rows?.[0]?.count ?? 0;
}

function toListItem(row: ExamListRow): ExamListItem {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    subjectLabel: row.subject_label,
    status: row.status,
    durationMinutes: row.duration_minutes,
    createdAt: row.created_at,
    questionCount: embeddedCount(row.questions),
    attemptCount: embeddedCount(row.attempts),
  };
}

function toDetail(row: ExamDetailRow): ExamDetail {
  return {
    ...toListItem(row),
    description: row.description,
    instructions: row.instructions,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    maxAttempts: row.max_attempts,
    scorePolicy: row.score_policy,
    passingScore: row.passing_score,
    shuffleQuestions: row.shuffle_questions,
    shuffleOptions: row.shuffle_options,
    askClass: row.ask_class,
    resultVisibility: row.result_visibility,
    resultRelease: row.result_release,
    resultsReleasedAt: row.results_released_at,
    updatedAt: row.updated_at,
  };
}

/** Kolom daftar: satu sumber supaya `listExams` dan `getExam` tidak menyimpang. */
const LIST_COLUMNS =
  "id,code,title,subject_label,status,duration_minutes,created_at,questions(count),attempts(count)";

const DETAIL_COLUMNS =
  "id,code,title,subject_label,status,duration_minutes,created_at,updated_at," +
  "description,instructions,opens_at,closes_at,max_attempts,score_policy,passing_score," +
  "shuffle_questions,shuffle_options,ask_class,result_visibility,result_release," +
  "results_released_at,questions(count),attempts(count)";

/* -------------------------------------------------------------------------- */
/* Query admin                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Daftar ujian dengan cari, filter status, dan paginasi (T3.5).
 *
 * Parameter datang dari URL dan bisa saja tidak masuk akal (`page=0`,
 * `status=ngawur`). Skema menormalkannya lewat `.catch()` alih-alih melempar:
 * URL yang aneh harus menampilkan halaman pertama, bukan halaman error 500.
 *
 * `count: "exact"` mengirim `Content-Range` sehingga total baris diketahui tanpa
 * mengambil semuanya. Biayanya satu kali hitung penuh di database â€” untuk skala
 * satu sekolah (ratusan ujian) itu tidak terasa, dan paginasi yang benar butuh
 * angka itu.
 */
export async function listExams(input: Partial<ExamListParamsInput>): Promise<ExamListResult> {
  const params = examListParamsSchema.parse(input);
  const supabase = await createClient();

  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  let query = supabase
    .from("exams")
    .select(LIST_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    // Urutan kedua mencegah baris berpindah halaman saat `created_at` sama
    // (seed membuat beberapa ujian dalam transaksi yang sama).
    .order("id", { ascending: false })
    .range(from, to);

  if (params.status !== "all") query = query.eq("status", params.status);

  const searchFilter = buildSearchFilter(params.search);
  if (searchFilter) query = query.or(searchFilter);

  const { data, error, count } = await query;

  if (error) {
    console.error("[listExams] gagal membaca daftar ujian:", error.message);
    throw new Error("Gagal memuat daftar ujian.");
  }

  const rows = ((data ?? []) as unknown as ExamListRow[]).map(toListItem);

  return {
    rows,
    total: count ?? rows.length,
    page: params.page,
    pageSize: params.pageSize,
  };
}

/**
 * Jumlah ujian per status untuk chip filter (T3.5).
 *
 * Dihitung dengan satu query agregat per status, bukan dengan mengunduh semua
 * baris. `head: true` memakai `HEAD` sehingga hanya header `Content-Range` yang
 * dikirim balik â€” tidak ada data baris yang terbuang.
 */
export async function getExamStatusCounts(): Promise<ExamStatusCounts> {
  const supabase = await createClient();

  const statuses: ExamStatus[] = ["draft", "published", "archived"];

  const results = await Promise.all(
    statuses.map((status) =>
      supabase.from("exams").select("id", { count: "exact", head: true }).eq("status", status),
    ),
  );

  const counts: ExamStatusCounts = { all: 0, draft: 0, published: 0, archived: 0 };

  results.forEach((result, index) => {
    const status = statuses[index];
    if (result.error) {
      // Chip tetap tampil tanpa angka; itu jauh lebih baik daripada seluruh
      // halaman daftar gagal karena satu hitungan.
      console.error(`[getExamStatusCounts] gagal menghitung status ${status}:`, result.error.message);
      return;
    }
    counts[status] = result.count ?? 0;
    counts.all += result.count ?? 0;
  });

  return counts;
}

/**
 * Satu ujian lengkap untuk halaman ringkasan/pengaturan (T3.6).
 *
 * `maybeSingle()` â€” bukan `single()` â€” supaya ID yang tidak ada menghasilkan
 * `null` dan halaman bisa memanggil `notFound()`, bukan melempar error.
 */
export async function getExam(examId: string): Promise<ExamDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("exams")
    .select(DETAIL_COLUMNS)
    .eq("id", examId)
    .maybeSingle();

  if (error) {
    console.error("[getExam] gagal membaca ujian:", error.message);
    throw new Error("Gagal memuat ujian.");
  }

  if (!data) return null;
  return toDetail(data as unknown as ExamDetailRow);
}

/* -------------------------------------------------------------------------- */
/* Query peserta                                                              */
/* -------------------------------------------------------------------------- */

interface PublicExamRow {
  id: string;
  code: string;
  title: string;
  subject_label: string | null;
  description: string | null;
  instructions: string | null;
  status: ExamStatus;
  opens_at: string | null;
  closes_at: string | null;
  duration_minutes: number;
  max_attempts: number;
  passing_score: number | null;
  ask_class: boolean;
  result_visibility: PublicExam["resultVisibility"];
  result_release: PublicExam["resultRelease"];
  questions: { points: number; type: string }[];
}

/**
 * Ujian berdasarkan kode, untuk halaman pra-ujian peserta (tanpa kunci).
 *
 * Memakai service role karena `anon` tidak diberi GRANT pada tabel mana pun
 * (migrasi 0004). Karena itu **kolomnya dipilih satu per satu**: `select("*")`
 * di sini akan mengirim `created_by` dan `results_released_at` ke peramban
 * peserta â€” bukan rahasia negara, tetapi tetap informasi yang tidak perlu.
 *
 * Ujian berstatus `draft` mengembalikan `null`, bukan objek. Peserta tidak
 * seharusnya bisa mengetahui bahwa sebuah draft ada, apalagi judulnya; kalau
 * kode draft bisa ditebak, "belum dibuka" akan membocorkan isi ujian yang belum
 * selesai disusun. Status "belum dibuka" bagi peserta selalu berarti
 * `opens_at` masih di masa depan.
 */
export async function getExamByCode(code: string): Promise<PublicExam | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("exams")
    .select(
      "id,code,title,subject_label,description,instructions,status,opens_at,closes_at," +
        "duration_minutes,max_attempts,passing_score,ask_class,result_visibility,result_release," +
        "questions(points,type)",
    )
    .eq("code", normalized)
    .neq("status", "draft")
    .maybeSingle();

  if (error) {
    console.error("[getExamByCode] gagal membaca ujian:", error.message);
    throw new Error("Gagal memuat ujian.");
  }

  if (!data) return null;

  const row = data as unknown as PublicExamRow;
  const questions = row.questions ?? [];

  return {
    id: row.id,
    code: row.code,
    title: row.title,
    subjectLabel: row.subject_label,
    description: row.description,
    instructions: row.instructions,
    status: row.status,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    durationMinutes: row.duration_minutes,
    maxAttempts: row.max_attempts,
    passingScore: row.passing_score,
    askClass: row.ask_class,
    resultVisibility: row.result_visibility,
    resultRelease: row.result_release,
    questionCount: questions.length,
    totalPoints: questions.reduce((sum, q) => sum + Number(q.points ?? 0), 0),
    essayCount: questions.filter((q) => q.type === "essay").length,
  };
}

/** Normalisasi parameter daftar dari `searchParams` halaman (T3.5). */
export function parseExamListParams(
  raw: Record<string, string | string[] | undefined>,
): ExamListParams {
  const pick = (key: string) => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const parsed = examListParamsSchema.parse({
    page: pick("page") ?? 1,
    pageSize: pick("pageSize") ?? EXAM_PAGE_SIZE_DEFAULT,
    search: pick("search") ?? "",
    status: pick("status") ?? "all",
  });

  return parsed;
}

/* -------------------------------------------------------------------------- */
/* Penguncian (EXM-09)                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Apakah ujian sudah punya attempt.
 *
 * Dipakai halaman soal untuk menentukan `locked` — sebelumnya nilai itu ditulis
 * `const locked = true`, sehingga ujian baru pun tampil terkunci.
 *
 * Diletakkan di sini, bukan di `actions.ts`: berkas ber-`"use server"`
 * mengekspor setiap fungsi sebagai endpoint yang bisa dipanggil peramban, dan
 * pemeriksaan baca-saja tidak perlu menjadi endpoint.
 */
export async function examHasAttempts(examId: string): Promise<boolean> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId);

  if (error) {
    /*
     * Gagal menghitung **tidak boleh** berarti "tidak ada attempt". Kalau
     * dianggap begitu, soal terbuka untuk diedit pada ujian yang sedang
     * berjalan — kesalahan yang merusak data. Aman-nya: anggap terkunci.
     */
    console.error("[examHasAttempts] gagal menghitung attempt:", error.message);
    return true;
  }

  return (count ?? 0) > 0;
}
