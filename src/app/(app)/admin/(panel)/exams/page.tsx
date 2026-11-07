"use client";

import * as React from "react";
import Link from "next/link";
import {
  Archive,
  ArrowUpRight,
  CalendarClock,
  Copy,
  FilePlus2,
  FileStack,
  MoreHorizontal,
  SearchX,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, SampleDataNote } from "@/components/ui/primitives";
import {
  PageHeader,
  SearchInput,
  FilterChips,
  StatusBadge,
  CopyButton,
  Panel,
} from "@/components/admin/ui";
import { demoExams, demoQuestions } from "@/lib/mock-data";
import { demoAttempts } from "@/lib/admin-data";
import { formatDateId } from "@/lib/utils";
import type { Exam, ExamStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | ExamStatus;

export default function AdminExamsPage() {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [menuFor, setMenuFor] = React.useState<string | null>(null);

  const counts = {
    all: demoExams.length,
    published: demoExams.filter((e) => e.status === "published").length,
    draft: demoExams.filter((e) => e.status === "draft").length,
    archived: demoExams.filter((e) => e.status === "archived").length,
  };

  const visible = demoExams.filter((exam) => {
    if (filter !== "all" && exam.status !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      exam.title.toLowerCase().includes(q) ||
      exam.code.toLowerCase().includes(q) ||
      exam.subjectLabel.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <PageHeader
        title="Daftar ujian"
        description="Bagikan kode, duplikat untuk kelas lain, atau arsipkan ujian yang sudah selesai."
        actions={
          <Link href="/admin/exams/new">
            <Button size="md">
              <FilePlus2 className="size-4" aria-hidden /> Buat ujian
            </Button>
          </Link>
        }
      />

      <SampleDataNote className="mb-3">
        Tiga ujian di bawah adalah contoh bawaan. Ujian yang kamu buat belum tersimpan ke server.
      </SampleDataNote>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={query}
          onChange={setQuery}
          label="Cari ujian"
          placeholder="Cari judul, kode, atau mata pelajaran"
          className="sm:max-w-[340px]"
        />
        <FilterChips
          label="Filter status ujian"
          value={filter}
          onChange={setFilter}
          options={[
            { key: "all", label: "Semua", count: counts.all },
            { key: "published", label: "Aktif", count: counts.published },
            { key: "draft", label: "Draft", count: counts.draft },
            { key: "archived", label: "Arsip", count: counts.archived },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<SearchX className="size-6" aria-hidden />}
            title="Tidak ada ujian yang cocok"
            description="Coba kata kunci lain, atau kembali ke semua ujian."
            action={
              <Button
                size="md"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Tampilkan semua ujian
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-2.5">
          {visible.map((exam) => (
            <ExamRow
              key={exam.id}
              exam={exam}
              menuOpen={menuFor === exam.id}
              onToggleMenu={() => setMenuFor((v) => (v === exam.id ? null : exam.id))}
            />
          ))}
        </div>
      )}

      <p className="mt-4 text-[12px] text-muted">
        Menampilkan {visible.length} dari {demoExams.length} ujian.
      </p>
    </>
  );
}

function ExamRow({
  exam,
  menuOpen,
  onToggleMenu,
}: {
  exam: Exam;
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  const attempts = demoAttempts.filter((a) => a.examId === exam.id);
  const questionCount = exam.id === demoExams[0].id ? demoQuestions.length : 20;

  return (
    <div className="relative rounded-card border border-line bg-surface p-3.5 sm:p-4">
      <div className="flex flex-wrap items-start gap-3">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-card font-heading text-[12px] font-extrabold",
            exam.status === "published"
              ? "bg-navy-900 text-accent-400"
              : exam.status === "draft"
                ? "bg-accent-100 text-accent-900"
                : "bg-line-soft text-muted",
          )}
          aria-hidden
        >
          {exam.code.slice(0, 2)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={exam.status} />
            <span className="rounded-xs bg-line-soft px-1.5 py-0.5 font-heading text-[11px] font-bold text-ink-soft">
              {exam.code}
            </span>
            <span className="text-[12px] text-muted">{exam.subjectLabel}</span>
          </div>
          {/* Judul adalah tautan utama ke detail ujian, jadi seluruh barisnya
              harus bisa disentuh (44 px), bukan hanya tinggi teksnya. */}
          <Link
            href={`/admin/exams/${exam.id}`}
            className="-mx-1 flex min-h-11 min-w-0 items-center truncate rounded-field px-1 font-heading text-[14.5px] font-bold text-ink hover:text-navy-700"
          >
            {exam.title}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
            <span className="flex items-center gap-1">
              <FileStack className="size-3.5" aria-hidden /> {questionCount} soal
            </span>
            <span className="flex items-center gap-1">
              <CalendarClock className="size-3.5" aria-hidden /> {exam.durationMinutes} menit
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-3.5" aria-hidden /> {attempts.length} peserta
            </span>
            <span className="hidden sm:inline">Dibuat {formatDateId(exam.createdAt)}</span>
          </div>
        </div>

        {/* Di HP tombol aksi tidak muat sebaris dengan judul, dan karena
            `flex-1` boleh menyusut sampai nol, judul ujian sempat tinggal 23 px.
            Aksi dipaksa turun ke baris sendiri di bawah `sm`. */}
        <div className="flex w-full items-center gap-1.5 sm:w-auto">
          <CopyButton value={exam.code} label="Salin kode" />
          <Link
            href={`/admin/exams/${exam.id}`}
            className="press inline-flex h-11 items-center gap-1 rounded-field border border-line bg-surface px-3 font-heading text-[12.5px] font-semibold text-ink-soft hover:bg-line-soft"
          >
            Kelola <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
          <div className="relative">
            <button
              type="button"
              onClick={onToggleMenu}
              aria-label={`Aksi lain untuk ${exam.title}`}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="press grid size-11 place-items-center rounded-field text-muted hover:bg-line-soft"
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={onToggleMenu} aria-hidden />
                <div
                  role="menu"
                  className="animate-rise absolute right-0 top-10 z-20 w-52 overflow-hidden rounded-card border border-line bg-surface py-1 shadow-pop"
                >
                  <MenuItem
                    icon={<Copy className="size-3.5" aria-hidden />}
                    label="Salin tautan peserta"
                    onClick={() => {
                      navigator.clipboard?.writeText(`${window.location.origin}/u/${exam.code}`);
                      toast.success("Tautan peserta disalin");
                      onToggleMenu();
                    }}
                  />
                  <MenuItem
                    icon={<Copy className="size-3.5" aria-hidden />}
                    label="Duplikat ujian"
                    onClick={() => {
                      toast("Belum tersambung ke server. Duplikat butuh penyimpanan.");
                      onToggleMenu();
                    }}
                  />
                  <MenuItem
                    icon={<Archive className="size-3.5" aria-hidden />}
                    label={exam.status === "archived" ? "Keluarkan dari arsip" : "Arsipkan"}
                    onClick={() => {
                      toast("Belum tersambung ke server. Status ujian tidak berubah.");
                      onToggleMenu();
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-ink-soft hover:bg-line-soft"
    >
      {icon}
      {label}
    </button>
  );
}
