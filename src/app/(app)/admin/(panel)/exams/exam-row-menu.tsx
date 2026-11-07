"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Copy,
  Loader2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input } from "@/components/ui/field";
import { archiveExam, deleteExam, duplicateExam, unarchiveExam } from "@/features/exams/actions";

/**
 * Menu aksi cepat per ujian (T3.5) + hapus permanen dengan konfirmasi judul
 * (T3.8).
 *
 * Setiap aksi:
 * 1. menutup menu lebih dulu supaya tidak ada menu menggantung saat dialog muncul,
 * 2. memanggil Server Action,
 * 3. menampilkan hasil dari `ActionResult` apa adanya,
 * 4. `router.refresh()` agar Server Component memuat ulang data dari database.
 *
 * `router.refresh()` — bukan `invalidateQueries` — karena halaman daftar ini
 * Server Component yang membaca langsung dari Supabase; tidak ada cache klien
 * yang perlu dibatalkan. Server Action juga sudah memanggil `revalidatePath`,
 * tetapi `refresh()` yang membuat peramban benar-benar meminta render baru.
 */
export function ExamRowMenu({
  examId,
  code,
  title,
  status,
  attemptCount,
}: {
  examId: string;
  code: string;
  title: string;
  status: "draft" | "published" | "archived";
  attemptCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");

  /** Judul harus cocok persis untuk mengaktifkan tombol hapus. */
  const titleMatches =
    typed.trim().toLowerCase().replace(/\s+/g, " ") ===
    title.trim().toLowerCase().replace(/\s+/g, " ");

  async function run(
    key: string,
    action: () => Promise<{ ok: boolean; error?: { message: string } }>,
    successMessage: string,
  ) {
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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/u/${code}`);
      toast.success("Tautan peserta disalin");
    } catch {
      toast.error("Gagal menyalin. Salin manual ya.");
    }
    setOpen(false);
  };

  const onDuplicate = async () => {
    setOpen(false);
    const result = await duplicateExam(examId);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`Duplikat dibuat sebagai draft dengan kode ${result.data.code}.`);
    router.refresh();
  };

  const onArchive = async () => {
    setOpen(false);
    await run(
      "archive",
      () => (status === "archived" ? unarchiveExam(examId) : archiveExam(examId)),
      status === "archived"
        ? "Ujian dikeluarkan dari arsip dan menjadi draft."
        : "Ujian diarsipkan. Nilai peserta tetap tersimpan.",
    );
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Aksi lain untuk ${title}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className="press grid size-11 place-items-center rounded-field text-muted hover:bg-line-soft"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <MoreHorizontal className="size-4" aria-hidden />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="animate-rise absolute right-0 top-11 z-20 w-56 overflow-hidden rounded-card border border-line bg-surface py-1 shadow-pop"
          >
            <MenuItem icon={<Copy className="size-3.5" aria-hidden />} label="Salin tautan peserta" onClick={copyLink} />
            <MenuItem
              icon={<Copy className="size-3.5" aria-hidden />}
              label="Duplikat ujian"
              onClick={onDuplicate}
            />
            <MenuItem
              icon={
                status === "archived" ? (
                  <ArchiveRestore className="size-3.5" aria-hidden />
                ) : (
                  <Archive className="size-3.5" aria-hidden />
                )
              }
              label={status === "archived" ? "Keluarkan dari arsip" : "Arsipkan"}
              onClick={onArchive}
            />
            {/*
             * Hapus permanen hanya muncul untuk ujian arsip tanpa attempt.
             * Menyembunyikannya lebih jujur daripada menampilkan tombol yang
             * pasti ditolak server: EXM-13 mengizinkan hapus hanya untuk arsip,
             * dan nilai peserta tidak boleh hilang.
             */}
            {status === "archived" && attemptCount === 0 && (
              <MenuItem
                icon={<Trash2 className="size-3.5" aria-hidden />}
                label="Hapus permanen"
                danger
                onClick={() => {
                  setOpen(false);
                  setTyped("");
                  setDeleteOpen(true);
                }}
              />
            )}
          </div>
        </>
      )}

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
                const okDone = await run(
                  "delete",
                  () => deleteExam(examId, typed),
                  "Ujian dihapus permanen.",
                );
                if (okDone) setDeleteOpen(false);
              }}
            >
              {pending === "delete" ? "Menghapus…" : "Hapus permanen"}
            </Button>
          </>
        }
      >
        <Field
          label="Ketik judul ujian untuk mengonfirmasi"
          hint={titleMatches ? "Cocok" : undefined}
        >
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

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={
        danger
          ? "flex min-h-11 w-full items-center gap-2 px-3 text-left font-heading text-[12.5px] font-semibold text-clay-600 hover:bg-clay-50"
          : "flex min-h-11 w-full items-center gap-2 px-3 text-left font-heading text-[12.5px] font-semibold text-ink-soft hover:bg-line-soft"
      }
    >
      {icon}
      {label}
    </button>
  );
}
