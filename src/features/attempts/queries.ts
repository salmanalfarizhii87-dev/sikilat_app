import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { readAttemptTokenHash } from "@/lib/participant-session";
import type { AttemptStatus } from "@/lib/types";
import type { AttemptState, ResultState } from "./types";

/**
 * Query modul pengerjaan (Fase 5).
 *
 * Dua jalur akses, dipisah dengan alasan yang sama seperti modul ujian:
 *
 * - **Peserta** (`getAttemptState`, `getResult`) memakai service role karena
 *   `anon` tidak punya GRANT. Otorisasi datang dari cookie sesi peserta.
 * - **Admin** (`listAttempts`, `getAttemptForGrading`) memakai klien ber-cookie
 *   supaya RLS tetap menjadi pengaman terakhir.
 */

/* -------------------------------------------------------------------------- */
/* URL gambar bertanda tangan                                                 */
/* -------------------------------------------------------------------------- */

/** Umur URL bertanda tangan. Cukup untuk satu sesi mengerjakan, tidak lebih. */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 2;

/**
 * Tandatangani `media_path` soal dan opsi menjadi URL yang bisa dibuka peramban.
 *
 * Bucket `question-media` **privat** (keputusan K9): tidak ada policy untuk
 * `anon`/`authenticated`, jadi satu-satunya jalan masuk adalah URL bertanda
 * tangan berumur pendek dari server. Ini disengaja — kalau path-nya bisa dibuka
 * langsung, seluruh bank soal bergambar bisa diunduh tanpa mengerjakan ujian.
 *
 * Kegagalan menandatangani satu gambar tidak boleh menggagalkan seluruh attempt:
 * soal tetap bisa dikerjakan tanpa gambarnya, dan lebih baik begitu daripada
 * peserta kehilangan waktu karena satu berkas hilang dari Storage.
 */
async function signQuestionMedia(state: AttemptState): Promise<AttemptState> {
  const paths = new Set<string>();
  for (const question of state.questions) {
    if (question.mediaPath) paths.add(question.mediaPath);
    for (const option of question.options) {
      if (option.mediaPath) paths.add(option.mediaPath);
    }
  }

  if (paths.size === 0) return state;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from("question-media")
    .createSignedUrls([...paths], SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.error("[attempts] gagal menandatangani gambar soal:", error.message);
    return state;
  }

  const urlByPath = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urlByPath.set(item.path, item.signedUrl);
  }

  /*
   * `signedUrl` menggantikan `mediaPath` di objek yang dikirim ke klien. Path
   * mentah tidak berguna bagi peramban dan tidak perlu diketahui peserta.
   */
  return {
    ...state,
    questions: state.questions.map((question) => ({
      ...question,
      mediaUrl: urlByPath.get(question.mediaPath ?? "") ?? null,
      options: question.options.map((option) => ({
        ...option,
        mediaUrl: urlByPath.get(option.mediaPath ?? "") ?? null,
      })),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Query peserta                                                              */
/* -------------------------------------------------------------------------- */

/**
 * State attempt untuk runner, dibaca lewat cookie sesi peserta.
 *
 * Mengembalikan `null` bila tidak ada sesi aktif atau tokennya sudah tidak sah.
 * Runner memakai `null` untuk kembali ke halaman pra-ujian — bukan menampilkan
 * galat, karena kunjungan pertama memang belum punya sesi.
 */
export async function getRunnerState(examCode: string): Promise<AttemptState | null> {
  const tokenHash = await readAttemptTokenHash(examCode);
  if (!tokenHash) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("get_attempt_state", { p_token_hash: tokenHash });

  if (error) {
    if (error.message.trim() === "UNAUTHENTICATED" || error.code === "28000") return null;
    console.error("[getRunnerState] gagal membaca state:", error.message);
    throw new Error("Gagal memuat lembar ujian.");
  }

  return signQuestionMedia(data as unknown as AttemptState);
}

/**
 * Hasil ujian berdasarkan `result_token`.
 *
 * RPC `get_result` yang memutuskan apa yang boleh dilihat: `hidden` tidak
 * mengirim skor sama sekali, `after_close` menunggu `closes_at`, `manual`
 * menunggu `results_released_at`. Query ini tidak menambah aturan sendiri —
 * menyalin aturan visibilitas ke dua tempat akan membuat keduanya menyimpang.
 */
export async function getResult(resultToken: string): Promise<ResultState | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("get_result", { p_result_token: resultToken });

  if (error) {
    // P0002 = token tidak dikenal. Halaman menampilkan 404, bukan galat server.
    if (error.code === "P0002" || error.message.trim() === "NOT_FOUND") return null;
    console.error("[getResult] gagal membaca hasil:", error.message);
    throw new Error("Gagal memuat hasil ujian.");
  }

  return data as unknown as ResultState;
}

/* -------------------------------------------------------------------------- */
/* Query admin                                                                */
/* -------------------------------------------------------------------------- */

/** Satu kejadian integritas yang tercatat di `attempt_events`. */
export interface AttemptEventRow {
  type: string;
  at: string;
}

/** Satu baris attempt untuk monitor dan rekap nilai. */
export interface AdminAttemptRow {
  id: string;
  participantName: string;
  participantClass: string | null;
  attemptNo: number;
  status: "in_progress" | "needs_grading" | "graded";
  submitReason: string | null;
  startedAt: string;
  submittedAt: string | null;
  expiresAt: string;
  scoreAuto: number;
  scoreManual: number;
  totalScore: number;
  maxScore: number;
  answeredCount: number;
  questionCount: number;
  pendingEssayCount: number;
  /** Jumlah seluruh kejadian integritas, apa pun tipenya. */
  eventCount: number;
  /**
   * Kejadian yang dihitung sebagai pelanggaran (pindah tab, keluar fullscreen).
   * Dipisahkan dari `eventCount` karena `report` — laporan soal bermasalah oleh
   * peserta — bukan pelanggaran, dan menjumlahkannya akan menuduh peserta yang
   * justru melaporkan masalah.
   */
  violationCount: number;
  events: AttemptEventRow[];
}

interface AttemptDbRow {
  id: string;
  participant_name: string;
  participant_class: string | null;
  attempt_no: number;
  status: AdminAttemptRow["status"];
  submit_reason: string | null;
  started_at: string;
  submitted_at: string | null;
  expires_at: string;
  score_auto: number;
  score_manual: number;
  total_score: number;
  max_score: number;
  question_order: string[];
  attempt_answers: { question_id: string; points_awarded: number | null }[];
  attempt_events: { event_type: string; created_at: string }[];
}

const ATTEMPT_COLUMNS =
  "id,participant_name,participant_class,attempt_no,status,submit_reason,started_at," +
  "submitted_at,expires_at,score_auto,score_manual,total_score,max_score,question_order," +
  "attempt_answers(question_id,points_awarded),attempt_events(event_type,created_at)";

/** Tipe kejadian yang dianggap pelanggaran (INT-02). */
const VIOLATION_TYPES = new Set(["tab_hidden", "fullscreen_exit"]);

/**
 * Semua attempt sebuah ujian, untuk tab Monitor dan Rekap nilai.
 *
 * `pendingEssayCount` dihitung dari **jumlah soal esai di attempt ini** dikurangi
 * esai yang sudah punya `points_awarded`. Cara ini tidak butuh query tambahan ke
 * tabel `questions` dan tetap benar walau soal ujian diubah setelah attempt
 * dimulai — yang dihitung adalah soal yang benar-benar ada di `question_order`.
 */
export async function listAttempts(examId: string): Promise<AdminAttemptRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("attempts")
    .select(ATTEMPT_COLUMNS)
    .eq("exam_id", examId)
    .order("started_at", { ascending: false });

  if (error) {
    console.error("[listAttempts] gagal membaca attempt:", error.message);
    throw new Error("Gagal memuat daftar peserta.");
  }

  // Tipe soal per attempt dibutuhkan untuk menghitung esai yang menunggu.
  const rows = (data ?? []) as unknown as AttemptDbRow[];
  if (rows.length === 0) return [];

  const questionIds = [...new Set(rows.flatMap((row) => row.question_order ?? []))];
  const essayIds = await fetchEssayQuestionIds(questionIds);

  return rows.map((row) => {
    const order = row.question_order ?? [];
    const answers = row.attempt_answers ?? [];
    const answeredIds = new Set(answers.map((answer) => answer.question_id));
    const gradedEssayIds = new Set(
      answers.filter((answer) => answer.points_awarded !== null).map((answer) => answer.question_id),
    );

    const events = (row.attempt_events ?? [])
      .map((event) => ({ type: event.event_type, at: event.created_at }))
      .sort((a, b) => a.at.localeCompare(b.at));

    return {
      id: row.id,
      participantName: row.participant_name,
      participantClass: row.participant_class,
      attemptNo: row.attempt_no,
      status: row.status,
      submitReason: row.submit_reason,
      startedAt: row.started_at,
      submittedAt: row.submitted_at,
      expiresAt: row.expires_at,
      scoreAuto: Number(row.score_auto),
      scoreManual: Number(row.score_manual),
      totalScore: Number(row.total_score),
      maxScore: Number(row.max_score),
      answeredCount: answeredIds.size,
      questionCount: order.length,
      pendingEssayCount: order.filter((id) => essayIds.has(id) && !gradedEssayIds.has(id)).length,
      eventCount: events.length,
      violationCount: events.filter((event) => VIOLATION_TYPES.has(event.type)).length,
      events,
    };
  });
}

/** ID soal yang bertipe esai, dipecah agar `.in()` tidak melewati batas URL. */
async function fetchEssayQuestionIds(questionIds: string[]): Promise<Set<string>> {
  const supabase = await createClient();
  const found = new Set<string>();

  // PostgREST menolak URL yang kepanjangan; 100 ID per permintaan aman.
  for (let i = 0; i < questionIds.length; i += 100) {
    const chunk = questionIds.slice(i, i + 100);
    const { data, error } = await supabase
      .from("questions")
      .select("id,type")
      .in("id", chunk)
      .eq("type", "essay");

    if (error) {
      console.error("[fetchEssayQuestionIds] gagal membaca tipe soal:", error.message);
      continue;
    }

    for (const row of data ?? []) found.add(row.id);
  }

  return found;
}

/** Ringkasan nilai sebuah ujian, untuk kartu statistik. */
export interface ExamAttemptSummary {
  total: number;
  inProgress: number;
  needsGrading: number;
  graded: number;
  /** Rata-rata persentase attempt yang sudah dinilai; `null` bila belum ada. */
  averagePercentage: number | null;
  passedCount: number;
  failedCount: number;
  /** `null` bila ujian tanpa KKM — bukan 0. */
  passingScore: number | null;
}

/**
 * Ringkasan nilai dari attempt yang sudah dikumpulkan.
 *
 * Attempt `in_progress` **tidak** dihitung dalam rata-rata maupun lulus/tidak:
 * nilainya belum final, dan memasukkannya akan membuat rata-rata bergerak
 * setiap kali ada peserta baru membuka halaman pertama.
 */
export function summarizeAttempts(
  rows: AdminAttemptRow[],
  passingScore: number | null,
): ExamAttemptSummary {
  const finished = rows.filter((row) => row.status !== "in_progress");

  let passedCount = 0;
  let failedCount = 0;
  let percentageSum = 0;
  let percentageCount = 0;

  for (const row of finished) {
    if (row.maxScore <= 0) continue;
    const percentage = (row.totalScore / row.maxScore) * 100;
    percentageSum += percentage;
    percentageCount += 1;

    if (passingScore === null) continue;
    if (percentage >= passingScore) passedCount += 1;
    else failedCount += 1;
  }

  return {
    total: rows.length,
    inProgress: rows.filter((row) => row.status === "in_progress").length,
    needsGrading: rows.filter((row) => row.status === "needs_grading").length,
    graded: rows.filter((row) => row.status === "graded").length,
    averagePercentage: percentageCount > 0 ? percentageSum / percentageCount : null,
    passedCount,
    failedCount,
    passingScore,
  };
}

/* -------------------------------------------------------------------------- */
/* Ringkasan lintas ujian (dashboard)                                         */
/* -------------------------------------------------------------------------- */

/**
 * Satu attempt beserta ujiannya, untuk dashboard.
 *
 * Dashboard menampilkan peserta dari **semua** ujian sekaligus, jadi tiap baris
 * harus membawa judul dan KKM ujiannya sendiri. KKM tidak bisa diambil dari satu
 * ujian "utama" — ujian yang berbeda punya KKM berbeda, dan attempt pada ujian
 * tanpa KKM tidak boleh dihitung lulus/gagal.
 */
export interface OverviewAttemptRow {
  id: string;
  participantName: string;
  participantClass: string | null;
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  expiresAt: string;
  totalScore: number;
  maxScore: number;
  answeredCount: number;
  questionCount: number;
  examId: string;
  examCode: string;
  examTitle: string;
  /** `null` = ujian ini tanpa KKM. */
  passingScore: number | null;
}

/** Angka ringkas yang ditampilkan di kartu statistik dashboard. */
export interface AdminOverview {
  counts: { total: number; inProgress: number; needsGrading: number; graded: number };
  /** Attempt yang masih berjalan, terbaru lebih dulu. */
  live: OverviewAttemptRow[];
  /** Attempt yang sudah dikumpulkan, terbaru lebih dulu. */
  recent: OverviewAttemptRow[];
  /** Rata-rata persentase seluruh attempt selesai; `null` bila belum ada. */
  averagePercentage: number | null;
  passedCount: number;
  failedCount: number;
  /** Berapa attempt selesai yang ujiannya memang punya KKM. */
  withKkmCount: number;
}

interface OverviewDbRow {
  id: string;
  participant_name: string;
  participant_class: string | null;
  status: AttemptStatus;
  started_at: string;
  submitted_at: string | null;
  expires_at: string;
  total_score: number;
  max_score: number;
  question_order: string[];
  attempt_answers: { question_id: string }[];
  exams: {
    id: string;
    code: string;
    title: string;
    passing_score: number | null;
  };
}

const OVERVIEW_COLUMNS =
  "id,participant_name,participant_class,status,started_at,submitted_at,expires_at," +
  "total_score,max_score,question_order,attempt_answers(question_id)," +
  "exams!inner(id,code,title,passing_score)";

function toOverviewRow(row: OverviewDbRow): OverviewAttemptRow {
  return {
    id: row.id,
    participantName: row.participant_name,
    participantClass: row.participant_class,
    status: row.status,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    expiresAt: row.expires_at,
    totalScore: Number(row.total_score),
    maxScore: Number(row.max_score),
    answeredCount: (row.attempt_answers ?? []).length,
    questionCount: (row.question_order ?? []).length,
    examId: row.exams.id,
    examCode: row.exams.code,
    examTitle: row.exams.title,
    passingScore: row.exams.passing_score,
  };
}

/**
 * Semua angka dashboard dalam satu panggilan.
 *
 * Empat hal yang dikumpulkan, dan kenapa masing-masing:
 *
 * 1. **Hitungan status** memakai `head: true` per status — hanya header
 *    `Content-Range` yang dikirim balik, bukan ribuan baris attempt.
 * 2. **Attempt berjalan** dibatasi 12 baris. Dashboard bukan halaman monitor;
 *    daftar lengkapnya ada di tab Monitor tiap ujian.
 * 3. **Attempt selesai** dibatasi 8 baris untuk tabel aktivitas.
 * 4. **Statistik nilai** butuh seluruh attempt selesai, tetapi hanya empat kolom
 *    angka per baris. Untuk skala satu sekolah ini murah, dan alternatifnya —
 *    rata-rata yang dihitung di klien dari sebagian data — akan menampilkan
 *    angka yang salah tanpa terlihat salah.
 */
export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = await createClient();

  const statuses: AttemptStatus[] = ["in_progress", "needs_grading", "graded"];

  const [countResults, liveResult, recentResult, statsResult] = await Promise.all([
    Promise.all(
      statuses.map((status) =>
        supabase.from("attempts").select("id", { count: "exact", head: true }).eq("status", status),
      ),
    ),
    supabase
      .from("attempts")
      .select(OVERVIEW_COLUMNS)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(12),
    supabase
      .from("attempts")
      .select(OVERVIEW_COLUMNS)
      .neq("status", "in_progress")
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .limit(8),
    supabase
      .from("attempts")
      .select("total_score,max_score,exams!inner(passing_score)")
      .neq("status", "in_progress"),
  ]);

  const counts = { total: 0, inProgress: 0, needsGrading: 0, graded: 0 };
  const countKeys = ["inProgress", "needsGrading", "graded"] as const;

  countResults.forEach((result, index) => {
    if (result.error) {
      // Satu hitungan gagal tidak boleh menjatuhkan seluruh dashboard; kartunya
      // menampilkan 0 dan daftar di bawahnya tetap benar.
      console.error(`[getAdminOverview] gagal menghitung ${statuses[index]}:`, result.error.message);
      return;
    }
    const value = result.count ?? 0;
    counts[countKeys[index]] = value;
    counts.total += value;
  });

  if (liveResult.error) {
    console.error("[getAdminOverview] gagal membaca attempt berjalan:", liveResult.error.message);
  }
  if (recentResult.error) {
    console.error("[getAdminOverview] gagal membaca attempt selesai:", recentResult.error.message);
  }

  const live = ((liveResult.data ?? []) as unknown as OverviewDbRow[]).map(toOverviewRow);
  const recent = ((recentResult.data ?? []) as unknown as OverviewDbRow[]).map(toOverviewRow);

  let percentageSum = 0;
  let percentageCount = 0;
  let passedCount = 0;
  let failedCount = 0;
  let withKkmCount = 0;

  if (statsResult.error) {
    console.error("[getAdminOverview] gagal membaca statistik nilai:", statsResult.error.message);
  } else {
    const stats = (statsResult.data ?? []) as unknown as {
      total_score: number;
      max_score: number;
      exams: { passing_score: number | null };
    }[];

    for (const row of stats) {
      const maxScore = Number(row.max_score);
      if (maxScore <= 0) continue;

      const percentage = (Number(row.total_score) / maxScore) * 100;
      percentageSum += percentage;
      percentageCount += 1;

      const passingScore = row.exams.passing_score;
      if (passingScore === null) continue;

      withKkmCount += 1;
      if (percentage >= passingScore) passedCount += 1;
      else failedCount += 1;
    }
  }

  return {
    counts,
    live,
    recent,
    averagePercentage: percentageCount > 0 ? percentageSum / percentageCount : null,
    passedCount,
    failedCount,
    withKkmCount,
  };
}
