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
  FileText,
  Info,
  ListChecks,
  Loader2,
  Save,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/checkbox";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/primitives";
import { ExamLinkRow, PageHeader, Panel } from "@/components/admin/ui";
import {
  QuestionEditor,
  questionToPayload,
  type DraftQuestion,
} from "@/components/admin/question-editor";
import { createExamDraft } from "@/features/exams/actions";
import { saveExamQuestions } from "@/features/questions/actions";
import { useMounted } from "@/lib/client-hooks";

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
  /** String supaya bisa dikosongkan; kosong = tanpa KKM (bukan 0). */
  passingScore: string;
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
    passingScore: "70",
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
  const [showIssues, setShowIssues] = React.useState(false);

  React.useEffect(() => {
    if (!mounted) return;
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
  }, [draft, step, mounted]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const totalPoints = draft.questions.reduce((sum, q) => sum + q.points, 0);
  const essays = draft.questions.filter((q) => q.type === "essay").length;
  /** `null` = tanpa KKM. Ditampilkan apa adanya, bukan sebagai "KKM 0". */
  const kkmLabel = draft.passingScore.trim() === "" ? "Tanpa KKM" : `KKM ${draft.passingScore}`;

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
        if (q.options.some((option) => !option.body.trim()))
          list.push({ message: `Soal ${i + 1}: ada opsi yang masih kosong.`, step: 1 });
        if (q.correct.length === 0)
          list.push({ message: `Soal ${i + 1}: belum ada kunci jawaban.`, step: 1 });
        // Peserta hanya bisa memilih satu opsi pada tipe ini, jadi dua kunci
        // membuat soal itu mustahil dijawab benar.
        if (q.type === "mcq_single" && q.correct.length > 1)
          list.push({ message: `Soal ${i + 1}: pilihan ganda satu jawaban hanya boleh satu kunci.`, step: 1 });
      }
    });
    if (draft.durationMinutes < 5) list.push({ message: "Durasi minimal 5 menit.", step: 2 });
    if (draft.passingScore.trim() !== "") {
      const kkm = Number(draft.passingScore);
      if (!Number.isFinite(kkm) || kkm < 0 || kkm > 100)
        list.push({ message: "KKM harus di antara 0 dan 100, atau dikosongkan.", step: 2 });
    }
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

  const [saving, setSaving] = React.useState(false);
  const [created, setCreated] = React.useState<{ examId: string; code: string } | null>(null);

  /**
   * Simpan draft ke server: buat ujian, lalu tulis seluruh soalnya.
   *
   * Dua langkah, dan urutannya tidak bisa dibalik: soal butuh `exam_id`, dan
   * `exam_id` baru ada setelah ujian dibuat. Kalau langkah kedua gagal, ujian
   * sudah terlanjur ada sebagai draft kosong â€” karena itu pesan galatnya
   * menyebut ID-nya supaya admin bisa membuka dan mengisi ulang, bukan
   * mengira tidak ada yang tersimpan.
   *
   * Status tetap `draft`: wizard ini tidak menerbitkan ujian. EXM-08 mensyaratkan
   * pemeriksaan kelayakan sebelum terbit, dan jalur itu ada di tombol
   * "Aktifkan" pada halaman ringkasan ujian.
   */
  const finish = async () => {
    if (issues.length > 0) {
      setShowIssues(true);
      toast.error("Masih ada yang perlu diperbaiki.");
      return;
    }

    setSaving(true);

    const passing = draft.passingScore.trim() === "" ? null : Number(draft.passingScore);

    const created_ = await createExamDraft({
      title: draft.title,
      subjectLabel: draft.subject,
      description: draft.description,
      instructions: draft.instructions,
      opensAt: draft.openMode === "scheduled" ? draft.opensAt : "",
      closesAt: draft.openMode === "scheduled" ? draft.closesAt : "",
      durationMinutes: draft.durationMinutes,
      maxAttempts: draft.maxAttempts,
      scorePolicy: draft.scorePolicy,
      passingScore: passing,
      shuffleQuestions: draft.shuffleQuestions,
      shuffleOptions: draft.shuffleOptions,
      askClass: draft.askClass,
      resultVisibility: draft.resultVisibility,
      resultRelease: draft.resultRelease,
    });

    if (!created_.ok) {
      setSaving(false);
      toast.error(created_.error.message);
      return;
    }

    const saved = await saveExamQuestions(
      created_.data.examId,
      draft.questions.map(questionToPayload),
    );

    setSaving(false);

    if (!saved.ok) {
      toast.error(
        `Ujian tersimpan sebagai draft, tetapi soalnya gagal disimpan: ${saved.error.message}`,
      );
      router.push(`/admin/exams/${created_.data.examId}/questions`);
      return;
    }

    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // noop â€” draft lokal hanya kenyamanan, bukan sumber data
    }

    setCreated(created_.data);
  };

  if (created) {
    return (
      <DraftDone
        title={draft.title}
        questionCount={draft.questions.length}
        totalPoints={totalPoints}
        examId={created.examId}
        code={created.code}
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
        description="Draft tersimpan otomatis di perangkat ini sampai kamu menekan Simpan. Setelah tersimpan, datanya ada di server dan bisa dibuka dari perangkat lain."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-leaf-200 bg-leaf-50 px-2.5 py-1 font-heading text-[11.5px] font-semibold text-leaf-800">
            <CloudCheck className="size-3.5" aria-hidden />
            {savedAt
              ? savedAt === "sebelumnya"
                ? "Draft lokal dipulihkan"
                : `Draft lokal ${savedAt} WIB`
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
                    kkmLabel,
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

            <Panel title="Setelah disimpan">
              <ul className="space-y-2 text-[12px] leading-relaxed text-muted">
                <li className="flex items-start gap-1.5">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-leaf-700" aria-hidden />
                  Ujian tersimpan sebagai <strong className="font-semibold text-ink-soft">draft</strong>{" "}
                  dengan kode unik yang dibuat server.
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-leaf-700" aria-hidden />
                  Draft tidak bisa diakses peserta sampai kamu menekan Aktifkan di halaman ringkasan.
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-leaf-700" aria-hidden />
                  Soal masih bisa diubah sampai peserta pertama mulai mengerjakan.
                </li>
              </ul>
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
                  <Field label="KKM (nilai minimum lulus)" hint="Kosongkan bila tanpa KKM">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={draft.passingScore}
                      placeholder="Tanpa KKM"
                      onChange={(e) => set("passingScore", e.target.value)}
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
                  ["KKM", kkmLabel],
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
                    kkmLabel,
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
                        Â· {q.points} poin
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
              <ul className="space-y-2 text-[12px] leading-relaxed text-muted">
                <li className="flex items-start gap-1.5">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-leaf-700" aria-hidden />
                  Ujian disimpan sebagai draft, belum diterbitkan.
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-leaf-700" aria-hidden />
                  Soal tidak bisa diubah lagi setelah ada peserta yang mulai mengerjakan.
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-leaf-700" aria-hidden />
                  Pastikan kunci jawaban sudah benar — nilai dihitung dari kunci ini.
                </li>
              </ul>
            </Panel>

            <div className="rounded-card border border-line bg-surface p-4">
              <Button block size="lg" onClick={finish} disabled={saving}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="size-4" aria-hidden />
                )}
                {saving ? "Menyimpan ke server…" : "Simpan draft ke server"}
              </Button>
              <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
                Ujian dan seluruh soalnya disimpan ke database dalam satu kali simpan. Kode ujian
                dibuat otomatis oleh server dan ditampilkan setelah berhasil.
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
            <Button size="md" onClick={finish} disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Save className="size-4" aria-hidden />
              )}
              {saving ? "Menyimpan…" : "Simpan draft"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Keadaan akhir wizard.
 *
 * Menampilkan kode ujian yang **baru saja dibuat server**, bukan kode ujian
 * contoh. Tautan `/u/<kode>` sudah nyata, tetapi draft belum bisa diakses
 * peserta — jadi tombolnya mengarah ke halaman ringkasan ujian, bukan ke
 * halaman peserta yang pasti menampilkan "kode tidak ditemukan".
 */
function DraftDone({
  title,
  questionCount,
  totalPoints,
  examId,
  code,
}: {
  title: string;
  questionCount: number;
  totalPoints: number;
  examId: string;
  code: string;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <div className="animate-rise rounded-card border border-line bg-surface p-5 sm:p-7">
        <span className="grid size-12 place-items-center rounded-card bg-accent-100 text-accent-900">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <h1 className="mt-3 font-heading text-[22px] font-extrabold leading-tight text-ink">
          Draft ujian tersimpan
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
          <strong className="font-semibold text-ink">{title || "Ujian baru"}</strong> berisi{" "}
          {questionCount} soal dan {totalPoints} poin, tersimpan di server sebagai draft.
        </p>

        <div className="mt-4 rounded-field border border-line bg-canvas px-3 py-2.5">
          <p className="text-[11.5px] font-medium text-muted">Kode ujian</p>
          <p className="font-heading text-[22px] font-extrabold tracking-wide text-ink">{code}</p>
        </div>

        <p className="mt-4 text-[12px] font-medium text-muted">Tautan peserta</p>
        <div className="mt-1.5">
          <ExamLinkRow code={code} />
        </div>

        <div className="mt-3 rounded-field border border-accent-200 bg-accent-50 px-3 py-2.5">
          <p className="text-[12.5px] leading-relaxed text-accent-900">
            <strong className="font-semibold">Belum bisa diakses peserta.</strong> Ujian masih
            berstatus draft. Aktifkan dari halaman ringkasan setelah kamu memeriksa soal dan
            jadwalnya.
          </p>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Link href="/admin/exams">
            <Button block variant="secondary">
              <ArrowLeft className="size-4" aria-hidden /> Daftar ujian
            </Button>
          </Link>
          <Link href={`/admin/exams/${examId}`}>
            <Button block>
              Buka ringkasan ujian <ArrowRight className="size-4" aria-hidden />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
