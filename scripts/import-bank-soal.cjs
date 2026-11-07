/**
 * Impor bank soal TKA ke database KilatCBT.
 *
 * Sumber: folder `bank-soal-tka-lengkap` berisi dua berkas JSON (Matematika 256
 * soal, Bahasa Indonesia 237 soal) beserta aset gambarnya.
 *
 * Pemakaian:
 *
 *   node scripts/import-bank-soal.cjs --dir "<path bank soal>" --dry-run
 *   node scripts/import-bank-soal.cjs --dir "<path bank soal>"
 *
 * `--dry-run` menampilkan seluruh rencana (paket, jumlah soal, gambar) tanpa
 * menulis apa pun ke database. Selalu jalankan ini lebih dulu.
 *
 * ---------------------------------------------------------------------------
 * Keputusan pemetaan
 * ---------------------------------------------------------------------------
 * 1. **Tipe soal**
 *    - `pilihan_ganda`          -> `mcq_single`  (kunci = indeks)
 *    - `pilihan_ganda_kompleks` -> `mcq_multiple` (kunci = array indeks)
 *    - `benar_salah`            -> `true_false`   (kunci = array boolean)
 *    - `esai`                   -> `essay`        (tidak ada di bank soal ini)
 *
 * 2. **Benar/Salah**
 *    Setiap pernyataan menjadi satu opsi. Pernyataan yang bernilai `true`
 *    ditandai `is_correct`; yang `false` tidak. Dengan begitu aturan penilaian
 *    "semua benar" yang sudah ada otomatis menilai soal ini dengan tepat.
 *
 * 3. **Teks bacaan** masuk kolom `passage`, bukan ditempel ke `body`.
 *
 * 4. **Gambar** diunggah ke bucket privat `question-media` lalu `media_path`
 *    diisi path objeknya (bukan URL). URL bertanda tangan dibuat saat peserta
 *    membuka soal.
 *
 * 5. **Paket** mengikuti `sumber.paket` bila ada. Soal tanpa paket
 *    dikelompokkan per topik agar tetap terbagi rapi.
 *
 * 6. **Poin** seragam 1 per soal. Bank soal tidak menyimpan bobot, dan
 *    mengarang bobot per soal akan menyiratkan penilaian yang tidak dimaksud
 *    penyusunnya. Nilai akhir karena itu = jumlah soal benar.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");

/* -------------------------------------------------------------------------- */
/* Argumen dan lingkungan                                                     */
/* -------------------------------------------------------------------------- */

function parseArgs(argv) {
  const out = { dir: null, dryRun: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dir") out.dir = argv[(i += 1)];
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--force") out.force = true;
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

/* -------------------------------------------------------------------------- */
/* Baca dan normalkan bank soal                                               */
/* -------------------------------------------------------------------------- */

const TIPE_MAP = {
  pilihan_ganda: "mcq_single",
  pilihan_ganda_kompleks: "mcq_multiple",
  benar_salah: "true_false",
  esai: "essay",
};

const MIME = { ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

function bacaBank(dir) {
  const berkas = ["bank-soal-matematika.json", "bank-soal-bahasa-indonesia.json"];
  const hasil = [];

  for (const nama of berkas) {
    const full = path.join(dir, nama);
    if (!fs.existsSync(full)) throw new Error(`Berkas tidak ditemukan: ${full}`);

    const data = JSON.parse(fs.readFileSync(full, "utf8"));
    for (const q of data.soal) {
      hasil.push({ ...q, _sumberBerkas: nama });
    }
  }

  return hasil;
}

/**
 * Ubah satu soal bank menjadi bentuk yang siap ditulis.
 *
 * Mengembalikan `{ ok: false, alasan }` alih-alih melempar: satu soal cacat
 * tidak boleh membatalkan impor 492 soal lain. Yang gagal dilaporkan di akhir.
 */
function normalkan(q) {
  const tipe = TIPE_MAP[q.tipe];
  if (!tipe) return { ok: false, alasan: `tipe tidak dikenal: ${q.tipe}` };

  const opsi = Array.isArray(q.opsi) ? q.opsi : [];
  if (opsi.length < 2) return { ok: false, alasan: `opsi kurang dari 2 (${opsi.length})` };

  const body = String(q.pertanyaan ?? "").trim();
  if (!body) return { ok: false, alasan: "pertanyaan kosong" };

  let kunci = [];

  if (tipe === "mcq_single") {
    if (typeof q.kunci !== "number" || q.kunci < 0 || q.kunci >= opsi.length) {
      return { ok: false, alasan: `kunci tidak valid: ${JSON.stringify(q.kunci)}` };
    }
    kunci = [q.kunci];
  } else if (tipe === "mcq_multiple") {
    if (!Array.isArray(q.kunci) || q.kunci.length === 0) {
      return { ok: false, alasan: `kunci kompleks kosong: ${JSON.stringify(q.kunci)}` };
    }
    if (q.kunci.some((i) => typeof i !== "number" || i < 0 || i >= opsi.length)) {
      return { ok: false, alasan: `kunci kompleks di luar jangkauan: ${JSON.stringify(q.kunci)}` };
    }
    kunci = [...new Set(q.kunci)];
  } else if (tipe === "true_false") {
    if (!Array.isArray(q.kunci) || q.kunci.length !== opsi.length) {
      return { ok: false, alasan: `kunci benar/salah tidak sejajar opsi (${q.kunci?.length} vs ${opsi.length})` };
    }
    if (q.kunci.some((v) => typeof v !== "boolean")) {
      return { ok: false, alasan: "kunci benar/salah bukan boolean" };
    }
    // Pernyataan yang bernilai Benar -> jadi opsi bertanda `is_correct`.
    kunci = q.kunci.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    if (kunci.length === 0) return { ok: false, alasan: "semua pernyataan bernilai Salah" };
  }

  const gambar = q.gambar ? String(q.gambar).replace(/\\/g, "/") : null;

  return {
    ok: true,
    soal: {
      kode: q.id,
      tipe,
      body,
      passage: q.teks_bacaan ? String(q.teks_bacaan).trim() : null,
      opsi: opsi.map((o) => String(o).trim()),
      kunci,
      pembahasan: q.pembahasan ? String(q.pembahasan).trim() : null,
      gambar,
      mapel: q.mapel,
      topik: q.topik ? String(q.topik) : null,
      paket: q.sumber?.paket ?? null,
      sumber: q.sumber?.nama ?? null,
      tahun: q.tahun ?? null,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Pengelompokan paket                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Bagi soal menjadi paket.
 *
 * Aturan, berurutan:
 * 1. Kalau soal punya `sumber.paket`, paket itu yang dipakai.
 * 2. Kalau tidak, kelompokkan per mapel + topik.
 *
 * Nama paket diberi awalan mapel supaya dua paket berbeda mapel yang kebetulan
 * bernama sama tidak tergabung.
 */
function bagiPaket(daftar) {
  const peta = new Map();

  for (const s of daftar) {
    let nama;
    if (s.paket) {
      nama = s.paket;
    } else {
      const topik = (s.topik ?? "Lain-lain").split("—")[0].trim();
      nama = `Latihan ${topik}`;
    }

    // Paket dari sumber sudah menyebut mapelnya; paket topik belum.
    const label = s.paket ? nama : `${s.mapel} — ${nama}`;
    const key = `${s.mapel}::${label}`;

    if (!peta.has(key)) {
      peta.set(key, { nama: label, mapel: s.mapel, soal: [] });
    }
    peta.get(key).soal.push(s);
  }

  return [...peta.values()].sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

/* -------------------------------------------------------------------------- */
/* Utilitas                                                                   */
/* -------------------------------------------------------------------------- */

const acak = (n = 6) => {
  const ab = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < n; i += 1) s += ab[crypto.randomInt(ab.length)];
  return s;
};

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

/* -------------------------------------------------------------------------- */
/* Jalur utama                                                                */
/* -------------------------------------------------------------------------- */

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.dir) {
    console.error("Wajib menyebut --dir <folder bank soal>.");
    process.exit(1);
  }
  if (!fs.existsSync(args.dir)) {
    console.error(`Folder tidak ada: ${args.dir}`);
    process.exit(1);
  }

  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tidak ada di .env.local.");
    process.exit(1);
  }

  const svc = createClient(url, key, { auth: { persistSession: false } });

  /* ---- Baca ---- */
  const mentah = bacaBank(args.dir);
  console.log(`Dibaca ${mentah.length} soal dari ${args.dir}`);

  const valid = [];
  const gagal = [];
  for (const q of mentah) {
    const n = normalkan(q);
    if (n.ok) valid.push(n.soal);
    else gagal.push(`${q.id}: ${n.alasan}`);
  }

  console.log(`Valid: ${valid.length}   Ditolak: ${gagal.length}`);
  if (gagal.length) {
    console.log("\nSoal yang ditolak:");
    for (const g of gagal) console.log("  - " + g);
  }

  const paket = bagiPaket(valid);
  const jumlahGambar = valid.filter((s) => s.gambar).length;

  console.log(`\nRencana: ${paket.length} paket, ${valid.length} soal, ${jumlahGambar} gambar.\n`);
  for (const p of paket) {
    const tf = p.soal.filter((s) => s.tipe === "true_false").length;
    const mm = p.soal.filter((s) => s.tipe === "mcq_multiple").length;
    const gm = p.soal.filter((s) => s.gambar).length;
    console.log(
      `  ${String(p.soal.length).padStart(3)} soal  ${p.nama}` +
        (tf || mm || gm ? `  (benar/salah ${tf}, banyak jawaban ${mm}, gambar ${gm})` : ""),
    );
  }

  if (args.dryRun) {
    console.log("\n--dry-run: tidak ada yang ditulis ke database.");
    return;
  }

  /* ---- Cek duplikat kode ujian ---- */
  const kodeAkanDipakai = paket.map(() => acak());
  const { data: kodeAda, error: kodeErr } = await svc
    .from("exams")
    .select("code")
    .in("code", kodeAkanDipakai);
  if (kodeErr) throw new Error(`Gagal memeriksa kode: ${kodeErr.message}`);
  if ((kodeAda ?? []).length) {
    throw new Error(`Kode bentrok: ${kodeAda.map((k) => k.code).join(", ")}. Jalankan ulang.`);
  }

  /* ---- Admin pembuat ---- */
  const { data: admin, error: adminErr } = await svc.from("admins").select("user_id").limit(1).single();
  if (adminErr || !admin) throw new Error("Tidak ada baris di tabel admins.");

  /* ---- Bucket gambar harus ada SEBELUM satu soal pun ditulis ---- */
  /*
   * Bucket `question-media` dideklarasikan di `config.toml`, tetapi berkas itu
   * hanya berlaku untuk lingkungan LOKAL — `db push` tidak membuat bucket di
   * cloud. Saat impor pertama, ketiadaannya baru terlihat setelah 493 soal
   * masuk, sehingga gambar harus diunggah menyusul. Pemeriksaan ini membuat
   * masalah yang sama gagal cepat, sebelum ada data yang perlu dibereskan.
   */
  if (jumlahGambar > 0) {
    const { data: buckets, error: bucketErr } = await svc.storage.listBuckets();
    if (bucketErr) throw new Error(`Gagal memeriksa bucket: ${bucketErr.message}`);
    const ada = (buckets ?? []).some((b) => b.id === "question-media");
    if (!ada) {
      throw new Error(
        "Bucket 'question-media' belum ada di project ini. " +
          "Jalankan migrasi 20261107002000_storage_bucket_question_media.sql lebih dulu " +
          "(npx supabase db push --remote). Tanpa bucket, 45 soal akan kehilangan gambarnya.",
      );
    }
  }

  /* ---- Jalankan ---- */
  const ringkasan = [];
  /**
   * Gambar yang gagal diunggah.
   *
   * Sebelumnya kegagalan unggah hanya `console.warn`, soal tetap dibuat tanpa
   * gambar, dan skrip keluar dengan kode 0 — sehingga impor tampak berhasil
   * padahal 45 soal kehilangan gambarnya (persis yang terjadi saat bucket
   * `question-media` belum ada). Soal yang bergambar tanpa gambarnya bukan soal
   * yang bisa dikerjakan, jadi kegagalan ini harus terlihat: dicatat, diringkas
   * di akhir, dan membuat exit code non-nol.
   */
  const gambarGagal = [];

  for (let i = 0; i < paket.length; i += 1) {
    const p = paket[i];
    const kode = kodeAkanDipakai[i];

    // Durasi: 1,5 menit per soal, dibatasi 20..120 menit.
    const durasi = Math.min(120, Math.max(20, Math.ceil(p.soal.length * 1.5)));

    const { data: exam, error: examErr } = await svc
      .from("exams")
      .insert({
        code: kode,
        created_by: admin.user_id,
        title: p.nama,
        subject_label: p.mapel,
        description: `Bank soal TKA ${p.mapel} — ${p.soal.length} soal.`,
        instructions:
          "Baca setiap soal dengan teliti. Untuk soal benar/salah, tentukan Benar atau Salah pada setiap pernyataan. " +
          "Untuk soal pilihan ganda banyak jawaban, pilih semua jawaban yang benar.",
        status: "draft",
        duration_minutes: durasi,
        max_attempts: 1,
        score_policy: "highest",
        // Bank soal tidak menyimpan KKM. NULL berarti "tanpa KKM" — berbeda
        // dari 0 yang berarti semua peserta lulus.
        passing_score: null,
        shuffle_questions: true,
        shuffle_options: true,
        ask_class: true,
        result_visibility: "score_only",
        result_release: "after_close",
      })
      .select("id")
      .single();

    if (examErr) throw new Error(`Gagal membuat ujian "${p.nama}": ${examErr.message}`);

    /* ---- Soal + opsi ---- */
    for (let pos = 0; pos < p.soal.length; pos += 1) {
      const s = p.soal[pos];

      let mediaPath = null;

      if (s.gambar) {
        const full = path.join(args.dir, s.gambar);
        if (!fs.existsSync(full)) {
          gambarGagal.push(`${s.kode}: berkas tidak ada (${s.gambar})`);
        } else {
          const ext = path.extname(full).toLowerCase();
          const objek = `${exam.id}/${s.kode.toLowerCase()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
          const isi = fs.readFileSync(full);

          const { error: upErr } = await svc.storage
            .from("question-media")
            .upload(objek, isi, { contentType: MIME[ext] ?? "application/octet-stream", upsert: false });

          if (upErr) {
            gambarGagal.push(`${s.kode}: ${upErr.message}`);
          } else {
            mediaPath = objek;
          }
        }
      }

      const { data: soal, error: soalErr } = await svc
        .from("questions")
        .insert({
          exam_id: exam.id,
          position: pos + 1,
          type: s.tipe,
          body: s.body,
          passage: s.passage,
          media_path: mediaPath,
          points: 1,
          explanation: s.pembahasan,
        })
        .select("id")
        .single();

      if (soalErr) throw new Error(`Gagal membuat soal ${s.kode}: ${soalErr.message}`);

      if (s.opsi.length) {
        const { error: opsiErr } = await svc.from("question_options").insert(
          s.opsi.map((body, idx) => ({
            question_id: soal.id,
            position: idx + 1,
            body,
            is_correct: s.kunci.includes(idx),
          })),
        );
        if (opsiErr) throw new Error(`Gagal membuat opsi ${s.kode}: ${opsiErr.message}`);
      }
    }

    ringkasan.push({ kode, nama: p.nama, soal: p.soal.length, durasi });
    console.log(`  ok  ${kode}  ${String(p.soal.length).padStart(3)} soal  ${p.nama}`);
    await tidur(60);
  }

  console.log(`\nSelesai. ${ringkasan.length} ujian dibuat sebagai DRAFT.`);
  console.log("\nSemua ujian masih draft supaya bisa ditinjau dulu sebelum diaktifkan:");
  for (const r of ringkasan) console.log(`  ${r.kode}  ${r.soal} soal  ${r.durasi} menit  ${r.nama}`);

  /*
   * Kegagalan gambar dilaporkan di akhir dan membuat exit code non-nol.
   * Soal yang bergambar tanpa gambarnya tidak bisa dikerjakan, jadi ini bukan
   * peringatan kosmetik — impor dianggap TIDAK selesai.
   */
  if (gambarGagal.length > 0) {
    console.error(`\n${gambarGagal.length} gambar GAGAL diunggah:`);
    for (const g of gambarGagal) console.error("  - " + g);
    console.error(
      "\nSoal-soal di atas tetap dibuat tetapi tanpa gambar, sehingga belum bisa dikerjakan.\n" +
        "Perbaiki penyebabnya lalu jalankan: node scripts/upload-bank-gambar.cjs --dir <folder>",
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("\nGAGAL:", err.message);
  process.exit(1);
});
