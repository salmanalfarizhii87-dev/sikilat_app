# Arsitektur KilatCBT

Dokumen ini menjelaskan **di mana kode berjalan, data disimpan, dan siapa yang boleh
mengakses apa**. Untuk kebutuhan produk dan rumus bisnis, acuannya tetap
[`PRD-KilatCBT.md`](./PRD-KilatCBT.md). Untuk urutan pekerjaan, acuannya
[`TASKS.md`](./TASKS.md).

## 1. Ringkasan

Tiga layanan, semuanya terkelola. **Tidak ada server yang kita kelola sendiri.**

| Lapisan | Layanan | Yang kita urus |
|---|---|---|
| Aplikasi | **Vercel** (paket Hobby) | Kode Next.js 16 di repo ini |
| Database, Auth, Storage | **Supabase Cloud** (paket Free) | Migrasi SQL di `supabase/migrations/` |
| Sumber kode | **GitHub** (repo publik) | Branch `main` |

Keputusan ini menggantikan opsi "Node server / Docker / Supabase self-hosted" yang
sempat disebut di PRD versi awal. Alasan memilih jalur terkelola:

- Tidak ada VPS yang harus dipatch, di-backup, atau dijaga hidup.
- RLS dan Auth sudah terintegrasi dengan Postgres, tanpa lapisan API buatan sendiri.
- Vercel + Supabase Free cukup untuk skala satu sekolah dan bersifat non-komersial.

## 2. Alur permintaan

```text
Browser
  │
  ├── halaman publik & runner ujian ──► Vercel (Next.js)
  │                                        │
  │                                        ├── Server Component / Server Action
  │                                        │      │
  │                                        │      ├─ klien anon  ──► Supabase (RLS admin)
  │                                        │      └─ klien admin ──► Supabase RPC peserta
  │                                        │
  │                                        └── Route Handler (impor soal, ekspor hasil)
  │
  └── aset statis ──► CDN Vercel
```

Aturan yang mengikat seluruh alur:

1. **Peserta tidak punya identitas di database.** Semua akses peserta lewat Server
   Action yang memanggil RPC bertoken. Peran `anon` dan `authenticated` non-admin
   tidak punya policy apa pun, jadi tidak bisa membaca tabel secara langsung.
2. **Kunci jawaban tidak pernah sampai ke browser.** Soal untuk peserta diambil lewat
   RPC yang hanya memilih kolom aman.
3. **Waktu dan skor ditentukan server.** Timer di klien hanya tampilan; `expires_at`
   dan perhitungan nilai dijalankan di database.
4. **`SUPABASE_SERVICE_ROLE_KEY` hanya di server.** Modul yang memegangnya memakai
   `import "server-only"`, sehingga impor dari komponen klien menjadi error build.

## 3. Tiga klien Supabase

| Berkas | Kunci | Dipakai di | Alasan |
|---|---|---|---|
| `src/lib/supabase/client.ts` | publishable/anon | Komponen klien | Sesi admin di browser; RLS tetap berlaku |
| `src/lib/supabase/server.ts` | publishable/anon + cookie | Server Component, Server Action, Route Handler | Membaca sesi admin dari cookie |
| `src/lib/supabase/admin.ts` | **secret/service role** | Hanya server, tidak pernah di klien | Memanggil RPC peserta dan menandatangani URL Storage |

Kunci `service_role` melewati RLS. Karena itu modul `admin.ts` tidak boleh diimpor
dari file yang punya `"use client"`.

## 4. Lingkungan

Dua project Supabase, satu untuk tiap lingkungan:

| Lingkungan | Project | Dipakai oleh |
|---|---|---|
| Pengembangan | `sikilat-dev` | `next dev` di laptop |
| Produksi | `sikilat-prod` | Deployment Vercel |

Region keduanya `ap-southeast-1` (Singapura) agar latensi dari Indonesia rendah.
Pendaftaran publik dimatikan di kedua project — akun admin dibuat manual, karena
aplikasi ini tidak punya halaman registrasi.

Variabel lingkungan (nama sama di semua lingkungan, lihat `.env.example`):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`,
`APP_TIMEZONE`.

Nilai `.env.local` **tidak pernah** di-commit. Untuk Vercel, variabel diisi lewat
dashboard; `SUPABASE_SERVICE_ROLE_KEY` sebagai variabel server biasa, bukan "Public".

## 5. Skema sebagai kode

`supabase/migrations/` adalah **satu-satunya sumber kebenaran skema**. Perubahan
lewat dashboard Studio hanya boleh untuk eksperimen, lalu harus segera ditulis
ulang sebagai migrasi. Kalau tidak, project dev dan prod akan berbeda diam-diam.

Alur perubahan skema:

```text
tulis migrasi baru  →  npm run db:push:dry        (pratinjau ke sikilat-dev)
                    →  npm run db:push            (terapkan ke sikilat-dev)
                    →  uji di aplikasi
                    →  npm run db:push            (ke sikilat-prod, saat rilis)
                    →  npm run db:types           (regenerasi tipe TypeScript)
```

CLI 3.0.0 bisa dipakai **tanpa Docker** untuk `init`, `link`, `db push`, `db lint`,
`gen types --remote`, dan `test db --remote`. Yang tetap memerlukan Docker adalah
`db dump`, `db reset`, dan `start` — karena itu tidak ada Postgres lokal berbasis
kontainer, dan pengembangan memakai project cloud `sikilat-dev`.

## 6. Batasan paket gratis dan mitigasinya

| Batasan | Dampak | Mitigasi |
|---|---|---|
| Tanpa backup otomatis | Data ujian bisa hilang permanen | `pg_dump` terjadwal lewat GitHub Actions (T0.10) |
| Project di-pause setelah 7 hari tanpa aktivitas | Ujian gagal karena database tidur | Keep-alive terjadwal (T0.9) |
| 500 MB database, 1 GB storage | Cukup untuk teks soal; gambar perlu dijaga | Batas 2 MB per gambar, kompresi di klien |
| Maksimal 2 project aktif | Tidak bisa menambah lingkungan ketiga | Cukup: dev + prod |
| Vercel Hobby hanya non-komersial | Tidak boleh dipakai untuk layanan berbayar | Penggunaan sudah dipastikan non-komersial |

Karena backup hanya berupa artifact GitHub pada repo publik (butuh login, disimpan
90 hari), ini **bukan** pengganti backup sungguhan. Untuk data ujian nyata, unduh
dump secara berkala ke penyimpanan milik sendiri.

## 7. Yang sengaja tidak dipakai

- **Express atau backend terpisah.** Server Actions dan Route Handlers sudah cukup;
  lapisan tambahan hanya menambah permukaan serang dan biaya operasional.
- **ORM.** Klien Supabase sudah bertipe setelah `npm run db:types`; ORM akan
  menduplikasi definisi skema yang sudah ada di migrasi.
- **Docker / VPS.** Tidak ada yang perlu dikelola sendiri.
- **Upstash atau Redis.** Rate limit memakai tabel Postgres (keputusan K2).
- **Supabase self-hosted.** Bertentangan dengan keputusan memakai layanan terkelola.
