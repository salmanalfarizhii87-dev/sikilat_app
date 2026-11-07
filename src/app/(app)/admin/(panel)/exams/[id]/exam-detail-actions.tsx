"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  CalendarPlus,
  Copy,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input } from "@/components/ui/field";
import {
  archiveExam,
  closeExamNow,
  deleteExam,
  duplicateExam,
  extendCloseTime,
  openExamNow,
  regenerateExamCode,
  unarchiveExam,
} from "@/features/exams/actions";

type Phase = "draft" | "scheduled" | "open" | "closed" | "archived";

/**
 * Aksi pada halaman ringkasan ujian (T3.6, T3.7, T3.8).
 *
 * Semua aksi di sini mengubah data di server dan **setiap** yang berisiko
 * meminta konfirmasi lebih dulu. Yang tidak berisiko (salin kode) langsung.
 *
 * `router.refresh()` dipanggil setelah berhasil karena halaman ini Server
 * Component yang membaca langsung dari database; tanpa refresh, angka dan
 * status di layar tetap yang lama meski Server Action sudah menulis.
 */
export function ExamDetailActions({
  examId,
  code,
  title,
  status,
  phase,
  hasAttempts,
  variant = "header",
}: {
  examId: string;
  code: string;
  title: string;
  status: "draft" | "published" | "archived";
  phase: Phase;
  hasAttempts: boolean;
  /** `header` = tombol utama; `regenerate` = tombol kecil di panel kode. */
  variant?: "header" | "regenerate";
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  const [extendOpen, setExtendOpen] = React.useState(false);
  const [minutes, setMinutes] = React.useState("30");

  const [regenOpen, setRegenOpen] = React.useState(false);

  const [archiveOpen, setArchiveOpen] = React.useState(false);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");

  /** Jalankan aksi, tampilkan hasilnya apa adanya, lalu muat ulang data. */
  async function run(
    key: string,
    action: () => Promise<{ ok: boolean; error?: { message: string } }>,
    successMessage: string,
  ): Promise<boolean> {
    setPending(key);
    const result = await action();
    setPending(null);

    if (!result.ok) {
      toast.error(result.error?.message ?? "Gagal menyimpan perubahan.");
      return false;
    }

    toast.success(successMessage);
    router.refresh();
    return true;
  }

  const titleMatches =
    typed.trim().toLowerCase().replace(/\s+/g, " ") ===
    title.trim().toLowerCase().replace(/\s+/g, " ");

  /* ---- Ganti kode (EXM-12) ---- */
  if (variant === "regenerate") {
    return (
      <>
        <button
          type="button"
          onClick={() => setRegenOpen(true)}
          className="press inline-flex h-11 items-center gap-1.5 rounded-field px-2.5 font-heading text-[12px] font-semibold text-muted hover:bg-line-soft"
        >
          <RefreshCw className="size-3.5" aria-hidden /> Buat kode baru
        </button>

        <Modal
          open={regenOpen}
          onClose={() => setRegenOpen(false)}
          size="sm"
          title="Buat kode ujian baru?"
          description={
            <>
              Kode <strong className="font-semibold text-ink">{code}</strong> langsung tidak berlaku.
              Tautan lama tidak bisa dipakai lagi untuk masuk.
            </>
          }
          icon={
            <span className="grid size-9 place-items-center rounded-xs bg-accent-100 text-accent-900">
              <RefreshCw className="size-4" aria-hidden />
            </span>
          }
          footer={
            <>
              <Button variant="secondary" onClick={() => setRegenOpen(false)}>
                Batal
              </Button>
              <Button
                disabled={pending === "regen"}
                onClick={async () => {
                  const done = await run(
                    "regen",
                    () => regenerateExamCode(examId),
                    "Kode ujian diganti.",
                  );
                  if (done) setRegenOpen(false);
                }}
              >
                {pending === "regen" ? "Membuat…" : "Buat kode baru"}
              </Button>
            </>
          }
        >
          <p className="text-[12.5px] leading-relaxed text-muted">
            Peserta yang sedang mengerjakan tidak terputus — mereka melanjutkan dengan Kode Lanjut
            masing-masing.
          </p>
        </Modal>
      </>
    );
  }

  /* ---- Tombol header ---- */
  const isOpen = phase === "open";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "archived" ? (
        <Button
          variant="secondary"
          size="md"
          disabled={pending === "unarchive"}
          onClick={() =>
            run("unarchive", () => unarchiveExam(examId), "Ujian dikeluarkan dari arsip sebagai draft.")
          }
        >
          {pending === "unarchive" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ArchiveRestore className="size-4" aria-hidden />
          )}
          Keluarkan dari arsip
        </Button>
      ) : isOpen ? (
        <Button
          variant="secondary"
          size="md"
          disabled={pending === "close"}
          onClick={() => run("close", () => closeExamNow(examId), "Ujian ditutup sekarang.")}
        >
          {pending === "close" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Pause className="size-4" aria-hidden />
          )}
          Tutup sekarang
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="md"
          disabled={pending === "open"}
          onClick={() => run("open", () => openExamNow(examId), "Ujian dibuka sekarang.")}
        >
          {pending === "open" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Play className="size-4" aria-hidden />
          )}
          Buka sekarang
        </Button>
      )}

      {phase === "open" && (
        <Button variant="secondary" size="md" onClick={() => setExtendOpen(true)}>
          <CalendarPlus className="size-4" aria-hidden /> Perpanjang
        </Button>
      )}

      <Link href={`/admin/exams/${examId}/questions`}>
        <Button size="md">Kelola soal</Button>
      </Link>

      <details className="relative">
        <summary className="press inline-flex h-11 cursor-pointer list-none items-center gap-1.5 rounded-field border border-line bg-surface px-3 font-heading text-[12.5px] font-semibold text-ink-soft hover:bg-line-soft">
          Lainnya
        </summary>
        <div className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-card border border-line bg-surface py-1 shadow-pop">
          <button
            type="button"
            onClick={async () => {
              const result = await duplicateExam(examId);
              if (!result.ok) {
                toast.error(result.error.message);
                return;
              }
              toast.success(`Duplikat dibuat sebagai draft dengan kode ${result.data.code}.`);
              router.push(`/admin/exams/${result.data.examId}`);
            }}
            className="flex min-h-11 w-full items-center gap-2 px-3 text-left font-heading text-[12.5px] font-semibold text-ink-soft hover:bg-line-soft"
          >
            <Copy className="size-3.5" aria-hidden /> Duplikat ujian
          </button>

          {status !== "archived" && (
            <button
              type="button"
              onClick={() => setArchiveOpen(true)}
              className="flex min-h-11 w-full items-center gap-2 px-3 text-left font-heading text-[12.5px] font-semibold text-ink-soft hover:bg-line-soft"
            >
              <Archive className="size-3.5" aria-hidden /> Arsipkan
            </button>
          )}

          {status === "archived" && !hasAttempts && (
            <button
              type="button"
              onClick={() => {
                setTyped("");
                setDeleteOpen(true);
              }}
              className="flex min-h-11 w-full items-center gap-2 px-3 text-left font-heading text-[12.5px] font-semibold text-clay-600 hover:bg-clay-50"
            >
              <Trash2 className="size-3.5" aria-hidden /> Hapus permanen
            </button>
          )}
        </div>
      </details>

      {/* ---- Perpanjang waktu (EXM-03) ---- */}
      <Modal
        open={extendOpen}
        onClose={() => setExtendOpen(false)}
        size="sm"
        title="Perpanjang waktu ujian"
        description="Menambah waktu tutup dari jadwal yang berlaku sekarang, bukan dari waktu saat ini."
        footer={
          <>
            <Button variant="secondary" onClick={() => setExtendOpen(false)}>
              Batal
            </Button>
            <Button
              disabled={pending === "extend"}
              onClick={async () => {
                const done = await run(
                  "extend",
                  () => extendCloseTime(examId, Number(minutes)),
                  "Waktu tutup diperpanjang.",
                );
                if (done) setExtendOpen(false);
              }}
            >
              {pending === "extend" ? "Menyimpan…" : "Perpanjang"}
            </Button>
          </>
        }
      >
        <Field label="Tambahan waktu (menit)" hint="Antara 1 dan 720 menit.">
          <Input
            type="number"
            min={1}
            max={720}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </Field>
      </Modal>

      {/* ---- Arsipkan (EXM-13) ---- */}
      <Modal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        size="sm"
        title="Arsipkan ujian?"
        description={
          <>
            <strong className="font-semibold text-ink">{title}</strong> tidak akan bisa diakses
            peserta lagi. Nilai yang sudah ada tetap tersimpan dan ujian bisa dikembalikan.
          </>
        }
        icon={
          <span className="grid size-9 place-items-center rounded-xs bg-line-soft text-ink-soft">
            <Archive className="size-4" aria-hidden />
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setArchiveOpen(false)}>
              Batal
            </Button>
            <Button
              disabled={pending === "archive"}
              onClick={async () => {
                const done = await run(
                  "archive",
                  () => archiveExam(examId),
                  "Ujian diarsipkan. Nilai peserta tetap tersimpan.",
                );
                if (done) setArchiveOpen(false);
              }}
            >
              {pending === "archive" ? "Mengarsipkan…" : "Arsipkan"}
            </Button>
          </>
        }
      />

      {/* ---- Hapus permanen (T3.8) ---- */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        size="sm"
        title="Hapus ujian permanen?"
        description={
          <>
            Ujian <strong className="font-semibold text-ink">{title}</strong> beserta semua soalnya
            akan dihapus dan tidak bisa dikembalikan.
          </>
        }
        icon={
          <span className="grid size-9 place-items-center rounded-xs bg-clay-50 text-clay-600">
            <Trash2 className="size-4" aria-hidden />
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Batal
            </Button>
            <Button
              variant="danger"
              disabled={!titleMatches || pending === "delete"}
              onClick={async () => {
                const done = await run(
                  "delete",
                  () => deleteExam(examId, typed),
                  "Ujian dihapus permanen.",
                );
                if (done) {
                  setDeleteOpen(false);
                  router.push("/admin/exams");
                }
              }}
            >
              {pending === "delete" ? "Menghapus…" : "Hapus permanen"}
            </Button>
          </>
        }
      >
        <Field label="Ketik judul ujian untuk mengonfirmasi" hint={titleMatches ? "Cocok" : undefined}>
          <Input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={title}
            autoComplete="off"
          />
        </Field>
      </Modal>
    </div>
  );
}
