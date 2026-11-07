import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AttemptStatus, QuestionType } from "@/lib/types";

/**
 * Query penilaian esai (T6.1, T6.2, T6.3).
 *
 * Memakai klien ber-cookie, sehingga RLS `is_admin()` tetap menjadi pengaman
 * terakhir. Data di sini memuat kunci jawaban dan kunci acuan — hal yang tidak
 * boleh terlihat peserta — jadi service role tidak dipakai sama sekali.
 */

/** Satu opsi beserta benar/salahnya. Hanya untuk admin. */
export interface GradingOption {
  id: string;
  body: string;
  isCorrect: boolean;
}

/** Satu soal beserta jawaban peserta untuk soal itu. */
export interface GradingQuestion {
  id: string;
  position: number;
  type: QuestionType;
  body: string;
  passage: string | null;
  points: number;
  wordMin: number | null;
  wordMax: number | null;
  referenceAnswer: string | null;
  explanation: string | null;
  options: GradingOption[];
  /** Jawaban peserta; `null` bila soal tidak disentuh sama sekali. */
  answer: {
    selectedOptionIds: string[];
    essayText: string | null;
    flagged: boolean;
    /** Sudah dinilai (esai) atau dihitung otomatis (objektif). */
    pointsAwarded: number | null;
    isCorrect: boolean | null;
    feedback: string | null;
    gradedAt: string | null;
  } | null;
}

export interface GradingAttempt {
  id: string;
  examId: string;
  examCode: string;
  examTitle: string;
  participantName: string;
  participantClass: string | null;
  attemptNo: number;
  status: AttemptStatus;
  submitReason: string | null;
  startedAt: string;
  submittedAt: string | null;
  expiresAt: string;
  scoreAuto: number;
  scoreManual: number;
  totalScore: number;
  maxScore: number;
  /** Seluruh soal yang benar-benar tampil di attempt ini, urut `question_order`. */
  questions: GradingQuestion[];
  events: { type: string; at: string; meta: unknown }[];
}

interface AttemptRow {
  id: string;
  exam_id: string;
  participant_name: string;
  participant_class: string | null;
  attempt_no: number;
  status: AttemptStatus;
  submit_reason: string | null;
  started_at: string;
  submitted_at: string | null;
  expires_at: string;
  score_auto: number;
  score_manual: number;
  total_score: number;
  max_score: number;
  question_order: string[];
  exams: { code: string; title: string };
  attempt_answers: {
    question_id: string;
    selected_option_ids: string[] | null;
    essay_text: string | null;
    is_flagged: boolean;
    is_correct: boolean | null;
    points_awarded: number | null;
    feedback: string | null;
    graded_at: string | null;
  }[];
  attempt_events: { event_type: string; created_at: string; meta: unknown }[];
}

const ATTEMPT_COLUMNS =
  "id,exam_id,participant_name,participant_class,attempt_no,status,submit_reason,started_at," +
  "submitted_at,expires_at,score_auto,score_manual,total_score,max_score,question_order," +
  "exams!inner(code,title)," +
  "attempt_answers(question_id,selected_option_ids,essay_text,is_flagged,is_correct," +
  "points_awarded,feedback,graded_at)," +
  "attempt_events(event_type,created_at,meta)";

interface QuestionRow {
  id: string;
  position: number;
  type: QuestionType;
  body: string;
  passage: string | null;
  points: number;
  word_min: number | null;
  word_max: number | null;
  reference_answer: string | null;
  explanation: string | null;
  question_options: { id: string; position: number; body: string; is_correct: boolean }[];
}

/**
 * Satu attempt lengkap untuk halaman penilaian (T6.2, T6.3).
 *
 * `null` bila attempt tidak ada, bukan milik ujian di URL, atau tidak terlihat
 * RLS. Pemeriksaan `exam_id` dilakukan di sini — bukan hanya di halaman — supaya
 * URL yang menukar ID ujian tidak bisa dipakai membaca attempt ujian lain.
 */
export async function getAttemptForGrading(
  examId: string,
  attemptId: string,
): Promise<GradingAttempt | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("attempts")
    .select(ATTEMPT_COLUMNS)
    .eq("id", attemptId)
    .eq("exam_id", examId)
    .maybeSingle();

  if (error) {
    console.error("[getAttemptForGrading] gagal membaca attempt:", error.message);
    throw new Error("Gagal memuat jawaban peserta.");
  }

  if (!data) return null;

  const row = data as unknown as AttemptRow;

  const questionIds = row.question_order ?? [];
  const questionResult = questionIds.length
    ? await supabase
        .from("questions")
        .select(
          "id,position,type,body,passage,points,word_min,word_max,reference_answer,explanation," +
            "question_options(id,position,body,is_correct)",
        )
        .in("id", questionIds)
    : { data: [] as QuestionRow[], error: null };

  if (questionResult.error) {
    console.error("[getAttemptForGrading] gagal membaca soal:", questionResult.error.message);
    throw new Error("Gagal memuat soal ujian.");
  }

  const questionById = new Map(
    ((questionResult.data ?? []) as unknown as QuestionRow[]).map((question) => [question.id, question]),
  );

  const answerByQuestion = new Map(
    (row.attempt_answers ?? []).map((answer) => [answer.question_id, answer]),
  );

  /*
   * Urutan mengikuti `question_order`, bukan `position`. Kalau admin mengacak
   * soal, peserta melihat urutan acak itu; halaman penilaian yang menampilkan
   * urutan asli akan membuat admin salah merujuk "soal nomor 3".
   *
   * Soal yang sudah dihapus (mungkin terjadi pada attempt lama) dilewati, bukan
   * ditampilkan sebagai baris kosong.
   */
  const questions: GradingQuestion[] = [];
  for (const id of questionIds) {
    const question = questionById.get(id);
    if (!question) continue;

    const answer = answerByQuestion.get(id) ?? null;

    questions.push({
      id: question.id,
      position: question.position,
      type: question.type,
      body: question.body,
      passage: question.passage,
      points: Number(question.points),
      wordMin: question.word_min,
      wordMax: question.word_max,
      referenceAnswer: question.reference_answer,
      explanation: question.explanation,
      options: [...(question.question_options ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((option) => ({ id: option.id, body: option.body, isCorrect: option.is_correct })),
      answer: answer
        ? {
            selectedOptionIds: answer.selected_option_ids ?? [],
            essayText: answer.essay_text,
            flagged: answer.is_flagged,
            pointsAwarded: answer.points_awarded === null ? null : Number(answer.points_awarded),
            isCorrect: answer.is_correct,
            feedback: answer.feedback,
            gradedAt: answer.graded_at,
          }
        : null,
    });
  }

  return {
    id: row.id,
    examId: row.exam_id,
    examCode: row.exams.code,
    examTitle: row.exams.title,
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
    questions,
    events: (row.attempt_events ?? [])
      .map((event) => ({ type: event.event_type, at: event.created_at, meta: event.meta }))
      .sort((a, b) => a.at.localeCompare(b.at)),
  };
}
