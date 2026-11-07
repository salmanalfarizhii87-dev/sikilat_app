"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Archive, ArrowLeft, Pause, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/checkbox";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ExamTabs } from "@/components/admin/exam-tabs";
import { demoExam } from "@/lib/mock-data";
import { formatDuration } from "@/lib/utils";

/** Semua aksi simpan di halaman ini butuh server; toast menyebut itu apa adanya. */
const OFFLINE = "Belum tersambung ke server. Tidak ada yang berubah.";

export default function ExamSettingsPage({ params }: PageProps<"/admin/exams/[id]">) {
  const { id } = React.use(params);
  const [draft, setDraft] = React.useState({
    title: demoExam.title,
    subject: demoExam.subjectLabel,
    description: demoExam.description ?? "",
    instructions: demoExam.instructions,
    durationMinutes: demoExam.durationMinutes,
    maxAttempts: demoExam.maxAttempts,
    passingScore: demoExam.passingScore,
    askClass: demoExam.askClass,
    shuffleQuestions: demoExam.shuffleQuestions,
    shuffleOptions: demoExam.shuffleOptions,
    resultVisibility: demoExam.resultVisibility,
    resultRelease: demoExam.resultRelease,
    scorePolicy: demoExam.scorePolicy,
    openMode: "manual" as "manual" | "scheduled",
    opensAt: "",
    closesAt: "",
  });
  const [dirty, setDirty] = React.useState(false);

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  return (
    <>
      <PageHeader
        title="Pengaturan ujian"
        description="Judul, jadwal, dan aturan pengerjaan masih bisa diubah walau soal sudah terkunci."
        actions={
          <Button
            size="md"
            disabled={!dirty}
            onClick={() => {
              setDirty(false);
              toast("Belum tersambung ke server. Perubahan hanya bertahan di halaman ini.");
            }}
          >
            <Save className="size-4" aria-hidden /> Simpan perubahan
          </Button>
        }
      >
        <p className="mt-2 text-[12.5px] text-muted">
          {demoExam.subjectLabel} · {demoExam.code}
        </p>
      </PageHeader>

      <ExamTabs examId={id} />

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-4">
          <Panel title="Informasi ujian">
            <div className="space-y-3.5">
              <Field label="Judul ujian" required>
                <Input value={draft.title} onChange={(e) => set("title", e.target.value)} />
              </Field>
              <Field label="Mata pelajaran / kategori">
                <Input value={draft.subject} onChange={(e) => set("subject", e.target.value)} />
              </Field>
              <Field label="Deskripsi">
                <Textarea
                  value={draft.description}
                  onChange={(e) => set("description", e.target.value)}
                  className="min-h-20"
                />
              </Field>
              <Field label="Instruksi pengerjaan">
                <Textarea
                  value={draft.instructions}
                  onChange={(e) => set("instructions", e.target.value)}
                  className="min-h-24"
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Jadwal dan durasi">
            <div className="space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Durasi (menit)">
                  <Input
                    type="number"
                    min={5}
                    value={draft.durationMinutes}
                    onChange={(e) => set("durationMinutes", Number(e.target.value) || 0)}
                  />
                </Field>
                <Field label="Maks percobaan">
                  <Select
                    value={String(draft.maxAttempts)}
                    onChange={(e) => set("maxAttempts", Number(e.target.value))}
                  >
                    <option value="1">1 kali</option>
                    <option value="2">2 kali</option>
                    <option value="3">3 kali</option>
                    <option value="5">5 kali</option>
                  </Select>
                </Field>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["manual", "Buka manual"],
                    ["scheduled", "Terjadwal"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set("openMode", key)}
                    className={
                      draft.openMode === key
                        ? "press flex min-h-11 items-center rounded-field border border-navy-800 bg-accent-50 px-3 py-2 text-left font-heading text-[12.5px] font-bold text-ink ring-1 ring-navy-800"
                        : "press flex min-h-11 items-center rounded-field border border-line bg-surface px-3 py-2 text-left font-heading text-[12.5px] font-semibold text-ink-soft hover:bg-line-soft"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              {draft.openMode === "scheduled" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Dibuka pada">
                    <Input
                      type="datetime-local"
                      value={draft.opensAt}
                      onChange={(e) => set("opensAt", e.target.value)}
                    />
                  </Field>
                  <Field label="Ditutup pada">
                    <Input
                      type="datetime-local"
                      value={draft.closesAt}
                      onChange={(e) => set("closesAt", e.target.value)}
                    />
                  </Field>
                </div>
              )}

              <p className="rounded-field bg-line-soft px-3 py-2 text-[11.5px] leading-relaxed text-muted">
                Durasi saat ini: <strong>{formatDuration(draft.durationMinutes * 60)}</strong>.
                Mengubah durasi hanya memengaruhi percobaan yang dimulai setelah perubahan.
              </p>
            </div>
          </Panel>

          <Panel title="Penilaian dan hasil">
            <div className="space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="KKM">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={draft.passingScore}
                    onChange={(e) => set("passingScore", Number(e.target.value) || 0)}
                  />
                </Field>
                <Field label="Kebijakan nilai">
                  <Select
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
              <Field label="Visibilitas hasil">
                <Select
                  value={draft.resultVisibility}
                  onChange={(e) => set("resultVisibility", e.target.value as typeof draft.resultVisibility)}
                >
                  <option value="score_and_review">Skor dan pembahasan</option>
                  <option value="score_only">Skor saja</option>
                  <option value="hidden">Sembunyikan</option>
                </Select>
              </Field>
              <Field label="Waktu rilis hasil">
                <Select
                  value={draft.resultRelease}
                  onChange={(e) => set("resultRelease", e.target.value as typeof draft.resultRelease)}
                >
                  <option value="instant">Langsung</option>
                  <option value="after_close">Setelah ujian ditutup</option>
                  <option value="manual">Manual</option>
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
                description="Peserta wajib mengisi kelas."
              />
              <div className="h-px bg-line" />
              <Switch
                checked={draft.shuffleQuestions}
                onChange={(v) => set("shuffleQuestions", v)}
                label="Acak urutan soal"
              />
              <div className="h-px bg-line" />
              <Switch
                checked={draft.shuffleOptions}
                onChange={(v) => set("shuffleOptions", v)}
                label="Acak urutan opsi"
              />
            </div>
          </Panel>

          <Panel title="Status ujian">
            <div className="space-y-2">
              <Button block variant="secondary" onClick={() => toast(OFFLINE)}>
                <Pause className="size-4" aria-hidden /> Tutup sekarang
              </Button>
              <Button block variant="secondary" onClick={() => toast(OFFLINE)}>
                <Archive className="size-4" aria-hidden /> Arsipkan
              </Button>
            </div>
          </Panel>

          <div className="rounded-card border border-clay-200 bg-clay-50 p-4">
            <p className="flex items-center gap-1.5 font-heading text-[12.5px] font-bold text-clay-700">
              <AlertTriangle className="size-4" /> Hapus ujian
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-clay-700">
              Semua soal dan percobaan peserta akan terhapus permanen. Tindakan ini tidak bisa
              dibatalkan.
            </p>
            <Button
              size="sm"
              variant="danger"
              className="mt-2.5"
              onClick={() => toast.error("Mode demo: penghapusan dinonaktifkan.")}
            >
              <Trash2 className="size-3.5" /> Hapus ujian
            </Button>
          </div>

          <Link
            href={`/admin/exams/${id}`}
            className="press inline-flex items-center gap-1.5 rounded-field px-2 py-1.5 text-[12.5px] font-semibold text-muted hover:bg-line-soft hover:text-ink"
          >
            <ArrowLeft className="size-3.5" aria-hidden /> Kembali ke ringkasan
          </Link>
        </div>
      </div>
    </>
  );
}
