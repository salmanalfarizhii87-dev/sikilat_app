-- =============================================================================
-- 0011 — Perbaikan get_attempt_state: urutan opsi
-- =============================================================================
-- Ditemukan oleh `db lint` (SQLSTATE 42803).
--
-- Versi sebelumnya menyusun ulang opsi lewat subquery ordinality di dalam
-- `jsonb_agg ... order by array_position(...)`. Selain ditolak lint karena
-- kolom ordinal tidak masuk GROUP BY, konstruksinya juga rapuh: bergantung
-- pada `array_position` yang mengembalikan NULL bila id tidak ditemukan,
-- sehingga opsi bisa muncul dengan urutan acak tanpa error.
--
-- Versi ini memakai LATERAL join: urutan opsi dihitung SEKALI per soal menjadi
-- tabel kecil (option_id, urutan), lalu `jsonb_agg ... order by urutan`.
-- Lebih mudah dibaca dan tidak bergantung pada perilaku NULL.

create or replace function public.get_attempt_state(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt   attempts%rowtype;
  v_exam      exams%rowtype;
  v_questions jsonb;
  v_answers   jsonb;
  v_flags     jsonb;
begin
  select * into v_attempt from attempts where token_hash = p_token_hash;
  if not found then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  perform public.finalize_if_expired(v_attempt.id);
  select * into v_attempt from attempts where id = v_attempt.id;

  select * into v_exam from exams where id = v_attempt.exam_id;

  -- Urutan soal: ambil dari `question_order` yang tersimpan, bukan dari
  -- `position` tabel questions — kalau admin menambah/mengubah soal di tengah
  -- ujian, peserta yang sedang mengerjakan tetap melihat urutan lamanya.
  --
  -- Kolom yang dikembalikan dipilih satu per satu; tidak ada `is_correct` atau
  -- `reference_answer` yang bisa ikut terbawa.
  select coalesce(jsonb_agg(q_obj order by ord), '[]'::jsonb)
  into v_questions
  from (
    select
      t.ord,
      jsonb_build_object(
        'id',        q.id,
        'type',      q.type,
        'body',      q.body,
        'mediaPath', q.media_path,
        'points',    q.points,
        'wordMin',   q.word_min,
        'wordMax',   q.word_max,
        'options',   coalesce(opts.list, '[]'::jsonb)
      ) as q_obj
    from unnest(v_attempt.question_order) with ordinality as t(qid, ord)
    join questions q on q.id = t.qid
    left join lateral (
      select jsonb_agg(
               jsonb_build_object(
                 'id',        o.id,
                 'body',      o.body,
                 'mediaPath', o.media_path
               ) order by coalesce(ord_map.urutan, o.position)
             ) as list
      from question_options o
      left join (
        -- Peta urutan yang tersimpan saat attempt dimulai.
        select (e.value)::uuid as option_id, e.i as urutan
        from jsonb_array_elements_text(
               coalesce(v_attempt.option_orders -> q.id::text, '[]'::jsonb)
             ) with ordinality as e(value, i)
      ) ord_map on ord_map.option_id = o.id
      where o.question_id = q.id
    ) opts on true
  ) s;

  select
    coalesce(jsonb_object_agg(a.question_id, a.selected_option_ids), '{}'::jsonb),
    coalesce(jsonb_object_agg(a.question_id, a.is_flagged)
             filter (where a.is_flagged), '{}'::jsonb)
  into v_answers, v_flags
  from attempt_answers a
  where a.attempt_id = v_attempt.id;

  return jsonb_build_object(
    'attemptId',        v_attempt.id,
    'examId',           v_exam.id,
    'examCode',         v_exam.code,
    'examTitle',        v_exam.title,
    'instructions',     v_exam.instructions,
    'participantName',  v_attempt.participant_name,
    'participantClass', v_attempt.participant_class,
    'attemptNo',        v_attempt.attempt_no,
    'status',           v_attempt.status,
    'startedAt',        v_attempt.started_at,
    'expiresAt',        v_attempt.expires_at,
    'serverNow',        now(),
    'questions',        v_questions,
    'answers',          v_answers,
    'flagged',          v_flags
  );
end;
$$;

revoke execute on function public.get_attempt_state(text) from public, anon, authenticated;
grant  execute on function public.get_attempt_state(text) to service_role;
