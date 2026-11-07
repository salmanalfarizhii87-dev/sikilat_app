-- =============================================================================
-- 0002 — Skema inti
-- =============================================================================
-- Rujukan: PRD §7.3.
--
-- Urutan pembuatan mengikuti ketergantungan foreign key:
--   admins → exams → questions → question_options
--   exams + questions → attempts → attempt_answers
--   attempts → attempt_events
--   admins → audit_logs

-- ============ ADMIN ============
-- Satu baris per akun Supabase Auth yang berhak masuk panel admin.
-- Tidak ada registrasi publik (enable_signup = false), jadi baris di sini
-- dibuat manual lewat seed atau SQL.
create table admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ UJIAN ============
create table exams (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique check (code ~ '^[A-Z0-9]{4,10}$'),
  created_by          uuid not null references admins(user_id),
  title               text not null,
  subject_label       text,                          -- teks bebas, mis. 'Matematika'
  description         text,
  instructions        text,
  status              exam_status not null default 'draft',
  opens_at            timestamptz,                   -- null = langsung terbuka saat published
  closes_at           timestamptz,                   -- null = terbuka sampai ditutup manual
  duration_minutes    integer not null check (duration_minutes > 0),
  max_attempts        smallint not null default 1 check (max_attempts >= 1),
  score_policy        score_policy not null default 'highest',
  passing_score       numeric(5,2) check (passing_score between 0 and 100),
  shuffle_questions   boolean not null default false,
  shuffle_options     boolean not null default false,
  ask_class           boolean not null default false, -- tampilkan isian Kelas ke peserta
  result_visibility   result_visibility not null default 'score_only',
  result_release      result_release not null default 'instant',
  results_released_at timestamptz,                   -- diisi saat rilis manual / setelah ditutup
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (closes_at is null or opens_at is null or closes_at > opens_at)
);

-- ============ SOAL (milik satu ujian) ============
create table questions (
  id               uuid primary key default gen_random_uuid(),
  exam_id          uuid not null references exams(id) on delete cascade,
  position         integer not null,
  type             question_type not null,
  body             text not null,                    -- teks / Markdown sederhana (disanitasi saat render)
  media_path       text,
  points           numeric(6,2) not null default 1 check (points > 0),
  word_min         integer check (word_min >= 0),    -- khusus essay
  word_max         integer check (word_max > 0),
  reference_answer text,                             -- RAHASIA: acuan essay (admin saja)
  explanation      text,                             -- pembahasan (tampil sesuai visibilitas)
  created_at       timestamptz not null default now(),
  unique (exam_id, position) deferrable initially deferred,
  check (word_max is null or word_min is null or word_max >= word_min)
);

create table question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  position    smallint not null,
  body        text not null,
  media_path  text,
  is_correct  boolean not null default false,        -- RAHASIA: tidak pernah dikirim ke peserta
  unique (question_id, position)
);

-- ============ PELAKSANAAN ============
-- Peserta bukan entitas: nama dan kelas disimpan langsung di baris attempt.
create table attempts (
  id                    uuid primary key default gen_random_uuid(),
  exam_id               uuid not null references exams(id) on delete cascade,
  participant_name      text not null check (char_length(participant_name) between 2 and 60),
  participant_name_norm text not null,               -- huruf kecil, spasi dirapikan (dihitung server)
  participant_class     text,
  attempt_no            smallint not null,
  status                attempt_status not null default 'in_progress',
  submit_reason         text check (submit_reason in ('manual', 'timeout', 'admin')),
  started_at            timestamptz not null default now(),
  expires_at            timestamptz not null,        -- ditetapkan server
  submitted_at          timestamptz,
  question_order        uuid[] not null,             -- urutan soal final per attempt
  option_orders         jsonb,                       -- {question_id: [option_id, ...]}
  score_auto            numeric(7,2) not null default 0,
  score_manual          numeric(7,2) not null default 0,
  max_score             numeric(7,2) not null,
  total_score           numeric(7,2) generated always as (score_auto + score_manual) stored,
  token_hash            text not null,               -- SHA-256 dari attempt_token
  resume_code           text not null,               -- Kode Lanjut (6 karakter)
  result_token          text not null unique,        -- tautan hasil baca saja
  ip_address            inet,                        -- opsional (INT-04)
  user_agent            text,
  unique (exam_id, participant_name_norm, attempt_no)
);

-- Maksimal satu attempt aktif per nama per ujian.
-- Ini yang membuat `start_attempt` bisa menolak NAME_IN_USE secara atomik:
-- dua permintaan bersamaan tidak bisa sama-sama lolos.
create unique index one_active_attempt
  on attempts (exam_id, participant_name_norm) where status = 'in_progress';

create table attempt_answers (
  attempt_id          uuid not null references attempts(id) on delete cascade,
  question_id         uuid not null references questions(id) on delete cascade,
  selected_option_ids uuid[],                        -- PG
  essay_text          text,                          -- essay
  is_flagged          boolean not null default false,
  answered_at         timestamptz not null default now(),
  is_correct          boolean,                       -- diisi saat penilaian
  points_awarded      numeric(6,2),
  graded_by           uuid references admins(user_id),
  graded_at           timestamptz,
  feedback            text,
  primary key (attempt_id, question_id)
);

create table attempt_events (                         -- INT-02
  id         bigint generated always as identity primary key,
  attempt_id uuid not null references attempts(id) on delete cascade,
  event_type text not null,                          -- 'tab_hidden', 'fullscreen_exit', 'paste', ...
  meta       jsonb,
  created_at timestamptz not null default now()
);

create table audit_logs (                             -- SYS-03
  id          bigint generated always as identity primary key,
  actor_id    uuid references admins(user_id),
  action      text not null,
  entity      text not null,
  entity_id   text,
  before_data jsonb,
  after_data  jsonb,
  created_at  timestamptz not null default now()
);

-- ============ RATE LIMIT (keputusan K2: tabel Postgres, tanpa Upstash) ============
-- Kunci gabungan: aksi + identitas pemanggil (mis. 'login_admin' + IP,
-- 'start_attempt' + kode ujian). Satu baris per jendela waktu.
create table rate_limits (
  bucket        text not null,                       -- 'login_admin', 'start_attempt', ...
  identifier    text not null,                       -- IP, kode ujian, atau gabungan
  window_start  timestamptz not null,                -- awal jendela (dibulatkan)
  counter       integer not null default 0,
  blocked_until timestamptz,                         -- null = belum diblokir
  primary key (bucket, identifier, window_start)
);
