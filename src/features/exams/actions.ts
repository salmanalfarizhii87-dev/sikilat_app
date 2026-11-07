"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, validationFail, type ActionResult } from "@/lib/action-result";
import { EXAM_CODE_ALPHABET } from "@/lib/constants";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import {
  examIdSchema,
  examSettingsSchema,
  examUpdateSchema,
  extendCloseSchema,
  regenerateCodeSchema,
} from "./schemas";

/**
 * Server Actions modul ujian (T3.2).
 *
 * Pola setiap aksi, berurutan dan tidak boleh ditukar:
 *
 * 1. **Zod** â€” validasi bentuk, tanpa menyentuh jaringan.
 * 2. **`requireAdmin()`** â€” `auth.getUser()` + baris `admins.is_active`.
 * 3. **Database** lewat klien ber-cookie, sehingga RLS tetap menjadi pengaman
 *    terakhir bila ada bug otorisasi di langkah 2.
 * 4. **`audit_logs`** lewat RPC `log_admin_action` (migrasi 0014), karena
 *    `authenticated` sengaja tidak punya izin insert ke tabel itu.
 *
 * Semua fungsi mengembalikan `ActionResult<T>` dan tidak pernah melempar ke
 * pemanggil (PRD Â§8.1): Server Action yang melempar akan mengirim pesan galat
 * generik ke peramban dan menulis stack trace ke log.
 */

type ExamRow = Database["public"]["Tables"]["exams"]["Row"];
type ExamUpdate = Database["public"]["Tables"]["exams"]["Update"];

const EXAMS_PATH = "/admin/exams";

/* -------------------------------------------------------------------------- */
/* Pembantu                                                                   */
/* -------------------------------------------------------------------------- */

/** Panjang kode ujian yang dibuat aplikasi (EXM-03). */
const GENERATED_CODE_LENGTH = 6;

/**
 * Buat kode acak yang belum dipakai.
 *
 * Percobaan dibatasi 8 kali. Dengan alfabet 32 karakter dan panjang 6, ruang
 * kodenya 32^6 â‰ˆ 1 miliar; tabrakan tiga kali berturut-turut praktis berarti ada
 * yang salah lain (mis. constraint kode berubah), dan mengulang terus-menerus
 * hanya menyembunyikan masalah itu.
 *
 * `Math.random()` dipakai â€” bukan `crypto` â€” karena kode ini **bukan rahasia**.
 * Ia dibagikan ke peserta dan tercetak di layar. Yang dibutuhkan hanya "tidak
 * mudah ditebak berurutan", bukan ketahanan kriptografis.
 */
async function generateUniqueCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = Array.from(
      { length: GENERATED_CODE_LENGTH },
      () => EXAM_CODE_ALPHABET[Math.floor(Math.random() * EXAM_CODE_ALPHABET.length)],
    ).join("");

    const { data, error } = await supabase.from("exams").select("id").eq("code", code).maybeSingle();

    if (error) {
      console.error("[generateUniqueCode] gagal memeriksa kode:", error.message);
      return null;
    }

    if (!data) return code;
  }

  return null;
}

/** Tulis audit log. Kegagalan dicatat di log server, tidak menggagalkan aksi. */
async function audit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  action: string,
  entityId: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  const { error } = await supabase.rpc("log_admin_action", {
    p_action: action,
    p_entity: "exams",
    p_entity_id: entityId,
    // `Json` di tipe Supabase tidak menerima `unknown`; nilai di sini selalu
    // berasal dari baris database atau objek biasa, jadi aman di-cast.
    p_before: (before ?? null) as never,
    p_after: (after ?? null) as never,
  });

  if (error) {
    /*
     * Aksi utama sudah berhasil; menggagalkannya sekarang akan membuat admin
     * mengulang dan menghasilkan data ganda. Cukup catat â€” audit yang hilang
     * adalah masalah, tetapi data yang ganda lebih buruk.
     */
    console.error(`[audit] gagal mencatat ${action}:`, error.message);
  }
}

/** Petakan error Postgres/PostgREST yang sudah dikenal menjadi kode aplikasi. */
function mapDbError(error: { code?: string; message: string }): ActionResult<never> {
  // 23505 = unique_violation. Di tabel `exams` hanya `code` yang unik.
  if (error.code === "23505") {
    return fail("CONFLICT", "Kode ujian itu sudah dipakai ujian lain. Coba kode lain.", {
      code: ["Kode ujian sudah dipakai."],
    });
  }

  // 23514 = check_violation (mis. `closes_at > opens_at`, `duration_minutes > 0`).
  if (error.code === "23514") {
    return fail("VALIDATION", "Ada isian yang tidak memenuhi aturan. Periksa jadwal dan durasi.");
  }

  // 42501 = insufficient_privilege, termasuk penolakan RLS.
  if (error.code === "42501") {
    return fail("FORBIDDEN", "Akun ini tidak berhak mengubah ujian ini.");
  }

  console.error("[exams] kesalahan database:", error.code, error.message);
  return fail("INTERNAL", "Gagal menyimpan perubahan. Coba lagi sebentar lagi.");
}

/**
 * Gabungkan baris lama dengan perubahan, lalu periksa aturan yang butuh
 * **kedua** sisi â€” terutama EXM-08 "tutup setelah buka".
 *
 * Memeriksa hanya nilai yang dikirim tidak cukup: mengubah `opens_at` saja bisa
 * membuatnya melewati `closes_at` yang sudah tersimpan, dan sebaliknya. Yang
 * benar adalah memeriksa hasil gabungannya, persis seperti yang akan tersimpan.
 */
function checkMergedSchedule(
  current: Pick<ExamRow, "opens_at" | "closes_at">,
  patch: { opensAt?: string | null; closesAt?: string | null },
): ActionResult<never> | null {
  const opensAt = patch.opensAt !== undefined ? patch.opensAt : current.opens_at;
  const closesAt = patch.closesAt !== undefined ? patch.closesAt : current.closes_at;

  if (opensAt && closesAt && new Date(closesAt) <= new Date(opensAt)) {
    return fail("VALIDATION", "Waktu tutup harus setelah waktu buka.", {
      closesAt: ["Waktu tutup harus setelah waktu buka."],
    });
  }

  return null;
}

/** Ambil satu baris ujian; `null` bila tidak ada (atau tidak terlihat RLS). */
async function fetchExam(
  supabase: Awaited<ReturnType<typeof createClient>>,
  examId: string,
): Promise<{ row: ExamRow | null; error: ActionResult<never> | null }> {
  const { data, error } = await supabase.from("exams").select("*").eq("id", examId).maybeSingle();

  if (error) return { row: null, error: mapDbError(error) };
  return { row: data, error: null };
}

/* -------------------------------------------------------------------------- */
/* createExamDraft (EXM-07)                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Buat ujian baru berstatus `draft`.
 *
 * Status draft bukan sekadar nilai awal: draft **tidak muncul** di halaman
 * peserta (`getExamByCode` menyaring `status = 'draft'`), jadi wizard bisa
 * menyimpan berkali-kali tanpa pernah membocorkan ujian setengah jadi.
 *
 * Kode dibuat di sini, bukan di database, karena kode harus unik **dan** mudah
 * dibaca. Constraint `unique` di tabel tetap menjaga balapan antara dua admin
 * yang membuat ujian pada saat yang sama â€” kegagalannya ditangani `mapDbError`.
 */
export async function createExamDraft(
  input: unknown,
): Promise<ActionResult<{ examId: string; code: string }>> {
  const parsed = examSettingsSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const data = parsed.data;

  const code = await generateUniqueCode(supabase);
  if (!code) {
    return fail("INTERNAL", "Gagal membuat kode ujian. Coba lagi sebentar lagi.");
  }

  const { data: inserted, error } = await supabase
    .from("exams")
    .insert({
      code,
      created_by: auth.data.userId,
      title: data.title,
      subject_label: data.subjectLabel,
      description: data.description,
      instructions: data.instructions,
      opens_at: data.opensAt,
      closes_at: data.closesAt,
      duration_minutes: data.durationMinutes,
      max_attempts: data.maxAttempts,
      score_policy: data.scorePolicy,
      passing_score: data.passingScore,
      shuffle_questions: data.shuffleQuestions,
      shuffle_options: data.shuffleOptions,
      ask_class: data.askClass,
      result_visibility: data.resultVisibility,
      result_release: data.resultRelease,
      // Status sengaja tidak dikirim: default kolom adalah 'draft', dan menulis
      // eksplisit di sini akan membuat jalur "publish saat buat" mungkin tanpa
      // melewati validasi EXM-08.
    })
    .select("id, code")
    .single();

  if (error) return mapDbError(error);

  await audit(supabase, "create_exam_draft", inserted.id, null, { code: inserted.code, title: data.title });

  revalidatePath(EXAMS_PATH);
  return ok({ examId: inserted.id, code: inserted.code });
}

/* -------------------------------------------------------------------------- */
/* updateExam (EXM-02, EXM-04..06, EXM-09)                                    */
/* -------------------------------------------------------------------------- */

/**
 * Perbarui pengaturan ujian.
 *
 * Semua field opsional, tetapi minimal satu harus dikirim. Objek kosong ditolak
 * karena hampir pasti berarti bug pemanggil â€” dan menulis `updated_at` tanpa
 * perubahan apa pun akan mengacaukan urutan "terakhir diubah".
 *
 * **EXM-09 tidak dilanggar di sini.** Penguncian setelah attempt pertama hanya
 * berlaku untuk soal, opsi, dan poin. Judul, instruksi, jadwal, KKM, dan
 * pengaturan hasil tetap boleh diubah â€” itu justru yang dibutuhkan saat ujian
 * sedang berjalan (mis. memperpanjang waktu tutup).
 */
export async function updateExam(
  examId: unknown,
  patch: unknown,
): Promise<ActionResult<{ updated: true }>> {
  const idParsed = examIdSchema.safeParse({ examId });
  if (!idParsed.success) return validationFail(idParsed.error);

  const parsed = examUpdateSchema.safeParse(patch);
  if (!parsed.success) return validationFail(parsed.error);

  if (Object.keys(parsed.data).length === 0) {
    return fail("VALIDATION", "Tidak ada perubahan yang dikirim.");
  }

  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const supabase = await createClient();

  const { row: current, error: readError } = await fetchExam(supabase, idParsed.data.examId);
  if (readError) return readError;
  if (!current) return fail("NOT_FOUND", "Ujian tidak ditemukan.");

  const scheduleIssue = checkMergedSchedule(current, parsed.data);
  if (scheduleIssue) return scheduleIssue;

  const changes = parsed.data;
  const update: ExamUpdate = { updated_at: new Date().toISOString() };

  if (changes.title !== undefined) update.title = changes.title;
  if (changes.subjectLabel !== undefined) update.subject_label = changes.subjectLabel;
  if (changes.description !== undefined) update.description = changes.description;
  if (changes.instructions !== undefined) update.instructions = changes.instructions;
  if (changes.opensAt !== undefined) update.opens_at = changes.opensAt;
  if (changes.closesAt !== undefined) update.closes_at = changes.closesAt;
  if (changes.durationMinutes !== undefined) update.duration_minutes = changes.durationMinutes;
  if (changes.maxAttempts !== undefined) update.max_attempts = changes.maxAttempts;
  if (changes.scorePolicy !== undefined) update.score_policy = changes.scorePolicy;
  if (changes.passingScore !== undefined) update.passing_score = changes.passingScore;
  if (changes.shuffleQuestions !== undefined) update.shuffle_questions = changes.shuffleQuestions;
  if (changes.shuffleOptions !== undefined) update.shuffle_options = changes.shuffleOptions;
  if (changes.askClass !== undefined) update.ask_class = changes.askClass;
  if (changes.resultVisibility !== undefined) update.result_visibility = changes.resultVisibility;
  if (changes.resultRelease !== undefined) update.result_release = changes.resultRelease;

  const { error } = await supabase.from("exams").update(update).eq("id", current.id);
  if (error) return mapDbError(error);

  await audit(supabase, "update_exam", current.id, current, update);

  revalidatePath(EXAMS_PATH);
  revalidatePath(`${EXAMS_PATH}/${current.id}`);
  return ok({ updated: true });
}

/* -------------------------------------------------------------------------- */
/* publishExam / unpublishExam (EXM-07, EXM-08)                               */
/* -------------------------------------------------------------------------- */

/** Hasil pemeriksaan kelayakan publish. */
interface PublishIssue {
  field: string;
  message: string;
}

/**
 * Periksa syarat publish (EXM-08) terhadap data **di database**, bukan data di
 * layar. Wizard bisa saja menampilkan 10 soal yang belum tersimpan; yang
 * menentukan adalah baris `questions` yang benar-benar ada.
 */
async function collectPublishIssues(
  supabase: Awaited<ReturnType<typeof createClient>>,
  exam: ExamRow,
): Promise<PublishIssue[]> {
  const issues: PublishIssue[] = [];

  const { data: questions, error } = await supabase
    .from("questions")
    .select("id, points")
    .eq("exam_id", exam.id);

  if (error) {
    console.error("[collectPublishIssues] gagal membaca soal:", error.message);
    throw new Error("Gagal memeriksa soal ujian.");
  }

  const list = questions ?? [];

  // EXM-08: "â‰¥ 1 soal".
  if (list.length === 0) {
    issues.push({ field: "questions", message: "Ujian belum punya soal. Tambahkan minimal satu soal." });
  }

  // EXM-08: "total poin > 0". Diperiksa terpisah dari jumlah soal karena
  // `points` boleh desimal dan constraint-nya `points > 0` â€” total 0 seharusnya
  // mustahil, tetapi pemeriksaan ini menjaga bila constraint berubah.
  const totalPoints = list.reduce((sum, q) => sum + Number(q.points ?? 0), 0);
  if (list.length > 0 && totalPoints <= 0) {
    issues.push({ field: "questions", message: "Total poin soal harus lebih dari 0." });
  }

  // EXM-08: "durasi > 0". Constraint DB sudah menjaminnya, tetapi draft lama
  // bisa saja dibuat sebelum constraint itu ada.
  if (!exam.duration_minutes || exam.duration_minutes <= 0) {
    issues.push({ field: "durationMinutes", message: "Durasi ujian harus lebih dari 0 menit." });
  }

  // EXM-08: "jadwal valid (tutup setelah buka)".
  if (exam.opens_at && exam.closes_at && new Date(exam.closes_at) <= new Date(exam.opens_at)) {
    issues.push({ field: "closesAt", message: "Waktu tutup harus setelah waktu buka." });
  }

  // Jadwal yang seluruhnya sudah lewat akan menghasilkan ujian yang langsung
  // tertutup. Bukan pelanggaran EXM-08, tetapi hampir pasti salah isi.
  if (exam.closes_at && new Date(exam.closes_at) <= new Date()) {
    issues.push({
      field: "closesAt",
      message: "Waktu tutup sudah lewat. Perbarui jadwal sebelum mengaktifkan ujian.",
    });
  }

  return issues;
}

/**
 * Ubah status `draft`/`archived` â†’ `published` (EXM-07).
 *
 * Bila ada masalah, semuanya dikembalikan sekaligus lewat `fields` supaya UI
 * bisa menandai semuanya dalam satu kali lihat â€” bukan satu per satu setelah
 * setiap percobaan.
 */
export async function publishExam(examId: unknown): Promise<ActionResult<{ status: "published" }>> {
  const idParsed = examIdSchema.safeParse({ examId });
  if (!idParsed.success) return validationFail(idParsed.error);

  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const supabase = await createClient();

  const { row: exam, error: readError } = await fetchExam(supabase, idParsed.data.examId);
  if (readError) return readError;
  if (!exam) return fail("NOT_FOUND", "Ujian tidak ditemukan.");

  if (exam.status === "published") {
    return fail("CONFLICT", "Ujian ini sudah aktif.");
  }

  const issues = await collectPublishIssues(supabase, exam);
  if (issues.length > 0) {
    const fields: Record<string, string[]> = {};
    for (const issue of issues) {
      (fields[issue.field] ??= []).push(issue.message);
    }
    return fail(
      "VALIDATION",
      `Ujian belum bisa diaktifkan: ${issues[0].message}`,
      fields,
    );
  }

  const { error } = await supabase
    .from("exams")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("id", exam.id);

  if (error) return mapDbError(error);

  await audit(supabase, "publish_exam", exam.id, { status: exam.status }, { status: "published" });

  revalidatePath(EXAMS_PATH);
  revalidatePath(`${EXAMS_PATH}/${exam.id}`);
  return ok({ status: "published" });
}

/**
 * Kembalikan ujian aktif menjadi `draft`.
 *
 * Attempt yang sedang berjalan **tidak** dibatalkan di sini. Peserta yang sudah
 * memulai tetap bisa menyelesaikan dan mengumpulkan; yang berubah hanya apakah
 * kode ujian masih bisa dipakai untuk memulai attempt baru. Membatalkan attempt
 * di tengah jalan akan menghapus pekerjaan peserta yang sudah dikerjakan â€”
 * keputusan yang tidak boleh diambil hanya karena admin menekan "nonaktifkan".
 */
export async function unpublishExam(examId: unknown): Promise<ActionResult<{ status: "draft" }>> {
  const idParsed = examIdSchema.safeParse({ examId });
  if (!idParsed.success) return validationFail(idParsed.error);

  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const supabase = await createClient();

  const { row: exam, error: readError } = await fetchExam(supabase, idParsed.data.examId);
  if (readError) return readError;
  if (!exam) return fail("NOT_FOUND", "Ujian tidak ditemukan.");

  if (exam.status !== "published") {
    return fail("CONFLICT", "Ujian ini tidak sedang aktif.");
  }

  const { error } = await supabase
    .from("exams")
    .update({ status: "draft", updated_at: new Date().toISOString() })
    .eq("id", exam.id);

  if (error) return mapDbError(error);

  await audit(supabase, "unpublish_exam", exam.id, { status: "published" }, { status: "draft" });

  revalidatePath(EXAMS_PATH);
  revalidatePath(`${EXAMS_PATH}/${exam.id}`);
  return ok({ status: "draft" });
}

/* -------------------------------------------------------------------------- */
/* regenerateExamCode (EXM-03)                                                */
/* -------------------------------------------------------------------------- */

/**
 * Ganti kode ujian.
 *
 * Kode lama langsung tidak ditemukan setelah ini â€” itulah tujuannya: menghentikan
 * penyebaran tautan yang sudah bocor tanpa membatalkan pengerjaan yang sedang
 * berjalan. Attempt aktif terikat pada `attempts.id` dan token, bukan pada kode,
 * jadi peserta yang sudah masuk tetap lanjut seperti biasa.
 *
 * Parameter `code` boleh kosong (dibuatkan otomatis) atau diisi admin. Kode
 * pilihan tetap divalidasi dengan alfabet yang sama supaya tidak ada kode yang
 * mustahil dibacakan.
 */
export async function regenerateExamCode(
  examId: unknown,
  code?: string,
): Promise<ActionResult<{ code: string }>> {
  const parsed = regenerateCodeSchema.safeParse({ examId, code });
  if (!parsed.success) return validationFail(parsed.error);

  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const supabase = await createClient();

  const { row: exam, error: readError } = await fetchExam(supabase, parsed.data.examId);
  if (readError) return readError;
  if (!exam) return fail("NOT_FOUND", "Ujian tidak ditemukan.");

  const requested = parsed.data.code;
  let nextCode: string;

  if (requested !== undefined) {
    if (requested === exam.code) {
      return fail("CONFLICT", "Kode baru sama dengan kode sekarang. Tidak ada yang berubah.");
    }

    const { data: existing, error: checkError } = await supabase
      .from("exams")
      .select("id")
      .eq("code", requested)
      .maybeSingle();

    if (checkError) return mapDbError(checkError);
    if (existing) {
      return fail("CONFLICT", "Kode ujian itu sudah dipakai ujian lain.", {
        code: ["Kode ujian sudah dipakai."],
      });
    }

    nextCode = requested;
  } else {
    const generated = await generateUniqueCode(supabase);
    if (!generated) return fail("INTERNAL", "Gagal membuat kode ujian baru. Coba lagi.");
    nextCode = generated;
  }

  const { error } = await supabase
    .from("exams")
    .update({ code: nextCode, updated_at: new Date().toISOString() })
    .eq("id", exam.id);

  if (error) return mapDbError(error);

  await audit(supabase, "regenerate_exam_code", exam.id, { code: exam.code }, { code: nextCode });

  revalidatePath(EXAMS_PATH);
  revalidatePath(`${EXAMS_PATH}/${exam.id}`);
  return ok({ code: nextCode });
}

/* -------------------------------------------------------------------------- */
/* openExamNow / closeExamNow / extendCloseTime (EXM-12)                      */
/* -------------------------------------------------------------------------- */

/**
 * Buka ujian sekarang, mengesampingkan jadwal.
 *
 * `opens_at` diisi `now()` dan `closes_at` **dikosongkan**. Mengosongkan jadwal
 * tutup bukan kelalaian: kalau `closes_at` dibiarkan di masa lalu, ujian akan
 * langsung tertutup lagi dan tombol "Buka sekarang" tampak tidak bekerja.
 * Ujian lalu berjalan sampai ditutup manual â€” persis yang diminta tombol ini.
 *
 * Status ikut dijadikan `published` karena ujian draft yang dibuka sekarang
 * tetap tidak terlihat peserta.
 */
export async function openExamNow(examId: unknown): Promise<ActionResult<{ openedAt: string }>> {
  const idParsed = examIdSchema.safeParse({ examId });
  if (!idParsed.success) return validationFail(idParsed.error);

  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const supabase = await createClient();

  const { row: exam, error: readError } = await fetchExam(supabase, idParsed.data.examId);
  if (readError) return readError;
  if (!exam) return fail("NOT_FOUND", "Ujian tidak ditemukan.");

  /*
   * Membuka ujian yang belum punya soal berarti peserta bisa memulai attempt
   * kosong dan mengumpulkan nilai 0 yang tidak bisa dihapus tanpa reset manual.
   * Syarat EXM-08 diperiksa di sini juga, bukan hanya di `publishExam`.
   */
  if (exam.status !== "published") {
    const issues = await collectPublishIssues(supabase, exam);
    if (issues.length > 0) {
      const fields: Record<string, string[]> = {};
      for (const issue of issues) (fields[issue.field] ??= []).push(issue.message);
      return fail("VALIDATION", `Ujian belum bisa dibuka: ${issues[0].message}`, fields);
    }
  }

  const openedAt = new Date().toISOString();

  const { error } = await supabase
    .from("exams")
    .update({
      status: "published",
      opens_at: openedAt,
      closes_at: null,
      updated_at: openedAt,
    })
    .eq("id", exam.id);

  if (error) return mapDbError(error);

  await audit(
    supabase,
    "open_exam_now",
    exam.id,
    { status: exam.status, opens_at: exam.opens_at, closes_at: exam.closes_at },
    { status: "published", opens_at: openedAt, closes_at: null },
  );

  revalidatePath(EXAMS_PATH);
  revalidatePath(`${EXAMS_PATH}/${exam.id}`);
  return ok({ openedAt });
}

/**
 * Tutup ujian sekarang, mengesampingkan jadwal.
 *
 * Hanya `closes_at` yang diubah. Status tetap `published` supaya ujian tidak
 * berubah menjadi draft dan hilang dari daftar "aktif" hanya karena waktunya
 * habis â€” peserta yang mencoba masuk akan ditolak oleh pemeriksaan jadwal, bukan
 * oleh status.
 */
export async function closeExamNow(examId: unknown): Promise<ActionResult<{ closedAt: string }>> {
  const idParsed = examIdSchema.safeParse({ examId });
  if (!idParsed.success) return validationFail(idParsed.error);

  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const supabase = await createClient();

  const { row: exam, error: readError } = await fetchExam(supabase, idParsed.data.examId);
  if (readError) return readError;
  if (!exam) return fail("NOT_FOUND", "Ujian tidak ditemukan.");

  const closedAt = new Date().toISOString();

  const { error } = await supabase
    .from("exams")
    .update({ closes_at: closedAt, updated_at: closedAt })
    .eq("id", exam.id);

  if (error) return mapDbError(error);

  await audit(supabase, "close_exam_now", exam.id, { closes_at: exam.closes_at }, { closes_at: closedAt });

  revalidatePath(EXAMS_PATH);
  revalidatePath(`${EXAMS_PATH}/${exam.id}`);
  return ok({ closedAt });
}

/**
 * Perpanjang waktu tutup sebanyak N menit (EXM-12).
 *
 * Titik awal perpanjangan adalah **waktu tutup yang berlaku**, bukan `now()`.
 * Kalau memakai `now()`, memperpanjang 30 menit pada ujian yang tutupnya masih
 * dua jam lagi akan justru **memperpendek** jadwal â€” kesalahan yang mudah
 * terjadi dan sulit disadari.
 *
 * Bila ujian belum punya jadwal tutup, titik awalnya `now()`.
 */
export async function extendCloseTime(
  examId: unknown,
  minutes: unknown,
): Promise<ActionResult<{ closesAt: string }>> {
  const parsed = extendCloseSchema.safeParse({ examId, minutes });
  if (!parsed.success) return validationFail(parsed.error);

  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const supabase = await createClient();

  const { row: exam, error: readError } = await fetchExam(supabase, parsed.data.examId);
  if (readError) return readError;
  if (!exam) return fail("NOT_FOUND", "Ujian tidak ditemukan.");

  const addedMinutes = parsed.data.minutes;

  const base = exam.closes_at ? new Date(exam.closes_at) : new Date();
  const next = new Date(Math.max(base.getTime(), Date.now()) + addedMinutes * 60_000);

  // Perpanjangan tidak boleh membuat `closes_at` mendahului `opens_at`.
  if (exam.opens_at && next <= new Date(exam.opens_at)) {
    return fail("VALIDATION", "Waktu tutup baru masih sebelum waktu buka.", {
      minutes: ["Waktu tutup baru masih sebelum waktu buka."],
    });
  }

  const closesAt = next.toISOString();

  const { error } = await supabase
    .from("exams")
    .update({ closes_at: closesAt, updated_at: new Date().toISOString() })
    .eq("id", exam.id);

  if (error) return mapDbError(error);

  await audit(
    supabase,
    "extend_close_time",
    exam.id,
    { closes_at: exam.closes_at },
    { closes_at: closesAt, addedMinutes },
  );

  revalidatePath(EXAMS_PATH);
  revalidatePath(`${EXAMS_PATH}/${exam.id}`);
  return ok({ closesAt });
}


