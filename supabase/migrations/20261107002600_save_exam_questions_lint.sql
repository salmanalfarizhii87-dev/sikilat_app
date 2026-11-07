-- =============================================================================
-- 0026 — save_exam_questions: hapus variabel yang tidak dibaca
-- =============================================================================
-- Satu peringatan `db lint` dari 0025:
--
--     never read variable "v_exam"
--
-- `v_exam` diisi `select * into v_exam ... for update` hanya untuk mengunci
-- baris ujian; isinya tidak pernah dipakai. `for update` tetap dibutuhkan —
-- itulah yang membuat dua penyimpanan bersamaan tidak saling menimpa — jadi
-- yang diubah hanya bentuknya: `perform` mengunci baris tanpa menyalin kolom.
--
-- Perubahan perilaku-nol. Tujuannya menjaga `db lint` tetap bersih supaya
-- peringatan baru di masa depan langsung terlihat.
--
-- Catatan: `create or replace function` mengganti **seluruh** isi fungsi. Isi
-- di bawah ini disalin dari 0025 dengan satu perubahan tersebut; jangan
-- menyunting 0025 (sudah diterapkan) — tambahkan migrasi baru bila perlu.

create or replace function public.save_exam_questions(
  p_exam_id   uuid,
  p_questions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin           uuid := public.assert_admin();
  v_q               jsonb;
  v_opt             jsonb;
  v_type            question_type;
  v_body            text;
  v_points          numeric(6,2);
  v_word_min        integer;
  v_word_max        integer;
  v_position        integer := 0;
  v_question_id     uuid;
  v_option_pos      smallint;
  v_correct_count   integer;
  v_option_count    integer;
  v_total_questions integer := 0;
  v_total_options   integer := 0;
begin
  -- Kunci baris ujian. `perform` dipakai karena isinya tidak dibaca; yang
  -- dibutuhkan hanya efek sampingnya (baris terkunci sampai transaksi selesai).
  perform 1 from exams where id = p_exam_id for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  /*
   * EXM-09: setelah percobaan pertama masuk, isi soal dan kunci jawabannya
   * terkunci. Diperiksa di sini, bukan hanya di UI — Server Action adalah
   * endpoint HTTP, dan aturan yang hanya hidup di tombol yang dinonaktifkan
   * bukan aturan.
   */
  if exists (select 1 from attempts where exam_id = p_exam_id) then
    raise exception 'EXAM_LOCKED' using errcode = '22023',
      detail = 'Ujian ini sudah punya percobaan, jadi soal tidak bisa diubah lagi.';
  end if;

  if p_questions is null or jsonb_typeof(p_questions) <> 'array' then
    raise exception 'VALIDATION' using errcode = '22023',
      detail = 'Daftar soal tidak valid.';
  end if;

  if jsonb_array_length(p_questions) > 500 then
    raise exception 'VALIDATION' using errcode = '22023',
      detail = 'Maksimal 500 soal per ujian.';
  end if;

  delete from questions where exam_id = p_exam_id;

  for v_q in select * from jsonb_array_elements(p_questions) loop
    v_position := v_position + 1;

    if jsonb_typeof(v_q) <> 'object' then
      raise exception 'VALIDATION' using errcode = '22023',
        detail = format('Soal %s bukan objek.', v_position);
    end if;

    begin
      v_type := (v_q ->> 'type')::question_type;
    exception when others then
      raise exception 'VALIDATION' using errcode = '22023',
        detail = format('Soal %s: tipe soal tidak dikenali.', v_position);
    end;

    v_body := btrim(coalesce(v_q ->> 'body', ''));
    if v_body = '' then
      raise exception 'VALIDATION' using errcode = '22023',
        detail = format('Soal %s: pertanyaan masih kosong.', v_position);
    end if;

    v_points := coalesce((v_q ->> 'points')::numeric, 1);
    if v_points <= 0 then
      raise exception 'VALIDATION' using errcode = '22023',
        detail = format('Soal %s: poin harus lebih dari 0.', v_position);
    end if;

    v_word_min := nullif(v_q ->> 'wordMin', '')::integer;
    v_word_max := nullif(v_q ->> 'wordMax', '')::integer;

    if v_word_min is not null and v_word_max is not null and v_word_max < v_word_min then
      raise exception 'VALIDATION' using errcode = '22023',
        detail = format('Soal %s: batas kata maksimal lebih kecil dari minimal.', v_position);
    end if;

    insert into questions (
      exam_id, position, type, body, passage, media_path, points,
      word_min, word_max, reference_answer, explanation
    )
    values (
      p_exam_id,
      v_position,
      v_type,
      v_body,
      nullif(btrim(coalesce(v_q ->> 'passage', '')), ''),
      nullif(btrim(coalesce(v_q ->> 'mediaPath', '')), ''),
      v_points,
      v_word_min,
      v_word_max,
      nullif(btrim(coalesce(v_q ->> 'referenceAnswer', '')), ''),
      nullif(btrim(coalesce(v_q ->> 'explanation', '')), '')
    )
    returning id into v_question_id;

    v_total_questions := v_total_questions + 1;

    /*
     * Opsi. Soal esai tidak punya opsi sama sekali; tipe lain wajib punya
     * minimal dua opsi dan minimal satu kunci.
     */
    if v_q -> 'options' is null or jsonb_typeof(v_q -> 'options') <> 'array' then
      if v_type <> 'essay' then
        raise exception 'VALIDATION' using errcode = '22023',
          detail = format('Soal %s: opsi jawaban belum diisi.', v_position);
      end if;
      continue;
    end if;

    v_option_count := jsonb_array_length(v_q -> 'options');

    if v_type = 'essay' then
      if v_option_count > 0 then
        raise exception 'VALIDATION' using errcode = '22023',
          detail = format('Soal %s: soal esai tidak boleh punya opsi.', v_position);
      end if;
      continue;
    end if;

    if v_option_count < 2 then
      raise exception 'VALIDATION' using errcode = '22023',
        detail = format('Soal %s: minimal dua opsi jawaban.', v_position);
    end if;

    v_option_pos := 0;
    v_correct_count := 0;

    for v_opt in select * from jsonb_array_elements(v_q -> 'options') loop
      v_option_pos := v_option_pos + 1;

      if btrim(coalesce(v_opt ->> 'body', '')) = '' then
        raise exception 'VALIDATION' using errcode = '22023',
          detail = format('Soal %s: opsi %s masih kosong.', v_position, v_option_pos);
      end if;

      if coalesce((v_opt ->> 'isCorrect')::boolean, false) then
        v_correct_count := v_correct_count + 1;
      end if;

      insert into question_options (question_id, position, body, media_path, is_correct)
      values (
        v_question_id,
        v_option_pos,
        btrim(v_opt ->> 'body'),
        nullif(btrim(coalesce(v_opt ->> 'mediaPath', '')), ''),
        coalesce((v_opt ->> 'isCorrect')::boolean, false)
      );

      v_total_options := v_total_options + 1;
    end loop;

    if v_correct_count = 0 then
      raise exception 'VALIDATION' using errcode = '22023',
        detail = format('Soal %s: belum ada kunci jawaban.', v_position);
    end if;

    -- Pilihan ganda satu jawaban: kunci harus tepat satu. Dua kunci pada tipe
    -- ini tidak bisa dinilai — peserta hanya bisa memilih satu.
    if v_type = 'mcq_single' and v_correct_count > 1 then
      raise exception 'VALIDATION' using errcode = '22023',
        detail = format('Soal %s: pilihan ganda satu jawaban hanya boleh punya satu kunci.', v_position);
    end if;
  end loop;

  insert into audit_logs (actor_id, action, entity, entity_id, after_data)
  values (
    v_admin, 'save_exam_questions', 'exams', p_exam_id::text,
    jsonb_build_object('questions', v_total_questions, 'options', v_total_options)
  );

  return jsonb_build_object('questions', v_total_questions, 'options', v_total_options);
end;
$$;

comment on function public.save_exam_questions(uuid, jsonb) is
  'Mengganti seluruh soal sebuah ujian dalam satu transaksi. Menolak bila ujian sudah punya percobaan (EXM-09).';

revoke execute on function public.save_exam_questions(uuid, jsonb) from public, anon;
grant  execute on function public.save_exam_questions(uuid, jsonb) to authenticated;
