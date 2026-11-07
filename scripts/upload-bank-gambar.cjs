/**
 * Unggah gambar bank soal ke bucket `question-media` dan sambungkan ke soal.
 *
 * Dipisah dari `import-bank-soal.cjs` karena dua alasan:
 *
 * 1. Saat impor pertama, bucket belum ada sehingga 45 unggahan gagal padahal
 *    soalnya sudah masuk. Mengulang seluruh impor akan menggandakan 493 soal.
 * 2. Unggahan bisa diulang dengan aman: berkas yang sudah ada tidak ditimpa
 *    (`upsert: false`), dan `media_path` hanya diisi bila masih kosong.
 *
 * Pemakaian:
 *
 *   node scripts/upload-bank-gambar.cjs --dir "<path bank soal>" --dry-run
 *   node scripts/upload-bank-gambar.cjs --dir "<path bank soal>"
 *
 * Soal dicocokkan lewat `body` (teks pertanyaan) karena id soal di database
 * berupa UUID, sedangkan bank soal memakai kode seperti `MTK-177`. Teks
 * pertanyaan di bank soal unik, jadi pencocokan ini aman — dan skrip
 * memverifikasi keunikan itu sebelum menulis apa pun.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");

const MIME = { ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

function parseArgs(argv) {
  const out = { dir: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dir") out.dir = argv[(i += 1)];
    else if (a === "--dry-run") out.dryRun = true;
  }
  return out;
}

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function bacaSoalBergambar(dir) {
  const hasil = [];
  for (const nama of ["bank-soal-matematika.json", "bank-soal-bahasa-indonesia.json"]) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, nama), "utf8"));
    for (const q of data.soal) {
      if (!q.gambar) continue;
      const opsi = Array.isArray(q.opsi) ? q.opsi.map((o) => String(o).trim()) : [];
      hasil.push({
        kode: q.id,
        body: String(q.pertanyaan ?? "").trim(),
        opsi,
        gambar: String(q.gambar).replace(/\\/g, "/"),
      });
    }
  }
  return hasil;
}

/**
 * Kunci pencocokan: teks pertanyaan + seluruh teks opsi.
 *
 * Teks pertanyaan saja tidak cukup. Soal benar/salah sering memakai kalimat
 * pembuka yang sama persis ("Tentukan Benar atau Salah untuk setiap pernyataan
 * berikut berdasarkan teks tersebut.") — 41 soal Bahasa Indonesia memakainya.
 * Menambahkan opsi membuat kuncinya unik, karena tiap soal punya pernyataan
 * yang berbeda.
 */
function kunciSoal(body, opsi) {
  return `${body}\u0000${opsi.join("\u0001")}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dir) {
    console.error("Wajib menyebut --dir <folder bank soal>.");
    process.exit(1);
  }

  const env = loadEnv();
  const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const bank = bacaSoalBergambar(args.dir);
  console.log(`Soal bergambar di bank: ${bank.length}`);

  /* ---- Petakan kunci soal -> id soal database ---- */
  const { data: soalDb, error: soalErr } = await svc
    .from("questions")
    .select("id, exam_id, body, media_path, question_options(position, body)");

  if (soalErr) throw new Error(`Gagal membaca soal: ${soalErr.message}`);

  const perKunci = new Map();
  for (const s of soalDb) {
    const opsi = (s.question_options ?? [])
      .sort((a, b) => a.position - b.position)
      .map((o) => o.body.trim());
    const key = kunciSoal(s.body.trim(), opsi);
    if (!perKunci.has(key)) perKunci.set(key, []);
    perKunci.get(key).push(s);
  }

  const rencana = [];
  const lewat = [];

  for (const b of bank) {
    const cocok = perKunci.get(kunciSoal(b.body, b.opsi)) ?? [];

    if (cocok.length === 0) {
      lewat.push(`${b.kode}: tidak ditemukan di database`);
      continue;
    }
    if (cocok.length > 1) {
      lewat.push(`${b.kode}: ${cocok.length} soal cocok (ambigu)`);
      continue;
    }
    if (cocok[0].media_path) {
      lewat.push(`${b.kode}: sudah punya gambar`);
      continue;
    }

    const full = path.join(args.dir, b.gambar);
    if (!fs.existsSync(full)) {
      lewat.push(`${b.kode}: berkas hilang (${b.gambar})`);
      continue;
    }

    rencana.push({ ...b, soalId: cocok[0].id, examId: cocok[0].exam_id, full });
  }

  console.log(`Akan diunggah: ${rencana.length}`);
  if (lewat.length) {
    console.log(`\nDilewati (${lewat.length}):`);
    for (const l of lewat) console.log("  - " + l);
  }

  if (args.dryRun) {
    console.log("\n--dry-run: tidak ada yang ditulis.");
    return;
  }

  let ok = 0;
  let gagal = 0;

  for (const r of rencana) {
    const ext = path.extname(r.full).toLowerCase();
    const objek = `${r.examId}/${r.kode.toLowerCase()}-${crypto.randomBytes(4).toString("hex")}${ext}`;

    const { error: upErr } = await svc.storage
      .from("question-media")
      .upload(objek, fs.readFileSync(r.full), {
        contentType: MIME[ext] ?? "application/octet-stream",
        upsert: false,
      });

    if (upErr) {
      console.error(`  ! ${r.kode}: ${upErr.message}`);
      gagal += 1;
      continue;
    }

    const { error: updErr } = await svc
      .from("questions")
      .update({ media_path: objek })
      .eq("id", r.soalId);

    if (updErr) {
      console.error(`  ! ${r.kode}: gagal menyimpan media_path: ${updErr.message}`);
      gagal += 1;
      continue;
    }

    ok += 1;
    console.log(`  ok  ${r.kode} -> ${objek}`);
  }

  console.log(`\nSelesai. Berhasil: ${ok}   Gagal: ${gagal}`);
}

main().catch((err) => {
  console.error("\nGAGAL:", err.message);
  process.exit(1);
});
