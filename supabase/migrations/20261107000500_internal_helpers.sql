-- =============================================================================
-- 0005 — Fungsi pendukung internal
-- =============================================================================
-- Fungsi-fungsi di sini TIDAK diekspos ke klien. Semuanya `security definer`
-- dengan `search_path` terkunci, dan `execute`-nya dicabut dari semua peran
-- publik. Hanya dipanggil dari fungsi RPC lain (yang juga security definer)
-- atau dari pekerjaan terjadwal.

-- ---------------------------------------------------------------------------
-- normalisasi_nama(): huruf kecil, spasi dirapikan, trim.
-- Menentukan identitas peserta. Harus deterministik dan dipakai konsisten di
-- `start_attempt` dan `resume_attempt`, kalau tidak peserta yang sama bisa
-- dianggap dua orang berbeda.
-- ---------------------------------------------------------------------------
create or replace function public.normalisasi_nama(p_nama text)
returns text
language sql
immutable
set search_path = public
as $$
  select btrim(regexp_replace(lower(coalesce(p_nama, '')), '\s+', ' ', 'g'))
$$;

comment on function public.normalisasi_nama(text) is
  'Normalisasi nama peserta: lower + rapikan spasi + trim. Kunci identitas attempt.';

-- ---------------------------------------------------------------------------
-- finalize_if_expired(p_attempt_id)
--
-- Menutup attempt yang sudah lewat `expires_at`. Dipanggil LAZY dari
-- get_attempt_state / save_answer / get_result, dan juga oleh
-- expire_overdue_attempts(). Kebenaran tidak boleh bergantung pada cron:
-- kalau cron mati, peserta tetap tidak bisa menambah jawaban setelah waktu
-- habis karena setiap RPC memanggil fungsi ini lebih dulu.
--
-- Idempoten: memanggil dua kali tidak mengubah apa pun pada panggilan kedua.
-- ---------------------------------------------------------------------------
create or replace function public.finalize_if_expired(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt attempts%rowtype;
begin
  select * into v_attempt
  from attempts
  where id = p_attempt_id
  for update;

  if not found then
    return;
  end if;

  -- Hanya attempt yang masih berjalan dan sudah lewat batas waktu.
  if v_attempt.status <> 'in_progress' or now() <= v_attempt.expires_at then
    return;
  end if;

  perform public.hitung_dan_publikasikan(
    p_attempt_id        => v_attempt.id,
    p_submit_reason     => 'timeout',
    p_force_in_progress => true
  );
end;
$$;

comment on function public.finalize_if_expired(uuid) is
  'Menutup attempt yang melewati expires_at. Idempoten; dipanggil lazy oleh RPC baca/tulis.';

-- ---------------------------------------------------------------------------
-- hitung_dan_publikasikan()
--
-- Inti penilaian otomatis. Dipakai oleh submit_attempt (manual) dan oleh
-- finalize_if_expired (timeout), supaya hanya ada SATU jalur penilaian.
--
-- Rumus (PRD §7.7, keputusan K1):
--   PG single   : poin bila opsi terpilih == kunci, selain itu 0
--   PG multiple : poin bila himpunan terpilih == himpunan kunci, selain itu 0
--   essay       : 0 di sini; dinilai manual admin lewat grade_essay
--
-- Status akhir:
--   - tidak ada essay sama sekali            → 'graded'
--   - ada essay yang belum dinilai           → 'needs_grading'
--   - semua essay sudah dinilai              → 'graded'
-- ---------------------------------------------------------------------------
create or replace function public.hitung_dan_publikasikan(
  p_attempt_id        uuid,
  p_submit_reason     text,
  p_force_in_progress boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt        attempts%rowtype;
  v_auto           numeric(7,2) := 0;
  v_max            numeric(7,2) := 0;
  v_essay_total    integer := 0;
  v_essay_pending  integer := 0;
begin
  select * into v_attempt from attempts where id = p_attempt_id;

  if not found then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Penjaga idempotensi: attempt yang sudah selesai dinilai tidak dihitung lagi.
  -- `p_force_in_progress` dipakai finalize_if_expired yang memanggil dari dalam
  -- transaksi yang sama sebelum status berubah.
  if not p_force_in_progress and v_attempt.status <> 'in_progress' then
    return;
  end if;

  -- ---- Nilai soal pilihan ganda -------------------------------------------
  -- Perhitungan dilakukan per soal, memakai `question_order` sebagai daftar
  -- soal yang benar-benar ditampilkan ke peserta. Soal yang tidak dijawab
  -- bernilai 0 (tidak pernah masuk ke tabel attempt_answers).
  with kunci as (
    select q.id            as question_id,
           q.type          as qtype,
           q.points        as points,
           coalesce(
             array_agg(o.id order by o.id) filter (where o.is_correct),
             '{}'::uuid[]
           ) as correct_ids
    from questions q
    left join question_options o on o.question_id = q.id
    where q.id = any (v_attempt.question_order)
    group by q.id, q.type, q.points
  ),
  jawab as (
    select a.question_id,
           coalesce(
             array(select distinct unnest(a.selected_option_ids) order by 1),
             '{}'::uuid[]
           ) as picked_ids
    from attempt_answers a
    where a.attempt_id = p_attempt_id
  ),
  dinilai as (
    select k.question_id,
           k.qtype,
           k.points,
           -- Benar hanya bila kedua himpunan identik. Untuk PG single ini juga
           -- berlaku (satu opsi terpilih == satu kunci), jadi tidak perlu
           -- cabang terpisah — dan menghindari bug bila data punya >1 kunci
           -- pada soal single.
           (
             k.qtype in ('mcq_single', 'mcq_multiple')
             and coalesce(j.picked_ids, '{}'::uuid[]) = k.correct_ids
             and cardinality(k.correct_ids) > 0
           ) as benar
    from kunci k
    left join jawab j on j.question_id = k.question_id
  )
  select
    coalesce(sum(case when benar then points else 0 end), 0),
    coalesce(sum(points), 0),
    count(*) filter (where qtype = 'essay'),
    count(*) filter (
      where qtype = 'essay'
        and not exists (
          select 1 from attempt_answers aa
          where aa.attempt_id = p_attempt_id
            and aa.question_id = dinilai.question_id
            and aa.points_awarded is not null
        )
    )
  into v_auto, v_max, v_essay_total, v_essay_pending
  from dinilai;

  -- ---- Tulis hasil per soal ke attempt_answers -----------------------------
  -- `points_awarded` untuk PG ikut diisi supaya rekap dan layar penilaian
  -- admin menampilkan angka yang sama dengan yang dipakai menghitung total.
  update attempt_answers aa
  set is_correct     = d.benar,
      points_awarded = case when d.benar then d.points else 0 end
  from (
    select q.id as question_id,
           (
             q.type in ('mcq_single', 'mcq_multiple')
             and coalesce(
                   (select array(select distinct unnest(a2.selected_option_ids) order by 1)
                    from attempt_answers a2
                    where a2.attempt_id = p_attempt_id and a2.question_id = q.id),
                   '{}'::uuid[]
                 )
                 = coalesce(
                   (select array_agg(o.id order by o.id) filter (where o.is_correct)
                    from question_options o where o.question_id = q.id),
                   '{}'::uuid[]
                 )
             and exists (select 1 from question_options o2
                         where o2.question_id = q.id and o2.is_correct)
           ) as benar
    from questions q
    where q.id = any (v_attempt.question_order)
      and q.type in ('mcq_single', 'mcq_multiple')
  ) d
  where aa.attempt_id = p_attempt_id
    and aa.question_id = d.question_id;

  -- ---- Simpan skor dan status ---------------------------------------------
  update attempts
  set score_auto   = v_auto,
      max_score    = v_max,
      status       = case
                       when v_essay_total > 0 and v_essay_pending > 0 then 'needs_grading'::attempt_status
                       else 'graded'::attempt_status
                     end,
      submitted_at = coalesce(submitted_at, now()),
      submit_reason = coalesce(submit_reason, p_submit_reason)
  where id = p_attempt_id;
end;
$$;

comment on function public.hitung_dan_publikasikan(uuid, text, boolean) is
  'Menilai PG otomatis dan menetapkan status attempt. Satu-satunya jalur penilaian.';

-- ---------------------------------------------------------------------------
-- Cabut akses publik ke fungsi internal.
-- Tanpa ini, `authenticated` bisa memanggil hitung_dan_publikasikan langsung
-- dan memaksa attempt orang lain dinilai.
-- ---------------------------------------------------------------------------
revoke execute on function public.normalisasi_nama(text) from public, anon, authenticated;
revoke execute on function public.finalize_if_expired(uuid) from public, anon, authenticated;
revoke execute on function public.hitung_dan_publikasikan(uuid, text, boolean) from public, anon, authenticated;
