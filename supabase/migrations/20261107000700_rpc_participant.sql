-- =============================================================================
-- 0007 — RPC peserta
-- =============================================================================
-- Rujukan: PRD §7.6.
--
-- Semua fungsi di sini HANYA boleh dieksekusi `service_role`, karena peserta
-- tidak punya identitas di database. Server (Server Action) yang memverifikasi
-- cookie sesi peserta, lalu memanggil fungsi ini dengan service role.
--
-- Setiap fungsi yang menerima `token_hash` MEMVERIFIKASI token itu lebih dulu.
-- Token mentah tidak pernah disimpan — hanya SHA-256-nya — sehingga isi tabel
-- yang bocor tidak bisa dipakai untuk membajak sesi yang sedang berjalan.

-- ---------------------------------------------------------------------------
-- start_attempt
-- ---------------------------------------------------------------------------
-- Semua nilai rahasia (token_hash, resume_code, result_token) dibuat di server
-- dan diteruskan ke sini; database tidak pernah menerima token mentah.
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
  v_attempt_id    uuid;
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
  -- bukan memulai baru. Tanpa ini, peserta bisa menutup tab dan memulai attempt
  -- kedua untuk melihat nilai lebih tinggi.
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

  -- ---- Urutan soal dan opsi ----------------------------------------------
  -- Disimpan permanen di attempt supaya peserta yang me-refresh halaman
  -- mendapat urutan yang sama, dan supaya penilaian memakai himpunan soal yang
  -- benar-benar ditampilkan.
  select coalesce(array_agg(id order by pos), '{}'::uuid[]) into v_question_ids
  from (
    select id,
           case when v_exam.shuffle_questions
                then random()
                else position::double precision
           end as pos
    from questions
    where exam_id = v_exam.id
  ) s;

  select coalesce(jsonb_object_agg(question_id, opts), '{}'::jsonb)
  into v_option_orders
  from (
    select o.question_id,
           jsonb_agg(o.id order by
             case when v_exam.shuffle_options then random() else o.position::double precision end
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
  )
  returning id into v_attempt_id;

  return public.get_attempt_state(p_token_hash);
end;
$$;

-- ---------------------------------------------------------------------------
-- resume_attempt
-- ---------------------------------------------------------------------------
-- Memulihkan sesi dengan Kode Lanjut. Token lama DICABUT (diganti hash baru),
-- sehingga kalau kode ini bocor dan dipakai orang lain, sesi yang sah ikut
-- terputus dan admin bisa melihatnya sebagai anomali.
create or replace function public.resume_attempt(
  p_code            text,
  p_name            text,
  p_resume_code     text,
  p_new_token_hash  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm    text;
  v_exam_id uuid;
  v_attempt attempts%rowtype;
begin
  v_norm := public.normalisasi_nama(p_name);

  select id into v_exam_id from exams where code = upper(p_code);
  if not found then
    raise exception 'EXAM_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_attempt
  from attempts
  where exam_id = v_exam_id
    and participant_name_norm = v_norm
    and status = 'in_progress'
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'Tidak ada attempt aktif.';
  end if;

  if v_attempt.resume_code <> upper(btrim(p_resume_code)) then
    raise exception 'INVALID_RESUME_CODE' using errcode = '22023';
  end if;

  -- Sudah lewat waktu: tutup, jangan dilanjutkan.
  if now() > v_attempt.expires_at then
    perform public.finalize_if_expired(v_attempt.id);
    raise exception 'ATTEMPT_EXPIRED' using errcode = '22023';
  end if;

  update attempts
  set token_hash = p_new_token_hash
  where id = v_attempt.id;

  return public.get_attempt_state(p_new_token_hash);
end;
$$;

-- ---------------------------------------------------------------------------
-- get_attempt_state
-- ---------------------------------------------------------------------------
-- Mengembalikan soal TANPA kunci jawaban. Kolom yang dikembalikan dipilih satu
-- per satu secara eksplisit — tidak ada `select *` yang bisa tidak sengaja
-- membawa `is_correct` atau `reference_answer`.
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
             'mediaPath', q.media_path,
             'points',    q.points,
             'wordMin',   q.word_min,
             'wordMax',   q.word_max,
             'options',   coalesce(
               (select jsonb_agg(jsonb_build_object(
                         'id', o.id, 'body', o.body, 'mediaPath', o.media_path
                       ) order by array_position(
                         coalesce(
                           (select array_agg((e.value)::uuid order by e.i)
                            from jsonb_array_elements_text(
                              coalesce(v_attempt.option_orders -> q.id::text, '[]'::jsonb)
                            ) with ordinality as e(value, i)),
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

-- ---------------------------------------------------------------------------
-- save_answer
-- ---------------------------------------------------------------------------
-- Upsert satu jawaban. Menolak tulisan setelah waktu habis, dan menolak soal
-- yang bukan milik attempt ini (mencegah menyisipkan jawaban untuk soal ujian
-- lain).
create or replace function public.save_answer(
  p_token_hash   text,
  p_question_id  uuid,
  p_selected     uuid[] default null,
  p_essay        text default null,
  p_flagged      boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt  attempts%rowtype;
  v_question questions%rowtype;
  v_essay    text;
begin
  select * into v_attempt from attempts where token_hash = p_token_hash;
  if not found then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  perform public.finalize_if_expired(v_attempt.id);
  select * into v_attempt from attempts where id = v_attempt.id;

  if v_attempt.status <> 'in_progress' then
    raise exception 'ATTEMPT_EXPIRED' using errcode = '22023';
  end if;

  -- Soal harus benar-benar bagian dari attempt ini.
  if not (p_question_id = any (v_attempt.question_order)) then
    raise exception 'VALIDATION' using errcode = '22023', detail = 'Soal bukan bagian attempt ini.';
  end if;

  select * into v_question from questions where id = p_question_id;

  -- Potong jawaban esai sesuai batas, bukan menolak: peserta yang kelebihan
  -- beberapa karakter lebih baik jawabannya dipotong daripada hilang.
  v_essay := nullif(btrim(coalesce(p_essay, '')), '');
  if v_essay is not null and v_question.word_max is not null then
    v_essay := left(v_essay, v_question.word_max * 8);
  end if;

  insert into attempt_answers (
    attempt_id, question_id, selected_option_ids, essay_text, is_flagged, answered_at
  ) values (
    v_attempt.id, p_question_id, p_selected, v_essay, coalesce(p_flagged, false), now()
  )
  on conflict (attempt_id, question_id) do update
    set selected_option_ids = excluded.selected_option_ids,
        essay_text          = excluded.essay_text,
        is_flagged          = excluded.is_flagged,
        answered_at         = now();

  return jsonb_build_object('savedAt', now());
end;
$$;

-- ---------------------------------------------------------------------------
-- log_attempt_event
-- ---------------------------------------------------------------------------
-- Mencatat kejadian (pindah tab, keluar fullscreen, paste). Tidak pernah
-- menggagalkan pengerjaan: kalau gagal dicatat, lebih baik diabaikan daripada
-- peserta kehilangan jawaban.
create or replace function public.log_attempt_event(
  p_token_hash text,
  p_type       text,
  p_meta       jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_id uuid;
begin
  select id into v_attempt_id from attempts where token_hash = p_token_hash;
  if not found then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  insert into attempt_events (attempt_id, event_type, meta)
  values (v_attempt_id, left(p_type, 64), p_meta);
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_attempt
-- ---------------------------------------------------------------------------
-- Idempoten: memanggil dua kali tidak mengubah nilai. Ini penting karena
-- peserta bisa menekan tombol dua kali atau koneksi terputus saat respons.
create or replace function public.submit_attempt(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt attempts%rowtype;
begin
  select * into v_attempt from attempts where token_hash = p_token_hash;
  if not found then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if v_attempt.status = 'in_progress' then
    if now() > v_attempt.expires_at then
      perform public.finalize_if_expired(v_attempt.id);
    else
      perform public.hitung_dan_publikasikan(v_attempt.id, 'manual', false);
    end if;
  end if;

  select * into v_attempt from attempts where id = v_attempt.id;

  return jsonb_build_object(
    'attemptId', v_attempt.id,
    'status',    v_attempt.status,
    'submittedAt', v_attempt.submitted_at,
    'resultToken', v_attempt.result_token,
    'scoreAuto', v_attempt.score_auto,
    'maxScore',  v_attempt.max_score
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- get_result
-- ---------------------------------------------------------------------------
-- Menghormati `result_visibility` dan `result_release`. Kunci jawaban hanya
-- dikirim bila `score_and_review` DAN hasil sudah dirilis. Pembahasan
-- (`explanation`) ikut aturan yang sama.
create or replace function public.get_result(p_result_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt  attempts%rowtype;
  v_exam     exams%rowtype;
  v_released boolean;
  v_review   boolean;
  v_details  jsonb := null;
  v_pct      numeric(5,2) := null;
begin
  select * into v_attempt from attempts where result_token = p_result_token;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_exam from exams where id = v_attempt.exam_id;

  v_released := case v_exam.result_release
                  when 'instant'     then true
                  when 'after_close' then v_exam.closes_at is not null and now() >= v_exam.closes_at
                  else v_exam.results_released_at is not null
                end;

  -- Belum dinilai: jangan tampilkan apa pun dulu.
  if v_attempt.status <> 'graded' or not v_released then
    return jsonb_build_object(
      'examTitle',     v_exam.title,
      'participantName', v_attempt.participant_name,
      'status',        v_attempt.status,
      'released',      false,
      'visibility',    v_exam.result_visibility
    );
  end if;

  if v_attempt.max_score > 0 then
    v_pct := round(v_attempt.total_score / v_attempt.max_score * 100, 2);
  end if;

  v_review := v_released and v_exam.result_visibility = 'score_and_review';

  if v_review then
    select jsonb_agg(
             jsonb_build_object(
               'questionId', a.question_id,
               'body',       q.body,
               'type',       q.type,
               'points',     q.points,
               'pointsAwarded', a.points_awarded,
               'isCorrect',  a.is_correct,
               'essayText',  a.essay_text,
               'feedback',   a.feedback,
               'explanation', q.explanation
             ) order by array_position(v_attempt.question_order, q.id)
           )
    into v_details
    from attempt_answers a
    join questions q on q.id = a.question_id
    where a.attempt_id = v_attempt.id;
  end if;

  if v_exam.result_visibility = 'hidden' then
    return jsonb_build_object(
      'examTitle',     v_exam.title,
      'participantName', v_attempt.participant_name,
      'status',        v_attempt.status,
      'released',      true,
      'visibility',    v_exam.result_visibility
    );
  end if;

  return jsonb_build_object(
    'examTitle',     v_exam.title,
    'participantName', v_attempt.participant_name,
    'status',        v_attempt.status,
    'released',      true,
    'visibility',    v_exam.result_visibility,
    'releasedAt',    coalesce(v_exam.results_released_at, v_attempt.submitted_at),
    'score',         v_attempt.total_score,
    'maxScore',      v_attempt.max_score,
    'percentage',    v_pct,
    'passingScore',  v_exam.passing_score,
    'passed',        case when v_exam.passing_score is null or v_pct is null
                          then null else v_pct >= v_exam.passing_score end,
    'details',       v_details
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Hak eksekusi: HANYA service_role.
--
-- `revoke ... from public` wajib dan mudah terlupa: Postgres memberi EXECUTE
-- ke PUBLIC secara default untuk setiap fungsi baru. Tanpa baris revoke ini,
-- `anon` bisa memanggil start_attempt lewat Data API tanpa token apa pun.
-- ---------------------------------------------------------------------------
revoke execute on function public.start_attempt(text, text, text, text, text, text, inet, text) from public, anon, authenticated;
revoke execute on function public.resume_attempt(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.get_attempt_state(text) from public, anon, authenticated;
revoke execute on function public.save_answer(text, uuid, uuid[], text, boolean) from public, anon, authenticated;
revoke execute on function public.log_attempt_event(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.submit_attempt(text) from public, anon, authenticated;
revoke execute on function public.get_result(text) from public, anon, authenticated;

grant execute on function public.start_attempt(text, text, text, text, text, text, inet, text) to service_role;
grant execute on function public.resume_attempt(text, text, text, text) to service_role;
grant execute on function public.get_attempt_state(text) to service_role;
grant execute on function public.save_answer(text, uuid, uuid[], text, boolean) to service_role;
grant execute on function public.log_attempt_event(text, text, jsonb) to service_role;
grant execute on function public.submit_attempt(text) to service_role;
grant execute on function public.get_result(text) to service_role;
