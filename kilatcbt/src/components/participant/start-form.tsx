"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { Exam } from "@/lib/types";

export function StartForm({ exam }: { exam: Exam }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [className, setClassName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [resumeOpen, setResumeOpen] = React.useState(false);
  const [resumeCode, setResumeCode] = React.useState("");
  const [resumeError, setResumeError] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
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
    try {
      window.localStorage.setItem(
        "kilat_participant",
        JSON.stringify({ name: name.trim(), className: className.trim() }),
      );
    } catch {
      // penyimpanan diblokir: attempt tetap bisa dibuat di halaman berikutnya
    }
    router.push(`/u/${exam.code}/kerjakan`);
  };

  /**
   * Di mode demo attempt hanya hidup di localStorage perangkat ini. Karena itu
   * kode diverifikasi terhadap attempt yang benar-benar tersimpan di sini,
   * bukan diterima apa adanya. Setelah backend terpasang, pemeriksaan pindah
   * ke server dan kode yang sama bisa dipakai dari perangkat lain.
   */
  const resume = () => {
    const code = resumeCode.trim().toUpperCase();
    if (code.length !== 6) {
      setResumeError("Kode Lanjut terdiri dari 6 karakter.");
      return;
    }
    let saved: { attempt?: { examId?: string; resumeCode?: string } } | null = null;
    try {
      const raw = window.localStorage.getItem("kilat_attempt_v1");
      saved = raw ? (JSON.parse(raw) as { attempt?: { examId?: string; resumeCode?: string } }) : null;
    } catch {
      saved = null;
    }
    const attempt = saved?.attempt;
    if (!attempt || attempt.examId !== exam.id) {
      setResumeError(
        "Tidak ada pengerjaan tersimpan di perangkat ini. Mulai ujian baru lewat form di atas.",
      );
      return;
    }
    if (attempt.resumeCode !== code) {
      setResumeError("Kode Lanjut tidak cocok dengan pengerjaan di perangkat ini.");
      return;
    }
    setResumeError(null);
    router.push(`/u/${exam.code}/kerjakan`);
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
              placeholder="Mis. Rina Kusuma"
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
                Lanjutkan pengerjaan di perangkat ini dengan Kode Lanjut 6 karakter.
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
        description="Masukkan Kode Lanjut yang tampil di layar ujian."
        footer={
          <>
            <Button variant="secondary" onClick={() => setResumeOpen(false)}>
              Batal
            </Button>
            <Button onClick={resume}>Lanjutkan</Button>
          </>
        }
      >
        <Field label="Kode Lanjut" htmlFor="resume">
          <Input
            id="resume"
            value={resumeCode}
            onChange={(e) => {
              setResumeCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
              setResumeError(null);
            }}
            placeholder="Contoh: K7M2QP"
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
          Di mode demo, pengerjaan hanya tersimpan di perangkat ini. Membuka di sini
          melanjutkan jawaban yang sudah ada, dan waktu ujian tetap berjalan.
        </p>
      </Modal>
    </>
  );
}
