/*
 * Uji RPC `save_exam_questions` (migrasi 0025/0026).
 *
 * Kenapa lewat HTTP dan bukan SQL langsung: fungsi ini memanggil `assert_admin()`,
 * yang membaca `auth.uid()` dari JWT. Service role tidak punya `auth.uid()`,
 * jadi satu-satunya cara mengujinya adalah masuk sebagai admin sungguhan lalu
 * memanggil RPC dengan token itu — persis jalur yang dipakai aplikasi.
 *
 *   node scripts/test-save-questions.cjs
 *
 * Skrip ini MEMBUAT ujian uji dan MENGHAPUSNYA di akhir. Kalau gagal di tengah,
 * jalankan lagi — bagian awal membersihkan sisa ujian `UJI SOAL%`.
 */
const fs = require("node:fs");
const path = require("node:path");

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1).trim()];
    }),
);

const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET = env.SUPABASE_SERVICE_ROLE_KEY;

const ADMIN_EMAIL = "admin.uji@sikilat.test";
const ADMIN_PASSWORD = "UjiCoba123!Aman";

let passed = 0;
let failed = 0;

function check(name, condition, extra) {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${extra === undefined ? "" : ` -> ${JSON.stringify(extra)}`}`);
  }
}

async function rest(pathname, options = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${pathname}`, options);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const svcHeaders = {
  apikey: SECRET,
  Authorization: `Bearer ${SECRET}`,
  "Content-Type": "application/json",
};

async function main() {
  /* ---- Bersihkan sisa uji sebelumnya ---- */
  const leftover = await rest("exams?select=id&title=like.UJI%20SOAL*", { headers: svcHeaders });
  if (Array.isArray(leftover.body) && leftover.body.length > 0) {
    const ids = leftover.body.map((row) => row.id).join(",");
    await rest(`exams?id=in.(${ids})`, { method: "DELETE", headers: svcHeaders });
    console.log(`Dibersihkan: ${leftover.body.length} ujian uji lama.`);
  }

  /* ---- Masuk sebagai admin ---- */
  const loginRes = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const login = await loginRes.json();
  if (!login.access_token) throw new Error(`Gagal masuk: ${JSON.stringify(login)}`);

  const authHeaders = {
    apikey: ANON,
    Authorization: `Bearer ${login.access_token}`,
    "Content-Type": "application/json",
  };

  /* ---- Buat ujian uji ---- */
  const created = await rest("exams", {
    method: "POST",
    headers: { ...authHeaders, Prefer: "return=representation" },
    body: JSON.stringify({
      code: `UJI${Date.now().toString(36).slice(-4).toUpperCase()}`,
      created_by: login.user.id,
      title: "UJI SOAL simpan",
      subject_label: "Matematika",
      duration_minutes: 30,
      max_attempts: 1,
    }),
  });
  if (created.status >= 300) throw new Error(`Gagal membuat ujian: ${JSON.stringify(created.body)}`);
  const examId = created.body[0].id;
  console.log(`\nUjian uji: ${examId}\n`);

  const rpc = (payload) =>
    rest("rpc/save_exam_questions", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ p_exam_id: examId, p_questions: payload }),
    });

  const option = (body, isCorrect) => ({ body, isCorrect });

  /* ---- 1. Simpan dua soal + satu esai ---- */
  const valid = [
    {
      type: "mcq_single",
      body: "Hasil dari 7 x 8 adalah ...",
      points: 1,
      explanation: "7 x 8 = 56",
      options: [option("54", false), option("56", true), option("58", false), option("64", false)],
    },
    {
      type: "true_false",
      body: "Tentukan Benar atau Salah.",
      passage: "Teks bacaan untuk dua pernyataan.",
      points: 2,
      options: [option("2 adalah bilangan prima", true), option("4 adalah bilangan prima", false)],
    },
    {
      type: "essay",
      body: "Jelaskan pengertian fotosintesis.",
      points: 5,
      wordMin: 10,
      wordMax: 100,
      referenceAnswer: "Proses tumbuhan membuat makanan.",
      options: [],
    },
  ];

  const first = await rpc(valid);
  check("simpan 3 soal berhasil", first.status < 300, first.body);
  check("balasan: 3 soal", first.body?.questions === 3, first.body);
  check("balasan: 6 opsi", first.body?.options === 6, first.body);

  const stored = await rest(
    `questions?select=id,position,type,body,passage,points,word_min,word_max,reference_answer,` +
      `question_options(position,body,is_correct)&exam_id=eq.${examId}&order=position`,
    { headers: svcHeaders },
  );
  const rows = stored.body;
  check("3 baris soal tersimpan", rows.length === 3, rows.length);
  check("urutan position 1..3", rows.map((r) => r.position).join(",") === "1,2,3", rows.map((r) => r.position));
  check("passage tersimpan", rows[1].passage === "Teks bacaan untuk dua pernyataan.", rows[1].passage);
  check("poin soal 2 = 2", Number(rows[1].points) === 2, rows[1].points);
  check("esai punya word_min 10", rows[2].word_min === 10, rows[2].word_min);
  check("esai punya reference_answer", Boolean(rows[2].reference_answer), rows[2].reference_answer);
  check("esai tanpa opsi", rows[2].question_options.length === 0, rows[2].question_options.length);
  check(
    "kunci soal 1 menunjuk opsi '56'",
    rows[0].question_options.filter((o) => o.is_correct).map((o) => o.body).join(",") === "56",
    rows[0].question_options,
  );
  check(
    "kunci true_false hanya pernyataan benar",
    rows[1].question_options.filter((o) => o.is_correct).map((o) => o.body).join(",") ===
      "2 adalah bilangan prima",
    rows[1].question_options,
  );

  /* ---- 2. Simpan ulang dengan satu soal (penggantian penuh) ---- */
  const second = await rpc([
    {
      type: "mcq_multiple",
      body: "Manakah bilangan prima?",
      points: 3,
      options: [option("2", true), option("4", false), option("5", true), option("9", false)],
    },
  ]);
  check("simpan ulang berhasil", second.status < 300, second.body);
  check("balasan: 1 soal", second.body?.questions === 1, second.body);

  const afterReplace = await rest(`questions?select=id,body&exam_id=eq.${examId}`, {
    headers: svcHeaders,
  });
  check("soal lama benar-benar terhapus", afterReplace.body.length === 1, afterReplace.body.length);
  check(
    "soal baru yang tersisa",
    afterReplace.body[0].body === "Manakah bilangan prima?",
    afterReplace.body[0].body,
  );

  const optsAfter = await rest(
    `question_options?select=body,is_correct&question_id=eq.${afterReplace.body[0].id}&order=position`,
    { headers: svcHeaders },
  );
  check("4 opsi tersimpan", optsAfter.body.length === 4, optsAfter.body.length);
  check(
    "dua kunci untuk PG banyak",
    optsAfter.body.filter((o) => o.is_correct).map((o) => o.body).join(",") === "2,5",
    optsAfter.body,
  );

  /* ---- 3. Penolakan validasi ---- */
  const noKey = await rpc([
    { type: "mcq_single", body: "Tanpa kunci", points: 1, options: [option("A", false), option("B", false)] },
  ]);
  check("soal tanpa kunci ditolak", noKey.status >= 400, noKey.status);
  check(
    "pesan menyebut nomor soal",
    String(noKey.body?.details ?? noKey.body?.message ?? "").includes("Soal 1"),
    noKey.body,
  );

  const twoKeys = await rpc([
    {
      type: "mcq_single",
      body: "Dua kunci",
      points: 1,
      options: [option("A", true), option("B", true)],
    },
  ]);
  check("PG satu jawaban dengan dua kunci ditolak", twoKeys.status >= 400, twoKeys.status);

  const oneOption = await rpc([
    { type: "mcq_single", body: "Satu opsi", points: 1, options: [option("A", true)] },
  ]);
  check("satu opsi ditolak", oneOption.status >= 400, oneOption.status);

  const emptyBody = await rpc([{ type: "essay", body: "   ", points: 1, options: [] }]);
  check("pertanyaan kosong ditolak", emptyBody.status >= 400, emptyBody.status);

  const zeroPoints = await rpc([
    { type: "essay", body: "Poin nol", points: 0, options: [] },
  ]);
  check("poin 0 ditolak", zeroPoints.status >= 400, zeroPoints.status);

  const essayWithOptions = await rpc([
    { type: "essay", body: "Esai beropsi", points: 1, options: [option("A", true), option("B", false)] },
  ]);
  check("esai dengan opsi ditolak", essayWithOptions.status >= 400, essayWithOptions.status);

  /* ---- 4. Penolakan validasi TIDAK menghapus soal lama ---- */
  const stillThere = await rest(`questions?select=id&exam_id=eq.${examId}`, { headers: svcHeaders });
  check(
    "soal lama utuh setelah penyimpanan gagal",
    stillThere.body.length === 1,
    stillThere.body.length,
  );

  /* ---- 5. EXM-09: setelah ada attempt, soal terkunci ---- */
  const attempt = await rest("attempts", {
    method: "POST",
    headers: { ...svcHeaders, Prefer: "return=representation" },
    body: JSON.stringify({
      exam_id: examId,
      participant_name: "Uji Kunci",
      participant_name_norm: "uji kunci",
      attempt_no: 1,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      question_order: [afterReplace.body[0].id],
      max_score: 3,
      token_hash: "uji-soal-token-hash",
      resume_code: "UJI123",
      result_token: `uji-soal-${Date.now()}`,
    }),
  });
  check("attempt uji dibuat", attempt.status < 300, attempt.body);

  const locked = await rpc([{ type: "essay", body: "Tidak boleh masuk", points: 1, options: [] }]);
  check("simpan ditolak setelah ada attempt", locked.status >= 400, locked.status);
  check(
    "kode galat EXAM_LOCKED",
    String(locked.body?.message ?? "").includes("EXAM_LOCKED"),
    locked.body,
  );

  const lockedStill = await rest(`questions?select=id&exam_id=eq.${examId}`, { headers: svcHeaders });
  check("soal tidak berubah saat terkunci", lockedStill.body.length === 1, lockedStill.body.length);

  /* ---- 6. anon ditolak ---- */
  const anonCall = await rest("rpc/save_exam_questions", {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_exam_id: examId, p_questions: [] }),
  });
  check("anon ditolak", anonCall.status >= 400, anonCall.status);

  /* ---- 7. ID ujian ngawur ---- */
  const ghost = await rest("rpc/save_exam_questions", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      p_exam_id: "00000000-0000-0000-0000-000000000000",
      p_questions: [],
    }),
  });
  check("ujian tidak ada -> NOT_FOUND", ghost.status >= 400, ghost.status);
  check("kode NOT_FOUND", String(ghost.body?.message ?? "").includes("NOT_FOUND"), ghost.body);

  /* ---- 8. Audit tercatat ---- */
  const audit = await rest(
    `audit_logs?select=action,after_data&entity_id=eq.${examId}&action=eq.save_exam_questions`,
    { headers: svcHeaders },
  );
  check("audit save_exam_questions tercatat 2x", audit.body.length === 2, audit.body.length);
  check(
    "audit menyimpan jumlah soal",
    audit.body.every((row) => typeof row.after_data?.questions === "number"),
    audit.body,
  );

  /* ---- Bersihkan ---- */
  await rest(`attempts?exam_id=eq.${examId}`, { method: "DELETE", headers: svcHeaders });
  await rest(`exams?id=eq.${examId}`, { method: "DELETE", headers: svcHeaders });

  const gone = await rest(`exams?select=id&id=eq.${examId}`, { headers: svcHeaders });
  check("ujian uji terhapus", gone.body.length === 0, gone.body);

  console.log(`\n${passed}/${passed + failed} pemeriksaan lolos.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("\nGAGAL:", error.message);
  process.exitCode = 1;
});
