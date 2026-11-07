import type { Attempt, AttemptAnswer } from "./types";
import { demoExam, demoExams, demoQuestions } from "./mock-data";

const maxScore = demoQuestions.reduce((sum, q) => sum + q.points, 0);

const NAMES: { name: string; kelas: string }[] = [
  { name: "Rina Kusuma", kelas: "7A" },
  { name: "Bagas Pratama", kelas: "7A" },
  { name: "Nadia Salsabila", kelas: "7A" },
  { name: "Fajar Ramadhan", kelas: "7B" },
  { name: "Alya Rahmawati", kelas: "7B" },
  { name: "Dimas Saputra", kelas: "7B" },
  { name: "Siti Nurhaliza", kelas: "7A" },
  { name: "Yoga Aditya", kelas: "7C" },
  { name: "Kirana Maharani", kelas: "7C" },
  { name: "Rafi Alfarizi", kelas: "7A" },
  { name: "Zahra Aulia", kelas: "7B" },
  { name: "Bima Nugroho", kelas: "7C" },
  { name: "Intan Permata", kelas: "7A" },
  { name: "Raka Wijaya", kelas: "7B" },
  { name: "Melati Putri", kelas: "7C" },
  { name: "Arif Hidayat", kelas: "7A" },
  { name: "Salma Kamila", kelas: "7B" },
  { name: "Dewa Mahendra", kelas: "7C" },
  { name: "Putri Anindita", kelas: "7A" },
  { name: "Gilang Saputro", kelas: "7B" },
  { name: "Ayu Lestari", kelas: "7C" },
  { name: "Hendra Kurnia", kelas: "7A" },
  { name: "Nabila Zahra", kelas: "7B" },
  { name: "Rizal Fadillah", kelas: "7C" },
  { name: "Tania Puspita", kelas: "7A" },
  { name: "Wahyu Setiawan", kelas: "7B" },
];

/**
 * The demo dataset is anchored to a fixed "demo now" instead of the wall clock.
 *
 * Computing it at module load (`Date.now()` rounded to the hour) looked stable
 * but was not: the server evaluates the module once at boot, so after the dev
 * server had been running for an hour the server-rendered clock strings no
 * longer matched the ones the client computed, producing a hydration mismatch.
 * A hard-coded instant keeps every render, server, client, and after any
 * reload, byte-for-byte identical, which is exactly what a mock dataset needs.
 */
const now = new Date("2026-11-05T09:00:00.000Z").getTime(); // 16.00 WIB
const MIN = 60_000;

/** Deterministic pseudo-random so the demo data never changes between renders. */
function pick(seed: number, mod: number) {
  return (seed * 2654435761) % mod;
}

function buildAnswers(seed: number, fillRatio: number): Record<string, AttemptAnswer> {
  const answers: Record<string, AttemptAnswer> = {};
  demoQuestions.forEach((q, qi) => {
    const filled = pick(seed + qi, 100) < fillRatio * 100;
    if (!filled) return;
    if (q.type === "essay") {
      answers[q.id] = {
        questionId: q.id,
        selectedOptionIds: [],
        essayText:
          "Langkah pertama saya menyusun persamaan, lalu mensubstitusi nilai yang diketahui. Setelah dihitung, hasil akhirnya saya periksa kembali agar tidak ada kesalahan tanda.",
        flagged: pick(seed + qi * 3, 10) === 0,
        crossouts: [],
        updatedAt: new Date(now - 12 * MIN).toISOString(),
      };
      return;
    }
    const correct = pick(seed + qi * 7, 100) < 72;
    const ids = correct
      ? q.correctOptionIds
      : q.options.filter((o) => !q.correctOptionIds.includes(o.id)).slice(0, 1).map((o) => o.id);
    answers[q.id] = {
      questionId: q.id,
      selectedOptionIds: ids,
      essayText: "",
      flagged: pick(seed + qi * 5, 9) === 0,
      crossouts: [],
      updatedAt: new Date(now - 9 * MIN).toISOString(),
    };
  });
  return answers;
}

export const demoAttempts: Attempt[] = NAMES.map((person, i) => {
  const inProgress = i < 12;
  const needsGrading = !inProgress && i < 15;
  const startedOffset = inProgress ? 6 + i * 3 : 95 + i * 4;
  const startedAt = new Date(now - startedOffset * MIN);
  const expiresAt = new Date(startedAt.getTime() + demoExam.durationMinutes * MIN);
  const answers = buildAnswers(i + 3, inProgress ? 0.35 + (i % 7) * 0.09 : 0.95);

  // Auto score is derived from the actual answers so the numbers stay consistent
  // with what the grading screen shows for each question.
  const autoScore = demoQuestions.reduce((sum, q) => {
    if (q.type === "essay") return sum;
    const given = [...(answers[q.id]?.selectedOptionIds ?? [])].sort().join(",");
    const key = [...q.correctOptionIds].sort().join(",");
    return given && given === key ? sum + q.points : sum;
  }, 0);

  const essayMax = demoQuestions
    .filter((q) => q.type === "essay")
    .reduce((sum, q) => sum + q.points, 0);
  // 60–95% of essay points once graded, scaled to whole points.
  const manualScore = needsGrading
    ? 0
    : Math.round(essayMax * (0.6 + (pick(i + 7, 35) / 100)) * 2) / 2;

  return {
    id: `att_${String(i + 1).padStart(2, "0")}`,
    examId: demoExam.id,
    participantName: person.name,
    participantClass: person.kelas,
    attemptNo: 1,
    status: inProgress ? "in_progress" : needsGrading ? "needs_grading" : "graded",
    submitReason: inProgress ? undefined : i % 9 === 0 ? "timeout" : "manual",
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    submittedAt: inProgress ? undefined : new Date(startedAt.getTime() + 47 * MIN).toISOString(),
    questionOrder: demoQuestions.map((q) => q.id),
    answers,
    scoreAuto: autoScore,
    scoreManual: manualScore,
    maxScore,
    resumeCode: `K${(i + 1).toString().padStart(2, "0")}M2Q`,
    resultToken: `res_${String(i + 1).padStart(2, "0")}`,
    events: [
      { id: "e1", type: "start", at: startedAt.toISOString() },
      ...(pick(i + 2, 5) === 0
        ? ([
            {
              id: "e2",
              type: "tab_hidden",
              at: new Date(startedAt.getTime() + 18 * MIN).toISOString(),
            },
          ] as Attempt["events"])
        : []),
    ],
  };
});

export const gradedAttempts = demoAttempts.filter((a) => a.status === "graded");
export const activeAttempts = demoAttempts.filter((a) => a.status === "in_progress");
export const pendingAttempts = demoAttempts.filter((a) => a.status === "needs_grading");

export function attemptTotal(attempt: Attempt) {
  return attempt.scoreAuto + attempt.scoreManual;
}

export function attemptPercent(attempt: Attempt) {
  return Math.round((attemptTotal(attempt) / attempt.maxScore) * 1000) / 10;
}

export function answeredIn(attempt: Attempt) {
  return demoQuestions.filter((q) => {
    const ans = attempt.answers[q.id];
    if (!ans) return false;
    return q.type === "essay" ? ans.essayText.trim().length > 0 : ans.selectedOptionIds.length > 0;
  }).length;
}

export function remainingMinutes(attempt: Attempt) {
  const diff = new Date(attempt.expiresAt).getTime() - now;
  return Math.max(0, Math.round(diff / MIN));
}

export function examSummary() {
  const scores = gradedAttempts.map(attemptPercent).sort((a, b) => a - b);
  const sum = scores.reduce((acc, v) => acc + v, 0);
  const average = scores.length ? Math.round((sum / scores.length) * 10) / 10 : 0;
  const median = scores.length
    ? scores.length % 2
      ? scores[(scores.length - 1) / 2]
      : Math.round(((scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2) * 10) / 10
    : 0;
  const passCount = gradedAttempts.filter((a) => attemptPercent(a) >= demoExam.passingScore).length;

  return {
    total: demoAttempts.length,
    graded: gradedAttempts.length,
    active: activeAttempts.length,
    pending: pendingAttempts.length,
    average,
    median,
    highest: scores.length ? scores[scores.length - 1] : 0,
    lowest: scores.length ? scores[0] : 0,
    passRate: gradedAttempts.length
      ? Math.round((passCount / gradedAttempts.length) * 1000) / 10
      : 0,
    passCount,
  };
}

export const scoreBands = [
  { label: "0–39", min: 0, max: 39.99 },
  { label: "40–54", min: 40, max: 54.99 },
  { label: "55–69", min: 55, max: 69.99 },
  { label: "70–84", min: 70, max: 84.99 },
  { label: "85–100", min: 85, max: 100 },
];

export function findExam(id: string) {
  return demoExams.find((e) => e.id === id);
}
