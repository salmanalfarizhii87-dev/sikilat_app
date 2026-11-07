"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  CloudCheck,
  Copy,
  FileText,
  Info,
  ListChecks,
  Save,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox, Switch } from "@/components/ui/checkbox";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/primitives";
import { PageHeader, Panel } from "@/components/admin/ui";
import {
  QuestionEditor,
  questionFromModel,
  type DraftQuestion,
} from "@/components/admin/question-editor";
import { demoExam, demoQuestions } from "@/lib/mock-data";
import { useMounted, useOriginLabel } from "@/lib/client-hooks";

const DRAFT_KEY = "kilat_exam_draft_v1";

const STEPS = [
  { key: 0, label: "Info ujian", icon: FileText, hint: "Judul dan instruksi" },
  { key: 1, label: "Soal", icon: ListChecks, hint: "Tambah atau impor" },
  { key: 2, label: "Pengaturan", icon: Settings2, hint: "Waktu dan aturan" },
  { key: 3, label: "Periksa", icon: ClipboardList, hint: "Sebelum disimpan" },
] as const;

interface Draft {
  title: string;
  subject: string;
  description: string;
  instructions: string;
  questions: DraftQuestion[];
  durationMinutes: number;
  maxAttempts: number;
  passingScore: number;
  askClass: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  openMode: "manual" | "scheduled";
  opensAt: string;
  closesAt: string;
  resultVisibility: "hidden" | "score_only" | "score_and_review";
  resultRelease: "instant" | "after_close" | "manual";
  scorePolicy: "highest" | "latest" | "first" | "average";
}

function initialDraft(): Draft {
  return {
    title: "",
    subject: "",
    description: "",
    instructions:
      "Baca setiap soal dengan teliti. Kamu boleh melewati soal dan kembali lagi nanti. Jawaban tersimpan otomatis setiap kali kamu memilih opsi.",
    questions: [],
    durationMinutes: 60,
    maxAttempts: 1,
    passingScore: 70,
    askClass: true,
    shuffleQuestions: false,
    shuffleOptions: false,
    openMode: "manual",
    opensAt: "",
    closesAt: "",
    resultVisibility: "score_and_review",
    resultRelease: "instant",
    scorePolicy: "highest",
  };
}

function readDraft(): { draft: Draft; step: number } | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { draft?: Partial<Draft>; step?: number };
    if (!parsed?.draft) return null;
    return {
      draft: { ...initialDraft(), ...parsed.draft },
      step: Math.min(3, Math.max(0, parsed.step ?? 0)),
    };
  } catch {
    return null;
  }
}

export default function NewExamWizardPage() {
  const router = useRouter();
  const mounted = useMounted();
  // Dipulihkan sekali saat render klien pertama. Skeleton tampil sampai
  // `mounted` benar supaya SSR dan hidrasi menghasilkan markup yang sama.
  const [restored] = React.useState(() => (typeof window === "undefined" ? null : readDraft()));
  const [step, setStep] = React.useState(() => restored?.step ?? 0);
  const [draft, setDraft] = React.useState<Draft>(() => restored?.draft ?? initialDraft());
  const [savedAt, setSavedAt] = React.useState<string | null>(restored ? "sebelumnya" : null);
  const [finished, setFinished] = React.useState(false);
  const [showIssues, setShowIssues] = React.useState(false);

  React.useEffect(() => {
    if (!mounted || finished) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ draft, step }));
        setSavedAt(
          new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Jakarta",
          }),
        );
      } catch {
        // penyimpanan diblokir: draft tetap hidup di memori halaman
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [draft, step, mounted, finished]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const totalPoints = draft.questions.reduce((sum, q) => sum + q.points, 0);
  const essays = draft.questions.filter((q) => q.type === "essay").length;

  const issues = React.useMemo(() => {
    const list: { message: string; step: number }[] = [];
    if (!draft.title.trim()) list.push({ message: "Judul ujian belum diisi.", step: 0 });
    if (!draft.subject.trim()) list.push({ message: "Mata pelajaran belum diisi.", step: 0 });
    if (draft.questions.length === 0)
      list.push({ message: "Belum ada soal. Tambahkan minimal satu soal.", step: 1 });
    draft.questions.forEach((q, i) => {
      if (!q.body.trim())
        list.push({ message: `Soal ${i + 1}: pertanyaan masih kosong.`, step: 1 });
      if (q.type !== "essay") {
        if (q.options.length < 2)
          list.push({ message: `Soal ${i + 1}: minimal 2 opsi jawaban.`, step: 1 });
        if (q.correct.length === 0)
          list.push({ message: `Soal ${i + 1}: belum ada kunci jawaban.`, step: 1 });
      }
    });
    if (draft.durationMinutes < 5) list.push({ message: "Durasi minimal 5 menit.", step: 2 });
    if (draft.passingScore < 0 || draft.passingScore > 100)
      list.push({ message: "KKM harus di antara 0 dan 100.", step: 2 });
    if (draft.openMode === "scheduled" && (!draft.opensAt || !draft.closesAt))
      list.push({ message: "Jadwal buka dan tutup wajib diisi.", step: 2 });
    if (
      draft.openMode === "scheduled" &&
      draft.opensAt &&
      draft.closesAt &&
      draft.closesAt <= draft.opensAt
    )
      list.push({ message: "Waktu tutup harus setelah waktu buka.", step: 2 });
    return list;
  }, [draft]);

  const canNext =
    step === 0 ? draft.title.trim().length > 0 : step === 1 ? draft.questions.length > 0 : true;

  const next = () => {
    if (step === 0 && !draft.title.trim()) {
      toast.error("Isi judul ujian dulu.");
      return;
    }
    if (step === 1 && draft.questions.length === 0) {
      toast.error("Tambahkan minimal satu soal.");
      return;
    }
    setStep((s) => Math.min(3, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const finish = () => {
    if (issues.length > 0) {
      setShowIssues(true);
      toast.error("Masih ada yang perlu diperbaiki.");
      return;
    }
    setFinished(true);
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // noop
    }
  };

  if (finished) {
    return (
      <DraftDone
        title={draft.title}
        questionCount={draft.questions.length}
        totalPoints={totalPoints}
        onReset={() => {
          setFinished(false);
          setDraft(initialDraft());
          setStep(0);
          router.push("/admin/exams");
        }}
      />
    );
  }

  if (!mounted) {
    return (
      <div aria-busy="true" className="animate-fade">
        <div className="h-6 w-40 rounded-md bg-line-soft" />
        <div className="mt-2 h-4 w-72 rounded-md bg-line-soft/70" />
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.key} className="h-12 rounded-field border border-line bg-surface" />
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <div className="h-72 rounded-card border border-line bg-surface" />
          <div className="h-52 rounded-card border border-line bg-surface" />
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={draft.title.trim() || "Ujian baru"}
        description="Draft tersimpan otomatis di perangkat ini. Kamu bisa berhenti lalu melanjutkan kapan saja."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-leaf-200 bg-leaf-50 px-2.5 py-1 font-heading text-[11.5px] font-semibold text-leaf-800">
            <CloudCheck className="size-3.5" aria-hidden />
            {savedAt
              ? savedAt === "sebelumnya"
                ? "Draft dipulihkan"
                : `Tersimpan ${savedAt} WIB`
              : "Menyimpan"}
          </span>
        }
      />

      <ol className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((item) => {
          const state = item.key === step ? "current" : item.key < step ? "done" : "todo";
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => setStep(item.key)}
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "press flex w-full items-center gap-2 rounded-field border px-2.5 py-2 text-left transition-colors",
                  state === "current" && "border-navy-900 bg-navy-900 text-white",
                  state === "done" && "border-leaf-200 bg-leaf-50 text-leaf-900",
                  state === "todo" && "border-line bg-surface text-muted hover:bg-line-soft",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full font-heading text-[11px] font-bold",
                    state === "current" && "bg-accent-400 text-navy-900",
                    state === "done" && "bg-leaf-600 text-white",
                    state === "todo" && "bg-line-soft text-ink-soft",
                  )}
                >
                  {state === "done" ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : item.key + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-heading text-[12px] font-bold">
                    {item.label}
                  </span>
                  <span
                    className={cn(
                      "block truncate text-[11px]",
                      state === "current" ? "text-white/70" : "text-muted",
                    )}
                  >
                    {item.hint}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {step === 0 && (
        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <Panel title="Informasi dasar">
            <div className="space-y-3.5">
              <Field label="Judul ujian" required hint={`${draft.title.length}/120`}>
                <Input
                  value={draft.title}
                  maxLength={120}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Mis. Penilaian Tengah Semester Matematika"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Mata pelajaran atau kategori" required>
                  <Input
                    value={draft.subject}
                    onChange={(e) => set("subject", e.target.value)}
                    placeholder="Matematika, Kelas 7"
                  />
                </Field>
                <Field label="Durasi (menit)" required>
                  <Input
                    type="number"
                    min={5}
                    max={240}
                    value={draft.durationMinutes}
                    onChange={(e) => set("durationMinutes", Number(e.target.value) || 0)}
                  />
                </Field>
              </div>
              <Field label="Deskripsi singkat" hint="Tampil di halaman pra-ujian">
                <Textarea
                  value={draft.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Ujian untuk mengukur pemahaman bab aljabar dan perbandingan."
                  className="min-h-20"
                />
              </Field>
              <Field label="Instruksi pengerjaan">
                <Textarea
                  value={draft.instructions}
                  onChange={(e) => set("instructions", e.target.value)}
                  className="min-h-28"
                />
              </Field>
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel title="Pratinjau kartu ujian">
              <div className="rounded-field border border-line bg-canvas p-3.5">
                <Badge tone="neutral">Draft</Badge>
                <p className="mt-2 font-heading text-[15px] font-bold leading-snug text-ink">
                  {draft.title.trim() || "Judul ujian kamu"}
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  {draft.subject.trim() || "Mata pelajaran, Kelas"}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[
                    formatDuration(draft.durationMinutes * 60),
                    `${draft.questions.length} soal`,
                    `${totalPoints} poin`,
                    `KKM ${draft.passingScore}`,
                  ].map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-muted"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
              <p className="mt-2.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-muted">
                <Info className="mt-0.5 size-3.5 shrink-0 text-navy-600" aria-hidden />
                Kode ujian dibuat otomatis setelah ujian benar-benar disimpan ke server.
              </p>
            </Panel>

            <Panel title="Mulai cepat">
              <button
                type="button"
                onClick={() => {
                  setDraft((prev) => ({
                    ...prev,
                    title: "Ulangan Harian Matematika",
                    subject: "Matematika, Kelas 7",
                    description:
                      "Ulangan singkat untuk mengukur pemahaman operasi bilangan dan aljabar dasar.",
                    questions: demoQuestions.slice(0, 10).map(questionFromModel),
                  }));
                  toast.success("Sepuluh soal contoh dimuat");
                }}
                className="press flex w-full items-center gap-3 rounded-field border border-line bg-surface px-3 py-2.5 text-left hover:bg-line-soft"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-field bg-line-soft text-navy-700">
                  <ListChecks className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-heading text-[12.5px] font-bold text-ink">
                    Isi 10 soal contoh
                  </span>
                  <span className="block text-[11.5px] text-muted">
                    Untuk mencoba alur wizard lebih cepat
                  </span>
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-muted" aria-hidden />
              </button>
            </Panel>
          </div>
        </div>
      )}

      {step === 1 && (
        <QuestionEditor
          questions={draft.questions}
          onChange={(nextQuestions) => set("questions", nextQuestions)}
          emptyLabel="Belum ada soal"
        />
      )}

      {step === 2 && (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <Panel title="Waktu dan jadwal">
              <div className="space-y-3.5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Durasi pengerjaan (menit)" required>
                    <Input
                      type="number"
                      min={5}
                      max={240}
                      value={draft.durationMinutes}
                      onChange={(e) => set("durationMinutes", Number(e.target.value) || 0)}
                    />
                  </Field>
                  <Field label="Maks percobaan per nama">
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

                <div>
                  <p className="text-[13px] font-semibold text-ink-soft">Jadwal ujian</p>
                  <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        ["manual", "Buka manual", "Kamu buka dan tutup sendiri dari panel"],
                        ["scheduled", "Terjadwal", "Buka dan tutup otomatis"],
                      ] as const
                    ).map(([key, label, desc]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => set("openMode", key)}
                        aria-pressed={draft.openMode === key}
                        className={cn(
                          "press rounded-field border px-3 py-2 text-left transition-colors",
                          draft.openMode === key
                            ? "border-navy-900 bg-accent-50 ring-1 ring-navy-900"
                            : "border-line bg-surface hover:bg-line-soft",
                        )}
                      >
                        <span className="flex items-center gap-1.5 font-heading text-[12.5px] font-bold text-ink">
                          {draft.openMode === key && (
                            <Check className="size-3.5 text-leaf-700" aria-hidden />
                          )}
                          {label}
                        </span>
                        <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">
                          {desc}
                        </span>
                      </button>
                    ))}
                  </div>
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
              </div>
            </Panel>

            <Panel title="Penilaian dan hasil">
              <div className="space-y-3.5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="KKM (nilai minimum lulus)">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={draft.passingScore}
                      onChange={(e) => set("passingScore", Number(e.target.value) || 0)}
                    />
                  </Field>
                  <Field label="Bila percobaan lebih dari satu">
                    <Select
                      value={draft.scorePolicy}
                      onChange={(e) => set("scorePolicy", e.target.value as Draft["scorePolicy"])}
                    >
                      <option value="highest">Ambil nilai tertinggi</option>
                      <option value="latest">Ambil nilai terakhir</option>
                      <option value="first">Ambil nilai pertama</option>
                      <option value="average">Rata-rata semua percobaan</option>
                    </Select>
                  </Field>
                </div>

                <Field label="Visibilitas hasil">
                  <Select
                    value={draft.resultVisibility}
                    onChange={(e) =>
                      set("resultVisibility", e.target.value as Draft["resultVisibility"])
                    }
                  >
                    <option value="score_and_review">Skor dan pembahasan</option>
                    <option value="score_only">Skor saja</option>
                    <option value="hidden">Sembunyikan dari peserta</option>
                  </Select>
                </Field>

                <Field label="Waktu rilis hasil">
                  <Select
                    value={draft.resultRelease}
                    onChange={(e) => set("resultRelease", e.target.value as Draft["resultRelease"])}
                  >
                    <option value="instant">Langsung setelah kumpulkan</option>
                    <option value="after_close">Setelah ujian ditutup</option>
                    <option value="manual">Rilis manual oleh admin</option>
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
                  description="Peserta wajib mengisi kelas saat mulai."
                />
                <div className="h-px bg-line" />
                <Switch
                  checked={draft.shuffleQuestions}
                  onChange={(v) => set("shuffleQuestions", v)}
                  label="Acak urutan soal"
                  description="Setiap peserta mendapat urutan berbeda."
                />
                <div className="h-px bg-line" />
                <Switch
                  checked={draft.shuffleOptions}
                  onChange={(v) => set("shuffleOptions", v)}
                  label="Acak urutan opsi"
                  description="Huruf opsi tetap A sampai E, isinya diacak."
                />
              </div>
            </Panel>

            <Panel title="Ringkasan">
              <dl className="space-y-2 text-[12.5px]">
                {[
                  ["Durasi", formatDuration(draft.durationMinutes * 60)],
                  ["Jumlah soal", `${draft.questions.length} soal`],
                  ["Soal esai", `${essays} soal`],
                  ["Total poin", `${totalPoints} poin`],
                  ["Maks percobaan", `${draft.maxAttempts} kali`],
                  ["KKM", String(draft.passingScore)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <dt className="text-muted">{label}</dt>
                    <dd className="font-heading font-bold text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4">
            <Panel title="Ringkasan ujian">
              <div className="rounded-card bg-navy-900 p-4">
                <p className="text-[12px] font-medium text-white/75">
                  {draft.subject || "Mata pelajaran"}
                </p>
                <h2 className="mt-1 font-heading text-[19px] font-extrabold leading-snug text-white">
                  {draft.title || "Judul ujian"}
                </h2>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[
                    `${draft.questions.length} soal`,
                    `${totalPoints} poin`,
                    formatDuration(draft.durationMinutes * 60),
                    draft.openMode === "manual" ? "Buka manual" : "Terjadwal",
                    `KKM ${draft.passingScore}`,
                  ].map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full bg-white/15 px-2 py-0.5 font-heading text-[11px] font-semibold text-white"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                {[
                  ["Deskripsi", draft.description || "Belum diisi"],
                  ["Maks percobaan", `${draft.maxAttempts} kali per nama`],
                  ["Kelas diminta", draft.askClass ? "Ya" : "Tidak"],
                  ["Acak soal", draft.shuffleQuestions ? "Ya" : "Tidak"],
                  ["Acak opsi", draft.shuffleOptions ? "Ya" : "Tidak"],
                  [
                    "Visibilitas hasil",
                    draft.resultVisibility === "score_and_review"
                      ? "Skor dan pembahasan"
                      : draft.resultVisibility === "score_only"
                        ? "Skor saja"
                        : "Disembunyikan",
                  ],
                  [
                    "Rilis hasil",
                    draft.resultRelease === "instant"
                      ? "Langsung"
                      : draft.resultRelease === "after_close"
                        ? "Setelah ditutup"
                        : "Manual",
                  ],
                  [
                    "Kebijakan nilai",
                    draft.scorePolicy === "highest"
                      ? "Ambil tertinggi"
                      : draft.scorePolicy === "latest"
                        ? "Ambil terbaru"
                        : draft.scorePolicy === "first"
                          ? "Ambil pertama"
                          : "Rata-rata",
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-field border border-line px-3 py-2">
                    <dt className="text-[12px] font-medium text-muted">{label}</dt>
                    <dd className="mt-0.5 truncate text-[12.5px] font-medium text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>

            <Panel
              title="Daftar soal"
              description={`${draft.questions.length} soal, ${totalPoints} poin`}
              padded={false}
            >
              <ul className="scroll-thin max-h-[320px] divide-y divide-line overflow-y-auto">
                {draft.questions.map((q, i) => (
                  <li key={q.key} className="flex items-start gap-2.5 px-4 py-2.5">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-xs bg-line-soft font-heading text-[11px] font-bold text-ink-soft">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[12.5px] leading-snug text-ink">
                        {q.body || <span className="text-clay-600">Pertanyaan kosong</span>}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-muted">
                        {q.type === "essay"
                          ? "Esai"
                          : q.type === "mcq_multiple"
                            ? `PG banyak, ${q.correct.length} kunci`
                            : "PG"}{" "}
                        · {q.points} poin
                      </p>
                    </div>
                    {q.correct.length === 0 && q.type !== "essay" && (
                      <span className="shrink-0 rounded-xs border border-clay-200 bg-clay-50 px-1.5 py-0.5 text-[11px] font-semibold text-clay-700">
                        tanpa kunci
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel title="Pemeriksaan">
              {issues.length === 0 ? (
                <div className="flex items-start gap-2.5 rounded-field border border-leaf-200 bg-leaf-50 px-3 py-2.5">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-leaf-700" aria-hidden />
                  <div>
                    <p className="font-heading text-[12.5px] font-bold text-leaf-800">
                      Isi ujian sudah lengkap
                    </p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-leaf-800">
                      Tidak ada isian yang kurang. Ujian bisa disimpan sebagai draft.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start gap-2.5 rounded-field border border-accent-200 bg-accent-50 px-3 py-2.5">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent-900" aria-hidden />
                    <div>
                      <p className="font-heading text-[12.5px] font-bold text-accent-900">
                        {issues.length} hal perlu diperbaiki
                      </p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-accent-900">
                        Perbaiki dulu sebelum menyimpan.
                      </p>
                    </div>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {issues.slice(0, 6).map((issue) => (
                      <li key={issue.message}>
                        <button
                          type="button"
                          onClick={() => setStep(issue.step)}
                          className="press flex w-full items-start gap-1.5 rounded-field px-2 py-1.5 text-left text-[12px] leading-snug text-ink-soft hover:bg-line-soft"
                        >
                          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-clay-500" aria-hidden />
                          {issue.message}
                        </button>
                      </li>
                    ))}
                    {issues.length > 6 && (
                      <li className="px-2 text-[11.5px] text-muted">
                        dan {issues.length - 6} masalah lain
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </Panel>

            <Panel title="Sebelum menyimpan">
              <Checkbox
                checked
                onChange={() => undefined}
                label="Soal tidak bisa diubah setelah ada peserta"
                description="Pastikan isi soal dan kunci sudah benar. Pengaturan waktu masih bisa diubah nanti."
              />
            </Panel>

            <div className="rounded-card border border-line bg-surface p-4">
              <Button block size="lg" onClick={finish}>
                <Save className="size-4" aria-hidden /> Simpan draft lengkap
              </Button>
              <Button
                block
                size="md"
                variant="ghost"
                className="mt-1.5"
                onClick={() => toast("Draft sudah tersimpan di perangkat ini.")}
              >
                Simpan dan keluar
              </Button>
              <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
                Aplikasi ini belum punya server penyimpanan, jadi ujian tidak bisa benar-benar
                diterbitkan. Yang tersimpan hanya draft di perangkat ini.
              </p>
            </div>
          </div>
        </div>
      )}

      {showIssues && issues.length > 0 && (
        <div className="animate-rise fixed bottom-4 left-1/2 z-40 w-[min(92vw,420px)] -translate-x-1/2 rounded-card border border-clay-200 bg-surface p-3 shadow-pop">
          <p className="flex items-center gap-1.5 font-heading text-[12.5px] font-bold text-clay-700">
            <AlertTriangle className="size-4" aria-hidden /> Belum bisa disimpan
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">{issues[0].message}</p>
          <div className="mt-2 flex gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => setShowIssues(false)}>
              Tutup
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setStep(issues[0].step);
                setShowIssues(false);
              }}
            >
              Perbaiki
            </Button>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 z-30 mt-4 flex items-center gap-2 rounded-t-card border border-line bg-surface px-3 py-2.5">
        <Link href="/admin/exams">
          <Button variant="ghost" size="md">
            <ArrowLeft className="size-4" aria-hidden /> Batal
          </Button>
        </Link>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="hidden text-[12px] text-muted sm:block">
            Langkah {step + 1} dari 4
          </span>
          {step > 0 && (
            <Button variant="secondary" size="md" onClick={() => setStep((s) => s - 1)}>
              Kembali
            </Button>
          )}
          {step < 3 ? (
            <Button size="md" onClick={next} disabled={!canNext}>
              Lanjut <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button size="md" onClick={finish}>
              <Save className="size-4" aria-hidden /> Simpan draft
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Keadaan akhir wizard. Tidak mengklaim ujian terbit: tanpa server, tidak ada
 * yang bisa diterbitkan. Yang ditawarkan hanya langkah berikutnya yang nyata.
 */
function DraftDone({
  title,
  questionCount,
  totalPoints,
  onReset,
}: {
  title: string;
  questionCount: number;
  totalPoints: number;
  onReset: () => void;
}) {
  const origin = useOriginLabel();
  const demoUrl = `https://${origin}/u/${demoExam.code}`;

  return (
    <div className="mx-auto max-w-xl">
      <div className="animate-rise rounded-card border border-line bg-surface p-5 sm:p-7">
        <span className="grid size-12 place-items-center rounded-card bg-accent-100 text-accent-900">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <h1 className="mt-3 font-heading text-[22px] font-extrabold leading-tight text-ink">
          Draft ujian sudah lengkap
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
          <strong className="font-semibold text-ink">{title || "Ujian baru"}</strong> berisi{" "}
          {questionCount} soal dan {totalPoints} poin. Semua isian sudah lolos pemeriksaan.
        </p>

        <div className="mt-4 rounded-field border border-accent-200 bg-accent-50 px-3 py-2.5">
          <p className="text-[12.5px] leading-relaxed text-accent-900">
            <strong className="font-semibold">Ujian belum diterbitkan.</strong> Aplikasi ini belum
            tersambung ke server, jadi belum ada kode ujian dan belum ada peserta yang bisa masuk ke
            ujian ini.
          </p>
        </div>

        <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
          Sambil menunggu backend, kamu bisa mencoba alur peserta memakai ujian contoh yang sudah
          tersedia.
        </p>

        <div className="mt-2.5 flex items-center gap-2 rounded-field border border-line bg-canvas px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink-soft">
            {demoUrl}
          </code>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(demoUrl);
                toast.success("Tautan ujian contoh disalin");
              } catch {
                toast.error("Gagal menyalin. Salin manual dari kotak di atas.");
              }
            }}
          >
            <Copy className="size-3.5" aria-hidden /> Salin
          </Button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={onReset}>
            <ArrowLeft className="size-4" aria-hidden /> Kembali ke daftar
          </Button>
          <Link href={`/u/${demoExam.code}`} target="_blank" rel="noreferrer">
            <Button block>
              Buka ujian contoh <ArrowRight className="size-4" aria-hidden />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
