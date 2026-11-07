-- =============================================================================
-- 0012 — Rapikan variabel tak terpakai
-- =============================================================================
-- Dua peringatan `db lint`:
--
-- 1. `final_score`: `v_admin` diisi hasil `assert_admin()` tapi tidak pernah
--    dibaca. Panggilannya tetap diperlukan (efek sampingnya = penolakan bila
--    bukan admin), jadi yang dihapus hanya penampungnya.
--
-- 2. `start_attempt`: `v_attempt_id` diisi dari `insert ... returning` tapi
--    tidak dipakai karena fungsi mengembalikan `get_attempt_state(token)`.
--    Penampungnya dihapus.
--
-- Keduanya perubahan perilaku-nol; tujuannya supaya `db lint` bersih sehingga
-- peringatan baru di masa depan langsung terlihat.

create or replace function public.start_attempt(
  p_code          text,
  p_name          text,
  p_class         text,
  p_token_hash    text,
  p_resume_code   text,
  p_result_token  text,
  p_ip            inet default null,
  p_user_agent    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam          exams%rowtype;
  v_norm          text;
  v_attempt_count integer;
  v_attempt_no    smallint;
  v_question_ids  uuid[];
  v_option_orders jsonb;
  v_max_score     numeric(7,2);
  v_expires_at    timestamptz;
begin
  v_norm := public.normalisasi_nama(p_name);

  if v_norm = '' or char_length(v_norm) < 2 then
    raise exception 'VALIDATION' using errcode = '22023', detail = 'Nama terlalu pendek.';
  end if;

  -- Kunci baris ujian supaya dua permintaan bersamaan tidak menghitung
  -- attempt_no yang sama.
  select * into v_exam from exams where code = upper(p_code) for update;

  if not found then
    raise exception 'EXAM_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_exam.status <> 'published' then
    raise exception 'EXAM_CLOSED' using errcode = '22023', detail = 'Ujian belum dibuka.';
  end if;

  if v_exam.opens_at is not null and now() < v_exam.opens_at then
    raise exception 'EXAM_NOT_OPEN' using errcode = '22023';
  end if;

  if v_exam.closes_at is not null and now() >= v_exam.closes_at then
    raise exception 'EXAM_CLOSED' using errcode = '22023';
  end if;

  -- Sudah ada attempt berjalan dengan nama sama → peserta harus melanjutkan,
  -- bukan memulai baru.
  if exists (
    select 1 from attempts
    where exam_id = v_exam.id
      and participant_name_norm = v_norm
      and status = 'in_progress'
  ) then
    raise exception 'NAME_IN_USE' using errcode = '23505';
  end if;

  select count(*) into v_attempt_count
  from attempts
  where exam_id = v_exam.id and participant_name_norm = v_norm;

  if v_attempt_count >= v_exam.max_attempts then
    raise exception 'NO_ATTEMPTS_LEFT' using errcode = '22023';
  end if;

  v_attempt_no := (v_attempt_count + 1)::smallint;

  -- Urutan soal final. Disimpan permanen supaya refresh menampilkan urutan
  -- yang sama dan penilaian memakai himpunan soal yang benar-benar tampil.
  select coalesce(array_agg(id order by pos), '{}'::uuid[]) into v_question_ids
  from (
    select id,
           case when v_exam.shuffle_questions then random()
                else position::double precision end as pos
    from questions
    where exam_id = v_exam.id
  ) s;

  select coalesce(jsonb_object_agg(question_id, opts), '{}'::jsonb)
  into v_option_orders
  from (
    select o.question_id,
           jsonb_agg(o.id order by
             case when v_exam.shuffle_options then random()
                  else o.position::double precision end
           ) as opts
    from question_options o
    where o.question_id = any (v_question_ids)
    group by o.question_id
  ) s;

  select coalesce(sum(points), 0) into v_max_score
  from questions where exam_id = v_exam.id;

  -- Batas akhir: durasi TIDAK boleh melewati closes_at.
  v_expires_at := now() + make_interval(mins => v_exam.duration_minutes);
  if v_exam.closes_at is not null then
    v_expires_at := least(v_expires_at, v_exam.closes_at);
  end if;

  insert into attempts (
    exam_id, participant_name, participant_name_norm, participant_class,
    attempt_no, status, started_at, expires_at,
    question_order, option_orders, max_score,
    token_hash, resume_code, result_token, ip_address, user_agent
  ) values (
    v_exam.id, btrim(p_name), v_norm, nullif(btrim(coalesce(p_class, '')), ''),
    v_attempt_no, 'in_progress', now(), v_expires_at,
    v_question_ids, v_option_orders, v_max_score,
    p_token_hash, p_resume_code, p_result_token, p_ip, p_user_agent
  );

  return public.get_attempt_state(p_token_hash);
end;
$$;

revoke execute on function public.start_attempt(text, text, text, text, text, text, inet, text)
  from public, anon, authenticated;
grant execute on function public.start_attempt(text, text, text, text, text, text, inet, text)
  to service_role;


create or replace function public.final_score(
  p_exam_id   uuid,
  p_name_norm text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy score_policy;
  v_result numeric(7,2);
  v_count  integer;
  v_norm   text;
begin
  -- Efek samping pemanggilan ini adalah penolakan bila bukan admin;
  -- hasilnya tidak perlu ditampung.
  perform public.assert_admin();

  v_norm := public.normalisasi_nama(p_name_norm);

  select score_policy into v_policy from exams where id = p_exam_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  select count(*) into v_count
  from attempts
  where exam_id = p_exam_id
    and participant_name_norm = v_norm
    and status = 'graded';

  if v_count = 0 then
    return jsonb_build_object('score', null, 'policy', v_policy, 'attempts', 0);
  end if;

  select case v_policy
           when 'highest' then max(total_score)
           when 'latest'  then (select a.total_score from attempts a
                                where a.exam_id = p_exam_id
                                  and a.participant_name_norm = v_norm
                                  and a.status = 'graded'
                                order by a.submitted_at desc nulls last limit 1)
           when 'first'   then (select a.total_score from attempts a
                                where a.exam_id = p_exam_id
                                  and a.participant_name_norm = v_norm
                                  and a.status = 'graded'
                                order by a.submitted_at asc nulls last limit 1)
           when 'average' then round(avg(total_score), 2)
         end
  into v_result
  from attempts
  where exam_id = p_exam_id
    and participant_name_norm = v_norm
    and status = 'graded';

  return jsonb_build_object('score', v_result, 'policy', v_policy, 'attempts', v_count);
end;
$$;

revoke execute on function public.final_score(uuid, text) from public, anon;
grant  execute on function public.final_score(uuid, text) to authenticated;
