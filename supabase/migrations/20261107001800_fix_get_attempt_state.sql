-- =============================================================================
-- 0018 — perbaikan `get_attempt_state`: urutan opsi dan error 42803
-- =============================================================================
-- CATATAN: migrasi ini sudah DILEWATI oleh 0021. Isinya tetap disimpan karena
-- migrasi yang sudah diterapkan tidak boleh diubah. Yang berlaku sekarang
-- adalah 0021 (desain 0011 + `passage`).
--
-- Migrasi 0017 sudah terlanjur diterapkan dengan bug yang sama seperti 0007:
-- `order by i` diletakkan di level query, di luar `array_agg`. Postgres menolak
-- seluruh fungsi dengan
--
--   42803: column "e.i" must appear in the GROUP BY clause or be used in an
--          aggregate function
--
-- Penyebabnya: 0017 menyalin badan fungsi dari **0007**, padahal **0011** sudah
-- memperbaiki bug ini dengan LATERAL join. `create or replace function`
-- mengganti seluruh badan fungsi, jadi versi yang sudah benar tertimpa versi
-- lama.
--
-- Perbaikan di sini memindahkan `order by e.i` ke dalam `array_agg`, sehingga
-- 42803 hilang. Namun konstruksi `array_position` + subquery ordinality tetap
-- yang 0011 sengaja buang: `array_position` mengembalikan NULL bila id tidak
-- ditemukan, dan `order by` dengan NULL menempatkan opsi di urutan tak menentu.
-- 0021 menggantinya dengan LATERAL join dari 0011.

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

  select coalesce(jsonb_agg(q order by ord), '[]'::jsonb) into v_questions
  from (
    select ord,
           jsonb_build_object(
             'id',        q.id,
             'type',      q.type,
             'body',      q.body,
             'passage',   q.passage,
             'mediaPath', q.media_path,
             'points',    q.points,
             'wordMin',   q.word_min,
             'wordMax',   q.word_max,
             'options',   coalesce(
               (select jsonb_agg(jsonb_build_object(
                         'id', o.id, 'body', o.body, 'mediaPath', o.media_path
                       ) order by array_position(
                         coalesce(
                           -- Urutan acak yang tersimpan di attempt. `order by`
                           -- di dalam agregat: lihat catatan di kepala migrasi.
                           (select array_agg((e.value)::uuid order by e.i)
                            from jsonb_array_elements_text(
                              coalesce(v_attempt.option_orders -> q.id::text, '[]'::jsonb)
                            ) with ordinality as e(value, i)),
                           -- Belum ada urutan tersimpan (mis. attempt lama):
                           -- pakai urutan `position` dari tabel.
                           array(select id from question_options
                                 where question_id = q.id order by position)
                         ),
                         o.id
                       ))
                from question_options o
                where o.question_id = q.id),
               '[]'::jsonb
             )
           ) as q
    from unnest(v_attempt.question_order) with ordinality as t(qid, ord)
    join questions q on q.id = t.qid
  ) s;

  select coalesce(jsonb_object_agg(a.question_id, a.selected_option_ids), '{}'::jsonb),
         coalesce(jsonb_object_agg(a.question_id, a.is_flagged) filter (where a.is_flagged), '{}'::jsonb)
  into v_answers, v_flags
  from attempt_answers a
  where a.attempt_id = v_attempt.id;

  return jsonb_build_object(
    'attemptId',      v_attempt.id,
    'examId',         v_exam.id,
    'examCode',       v_exam.code,
    'examTitle',      v_exam.title,
    'instructions',   v_exam.instructions,
    'participantName', v_attempt.participant_name,
    'participantClass', v_attempt.participant_class,
    'attemptNo',      v_attempt.attempt_no,
    'status',         v_attempt.status,
    'startedAt',      v_attempt.started_at,
    'expiresAt',      v_attempt.expires_at,
    'serverNow',      now(),
    'questions',      v_questions,
    'answers',        v_answers,
    'flagged',        v_flags
  );
end;
$$;
