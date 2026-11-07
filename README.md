# KilatCBT

Platform ujian online (CBT) yang ringan: admin membuat ujian, peserta masuk
cukup dengan kode ujian dan nama — **tanpa akun**. Pilihan ganda dinilai
otomatis, esai dinilai manual oleh admin.

Repo ini berisi aplikasi utama, landing page, dan dokumen produk.

## Isi Repo

| Folder | Isi |
|---|---|
| [`kilatcbt/`](./kilatcbt) | Aplikasi utama (Next.js 16, App Router). Berisi rute peserta, rute admin, runner ujian, dan landing page di route group `(landing)`. |
| [`landing_page_kilatcbt/`](./landing_page_kilatcbt) | Landing page standalone — sumber asli yang disalin ke `kilatcbt/`. Bisa dijalankan terpisah untuk preview. |
| [`docs/`](./docs) | Dokumen produk: PRD dan daftar task eksekusi. |

## Dokumentasi

| Dokumen | Keterangan |
|---|---|
| [`docs/PRD-KilatCBT.md`](./docs/PRD-KilatCBT.md) | PRD v2.0 — **sumber tunggal** spesifikasi produk. Bila ada konflik dengan dokumen lain, PRD yang menang. |
| [`docs/TASKS.md`](./docs/TASKS.md) | Daftar task turunan PRD, dipecah per sesi kerja dengan definisi "Selesai bila". |

## Menjalankan Aplikasi

```bash
cd kilatcbt
npm install
npm run dev        # http://localhost:3000
```

Perintah lain:

```bash
npm run build      # build produksi
npm run lint       # eslint
```

Untuk preview landing page secara terpisah:

```bash
cd landing_page_kilatcbt
npm install
npm run dev
```

## Alur Singkat

1. **Admin** login → membuat ujian (soal PG dan esai, durasi, jadwal) → membagikan kode atau tautan ujian.
2. **Peserta** membuka tautan → mengisi nama → mengerjakan dengan timer.
3. Sistem menilai PG otomatis; admin menilai esai.
4. Admin melihat rekap hasil per ujian dan mengunduhnya.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Supabase (auth & database) · Zod · React Hook Form

## Aset

Ilustrasi fitur dan logo berada di [`kilatcbt/public/`](./kilatcbt/public):

| File | Ilustrasi |
|---|---|
| `nilai-otomatis.png` | Penilaian otomatis |
| `belum-selesai.png` | Monitoring peserta yang belum selesai |
| `jawaban-tidak-hilang.png` | Jawaban aman saat koneksi putus |
| `tanpa-akun.png` | Peserta tanpa akun |
| `logo-sikilat.png` | Logo produk |

## Status

Tahap pengembangan. Frontend sudah berjalan dengan data mock; integrasi
Supabase, server actions, dan RLS masih dalam pengerjaan — lihat
[`docs/TASKS.md`](./docs/TASKS.md) untuk rincian yang sudah dan belum dikerjakan.
