-- =============================================================================
-- 0009 — Pekerjaan terjadwal
-- =============================================================================
-- Rujukan: PRD §7.6, bagian "Pekerjaan terjadwal".
--
-- Penting dipahami: cron di sini hanya OPTIMASI. Kebenaran tidak bergantung
-- padanya, karena `get_attempt_state`, `save_answer`, dan `get_result` sudah
-- memanggil `finalize_if_expired` secara lazy. Kalau pg_cron mati berhari-hari,
-- peserta yang waktunya habis tetap tidak bisa menambah jawaban.

create or replace function public.expire_overdue_attempts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_count integer := 0;
begin
  for v_id in
    select id from attempts
    where status = 'in_progress' and now() > expires_at
    for update skip locked
  loop
    perform public.finalize_if_expired(v_id);
    v_count := v_count + 1;
  end loop;

  -- Sekalian bersihkan rate limit lama supaya tidak perlu cron kedua.
  perform public.rate_limit_purge('1 day');

  return v_count;
end;
$$;

revoke execute on function public.expire_overdue_attempts() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Jadwalkan tiap menit (butuh ekstensi pg_cron).
--
-- Pelajaran dari percobaan pertama: `undefined_schema` BUKAN nama kondisi
-- pengecualian yang sah di PL/pgSQL (yang ada `invalid_schema_name`). Karena
-- itu blok ini memakai `when others` dengan pemeriksaan SQLSTATE eksplisit,
-- sehingga migrasi tetap berhasil walau pg_cron tidak bisa diaktifkan.
--
-- SQLSTATE yang ditangani:
--   42501  insufficient_privilege  — bukan superuser
--   3F000  invalid_schema_name     — skema `cron` belum ada
--   0A000  feature_not_supported   — pg_cron tidak terpasang
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron tidak tersedia; jadwalkan public.expire_overdue_attempts() dari luar (Edge Function / GitHub Actions).';
    return;
  end if;

  create extension if not exists pg_cron;

  perform cron.schedule(
    'expire-overdue-attempts',
    '* * * * *',
    $cron$select public.expire_overdue_attempts();$cron$
  );
exception
  when others then
    if sqlstate in ('42501', '3F000', '0A000') then
      raise notice 'pg_cron tidak bisa diaktifkan dari migrasi ini (SQLSTATE %). Jadwalkan public.expire_overdue_attempts() secara manual.', sqlstate;
    else
      raise;
    end if;
end;
$$;
