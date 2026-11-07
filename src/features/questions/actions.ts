"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, validationFail, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { saveQuestionsSchema } from "./schemas";

/**
 * Server Action soal (T4.1, T4.2).
 *
 * Satu aksi untuk seluruh daftar soal, bukan `createQuestion`/`updateQuestion`/
 * `deleteQuestion`/`reorderQuestions` terpisah seperti di rencana awal. Alasannya
 * ada di migrasi `0025`: menyimpan editor berarti menghapus, menambah, dan
 * mengurutkan ulang sekaligus, dan rangkaian permintaan terpisah bisa berhenti di
 * tengah jalan. Satu aksi = satu transaksi.
 *
 * Penguncian EXM-09 diperiksa **di dalam RPC**, bukan di sini. Pemeriksaan di
 * aplikasi hanya untuk memberi pesan lebih awal; yang mengikat adalah yang
 * berjalan di transaksi yang sama dengan penulisan.
 */

const EXAMS_PATH = "/admin/exams";

/** Petakan galat RPC menjadi kode aplikasi. */
function mapRpcError(error: {
  code?: string;
  message: string;
  details?: string | null;
}): ActionResult<never> {
  const message = error.message.trim();

  if (message === "EXAM_LOCKED") {
    return fail("CONFLICT", "Ujian ini sudah punya percobaan, jadi soal tidak bisa diubah lagi.");
  }

  if (message === "NOT_FOUND" || error.code === "P0002") {
    return fail("NOT_FOUND", "Ujian tidak ditemukan.");
  }

  if (message === "FORBIDDEN" || error.code === "42501") {
    return fail("FORBIDDEN", "Akun ini tidak berhak mengubah soal ujian ini.");
  }

  if (message === "VALIDATION" || error.code === "22023") {
    /*
     * RPC memakai `detail` untuk menyebut soal nomor berapa yang salah. Pesan
     * itu jauh lebih berguna daripada "data tidak valid", jadi diteruskan.
     */
    return fail("VALIDATION", error.details?.trim() || "Ada isian soal yang belum benar.");
  }

  console.error("[questions] kesalahan database:", error.code, message);
  return fail("INTERNAL", "Gagal menyimpan soal. Coba lagi sebentar lagi.");
}

/**
 * Ganti seluruh soal sebuah ujian.
 *
 * Validasi Zod berjalan lebih dulu supaya kesalahan bentuk tidak pernah sampai
 * ke database. Pemeriksaan yang butuh data lain (mis. "sudah ada attempt?")
 * tetap di RPC.
 */
export async function saveExamQuestions(
  examId: unknown,
  questions: unknown,
): Promise<ActionResult<{ questions: number; options: number }>> {
  const parsed = saveQuestionsSchema.safeParse({ examId, questions });
  if (!parsed.success) return validationFail(parsed.error);

  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("save_exam_questions", {
    p_exam_id: parsed.data.examId,
    p_questions: parsed.data.questions as unknown as never,
  });

  if (error) return mapRpcError(error);

  const result = data as unknown as { questions: number; options: number };

  revalidatePath(`${EXAMS_PATH}/${parsed.data.examId}`);
  revalidatePath(`${EXAMS_PATH}/${parsed.data.examId}/questions`);
  revalidatePath(EXAMS_PATH);

  return ok({ questions: Number(result.questions), options: Number(result.options) });
}
