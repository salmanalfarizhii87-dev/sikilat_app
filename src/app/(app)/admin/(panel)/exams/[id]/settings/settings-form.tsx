"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/checkbox";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Panel } from "@/components/admin/ui";
import { updateExam } from "@/features/exams/actions";
import type { ExamDetail } from "@/features/exams/types";
import { formatDuration } from "@/lib/utils";

/**
 * Formulir pengaturan ujian (EXM-04, EXM-09).
 *
 * Sebelumnya halaman ini komponen klien yang mengisi dirinya dari `demoExam`,
 * dan tombol simpannya hanya memunculkan toast "belum tersambung ke server".
 * Tidak ada satu pun perubahan yang pernah sampai ke database.
 *
 * Sekarang nilai awal datang dari prop (dibaca Server Component lewat `getExam`),
 * dan simpan memanggil `updateExam`. `router.refresh()` setelah berhasil penting:
 * halaman ini Server Component, jadi tanpa itu angka di tab lain tetap yang lama.
 *
 * KKM sengaja boleh dikosongkan. `passingScore: null` berarti "tanpa KKM" dan
 * berbeda dari 0 yang berarti semua peserta lulus — karena itu input kosong
 * dikirim sebagai `null`, bukan `0`.
 */
export function ExamSettingsForm({ exam }: { exam: ExamDetail }) {
  const router = useRouter();
  const [saved, setSaved] = React.useState(() => ({
    title: exam.title,
    subjectLabel: exam.subjectLabel ?? "",
    description: exam.description ?? "",
    instructions: exam.instructions ?? "",
    durationMinutes: String(exam.durationMinutes),
    maxAttempts: String(exam.maxAttempts),
    // `null` → string kosong supaya kolom KKM benar-benar kosong, bukan "0".
    passingScore: exam.passingScore === null ? "" : String(exam.passingScore),
    askClass: exam.askClass,
    shuffleQuestions: exam.shuffleQuestions,
    shuffleOptions: exam.shuffleOptions,
    resultVisibility: exam.resultVisibility,
    resultRelease: exam.resultRelease,
    scorePolicy: exam.scorePolicy,
  }));

  const [draft, setDraft] = React.useState(saved);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /*
   * Pembanding adalah salinan nilai yang **terakhir tersimpan**, bukan prop.
   * Prop hanya berubah setelah Server Component dirender ulang, dan memakai prop
   * membuat tombol Simpan tetap aktif sesudah menyimpan — admin lalu menyimpan
   * hal yang sama berulang kali tanpa tahu apakah yang pertama berhasil.
   */
  const dirty = (Object.keys(saved) as (keyof typeof saved)[]).some(
    (key) => draft[key] !== saved[key],
  );

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const save = async () => {
    setPending(true);
    setError(null);

    const result = await updateExam(exam.id, {
      title: draft.title,
      subjectLabel: draft.subjectLabel,
      description: draft.description,
      instructions: draft.instructions,
      durationMinutes: draft.durationMinutes,
      maxAttempts: draft.maxAttempts,
      passingScore: draft.passingScore,
      askClass: draft.askClass,
      shuffleQuestions: draft.shuffleQuestions,
      shuffleOptions: draft.shuffleOptions,
      resultVisibility: draft.resultVisibility,
      resultRelease: draft.resultRelease,
      scorePolicy: draft.scorePolicy,
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error.message);
      toast.error(result.error.message);
      return;
    }

    setSaved(draft);
    toast.success("Pengaturan disimpan.");
    router.refresh();
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="md" onClick={save} disabled={!dirty || pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {pending ? "Menyimpan…" : "Simpan perubahan"}
        </Button>
        {!dirty && !pending && (
          <span className="text-[12.5px] text-muted">Belum ada perubahan.</span>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-field border border-clay-200 bg-clay-50 px-3 py-2 text-[12.5px] font-medium text-clay-700"
        >
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-4">
          <Panel title="Informasi ujian">
            <div className="space-y-3.5">
              <Field label="Judul ujian" required htmlFor="judul">
                <Input
                  id="judul"
                  value={draft.title}
                  maxLength={160}
                  onChange={(e) => set("title", e.target.value)}
                />
              </Field>
              <Field
                label="Mata pelajaran / kategori"
                htmlFor="mapel"
                hint="Tampil di halaman peserta dan rekap"
              >
                <Input
                  id="mapel"
                  value={draft.subjectLabel}
                  maxLength={80}
                  onChange={(e) => set("subjectLabel", e.target.value)}
                />
              </Field>
              <Field label="Deskripsi" htmlFor="deskripsi">
                <Textarea
                  id="deskripsi"
                  value={draft.description}
                  maxLength={1000}
                  onChange={(e) => set("description", e.target.value)}
                  className="min-h-20"
                />
              </Field>
              <Field
                label="Instruksi pengerjaan"
                htmlFor="instruksi"
                hint="Ditampilkan sebelum peserta mulai"
              >
                <Textarea
                  id="instruksi"
                  value={draft.instructions}
                  maxLength={4000}
                  onChange={(e) => set("instructions", e.target.value)}
                  className="min-h-24"
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Durasi dan percobaan">
            <div className="space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Durasi (menit)" htmlFor="durasi">
                  <Input
                    id="durasi"
                    type="number"
                    min={1}
                    max={1440}
                    value={draft.durationMinutes}
                    onChange={(e) => set("durationMinutes", e.target.value)}
                  />
                </Field>
                <Field label="Maks percobaan per nama" htmlFor="percobaan">
                  <Select
                    id="percobaan"
                    value={draft.maxAttempts}
                    onChange={(e) => set("maxAttempts", e.target.value)}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} kali
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <p className="rounded-field bg-line-soft px-3 py-2 text-[11.5px] leading-relaxed text-muted">
                Durasi saat ini{" "}
                <strong className="text-ink-soft">
                  {formatDuration((Number(draft.durationMinutes) || 0) * 60)}
                </strong>
                . Mengubah durasi hanya memengaruhi percobaan yang dimulai setelah perubahan —
                percobaan yang sedang berjalan tetap memakai batas waktu lamanya.
              </p>
            </div>
          </Panel>

          <Panel title="Penilaian dan hasil">
            <div className="space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="KKM"
                  htmlFor="kkm"
                  hint="Kosongkan bila ujian ini tanpa nilai minimum"
                >
                  <Input
                    id="kkm"
                    type="number"
                    min={0}
                    max={100}
                    value={draft.passingScore}
                    placeholder="Tanpa KKM"
                    onChange={(e) => set("passingScore", e.target.value)}
                  />
                </Field>
                <Field label="Kebijakan nilai akhir" htmlFor="kebijakan">
                  <Select
                    id="kebijakan"
                    value={draft.scorePolicy}
                    onChange={(e) => set("scorePolicy", e.target.value as typeof draft.scorePolicy)}
                  >
                    <option value="highest">Nilai tertinggi</option>
                    <option value="latest">Nilai terakhir</option>
                    <option value="first">Nilai pertama</option>
                    <option value="average">Rata-rata</option>
                  </Select>
                </Field>
              </div>
              <Field label="Yang dilihat peserta di halaman hasil" htmlFor="visibilitas">
                <Select
                  id="visibilitas"
                  value={draft.resultVisibility}
                  onChange={(e) =>
                    set("resultVisibility", e.target.value as typeof draft.resultVisibility)
                  }
                >
                  <option value="score_and_review">Skor dan pembahasan</option>
                  <option value="score_only">Skor saja</option>
                  <option value="hidden">Sembunyikan</option>
                </Select>
              </Field>
              <Field label="Kapan hasil dirilis" htmlFor="rilis">
                <Select
                  id="rilis"
                  value={draft.resultRelease}
                  onChange={(e) => set("resultRelease", e.target.value as typeof draft.resultRelease)}
                >
                  <option value="instant">Langsung setelah dikumpulkan</option>
                  <option value="after_close">Setelah ujian ditutup</option>
                  <option value="manual">Manual oleh guru</option>
                </Select>
              </Field>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Aturan pengerjaan">
            <div className="space-y-3.5">
              <Switch
                checked={draft.askClass}
                onChange={(v) => set("askClass", v)}
                label="Minta isian kelas"
                description="Peserta wajib mengisi kelas sebelum mulai."
              />
              <div className="h-px bg-line" />
              <Switch
                checked={draft.shuffleQuestions}
                onChange={(v) => set("shuffleQuestions", v)}
                label="Acak urutan soal"
                description="Urutan diacak per peserta dan disimpan di attempt."
              />
              <div className="h-px bg-line" />
              <Switch
                checked={draft.shuffleOptions}
                onChange={(v) => set("shuffleOptions", v)}
                label="Acak urutan opsi"
                description="Berlaku untuk soal pilihan ganda."
              />
            </div>
          </Panel>

          <Panel title="Jadwal">
            {/*
              Jadwal diubah dari panel aksi di header (Buka sekarang / Tutup
              sekarang / Perpanjang), bukan dari kolom tanggal di sini. Dua jalur
              untuk hal yang sama akan membuat admin tidak tahu mana yang menang.
            */}
            <dl className="space-y-2 text-[12.5px]">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted">Dibuka</dt>
                <dd className="font-heading font-bold text-ink">
                  {exam.opensAt
                    ? new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Jakarta",
                      }).format(new Date(exam.opensAt))
                    : "Buka manual"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted">Ditutup</dt>
                <dd className="font-heading font-bold text-ink">
                  {exam.closesAt
                    ? new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Jakarta",
                      }).format(new Date(exam.closesAt))
                    : "Tutup manual"}
                </dd>
              </div>
            </dl>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted">
              Gunakan tombol Buka sekarang, Tutup sekarang, atau Perpanjang di bagian atas halaman
              untuk mengubah jadwal.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
