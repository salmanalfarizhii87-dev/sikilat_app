import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarClock,
  ClipboardList,
  Clock3,
  Eye,
  FileStack,
  KeyRound,
  Lock,
  Settings2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { PageHeader, StatCard, Panel, ExamLinkRow, CopyButton, StatusBadge } from "@/components/admin/ui";
import { ExamTabs } from "@/components/admin/exam-tabs";
import { getExam, examHasAttempts, getExamQuestionStats } from "@/features/exams/queries";
import { formatDateTimeId, formatDuration } from "@/lib/utils";
import { ExamDetailActions } from "./exam-detail-actions";

/**
 * Ringkasan ujian (T3.6).
 *
 * Server Component: seluruh angka dibaca dari database, bukan dari data contoh.
 * Sebelumnya halaman ini komponen klien yang memanggil `findExam(id)` pada data
 * demo — akibatnya **setiap** ID nyata (UUID) menghasilkan 404, dan angka
 * peserta/nilai yang tampil selalu milik ujian contoh.
 *
 * Aksi yang mengubah keadaan (buka/tutup/perpanjang/ganti kode/duplikat/arsip)
 * ada di `ExamDetailActions` karena butuh state dan dialog konfirmasi.
 */
export const metadata: Metadata = { title: "Ringkasan ujian" };

export default async function ExamDetailPage({ params }: PageProps<"/admin/exams/[id]">) {
  const { id } = await params;

  /*
   * `getExam` memakai `maybeSingle()`, jadi ID yang tidak ada menghasilkan
   * `null` — bukan error. Halaman lalu memanggil `notFound()` sehingga 404
   * admin benar-benar muncul, lengkap dengan sidebar.
   */
  const exam = await getExam(id);
  if (!exam) notFound();

  /*
   * Tiga pembacaan tambahan berjalan paralel: statistik soal, jumlah attempt,
   * dan status penguncian. `examHasAttempts` mengembalikan `true` bila gagal
   * menghitung — arah aman untuk fitur yang membuka/mengunci soal.
   */
  const [stats, hasAttempts] = await Promise.all([getExamQuestionStats(exam.id), examHasAttempts(exam.id)]);

  const now = new Date();
  const opensAt = exam.opensAt ? new Date(exam.opensAt) : null;
  const closesAt = exam.closesAt ? new Date(exam.closesAt) : null;

  /*
   * Status yang dilihat guru berbeda dari kolom `status` saja. Ujian
   * ber-`status = published` yang jadwalnya belum mulai atau sudah lewat tetap
   * tidak bisa dikerjakan, jadi yang ditampilkan adalah keadaan sebenarnya.
   */
  const phase: "draft" | "scheduled" | "open" | "closed" | "archived" =
    exam.status === "archived"
      ? "archived"
      : exam.status === "draft"
        ? "draft"
        : opensAt && now < opensAt
          ? "scheduled"
          : closesAt && now >= closesAt
            ? "closed"
            : "open";

  const phaseLabel = {
    draft: "Draft",
    scheduled: "Terjadwal",
    open: "Aktif",
    closed: "Ditutup",
    archived: "Arsip",
  }[phase];

  const phaseHint = {
    draft: "Belum bisa diakses peserta",
    scheduled: "Dibuka sesuai jadwal",
    open: "Peserta bisa masuk",
    closed: "Peserta ditolak",
    archived: "Disimpan, tidak aktif",
  }[phase];

  return (
    <>
      <PageHeader
        title={exam.title}
        description={exam.description ?? undefined}
        actions={
          <ExamDetailActions
            examId={exam.id}
            code={exam.code}
            title={exam.title}
            status={exam.status}
            phase={phase}
            hasAttempts={hasAttempts}
          />
        }
      >
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
          <StatusBadge status={exam.status} />
          <span className="rounded-xs bg-line-soft px-1.5 py-0.5 font-heading text-[11px] font-bold text-ink-soft">
            {exam.code}
          </span>
          {exam.subjectLabel && <span>{exam.subjectLabel}</span>}
        </p>
      </PageHeader>

      <ExamTabs examId={exam.id} />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard
          label="Status"
          value={phaseLabel}
          hint={phaseHint}
          tone={phase === "open" ? "green" : phase === "scheduled" ? "amber" : "plain"}
          marker
        />
        <StatCard
          label="Peserta"
          value={stats.attemptCount}
          hint={hasAttempts ? "sudah ada percobaan" : "belum ada percobaan"}
        />
        <StatCard label="Soal" value={stats.questionCount} hint={`${stats.totalPoints} poin total`} />
        <StatCard
          label="Durasi"
          value={`${exam.durationMinutes} mnt`}
          hint={`maks ${exam.maxAttempts}× per nama`}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          <Panel title="Kode dan tautan peserta">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-card bg-navy-900 px-4 py-3">
                <p className="text-[11.5px] font-medium text-white/75">Kode ujian</p>
                <p className="font-heading text-[26px] font-extrabold tracking-[0.16em] text-white">
                  {exam.code}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <CopyButton value={exam.code} label="Salin kode" size="md" variant="dark" />
                <ExamDetailActions
                  examId={exam.id}
                  code={exam.code}
                  title={exam.title}
                  status={exam.status}
                  phase={phase}
                  hasAttempts={hasAttempts}
                  variant="regenerate"
                />
              </div>
            </div>

            <div className="mt-3">
              <ExamLinkRow code={exam.code} />
            </div>

            <p className="mt-2.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-muted">
              <KeyRound className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Kode baru tidak menghapus pengerjaan yang sedang berjalan. Peserta lama tetap bisa
              melanjutkan dengan Kode Lanjut.
            </p>
          </Panel>

          <Panel title="Jadwal dan durasi">
            <dl className="grid gap-2 sm:grid-cols-2">
              {[
                { icon: Clock3, label: "Durasi", value: formatDuration(exam.durationMinutes * 60) },
                {
                  icon: CalendarClock,
                  label: "Dibuka",
                  value: exam.opensAt ? formatDateTimeId(exam.opensAt) : "Buka manual",
                },
                {
                  icon: CalendarClock,
                  label: "Ditutup",
                  value: exam.closesAt ? formatDateTimeId(exam.closesAt) : "Tutup manual",
                },
                { icon: Users, label: "Maks percobaan", value: `${exam.maxAttempts} kali per nama` },
              ].map((item) => (
                <div key={item.label} className="rounded-field border border-line px-3 py-2">
                  <dt className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
                    <item.icon className="size-3.5" aria-hidden /> {item.label}
                  </dt>
                  <dd className="mt-0.5 font-heading text-[13px] font-bold text-ink">{item.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone={exam.shuffleQuestions ? "navy" : "outline"}>
                {exam.shuffleQuestions ? "Soal diacak" : "Soal berurutan"}
              </Badge>
              <Badge tone={exam.shuffleOptions ? "navy" : "outline"}>
                {exam.shuffleOptions ? "Opsi diacak" : "Opsi berurutan"}
              </Badge>
              <Badge tone={exam.askClass ? "amber" : "outline"}>
                {exam.askClass ? "Kelas diminta" : "Tanpa kelas"}
              </Badge>
              <Badge tone="outline">
                {exam.resultVisibility === "score_and_review"
                  ? "Skor dan pembahasan"
                  : exam.resultVisibility === "hidden"
                    ? "Hasil disembunyikan"
                    : "Skor saja"}
              </Badge>
              {/*
                `passingScore` null berarti "tanpa KKM" dan itu berbeda dari 0
                yang berarti semua peserta lulus. Menampilkan "KKM 0" akan
                salah arti, jadi null punya labelnya sendiri.
              */}
              <Badge tone="outline">
                {exam.passingScore === null ? "Tanpa KKM" : `KKM ${exam.passingScore}`}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/admin/exams/${exam.id}/settings`}>
                <Button variant="secondary" size="sm">
                  <Settings2 className="size-3.5" aria-hidden /> Ubah pengaturan
                </Button>
              </Link>
              <Link href={`/admin/exams/${exam.id}/questions`}>
                <Button variant="secondary" size="sm">
                  <ClipboardList className="size-3.5" aria-hidden /> Kelola soal
                </Button>
              </Link>
              <Link href={`/u/${exam.code}`} target="_blank" rel="noreferrer">
                <Button variant="ghost" size="sm">
                  <Eye className="size-3.5" aria-hidden /> Lihat sebagai peserta
                </Button>
              </Link>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Isi ujian">
            <dl className="space-y-2 text-[12.5px]">
              {[
                { label: "Jumlah soal", value: `${stats.questionCount} soal`, icon: FileStack },
                { label: "Total poin", value: `${stats.totalPoints} poin`, icon: ClipboardList },
                { label: "Pilihan ganda", value: `${stats.mcqSingle} soal`, icon: ClipboardList },
                { label: "Banyak jawaban", value: `${stats.mcqMultiple} soal`, icon: ClipboardList },
                { label: "Benar/Salah", value: `${stats.trueFalse} soal`, icon: ClipboardList },
                { label: "Esai", value: `${stats.essay} soal`, icon: ClipboardList },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-1.5 text-muted">
                    <row.icon className="size-3.5 text-navy-600" aria-hidden /> {row.label}
                  </dt>
                  <dd className="font-heading font-bold text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>

            {hasAttempts && (
              <div className="mt-3 rounded-field border border-accent-200 bg-accent-50 px-3 py-2">
                <p className="flex items-center gap-1.5 font-heading text-[12px] font-bold text-accent-900">
                  <Lock className="size-3.5" aria-hidden /> Soal terkunci
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-accent-900">
                  Sudah ada {stats.attemptCount} percobaan. Isi soal tidak bisa diubah lagi supaya
                  nilai peserta tetap adil.
                </p>
              </div>
            )}

            {/*
              Teks bacaan dan gambar dihitung terpisah. Sebelumnya keduanya
              berada dalam satu blok yang hanya tampil bila `withPassage > 0`,
              sehingga paket yang punya gambar tetapi tanpa teks bacaan (semua
              paket Matematika) tidak pernah menampilkan jumlah gambarnya.
            */}
            {(stats.withPassage > 0 || stats.withImage > 0) && (
              <p className="mt-3 text-[12px] leading-relaxed text-muted">
                {[
                  stats.withPassage > 0 ? `${stats.withPassage} soal punya teks bacaan` : null,
                  stats.withImage > 0 ? `${stats.withImage} soal bergambar` : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
                .
              </p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
