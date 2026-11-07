# DESIGN: siKilat

Arah visual untuk aplikasi ujian siKilat. Dokumen ini memegang keputusan, bukan saran.
Setiap baris ditulis supaya bisa dipertanyakan: kalau alasannya tidak bisa dijelaskan dalam
satu kalimat, keputusan itu belum sah.

Sumber kebutuhan: `PRD-siKilat.md` §1.5 (identitas merek) dan §9 (spesifikasi UI/UX).

---

## 1. Design Read

> Aplikasi ujian untuk peserta SMP di HP dan satu guru admin di desktop, bahasa visual
> tenang-institusional dengan satu aksen amber, dial **ENERGY 2 / RHYTHM 2 / MOTION 1**.

Dua audiens dengan konteks yang berlawanan menentukan segalanya:

| | Peserta | Admin |
|---|---|---|
| Perangkat | HP, sering kelas menengah, koneksi tidak stabil | Desktop, duduk, satu orang |
| Kondisi | Tertekan waktu, takut jawaban hilang | Ingin cepat selesai membuat soal |
| Yang dibutuhkan | Satu soal terlihat penuh, timer tidak bisa salah baca | Kepadatan data, tabel yang bisa dipindai |

Karena itu UI tidak boleh "seru". Yang harus terasa: **tenang, jelas, dan tidak menipu**.

---

## 2. Dial

| Dial | Nilai | Alasan |
|---|---|---|
| **ENERGY** | 2 | Peserta sedang tegang; energi visual tinggi menambah beban, energi 1 terlalu birokratis untuk anak SMP |
| **RHYTHM** | 2 | Halaman admin butuh konsistensi (tabel dan panel seragam), halaman peserta boleh punya satu momen berbeda di awal |
| **MOTION** | 1 | Animasi hanya untuk umpan balik aksi (pergantian soal, modal). Tidak ada gerak yang berjalan sendiri, karena layar ujian tidak boleh menarik mata ke tempat lain |

MOTION 1 berarti: tidak ada pulse berulang, tidak ada float, tidak ada parallax. Hanya transisi
warna 150 ms dan satu animasi masuk 200 ms saat soal berganti.

---

## 3. Palet

**2 warna inti + 1 aksen**, sesuai R-29. Neutral tidak dihitung.

| Peran | Token | Nilai | Alasan |
|---|---|---|---|
| Inti 1 | `navy-900` | `#0f2434` | Biru tua dari PRD §1.5 untuk header dan teks kuat; mengikat kesan "lembar ujian resmi" |
| Inti 2 | `canvas` / `surface` | `#f7f6f2` / `#ffffff` | Kertas. Bukan putih murni, supaya kartu putih punya batas alami tanpa bayangan |
| Aksen | `accent-400` | `#ffe16f` | Kuning amber dari PRD §1.5, dipakai **hanya** sebagai isi tombol utama dan penanda status terpilih |

Aturan pakai aksen: satu kali per layar pada elemen yang benar-benar ingin ditekan. Amber tidak
pernah dipakai sebagai warna teks (kontras 1.3:1 di atas putih); untuk teks aksen dipakai
`accent-800` (`#6f5514`, 7.2:1).

**Keluarga warna yang dihapus:** `aqua-*`. Sebelumnya ada 27 pemakaian sebagai family ketiga
(fokus input, badge "info", label pilihan ganda). Dihapus karena tidak menandai apa pun yang
tidak bisa ditandai navy; tiga family membuat tidak ada yang dominan.

**Dua family status, bukan warna merek.** `leaf-*` (hijau) dan `clay-*` (merah bata) hanya muncul
sebagai status yang punya arti tetap: lulus di bawah KKM, pelanggaran, hapus permanen. Keduanya
tidak pernah dipakai untuk dekorasi, judul, atau tombol utama, sehingga palet merek tetap
2 inti + 1 aksen (R-29). Rasio terendahnya 5.7:1 (`clay-600` di atas `clay-50`), masih lulus AA.

**Skala teks wajib lulus WCAG AA di atas `#ffffff`:**

| Token | Nilai | Rasio | Dipakai untuk |
|---|---|---|---|
| `ink` | `#14202b` | 15.9:1 | Judul, teks soal |
| `ink-soft` | `#33414f` | 9.4:1 | Teks isi, label |
| `muted` | `#4d5a67` | 7.0:1 | Keterangan, sel tabel sekunder |
| `faint` | `#626e7a` | 5.1:1 | Teks terkecil yang masih harus terbaca |

`faint` sebelumnya `#9aa0a6` (2.6:1) dan dipakai 93 kali, termasuk untuk placeholder dan satuan
pada statistik. Itu kegagalan kontras paling luas di aplikasi ini.

---

## 4. Tipografi

| Peran | Typeface | Alasan |
|---|---|---|
| Judul | **Outfit** | Geometris dan netral; angka soal ("Soal 7 dari 20") terbaca tegas tanpa kesan dekoratif |
| Isi | **Plus Jakarta Sans** | Dirancang untuk bahasa Indonesia, x-height tinggi, angka jelas pada ukuran 12 sampai 16 px di HP |

Bukan Inter/Geist karena keduanya default tanpa alasan di sini. Pasangan ini dipilih karena teks
aplikasi berbahasa Indonesia dan banyak berisi angka (timer, poin, skor).

**Yang dihapus:** label uppercase dengan tracking lebar (`text-[11px] uppercase tracking-[0.14em]`)
sebagai eyebrow di atas setiap judul. Ada 31 pemakaian. Itu pola template, bukan keputusan, dan
pada ukuran 11 px justru menurunkan keterbacaan. Diganti label biasa, huruf normal, 12 px,
warna `muted`.

Skala: 11 / 12 / 13 / 14 / 16 / 20 / 26 / 34 px. Teks soal di runner tetap 16 px ke atas
(PRD §9.1).

---

## 5. Radius

Satu skala, dipakai menurut fungsi. Bukan satu nilai untuk semua (R-11).

| Token | Nilai | Untuk |
|---|---|---|
| `radius-field` | 10 px | Tombol, input, select, textarea, tombol ikon |
| `radius-card` | 14 px | Kartu, panel, modal, sheet |
| `radius-xs` | 6 px | Badge, chip kecil, kotak nomor soal |

`rounded-full` dipertahankan **hanya** untuk: chip filter, badge status, avatar inisial, dan
tombol ikon bulat yang berdiri sendiri. Sebelumnya 126 pemakaian, termasuk semua tombol dan
semua input, sehingga tidak ada perbedaan antara "ini tombol" dan "ini kartu".

---

## 6. Elevation

| Token | Nilai | Kapan |
|---|---|---|
| `shadow-pop` | `0 8px 24px -12px rgba(15,36,52,0.28)` | Hanya untuk lapisan yang benar-benar mengambang: popover menu, modal, sheet |
| (tanpa) | tidak ada | Semua kartu dan panel |

Kartu memakai border 1 px `line` sebagai pemisah, bukan bayangan. Alasan: 8 kartu berbayar di
satu layar membuat halaman terasa melayang dan hierarki hilang (R-12). Yang mengambang hanya
yang memang menutupi konten lain.

`backdrop-blur` dihapus dari scrim modal dan topbar admin. Scrim modal memakai
`rgba(15,36,52,0.55)` solid; topbar memakai `surface` penuh. Glass hanya boleh 1 sampai 2 elemen
(R-10), dan di sini tidak ada elemen yang membutuhkannya.

---

## 7. Ikon

Sumber: **Lucide**, dengan alasan fungsional: ukuran dan stroke konsisten di 16, 18, dan 20 px,
dan aplikasi ini butuh banyak ikon status yang harus seragam (timer, tersimpan, offline, ragu).

Batas yang dijaga:

- Tidak ada `Sparkles`, `Star`, `Magic`, `Wand`, atau `Robot` sebagai ikon fitur. Enam pemakaian
  `Sparkles` dihapus.
- Ikon petir **hanya** sebagai logo (identitas "Kilat"), tidak pernah sebagai ikon fitur.
- Ikon harus menyebut benda atau aksi yang nyata: `Clock` untuk timer, `Flag` untuk ragu,
  `CloudOff` untuk offline. Tidak ada ikon dekoratif di sebelah judul.

---

## 8. Gerak

| Kejadian | Gerak | Durasi |
|---|---|---|
| Soal berganti | naik 6 px + fade | 200 ms |
| Modal / sheet masuk | naik 12 px + fade | 220 ms |
| Tombol ditekan | `scale(0.985)` | 120 ms |
| Warna hover / fokus | transisi warna | 150 ms |

Tidak ada animasi berulang. `prefers-reduced-motion: reduce` mematikan semuanya kecuali
perubahan warna.

Penanda "Live" di monitor sebelumnya berdenyut terus (`animate-pulse`). Diganti titik statis:
denyut berulang adalah gerak tanpa peristiwa, dan di layar yang dipantau berjam-jam itu melelahkan.

---

## 9. Kejujuran Data

Aplikasi ini masih frontend tanpa backend. Karena itu:

1. **Data contoh diberi label.** Semua nama peserta, nilai, dan statistik berasal dari
   `src/lib/admin-data.ts`. Setiap layar admin yang menampilkannya memasang chip
   **"Data contoh"** di header, dan panel yang memuatnya menyebut sumbernya.
2. **Angka tanpa sumber tidak ditampilkan.** Tidak ada "10K+ peserta", tidak ada "99,9% uptime",
   tidak ada delta persentase karangan.
3. **Identitas admin bukan karangan.** Shell admin membaca email yang dipakai saat login
   (disimpan lokal oleh halaman login mode demo). Tidak ada lagi "Pak Budi" yang tidak pernah
   login.
4. **Kontrol yang belum tersambung diberi label.** Tombol yang belum punya server menampilkan
   toast "Belum tersambung ke server", bukan toast seolah aksi berhasil.

---

## 10. Motif Identitas

Satu motif yang diulang dan hanya milik produk ini: **garis progres tipis di bawah header
runner**. Satu garis 3 px, amber, yang mengisi sesuai jumlah soal terjawab, dan berubah menjadi
navy saat semua terjawab.

Alasan: memberi peserta satu-satunya informasi yang mereka butuhkan sekilas (sudah sejauh mana)
tanpa menambah angka atau teks. Di halaman admin motif yang sama dipakai sebagai garis atas
panel statistik utama, sehingga dua sisi produk terasa satu keluarga.

---

## 11. Yang Tidak Dilakukan

- Tidak ada gradient, orb blur, atau grid titik sebagai latar (R-01, R-07).
- Tidak ada badge di atas H1 yang mengulang isi H1 (R-09).
- Tidak ada panah `→` di setiap tombol; panah hanya pada tombol "lanjut" yang memang berpindah
  langkah (R-08).
- Tidak ada glassmorphism (R-10).
- Tidak ada mode gelap di v1. Alasan: PRD §9.1 menetapkan mode terang sebagai default dan
  menyebut mode gelap P2; menambah toggle sekarang berarti menguji ulang seluruh kontras untuk
  fitur yang belum diminta (R-21).
- Tidak ada ilustrasi stok atau karakter 3D (R-22).
- Tidak ada indikator dev Next.js di layar. `devIndicators: false` di `next.config.ts`; efeknya
  hanya di mode pengembangan, kode produksi tidak terpengaruh.

## 12. Target Sentuh

Semua kontrol yang bisa ditekan minimal 44 x 44 px, termasuk di desktop (R-03). Ukuran `sm` pada
tombol tidak mengecilkan tingginya, hanya padding dan teks. Tautan teks di dalam paragraf
dikecualikan karena bukan target utama, tetapi setiap tombol ikon tetap 44 px.

## 13. Dua Dokumen, Bukan Satu

Landing page dan aplikasi adalah **dua dunia visual yang berbeda**, jadi keduanya punya root
layout sendiri dan tidak pernah berbagi stylesheet:

| | Landing (`src/app/(landing)/`) | Aplikasi (`src/app/(app)/`) |
|---|---|---|
| Latar | `#f9fafb` | `#f7f6f2` |
| Teks utama | `#1a1a1b` | `#14202b` |
| Aksen | kuning `#ffe16f` + biru `#98e2fd` + hijau `#d1f07b` | amber `#ffe16f` tunggal |
| Radius | bebas, mengikuti referensi | `10px` field, `14px` kartu, `6px` xs |
| Nada | ramah, beranimasi, maskot | tenang, institusional |

**Alasan teknis, bukan selera.** `globals.css` landing menulis `body`, `html`, dan `::selection`
tanpa `@layer`, sehingga akan mengalahkan `@layer base` aplikasi kalau keduanya dimuat di dokumen
yang sama. Latar aplikasi akan berubah dari kertas hangat ke abu dingin. Dua root layout membuat
kedua file tidak pernah bertemu: `/` hanya memuat CSS landing, `/admin` dan `/u` hanya memuat CSS
aplikasi. Terbukti lewat computed style: `/` = `#f9fafb`, `/admin` = `#f7f6f2`, nol kebocoran.

**Konsekuensi yang diterima.** Navigasi dari landing ke `/admin/login` atau `/u/...` memicu muat
halaman penuh, bukan transisi klien, karena Next.js memuat ulang saat berpindah root layout. Untuk
alur ini justru diinginkan: peserta yang membuka tautan ujian sebaiknya mulai dari dokumen bersih.

**Batas kepemilikan.** File di `(landing)/` disalin apa adanya dari project terpisah
`landing_page_kilatcbt` (kini sudah dihapus dari repo)
dan **tidak boleh diubah** tanpa izin. Konsekuensinya folder itu dikecualikan dari ESLint, dan
temuan aksesibilitasnya (kontras footer, target sentuh HP) dicatat sebagai keterbatasan yang
diketahui, bukan diperbaiki diam-diam.
