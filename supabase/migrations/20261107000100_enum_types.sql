-- =============================================================================
-- 0001 — Tipe enum
-- =============================================================================
-- Rujukan: PRD §7.2.
--
-- Enum dipisah ke migrasi sendiri karena `alter type ... add value` tidak bisa
-- dijalankan di dalam transaksi yang sama dengan pemakaian nilai barunya.
-- Dengan memisahkan, penambahan nilai enum nanti cukup satu migrasi kecil.

create type exam_status       as enum ('draft', 'published', 'archived');
create type question_type     as enum ('mcq_single', 'mcq_multiple', 'essay');
create type attempt_status    as enum ('in_progress', 'needs_grading', 'graded');
create type score_policy      as enum ('highest', 'latest', 'first', 'average');
create type result_visibility as enum ('hidden', 'score_only', 'score_and_review');
create type result_release    as enum ('instant', 'after_close', 'manual');
