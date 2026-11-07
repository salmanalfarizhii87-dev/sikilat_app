-- =============================================================================
-- seed.sql — data contoh untuk pengembangan
-- =============================================================================
-- Cara pakai (TIDAK lewat `supabase db reset`; Docker tidak dipakai di proyek ini):
--
--   npx supabase db push --include-seed
--
-- atau tempel isi berkas ini ke SQL Editor di dashboard Supabase.
--
-- Berkas ini aman dijalankan berulang: setiap `insert` memakai pola
-- "insert bila belum ada". Tanpa itu, `db push` kedua akan gagal karena
-- `exams.code` unik dan `admins.user_id` adalah kunci utama.
--
-- PENTING: seed ini mengisi baris `admins` untuk admin yang **sudah ada** di
-- Supabase Auth. Membuat user Auth butuh service role dan tidak bisa dilakukan
-- dari SQL biasa, jadi langkahnya:
--
--   1. Dashboard → Authentication → Add user → isi email + password.
--   2. Salin UID user itu, ganti nilai `admin_uid` di bawah.
--   3. Jalankan berkas ini.
--
-- Contoh UID yang sudah terbukti bekerja di project `sikilat-cbt` selama
-- pengembangan: `273774ff-7460-4178-9dff-add47faec049` (admin.uji@sikilat.test).
-- Nilai itu **tidak** ditulis sebagai default: project baru akan punya UID lain,
-- dan UID yang salah akan melanggar foreign key ke `auth.users` — lebih baik
-- gagal dengan pesan jelas daripada berhasil dengan data hampa.

do $$
declare
  admin_uid uuid := null;   -- <<< ISI dengan UID admin dari Authentication → Users
  admin_name text := 'Admin Sekolah';
  v_exam_id uuid;
  v_q1 uuid; v_q2 uuid; v_q3 uuid; v_q4 uuid; v_q5 uuid;
  v_q6 uuid; v_q7 uuid; v_q8 uuid; v_q9 uuid; v_q10 uuid;
  v_q11 uuid; v_q12 uuid;
begin
  if admin_uid is null then
    raise exception
      'Isi dulu variabel admin_uid di supabase/seed.sql dengan UID admin dari Authentication → Users';
  end if;

  if not exists (select 1 from auth.users where id = admin_uid) then
    raise exception 'User Auth dengan UID % tidak ditemukan. Buat dulu di Authentication → Users.', admin_uid;
  end if;

  -- ============ ADMIN ============
  insert into public.admins (user_id, full_name, is_active)
  values (admin_uid, admin_name, true)
  on conflict (user_id) do update
    set full_name = excluded.full_name,
        is_active = true;

  -- ============ UJIAN CONTOH ============
  -- Sudah `published` supaya halaman peserta bisa langsung dicoba tanpa langkah
  -- tambahan. Tanpa jadwal (`opens_at`/`closes_at` null) ujian terbuka sampai
  -- ditutup manual — bentuk yang paling mudah dipakai saat pengembangan.
  insert into public.exams (
    code, created_by, title, subject_label, description, instructions,
    status, duration_minutes, max_attempts, score_policy, passing_score,
    shuffle_questions, shuffle_options, ask_class,
    result_visibility, result_release
  )
  values (
    'CONTOH1', admin_uid,
    'Ujian Contoh: Matematika dan IPA',
    'Matematika & IPA',
    'Ujian contoh untuk mencoba alur peserta dari awal sampai melihat hasil.',
    'Kerjakan semua soal. Tidak ada pengurangan nilai untuk jawaban salah.',
    'published', 60, 2, 'highest', 70.00,
    true, true, true,
    'score_and_review', 'instant'
  )
  on conflict (code) do nothing;

  select id into v_exam_id from public.exams where code = 'CONTOH1';

  -- Kalau soal sudah ada, hentikan: seed sudah pernah dijalankan.
  if exists (select 1 from public.questions where exam_id = v_exam_id) then
    raise notice 'Ujian CONTOH1 sudah punya soal; seed dilewati.';
    return;
  end if;

  -- ============ SOAL PILIHAN GANDA (10) ============
  -- Poin: 10 soal × 6 = 60, 2 esai × 20 = 40, total 100.

  insert into public.questions (exam_id, position, type, body, points, explanation)
  values (v_exam_id, 1, 'mcq_single', 'Hasil dari 7 × 8 adalah …', 6, '7 × 8 = 56')
  returning id into v_q1;

  insert into public.questions (exam_id, position, type, body, points, explanation)
  values (v_exam_id, 2, 'mcq_single', 'Keliling persegi dengan sisi 9 cm adalah …', 6,
          'Keliling persegi = 4 × sisi = 4 × 9 = 36 cm')
  returning id into v_q2;

  insert into public.questions (exam_id, position, type, body, points, explanation)
  values (v_exam_id, 3, 'mcq_single', 'Hasil dari 3/4 + 1/4 adalah …', 6, '3/4 + 1/4 = 4/4 = 1')
  returning id into v_q3;

  insert into public.questions (exam_id, position, type, body, points, explanation)
  values (v_exam_id, 4, 'mcq_single', 'Bilangan berikut yang habis dibagi 3 adalah …', 6,
          'Jumlah digit 42 = 4 + 2 = 6, habis dibagi 3')
  returning id into v_q4;

  insert into public.questions (exam_id, position, type, body, points, explanation)
  values (v_exam_id, 5, 'mcq_single', 'Satuan SI untuk gaya adalah …', 6, 'Gaya diukur dalam newton (N).')
  returning id into v_q5;

  insert into public.questions (exam_id, position, type, body, points, explanation)
  values (v_exam_id, 6, 'mcq_single', 'Planet yang paling dekat dengan Matahari adalah …', 6,
          'Merkurius adalah planet terdekat dari Matahari.')
  returning id into v_q6;

  insert into public.questions (exam_id, position, type, body, points, explanation)
  values (v_exam_id, 7, 'mcq_single', 'Proses tumbuhan membuat makanan disebut …', 6,
          'Fotosintesis mengubah cahaya menjadi energi kimia.')
  returning id into v_q7;

  insert into public.questions (exam_id, position, type, body, points, explanation)
  values (v_exam_id, 8, 'mcq_single', 'Wujud air pada suhu 0 °C adalah …', 6,
          'Pada 0 °C air berubah dari cair menjadi padat (es).')
  returning id into v_q8;

  -- Soal PG jawaban ganda: dinilai dengan aturan "semua benar" (keputusan K1).
  insert into public.questions (exam_id, position, type, body, points, explanation)
  values (v_exam_id, 9, 'mcq_multiple', 'Manakah yang termasuk bilangan prima? (pilih semua yang benar)', 6,
          '2 dan 5 hanya habis dibagi 1 dan dirinya sendiri. 4 = 2×2, 9 = 3×3.')
  returning id into v_q9;

  insert into public.questions (exam_id, position, type, body, points, explanation)
  values (v_exam_id, 10, 'mcq_multiple', 'Manakah yang termasuk perubahan fisika? (pilih semua yang benar)', 6,
          'Es mencair dan air menguap hanya berubah wujud, tidak menghasilkan zat baru.')
  returning id into v_q10;

  -- ============ SOAL ESAI (2) ============
  insert into public.questions (exam_id, position, type, body, points, word_min, word_max, reference_answer, explanation)
  values (v_exam_id, 11, 'essay',
          'Jelaskan proses fotosintesis dengan kata-katamu sendiri.',
          20, 20, 120,
          'Tumbuhan menyerap air dan mineral lewat akar, mengambil CO2 lewat stomata, lalu dengan bantuan cahaya matahari dan klorofil menghasilkan glukosa dan oksigen.',
          'Nilai dari kesesuaian dengan komponen kunci: air, CO2, cahaya, klorofil, glukosa, oksigen.')
  returning id into v_q11;

  insert into public.questions (exam_id, position, type, body, points, word_min, word_max, reference_answer, explanation)
  values (v_exam_id, 12, 'essay',
          'Sebutkan tiga contoh perubahan energi dan jelaskan singkat pada tiap contoh.',
          20, 20, 150,
          'Contoh: setrika (listrik→panas), kipas angin (listrik→gerak), lampu (listrik→cahaya).',
          'Butuh tiga contoh dengan pasangan energi sebelum dan sesudah yang benar.')
  returning id into v_q12;

  -- ============ OPSI PILIHAN GANDA ============
  -- `is_correct` hanya di sini (server); peserta tidak pernah menerima kolom ini.
  insert into public.question_options (question_id, position, body, is_correct) values
    (v_q1, 1, '54', false), (v_q1, 2, '56', true), (v_q1, 3, '58', false), (v_q1, 4, '64', false),
    (v_q2, 1, '18 cm', false), (v_q2, 2, '27 cm', false), (v_q2, 3, '36 cm', true), (v_q2, 4, '81 cm', false),
    (v_q3, 1, '1', true), (v_q3, 2, '4/8', false), (v_q3, 3, '2/4', false), (v_q3, 4, '1/2', false),
    (v_q4, 1, '32', false), (v_q4, 2, '42', true), (v_q4, 3, '52', false), (v_q4, 4, '62', false),
    (v_q5, 1, 'joule', false), (v_q5, 2, 'watt', false), (v_q5, 3, 'newton', true), (v_q5, 4, 'pascal', false),
    (v_q6, 1, 'Venus', false), (v_q6, 2, 'Merkurius', true), (v_q6, 3, 'Bumi', false), (v_q6, 4, 'Mars', false),
    (v_q7, 1, 'respirasi', false), (v_q7, 2, 'fotosintesis', true), (v_q7, 3, 'transpirasi', false), (v_q7, 4, 'fermentasi', false),
    (v_q8, 1, 'gas', false), (v_q8, 2, 'cair', false), (v_q8, 3, 'padat', true), (v_q8, 4, 'plasma', false),
    -- PG jawaban ganda: 2 dan 5 benar
    (v_q9, 1, '2', true), (v_q9, 2, '4', false), (v_q9, 3, '5', true), (v_q9, 4, '9', false),
    (v_q10, 1, 'Es mencair', true), (v_q10, 2, 'Kertas terbakar', false),
    (v_q10, 3, 'Air menguap', true), (v_q10, 4, 'Besi berkarat', false);

  raise notice 'Seed selesai: ujian CONTOH1 dengan 12 soal (10 PG + 2 esai), max 100 poin.';
end $$;
