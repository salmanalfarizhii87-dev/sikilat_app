# KilatCBT: Daftar Task Eksekusi (Turunan PRD v2.0)

Sumber tunggal: [`PRD-KilatCBT.md`](./PRD-KilatCBT.md) (v2.0, 5 November 2026).
Status dokumen: rencana kerja, bukan spesifikasi baru. Bila ada konflik, PRD menang.
Tujuan: setiap task cukup kecil untuk diselesaikan dalam satu sesi kerja, punya batas file yang jelas, dan punya definisi selesai yang bisa diperiksa.

Cara pakai:
1. Ambil **satu** task. Jangan buka task lain di sesi yang sama.
2. Selesaikan sampai definisi "Selesai bila" terpenuhi.
3. Jalankan `npx tsc --noEmit` dan `npx eslint src`: keduanya harus bersih.
4. Centang task di file ini (`[ ]` → `[x]`), lalu berhenti. Boleh lanjut kapan saja.

Legenda: `P0` wajib MVP · `P1` rilis v1 · `P2` pasca-v1. Ukuran: `S` ≤ 2 jam · `M` setengah hari · `L` satu hari penuh.

---

## 0. Kondisi saat ini (jangan dikerjakan ulang)

Frontend mock sudah ada dan berjalan. Semua data masih dari `src/lib/mock-data.ts` dan `src/lib/admin-data.ts`.

| Area | Sudah ada | Sifat |
|---|---|---|
| Rute peserta | `/`, `/u/[code]`, `/u/[code]/kerjakan`, `/hasil/[resultToken]` | UI lengkap, data hardcoded |
| Rute admin | `/admin/login`, `/admin`, `/admin/exams`, `/admin/exams/new`, `/[id]` + 5 sub-tab, `/admin/account` | UI lengkap, aksi hanya `toast()` |
| Runner | timer, navigasi, Ragu, Coret, Buram, lapor soal, dialog kumpulkan, back-guard, keyboard A–E | UI lengkap, state di `localStorage` |
| Editor soal | form PG/esai, impor tempel CSV + validasi per baris, kunci read-only | Simpan hanya `toast()` |
| Rekap | statistik, histogram, tabel urut, ekspor CSV | Data demo, XLSX masih `toast()` |
| Monitor | polling 10 detik, jeda, modal detail + reset | Data demo |
| Penilaian | dua kolom, skor + komentar, tombol Berikutnya | Tidak persist |
| Tema | token amber/navy, Outfit + Plus Jakarta, komponen UI sendiri | Selesai |

Yang **belum ada sama sekali**: `supabase/`, `src/app/api/`, `src/features/`, `src/lib/supabase/`, `src/proxy.ts`, cookie token peserta, RLS/RPC, auth nyata, pengujian otomatis.

Pelanggaran prinsip yang harus ditutup (PRD §1.3, §5.3): kunci jawaban ikut ke browser (`correctOptionIds` di `mock-data.ts`), `expiresAt` dihitung dari jam perangkat, skor dihitung di klien.

### 0b. Yang sudah diverifikasi pada sesi UI/UX (5 November 2026)

Bagian ini bukan task. Fungsinya mencegah pengulangan pekerjaan yang sudah selesai.

| Bukti | Hasil |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint src` | exit 0, 0 error 0 warning (folder `(landing)` dikecualikan, lihat catatan di bawah) |
| `npx next build` | exit 0, 17 rute (8 statis, 9 dinamis) |
| 15 rute @390 px | semua 200 (rute uji 404 memang 404), 0 overflow horizontal, 0 error konsol |
| 14 rute @1440 px | semua 200, 0 overflow, 0 error konsol |
| Target sentuh aplikasi | 20 rute diperiksa di 390 px dan 1440 px: 0 kontrol di bawah 44 px, 0 kontrol tanpa nama aksesibel |
| Teks terpotong | 15 rute di 360/390/768/1440 px: hanya `sr-only` (memang 1 px), tidak ada teks terpotong tanpa elipsis |
| Alur peserta ujung ke ujung | kode → nama → runner → 20 kotak nomor → Ragu → kumpulkan → hasil menyapa nama yang diketik |
| Alur admin | login → dashboard → 5 tab ujian → wizard sampai "Draft ujian sudah lengkap" + "belum diterbitkan" |
| Kontras WCAG AA aplikasi | 0 pelanggaran selain pemisah dekoratif `aria-hidden` |
| Focus trap | modal, drawer peserta, drawer admin: 0 lolos fokus keluar, Escape menutup, fokus balik ke pemicu |
| Kode Lanjut | dibuat acak per percobaan, diverifikasi terhadap `localStorage`; tanpa percobaan / kode salah / kode benar berperilaku benar |
| Batas galat | `error.tsx` diuji dengan galat nyata: pesan Indonesia tampil, "Coba muat ulang" memulihkan halaman |
| Isolasi CSS landing vs aplikasi | `/` memakai latar `#f9fafb` dan teks `#1a1a1b`; `/admin` memakai `#f7f6f2` dan `#14202b`. Dua root layout terpisah, 0 kebocoran token |
| Landing page 100% asli | `page.tsx`, `globals.css`, `layout.tsx`, `icon.png`, `logo-sikilat.png` identik MD5 dengan project sumber |
| 404 global | `/kode-salah` mengembalikan 404, judul "Halaman tidak ditemukan · KilatCBT", tampil dengan tema aplikasi |

**Catatan landing page.** Landing page disalin apa adanya dari project terpisah
`landing_page_kilatcbt` (kini sudah dihapus dari repo) dan
ditempatkan di route group `(landing)` dengan root layout sendiri, sehingga CSS-nya tidak pernah
dimuat bersama CSS aplikasi. Konsekuensinya folder itu punya 9 temuan lint (`<a>` untuk tautan
internal, `setState` di dalam effect), 48 teks footer dengan kontras 4.39:1 (di bawah AA), dan 8
kontrol di bawah 44 px di layar HP. Semuanya berasal dari file asli dan **sengaja tidak diperbaiki**
karena diminta 100% tanpa perubahan. Kalau nanti boleh diubah, hapus pengecualian di
`eslint.config.mjs` lalu jalankan task T0.8.

Yang **masih** menjadi kekurangan frontend dan tercakup task di bawah: kunci jawaban di bundel klien (T5.15), `expiresAt` dari jam perangkat (T5.7), skor dihitung di klien (T1.9), semua aksi admin hanya `toast()` (T3.x, T4.x, T6.x), `@tanstack/react-query` terpasang tapi belum dipakai (K7), belum ada `loading.tsx` per segmen (T7.7).

---

## 1. Keputusan yang perlu diambil lebih dulu

Kerjakan bagian ini sebelum Fase 1. Masing-masing kecil, tapi memblokir task lain.

- [x] **K1: Mode skor PG banyak jawaban.** ~~Skema PRD §7.3 belum punya kolomnya, padahal QST-06 meminta dua mode.~~
  - **Keputusan (7 November 2026): ikuti PRD — hanya mode "semua benar".** Tidak ada kolom `mcq_multiple_mode`. PG multiple mendapat poin penuh hanya bila himpunan opsi terpilih **sama persis** dengan kunci; selain itu 0. Alasan: menyederhanakan skema dan penilaian, serta sesuai praktik umum ujian sekolah untuk soal PG. Kalau nanti mode parsial dibutuhkan, itu perubahan schema + rumus + UI, dicatat sebagai task baru, bukan tambahan diam-diam.
- [x] **K2: Penyimpanan rate limit.** ~~Pilih: tabel Postgres (`rate_limits`) atau Upstash.~~
  - **Keputusan (7 November 2026): tabel Postgres.** Tanpa dependensi atau akun layanan baru, dan sudah cukup untuk beban satu sekolah. Implementasi: tabel `rate_limits` + fungsi RPC atomik (`select … for update`) yang dipanggil Server Action sebelum operasi sensitif (login admin, `startAttempt`, `resumeAttempt`). Tidak perlu Redis/Upstash.
- [ ] **K3: Form: React Hook Form atau controlled.** PRD §5.1 menyebut RHF + resolvers. Usul: RHF hanya untuk form panjang (wizard, editor soal, login); form pendek tetap controlled agar diff kecil.
- [ ] **K4: Editor teks kaya (QST-04).** Usul: `contentEditable` mini dengan toolbar tebal/miring/daftar, disimpan sebagai Markdown sederhana, disanitasi saat render. Hindari TipTap/Lexical agar bundel runner tetap kecil.
- [ ] **K5: Kompresi gambar di klien.** Usul: `canvas` + `toBlob` (target ≤ 2 MB, sisi maks 1600 px), tanpa dependensi.
- [ ] **K6: Parser XLSX.** Usul: SheetJS (`xlsx`) hanya di Route Handler (server), PapaParse untuk CSV.
  - **Sudah diputuskan sebagian (T0.1):** `xlsx` dipasang dari CDN resmi SheetJS (`0.20.3`), bukan npm, karena `0.18.5` di npm punya 2 CVE high tanpa perbaikan. Paket tetap satu-satunya sumber parsing XLSX dan hanya boleh diimpor dari Route Handler.
- [ ] **K7: TanStack Query dipakai atau dibuang.** Sudah terpasang tapi belum dipakai. Usul: pakai untuk monitor + tabel rekap; dashboard tetap Server Component.
- [ ] **K8: Data demo.** Usul: hapus `mock-data.ts` dan `admin-data.ts` bertahap per fase, bukan sekaligus, agar UI tidak pernah kosong saat pengembangan.
- [x] **K9: Akses langsung ke Storage.** ~~Siapa yang boleh membaca objek `question-media`?~~
  - **Keputusan (7 November 2026): hanya lewat server-signed URL.** Tidak ada policy `select` untuk `anon`/`authenticated` pada `storage.objects`; RLS Storage tetap aktif tanpa policy baca, sehingga satu-satunya jalan adalah `createSignedUrl()` dari server memakai service role, dengan masa berlaku pendek dan hanya diterbitkan saat attempt aktif. Alasan: konsisten dengan prinsip "jangan percaya klien" — kalau peserta boleh membaca bucket langsung, siapa pun yang punya URL ujian bisa mengunduh semua gambar soal sebelum waktunya.

---

## Fase 0: Fondasi teknis (M1)

- [ ] **T0.0: Provisioning Supabase Cloud** `P0` `S`
  - Cakupan: dua project di Supabase Cloud (organisasi gratis): **`sikilat-dev`** dan **`sikilat-prod`**, keduanya region **Southeast Asia (Singapore) `ap-southeast-1`**. Simpan password database di pengelola kata sandi. Matikan **Allow new users to sign up** di Authentication → Providers → Email pada kedua project. Isi **Site URL** dan **Redirect URLs** dengan domain Vercel (prod) dan `http://localhost:3000` (dev).
  - Batasan free plan yang harus diterima: 500 MB database, 1 GB storage, **tanpa backup otomatis**, project **di-pause setelah 7 hari tanpa aktivitas**, maksimal 2 project aktif. Mitigasi: keep-alive terjadwal + backup `pg_dump` lewat GitHub Actions (task T0.10).
  - **Status: menunggu tindakan pemilik project** — pembuatan project hanya bisa dilakukan lewat dashboard Supabase (butuh login akun). Langkah lengkap: `docs/PROVISIONING-SUPABASE.md`.
  - Selesai bila: kedua project berstatus `ACTIVE_HEALTHY`, signup publik tertutup, dan URL + anon key sudah tercatat di `.env.local` (tidak di-commit).

- [x] **T0.1: Pasang dependensi yang disebut PRD** `P0` `S`
  - Cakupan: `zod`, `react-hook-form`, `@hookform/resolvers`, `@supabase/supabase-js`, `@supabase/ssr`, `papaparse`, `@types/papaparse`, `xlsx`, `recharts`, `server-only`; dev: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@playwright/test`.
  - File: `package.json`.
  - Selesai bila: `npm ls` bersih, `npx tsc --noEmit` tetap hijau, tidak ada import yang belum dipakai di commit ini.
  - **Hasil (6 November 2026):** 15 paket terpasang, 0 import di `src`. `npm ls --depth=0` bersih setelah `npm prune`. `tsc` 0, `eslint` 0, `next build` 0 (18 baris rute). Tiga penyesuaian di bawah.
    - `@types/node` naik `^20` → `^24`. Wajib: `vitest@5` mensyaratkan `@types/node` ≥22. Runtime Node v24.22.1, jadi `^24` yang benar (bukan `--force`).
    - `@tailwindcss/postcss` ditambahkan eksplisit ke devDependencies. Sebelumnya ada di `node_modules` tapi tidak tercatat di `package.json` (extraneous), sehingga `npm install` menghapusnya dan build gagal di `postcss.config.mjs`. Versi `^4.3.5`.
    - `xlsx` dipasang dari `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, bukan npm. Versi npm terakhir `0.18.5` (2022) punya 2 CVE high tanpa perbaikan (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9). 0.20.3 sudah menambalnya. Sisa `npm audit`: 8 moderate, semuanya rantai dev-only `eslint-config-next`/`typescript-eslint`; high 0, critical 0.

- [x] **T0.2: Konfigurasi lingkungan dan konstanta** `P0` `S`
  - Cakupan: `.env.example` sesuai PRD §5.10; `src/lib/env.ts` (validasi Zod, server-only untuk service key); `src/lib/constants.ts` (`APP_NAME`, `APP_TIMEZONE`, prefiks cookie `kilat_`, kode error §8.1).
  - File: `.env.example`, `src/lib/env.ts`, `src/lib/constants.ts`.
  - Selesai bila: build gagal dengan pesan jelas bila variabel wajib kosong; tidak ada `process.env` liar di komponen.
  - **Hasil (7 November 2026):** `.env.example` (7 variabel, tanpa nilai rahasia), `constants.ts` (`APP_NAME`, `APP_TIMEZONE`, `COOKIE_PREFIX`/`COOKIE_ATTEMPT_PREFIX`, 14 `ERROR_CODES` + pesan Indonesia, batas kode ujian, alfabet tanpa `0/O/1/I`, batas gambar), `env.ts` (`import "server-only"`, skema Zod, `serverEnv()` ber-cache, `isServerEnvConfigured()`).
    - Pesan galat dikumpulkan per variabel, jadi pengembang langsung tahu mana yang kosong tanpa membaca stack trace.
    - `server-only` membuat impor `env.ts` dari komponen klien menjadi error build, bukan kebocoran service key.
    - Belum ada pemanggil: modul ini dipakai mulai T0.4 (tiga klien Supabase).

- [ ] **T0.3: Supabase CLI dan folder proyek** `P0` `S`
  - Cakupan: `npx supabase init` (sudah dijalankan), `supabase/config.toml` disesuaikan (bucket `question-media` privat ≤2 MB, `enable_signup = false`, `site_url`), `npx supabase link --project-ref <ref-dev>`, dan `supabase/migrations/` sebagai **satu-satunya sumber skema**.
  - Catatan penting: CLI 3.0.0 bisa dipakai **tanpa Docker** untuk `init`, `link`, `db push`, `db lint`, `gen types --remote`, dan `test db --remote` (pgTAP). Yang tetap butuh Docker hanya `db dump`, `db reset`, dan `start` — karena itu tidak ada development lokal berbasis kontainer; pengembangan memakai project cloud `sikilat-dev`.
  - **Hasil (7 November 2026):** `supabase init` dijalankan, `supabase/config.toml` disesuaikan: bucket `question-media` (privat, `2MiB`, `image/jpeg|png|webp`), `enable_signup = false`, `site_url`/`additional_redirect_urls` = `http://localhost:3000`. Folder `supabase/migrations/` dibuat. `supabase` CLI 3.0.0 ditambahkan ke devDependencies, skrip npm: `db:push`, `db:push:dry`, `db:types`, `db:lint`, `db:test` (semua memakai `--remote`; flag `--linked` sudah dihapus di CLI 3.0.0).
  - **Belum selesai:** `supabase link` menunggu project dev dibuat (T0.0).
  - Selesai bila: `npx supabase db push --dry-run` berhasil terhubung ke project dev (belum ada migrasi = tidak ada perubahan), dan `supabase/migrations/` ada.

- [x] **T0.4: Tiga klien Supabase** `P0` `S`
  - Cakupan: `lib/supabase/client.ts` (browser, `createBrowserClient`), `lib/supabase/server.ts` (`createServerClient` + `cookies()` async, untuk Server Component/Action/Route Handler), `lib/supabase/admin.ts` (`createClient` dengan service role, `import "server-only"`).
  - Selesai bila: impor `admin.ts` dari komponen klien menyebabkan build error, bukan kebocoran kunci.
  - **Hasil (7 November 2026):** tiga klien dibuat dan **dibuktikan** aman lewat uji yang disengaja: halaman klien sementara yang mengimpor `admin.ts` membuat `next build` **gagal** dengan `'server-only' cannot be imported from a Client Component module`. Halaman uji dihapus, build kembali hijau.
    - `client.ts` sengaja tidak menyimpan instance sendiri; `createBrowserClient` dari `@supabase/ssr` sudah menyimpan satu instance per tab, jadi menyimpannya lagi akan memicu peringatan "Multiple GoTrueClient instances".
    - `server.ts` membungkus `setAll` dengan `try/catch` karena Server Component tidak boleh menulis cookie; refresh sesi ditangani `proxy.ts`, jadi kegagalan itu wajar.
    - `admin.ts` memakai `persistSession: false` + `autoRefreshToken: false` (tidak ada sesi pengguna; kunci service role adalah identitasnya) dan mengambil env lewat `serverEnv()` sehingga pesan galatnya jelas bila belum diisi.
    - Catatan: `tsc --noEmit` **tidak** menangkap pelanggaran `server-only`; hanya bundler yang menegakkannya. Karena itu verifikasinya harus lewat `next build`, bukan `tsc`.

- [x] **T0.5: Tipe database terbuat otomatis** `P0` `S`
  - Cakupan: skrip `npm run db:types` → `supabase gen types typescript --remote > src/types/database.types.ts` (memakai `--remote`, bukan `--local`, karena tidak ada Postgres lokal; di CLI 3.0.0 `--linked` sudah dihapus). Adapter `src/lib/types.ts` dipetakan dari tipe generated, bukan didefinisikan ulang.
  - **Hasil (7 November 2026):** `src/types/database.types.ts` sekarang **hasil generate sungguhan** dari project `sikilat-cbt` — 21.655 karakter, 29 blok, 20 fungsi ber-`Args`. Diverifikasi memuat 9 tabel, 19 fungsi (termasuk `get_attempt_state`, `submit_attempt`, `get_result` yang ditulis satu baris sehingga lolos pemeriksaan pertama), dan 6 enum. `tsc --noEmit` hijau dengan tipe sungguhan ini.
  - **Jebakan yang diperbaiki:** `supabase gen types > file` **merusak berkas** di Windows. CLI menulis pesan status (`Target: project ... · production`) ke stderr, dan PowerShell menyatukannya ke stdout saat diarahkan dengan `>`, sehingga berkas `.ts` diawali 7 baris diagnostik dan tidak valid. Solusi: `scripts/gen-types.cjs` menangkap stdout terpisah, memotong dari `export type Json`, memvalidasi (`export type Database`, skema `public`, tabel `admins`), dan **hanya menimpa berkas bila validasi lolos** — generasi gagal tidak pernah meninggalkan tipe kosong yang membuat seluruh proyek merah.
  - Catatan skrip: `npx.cmd` tidak bisa di-spawn tanpa shell di Node ≥20 (`EINVAL`), sedangkan `shell: true` memicu `DEP0190`. Skrip memanggil `node_modules/supabase/dist/supabase.js` langsung dengan `process.execPath` — tanpa shell, tanpa escaping, versi CLI terjamin sama dengan `devDependencies`.
  - **Sisa:** adapter `src/lib/types.ts` + tipe `PublicQuestion` (tanpa kunci) belum dibuat; akan dikerjakan bersama modul peserta.

- [ ] **T0.6: Restrukturisasi folder sesuai PRD §5.4** `P0` `M`
  - Cakupan: buat `src/features/{auth,exams,questions,attempts,grading,reports}/` dengan `actions.ts`, `queries.ts`, `schemas.ts`, `types.ts`; pindahkan komponen yang jelas milik satu domain.
  - Catatan: lakukan bertahap per fase; task ini hanya membuat kerangka + satu modul contoh agar tidak ada import rusak.
  - Selesai bila: `npx tsc --noEmit` dan `eslint` hijau, semua rute masih merender.

- [x] **T0.7: Rebranding teknis (Lampiran C)** `P1` `S`
  - Cakupan: `README.md` proyek KilatCBT (bukan bawaan create-next-app), hapus `public/{file,globe,next,vercel,window}.svg`, ganti `src/app/favicon.ico` dengan ikon petir, `package.json` name/description, pastikan tidak ada sisa teks "JawaraCBT/Manager/Teacher/Student".
  - Selesai bila: `grep -ri "jawaracbt\|create-next-app" src public README.md` kosong.
  - **Hasil (7 November 2026):** 5 SVG bawaan dihapus (0 pemakaian di kode). `favicon.ico` dibuat ulang dari `src/app/icon.png` (petir) dalam 4 ukuran 16/32/48/64 px, 11.369 byte — sebelumnya masih ikon bawaan 3 ukuran. `README.md` sudah ditulis ulang sejak perapian repo; `package.json` sudah `"sikilat"`; sisa teks "JawaraCBT"/"create-next-app" = 0.

- [ ] **T0.8: Rapikan temuan landing page (opsional, hanya jika boleh diubah)** `P2` `M`
  - Cakupan: `src/app/(landing)/page.tsx` masih memakai `<a href="/admin/...">` untuk tautan internal (5 tempat, ganti ke `<Link>`) dan memanggil `setReduced()` langsung di dalam `useEffect` (pindahkan ke `useSyncExternalStore` atau inisialisasi lewat state awal). `globals.css` landing: `--footer-fg-muted` `#6b7280` di atas `#f3f4f6` = 4.39:1, naikkan ke `#5f6673` (5.25:1). Target sentuh HP: input kode 24 px, tombol Masuk 40 px, brand 34 px.
  - Catatan: task ini **melanggar** permintaan "100% asli" dari pemilik project. Jangan dikerjakan tanpa izin baru. Setelah dikerjakan, hapus `"src/app/(landing)/**"` dari `globalIgnores` di `eslint.config.mjs`.
  - Selesai bila: `npx eslint src` bersih tanpa pengecualian, kontras landing 0 pelanggaran, semua target sentuh ≥44 px.

- [ ] **T0.9: Keep-alive agar project tidak di-pause** `P0` `S`
  - Cakupan: workflow GitHub Actions terjadwal (mis. tiap 3 hari) yang menjalankan satu query ringan ke project `sikilat-prod` lewat REST API memakai anon key (atau `pg_isready`-style lewat RPC `select 1`). Simpan URL + anon key sebagai repository secret.
  - Alasan: Supabase Free mem-pause project setelah **7 hari tanpa aktivitas**. Tanpa ini, ujian bisa gagal karena database tidur.
  - Selesai bila: workflow berjalan manual (`workflow_dispatch`) tanpa error dan `Last activity` di dashboard ikut ter-update.

- [ ] **T0.10: Backup harian tanpa Docker** `P1` `M`
  - Cakupan: workflow GitHub Actions yang menjalankan `pg_dump` (sudah tersedia di runner `ubuntu-latest`) terhadap connection string `sikilat-prod`, lalu mengunggah hasilnya sebagai artifact dan/atau ke storage eksternal. Simpan connection string sebagai secret.
  - Alasan: Free plan **tidak punya backup otomatis**; CLI `supabase db dump` butuh Docker sehingga tidak bisa dipakai di sini.
  - Catatan: artifact GitHub pada repo publik hanya bisa diunduh setelah login dan disimpan 90 hari, jadi ini bukan pengganti backup sungguhan. Untuk data ujian nyata, unduh berkala ke penyimpanan milik sendiri.
  - Selesai bila: satu dump berhasil dibuat dan bisa di-`pg_restore` ke project dev sebagai uji.

---

## Fase 1: Database, RLS, dan RPC (M1)

Semua task di fase ini diverifikasi lewat `db lint` + uji HTTP ke Data API.

> **Status 7 November 2026: T1.1–T1.11 selesai dan sudah diterapkan** ke project
> `sikilat-cbt`. 13 berkas migrasi di `supabase/migrations/`, `db lint` bersih
> (0 error, 0 warning), 9 tabel terpasang, dan uji akses dengan anon key
> membuktikan `anon` tidak bisa membaca maupun menulis apa pun.
>
> Satu penyimpangan dari rencana awal: tidak ada Postgres lokal (Docker tidak
> dipakai), jadi "Selesai bila: `supabase db reset` bersih" tidak bisa dijalankan.
> Penggantinya `db lint` + `db push --dry-run` + uji HTTP, yang justru menguji
> kondisi sebenarnya.

- [x] **T1.1: Migrasi enum dan tabel `admins` + `exams`** `P0` `S`
  - Cakupan: 6 enum PRD §7.2, tabel `admins`, tabel `exams` lengkap dengan constraint (`code ~ '^[A-Z0-9]{4,10}$'`, `closes_at > opens_at`).
  - **Hasil:** `20261107000100_enum_types.sql` + `20261107000200_core_schema.sql`.

- [x] **T1.2: Migrasi `questions` + `question_options`** `P0` `S`
  - Cakupan: sesuai PRD §7.3. **K1 diputuskan: tanpa kolom mode parsial.**
  - **Hasil:** bagian dari `20261107000200_core_schema.sql`. `unique (exam_id, position) deferrable initially deferred` terpasang.

- [x] **T1.3: Migrasi `attempts`, `attempt_answers`, `attempt_events`, `audit_logs`** `P0` `M`
  - Cakupan: sesuai PRD §7.3 termasuk `total_score` generated, `unique (exam_id, participant_name_norm, attempt_no)`, partial unique index `one_active_attempt`.
  - **Hasil:** bagian dari `20261107000200_core_schema.sql`. `one_active_attempt` menjadi penjaga atomik untuk penolakan `NAME_IN_USE`.

- [x] **T1.4: Indeks PRD §7.4** `P0` `S`
  - **Hasil:** `20261107000300_indexes.sql` — 8 indeks PRD + 3 tambahan. Dua indeks duplikat dari percobaan pertama dihapus sebelum di-push.

- [x] **T1.5: `is_admin()` dan RLS semua tabel** `P0` `S`
  - **Hasil:** `20261107000400_rls_policies.sql`. Ditambah GRANT tingkat tabel yang tidak disebut PRD — tanpa GRANT, `authenticated` tetap tidak bisa menyentuh tabel meski punya policy.
  - **Terverifikasi:** `anon` INSERT ke `exams` → `42501 new row violates row-level security policy`. `anon` GET semua tabel → `[]` dengan `Content-Range: */0`.

- [x] **T1.6: Revoke/grant RPC peserta** `P0` `S`
  - **Hasil:** bagian akhir `20261107000700_rpc_participant.sql`.
  - **Terverifikasi:** `anon` memanggil `start_attempt`, `grade_essay`, `rate_limit_consume` → `42501 permission denied for function`.

- [x] **T1.7: RPC `start_attempt` dan `resume_attempt`** `P0` `L`
  - **Hasil:** `20261107000700_rpc_participant.sql`.
  - **Terverifikasi end-to-end (7 November 2026)** dengan kunci `sb_secret_` terhadap project sungguhan:

    | Skenario | Hasil |
    |---|---|
    | `start_attempt` sukses | HTTP 200, `attemptNo=1`, `expiresAt` = `serverNow` + durasi |
    | Soal & opsi teracak | urutan diterima ≠ urutan `position` di database |
    | **Kebocoran kunci** | respons **tidak** memuat `is_correct`, `reference_answer`, `explanation`, `correct_ids` |
    | Kode ujian salah | `EXAM_NOT_FOUND` |
    | Nama dengan attempt masih `in_progress` | `NAME_IN_USE` (409, dari indeks `one_active_attempt`) |
    | Attempt sebelumnya sudah selesai, kuota masih ada | **diizinkan** (`attemptNo=2`) — benar, bukan bug |
    | `max_attempts` habis | `NO_ATTEMPTS_LEFT` (400) |
    | `resume_attempt` kode salah | `INVALID_RESUME_CODE` (400) |
    | `resume_attempt` kode benar | 200 + token berganti; token lama → `UNAUTHENTICATED` (403), token baru → 200 |
    | tanpa `p_token_hash` (body kosong) | 400 — token wajib |

  - **Catatan uji:** dua "kegagalan" awal ternyata **salah rancang uji**, bukan bug: (a) `NAME_IN_USE` diuji saat attempt lama sudah `graded` sehingga memang boleh mulai lagi; (b) `submit_attempt` dipanggil dengan `curl -d` tanpa header `Content-Type`, sehingga body terbuang. Keduanya lolos setelah diuji dengan benar.

- [x] **T1.8: RPC `get_attempt_state`, `save_answer`, `log_attempt_event`** `P0` `L`
  - **Hasil:** `20261107000700_rpc_participant.sql`, diperbaiki di `20261107001100_fix_attempt_state.sql`.
  - Bug ditemukan `db lint` dan diperbaiki: penyusunan urutan opsi memakai `array_position` pada kolom ordinal yang tidak masuk GROUP BY (SQLSTATE 42803); diganti LATERAL join.

- [x] **T1.9: RPC `submit_attempt`, `get_result`, `finalize_if_expired`** `P0` `L`
  - **Hasil:** `20261107000700_rpc_participant.sql` + `20261107000500_internal_helpers.sql`.
  - **Dua bug ditemukan `db lint` setelah terterapkan, lalu diperbaiki:**
    1. `42703 column d.points does not exist` — fungsi penilaian akan gagal pada submit pertama. Diperbaiki di `20261107001000` lalu `20261107001300`.
    2. Aturan "benar" ditulis dua kali (untuk total dan untuk update per baris). Dua salinan cepat atau lambat menyimpang. Sekarang dihitung sekali.
  - **Pelajaran:** `db lint` menangkap bug yang tidak terlihat saat migrasi diterapkan, karena Postgres baru memvalidasi saat fungsi dijalankan.

- [x] **T1.10: RPC admin `grade_essay`, `reset_attempt`, `release_results`, `final_score`** `P0` `M`
  - **Hasil:** `20261107000800_rpc_admin.sql`, dirapikan di `20261107001200_cleanup_warnings.sql`.
  - **Keputusan:** `reset_attempt(mode='extra')` berperilaku sama seperti `'delete'` (menghapus attempt, beda label audit). Menambah jatah lewat `max_attempts` akan berlaku untuk semua peserta; kolom jatah personal ditolak pemilik project.

- [x] **T1.11: `expire_overdue_attempts()` + jadwal** `P1` `S`
  - **Hasil:** `20261107000900_cron.sql`. Sekaligus membersihkan `rate_limits` lama, jadi tidak perlu cron kedua.
  - **Kegagalan pertama:** `unrecognized exception condition "undefined_schema"` — nama kondisi itu tidak ada di PL/pgSQL (yang sah `invalid_schema_name`). Diganti penanganan SQLSTATE eksplisit.

- [x] **T1.12: `supabase/seed.sql`** `P0` `S`
  - Cakupan: satu admin aktif + satu ujian contoh (10 soal PG + 2 esai) agar pengembangan tidak butuh data palsu.
  - Catatan: tanpa Postgres lokal, seed **tidak** dijalankan lewat `db reset`, melainkan SQL manual di Studio atau lewat Data API (CLI 3.0.0 tidak punya perintah menjalankan SQL bebas). Akun admin dibuat lewat dashboard **Authentication → Add user** lebih dulu; `seed.sql` hanya mengisi baris `admins` dengan `user_id` yang sesuai.
  - **Hasil (7 November 2026):** `supabase/seed.sql` ditulis dan **dijalankan sungguhan**. Isinya: ujian `CONTOH1` berstatus `published` (60 menit, 2 attempt, `passing_score` 70, soal & opsi teracak, `score_and_review`/`instant`), 12 soal — 10 PG × 6 poin (termasuk 2 soal PG jawaban ganda) + 2 esai × 20 poin = **100 poin** — dan 40 opsi.
    - Aman dijalankan berulang: `on conflict (code) do nothing`, lalu berhenti lebih awal bila soal ujian itu sudah ada.
    - `admin_uid` sengaja **tidak** diberi nilai default. UID palsu melanggar foreign key ke `auth.users`; berkas gagal dengan pesan jelas bila belum diisi atau user-nya tidak ada, alih-alih diam-diam membuat data hampa.
  - **Terverifikasi lewat alur sungguhan:** peserta menjawab `start_attempt` → 12 soal → menjawab 10 PG dengan kunci benar → `submit_attempt` menghasilkan `scoreAuto = 60`, `maxScore = 100`, status `needs_grading` (esai menunggu dinilai). Angka itu cocok dengan perhitungan manual, jadi seed tidak hanya "terpasang" tapi menghasilkan ujian yang bisa dikerjakan.
  - **Data uji attempt sudah dihapus**; yang tersisa hanya ujian contoh + admin, sesuai tujuan seed.
  - Selesai bila: admin bisa login, dan ujian contoh tampil di dashboard dengan 12 soal. — **terpenuhi** (login diuji di T2.1).

- [x] **T1.13: Rate limit tabel Postgres** `P0` `S`
  - Cakupan (keputusan **K2**): tabel `rate_limits` + `rate_limit_consume(bucket, identifier, limit, window_secs)` atomik + `rate_limit_purge()`.
  - **Hasil:** `20261107000200_core_schema.sql` (tabel) + `20261107000600_rate_limit.sql` (fungsi).
  - Kenapa atomik: kalau baca dan tulis terpisah, 20 permintaan paralel semuanya membaca counter = 0 lalu semuanya lolos. `insert ... on conflict do update` menyatukannya jadi satu pernyataan.
  - **Terverifikasi:** `anon` tidak bisa memanggil `rate_limit_consume` (`42501`).

- [x] **T1.14: Verifikasi RLS dan hak eksekusi** `P0` `S`
  - Cakupan: membuktikan (bukan mengasumsikan) bahwa `anon` tidak bisa membaca, menulis, atau memanggil RPC apa pun.
  - **Hasil uji 7 November 2026:**

    | Uji | Hasil |
    |---|---|
    | `anon` GET `exams`, `questions`, `attempts`, `rate_limits` | `[]`, `Content-Range: */0` |
    | `anon` POST `exams` | `42501 new row violates row-level security policy` |
    | `anon` POST ke 9 tabel | semua `42501` |
    | `anon` RPC `start_attempt` | `42501 permission denied for function` |
    | `anon` RPC `grade_essay` | `42501 permission denied for function` |
    | `anon` RPC `rate_limit_consume` | `42501 permission denied for function` |

  - **Catatan penting:** tabel kosong mengembalikan `[]` baik dengan maupun tanpa RLS, jadi uji baca-saja **tidak membuktikan apa pun**. Yang membuktikan adalah uji tulis (`42501`) dan `Content-Range: */0`.
  - **Akses admin (dibuktikan 7 November 2026):**

    | Uji | Hasil |
    |---|---|
    | JWT admin GET `exams` | HTTP 200 + data (RLS membuka untuk admin) |
    | JWT non-admin panggil `grade_essay` | `FORBIDDEN` (403) dari `assert_admin()` |
    | JWT admin panggil `grade_essay` | HTTP 200, `scoreManual` terisi, status → `graded` |

  - **Bukti bahwa `assert_admin()` bukan sekadar formalitas:** user `authenticated` yang **tidak** ada di tabel `admins` ditolak, jadi hak akses bergantung pada baris `admins`, bukan pada "punya sesi Auth".

- [x] **T1.15: Uji end-to-end seluruh alur RPC** `P0` `M`
  - Cakupan: menjalankan alur peserta + admin dari awal sampai akhir lewat Data API, memakai kunci `sb_secret_` (peserta) dan JWT admin, untuk membuktikan skoring, idempotensi, dan publikasi hasil bekerja — bukan hanya "migrasi terpasang".
  - **Data uji:** ujian `UJI01` (durasi 30 menit, `max_attempts=2`, 3 soal: PG tunggal 10, PG ganda 20, esai 30; total 60), `UJI02` (`max_attempts=1`, untuk menguji kuota).
  - **Hasil uji 7 November 2026:**

    | Langkah | Hasil |
    |---|---|
    | `start_attempt` | 200, 3 soal, urutan teracak, tanpa kunci |
    | `save_answer` ×3 (PG tunggal, PG ganda, esai) | 200, `savedAt` terisi |
    | PG tunggal benar (10) + PG ganda benar semua (20) | `scoreAuto = 30` |
    | `submit_attempt` | `needs_grading`, `maxScore = 60`, ada esai belum dinilai |
    | `submit_attempt` **dipanggil ulang** | respons **identik byte-per-byte** → idempoten |
    | `grade_essay` dengan JWT admin, 25 poin | `graded`, `scoreAuto 30 + scoreManual 25 = 55/60` |
    | `get_result` dengan `result_token` | `percentage = 91,67`, rincian per soal + feedback benar |
    | Poin esai melebihi poin soal (99 dari 30) | `VALIDATION` (400) |

  - **Cara skor dibuktikan:** PG ganda dinilai dengan aturan **"semua benar"** (K1). Jawaban benar semua → 20; kalau aturan parsial, angka ini tidak bisa membedakan, jadi angka 30 lalu 55 dipakai sebagai patokan tetap untuk uji regresi berikutnya.
  - **Data uji sudah dihapus** setelah verifikasi (ujian, soal, opsi, attempt, jawaban, `audit_logs`, `rate_limits`), dan user Auth non-admin dihapus. Yang **sengaja ditinggalkan**: satu akun admin (lihat T1.12).

> **Pelajaran pengujian (berlaku untuk fase berikutnya)**
>
> - `curl -d` **tanpa** `-H "Content-Type: application/json"` membuang body → RPC menerima parameter kosong dan gagal 400. Selalu kirim body lewat berkas + `--data-binary @file` dengan header tipe.
> - `Invoke-WebRequest` di PowerShell 5.1 merusak body JSON; dan karakter `*` pada query string ikut dirusak PowerShell. Untuk uji HTTP, **Node `fetch` lebih andal** daripada `curl`/`Invoke-WebRequest` di lingkungan ini.
> - Tabel kosong + RLS tetap `[]` (HTTP 200). Jumlah baris harus dibaca dari header `Content-Range` dengan `Prefer: count=exact`; `HEAD` tidak didukung Data API, jadi pakai `GET` + `select=*&limit=1`.

---

## Fase 2: Autentikasi admin (M1)

- [x] **T2.1: `signIn` / `signOut` Server Action** `P0` `M`
  - Cakupan: Zod schema, `supabase.auth.signInWithPassword`, cek baris `admins` + `is_active`, `ActionResult<T>` sesuai PRD §8.1, pesan error Indonesia.
  - File: `src/features/auth/actions.ts`, `schemas.ts`, `src/lib/action-result.ts`.
  - **Hasil (7 November 2026):** tiga lapis pemeriksaan — Zod → Supabase Auth → tabel `admins`. Lapis ketiga krusial: `signInWithPassword` berhasil untuk **setiap** user Auth, jadi tanpa cek `admins` akun non-admin bisa masuk panel.
    - Bila lapis 3 menolak, sesi yang sudah terbentuk **dicabut lagi** (`signOut`). Tanpa itu cookie sesi non-admin tertinggal dan `proxy.ts` menganggapnya "sudah login".
    - Email salah dan password salah mengembalikan kode **sama** (`UNAUTHENTICATED`) supaya penyerang tidak bisa menebak email mana yang terdaftar.
    - `email` dinormalisasi (`trim` + `toLowerCase`) **sebelum** validasi; urutan `transform`-lalu-`pipe` sempat membuat normalisasi tidak jalan (terbukti di uji Zod, lalu diperbaiki).
  - **Terverifikasi di peramban (Playwright, bukan asumsi):**

    | Skenario | Hasil |
    |---|---|
    | password salah | `"Email atau kata sandi salah."` |
    | password benar | masuk ke `/admin`, cookie `sb-…-auth-token` terbentuk |
    | user Auth **tanpa** baris `admins` | `"Akun ini tidak terdaftar sebagai admin…"`, cookie **dicabut** |
    | admin dengan `is_active = false` | `"Akun admin ini dinonaktifkan…"`, cookie **dicabut** |
    | `signOut` (dari menu shell & dari halaman akun) | ke `/admin/login`, cookie sesi **0 tersisa** |
    | `/admin` setelah keluar | kembali ke `/admin/login` |

  - Selesai bila: email salah, password salah, dan akun nonaktif menghasilkan kode error berbeda. — **terpenuhi**: `UNAUTHENTICATED`, `FORBIDDEN` (non-admin), `FORBIDDEN` (nonaktif).

- [x] **T2.2: `proxy.ts` guard `/admin/*`** `P0` `S`
  - Cakupan: refresh sesi via `@supabase/ssr`, redirect ke `/admin/login` bila belum login, redirect ke `/admin` bila sudah login dan membuka `/admin/login`.
  - File: `src/proxy.ts` (Next.js 16 mengganti nama `middleware.ts` menjadi `proxy.ts`).
  - **Hasil & verifikasi:** `/admin` → **307** ke `/admin/login`; `/admin/exams` → **307** ke `/admin/login?next=%2Fadmin%2Fexams`; `/admin/login` → **200** tanpa sesi; `/` (halaman peserta) → **200**, tidak tersentuh guard. Saat sudah masuk, `/admin/login` → redirect ke `/admin`.
  - **Keputusan desain:** guard hanya menanyakan "ada sesi atau tidak". Ia **tidak** memeriksa tabel `admins`, karena itu berarti satu query per permintaan dan merupakan tugas `requireAdmin()`. Akun non-admin yang lolos guard tetap tidak bisa berbuat apa-apa: data ditahan RLS, aksi ditahan `requireAdmin()`.
  - `matcher` sengaja hanya `/admin` dan `/admin/:path*`; rute peserta (`/u/*`, `/hasil/*`) tidak boleh diproses karena peserta tidak punya sesi.
  - `?next=` hanya menerima path internal (`/…`, bukan `//…` atau berskema) untuk mencegah open redirect.
  - **Bug ditemukan & diperbaiki saat uji:** urutan `router.refresh()` lalu `router.replace(nextPath)` membuat `?next=` **hilang** — `refresh()` memicu render ulang halaman login, dan karena sesi sudah ada `proxy.ts` langsung mengalihkan ke `/admin` sehingga `replace` kalah balapan. Dibalik urutannya; `?next=/admin/exams` kini benar-benar mendarat di `/admin/exams`.
  - **Catatan cookie:** `@supabase/ssr` memakai `httpOnly: false` **secara bawaan dan disengaja** — klien browser membaca cookie sesi lewat `document.cookie` untuk menyegarkan token. Memaksakan `httpOnly: true` akan memutus refresh dan mengeluarkan admin di tengah pengerjaan. Risiko XSS ditekan CSP `script-src 'self'` di `next.config.ts`.

- [x] **T2.3: `requireAdmin()` untuk aksi dan route handler** `P0` `S`
  - Cakupan: helper server yang memanggil `getUser()` + cek `admins`, mengembalikan `ActionResult` `UNAUTHENTICATED`/`FORBIDDEN`.
  - File: `src/lib/auth/require-admin.ts`.
  - **Hasil:** memakai `auth.getUser()` (**bukan** `getSession()`): `getSession()` hanya membaca cookie dan mempercayai isinya, sedangkan `getUser()` memverifikasi tanda tangan token ke server Auth.
  - Kegagalan **membaca** tabel `admins` sengaja dibedakan dari "bukan admin" (`INTERNAL` + log). Kalau RLS salah konfigurasi dan keduanya disamakan, bug RLS akan tersamar sebagai `FORBIDDEN` dan sulit dilacak.
  - Tersedia juga `getAdminSession()` (versi ringkas untuk Server Component yang hanya perlu menampilkan identitas).

- [x] **T2.4: Halaman login memakai action nyata** `P0` `S`
  - Cakupan: ganti mock `setTimeout` di `src/app/admin/login/page.tsx`; tampilkan error per field; state `pending`; `redirect` setelah sukses.
  - **Hasil:** mock dan spanduk "Mode demo" dihapus. Galat per field ditampilkan lewat prop `error` pada `Field` (memakai `aria-invalid`), galat umum lewat `role="alert"`. State `pending` dipulihkan di `finally` sehingga tombol tidak pernah tertinggal mati.
  - Modul lama `src/lib/admin-identity.ts` (identitas dari `localStorage`) **dihapus** — nilai di `localStorage` bisa diubah siapa saja dan tidak pernah diverifikasi, jadi tidak layak jadi dasar menampilkan "kamu masuk sebagai X". Identitas kini dibaca di server lewat layout.

- [x] **T2.5: Logout di shell dan halaman akun** `P0` `S`
  - Cakupan: tombol Keluar di `admin-shell.tsx` dan `account/page.tsx` memanggil `signOut` lalu redirect.
  - **Hasil:** keduanya memakai Server Action `signOut` yang sama (satu jalur keluar, bukan dua yang bisa menyimpang). Shell menerima identitas sebagai prop dari layout server (`admin`), bukan dari `localStorage`.
  - **Terverifikasi:** setelah keluar dari kedua tempat, cookie `sb-…-auth-token` = **0** dan `/admin` kembali ke login.

- [x] **T2.6: Halaman akun nyata** `P1` `M`
  - Cakupan: tampilkan email + nama admin dari sesi (bukan "Pak Budi"), ganti password via `updatePassword`, validasi konfirmasi, `toast` hasil.
  - File: `account/page.tsx` (Server Component), `account/password-form.tsx`, `account/sign-out-button.tsx`.
  - **Hasil:** profil menampilkan `fullName`/email dari sesi terverifikasi + "Masuk terakhir" dari `last_sign_in_at`. `updatePassword` memverifikasi password lama (percobaan `signInWithPassword` memakai email sendiri) sebelum memperbarui — tanpa itu, siapa pun yang menemukan perangkat dalam keadaan login bisa mengunci pemiliknya. Setelah berganti, **semua sesi diakhiri**.
  - Tombol "Keluarkan sesi lain" dinonaktifkan dengan alasan tertulis (belum ada pencabutan sesi per perangkat); mengganti password adalah cara yang tersedia.
  - **Belum diuji end-to-end:** ganti password tidak dijalankan saat verifikasi karena akan mengubah kredensial akun uji yang dipakai tes lain. Logikanya teruji tipe dan lint, tapi **belum** lewat peramban — tandai saat menguji ulang.

- [x] **T2.7: Rate limit login (AUTH-05)** `P1` `M`
  - Cakupan: 5 gagal / 15 menit per IP+email memakai mekanisme **K2**; error `RATE_LIMITED`.
  - File: `src/features/auth/rate-limit.ts`.
  - **Hasil:** pasangan **IP + email** (bukan IP saja — itu melukai pengguna sah di balik NAT sekolah; bukan email saja — itu memudahkan mengunci akun orang lain). Hanya **kegagalan** yang dihitung; percobaan yang berhasil tidak memakan kuota.
  - Pemeriksaan memakai **baca-saja** langsung ke tabel `rate_limits` dengan rumus jendela yang sama seperti SQL. Percobaan pertama saya memakai `rate_limit_consume` dengan jendela 1 detik untuk "mengintip" — itu keliru karena tetap menambah counter pada bucket tandingan; dibuang.
  - **Terverifikasi:** percobaan 1–4 → "Email atau kata sandi salah."; percobaan ke-5 menghabiskan kuota sehingga **percobaan 6 dan seterusnya** → `RATE_LIMITED` ("Coba lagi dalam N menit"), termasuk saat **password benar** dimasukkan. Counter di DB naik tepat +1 per kegagalan (dibuktikan dengan membaca tabel sebelum/sesudah; kegagalan "blokir di percobaan ke-3" awal ternyata disebabkan counter sisa uji sebelumnya di jendela 15 menit yang sama).
  - Selesai bila: percobaan ke-6 mengembalikan `RATE_LIMITED` tanpa memanggil Supabase Auth. — **terpenuhi** (pemeriksaan kuota terjadi sebelum `signInWithPassword`).

---

## Fase 3: Pengelolaan ujian (M2)

- [x] **T3.1: Modul `features/exams`: schema, tipe, query** `P0` `M`
  - Cakupan: Zod untuk semua field EXM-02/04/05/06, `listExams({page,pageSize,search,status})` → `{rows,total,page,pageSize}`, `getExam(id)`, `getExamByCode(code)` (tanpa kunci).
  - File: `src/features/exams/{types,schemas,queries,datetime}.ts`.
  - **Hasil (7 November 2026):** query key mengikuti PRD §5.7 — `['exams', {page,pageSize,search,status}]`, `['exam', examId]`, `['exam', examId, 'questions']`, plus `['exams','counts']`. `['exams']` sengaja menjadi prefiks agar satu `invalidateQueries` membatalkan semua kombinasi filter.
    - Tipe **tidak** memakai `Exam` dari `src/lib/types.ts`: model demo itu menyatakan `subjectLabel`/`instructions`/`passingScore` wajib, padahal di database ketiganya `NULL`-able. `passing_score = NULL` berarti "tanpa KKM", sedangkan `0` berarti **semua peserta lulus** — memaksa `NULL` menjadi `0` akan membalik arti data.
    - **Empat bug tertangkap saat uji, bukan saat dibaca:**
      1. `match.map(Number)` pada hasil regex membuat grup detik yang tidak ada menjadi `NaN`, sehingga **semua** jadwal tanpa detik (`07:30`) ditolak. Diperbaiki dengan mengurai grup satu per satu.
      2. `z.coerce.number()` mengubah `""` menjadi **0**, jadi mengosongkan kolom KKM diam-diam berarti "semua lulus". Ditambahkan `preprocess` yang memetakan `""`/`null` → `null`.
      3. `*` adalah wildcard `ILIKE` versi PostgREST. Tanpa di-escape, mencari `*` mengembalikan **semua** ujian. Sekarang `\`, `%`, `_`, dan `*` semuanya di-escape.
      4. `search` dengan `.max(100).catch("")` membuang pencarian 101 karakter menjadi **tanpa filter** — pengguna melihat semua ujian dan menyimpulkan pencarian rusak. Sekarang dipotong 100 karakter.
    - `getExamByCode` memakai service role (peran `anon` tidak punya GRANT) dan **memilih kolom satu per satu**; `select("*")` di sana akan mengirim `created_by` ke peramban peserta. Draft mengembalikan `null`, bukan "belum dibuka", supaya keberadaan draft tidak bocor lewat kode yang bisa ditebak.
  - **Terverifikasi terhadap PostgREST dan Zod yang sebenarnya (bukan asumsi):**
    - 15 kasus pencarian diuji langsung: `MAT`/`ipa`/`Contoh` → 1 baris; `%`, `_`, `,`, `(`, `)`, `"`, `\`, `*`, `a b`, `tidakada` → 0 baris tanpa galat parser.
    - `count: "exact"` + `head: true` mengembalikan angka per status; `range()` + dua `order` memberi `total` dan `rows` yang benar; agregat `questions(count)`/`attempts(count)` mengembalikan 12 soal dan 0 attempt untuk `CONTOH1`.
    - 20 kasus konversi waktu lulus, dicek silang dengan `Intl` zona `Asia/Jakarta`: `07:30` WIB → `00:30Z`, tengah malam → hari sebelumnya, 31 Feb ditolak, `25:00` ditolak, roundtrip utuh, lintas tahun benar.
    - 60+ kasus Zod: EXM-08 (tutup sebelum/sama dengan buka ditolak, pesan menunjuk `closesAt`), KKM `null` vs `0` vs `101` vs `abc`, batas durasi/percobaan, alfabet kode (`0/O/1/I` ditolak), `deleteExamSchema`, `extendCloseSchema`, dan normalisasi parameter URL (`page=0`→1, `pageSize=999999`→20, `status=ngawur`→`all`).

- [x] **T3.2: Aksi draft dan publish** `P0` `M`
  - Cakupan: `createExamDraft`, `updateExam`, `publishExam`, `unpublishExam`; validasi EXM-08 (≥1 soal, poin > 0, durasi > 0, jadwal valid); kode 6 karakter unik otomatis.
  - File: `src/features/exams/actions.ts`, migrasi `20261107001400_rpc_audit_log.sql`.
  - **Hasil (7 November 2026):** publish dengan 0 soal mengembalikan `VALIDATION` + `fields.questions` — **terpenuhi**, diverifikasi lewat HTTP.
    - **Audit log butuh RPC baru.** Policy di migrasi 0004 sengaja hanya memberi `select` pada `audit_logs` untuk `authenticated`: kalau admin bisa menulis langsung, admin juga bisa memalsukan atau menghapus jejak auditnya sendiri. Karena itu ditambahkan `log_admin_action()` (SECURITY DEFINER + `assert_admin()`), dan **dibuktikan** bahwa `insert` langsung ke `audit_logs` ditolak `42501` sementara RPC berhasil.
    - **`extendCloseTime` bertumpu pada `closes_at` yang berlaku, bukan `now()`.** Kalau memakai `now()`, memperpanjang 30 menit pada ujian yang tutupnya masih dua jam lagi justru **memperpendek** jadwal. Diuji: perpanjangan pertama 45 menit, kedua menambah tepat 30 menit di atas hasil pertama.
    - **`openExamNow` mengosongkan `closes_at`.** Kalau jadwal tutup dibiarkan di masa lalu, ujian langsung tertutup lagi dan tombolnya tampak tidak bekerja. Diuji: `closesAt` menjadi `null` setelah dibuka.
    - **`closeExamNow` tidak mengubah status.** Ujian tetap `published`; penolakan peserta datang dari jadwal, bukan dari status — supaya ujian tidak hilang dari daftar aktif hanya karena waktunya habis.
    - `publishExam` dan `openExamNow` sama-sama memeriksa EXM-08 terhadap data **di database**, bukan data di layar: wizard bisa menampilkan 10 soal yang belum tersimpan.
    - Jadwal yang seluruhnya sudah lewat ikut ditolak saat publish (bukan bagian EXM-08, tetapi hampir pasti salah isi).
    - `examHasAttempts` sengaja diletakkan di `queries.ts`, bukan `actions.ts`: setiap ekspor berkas `"use server"` menjadi endpoint yang bisa dipanggil peramban, dan pemeriksaan baca-saja tidak perlu menjadi endpoint. Bila hitungan gagal, hasilnya **`true` (terkunci)** — gagal menghitung tidak boleh membuka soal ujian yang sedang berjalan.
  - **Terverifikasi lewat HTTP dengan cookie admin asli** (route uji sementara yang memanggil Server Action sesungguhnya, lalu dihapus): **31/31 lulus**, mencakup — tanpa cookie → `UNAUTHENTICATED`; draft dibuat dengan kode 6 karakter dari alfabet bersih; publish 0 soal → `VALIDATION` + `fields.questions`; publish dengan soal → `published`; publish dua kali → `CONFLICT`; peserta melihat ujian published (dan **tidak** menerima `createdBy`); `examHasAttempts` `false` → `start_attempt` → `true`; instruksi tetap bisa diubah walau sudah ada attempt (EXM-09); `unpublishExam` → `draft` dan peserta tidak lagi melihatnya; `regenerateExamCode` (kode lama langsung hilang, kode sama/bentrok → `CONFLICT`, `0/O/1/I` → `VALIDATION`); id ngawur → `NOT_FOUND`; dan **7 aksi tercatat lengkap di `audit_logs`** dengan `actor_id` admin yang benar.
  - Data uji dihapus setelah pengujian; DB kembali: 1 ujian, 12 soal, 40 opsi, 0 attempt, 0 audit_logs.

- [ ] **T3.3: Wizard terhubung ke server** `P0` `L`
  - Cakupan: `src/app/admin/(panel)/exams/new/page.tsx` berhenti memakai `kilat_exam_draft_v1`; draft disimpan ke baris `exams` berstatus `draft`; autosave per langkah; pulihkan draft saat dibuka lagi.
  - Selesai bila: tutup tab di langkah 3, buka lagi, isian utuh.

- [ ] **T3.4: Wizard langkah Soal memakai aksi soal** `P0` `M`
  - Cakupan: tombol tambah/hapus/urutkan memanggil aksi dari Fase 4; impor CSV memakai route handler T4.9.
  - Selesai bila: publish langsung dari wizard menghasilkan soal di database dengan urutan benar.

- [ ] **T3.5: Daftar ujian: server-side cari/filter/paginasi** `P0` `M`
  - Cakupan: `src/app/admin/(panel)/exams/page.tsx` + aksi cepat (salin kode, salin tautan, duplikat, arsip) berfungsi.
  - Selesai bila: filter `archived` dan pencarian bertahan di URL (`?search=&status=&page=`).

- [ ] **T3.6: Ringkasan ujian: buka/tutup/perpanjang/ganti kode** `P0` `M`
  - Cakupan: `openExamNow`, `closeExamNow`, `extendCloseTime`, `regenerateExamCode` (EXM-03, EXM-12) + konfirmasi.
  - Selesai bila: kode lama langsung tidak ditemukan setelah diganti, attempt berjalan tetap lanjut.

- [ ] **T3.7: Duplikat dan arsip** `P1` `M`
  - Cakupan: `duplicateExam` menyalin soal + opsi + pengaturan dengan kode baru (EXM-10); `archiveExam` (EXM-13).
  - Selesai bila: ujian duplikat muncul sebagai `draft` dengan 0 attempt.

- [ ] **T3.8: Hapus permanen dengan konfirmasi judul** `P1` `S`
  - Cakupan: modal meminta mengetik judul ujian; `deleteExam` menolak bila ada attempt dan bukan arsip; catat `audit_logs`.
  - Selesai bila: mengetik judul salah membuat tombol tetap nonaktif.

- [ ] **T3.9: Penguncian setelah attempt pertama (EXM-09)** `P0` `M`
  - Cakupan: aksi soal menolak perubahan isi/poin bila `exists(attempts)`; UI read-only; metadata yang diizinkan tetap bisa diubah; `locked` di halaman soal dihitung dari data, bukan `const locked = true`.
  - Selesai bila: ujian tanpa attempt bisa diedit, yang punya attempt tidak.

- [ ] **T3.10: Pratinjau peserta (EXM-11)** `P1` `M`
  - Cakupan: rute pratinjau memakai komponen runner dengan data ujian nyata, tanpa membuat attempt, dengan banner "Mode pratinjau".
  - Selesai bila: membuka pratinjau tidak menambah baris `attempts`.

---

## Fase 4: Soal dan impor (M2)

- [ ] **T4.1: Aksi CRUD soal** `P0` `M`
  - Cakupan: `createQuestion`, `updateQuestion`, `deleteQuestion`, `reorderQuestions`, semua dengan Zod + `requireAdmin()`.
  - Selesai bila: reorder mengirim urutan final dan `position` unik tetap terjaga.

- [ ] **T4.2: Editor soal menyimpan sungguhan** `P0` `M`
  - Cakupan: `question-editor.tsx` memakai aksi; status `dirty`/`saving`; validasi inline (opsi ≥ 2, kunci wajib, poin > 0).
  - Selesai bila: refresh halaman setelah simpan menampilkan isi terbaru.

- [ ] **T4.3: Teks soal berformat dasar (QST-04)** `P0` `L`
  - Cakupan: toolbar tebal/miring/daftar pada `body` soal dan opsi sesuai **K4**; render aman di runner dan pratinjau; sanitasi.
  - Selesai bila: `<script>` di teks soal tidak dieksekusi di halaman peserta.

- [ ] **T4.4: Unggah gambar soal dan opsi** `P0` `L`
  - Cakupan: bucket privat `question-media`, path `{exam_id}/{uuid}.{ext}`, kompresi klien (**K5**), batas 2 MB + tipe jpg/png/webp, hapus gambar, signed URL berumur pendek untuk peserta.
  - Selesai bila: peserta menerima URL bertanda tangan yang kedaluwarsa, bukan URL publik.

- [ ] **T4.5: Tampilkan gambar di runner** `P0` `S`
  - Cakupan: ganti placeholder `[ Gambar soal: … ]` di `exam-runner.tsx` dengan `<Image>` dari signed URL; `alt` wajib; opsi bergambar.
  - Selesai bila: gambar tampil di 360 px tanpa scroll horizontal.

- [ ] **T4.6: Urutkan soal dengan drag-and-drop (QST-05)** `P1` `M`
  - Cakupan: ganti tombol naik/turun dengan DnD (native HTML5 atau `@dnd-kit/core`); tetap sediakan alternatif keyboard.
  - Selesai bila: urutan tersimpan dan terbaca ulang setelah reload.

- [ ] **T4.7: Mode skor PG banyak jawaban (QST-06)** `P1` `M`
  - Cakupan: kolom **K1**, UI pemilihan mode di editor, rumus parsial di RPC (T1.9), tampilan hasil per soal.
  - Selesai bila: 2 benar dari 3 kunci menghasilkan poin sesuai rumus PRD §7.7.

- [ ] **T4.8: Pembahasan dan kunci acuan (QST-08/09)** `P1` `S`
  - Cakupan: `explanation` dan `reference_answer` tersimpan; hanya dikirim ke peserta bila `result_visibility = score_and_review` **dan** hasil sudah dirilis.
  - Selesai bila: uji dengan `score_only` tidak memuat `explanation` di respons mana pun.

- [ ] **T4.9: Route handler impor CSV/XLSX** `P1` `L`
  - Cakupan: `POST /api/import/questions` mode `dryRun` dan `commit` (PRD §8.2, §8.4); PapaParse + SheetJS (**K6**); validasi per baris sesuai kriteria penerimaan QST-07; file tidak disimpan.
  - Selesai bila: 50 baris valid → pratinjau 50 valid; 1 baris kunci salah → 49 bisa diimpor, 1 dilaporkan.

- [ ] **T4.10: UI impor: unggah, pratinjau, laporan error** `P1` `M`
  - Cakupan: `question-editor.tsx` menerima file (bukan hanya tempel), tabel pratinjau status per baris, ringkasan berhasil/gagal; unduh templat memakai isi PRD §8.4.
  - Selesai bila: alur unggah → pratinjau → konfirmasi selesai tanpa reload.

---

## Fase 5: Sisi peserta (M3)

Ini fase yang menutup tiga pelanggaran prinsip. Kerjakan berurutan.

- [ ] **T5.1: Sesi peserta berbasis cookie** `P0` `M`
  - Cakupan: `src/lib/participant-session.ts`: set/baca/hapus cookie `kilat_attempt_<kode>` (httpOnly, Secure, SameSite=Lax), simpan hanya hash SHA-256 di database.
  - Selesai bila: cookie tidak dapat dibaca `document.cookie`; token tidak pernah muncul di URL.

- [ ] **T5.2: Pra-ujian dengan data nyata** `P0` `M`
  - Cakupan: `getExamByCode` di `/u/[code]`; empat keadaan GST-08 (belum dibuka + hitung mundur, berlangsung, ditutup, kode tidak ditemukan) dari jadwal nyata; tampilkan sisa percobaan; kelas muncul bila `ask_class`.
  - Selesai bila: mengubah `opens_at` di database mengubah tampilan tanpa deploy.

- [ ] **T5.3: `startAttempt` + aturan nama** `P0` `M`
  - Cakupan: validasi nama 2–60 karakter, normalisasi, kuota percobaan, `NO_ATTEMPTS_LEFT`, `EXAM_NOT_OPEN`, `EXAM_CLOSED`; pasang cookie; arahkan ke runner.
  - Selesai bila: nama "  Rina  " dan "rina" dihitung satu peserta.

- [ ] **T5.4: `NAME_IN_USE` dan alur Kode Lanjut** `P0` `M`
  - Cakupan: tolak nama yang sedang mengerjakan tanpa cookie dengan pesan jelas + tawarkan kolom Kode Lanjut (GST-06, GST-07).
  - Selesai bila: dua perangkat, nama sama, tanpa kode → peserta kedua ditolak dengan pesan yang bisa ditindaklanjuti.

- [ ] **T5.5: `resumeAttempt` mencabut sesi lama** `P1` `M`
  - Cakupan: cocokkan `resume_code`, terbitkan `token_hash` baru, batasi laju; perangkat lama menerima status dicabut.
  - Selesai bila: perangkat pertama berhenti menyimpan dan menampilkan "Ujian dilanjutkan di perangkat lain" (RUN-11).

- [ ] **T5.6: Runner membaca state dari server** `P0` `L`
  - Cakupan: `ExamRunnerProvider` mengambil `getAttemptState` (bukan `localStorage` `kilat_attempt_v1`), urutan soal dari `question_order`, jawaban tersimpan, flag, `resume_code`; hapus pembuatan attempt lokal.
  - Selesai bila: hapus semua `localStorage` lalu buka runner → attempt tetap pulih lewat cookie.

- [ ] **T5.7: Timer berbasis server (RUN-02)** `P0` `M`
  - Cakupan: hitung selisih `server_now` vs jam klien sekali saat muat, lalu pakai offset itu; `expires_at` dari server.
  - Selesai bila: mengubah jam perangkat +2 jam tidak mengubah sisa waktu.

- [ ] **T5.8: Autosave debounce + indikator (RUN-03)** `P0` `M`
  - Cakupan: `saveAnswer` debounce 800 ms, indikator "Menyimpan… / Tersimpan / Gagal, coba lagi", kirim ulang saat gagal.
  - Selesai bila: memilih opsi menampilkan urutan status yang benar; p95 ≤ 2 detik di lokal.

- [ ] **T5.9: Antrean offline (RUN-04)** `P0` `L`
  - Cakupan: antrean lokal berurutan (IndexedDB atau `localStorage`), banner "Tidak ada koneksi", kirim ulang otomatis saat `online`, tanpa kehilangan urutan.
  - Selesai bila: matikan jaringan, jawab 3 soal, nyalakan → semua tersimpan berurutan.

- [ ] **T5.10: Auto-submit dan peringatan waktu (RUN-06/07)** `P0` `S`
  - Cakupan: submit otomatis saat `expires_at` lewat dengan alasan `timeout`; peringatan 5 menit dan 1 menit (teks + `aria-live`, bukan hanya warna).
  - Selesai bila: memajukan jam melewati `expires_at` memicu submit dan halaman selesai.

- [ ] **T5.11: Dialog kumpulkan dan halaman selesai (RUN-08/09)** `P0` `M`
  - Cakupan: dialog menampilkan jumlah belum dijawab + ditandai ragu; `submitAttempt`; halaman selesai menampilkan skor sesuai visibilitas, tombol salin tautan hasil, pesan esai menunggu penilaian.
  - Selesai bila: submit ganda tidak menggandakan attempt.

- [ ] **T5.12: Halaman hasil nyata (RUN-10)** `P0` `M`
  - Cakupan: `/hasil/[resultToken]` memakai `getResult`; patuhi `result_visibility` + `result_release` (`instant`/`after_close`/`manual`); hapus nama "Rina" dan skor hardcoded.
  - Selesai bila: `hidden` tidak menampilkan skor; `manual` menampilkan "menunggu rilis" sampai `results_released_at` diisi.

- [ ] **T5.13: Log kejadian integritas (INT-02)** `P1` `M`
  - Cakupan: kirim `visibilitychange`, keluar fullscreen, `paste` lewat `logAttemptEvent` dengan stempel waktu; tampil di monitor dan halaman penilaian.
  - Selesai bila: berpindah tab 2× tercatat 2 baris `attempt_events`.

- [ ] **T5.14: Acak soal dan opsi per attempt (INT-01)** `P0` `M`
  - Cakupan: pastikan `shuffle_questions`/`shuffle_options` benar-benar dipakai RPC dan runner mengikuti urutan tersimpan; hilangkan pengaturan yang tidak berefek.
  - Selesai bila: dua attempt berbeda punya urutan berbeda dan masing-masing stabil setelah reload.

- [ ] **T5.15: Bersihkan kebocoran kunci jawaban** `P0` `S`
  - Cakupan: `mock-data.ts` tidak lagi diimpor rute peserta; `correctOptionIds`, `referenceAnswer`, `explanation` tidak ada di bundel klien peserta; skor tidak dihitung di `exam-store.tsx`.
  - Selesai bila: `grep -r "correctOptionIds" .next/static` tidak menemukan data soal peserta.

---

## Fase 6: Penilaian dan rekap (M4)

- [ ] **T6.1: Antrian esai dan `gradeEssay`** `P0` `M`
  - Cakupan: `listEssayQueue(examId, {filter})`, `gradeEssay(attemptId, questionId, points, feedback)`; batas poin; status otomatis jadi `graded` saat semua esai selesai.
  - Selesai bila: menilai esai terakhir memindahkan attempt ke `graded`.

- [ ] **T6.2: Halaman penilaian memakai data nyata** `P0` `M`
  - Cakupan: `grading/[attemptId]` menampilkan jawaban peserta, kunci acuan, jumlah kata, komentar; tombol "Simpan dan Berikutnya" menyimpan lalu memuat esai berikutnya; filter belum dinilai.
  - Selesai bila: reload mempertahankan skor yang sudah disimpan.

- [ ] **T6.3: Detail attempt lengkap (RPT-04)** `P0` `M`
  - Cakupan: tambahkan bagian PG: jawaban vs kunci, skor per soal, total; tambahkan panel **log kejadian**.
  - Selesai bila: satu halaman menampilkan jawaban, skor, dan log tanpa data demo.

- [ ] **T6.4: Ubah nilai manual + audit (GRD-03)** `P1` `M`
  - Cakupan: `overrideScore` dengan alasan wajib; tulis `audit_logs` sebelum/sesudah; tampilkan riwayat perubahan di halaman attempt.
  - Selesai bila: mengosongkan alasan membuat tombol simpan nonaktif.

- [ ] **T6.5: Reset attempt (GRD-04)** `P1` `S`
  - Cakupan: sambungkan modal reset di monitor ke `resetAttempt` mode `delete`/`extra`; konfirmasi + `audit_logs`.
  - Selesai bila: setelah reset, peserta bisa memulai lagi dan kuota bertambah pada mode `extra`.

- [ ] **T6.6: Rilis nilai manual (GRD-05)** `P1` `S`
  - Cakupan: tombol Rilis nilai pada ujian dengan `result_release = manual`; isi `results_released_at`; status terlihat di ringkasan ujian.
  - Selesai bila: peserta melihat skor hanya setelah rilis.

- [ ] **T6.7: Rekap: data nyata + URL state** `P0` `L`
  - Cakupan: ganti `demoAttempts`; paginasi/cari/urut/filter lewat query string sesuai PRD §8.3; kolom sesuai RPT-01.
  - Selesai bila: 3 halaman data uji, pindah halaman mempertahankan filter.

- [ ] **T6.8: Statistik dan histogram (RPT-02/03)** `P0` `M`
  - Cakupan: rata-rata, median, tertinggi, terendah, % lulus dari data nyata; histogram memakai Recharts (bukan batang buatan).
  - Selesai bila: angka cocok dengan hitungan SQL manual.

- [ ] **T6.9: Analisis butir soal (GRD-06/07)** `P1` `L`
  - Cakupan: persentase benar per soal, soal tersulit/termudah, distribusi pilihan opsi per soal.
  - Selesai bila: total persentase per soal konsisten dengan jumlah attempt `graded`.

- [ ] **T6.10: Ekspor CSV dan XLSX (RPT-05)** `P1` `M`
  - Cakupan: `GET /api/export/results?examId=&format=` memakai SheetJS untuk XLSX; ganti `toast("Ekspor XLSX disiapkan")`; sertakan filter aktif.
  - Selesai bila: file XLSX terbuka di LibreOffice dengan kolom sesuai RPT-01.

---

## Fase 7: Dashboard, monitoring, sistem (M4)

- [ ] **T7.1: Dashboard dari agregasi nyata (DSH-01)** `P0` `M`
  - Cakupan: ujian aktif + mendatang, jumlah sedang mengerjakan, attempt hari ini, jawaban perlu dinilai, daftar ujian terbaru; sapa nama admin dari sesi.
  - Selesai bila: tidak ada lagi `examSummary()` dari `admin-data.ts`.

- [ ] **T7.2: Monitoring langsung nyata (RPT-06)** `P0` `M`
  - Cakupan: `getLiveMonitor(examId)` via TanStack Query `refetchInterval` 10 detik (**K7**), berhenti saat tab tidak aktif, tombol jeda/segarkan, kolom pelanggaran dari `attempt_events`.
  - Selesai bila: jawaban peserta baru muncul di monitor dalam ≤ 10 detik.

- [x] **T7.3: Halaman error ramah (SYS-01)** `P0` `S`
  - Cakupan: `not-found.tsx` peserta + admin, `error.tsx` per segmen, `global-error.tsx`, halaman 403.
  - Selesai bila: memaksa error di server component menampilkan halaman dengan tombol Coba lagi.
  - **Hasil (7 November 2026):** `global-error.tsx` dibuat (menggantikan root layout, jadi mengimpor `globals.css` + font sendiri; tombol memakai `window.location.reload()` karena navigasi klien belum tentu hidup pada kegagalan sedalam itu). `admin/(panel)/not-found.tsx` dibuat dan **diletakkan di dalam `(panel)`** supaya sidebar + breadcrumb tetap tampil — versi di `admin/` sempat dicoba dan hasilnya 404 tanpa konteks.
    - **Bug ditemukan & diperbaiki:** `/admin/exams/[id]` menerima `id` lalu mengabaikannya, sehingga `/admin/exams/apa-saja` menampilkan ujian demo seolah itu ujian yang diminta. Sekarang `findExam(id)` + `notFound()` dipanggil, jadi alamat salah benar-benar berujung 404.
    - Halaman `/403` ditambahkan (statis, belum terhubung sesi; akan diarahkan `proxy.ts` di Fase 2).
    - Diverifikasi dengan galat sungguhan: `error.tsx` menangkap, menampilkan pesan Indonesia + tombol "Coba muat ulang". 404 admin tampil dengan sidebar (`aside` + breadcrumb utuh). 16 rute diuji: 0 error konsol, 0 overflow.

- [ ] **T7.4: `/api/health` (SYS-02)** `P1` `S`
  - Cakupan: Route Handler yang memeriksa koneksi database + versi build; tanpa data sensitif.
  - Selesai bila: mengembalikan 200 saat sehat dan 503 saat database mati.

- [ ] **T7.5: Audit log (SYS-03)** `P1` `M`
  - Cakupan: helper pencatat; dipakai oleh ubah nilai, reset attempt, hapus, rilis nilai; halaman daftar audit dengan filter aktor/aksi/tanggal.
  - Selesai bila: keempat aksi menghasilkan baris dengan `before_data`/`after_data`.

- [x] **T7.6: Header keamanan dan sanitasi** `P0` `S`
  - Cakupan: CSP, `X-Frame-Options`, `Referrer-Policy` di `next.config.ts`; pastikan teks soal dan nama peserta dirender aman.
  - Selesai bila: `curl -I` menampilkan ketiga header; XSS uji tidak lolos.
  - **Hasil (7 November 2026):** 5 header terpasang lewat `headers()` di `next.config.ts`, berlaku untuk semua rute: `Content-Security-Policy`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` (kamera/mikrofon/lokasi/pembayaran ditutup).
    - **Batasan yang jujur:** `script-src` masih memuat `'unsafe-inline'` karena Next.js menyuntikkan skrip inline untuk data hidrasi dan versi ini belum memakai `proxy.ts` untuk nonce per-permintaan (bagian Fase 2). Tanpa itu aplikasi gagal hidrasi — halaman tampil tapi tidak interaktif, persis gejala yang pernah terjadi saat dev origin diblokir. Yang tetap ditegakkan: `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, dan skrip hanya dari origin sendiri.
    - `'unsafe-eval'` + `ws:`/`wss:` hanya ditambahkan saat `NODE_ENV !== "production"` (kebutuhan Turbopack HMR), tidak pernah ikut ke build produksi.
    - XSS: tidak ada `dangerouslySetInnerHTML`, `<script>`, atau `<iframe>` di seluruh `src/` (0 temuan), jadi React meng-escape semua teks otomatis.
    - Diverifikasi pada build produksi: kelima header muncul di respons, dan hidrasi tetap hidup (validasi klien login muncul).

- [ ] **T7.7: Keadaan kosong dan skeleton (§9.5)** `P1` `M`
  - Cakupan: "Kode tidak ditemukan", "Belum ada ujian + Buat ujian pertama", "Belum ada yang mengerjakan. Bagikan kode ABC123…", skeleton pada `loading.tsx` untuk tiap rute berat, error + Coba lagi.
  - Selesai bila: setiap rute punya tampilan yang layak saat data kosong dan saat memuat.

---

## Fase 8: Pengujian dan non-fungsional (M4–M5)

- [ ] **T8.1: Setup Vitest + Testing Library** `P0` `S`
  - Cakupan: `vitest.config.ts`, `setupTests.ts`, alias `@/*`, skrip `npm test`.
  - Selesai bila: satu tes contoh lulus.

- [ ] **T8.2: Unit: rumus penilaian** `P0` `S`
  - Cakupan: PG single, PG multiple semua-benar, parsial, esai, persentase, `lulus`, `score_policy` (4 mode).
  - Selesai bila: cakupan cabang ≥ 90% pada modul skor.

- [ ] **T8.3: Unit: normalisasi nama, kode, Zod, parser CSV** `P0` `M`
  - Selesai bila: kasus "  Rina  " = "rina", kode ambigu (0/O/1/I) tidak dihasilkan, parser menolak kunci di luar opsi.

- [ ] **T8.4: Komponen: timer, navigasi, indikator simpan, dialog kumpulkan** `P0` `M`
  - Selesai bila: tes memakai fake timers dan lulus di zona waktu non-WIB.

- [ ] **T8.5: Uji RLS/RPC otomatis** `P0` `L`
  - Cakupan: anon tidak bisa `select` tabel mana pun, tidak bisa memanggil RPC admin/peserta langsung, token attempt A tidak bisa menulis attempt B, admin nonaktif ditolak, `get_attempt_state` tanpa kunci.
  - Selesai bila: `npm run test:rls` hijau di Supabase lokal.

- [ ] **T8.6: E2E admin (Playwright)** `P0` `L`
  - Cakupan: login → buat ujian → impor soal → publish → lihat kode/tautan.
  - Selesai bila: skenario lulus dari database kosong.

- [ ] **T8.7: E2E peserta (Playwright)** `P0` `L`
  - Cakupan: buka tautan → isi nama → kerjakan → refresh di tengah → submit → hasil; termasuk mode offline dan auto-submit lewat manipulasi jam; dua perangkat dengan Kode Lanjut.
  - Selesai bila: semua skenario PRD §12 lulus.

- [ ] **T8.8: Uji beban k6** `P1` `M`
  - Cakupan: 100 peserta serentak: mulai, autosave tiap 5–10 detik, submit; catat error rate dan p95.
  - Selesai bila: target PRD §11 terpenuhi atau deviasi dicatat.

- [ ] **T8.9: Audit aksesibilitas dan performa** `P1` `M`
  - Cakupan: axe pada halaman peserta, kontras WCAG AA, target sentuh ≥ 44 px, uji 360 px, LCP ≤ 2,5 detik pada 4G tersimulasi.
  - Selesai bila: tidak ada pelanggaran serius; temuan dicatat sebagai task baru.

- [ ] **T8.10: CI: lint + typecheck + test** `P1` `S`
  - Cakupan: GitHub Actions (atau skrip `npm run verify`) menjalankan `eslint`, `tsc --noEmit`, `vitest run`.
  - Selesai bila: PR gagal bila salah satu merah.

---

## Fase 9: Deploy dan operasional (M5)

- [ ] **T9.1: Deploy pertama ke Vercel** `P0` `M`
  - Cakupan: variabel lingkungan PRD §5.10, service key hanya server, domain uji.
  - Selesai bila: login admin dan satu ujian contoh berjalan di URL produksi.

- [ ] **T9.2: Penjadwalan `expire_overdue_attempts`** `P0` `S`
  - Selesai bila: attempt kedaluwarsa berstatus submit dalam ≤ 2 menit tanpa interaksi peserta.

- [ ] **T9.3: Uji coba penuh sesuai checklist §15.2** `P0` `M`
  - Cakupan: jalankan 9 butir checklist dari HP berbeda.
  - Selesai bila: semua tercentang atau bug dicatat sebagai task.

- [ ] **T9.4: Dokumentasi operasional** `P1` `S`
  - Cakupan: README berisi cara membuat admin, migrasi, ekspor cadangan, tombol darurat (tutup sekarang, reset attempt).
  - Selesai bila: orang lain bisa mengoperasikan tanpa bertanya.

---

## Fase 10: Backlog P2 (jangan dikerjakan sebelum P0/P1 selesai)

- [ ] **T10.1: Lupa password via email (AUTH-06)**
- [ ] **T10.2: Whitelist nama peserta per ujian (GST-09)**
- [ ] **T10.3: QR code tautan ujian (EXM-14)**
- [ ] **T10.4: Ekspor PDF / tampilan cetak (RPT-07)**
- [ ] **T10.5: Catat IP dan user-agent (INT-04, default mati)**
- [ ] **T10.6: Peringatan meninggalkan tab (INT-05)**
- [ ] **T10.7: Pembersihan data otomatis (SYS-04)**
- [ ] **T10.8: KaTeX untuk rumus (QST-10)**
- [ ] **T10.9: Mode gelap (§9.1)**

---

## Ringkasan jumlah

| Fase | Task | Fokus |
|---|---|---|
| 0 | 7 | Fondasi, dependensi, Supabase, rebranding |
| 1 | 12 | Skema, RLS, RPC, seed |
| 2 | 7 | Auth admin, proxy, rate limit |
| 3 | 10 | CRUD ujian, wizard, kunci setelah attempt |
| 4 | 10 | Soal, gambar, DnD, impor CSV/XLSX |
| 5 | 15 | Guest token, runner server-driven, offline, hasil |
| 6 | 10 | Penilaian, rekap, analisis butir, ekspor |
| 7 | 7 | Dashboard, monitor, error, audit, aksesibilitas kosong |
| 8 | 10 | Unit, RLS, e2e, beban, CI |
| 9 | 4 | Deploy, cron, uji coba, dokumentasi |
| 10 | 9 | Backlog P2 |
| **Total** | **101** | |

Urutan yang disarankan: Fase 0 → 1 → 2 → 3 → 4 (paralel dengan 5.1–5.5) → 5 → 6 → 7 → 8 → 9. Fase 10 kapan saja setelah rilis.

## Batas yang harus dijaga

- Jangan mengerjakan task fase berikutnya sebelum definisi "Selesai bila" fase berjalan terpenuhi.
- Jangan menambah fitur di luar PRD §1.4. Kalau muncul ide baru, tulis di bagian backlog, jangan langsung dibuat.
- Setiap task diakhiri `tsc --noEmit` + `eslint` bersih; jangan menumpuk error antar task.
- Jangan hapus data demo sebelum penggantinya berfungsi, kecuali task T5.15 yang memang menuntut penghapusan.
