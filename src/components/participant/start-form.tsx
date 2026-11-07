"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { resumeAttempt, startAttempt } from "@/features/attempts/actions";
import type { PublicExam } from "@/features/exams/types";

/**
 * Formulir mulai/lanjutkan ujian (T5.3, T5.4).
 *
 * Semua keputusan ada di server: nama sudah dipakai, kuota percobaan habis,
 * ujian belum dibuka, Kode Lanjut salah. Komponen ini hanya mengumpulkan
 * masukan, memanggil Server Action, dan menampilkan pesan yang dikembalikan.
 *
 * Pemeriksaan di klien (`name.trim().length < 2`, kelas wajib) tetap ada supaya
 * peserta tidak menunggu perjalanan jaringan untuk kesalahan yang jelas — tetapi
 * itu kenyamanan, bukan pengaman: server memvalidasi ulang semuanya.
 *
 * Tidak ada lagi yang ditulis ke `localStorage`. Identitas peserta sekarang
 * hidup di cookie `httpOnly` yang dipasang Server Action, sehingga nama yang
 * tampil di layar tidak bisa diubah lewat DevTools.
 */
export function StartForm({ exam }: { exam: PublicExam }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [className, setClassName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [resumeOpen, setResumeOpen] = React.useState(false);
  const [resumeCode, setResumeCode] = React.useState("");
  const [resumeError, setResumeError] = React.useState<string | null>(null);
  const [resumePending, setResumePending] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (name.trim().length < 2) {
      setError("Nama minimal 2 karakter.");
      return;
    }
    if (exam.askClass && className.trim().length < 1) {
      setError("Kelas wajib diisi untuk ujian ini.");
      return;
    }

    setError(null);
    setPending(true);

    const result = await startAttempt({ code: exam.code, name, className });
    setPending(false);

    if (!result.ok) {
      setError(result.error.message);
      // `NAME_IN_USE` bisa ditindaklanjuti dengan Kode Lanjut, jadi tawarkan
      // langsung alih-alih membiarkan peserta menebak langkah berikutnya.
      if (result.error.code === "NAME_IN_USE") setResumeOpen(true);
      return;
    }

    router.push(`/u/${result.data.code}/kerjakan`);
  };

  const resume = async () => {
    const code = resumeCode.trim().toUpperCase();
    if (code.length < 4) {
      setResumeError("Kode Lanjut terdiri dari 6 karakter.");
      return;
    }
    if (name.trim().length < 2) {
      setResumeError("Isi nama lengkapmu dulu di form utama.");
      return;
    }

    setResumeError(null);
    setResumePending(true);

    const result = await resumeAttempt({ code: exam.code, name, resumeCode: code });
    setResumePending(false);

    if (!result.ok) {
      setResumeError(result.error.message);
      return;
    }

    setResumeOpen(false);
    router.push(`/u/${result.data.code}/kerjakan`);
  };

  return (
    <>
      <div className="rounded-card border border-line bg-surface p-4 sm:p-5">
        <h2 className="font-heading text-[16px] font-bold text-ink">Isi data, lalu mulai</h2>
        <p className="mt-0.5 text-[12.5px] text-muted">
          Tidak perlu akun. Nama ini yang muncul di rekap gurumu.
        </p>

        <form onSubmit={submit} className="mt-4 space-y-3.5">
          <Field label="Nama lengkap" required htmlFor="nama" hint={`${name.length}/60`}>
            <Input
              id="nama"
              value={name}
              maxLength={60}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Nama lengkapmu"
              autoComplete="name"
            />
          </Field>

          {exam.askClass && (
            <Field label="Kelas" required htmlFor="kelas" hint="Sesuai daftar kelasmu">
              <Input
                id="kelas"
                value={className}
                maxLength={24}
                onChange={(e) => {
                  setClassName(e.target.value);
                  setError(null);
                }}
                placeholder="Mis. 7A"
              />
            </Field>
          )}

          {error && (
            <p
              role="alert"
              className="flex items-start gap-1.5 rounded-field bg-clay-50 px-2.5 py-2 text-[12.5px] font-medium text-clay-700"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          <Button type="submit" block size="lg" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Mulai ujian
          </Button>

          <p className="text-center text-[12px] leading-relaxed text-muted">
            Dengan menekan Mulai, kamu menyatakan mengerjakan sendiri tanpa bantuan.
          </p>
        </form>

        <div className="mt-4 border-t border-line pt-3.5">
          <button
            type="button"
            onClick={() => setResumeOpen(true)}
            className="press flex w-full items-center justify-between gap-2 rounded-field px-1 py-1 text-left hover:bg-line-soft"
          >
            <span>
              <span className="flex items-center gap-1.5 font-heading text-[13px] font-semibold text-ink">
                <KeyRound className="size-3.5" aria-hidden /> Sudah mulai sebelumnya?
              </span>
              <span className="mt-0.5 block text-[12px] text-muted">
                Lanjutkan pengerjaan di perangkat lain dengan Kode Lanjut 6 karakter.
              </span>
            </span>
            <ArrowRight className="size-3.5 shrink-0 text-muted" aria-hidden />
          </button>
        </div>
      </div>

      <Modal
        open={resumeOpen}
        onClose={() => setResumeOpen(false)}
        title="Lanjutkan ujian"
        description="Masukkan nama dan Kode Lanjut yang tampil di layar ujian."
        footer={
          <>
            <Button variant="secondary" onClick={() => setResumeOpen(false)}>
              Batal
            </Button>
            <Button onClick={resume} disabled={resumePending}>
              {resumePending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Lanjutkan
            </Button>
          </>
        }
      >
        <Field label="Nama lengkap" required htmlFor="resume-nama">
          <Input
            id="resume-nama"
            value={name}
            maxLength={60}
            onChange={(e) => {
              setName(e.target.value);
              setResumeError(null);
            }}
            placeholder="Sama seperti saat mulai"
            autoComplete="name"
          />
        </Field>

        <Field label="Kode Lanjut" htmlFor="resume" className="mt-3">
          <Input
            id="resume"
            value={resumeCode}
            onChange={(e) => {
              setResumeCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
              setResumeError(null);
            }}
            placeholder="6 karakter"
            className={cn(
              "h-14 text-center font-heading text-xl font-bold uppercase tracking-[0.3em]",
              resumeError && "border-clay-500",
            )}
            autoComplete="off"
          />
        </Field>

        {resumeError && (
          <p role="alert" className="mt-2 text-[12.5px] font-medium text-clay-600">
            {resumeError}
          </p>
        )}

        <p className="mt-3 rounded-field bg-line-soft px-3 py-2.5 text-[12px] leading-relaxed text-muted">
          Melanjutkan di sini akan menghentikan pengerjaan di perangkat lain. Waktu ujian tetap
          berjalan.
        </p>
      </Modal>
    </>
  );
}
