-- =============================================================================
-- 0015 — RPC duplikat dan arsip ujian (T3.7)
-- =============================================================================
-- Rujukan: PRD §7.6; EXM-10 (duplikat), EXM-13 (arsip).
--
-- `duplicate_exam` harus berupa satu fungsi, bukan rangkaian panggilan dari
-- aplikasi. Menyalin ujian berarti menulis ke tiga tabel (exams, questions,
-- question_options) dan memetakan ID lama ke ID baru untuk setiap opsi yang
-- benar. Kalau salah satu langkah gagal di tengah, yang tersisa adalah ujian
-- duplikat dengan soal setengah jadi — dan tidak ada tombol "batalkan".
-- Di dalam satu fungsi, semuanya berjalan dalam satu transaksi.
--
-- Pemetaan ID juga hanya mungkin di sini: `is_correct` pada question_options
-- harus menunjuk opsi **baru** milik soal baru, bukan opsi lama. Aplikasi tidak
-- bisa mengetahui ID baru sebelum barisnya dibuat.

create or replace function public.duplicate_exam(p_exam_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin      uuid := public.assert_admin();
  v_source     exams%rowtype;
  v_new_id     uuid;
  v_new_code   text;
  v_attempt    integer := 0;
  v_q          record;
  v_new_q_id   uuid;
  v_opt        record;
  v_new_opt_id uuid;
  v_question_count integer := 0;
  v_option_count   integer := 0;
begin
  select * into v_source from exams where id = p_exam_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Kode baru: 6 karakter dari alfabet tanpa 0/O/1/I, sama seperti yang dibuat
  -- aplikasi. Dibuat di sini (bukan dikirim pemanggil) supaya duplikat tidak
  -- pernah bisa menghasilkan kode yang bentrok karena balapan.
  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 20 then
      raise exception 'INTERNAL' using errcode = 'P0001',
        detail = 'Gagal membuat kode unik untuk duplikat.';
    end if;

    select string_agg(
             substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                    floor(random() * 32)::int + 1, 1),
             ''
           )
    into v_new_code
    from generate_series(1, 6);

    exit when not exists (select 1 from exams where code = v_new_code);
  end loop;

  /*
   * Salin kolom satu per satu — bukan `insert ... select *`.
   *
   * `select *` akan ikut menyalin `id`, `created_at`, dan `results_released_at`.
   * `results_released_at` yang ikut tersalin berarti duplikat langsung
   * menganggap hasilnya sudah dirilis padahal belum ada attempt sama sekali.
   *
   * Status selalu `draft` (EXM-10): duplikat adalah bahan mentah untuk disunting,
   * bukan ujian yang siap dibagikan.
   */
  insert into exams (
    code, created_by, title, subject_label, description, instructions,
    status, opens_at, closes_at, duration_minutes, max_attempts, score_policy,
    passing_score, shuffle_questions, shuffle_options, ask_class,
    result_visibility, result_release
  )
  values (
    v_new_code, v_admin, v_source.title || ' (salinan)', v_source.subject_label,
    v_source.description, v_source.instructions,
    'draft', v_source.opens_at, v_source.closes_at, v_source.duration_minutes,
    v_source.max_attempts, v_source.score_policy, v_source.passing_score,
    v_source.shuffle_questions, v_source.shuffle_options, v_source.ask_class,
    v_source.result_visibility, v_source.result_release
  )
  returning id into v_new_id;

  -- Salin soal beserta opsinya, sambil memetakan ID lama -> ID baru.
  for v_q in
    select * from questions where exam_id = p_exam_id order by position
  loop
    insert into questions (
      exam_id, position, type, body, media_path, points,
      word_min, word_max, reference_answer, explanation
    )
    values (
      v_new_id, v_q.position, v_q.type, v_q.body, v_q.media_path, v_q.points,
      v_q.word_min, v_q.word_max, v_q.reference_answer, v_q.explanation
    )
    returning id into v_new_q_id;

    v_question_count := v_question_count + 1;

    for v_opt in
      select * from question_options where question_id = v_q.id order by position
    loop
      insert into question_options (question_id, position, body, media_path, is_correct)
      values (v_new_q_id, v_opt.position, v_opt.body, v_opt.media_path, v_opt.is_correct)
      returning id into v_new_opt_id;

      v_option_count := v_option_count + 1;
    end loop;
  end loop;

  insert into audit_logs (actor_id, action, entity, entity_id, before_data, after_data)
  values (
    v_admin, 'duplicate_exam', 'exams', v_new_id::text,
    jsonb_build_object('sourceId', p_exam_id, 'sourceCode', v_source.code),
    jsonb_build_object('code', v_new_code, 'questions', v_question_count, 'options', v_option_count)
  );

  return jsonb_build_object(
    'examId', v_new_id,
    'code', v_new_code,
    'questions', v_question_count,
    'options', v_option_count
  );
end;
$$;

comment on function public.duplicate_exam(uuid) is
  'Menyalin ujian beserta soal dan opsinya sebagai draft dengan kode baru (EXM-10).';

revoke execute on function public.duplicate_exam(uuid) from public, anon;
grant  execute on function public.duplicate_exam(uuid) to authenticated;
