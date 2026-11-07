# Provisioning Supabase Cloud

Panduan ini adalah bagian manual dari **T0.0**. Pembuatan project tidak bisa
dilakukan dari repo karena butuh login akun Supabase, jadi langkah di bawah
dijalankan sekali oleh pemilik project. Setelah selesai, seluruh pekerjaan
database kembali ke migrasi di `supabase/migrations/`.

Acuan arsitektur: [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Yang akan dibuat

| Nama project | Region | Dipakai untuk |
|---|---|---|
| `sikilat-dev` | Southeast Asia (Singapore) `ap-southeast-1` | `npm run dev` di laptop |
| `sikilat-prod` | Southeast Asia (Singapore) `ap-southeast-1` | Deployment Vercel |

Region Singapura dipilih karena paling dekat ke Indonesia; latensi ke Jakarta
sekitar 20–40 ms, jauh lebih baik daripada region Eropa/Amerika.

## Langkah 1 — Buat project `sikilat-dev`

1. Buka <https://supabase.com/dashboard>, login.
2. **New project**.
3. Isi:
   - **Name**: `sikilat-dev`
   - **Database Password**: klik *Generate a password*, lalu **salin ke pengelola kata sandi**. Password ini tidak bisa dilihat lagi setelah project dibuat dan dibutuhkan untuk `supabase link`/`db push`.
   - **Region**: `Southeast Asia (Singapore)`
   - **Plan**: Free
4. Tunggu sampai status **ACTIVE_HEALTHY** (biasanya 1–2 menit).

## Langkah 2 — Tutup pendaftaran publik

Aplikasi ini **tidak punya halaman registrasi**. Akun hanya dibuat admin, jadi
pendaftaran publik harus mati — kalau tidak, siapa pun bisa membuat akun.

1. **Authentication** → **Providers** → **Email**.
2. Matikan **Allow new users to sign up**.
3. Biarkan **Enable email provider** tetap aktif (dipakai login admin).

## Langkah 3 — Atur URL autentikasi

1. **Authentication** → **URL Configuration**.
2. **Site URL**: `http://localhost:3000` untuk project dev.
3. **Redirect URLs**: tambahkan `http://localhost:3000/**`.

Untuk `sikilat-prod`, ganti dengan domain Vercel (mis.
`https://sikilat.vercel.app`) setelah deployment pertama.

## Langkah 4 — Salin kredensial ke `.env.local`

1. **Project Settings** → **Data API**:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API keys** → kunci `anon`/`publishable` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. **Project Settings** → **API Keys** → kunci `service_role`/`secret` → `SUPABASE_SERVICE_ROLE_KEY`

```bash
cp .env.example .env.local
# lalu isi 3 nilai di atas
```

> Project baru Supabase menerbitkan `sb_publishable_...` dan `sb_secret_...`;
> project lama memakai JWT `anon` dan `service_role`. Keduanya sah. Nama variabel
> di repo ini tetap sama, hanya nilainya yang berbeda.

**Jangan pernah** menempelkan `service_role`/`secret` ke variabel berprefiks
`NEXT_PUBLIC_`, dan jangan commit `.env.local` (sudah di-`.gitignore`).

## Langkah 5 — Hubungkan repo ke project dev

Butuh **access token**, bukan password database:

1. Buka <https://supabase.com/dashboard/account/tokens> → **Generate new token**.
2. Jalankan:

```bash
npx supabase login          # tempel token
npx supabase link --project-ref <project-ref-dev>
```

`<project-ref-dev>` adalah bagian acak pada URL project, mis.
`abcdefghijklmnop` dari `https://abcdefghijklmnop.supabase.co`.

Saat diminta password database, isi password dari Langkah 1.

## Langkah 6 — Verifikasi

```bash
npm run db:push:dry     # harus berhasil terhubung; "no migrations" itu wajar
npm run db:lint         # belum ada objek = tidak ada temuan
```

Kalau `db:push:dry` gagal dengan `AccessTokenRequiredError`, berarti `login`
belum dijalankan. Kalau gagal dengan `password`, berarti `link` belum benar.

## Langkah 7 — Buat `sikilat-prod`

Ulangi Langkah 1–3 dengan nama `sikilat-prod` dan domain Vercel sebagai Site URL.
Kredensial prod **hanya** dipasang di Vercel (Project → Settings → Environment
Variables), tidak di `.env.local`.

Untuk menghubungkan repo ke prod saat rilis:

```bash
npx supabase link --project-ref <project-ref-prod>
npm run db:push
```

Setelah itu **kembalikan link ke dev** agar pekerjaan berikutnya tidak menyentuh
produksi secara tidak sengaja:

```bash
npx supabase link --project-ref <project-ref-dev>
```

## Setelah provisioning selesai

| Task | Isi |
|---|---|
| T0.5 | `npm run db:types` untuk mengganti placeholder dengan tipe sungguhan |
| T0.9 | Workflow keep-alive agar project tidak di-pause setelah 7 hari |
| T0.10 | Backup `pg_dump` harian lewat GitHub Actions |
| Fase 1 | Migrasi skema, RLS, dan RPC |

## Batasan paket Free yang perlu diingat

- 500 MB database, 1 GB storage — cukup untuk teks soal; gambar dibatasi 2 MB.
- **Tanpa backup otomatis.** Kalau data hilang, hilang permanen. T0.10 wajib.
- **Project di-pause setelah 7 hari tanpa aktivitas.** T0.9 wajib.
- Maksimal 2 project aktif — karena itu hanya dev dan prod, tidak ada staging.
