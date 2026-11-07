#!/usr/bin/env node
/**
 * Regenerasi `src/types/database.types.ts` dari database yang ter-link.
 *
 *   npm run db:types
 *
 * Kenapa tidak sekadar `supabase gen types > file`:
 * CLI menulis pesan status (mis. "Target: project ... · production") ke stderr.
 * Di Windows, PowerShell menggabungkan stderr ke stdout saat diarahkan dengan
 * `>`, sehingga pesan itu ikut masuk ke berkas TypeScript dan membuatnya tidak
 * valid. Skrip ini menangkap stdout secara terpisah, memvalidasi hasilnya, lalu
 * menulis berkas hanya bila isinya memang TypeScript yang sah.
 *
 * Kalau generasi gagal, berkas lama TIDAK ditimpa — lebih baik memakai tipe
 * yang sedikit basi daripada tipe kosong yang membuat seluruh proyek merah.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const OUT = path.join("src", "types", "database.types.ts");

/**
 * Jalankan CLI dan kembalikan stdout saja; stderr diabaikan.
 *
 * Di Windows, `npx` adalah shim `.cmd` yang tidak bisa di-spawn tanpa shell
 * (Node ≥20 menolak: EINVAL), sedangkan menyalakan `shell: true` memicu DEP0190
 * karena argumen hanya dikonkatenasi tanpa di-escape.
 *
 * Solusinya: lewati shim, panggil berkas entry milik paket `supabase` langsung
 * dengan `process.execPath` (node yang sedang berjalan). Tidak ada shell, tidak
 * ada escaping, dan versinya dijamin sama dengan devDependencies.
 */
function generate() {
  const cliEntry = require.resolve("supabase/dist/supabase.js");

  return execFileSync(
    process.execPath,
    [cliEntry, "gen", "types", "typescript", "--remote"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
    },
  );
}

/** Buang sisa baris diagnostik bila ada. */
function sanitize(code) {
  const lines = code.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith("export type Json"));
  if (start === -1) {
    throw new Error("Keluaran tidak memuat 'export type Json'. Generasi gagal.");
  }
  return lines.slice(start).join("\n").trimEnd() + "\n";
}

/** Pemeriksaan ringan: tipe harus memuat minimal satu tabel dan satu fungsi. */
function assertLooksComplete(code) {
  const problems = [];
  if (!/export type Database = \{/.test(code)) problems.push("tidak ada `export type Database`");
  if (!/public: \{/.test(code)) problems.push("tidak ada skema `public`");
  if (!/\n\s+admins:\s*\{/.test(code)) problems.push("tabel `admins` tidak ada");

  if (problems.length) {
    throw new Error(
      "Hasil generate tampak tidak lengkap:\n  - " + problems.join("\n  - "),
    );
  }
}

try {
  const raw = generate();
  const code = sanitize(raw);
  assertLooksComplete(code);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, code, "utf8");

  const tables = (code.match(/^\s{6}\w+:\s*\{/gm) || []).length;
  const fns = (code.match(/^\s{6}\w+:\s*\{\s*Args:/gm) || []).length;
  console.log(
    `OK  ${OUT}  ${code.length.toLocaleString("id-ID")} karakter` +
      ` (${tables} blok, ${fns} fungsi ber-Args)`,
  );
} catch (err) {
  console.error("GAGAL membuat tipe database.");
  console.error(err instanceof Error ? err.message : String(err));
  console.error(`\nBerkas lama di ${OUT} tidak diubah.`);
  process.exit(1);
}
