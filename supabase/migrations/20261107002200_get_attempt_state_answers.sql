-- =============================================================================
-- 0022 — get_attempt_state: kirim jawaban esai, penanda tersentuh, Kode Lanjut
-- =============================================================================
-- Versi 0021 mengirim jawaban sebagai `{question_id: [option_id, ...]}` saja.
-- Dua hal hilang dari bentuk itu, dan keduanya baru terasa saat runner peserta
-- benar-benar membaca server (sebelumnya runner menghitung semuanya di
-- peramban dari localStorage, jadi kekurangan ini tidak pernah terlihat):
--
-- 1. **Teks esai tidak ikut terkirim.** Peserta yang me-refresh di tengah
--    ujian akan melihat kotak esainya kosong padahal jawabannya ada di
--    `attempt_answers.essay_text`. Untuk ujian dengan soal esai, itu kehilangan
--    pekerjaan — bukan sekadar tampilan yang kurang.
-- 2. **"Belum dijawab" dan "dijawab Salah semua" tidak bisa dibedakan.** Pada
--    soal benar/salah, menjawab "Salah" untuk semua pernyataan menghasilkan
--    `selected_option_ids = '{}'` — sama persis dengan soal yang belum
--    disentuh. Bedanya: yang pertama punya baris di `attempt_answers`, yang
--    kedua tidak. Karena itu `answers` sekarang hanya memuat soal yang
--    **punya baris**, dan keberadaan entri itu sendiri adalah penanda `touched`.
--    Tanpa ini, soal yang sudah dijawab penuh tampil sebagai "kosong" di
--    navigasi dan ikut dihitung pada peringatan sebelum mengumpulkan.
--
-- `resumeCode` ikut dikirim karena layar ujian menampilkannya kepada peserta
-- ("catat kode ini"). Ia bukan rahasia terhadap pemilik attempt: pemanggil
-- fungsi ini sudah memegang `token_hash` attempt tersebut.
--
-- Bentuk `answers` berubah dari `{id: [opsi]}` menjadi
-- `{id: {selectedOptionIds, essayText, flagged}}`. Tidak ada pemanggil lama:
-- sebelum ini tidak ada kode aplikasi yang memanggil RPC peserta sama sekali.
--
-- Badan fungsi tetap memakai LATERAL join dari 0011/0021 — lihat catatan
-- riwayat di 0021 sebelum mengubahnya lagi.

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

  -- Hanya soal yang punya baris jawaban. `selected_option_ids` yang kosong
  -- tetap berarti "sudah dijawab" — itulah jawaban "Salah" untuk semua
  -- pernyataan pada soal benar/salah.
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
    'status',           v_attempt.status,
    'startedAt',        v_attempt.started_at,
    'expiresAt',        v_attempt.expires_at,
    'serverNow',        now(),
    'questions',        v_questions,
    'answers',          v_answers
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Hak akses
-- ---------------------------------------------------------------------------
-- `create or replace` tidak mengubah ACL; baris ini karena itu tidak mengubah
-- apa pun hari ini. Ditulis supaya migrasi bisa berdiri sendiri bila fungsi ini
-- suatu saat di-drop lalu dibuat ulang — tanpa `revoke`, Postgres memberi
-- EXECUTE ke PUBLIC secara default dan `anon` bisa memanggilnya lewat Data API.
revoke execute on function public.get_attempt_state(text) from public, anon, authenticated;
grant  execute on function public.get_attempt_state(text) to service_role;
