"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, validationFail, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { gradeEssaySchema, releaseResultsSchema, resetAttemptSchema } from "./schemas";

/**
 * Server Actions penilaian (T6.1, T6.4, T6.5, T6.6).
 *
 * Semua memakai klien **ber-cookie** (`createClient()`), bukan service role.
 * Ini bukan preferensi gaya: `grade_essay`, `reset_attempt`, dan
 * `release_results` memanggil `assert_admin()`, yang membaca `auth.uid()`. Service
 * role tidak punya `auth.uid()`, sehingga panggilan lewat klien itu akan gagal
 * `FORBIDDEN` (42501) — dan sebelum itu, ia juga melewati RLS yang seharusnya
 * menjadi pengaman terakhir.
 *
 * Nilai akhir tetap dihitung database (`hitung_dan_publikasikan`), bukan di sini.
 */

const EXAMS_PATH = "/admin/exams";

function mapRpcError(error: {
  code?: string;
  message: string;
  details?: string | null;
}): ActionResult<never> {
  const message = error.message.trim();

  if (message === "NOT_FOUND" || error.code === "P0002") {
    return fail("NOT_FOUND", "Data yang dinilai tidak ditemukan.");
  }

  if (message === "FORBIDDEN" || error.code === "42501") {
    return fail("FORBIDDEN", "Akun ini tidak berhak menilai ujian ini.");
  }

  if (message === "VALIDATION" || error.code === "22023") {
    return fail("VALIDATION", error.details?.trim() || "Nilai yang dikirim tidak sah.");
  }

  console.error("[grading] kesalahan RPC:", error.code, message);
  return fail("INTERNAL", "Gagal menyimpan nilai. Coba lagi sebentar lagi.");
}

/**
 * Simpan nilai satu jawaban esai (T6.1).
 *
 * Status attempt **tidak** dipaksa menjadi `graded` di sini: `grade_essay`
 * (migrasi 0023) membiarkan attempt tetap `in_progress` selama peserta masih
 * mengerjakan. Kalau fungsi itu menutup attempt lebih awal, `submit_attempt`
 * akan melewati penilaian otomatis dan peserta menerima 0 untuk seluruh soal
 * objektif.
 */
export async function gradeEssay(
  input: unknown,
): Promise<ActionResult<{ pendingEssay: number; scoreManual: number }>> {
  const parsed = gradeEssaySchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("grade_essay", {
    p_attempt_id: parsed.data.attemptId,
    p_question_id: parsed.data.questionId,
    p_points: parsed.data.points,
    p_feedback: parsed.data.feedback && parsed.data.feedback !== "" ? parsed.data.feedback : undefined,
  });

  if (error) return mapRpcError(error);

  const result = data as unknown as { pendingEssay: number; scoreManual: number };

  revalidatePath(`${EXAMS_PATH}/-/grading/${parsed.data.attemptId}`);
  return ok({
    pendingEssay: Number(result.pendingEssay),
    scoreManual: Number(result.scoreManual),
  });
}

/** Hapus attempt agar peserta bisa mengerjakan ulang (T6.5, GRD-04). */
export async function resetAttempt(
  input: unknown,
): Promise<ActionResult<{ deleted: true; mode: "delete" | "extra" }>> {
  const parsed = resetAttemptSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const supabase = await createClient();

  const { error } = await supabase.rpc("reset_attempt", {
    p_attempt_id: parsed.data.attemptId,
    p_mode: parsed.data.mode,
  });

  if (error) return mapRpcError(error);

  return ok({ deleted: true, mode: parsed.data.mode });
}

/**
 * Rilis hasil ujian secara manual (T6.6, GRD-05).
 *
 * Mengisi `exams.results_released_at`. Peserta dengan `result_release = manual`
 * baru melihat skor setelah kolom itu terisi — aturan itu ditegakkan `get_result`
 * di database, bukan di halaman hasil.
 */
export async function releaseResults(
  examId: unknown,
): Promise<ActionResult<{ releasedAt: string }>> {
  const parsed = releaseResultsSchema.safeParse({ examId });
  if (!parsed.success) return validationFail(parsed.error);

  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("release_results", {
    p_exam_id: parsed.data.examId,
  });

  if (error) return mapRpcError(error);

  const result = data as unknown as { releasedAt: string };

  revalidatePath(`${EXAMS_PATH}/${parsed.data.examId}`);
  revalidatePath(`${EXAMS_PATH}/${parsed.data.examId}/results`);

  return ok({ releasedAt: result.releasedAt });
}
