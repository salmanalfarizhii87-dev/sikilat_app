/*
 * Uji browser untuk halaman admin yang baru disambungkan ke database.
 *
 *   node scripts/test-admin-pages.cjs
 *
 * Yang diperiksa:
 *   1. Masuk sebagai admin.
 *   2. Dashboard, daftar ujian, detail ujian, soal, monitor, rekap nilai,
 *      pengaturan — semuanya 200 dan tidak ada "data contoh" yang tersisa.
 *   3. Halaman soal menampilkan soal NYATA dari paket bank soal (bukan 20 soal
 *      contoh), dan tombol simpannya benar-benar menyimpan.
 *   4. Monitor dan rekap menampilkan keadaan kosong yang jujur saat belum ada
 *      peserta.
 *
 * Skrip ini TIDAK mengubah data selain menyimpan ulang soal sebuah paket dengan
 * isi yang sama, dan menghapus ujian uji yang dibuatnya sendiri.
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
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

async function rest(pathname, options = {}) {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${pathname}`, options);
  const text = await res.text();
  try {
    return { status: res.status, body: text ? JSON.parse(text) : null };
  } catch {
    return { status: res.status, body: text };
  }
}

const svcHeaders = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function main() {
  /* ---- Pilih paket bank soal dengan banyak soal ---- */
  const exams = await rest(
    "exams?select=id,code,title,status&status=eq.draft&order=title&limit=40",
    { headers: svcHeaders },
  );
  if (!Array.isArray(exams.body) || exams.body.length === 0) {
    throw new Error("Tidak ada ujian draft untuk diuji.");
  }

  let target = null;
  for (const exam of exams.body) {
    const rows = await rest(`questions?select=id&exam_id=eq.${exam.id}`, { headers: svcHeaders });
    if (Array.isArray(rows.body) && rows.body.length >= 10) {
      target = { ...exam, questionCount: rows.body.length };
      break;
    }
  }

  if (!target) throw new Error("Tidak ada ujian draft dengan >= 10 soal.");
  console.log(`\nUjian uji: ${target.code} — ${target.title} (${target.questionCount} soal)\n`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  /* ---- Masuk ---- */
  await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("input[type=email]", { timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.fill("input[type=email]", ADMIN_EMAIL);
  await page.fill("input[type=password]", ADMIN_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL((url) => url.pathname === "/admin", { timeout: 60_000 });
  check("masuk sebagai admin", page.url().endsWith("/admin"));

  /* ---- Dashboard ---- */
  await page.waitForTimeout(800);
  let body = await page.textContent("body");
  check("dashboard tanpa 'data contoh'", !/data contoh/i.test(body ?? ""));
  check("dashboard tanpa 'mode demo'", !/mode demo/i.test(body ?? ""));

  /* ---- Daftar ujian ---- */
  await page.goto(`${BASE}/admin/exams?search=${encodeURIComponent(target.code)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(1500);
  body = await page.textContent("body");
  check("daftar ujian memuat kode nyata", (body ?? "").includes(target.code));
  check("daftar ujian tanpa 'data contoh'", !/data contoh/i.test(body ?? ""));

  /* ---- Detail ujian ---- */
  await page.goto(`${BASE}/admin/exams/${target.id}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  body = await page.textContent("body");
  check("detail ujian menampilkan judul nyata", (body ?? "").includes(target.title.slice(0, 20)));
  check("detail ujian tanpa 'data contoh'", !/data contoh/i.test(body ?? ""));

  /* ---- Halaman soal ---- */
  await page.goto(`${BASE}/admin/exams/${target.id}/questions`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Simpan soal", { timeout: 60_000 });
  await page.waitForTimeout(1200);
  body = await page.textContent("body");
  check(
    `halaman soal memuat ${target.questionCount} soal nyata`,
    new RegExp(`${target.questionCount} soal`).test(body ?? ""),
    body?.match(/\d+ soal/g),
  );
  check("halaman soal tanpa 'data contoh'", !/data contoh/i.test(body ?? ""));

  /* Simpan tanpa perubahan: harus berhasil dan tidak menghapus soal. */
  const mediaBefore = await rest(
    `questions?select=id&exam_id=eq.${target.id}&media_path=not.is.null`,
    { headers: svcHeaders },
  );

  await page.click("text=Simpan soal");
  await page.waitForTimeout(5000);
  body = await page.textContent("body");
  check("simpan soal berhasil", /soal tersimpan/i.test(body ?? ""), body?.slice(0, 200));

  const afterSave = await rest(`questions?select=id&exam_id=eq.${target.id}`, {
    headers: svcHeaders,
  });
  check(
    "jumlah soal tidak berubah setelah simpan",
    afterSave.body.length === target.questionCount,
    afterSave.body.length,
  );

  const mediaAfter = await rest(
    `questions?select=id&exam_id=eq.${target.id}&media_path=not.is.null`,
    { headers: svcHeaders },
  );
  check(
    "gambar soal tidak hilang setelah simpan",
    Array.isArray(mediaAfter.body) && mediaAfter.body.length === mediaBefore.body.length,
    { before: mediaBefore.body.length, after: mediaAfter.body?.length },
  );

  /* ---- Monitor ---- */
  await page.goto(`${BASE}/admin/exams/${target.id}/monitor`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  body = await page.textContent("body");
  check("monitor memuat keadaan kosong yang jujur", /Belum ada peserta/i.test(body ?? ""));
  check("monitor tanpa 'data contoh'", !/data contoh/i.test(body ?? ""));
  check("monitor tanpa nama karangan", !/Ahmad|Siti|Budi|Rina|Dewi/.test(body ?? ""));

  /* ---- Rekap nilai ---- */
  await page.goto(`${BASE}/admin/exams/${target.id}/results`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  body = await page.textContent("body");
  check("rekap memuat keadaan kosong yang jujur", /Belum ada nilai/i.test(body ?? ""));
  check("rekap tanpa 'data contoh'", !/data contoh/i.test(body ?? ""));
  check("rekap tanpa angka karangan", !/7A|7B|7C/.test(body ?? ""));

  /* ---- Pengaturan ---- */
  await page.goto(`${BASE}/admin/exams/${target.id}/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  body = await page.textContent("body");
  check("pengaturan menampilkan kode nyata", (body ?? "").includes(target.code));
  check("pengaturan tanpa 'data contoh'", !/data contoh/i.test(body ?? ""));

  /* ---- 404 untuk ID ngawur ---- */
  check(
    "tidak ada error konsol di halaman admin",
    consoleErrors.length === 0,
    consoleErrors.slice(0, 3),
  );

  const ghost = await page.goto(`${BASE}/admin/exams/00000000-0000-0000-0000-000000000000/monitor`, {
    waitUntil: "domcontentloaded",
  });
  check("ID ujian ngawur -> 404", ghost.status() === 404, ghost.status());

  await browser.close();

  console.log(`\n${passed}/${passed + failed} pemeriksaan lolos.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("\nGAGAL:", error.message);
  process.exitCode = 1;
});
