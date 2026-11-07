import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { QuestionType } from "@/lib/types";
import type { AdminQuestion, AdminQuestionOption } from "./types";

/**
 * Query soal untuk admin (T3.9, T4.2).
 *
 * Berbeda dari `features/attempts/queries.ts` yang melayani peserta, fungsi di
 * sini **memang** mengembalikan kunci jawaban — admin membutuhkannya untuk
 * menyunting. Karena itu ia memakai klien ber-cookie (RLS `is_admin()`), bukan
 * service role: kalau ada bug otorisasi di lapisan atas, database tetap menolak.
 *
 * Satu-satunya pemakaian service role di sini adalah menandatangani URL gambar,
 * karena bucket `question-media` privat dan `authenticated` tidak punya policy
 * baca (keputusan K9). Yang ditandatangani hanya path yang sudah lolos RLS.
 */

/** Umur URL bertanda tangan di editor. Cukup untuk satu sesi menyunting. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

interface QuestionDbRow {
  id: string;
  position: number;
  type: QuestionType;
  body: string;
  passage: string | null;
  media_path: string | null;
  points: number;
  word_min: number | null;
  word_max: number | null;
  reference_answer: string | null;
  explanation: string | null;
  question_options: {
    id: string;
    position: number;
    body: string;
    media_path: string | null;
    is_correct: boolean;
  }[];
}

const QUESTION_COLUMNS =
  "id,position,type,body,passage,media_path,points,word_min,word_max,reference_answer," +
  "explanation,question_options(id,position,body,media_path,is_correct)";

/**
 * Seluruh soal sebuah ujian, urut `position`, beserta URL gambar bertanda tangan.
 *
 * `null` bila ujian tidak ada atau tidak terlihat RLS. Halaman memakai `null`
 * untuk `notFound()`; daftar kosong berarti ujian benar-benar belum punya soal.
 */
export async function getExamQuestions(examId: string): Promise<AdminQuestion[] | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("questions")
    .select(QUESTION_COLUMNS)
    .eq("exam_id", examId)
    .order("position", { ascending: true });

  if (error) {
    console.error("[getExamQuestions] gagal membaca soal:", error.message);
    throw new Error("Gagal memuat soal ujian.");
  }

  const rows = (data ?? []) as unknown as QuestionDbRow[];

  const urlByPath = await signMedia(rows);

  return rows.map((row) => ({
    id: row.id,
    position: row.position,
    type: row.type,
    body: row.body,
    passage: row.passage,
    mediaPath: row.media_path,
    mediaUrl: row.media_path ? (urlByPath.get(row.media_path) ?? null) : null,
    points: Number(row.points),
    wordMin: row.word_min,
    wordMax: row.word_max,
    referenceAnswer: row.reference_answer,
    explanation: row.explanation,
    options: [...(row.question_options ?? [])]
      .sort((a, b) => a.position - b.position)
      .map(
        (option): AdminQuestionOption => ({
          id: option.id,
          body: option.body,
          mediaPath: option.media_path,
          mediaUrl: option.media_path ? (urlByPath.get(option.media_path) ?? null) : null,
          isCorrect: option.is_correct,
        }),
      ),
  }));
}

/**
 * Tandatangani seluruh `media_path` yang muncul di soal dan opsi.
 *
 * Kegagalan menandatangani tidak menggagalkan halaman: soal tetap tampil tanpa
 * pratinjau gambar, dan admin masih bisa menyunting teksnya. Yang **tidak**
 * boleh terjadi adalah menghapus `media_path` karena URL-nya gagal dibuat —
 * itu sebabnya path asli tetap dibawa di objek terpisah.
 */
async function signMedia(rows: QuestionDbRow[]): Promise<Map<string, string>> {
  const paths = new Set<string>();
  for (const row of rows) {
    if (row.media_path) paths.add(row.media_path);
    for (const option of row.question_options ?? []) {
      if (option.media_path) paths.add(option.media_path);
    }
  }

  if (paths.size === 0) return new Map();

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from("question-media")
    .createSignedUrls([...paths], SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.error("[getExamQuestions] gagal menandatangani gambar:", error.message);
    return new Map();
  }

  const map = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return map;
}
