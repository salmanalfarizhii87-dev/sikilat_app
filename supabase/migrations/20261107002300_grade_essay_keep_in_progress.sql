-- =============================================================================
-- 0023 — grade_essay: jangan menutup attempt yang masih berjalan
-- =============================================================================
-- Bug yang diperbaiki (ditemukan saat menyambungkan runner peserta ke server):
--
-- `grade_essay` (0008) selalu menulis status akhir:
--
--     status = case when v_pending = 0 then 'graded' else 'needs_grading' end
--
-- Padahal admin **bisa** menilai esai selagi peserta masih mengerjakan — mis.
-- membuka halaman penilaian untuk attempt yang belum dikumpulkan. Begitu satu
-- esai dinilai dan tidak ada esai lain yang menunggu, attempt langsung
-- berstatus `graded` walaupun peserta masih di layar soal.
--
-- Akibatnya bukan sekadar label salah. `submit_attempt` dan
-- `hitung_dan_publikasikan` sama-sama menjaga idempotensi dengan
-- `if v_attempt.status <> 'in_progress' then return;`. Jadi saat peserta
-- akhirnya mengumpulkan, penilaian otomatis **dilewati seluruhnya**:
-- `score_auto` tetap 0 dan `max_score` tidak pernah diisi. Peserta yang
-- menjawab benar 10 soal objektif menerima nilai 8/20 — hanya angka esainya.
-- Terbukti pada uji RPC: `score_auto` = 0 padahal satu soal PG dijawab benar.
--
-- Perbaikan: status hanya berpindah bila attempt memang sudah tidak berjalan.
-- Selama masih `in_progress`, yang disimpan hanyalah `score_manual`; status
-- dibiarkan, dan `hitung_dan_publikasikan` yang menentukannya saat peserta
-- mengumpulkan (ia sudah menghitung esai yang `points_awarded`-nya terisi,
-- jadi esai yang dinilai lebih awal tidak menahan status `graded`).
--
-- `finalize_if_expired` dipanggil lebih dulu supaya attempt yang **sudah lewat
-- waktu** tetapi belum tersentuh RPC lain tetap ditutup dan dinilai otomatis
-- sebelum esainya dinilai. Tanpa ini, menilai esai pada attempt kedaluwarsa
-- akan meninggalkannya `in_progress` selamanya.

create or replace function public.grade_essay(
  p_attempt_id   uuid,
  p_question_id  uuid,
  p_points       numeric,
  p_feedback     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin    uuid := public.assert_admin();
  v_max      numeric(6,2);
  v_attempt  attempts%rowtype;
  v_pending  integer;
  v_manual   numeric(7,2);
begin
  select points into v_max from questions where id = p_question_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_points is null or p_points < 0 or p_points > v_max then
    raise exception 'VALIDATION' using errcode = '22023',
      detail = format('Poin harus antara 0 dan %s.', v_max);
  end if;

  -- Tutup dulu attempt yang sudah lewat waktu, supaya status yang dibaca di
  -- bawah adalah status yang sebenarnya.
  perform public.finalize_if_expired(p_attempt_id);

  select * into v_attempt from attempts where id = p_attempt_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Baris jawaban harus sudah ada (peserta bisa mengosongkan esai; dalam hal
  -- itu belum ada baris, dan admin tetap harus bisa memberi 0).
  insert into attempt_answers (attempt_id, question_id, points_awarded, graded_by, graded_at, feedback)
  values (p_attempt_id, p_question_id, p_points, v_admin, now(), p_feedback)
  on conflict (attempt_id, question_id) do update
    set points_awarded = excluded.points_awarded,
        graded_by      = excluded.graded_by,
        graded_at      = excluded.graded_at,
        feedback       = excluded.feedback;

  -- Hitung ulang total nilai manual.
  select coalesce(sum(aa.points_awarded), 0) into v_manual
  from attempt_answers aa
  join questions q on q.id = aa.question_id
  where aa.attempt_id = p_attempt_id and q.type = 'essay';

  -- Berapa essay yang belum dinilai?
  select count(*) into v_pending
  from questions q
  where q.id = any (v_attempt.question_order)
    and q.type = 'essay'
    and not exists (
      select 1 from attempt_answers aa
      where aa.attempt_id = p_attempt_id
        and aa.question_id = q.id
        and aa.points_awarded is not null
    );

  update attempts
  set score_manual = v_manual,
      -- Attempt yang masih berjalan TIDAK ditutup di sini: nilai esai saja yang
      -- disimpan. Lihat catatan 0023 di atas.
      status       = case
                       when v_attempt.status = 'in_progress' then 'in_progress'::attempt_status
                       when v_pending = 0 then 'graded'::attempt_status
                       else 'needs_grading'::attempt_status
                     end
  where id = p_attempt_id;

  insert into audit_logs (actor_id, action, entity, entity_id, after_data)
  values (v_admin, 'grade_essay', 'attempt_answers', p_attempt_id::text,
          jsonb_build_object('questionId', p_question_id, 'points', p_points));

  return jsonb_build_object('pendingEssay', v_pending, 'scoreManual', v_manual);
end;
$$;

comment on function public.grade_essay(uuid, uuid, numeric, text) is
  'Menilai satu jawaban esai. Tidak menutup attempt yang masih berjalan (0023).';
