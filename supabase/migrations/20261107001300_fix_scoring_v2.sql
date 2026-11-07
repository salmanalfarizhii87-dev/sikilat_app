-- =============================================================================
-- 0013 — hitung_dan_publikasikan: hitung benar sekali, tanpa tabel sementara
-- =============================================================================
-- Riwayat perbaikan fungsi ini:
--   0005 versi awal  → `db lint` menemukan `d.points does not exist` (42703)
--   0010 perbaikan   → memakai tabel sementara `_penilaian`, tapi `alter table`
--                      dan `update` pada tabel sementara tidak bisa diverifikasi
--                      plpgsql_check (42P01) karena dijalankan sebagai
--                      pernyataan lepas
--   0013 versi ini   → logika "benar" dihitung SEKALI di dalam satu query
--                      (CTE), dipakai untuk total sekaligus untuk update
--
-- Kenapa sekali hitung itu penting: versi 0005 punya dua salinan aturan
-- penilaian (satu di total, satu di update per baris). Dua salinan yang sama
-- cepat atau lambat akan berbeda, dan saat itu nilai peserta jadi tidak
-- konsisten antara layar hasil dan rekap admin.

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
  v_attempt       attempts%rowtype;
  v_auto          numeric(7,2) := 0;
  v_max           numeric(7,2) := 0;
  v_essay_total   integer := 0;
  v_essay_pending integer := 0;
  v_benar         uuid[];
begin
  select * into v_attempt from attempts where id = p_attempt_id;

  if not found then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Penjaga idempotensi: attempt yang sudah dinilai tidak dihitung lagi.
  if not p_force_in_progress and v_attempt.status <> 'in_progress' then
    return;
  end if;

  -- ---- Satu query: total nilai + daftar soal yang benar -------------------
  --
  -- Aturan benar (PRD §7.7, keputusan K1 — hanya mode "semua benar"):
  --   himpunan opsi terpilih = himpunan opsi kunci, dan kunci tidak kosong.
  -- Untuk PG single aturan ini otomatis setara (satu terpilih = satu kunci),
  -- jadi tidak perlu cabang terpisah.
  --
  -- Kedua sisi dibandingkan sebagai himpunan terurut: `distinct` membuang
  -- duplikat id yang mungkin terkirim klien, `order by 1` membuat urutan
  -- keduanya sama sehingga perbandingan array sah.
  with per_soal as (
    select
      q.id     as question_id,
      q.type   as qtype,
      q.points as points,
      coalesce(
        array_agg(o.id order by o.id) filter (where o.is_correct),
        '{}'::uuid[]
      ) as correct_ids,
      coalesce(
        (select array(select distinct unnest(a.selected_option_ids) order by 1)
         from attempt_answers a
         where a.attempt_id = p_attempt_id and a.question_id = q.id),
        '{}'::uuid[]
      ) as picked_ids
    from questions q
    left join question_options o on o.question_id = q.id
    where q.id = any (v_attempt.question_order)
    group by q.id, q.type, q.points
  ),
  dinilai as (
    select
      question_id,
      qtype,
      points,
      (qtype in ('mcq_single', 'mcq_multiple')
       and cardinality(correct_ids) > 0
       and picked_ids = correct_ids) as benar,
      -- Essay dianggap belum dinilai bila belum ada `points_awarded`.
      (
        qtype = 'essay'
        and not exists (
          select 1 from attempt_answers aa
          where aa.attempt_id = p_attempt_id
            and aa.question_id = per_soal.question_id
            and aa.points_awarded is not null
        )
      ) as essay_pending
    from per_soal
  )
  select
    coalesce(sum(case when benar then points else 0 end), 0),
    coalesce(sum(points), 0),
    count(*) filter (where qtype = 'essay'),
    count(*) filter (where essay_pending),
    coalesce(array_agg(question_id order by question_id) filter (where benar), '{}'::uuid[])
  into v_auto, v_max, v_essay_total, v_essay_pending, v_benar
  from dinilai;

  -- ---- Tulis hasil per soal ----------------------------------------------
  -- Memakai `v_benar` dari query di atas, bukan menghitung ulang: tidak ada
  -- dua salinan aturan yang bisa menyimpang.
  -- Hanya soal PG; essay dibiarkan `points_awarded` null sampai admin menilai.
  update attempt_answers aa
  set is_correct     = (aa.question_id = any (v_benar)),
      points_awarded = case
                         when aa.question_id = any (v_benar)
                           then (select q.points from questions q where q.id = aa.question_id)
                         else 0
                       end
  where aa.attempt_id = p_attempt_id
    and aa.question_id in (
      select q.id from questions q
      where q.id = any (v_attempt.question_order)
        and q.type in ('mcq_single', 'mcq_multiple')
    );

  -- ---- Simpan skor dan status -------------------------------------------
  update attempts
  set score_auto    = v_auto,
      max_score     = v_max,
      status        = case
                        when v_essay_total > 0 and v_essay_pending > 0
                          then 'needs_grading'::attempt_status
                        else 'graded'::attempt_status
                      end,
      submitted_at  = coalesce(submitted_at, now()),
      submit_reason = coalesce(submit_reason, p_submit_reason)
  where id = p_attempt_id;
end;
$$;

comment on function public.hitung_dan_publikasikan(uuid, text, boolean) is
  'Menilai PG otomatis dan menetapkan status attempt. Satu-satunya jalur penilaian.';

revoke execute on function public.hitung_dan_publikasikan(uuid, text, boolean)
  from public, anon, authenticated;
