-- =============================================================================
-- 0006 — Rate limiting
-- =============================================================================
-- Keputusan K2: tabel Postgres, tanpa Upstash.
--
-- Kenapa atomik: rate limit yang bisa dibaca lalu ditulis dalam dua langkah
-- akan bocor di bawah permintaan bersamaan — 20 permintaan paralel semuanya
-- membaca counter = 0, lalu semuanya lolos. `insert ... on conflict do update`
-- menyatukan baca+tulis dalam satu pernyataan atomik.

create or replace function public.rate_limit_consume(
  p_bucket      text,
  p_identifier  text,
  p_limit       integer,
  p_window_secs integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_row          rate_limits%rowtype;
begin
  if p_limit <= 0 or p_window_secs <= 0 then
    raise exception 'RATE_LIMIT_PARAMS_INVALID' using errcode = '22023';
  end if;

  -- Awal jendela = waktu server dibulatkan ke kelipatan p_window_secs.
  -- Dibulatkan, bukan dihitung dari permintaan pertama, supaya jendela tidak
  -- bergeser terus dan mudah diprediksi/dibersihkan.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_secs) * p_window_secs
  );

  insert into rate_limits (bucket, identifier, window_start, counter)
  values (p_bucket, p_identifier, v_window_start, 1)
  on conflict (bucket, identifier, window_start) do update
    set counter = rate_limits.counter + 1
  returning * into v_row;

  return jsonb_build_object(
    'allowed',   v_row.counter <= p_limit,
    'count',     v_row.counter,
    'limit',     p_limit,
    'remaining', greatest(p_limit - v_row.counter, 0),
    'reset_at',  v_window_start + make_interval(secs => p_window_secs)
  );
end;
$$;

comment on function public.rate_limit_consume(text, text, integer, integer) is
  'Menambah counter dan mengembalikan apakah permintaan masih diizinkan. Atomik.';

-- Bersihkan baris lama. Dipanggil dari expire_overdue_attempts() supaya tidak
-- perlu cron terpisah.
create or replace function public.rate_limit_purge(p_older_than interval default '1 day')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from rate_limits where window_start < now() - p_older_than;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.rate_limit_consume(text, text, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.rate_limit_purge(interval)
  from public, anon, authenticated;
