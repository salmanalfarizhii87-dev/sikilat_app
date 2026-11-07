"use server";

import { headers } from "next/headers";

import { fail, ok, validationFail, type ActionResult, type ErrorCode } from "@/lib/action-result";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/features/auth/rate-limit";
import {
  generateAttemptToken,
  hashAttemptToken,
  readAttemptTokenHash,
  writeAttemptCookie,
  clearAttemptCookie,
} from "@/lib/participant-session";
import {
  logAttemptEventSchema,
  resumeAttemptSchema,
  saveAnswerSchema,
  startAttemptSchema,
  submitAttemptSchema,
} from "./schemas";
import type { AttemptState, SubmitResult } from "./types";

/**
 * Server Actions peserta (Fase 5).
 *
 * Semua aksi di sini memakai `createAdminClient()` karena `execute` RPC peserta
 * sudah dicabut dari `anon`/`authenticated` (migrasi 0007). Otorisasi tidak
 * hilang karena itu: identitas peserta adalah **cookie** yang hanya bisa dibaca
 * server, dan setiap RPC memverifikasi `token_hash` yang diturunkan dari cookie
 * tersebut. Peramban tidak pernah mengirim token sendiri.
 *
 * Aturan yang dipegang di seluruh berkas:
 * - Token mentah tidak pernah dikembalikan ke klien. Yang dikirim balik hanya
 *   data yang memang boleh dilihat peserta.
 * - Tidak ada perhitungan nilai di sini. Skor dihitung database.
 */

/* -------------------------------------------------------------------------- */
/* Pemetaan galat                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Kode error yang di-`raise` RPC sebagai teks pesan.
 *
 * `raise exception 'EXAM_CLOSED' using errcode = '22023'` membuat PostgREST
 * mengirim `message = 'EXAM_CLOSED'` dengan SQLSTATE `22023`. SQLSTATE saja tidak
 * cukup untuk membedakan `EXAM_NOT_OPEN` dari `ATTEMPT_EXPIRED` — keduanya
 * 22023 — jadi pesannya yang dibaca lebih dulu.
 */
const PG_MESSAGE_CODES: Record<string, ErrorCode> = {
  EXAM_NOT_FOUND: "EXAM_NOT_FOUND",
  EXAM_NOT_OPEN: "EXAM_NOT_OPEN",
  EXAM_CLOSED: "EXAM_CLOSED",
  NAME_IN_USE: "NAME_IN_USE",
  NO_ATTEMPTS_LEFT: "NO_ATTEMPTS_LEFT",
  INVALID_RESUME_CODE: "INVALID_RESUME_CODE",
  ATTEMPT_EXPIRED: "ATTEMPT_EXPIRED",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  VALIDATION: "VALIDATION",
  NOT_FOUND: "NOT_FOUND",
};

/** Pesan yang menyertai setiap kode, ditulis untuk peserta — bukan pengembang. */
const PARTICIPANT_MESSAGES: Partial<Record<ErrorCode, string>> = {
  EXAM_NOT_FOUND: "Kode ujian tidak dikenali. Periksa lagi kode dari gurumu.",
  EXAM_NOT_OPEN: "Ujian ini belum dibuka. Coba lagi sesuai jadwal.",
  EXAM_CLOSED: "Ujian ini sudah ditutup.",
  NAME_IN_USE:
    "Nama ini sedang mengerjakan ujian di perangkat lain. Buka dengan Kode Lanjut, atau tunggu beberapa saat.",
  NO_ATTEMPTS_LEFT: "Kesempatan mengerjakan ujian ini sudah habis.",
  INVALID_RESUME_CODE: "Kode Lanjut tidak cocok. Periksa lagi huruf dan angkanya.",
  ATTEMPT_EXPIRED: "Waktu pengerjaan sudah habis dan jawabanmu sudah dikumpulkan.",
  UNAUTHENTICATED: "Sesi pengerjaan tidak ditemukan. Mulai lagi dari halaman ujian.",
};

function mapRpcError(error: { code?: string; message: string }): ActionResult<never> {
  const known = PG_MESSAGE_CODES[error.message.trim()];
  if (known) {
    return fail(known, PARTICIPANT_MESSAGES[known] ?? error.message);
  }

  // 42501 = insufficient_privilege. Bagi peserta ini berarti sesinya tidak sah.
  if (error.code === "42501") {
    return fail("UNAUTHENTICATED", PARTICIPANT_MESSAGES.UNAUTHENTICATED!);
  }

  // 28000 = invalid_authorization_specification (token tidak dikenali).
  if (error.code === "28000") {
    return fail("UNAUTHENTICATED", PARTICIPANT_MESSAGES.UNAUTHENTICATED!);
  }

  console.error("[attempts] kesalahan RPC:", error.code, error.message);
  return fail("INTERNAL", "Ada gangguan di server. Jawabanmu aman — coba lagi sebentar lagi.");
}

/* -------------------------------------------------------------------------- */
/* Pembacaan state                                                            */
/* -------------------------------------------------------------------------- */

/**
 * State attempt untuk kode ujian ini, dibaca dari cookie.
 *
 * Mengembalikan `null` — bukan error — bila belum ada sesi. Pemanggil (runner)
 * memakai `null` untuk mengarahkan peserta kembali ke halaman pra-ujian;
 * memperlakukannya sebagai galat akan menampilkan pesan merah pada kunjungan
 * pertama yang sebenarnya wajar.
 */
export async function getAttemptState(code: string): Promise<ActionResult<AttemptState | null>> {
  const tokenHash = await readAttemptTokenHash(code);
  if (!tokenHash) return ok(null);

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("get_attempt_state", { p_token_hash: tokenHash });

  if (error) {
    // Token kedaluwarsa/dicabut: sesinya memang sudah tidak berlaku.
    if (error.message.trim() === "UNAUTHENTICATED" || error.code === "28000") {
      return ok(null);
    }
    return mapRpcError(error);
  }

  return ok(data as unknown as AttemptState);
}

/* -------------------------------------------------------------------------- */
/* startAttempt                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Mulai attempt baru (T5.3).
 *
 * Token dibuat **di sini**, bukan di database: database hanya menerima hash-nya.
 * Dengan begitu isi tabel yang bocor tidak bisa dipakai membajak attempt yang
 * sedang berjalan.
 */
export async function startAttempt(input: unknown): Promise<ActionResult<{ code: string }>> {
  const parsed = startAttemptSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const { code, name, className } = parsed.data;

  /*
   * Cookie lama sengaja **tidak** dihapus lebih dulu. Kalau start gagal (mis.
   * `NAME_IN_USE`), menghapusnya akan membuang sesi yang masih bisa dilanjutkan
   * dengan Kode Lanjut. Cookie ditimpa hanya setelah RPC berhasil.
   */
  const token = generateAttemptToken();
  const supabase = createAdminClient();
  const headerList = await headers();

  const { error } = await supabase.rpc("start_attempt", {
    p_code: code.toUpperCase(),
    p_name: name,
    // RPC memakai `p_class text` yang boleh null; string kosong dinormalkan
    // menjadi NULL oleh `nullif(btrim(...), '')` di dalam fungsi.
    p_class: className ?? "",
    p_token_hash: hashAttemptToken(token),
    p_resume_code: generateResumeCode(),
    p_result_token: generateAttemptToken(),
    p_ip: await clientIp(),
    p_user_agent: headerList.get("user-agent") ?? undefined,  });

  if (error) return mapRpcError(error);

  await writeAttemptCookie(code, token);
  return ok({ code: code.toUpperCase() });
}

/**
 * Kode Lanjut 6 karakter.
 *
 * Alfabetnya sama dengan kode ujian: tanpa `0/O` dan `1/I`, karena kode ini
 * dibacakan ulang oleh peserta dari layar atau kertas.
 */
function generateResumeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/* -------------------------------------------------------------------------- */
/* resumeAttempt                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Lanjutkan attempt yang sudah ada (T5.4, T5.5).
 *
 * RPC menerbitkan `token_hash` **baru** dan menimpa yang lama. Itu yang membuat
 * perangkat pertama kehilangan akses: permintaannya berikutnya ditolak
 * `UNAUTHENTICATED`, dan runner menampilkan bahwa ujian dilanjutkan di
 * perangkat lain (RUN-11). Sesi lama tidak dihapus, hanya tidak lagi sah.
 */
export async function resumeAttempt(input: unknown): Promise<ActionResult<{ code: string }>> {
  const parsed = resumeAttemptSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const { code, name, resumeCode } = parsed.data;
  const token = generateAttemptToken();
  const supabase = createAdminClient();

  const { error } = await supabase.rpc("resume_attempt", {
    p_code: code.toUpperCase(),
    p_name: name,
    p_resume_code: resumeCode.toUpperCase(),
    p_new_token_hash: hashAttemptToken(token),
  });

  if (error) return mapRpcError(error);

  await writeAttemptCookie(code, token);
  return ok({ code: code.toUpperCase() });
}

/* -------------------------------------------------------------------------- */
/* saveAnswer                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Simpan satu jawaban (T5.8).
 *
 * Debounce dilakukan pemanggil, bukan di sini: Server Action tidak menyimpan
 * status antar-permintaan, jadi satu-satunya tempat yang tahu "peserta masih
 * mengetik" adalah komponen runner.
 *
 * `essayText` dikirim hanya untuk soal esai. Mengirim teks esai pada soal
 * pilihan ganda akan menimpa kolom yang tidak relevan — tidak berbahaya, tetapi
 * membuat data sulit dibaca saat audit.
 */
export async function saveAnswer(input: unknown): Promise<ActionResult<{ savedAt: string }>> {
  const parsed = saveAnswerSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const { code, questionId, selectedOptionIds, essayText, flagged } = parsed.data;

  const tokenHash = await readAttemptTokenHash(code);
  if (!tokenHash) {
    return fail("UNAUTHENTICATED", PARTICIPANT_MESSAGES.UNAUTHENTICATED!);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("save_answer", {
    p_token_hash: tokenHash,
    p_question_id: questionId,
    p_selected: selectedOptionIds,
    p_essay: essayText.trim() ? essayText : undefined,
    p_flagged: flagged,
  });

  if (error) return mapRpcError(error);

  const savedAt = (data as { savedAt?: string } | null)?.savedAt ?? new Date().toISOString();
  return ok({ savedAt });
}

/* -------------------------------------------------------------------------- */
/* submitAttempt                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Kumpulkan jawaban (T5.11).
 *
 * Idempoten di database: memanggil dua kali tidak menggandakan attempt maupun
 * mengubah nilai. Itu penting karena tombol bisa tertekan dua kali atau koneksi
 * terputus setelah server selesai menghitung.
 *
 * Cookie **tidak** dihapus di sini. Peserta yang menekan "kembali" lalu memuat
 * ulang runner harus melihat halaman "sudah dikumpulkan", bukan formulir mulai
 * baru. Cookie dibersihkan saat peserta memulai attempt baru.
 */
export async function submitAttempt(input: unknown): Promise<ActionResult<SubmitResult>> {
  const parsed = submitAttemptSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const tokenHash = await readAttemptTokenHash(parsed.data.code);
  if (!tokenHash) {
    return fail("UNAUTHENTICATED", PARTICIPANT_MESSAGES.UNAUTHENTICATED!);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("submit_attempt", { p_token_hash: tokenHash });

  if (error) return mapRpcError(error);
  return ok(data as unknown as SubmitResult);
}

/* -------------------------------------------------------------------------- */
/* logAttemptEvent                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Catat kejadian integritas (T5.13, INT-02).
 *
 * Kegagalan dicatat ke log server tetapi **tidak** dikembalikan sebagai error ke
 * pemanggil: peserta tidak boleh kehilangan kesempatan menjawab hanya karena
 * pencatatan kejadian gagal. Fungsi ini karena itu selalu mengembalikan `ok`.
 */
export async function logAttemptEvent(input: unknown): Promise<ActionResult<null>> {
  const parsed = logAttemptEventSchema.safeParse(input);
  if (!parsed.success) return ok(null);

  const tokenHash = await readAttemptTokenHash(parsed.data.code);
  if (!tokenHash) return ok(null);

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("log_attempt_event", {
    p_token_hash: tokenHash,
    p_type: parsed.data.type,
    p_meta: (parsed.data.meta ?? {}) as never,
  });

  if (error) {
    console.error("[attempts] gagal mencatat kejadian:", error.message);
  }

  return ok(null);
}

/* -------------------------------------------------------------------------- */
/* Helper untuk halaman                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Bersihkan sesi peserta untuk ujian ini.
 *
 * Dipakai saat peserta memilih "mulai ulang" dari halaman pra-ujian setelah
 * attempt-nya selesai — tanpa ini, cookie lama akan terus menunjuk attempt yang
 * sudah `graded` dan peserta tidak pernah bisa memulai attempt berikutnya.
 */
export async function clearAttemptSession(code: string): Promise<ActionResult<null>> {
  await clearAttemptCookie(code);
  return ok(null);
}
