/*
 * Uji alur peserta ujung-ke-ujung, lalu halaman admin yang membacanya.
 *
 *   node scripts/test-participant-flow.cjs
 *
 * Alur yang diuji:
 *   1. `/u/<kode>` menampilkan info ujian nyata dari database.
 *   2. Mulai percobaan -> `/u/<kode>/kerjakan`.
 *   3. Jawab beberapa soal, muat ulang halaman, jawaban tetap ada (tersimpan
 *      ke server, bukan hanya di memori).
 *   4. Kumpulkan -> diarahkan ke `/hasil/<token>`.
 *   5. Monitor, rekap nilai, dan halaman penilaian admin menampilkan attempt
 *      yang baru dibuat itu — bukan data contoh.
 *   6. Bersihkan: hapus attempt uji.
 *
 * Ujian yang dipakai adalah `CONTOH1` (published, rilis instan, 12 soal). Skrip
 * ini tidak mengubah ujian itu sendiri.
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
const EXAM_CODE = "CONTOH1";
const ADMIN_EMAIL = "admin.uji@sikilat.test";
const ADMIN_PASSWORD = "UjiCoba123!Aman";
const PARTICIPANT = "Peserta Uji Coba";
const PARTICIPANT_CLASS = "9A";

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

const svcHeaders = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function rest(pathname, options = {}) {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${pathname}`, options);
  const text = await res.text();
  try {
    return { status: res.status, body: text ? JSON.parse(text) : null };
  } catch {
    return { status: res.status, body: text };
  }
}

async function main() {
  /* ---- Bersihkan sisa uji sebelumnya ---- */
  const exam = await rest(`exams?select=id,title&code=eq.${EXAM_CODE}`, { headers: svcHeaders });
  if (!Array.isArray(exam.body) || exam.body.length === 0) {
    throw new Error(`Ujian ${EXAM_CODE} tidak ada. Jalankan supabase/seed.sql dulu.`);
  }
  const examId = exam.body[0].id;

  const leftover = await rest(
    `attempts?select=id&exam_id=eq.${examId}&participant_name=eq.${encodeURIComponent(PARTICIPANT)}`,
    { headers: svcHeaders },
  );
  if (Array.isArray(leftover.body) && leftover.body.length > 0) {
    await rest(`attempts?id=eq.${leftover.body[0].id}`, { method: "DELETE", headers: svcHeaders });
    console.log("Dibersihkan: attempt uji lama.");
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 900, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  /* ---- 1. Halaman pra-ujian ---- */
  await page.goto(`${BASE}/u/${EXAM_CODE}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Mulai", { timeout: 60_000 });
  await page.waitForTimeout(1200);

  let body = await page.textContent("body");
  check("halaman peserta memuat judul ujian nyata", (body ?? "").includes(exam.body[0].title));
  check("halaman peserta menampilkan kode ujian", (body ?? "").includes(EXAM_CODE));

  /* ---- 2. Mulai percobaan ---- */
  await page.fill("#nama", PARTICIPANT);
  await page.fill("#kelas", PARTICIPANT_CLASS);

  await page.click("button:has-text('Mulai')");
  await page.waitForURL(/\/kerjakan/, { timeout: 90_000 });
  await page.waitForTimeout(2500);
  check("diarahkan ke halaman pengerjaan", /\/kerjakan/.test(page.url()), page.url());

  /* ---- 3. Jawab beberapa soal ---- */
  /*
   * Opsi jawaban dirender sebagai `div[role=radio]` / `div[role=checkbox]`, bukan
   * `<button>`, jadi selektor tombol tidak menemukannya. Soal Benar/Salah
   * memakai tombol Benar/Salah di dalam `div[role=radiogroup]`.
   */
  const answered = [];
  for (let i = 0; i < 3; i += 1) {
    const radio = page.locator("div[role=radio]");
    const checkbox = page.locator("div[role=checkbox]");
    const trueFalse = page.locator("div[role=radiogroup] button");

    if ((await radio.count()) > 0) {
      await radio.first().click();
      answered.push(i + 1);
    } else if ((await checkbox.count()) > 0) {
      await checkbox.first().click();
      answered.push(i + 1);
    } else if ((await trueFalse.count()) > 0) {
      await trueFalse.first().click();
      answered.push(i + 1);
    } else {
      break;
    }

    /* Tunggu simpanan otomatis (debounce 800 ms) selesai. */
    await page.waitForTimeout(1800);

    const next = page.locator("button:has-text('Selanjutnya')");
    if ((await next.count()) > 0) {
      await next.first().click();
      await page.waitForTimeout(1200);
    }
  }
  check("berhasil menjawab beberapa soal", answered.length > 0, answered);

  /* ---- 3b. Muat ulang: jawaban harus tetap ada ---- */
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const navigatorButtons = page.locator("[aria-label*='Navigasi soal'], nav button");
  const navigatorCount = await navigatorButtons.count();
  check("navigasi soal tetap tampil setelah muat ulang", navigatorCount > 0, navigatorCount);

  body = await page.textContent("body");
  check(
    "tidak ada peringatan sesi hilang setelah muat ulang",
    !/sesi.*(habis|berakhir|tidak ditemukan)/i.test(body ?? ""),
  );

  /*
   * Bukti bahwa jawaban benar-benar tersimpan di server, bukan hanya di memori
   * peramban: setelah muat ulang, hitungan "terjawab" pada bilah bawah harus
   * lebih dari nol.
   */
  const answeredLabel = (body ?? "").match(/(\d+)\s*terjawab/);
  check(
    "jawaban bertahan setelah muat ulang",
    answeredLabel !== null && Number(answeredLabel[1]) > 0,
    answeredLabel?.[0],
  );

  /* ---- 4. Kumpulkan ---- */
  const submit = page.locator("button:has-text('Kumpulkan')").last();
  await submit.click({ timeout: 30_000 });
  await page.waitForTimeout(800);

  const confirm = page.locator("button:has-text('Ya, kumpulkan'), button:has-text('Kumpulkan sekarang')");
  if ((await confirm.count()) > 0) {
    await confirm.first().click();
  }

  await page.waitForURL(/\/hasil\//, { timeout: 90_000 });
  await page.waitForTimeout(2000);
  check("diarahkan ke halaman hasil", /\/hasil\//.test(page.url()), page.url());

  body = await page.textContent("body");
  check("halaman hasil menampilkan nama peserta", (body ?? "").includes(PARTICIPANT));

  /* ---- 5. Admin melihat attempt yang sama ---- */
  const attempt = await rest(
    `attempts?select=id,status,total_score,max_score,participant_name&exam_id=eq.${examId}`,
    { headers: svcHeaders },
  );
  check("attempt tercatat di database", Array.isArray(attempt.body) && attempt.body.length === 1);
  const attemptRow = attempt.body[0];

  /*
   * `CONTOH1` punya dua soal esai, jadi setelah dikumpulkan statusnya memang
   * `needs_grading` — bukan `graded`. Itu perilaku yang benar: nilai akhir baru
   * final setelah esai dinilai. Yang diperiksa di sini adalah status itu, lalu
   * esainya dinilai lewat UI admin supaya `grade_essay` ikut teruji.
   */
  check(
    "attempt menunggu penilaian esai",
    attemptRow?.status === "needs_grading",
    attemptRow?.status,
  );
  /*
   * `max_score` terisi hanya kalau penilaian otomatis benar-benar berjalan.
   * Nilai 0 untuk `total_score` sah — tiga opsi pertama yang dipilih bisa saja
   * semuanya salah — jadi yang diperiksa adalah skornya berada dalam rentang,
   * bukan bahwa ia lebih dari nol.
   */
  check("penilaian otomatis berjalan (max_score terisi)", Number(attemptRow?.max_score) > 0, attemptRow?.max_score);
  check(
    "nilai objektif dalam rentang yang sah",
    Number(attemptRow?.total_score) >= 0 && Number(attemptRow?.total_score) <= Number(attemptRow?.max_score),
    { total: attemptRow?.total_score, max: attemptRow?.max_score },
  );

  const answers = await rest(
    `attempt_answers?select=question_id&attempt_id=eq.${attemptRow.id}`,
    { headers: svcHeaders },
  );
  check(
    "jawaban peserta tersimpan di server",
    Array.isArray(answers.body) && answers.body.length >= answered.length,
    { saved: answers.body?.length, answered: answered.length },
  );

  const adminContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const admin = await adminContext.newPage();

  await admin.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
  await admin.waitForSelector("input[type=email]", { timeout: 60_000 });
  await admin.waitForTimeout(1500);
  await admin.fill("input[type=email]", ADMIN_EMAIL);
  await admin.fill("input[type=password]", ADMIN_PASSWORD);
  await admin.click("button[type=submit]");
  await admin.waitForURL((url) => url.pathname === "/admin", { timeout: 60_000 });

  await admin.goto(`${BASE}/admin/exams/${examId}/monitor`, { waitUntil: "domcontentloaded" });
  await admin.waitForTimeout(1800);
  body = await admin.textContent("body");
  check("monitor menampilkan peserta nyata", (body ?? "").includes(PARTICIPANT));
  check("monitor tidak lagi kosong", !/Belum ada peserta/i.test(body ?? ""));

  await admin.goto(`${BASE}/admin/exams/${examId}/results`, { waitUntil: "domcontentloaded" });
  await admin.waitForTimeout(1800);
  body = await admin.textContent("body");
  check("rekap menampilkan peserta nyata", (body ?? "").includes(PARTICIPANT));
  check("rekap menampilkan baris tabel", /1 baris/.test(body ?? ""), body?.match(/\d+ baris/));

  /* ---- 5b. Nilai esai lewat UI admin ---- */
  await admin.goto(`${BASE}/admin/exams/${examId}/grading/${attemptRow.id}`, {
    waitUntil: "domcontentloaded",
  });
  await admin.waitForSelector("text=Beri nilai", { timeout: 60_000 });
  await admin.waitForTimeout(1800);
  body = await admin.textContent("body");
  check("halaman penilaian menampilkan peserta nyata", (body ?? "").includes(PARTICIPANT));

  /* Dua esai: beri nilai penuh pada masing-masing lewat tombol poin. */
  for (let i = 0; i < 2; i += 1) {
    const pointButtons = admin.locator("button[aria-label^='Beri ']");
    const count = await pointButtons.count();
    if (count === 0) break;
    await pointButtons.nth(count - 1).click();
    await admin.waitForTimeout(400);

    await admin.click("button:has-text('Simpan dan lanjut')");
    await admin.waitForTimeout(3500);
  }

  const afterGrading = await rest(
    `attempts?select=status,score_manual,total_score&id=eq.${attemptRow.id}`,
    { headers: svcHeaders },
  );
  check(
    "attempt menjadi graded setelah semua esai dinilai",
    afterGrading.body?.[0]?.status === "graded",
    afterGrading.body?.[0]?.status,
  );
  check(
    "nilai manual tercatat",
    Number(afterGrading.body?.[0]?.score_manual) > 0,
    afterGrading.body?.[0]?.score_manual,
  );

  await browser.close();

  /* ---- 6. Bersihkan ---- */
  await rest(`attempts?id=eq.${attemptRow.id}`, { method: "DELETE", headers: svcHeaders });
  const gone = await rest(`attempts?select=id&exam_id=eq.${examId}`, { headers: svcHeaders });
  check("attempt uji terhapus", gone.body.length === 0, gone.body.length);

  check("tidak ada error konsol", consoleErrors.length === 0, consoleErrors.slice(0, 3));

  console.log(`\n${passed}/${passed + failed} pemeriksaan lolos.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("\nGAGAL:", error.message);
  process.exitCode = 1;
});
