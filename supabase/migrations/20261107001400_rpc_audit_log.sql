-- =============================================================================
-- 0014 — RPC pendukung aksi ujian (T3.2)
-- =============================================================================
-- Rujukan: PRD §7.6, §8.2; EXM-07, EXM-08.
--
-- Kenapa `log_admin_action` harus berupa fungsi SECURITY DEFINER:
--
-- Policy di migrasi 0004 sengaja hanya memberi `select` pada `audit_logs` untuk
-- `authenticated` — tidak ada policy insert/update/delete. Itu keputusan sadar:
-- kalau admin bisa menulis langsung, admin juga bisa **memalsukan atau
-- menghapus** jejak auditnya sendiri, dan log semacam itu tidak ada gunanya
-- saat dibutuhkan.
--
-- Konsekuensinya, satu-satunya jalan menulis log adalah fungsi SECURITY DEFINER
-- yang memeriksa hak aksesnya sendiri lewat `assert_admin()`.

create or replace function public.log_admin_action(
  p_action    text,
  p_entity    text,
  p_entity_id text,
  p_before    jsonb default null,
  p_after     jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.assert_admin();
begin
  if p_action is null or btrim(p_action) = '' then
    raise exception 'VALIDATION' using errcode = '22023', detail = 'action wajib diisi.';
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id, before_data, after_data)
  values (v_admin, p_action, p_entity, p_entity_id, p_before, p_after);
end;
$$;

comment on function public.log_admin_action(text, text, text, jsonb, jsonb) is
  'Menulis audit_logs atas nama admin yang sedang login. Satu-satunya jalur tulis ke audit_logs.';

revoke execute on function public.log_admin_action(text, text, text, jsonb, jsonb) from public, anon;
grant  execute on function public.log_admin_action(text, text, text, jsonb, jsonb) to authenticated;
