-- =============================================================================
-- 0021 — get_attempt_state: kembalikan ke desain 0011, tambahkan `passage`
-- =============================================================================
-- Riwayat fungsi ini, supaya tidak terulang:
--
--   0007  versi awal. Urutan opsi memakai `array_position` atas subquery
--         ordinality yang `order by i`-nya berada DI LUAR `array_agg` →
--         Postgres menolak seluruh fungsi dengan 42803.
--   0011  **perbaikan**. Diganti LATERAL join: urutan dihitung sekali per soal
--         menjadi tabel kecil (option_id, urutan), lalu
--         `jsonb_agg ... order by coalesce(ord_map.urutan, o.position)`.
--         Sejak sini fungsinya benar dan berjalan.
--   0017  saya menambahkan `passage`, tetapi menyalin badan fungsi dari **0007**
--         — bukan dari 0011. Akibatnya bug 42803 yang sudah diperbaiki 0011
--         HIDUP LAGI, dan `get_attempt_state` gagal total selama satu migrasi.
--         Ini kesalahan saya: `create or replace` menimpa versi terbaru dengan
--         versi lama yang kebetulan saya baca lebih dulu.
--   0018  memperbaiki 42803 lagi, tetapi tetap memakai konstruksi 0007
--         (`array_position` + `array_agg ... order by e.i` di dalam subquery).
--         Berjalan, tetapi mengembalikan kerapuhan yang 0011 sengaja buang:
--         `array_position` mengembalikan NULL bila id tidak ditemukan, dan
--         `order by` dengan NULL menempatkan opsi di urutan tak menentu.
--   0021  versi ini. Kembali ke LATERAL join 0011 + `passage`.
--
-- Pelajaran yang dikodekan di sini: **`create or replace function` mengganti
-- seluruh badan fungsi.** Sebelum mengganti fungsi yang punya riwayat perbaikan,
-- cari dulu versi TERBARU-nya (`grep -l "create or replace function <nama>"`),
-- bukan yang pertama ditemukan.

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
  -- `reference_answer` yang bisa ikut terbawa. `passage` aman dikirim: ia
  -- bagian dari soal yang memang harus dibaca peserta, bukan kunci.
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
        -- Peta urutan yang tersimpan saat attempt dimulai. Diambil sebagai
        -- tabel (option_id, urutan) lebih dulu, sehingga tidak ada `order by`
        -- di level query yang bisa ditolak GROUP BY — dan tidak bergantung
        -- pada `array_position` yang bisa mengembalikan NULL.
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

-- ---------------------------------------------------------------------------
-- Hak akses
-- ---------------------------------------------------------------------------
-- `create or replace` TIDAK mengubah ACL: fungsi yang sudah ada mempertahankan
-- hak aksesnya. Baris di bawah karena itu tidak mengubah apa pun hari ini, dan
-- ditulis hanya supaya migrasi ini bisa berdiri sendiri — kalau fungsi ini
-- suatu saat di-drop lalu dibuat ulang, tanpa `revoke` Postgres memberi EXECUTE
-- ke PUBLIC secara default, dan `anon` bisa memanggilnya lewat Data API.
revoke execute on function public.get_attempt_state(text) from public, anon, authenticated;
grant  execute on function public.get_attempt_state(text) to service_role;
