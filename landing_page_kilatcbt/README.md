# KilatCBT — Landing Page (Next.js)

Landing page **KilatCBT** yang dibangun ulang mengikuti desain landing page
**pintarly.id** (layout, tipografi, warna, dan perilaku scroll), dengan isi/fitur
sesuai `PRD-KilatCBT.md`. Logo memakai aset asli; ilustrasi lain masih blok
placeholder polos.

## Yang perlu dipindah ke project utama

```
app/page.tsx            →  src/app/page.tsx     (atau app/page.tsx)
app/globals.css         →  src/app/globals.css  (gabungkan dengan CSS-mu, lihat catatan)
app/layout.tsx          →  src/app/layout.tsx   (font + metadata)
app/icon.png            →  src/app/icon.png     (favicon)
public/logo-sikilat.png →  public/logo-sikilat.png
```

Kalau `app/icon.png` sudah ada di project tujuan, hapus salah satu — Next.js
menganggap dua file icon di satu segmen sebagai konflik.

Tidak ada dependency runtime tambahan. Semua ikon inline SVG. Import eksternal
hanya `next/image`, `next/navigation` (`useRouter`), dan `next/font/google`
(Outfit + Plus Jakarta Sans) — semuanya bagian dari Next.js.

File lain hanya wadah agar halaman bisa langsung dijalankan:

| File | Fungsi |
|---|---|
| `package.json`, `tsconfig.json`, `postcss.config.mjs`, `next.config.ts` | Setup Next.js 16 + Tailwind v4 |
| `app/layout.tsx` | Root layout, font, `metadata` |
| `scripts/trim-logo.cjs` | Regenerate logo + favicon dari `logo_sikilat.png` |

## Menjalankan preview

```bash
npm install
npm run dev      # http://localhost:3000
```

## Cara mengganti placeholder dengan gambar asli

Semua slot gambar memakai satu komponen `Ph` (kelas `.lp-ph`, kotak abu-abu
putus-putus). Cari komentar `PLACEHOLDER` di `page.tsx` untuk menemukan semuanya:

```tsx
{/* PLACEHOLDER: logo mark 32×32 */}
<Ph className="h-8 w-8" radius={10} />
```

Ganti `<Ph ... />` dengan `<Image ... />` (atau `<img>`) memakai ukuran/rasio yang
sama. Daftar slot:

| Slot | Jumlah | Ukuran acuan |
|---|---|---|
| Avatar kartu mode | 4 | 84×84 (desktop) / 50×40 (mobile) |
| Ilustrasi benefit | 4 | 480×360 |
| Ilustrasi trust | 1 | 232×232 (desktop) / 96×96 (mobile) |
| Avatar ulasan | 8 | 40×40 |
| Mockup band | 4 | 440×336 |
| Avatar kartu admin | 1 | 40×40 |
| Ilustrasi final CTA | 1 | 640×400 |
| Badge footer | 3 | 120/135/129 × 44 |

Logo (nav + footer) **sudah memakai aset asli**, bukan placeholder:
`public/logo-sikilat.png` — 771×1016, latar transparan, sudah di-trim. Dirender
tinggi 34px di nav dan 38px di footer lewat `next/image`; lebarnya mengikuti
rasio (`width: auto`).

Maskot hero (sebelah kanan judul "Lagi mau ujian apa?") juga **sudah memakai aset
asli**. Karena logo-nya portrait sedangkan slot lama landscape, tingginya dikunci
per breakpoint lewat `.lp-hero-logo` (86 / 99 / 160 / 238 px) supaya tinggi
`.lp-hero-head` tetap 300px di desktop dan judul tidak bergeser.

### Logo & favicon

File sumber `logo_sikilat.png` di root punya padding transparan besar
(kanvas 1254×1254, isi asli cuma 747×992). Padding itu membuat jarak logo ke teks
terlihat jauh. Karena itu aset di `public/` **selalu hasil trim**, bukan file
mentah — jangan copy `logo_sikilat.png` langsung ke `public/`.

Kalau logo diganti, jalankan:

```bash
node scripts/trim-logo.cjs
```

Skrip itu melakukan dua hal sekaligus: trim padding → `public/logo-sikilat.png`,
dan bikin favicon 512×512 → `app/icon.png`.

Preview kartu mode (`.peek`), mockup HP admin (`.lp-phone`), dan varian mobile
(`.peek-m`) dibangun dari DOM/CSS, bukan gambar — jadi tetap tajam di semua ukuran
dan tidak perlu aset.

## Menyesuaikan

- **Nama produk** → konstanta `APP_NAME` di atas `page.tsx`.
- **Token warna/tipografi** → blok `:root` di `globals.css` (variabel `--lp-*`,
  `--black-charcoal`, `--neutral-*`, `--footer-*`).
- **Konten** → array `NAV_LINKS`, `NAV_MORE`, `MODE_CARDS`, `BENEFITS`,
  `REVIEWS_ROW_1/2`, `BANDS`, `FAQ`, `FOOTER_COLUMNS`, `FOOTER_META`.
- **Rute tombol** (PRD §9.2):
  - form kode → `/u/{KODE}`
  - `Masuk admin` → `/admin/login`
  - `Buat ujian` → `/admin/exams/new`

## Isi halaman (dipetakan ke PRD)

| Section | Komponen | Sumber di PRD |
|---|---|---|
| Navbar pill (transparan → glass pill saat scroll) | `Nav` | 9.2 (peta halaman) |
| Hero + form kode ujian | `Hero`, `CodeForm` | GST-01, GST-02, 1.5 |
| 4 kartu mode ujian (Ulangan/Tryout/Kuis/Seleksi) | `Hero`, `MODE_CARDS` | 1.2, 3 (persona) |
| 4 section benefit bergantian | `Benefits` | GST-04/05/06, RUN-02/03/04, GRD-01/02, RPT-01..06 |
| Rating + marquee ulasan | `Trust` | G2, G4, G5 |
| 4 band fitur besar | `Bands` | EXM-01..08, RUN-01..08, INT-01..05 |
| Sorotan aplikasi admin + mockup HP | `AdminSection` | DSH-01, RPT-01..06, 9.4 |
| FAQ (5 item) | `Faq` | 6.8, 7.5, 7.7, 10 (edge case) |
| CTA akhir + footer 5 kolom | `FinalCta`, `Footer` | GST-01, 9.2 |

## Catatan implementasi

- `page.tsx` bertanda `"use client"` karena memakai state (nav scroll, form kode,
  marquee pause, accordion footer). Untuk versi Server Component, pindahkan
  `Nav`, `CodeForm`, `Marquee`, dan `FooterColumn` ke komponen klien terpisah.
- Nesting hero bersifat load-bearing: `.lp-hero-head` adalah grid, `.lp-hero-copy`
  memakai `display: contents`, dan `.lp-hero-text` / `.lp-hero-form` /
  `.lp-hero-aily` adalah grid item (`grid-area: text|form|aily`). Menambah wrapper
  box di sekitar `.lp-hero-text` + `.lp-hero-form` akan merusak tinggi head
  desktop 300px.
- Footer memakai pola checkbox + `<label>` (`FooterColumn`) untuk accordion di
  bawah 768px; tautan selalu terbuka pada ≥768px.
- Font hanya lewat `next/font/google`; tidak ada file font lokal.
- Sudah diverifikasi: `npx tsc --noEmit` dan `npx next build` lolos, tanpa scroll
  horizontal pada 390 / 768 / 820 / 900 / 1024 / 1100 / 1280 / 1440 / 1920 px,
  tanpa respons 4xx/5xx dan tanpa error console.
- `globals.css` di repo ini adalah hasil ekstraksi token + kelas dari CSS produksi
  pintarly.id, disesuaikan ke nama `.lp-*`. Saat menggabungkan ke project lain,
  taruh setelah `@import "tailwindcss"` agar kelas tak berlapis (unlayered) tetap
  menang atas utility Tailwind.
