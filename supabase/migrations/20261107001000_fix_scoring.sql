-- =============================================================================
-- 0010 — Perbaikan bug pada fungsi penilaian
-- =============================================================================
-- Ditemukan oleh `db lint` setelah migrasi 0005 dijalankan.
--
-- Bug 1 (SQLSTATE 42703): `hitung_dan_publikasikan` merujuk `d.points`, padahal
--   subquery `d` hanya memilih `question_id` dan `benar`. Fungsi ini akan GAGAL
--   saat pertama kali dipanggil (submit pertama), bukan saat migrasi. Karena
--   tidak ada yang menutupi kegagalannya, whole flow submit peserta akan error.
--
-- Bug 2 (ditemukan sekalian): penghitungan `benar` ditulis dua kali dengan
--   subquery berbeda (satu di CTE `dinilai`, satu di blok update). Dua salinan
--   logika yang sama cepat atau lambat akan berbeda. Sekarang dihitung SEKALI
--   ke tabel sementara, lalu dipakai untuk total dan untuk update per baris.
--
-- Perbaikan dilakukan dengan `create or replace function`, jadi tidak ada data
-- yang disentuh dan migrasi tetap idempoten.

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
begin
  select * into v_attempt from attempts where id = p_attempt_id;

  if not found then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Penjaga idempotensi: attempt yang sudah dinilai tidak dihitung lagi.
  if not p_force_in_progress and v_attempt.status <> 'in_progress' then
    return;
  end if;

  -- ---- Hitung sekali, simpan di tabel sementara ---------------------------
  -- `_penilaian` memuat satu baris per soal yang ditampilkan ke peserta,
  -- lengkap dengan poin dan status benar. Semua langkah berikutnya membaca
  -- dari sini, sehingga tidak ada dua salinan logika yang bisa menyimpang.
  --
  -- `on commit drop` menghapus tabel otomatis di akhir transaksi, jadi tidak
  -- ada sisa objek walau fungsi dipanggil berulang.
  drop table if exists _penilaian;

  create temporary table _penilaian on commit drop as
  select
    q.id            as question_id,
    q.type          as qtype,
    q.points        as points,
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
  group by q.id, q.type, q.points;

  -- Benar hanya bila kedua himpunan identik DAN ada kunci.
  -- Untuk PG single aturan ini otomatis berlaku (satu opsi terpilih == satu
  -- kunci), jadi tidak perlu cabang terpisah.
  alter table _penilaian add column benar boolean;
  update _penilaian
  set benar = (qtype in ('mcq_single', 'mcq_multiple')
               and cardinality(correct_ids) > 0
               and picked_ids = correct_ids);

  select
    coalesce(sum(case when benar then points else 0 end), 0),
    coalesce(sum(points), 0),
    count(*) filter (where qtype = 'essay')
  into v_auto, v_max, v_essay_total
  from _penilaian;

  -- Essay yang belum punya `points_awarded` masih menunggu admin.
  select count(*) into v_essay_pending
  from _penilaian p
  where p.qtype = 'essay'
    and not exists (
      select 1 from attempt_answers aa
      where aa.attempt_id = p_attempt_id
        and aa.question_id = p.question_id
        and aa.points_awarded is not null
    );

  -- ---- Tulis hasil per soal ----------------------------------------------
  -- Hanya soal PG; essay dibiarkan `points_awarded` null sampai admin menilai.
  update attempt_answers aa
  set is_correct     = p.benar,
      points_awarded = case when p.benar then p.points else 0 end
  from _penilaian p
  where aa.attempt_id = p_attempt_id
    and aa.question_id = p.question_id
    and p.qtype in ('mcq_single', 'mcq_multiple');

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
