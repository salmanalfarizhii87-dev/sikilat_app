-- =============================================================================
-- 0004 — Fungsi bantu dan RLS
-- =============================================================================
-- Rujukan: PRD §7.5.
--
-- Prinsip: peserta TIDAK punya identitas di database, jadi tidak ada policy
-- untuk peserta sama sekali. Semua tabel dikunci; satu-satunya akses langsung
-- adalah admin aktif. Akses peserta hanya lewat RPC yang dieksekusi server
-- dengan service role.

-- ---------------------------------------------------------------------------
-- is_admin(): satu-satunya sumber kebenaran "apakah pemanggil ini admin?".
--
-- SECURITY DEFINER supaya bisa membaca `admins` meski RLS di tabel itu ketat;
-- tanpa ini, policy pada `admins` akan rekursif memanggil dirinya sendiri.
-- `set search_path = public` wajib: tanpa itu, pengguna bisa membuat objek di
-- skema lain dan membajak resolusi nama.
-- `stable` (bukan `volatile`) supaya planner bisa meng-cache hasilnya dalam
-- satu pernyataan.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where user_id = auth.uid() and is_active
  )
$$;

comment on function public.is_admin() is
  'True bila auth.uid() terdaftar di admins dan is_active. Dipakai semua policy RLS.';

-- ---------------------------------------------------------------------------
-- Aktifkan RLS di SEMUA tabel. Tanpa ini, policy tidak berlaku sama sekali.
-- ---------------------------------------------------------------------------
alter table admins           enable row level security;
alter table exams            enable row level security;
alter table questions        enable row level security;
alter table question_options enable row level security;
alter table attempts         enable row level security;
alter table attempt_answers  enable row level security;
alter table attempt_events   enable row level security;
alter table audit_logs       enable row level security;

-- rate_limits: RLS aktif TANPA policy. Hanya service_role (yang melewati RLS)
-- yang boleh menyentuhnya; klien tidak pernah memanggilnya langsung.
alter table rate_limits      enable row level security;

-- ---------------------------------------------------------------------------
-- Policy: satu pola untuk semua tabel data — hanya admin aktif.
--
-- `for all` mencakup select/insert/update/delete. `using` mengatur baris yang
-- boleh dilihat/diubah, `with check` mengatur baris hasil tulis yang diizinkan
-- (mencegah admin non-aktif menyisipkan data, dan mencegah `created_by` palsu
-- ditolak oleh FK, bukan oleh policy).
-- ---------------------------------------------------------------------------
create policy admin_all on exams
  for all using (is_admin()) with check (is_admin());
create policy admin_all on questions
  for all using (is_admin()) with check (is_admin());
create policy admin_options_all on question_options
  for all using (is_admin()) with check (is_admin());
create policy admin_all on attempts
  for all using (is_admin()) with check (is_admin());
create policy admin_answers_all on attempt_answers
  for all using (is_admin()) with check (is_admin());
create policy admin_events_all on attempt_events
  for all using (is_admin()) with check (is_admin());

-- audit_logs hanya boleh dibaca admin. Tidak ada policy insert/update/delete
-- untuk `authenticated`: log ditulis oleh fungsi SECURITY DEFINER saja, supaya
-- admin tidak bisa memalsukan atau menghapus jejak audit.
create policy admin_read on audit_logs
  for select using (is_admin());

-- admins: admin boleh membaca barisnya sendiri. Menambah/menghapus admin
-- dilakukan lewat SQL/seed, bukan dari aplikasi.
create policy admin_self_read on admins
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- GRANT tingkat tabel.
--
-- RLS hanya menyaring BARIS, bukan kolom dan bukan hak akses tabel. Tanpa
-- GRANT eksplisit, peran `authenticated` tetap tidak bisa menyentuh tabel ini
-- meski punya policy. `anon` sengaja tidak diberi GRANT apa pun.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  exams, questions, question_options, attempts, attempt_answers, attempt_events
  to authenticated;

grant select on admins, audit_logs to authenticated;

-- Tidak ada grant untuk rate_limits: hanya service_role.
