-- =============================================================================
-- 0016 — tipe soal `true_false` + kolom teks bacaan
-- =============================================================================
-- Rujukan: bank soal TKA (493 soal) yang diimpor ke aplikasi.
--
-- Dua perubahan skema, keduanya diminta eksplisit oleh pemilik produk:
--
-- 1. **`true_false`** — tipe soal baru untuk soal berisi beberapa pernyataan
--    yang masing-masing harus dinilai Benar atau Salah. Bank soal punya 85 soal
--    seperti ini dan sebelumnya tidak punya tempat di aplikasi.
--
-- 2. **`passage`** — teks bacaan bersama. 228 soal Bahasa Indonesia mengacu ke
--    satu teks yang dibaca sebelum menjawab, dan satu teks bisa dipakai sampai
--    6 soal. Menempelkan teks itu ke `body` setiap soal membuat siswa membaca
--    ulang teks 377 karakter rata-rata (terpanjang 1.824) untuk tiap soal.
--
-- ---------------------------------------------------------------------------
-- Kenapa `true_false` tidak butuh kolom atau aturan penilaian baru
-- ---------------------------------------------------------------------------
-- Secara data, soal benar/salah **identik** dengan pilihan ganda banyak
-- jawaban: sekumpulan opsi, dan sebagian opsi bertanda `is_correct` (yaitu
-- pernyataan yang bernilai Benar). Yang berbeda hanya tampilannya — radio
-- Benar/Salah per pernyataan, bukan kotak centang.
--
-- Karena itu `true_false` sengaja dimasukkan ke aturan penilaian yang sudah ada
-- ("semua benar", keputusan K1) alih-alih membuat aturan kedua. Satu aturan
-- untuk dua tipe berarti tidak ada dua salinan logika yang bisa menyimpang.
--
-- Satu konsekuensi yang perlu diketahui: peserta **wajib** memberi jawaban
-- untuk setiap pernyataan. Kalau satu pernyataan dibiarkan kosong, himpunan
-- terpilih tidak akan sama dengan himpunan kunci dan soalnya dinilai salah.
-- Itu memang perilaku yang diinginkan — soal benar/salah yang dijawab separuh
-- tidak boleh dianggap benar.

-- ---------------------------------------------------------------------------
-- 1. Tipe soal baru
-- ---------------------------------------------------------------------------
-- `alter type ... add value` tidak bisa dijalankan di dalam blok transaksi yang
-- sama dengan pemakaian nilainya. Migrasi ini hanya menambah nilai; fungsi yang
-- memakainya ada di migrasi berikutnya (0017).
alter type question_type add value if not exists 'true_false';

-- ---------------------------------------------------------------------------
-- 2. Teks bacaan
-- ---------------------------------------------------------------------------
-- Disimpan di `questions`, bukan di tabel `passages` tersendiri.
--
-- Alasannya: satu teks dipakai oleh beberapa soal, tetapi pemakaiannya selalu
-- di dalam satu ujian. Tabel terpisah menuntut relasi, urutan tampil, dan
-- penanganan saat soal dihapus — semuanya untuk menghemat penyimpanan beberapa
-- kilobyte. Dengan kolom ini, duplikasi teks antar soal dalam satu ujian
-- (rata-rata 377 karakter) jauh lebih murah daripada kerumitan relasinya.
--
-- Duplikat teks tidak masalah untuk penilaian: setiap soal tetap dinilai
-- sendiri-sendiri.
alter table questions
  add column if not exists passage text;

comment on column questions.passage is
  'Teks bacaan bersama yang ditampilkan sebelum pertanyaan (khusus soal berbasis teks). Boleh null.';

comment on column questions.type is
  'mcq_single = satu jawaban; mcq_multiple = banyak jawaban (semua benar); true_false = pernyataan Benar/Salah (semua benar); essay = dinilai manual.';
