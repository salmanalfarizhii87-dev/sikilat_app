-- =============================================================================
-- 0003 — Indeks
-- =============================================================================
-- Rujukan: PRD §7.4.
--
-- Indeks parsial (`where status = ...`) dipakai karena query yang dominan hampir
-- selalu menyaring status tertentu (mis. hanya attempt yang masih berjalan).
-- Indeks parsial jauh lebih kecil dan lebih cepat daripada indeks penuh.

create index on exams (created_by, status);
create index on exams (opens_at, closes_at) where status = 'published';
create index on questions (exam_id, position);
create index on attempts (exam_id, status);
create index on attempts (exam_id, started_at desc);
create index on attempt_answers (question_id);
create index on attempt_events (attempt_id, created_at);

-- ---------------------------------------------------------------- tambahan ---
-- Di luar PRD §7.4, diturunkan dari pola akses RPC yang sudah pasti di §7.6.

-- `resume_attempt` mencari attempt aktif lewat kode ujian + nama.
-- (`one_active_attempt` di migrasi 0002 sudah melayani pola ini untuk
--  keunikan; indeks di bawah ini mempercepat pembacaan kolom lain.)
-- Catatan: kolom `resume_code` perlu dicari saat peserta menempelkan kodenya.
create index on attempts (exam_id, resume_code) where status = 'in_progress';

-- `expire_overdue_attempts()` menyapu attempt yang lewat `expires_at`.
create index on attempts (expires_at) where status = 'in_progress';

-- Pembersihan berkala tabel rate_limits berdasarkan jendela waktu.
create index on rate_limits (window_start);
