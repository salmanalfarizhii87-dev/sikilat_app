-- =============================================================================
-- 0020 — buat bucket `question-media` di cloud
-- =============================================================================
-- `supabase/config.toml` hanya mendeklarasikan bucket untuk lingkungan LOKAL;
-- `db push` tidak membuatnya di cloud. Akibatnya impor bank soal gagal
-- mengunggah 45 gambar dengan "Bucket not found" meski soal tetap masuk.
--
-- Bucket ini **privat** dan sengaja tidak punya policy untuk `anon` maupun
-- `authenticated` (keputusan K9): peserta menerima URL bertanda tangan berumur
-- pendek yang dibuat server, bukan URL publik. Tanpa policy apa pun, satu-satunya
-- jalan masuk adalah service role — jadi kunci jawaban tidak bisa ditebak lewat
-- penamaan objek.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'question-media',
  'question-media',
  false,
  2097152,                                            -- 2 MiB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
