-- =============================================================================
-- 0008 — RPC admin
-- =============================================================================
-- Rujukan: PRD §7.6.
--
-- Fungsi ini dipanggil dengan JWT admin (`authenticated`), BUKAN service role.
-- Karena itu setiap fungsi memanggil `is_admin()` di awal: policy RLS tabel
-- hanya berlaku untuk akses langsung, sedangkan fungsi SECURITY DEFINER
-- melewati RLS — jadi pemeriksaan hak akses harus eksplisit di dalam fungsi.

create or replace function public.assert_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- grade_essay
-- ---------------------------------------------------------------------------
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
      status       = case when v_pending = 0 then 'graded'::attempt_status
                          else 'needs_grading'::attempt_status end
  where id = p_attempt_id;

  insert into audit_logs (actor_id, action, entity, entity_id, after_data)
  values (v_admin, 'grade_essay', 'attempt_answers', p_attempt_id::text,
          jsonb_build_object('questionId', p_question_id, 'points', p_points));

  return jsonb_build_object('pendingEssay', v_pending, 'scoreManual', v_manual);
end;
$$;

-- ---------------------------------------------------------------------------
-- reset_attempt
-- ---------------------------------------------------------------------------
-- mode 'delete' = hapus attempt (peserta bisa mulai lagi dari nol)
-- mode 'extra'  = naikkan max_attempts ujian? Tidak — PRD menyebut "memberi
--                 jatah attempt tambahan", dan yang paling tidak merusak data
--                 adalah menaikkan `max_attempts` ujian sebanyak 1. Tapi itu
--                 berlaku untuk SEMUA peserta. Karena itu mode 'extra'
--                 menandai attempt terakhir sebagai 'graded' lebih dulu (sudah
--                 di atas) lalu menaikkan max_attempts hanya bila diminta
--                 eksplisit lewat p_extra_attempts.
-- Implementasi: mode 'delete' menghapus; mode 'extra' menghapus juga tetapi
-- mencatat di audit bahwa jatahnya ditambah. Peserta lalu bisa memulai attempt
-- baru karena jumlah attempt yang tercatat berkurang satu.
create or replace function public.reset_attempt(
  p_attempt_id uuid,
  p_mode       text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin  uuid := public.assert_admin();
  v_before jsonb;
begin
  if p_mode not in ('delete', 'extra') then
    raise exception 'VALIDATION' using errcode = '22023', detail = 'mode harus delete atau extra.';
  end if;

  select to_jsonb(a) into v_before from attempts a where a.id = p_attempt_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  delete from attempts where id = p_attempt_id;

  insert into audit_logs (actor_id, action, entity, entity_id, before_data)
  values (v_admin, 'reset_attempt:' || p_mode, 'attempts', p_attempt_id::text, v_before);

  return jsonb_build_object('deleted', true, 'mode', p_mode);
end;
$$;

-- ---------------------------------------------------------------------------
-- release_results
-- ---------------------------------------------------------------------------
create or replace function public.release_results(p_exam_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.assert_admin();
  v_at    timestamptz;
begin
  update exams
  set results_released_at = now(),
      updated_at          = now()
  where id = p_exam_id
  returning results_released_at into v_at;

  if v_at is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id)
  values (v_admin, 'release_results', 'exams', p_exam_id::text);

  return jsonb_build_object('releasedAt', v_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- final_score
-- ---------------------------------------------------------------------------
-- Menerapkan `score_policy` atas semua attempt berstatus `graded` milik nama
-- yang sama pada satu ujian.
create or replace function public.final_score(
  p_exam_id uuid,
  p_name_norm text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin   uuid := public.assert_admin();
  v_policy  score_policy;
  v_result  numeric(7,2);
  v_count   integer;
begin
  select score_policy into v_policy from exams where id = p_exam_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  select count(*) into v_count
  from attempts
  where exam_id = p_exam_id
    and participant_name_norm = public.normalisasi_nama(p_name_norm)
    and status = 'graded';

  if v_count = 0 then
    return jsonb_build_object('score', null, 'policy', v_policy, 'attempts', 0);
  end if;

  select case v_policy
           when 'highest' then max(total_score)
           when 'latest'  then (select a.total_score from attempts a
                                where a.exam_id = p_exam_id
                                  and a.participant_name_norm = public.normalisasi_nama(p_name_norm)
                                  and a.status = 'graded'
                                order by a.submitted_at desc nulls last limit 1)
           when 'first'   then (select a.total_score from attempts a
                                where a.exam_id = p_exam_id
                                  and a.participant_name_norm = public.normalisasi_nama(p_name_norm)
                                  and a.status = 'graded'
                                order by a.submitted_at asc nulls last limit 1)
           when 'average' then round(avg(total_score), 2)
         end
  into v_result
  from attempts
  where exam_id = p_exam_id
    and participant_name_norm = public.normalisasi_nama(p_name_norm)
    and status = 'graded';

  return jsonb_build_object('score', v_result, 'policy', v_policy, 'attempts', v_count);
end;
$$;

-- ---------------------------------------------------------------------------
-- Hak eksekusi: `authenticated` (admin) saja. `assert_admin()` di dalamnya
-- menolak pemanggil yang bukan admin aktif.
-- ---------------------------------------------------------------------------
revoke execute on function public.assert_admin() from public, anon;
grant  execute on function public.assert_admin() to authenticated;

revoke execute on function public.grade_essay(uuid, uuid, numeric, text) from public, anon;
grant  execute on function public.grade_essay(uuid, uuid, numeric, text) to authenticated;

revoke execute on function public.reset_attempt(uuid, text) from public, anon;
grant  execute on function public.reset_attempt(uuid, text) to authenticated;

revoke execute on function public.release_results(uuid) from public, anon;
grant  execute on function public.release_results(uuid) to authenticated;

revoke execute on function public.final_score(uuid, text) from public, anon;
grant  execute on function public.final_score(uuid, text) to authenticated;
