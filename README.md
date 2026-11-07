# KilatCBT

Platform ujian online (CBT) yang ringan: admin membuat ujian, peserta masuk
cukup dengan kode ujian dan nama — **tanpa akun**. Pilihan ganda dinilai
otomatis, esai dinilai manual oleh admin.

## Menjalankan

Semua perintah dijalankan dari root repo:

```bash
npm install
npm run dev        # http://localhost:3000
```

Perintah lain:

```bash
npm run build      # build produksi
npm run start      # jalankan hasil build
npm run lint       # eslint
```

## Struktur

```
.
├── src/                  # kode aplikasi (Next.js App Router)
│   ├── app/              # rute: peserta, admin, (landing)
│   ├── components/       # komponen UI
│   └── lib/              # util, tipe, data mock
├── public/               # aset statis (logo, ilustrasi)
├── assets/               # file sumber desain (logo mentah)
├── scripts/              # skrip utilitas (trim logo)
└── docs/                 # dokumen produk
```

## Dokumentasi

| Dokumen | Keterangan |
|---|---|
| [`docs/PRD-KilatCBT.md`](./docs/PRD-KilatCBT.md) | PRD v2.0 — **sumber tunggal** spesifikasi produk. Bila ada konflik dengan dokumen lain, PRD yang menang. |
| [`docs/TASKS.md`](./docs/TASKS.md) | Daftar task turunan PRD, dipecah per sesi kerja dengan definisi "Selesai bila". |
| [`DESIGN.md`](./DESIGN.md) | Panduan desain dan token visual. |

## Alur Singkat

1. **Admin** login → membuat ujian (soal PG dan esai, durasi, jadwal) → membagikan kode atau tautan ujian.
2. **Peserta** membuka tautan → mengisi nama → mengerjakan dengan timer.
3. Sistem menilai PG otomatis; admin menilai esai.
4. Admin melihat rekap hasil per ujian dan mengunduhnya.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Supabase (auth & database) · Zod · React Hook Form

## Aset

Ilustrasi fitur dan logo berada di `public/`:

| File | Ilustrasi |
|---|---|
| `nilai-otomatis.png` | Penilaian otomatis |
| `belum-selesai.png` | Monitoring peserta yang belum selesai |
| `jawaban-tidak-hilang.png` | Jawaban aman saat koneksi putus |
| `tanpa-akun.png` | Peserta tanpa akun |
| `logo-sikilat.png` | Logo produk |

Logo di `public/` adalah hasil trim dari `assets/logo_sikilat.png`. Kalau logo
diganti, jalankan ulang:

```bash
node scripts/trim-logo.cjs
```

## Status

Tahap pengembangan. Frontend sudah berjalan dengan data mock; integrasi
Supabase, server actions, dan RLS masih dalam pengerjaan — lihat
[`docs/TASKS.md`](./docs/TASKS.md) untuk rincian yang sudah dan belum dikerjakan.
