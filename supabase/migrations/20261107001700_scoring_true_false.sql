-- =============================================================================
-- 0017 — penilaian dan pengiriman soal untuk `true_false` + `passage`
-- =============================================================================
-- Lanjutan migrasi 0016. Dipisah karena `alter type ... add value` tidak boleh
-- berada dalam transaksi yang sama dengan pemakaian nilai barunya.
--
-- Yang diubah hanya dua fungsi:
--   1. `hitung_dan_publikasikan` — masukkan `true_false` ke aturan "semua benar".
--   2. `get_attempt_state`       — kirim `passage` ke peserta.

-- ---------------------------------------------------------------------------
-- 1. Penilaian: `true_false` ikut aturan yang sama dengan PG
-- ---------------------------------------------------------------------------
-- Isi fungsi ini sama persis dengan versi 0013 kecuali daftar tipe soal.
-- Sengaja tidak ditambah cabang: soal benar/salah adalah "pilih semua opsi yang
-- bernilai Benar", yang persis sama dengan pilihan ganda banyak jawaban.
--
-- Kalau suatu saat aturan penilaian benar/salah perlu berbeda (mis. nilai
-- sebagian per pernyataan), di sinilah tempatnya — dan hanya di sini, karena
-- fungsi ini satu-satunya jalur penilaian.

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
  --
  -- Berlaku untuk ketiga tipe objektif sekaligus:
  --   mcq_single   → satu terpilih = satu kunci (otomatis setara)
  --   mcq_multiple → himpunan harus sama persis
  --   true_false   → himpunan pernyataan "Benar" harus sama persis
  -- Tidak ada cabang per tipe, jadi tidak ada aturan kedua yang bisa menyimpang.
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
      (qtype in ('mcq_single', 'mcq_multiple', 'true_false')
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
  -- Hanya soal objektif; essay dibiarkan `points_awarded` null sampai dinilai.
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
        and q.type in ('mcq_single', 'mcq_multiple', 'true_false')
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
  'Menilai PG dan benar/salah otomatis lalu menetapkan status attempt. Satu-satunya jalur penilaian.';

-- ---------------------------------------------------------------------------
-- 2. get_attempt_state: kirim teks bacaan
-- ---------------------------------------------------------------------------
-- Perubahan minimal dari versi 0007: satu baris `'passage', q.passage`.
--
-- Teks bacaan **bukan** rahasia — ia bagian dari soal yang memang dibaca
-- peserta. Yang tetap tidak dikirim: `is_correct`, `reference_answer`, dan
-- `explanation` (pembahasan), karena ketiganya membocorkan kunci.

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
                           /*
                            * `order by i` HARUS di dalam array_agg, bukan di
                            * level query. Versi sebelumnya menaruhnya di luar
                            * sehingga Postgres menolak seluruh fungsi dengan
                            * 42803 ("column e.i must appear in the GROUP BY
                            * clause") — dan `get_attempt_state` gagal setiap
                            * kali dipanggil. Tanpa urutan eksplisit di dalam
                            * agregat, urutan opsi yang sudah diacak saat attempt
                            * dimulai tidak dijamin terbaca ulang sama.
                            */
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
