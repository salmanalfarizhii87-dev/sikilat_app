-- =============================================================================
-- 0024 — get_attempt_state: kirim result_token
-- =============================================================================
-- Tanpa ini, peserta yang menekan "kembali" atau memuat ulang halaman setelah
-- mengumpulkan tidak bisa diarahkan ke halaman hasilnya: `submit_attempt`
-- mengembalikan `resultToken` sekali, lalu nilainya hilang bersama respons itu.
-- Runner hanya tahu statusnya sudah `graded`, tanpa alamat untuk membuka
-- nilainya — peserta terpaksa menebak atau bertanya ke guru.
--
-- Kenapa aman mengirim `result_token` ke pemegang token attempt: token hasil
-- memang dirancang untuk diberikan kepada peserta (ia yang membagikan tautannya
-- ke guru bila perlu). Yang menentukan apa yang **terlihat** adalah `get_result`
-- lewat `result_visibility` dan `result_release`, bukan kerahasiaan tokennya.
-- Pemanggil fungsi ini sudah memegang `token_hash` attempt tersebut, jadi ia
-- memang pemilik attempt itu.
--
-- Badan fungsi sama dengan 0022 kecuali satu baris tambahan di `jsonb_build_object`.

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
begin
  select * into v_attempt from attempts where token_hash = p_token_hash;
  if not found then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  perform public.finalize_if_expired(v_attempt.id);
  select * into v_attempt from attempts where id = v_attempt.id;

  select * into v_exam from exams where id = v_attempt.exam_id;

  -- Lihat 0022 untuk alasan bentuk kolom dan pemilihan LATERAL join ini.
  select coalesce(jsonb_agg(q_obj order by ord), '[]'::jsonb)
  into v_questions
  from (
    select
      t.ord,
      jsonb_build_object(
        'id',        q.id,
        'type',      q.type,
        'body',      q.body,
        'passage',   q.passage,
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
        select (e.value)::uuid as option_id, e.i as urutan
        from jsonb_array_elements_text(
               coalesce(v_attempt.option_orders -> q.id::text, '[]'::jsonb)
             ) with ordinality as e(value, i)
      ) ord_map on ord_map.option_id = o.id
      where o.question_id = q.id
    ) opts on true
  ) s;

  select coalesce(
           jsonb_object_agg(
             a.question_id,
             jsonb_build_object(
               'selectedOptionIds', coalesce(a.selected_option_ids, '{}'::uuid[]),
               'essayText',         coalesce(a.essay_text, ''),
               'flagged',           a.is_flagged
             )
           ),
           '{}'::jsonb
         )
  into v_answers
  from attempt_answers a
  where a.attempt_id = v_attempt.id;

  return jsonb_build_object(
    'attemptId',        v_attempt.id,
    'examId',           v_exam.id,
    'examCode',         v_exam.code,
    'examTitle',        v_exam.title,
    'examSubject',      v_exam.subject_label,
    'instructions',     v_exam.instructions,
    'participantName',  v_attempt.participant_name,
    'participantClass', v_attempt.participant_class,
    'attemptNo',        v_attempt.attempt_no,
    'resumeCode',       v_attempt.resume_code,
    'resultToken',      v_attempt.result_token,
    'status',           v_attempt.status,
    'startedAt',        v_attempt.started_at,
    'expiresAt',        v_attempt.expires_at,
    'serverNow',        now(),
    'questions',        v_questions,
    'answers',          v_answers
  );
end;
$$;

-- `create or replace` tidak mengubah ACL; baris ini defensif (lihat 0022).
revoke execute on function public.get_attempt_state(text) from public, anon, authenticated;
grant  execute on function public.get_attempt_state(text) to service_role;
