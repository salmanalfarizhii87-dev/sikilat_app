"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  FileSpreadsheet,
  GripVertical,
  Info,
  ListChecks,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Question, QuestionType } from "@/lib/types";

export interface DraftQuestion {
  key: string;
  type: QuestionType;
  body: string;
  /** Teks bacaan bersama; kosong/null bila soal tidak memerlukannya. */
  passage?: string;
  points: number;
  options: { id: string; body: string }[];
  correct: string[];
  explanation: string;
  wordMin?: number;
  wordMax?: number;
  referenceAnswer?: string;
}

let counter = 0;
export function newKey() {
  counter += 1;
  return `q_${Date.now().toString(36)}_${counter}`;
}

export function emptyQuestion(): DraftQuestion {
  return {
    key: newKey(),
    type: "mcq_single",
    body: "",
    points: 1,
    options: [
      { id: "o1", body: "" },
      { id: "o2", body: "" },
      { id: "o3", body: "" },
      { id: "o4", body: "" },
    ],
    correct: [],
    explanation: "",
  };
}

export function questionFromModel(q: Question): DraftQuestion {
  return {
    key: q.id,
    type: q.type,
    body: q.body,
    points: q.points,
    options: q.options.map((o) => ({ id: o.id, body: o.body })),
    correct: [...q.correctOptionIds],
    explanation: q.explanation ?? "",
    wordMin: q.wordMin,
    wordMax: q.wordMax,
    referenceAnswer: q.referenceAnswer,
  };
}

const typeLabel: Record<QuestionType, string> = {
  mcq_single: "PG",
  mcq_multiple: "PG banyak",
  true_false: "Benar/Salah",
  essay: "Esai",
};

const letters = "ABCDEF";

export function QuestionEditor({
  questions,
  onChange,
  locked,
  emptyLabel = "Belum ada soal",
  compact,
}: {
  questions: DraftQuestion[];
  onChange: (next: DraftQuestion[]) => void;
  locked?: boolean;
  emptyLabel?: string;
  compact?: boolean;
}) {
  const [activeKey, setActiveKey] = React.useState<string | null>(questions[0]?.key ?? null);
  const [importOpen, setImportOpen] = React.useState(false);

  // Derive the selection instead of syncing it from an effect: if the selected
  // question was removed (or the list is new) fall back to the first item.
  const selectedKey =
    activeKey && questions.some((q) => q.key === activeKey) ? activeKey : (questions[0]?.key ?? null);
  const active = questions.find((q) => q.key === selectedKey) ?? questions[0] ?? null;

  const patch = (key: string, next: Partial<DraftQuestion>) => {
    onChange(questions.map((q) => (q.key === key ? { ...q, ...next } : q)));
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const addQuestion = () => {
    const q = emptyQuestion();
    onChange([...questions, q]);
    setActiveKey(q.key);
  };

  return (
    <div
      className={cn(
        "grid items-start gap-3",
        compact ? "lg:grid-cols-[260px_1fr]" : "lg:grid-cols-[290px_1fr]",
      )}
    >
      {/* list */}
      <div className="flex flex-col overflow-hidden rounded-card border border-line bg-surface lg:sticky lg:top-20">
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
          <p className="font-heading text-[12.5px] font-bold text-ink">
            Daftar soal{" "}
            <span className="font-medium text-muted">({questions.length})</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              disabled={locked}
              className="press grid size-8 place-items-center rounded-full text-muted hover:bg-line-soft disabled:opacity-40"
              aria-label="Impor CSV"
              title="Impor CSV"
            >
              <FileSpreadsheet className="size-4" />
            </button>
            <button
              type="button"
              onClick={addQuestion}
              disabled={locked}
              className="press grid size-8 place-items-center rounded-full bg-navy-800 text-white hover:bg-navy-700 disabled:opacity-40"
              aria-label="Tambah soal"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <div className="scroll-thin max-h-[52vh] flex-1 overflow-y-auto p-1.5">
          {questions.length === 0 && (
            <p className="px-2 py-6 text-center text-[12px] text-muted">{emptyLabel}</p>
          )}
          <ul className="space-y-1">
            {questions.map((q, i) => (
              <li key={q.key}>
                <button
                  type="button"
                  onClick={() => setActiveKey(q.key)}
                  className={cn(
                    "group flex w-full items-start gap-2 rounded-field px-2 py-2 text-left transition-colors",
                    active?.key === q.key
                      ? "bg-accent-50 ring-1 ring-accent-300"
                      : "hover:bg-line-soft",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg font-heading text-[11px] font-bold",
                      active?.key === q.key
                        ? "bg-accent-500 text-ink"
                        : "bg-line-soft text-ink-soft",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-[12px] leading-snug text-ink-soft">
                      {q.body.trim() || "Soal belum diisi…"}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <span className="rounded-xs bg-line-soft px-1 py-px font-heading text-[10px] font-bold text-muted">
                        {typeLabel[q.type]}
                      </span>
                      <span className="text-[10px] text-muted">{q.points} poin</span>
                      {q.body.trim() === "" && (
                        <span className="size-1.5 rounded-full bg-clay-500" aria-label="Belum lengkap" />
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-line px-3 py-2">
          <button
            type="button"
            onClick={addQuestion}
            disabled={locked}
            className="press flex w-full items-center justify-center gap-1.5 rounded-field border border-dashed border-line py-2 font-heading text-[12px] font-semibold text-muted hover:border-navy-400 hover:text-ink disabled:opacity-40"
          >
            <Plus className="size-3.5" /> Tambah soal
          </button>
        </div>
      </div>

      {/* form */}
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        {!active ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-card bg-line-soft text-muted">
              <ListChecks className="size-6" />
            </span>
            <p className="font-heading text-[14px] font-bold text-ink">{emptyLabel}</p>
            <p className="max-w-xs text-[12.5px] leading-relaxed text-muted">
              Tambahkan soal satu per satu, atau impor banyak soal sekaligus dari CSV.
            </p>
            <div className="mt-1 flex gap-2">
              <Button size="sm" onClick={addQuestion} disabled={locked}>
                <Plus className="size-3.5" /> Tambah soal
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)} disabled={locked}>
                <Upload className="size-3.5" /> Impor CSV
              </Button>
            </div>
          </div>
        ) : (
          <QuestionForm
            key={active.key}
            index={questions.findIndex((q) => q.key === active.key)}
            total={questions.length}
            value={active}
            locked={locked}
            onChange={(next) => patch(active.key, next)}
            onDelete={() => {
              onChange(questions.filter((q) => q.key !== active.key));
              toast("Soal dihapus");
            }}
            onMove={(dir) => move(questions.findIndex((q) => q.key === active.key), dir)}
          />
        )}
      </div>

      <CsvImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(imported) => {
          onChange([...questions, ...imported]);
          setActiveKey(imported[0]?.key ?? selectedKey);
          toast.success(`${imported.length} soal diimpor`);
        }}
      />
    </div>
  );
}

function QuestionForm({
  value,
  index,
  total,
  locked,
  onChange,
  onDelete,
  onMove,
}: {
  value: DraftQuestion;
  index: number;
  total: number;
  locked?: boolean;
  onChange: (next: Partial<DraftQuestion>) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const isEssay = value.type === "essay";
  const isMulti = value.type === "mcq_multiple";
  // Benar/Salah juga butuh banyak opsi bertanda benar (setiap pernyataan yang
  // bernilai Benar), jadi perilaku penandaan kuncinya sama dengan PG banyak.
  const isMultiCorrect = value.type === "mcq_multiple" || value.type === "true_false";

  const setType = (type: QuestionType) => {
    if (type === "essay") {
      onChange({ type, correct: [], options: [] });
      return;
    }
    onChange({
      type,
      correct: value.correct.slice(0, type === "mcq_single" ? 1 : undefined),
      options:
        value.options.length >= 2
          ? value.options
          : [
              { id: "o1", body: "" },
              { id: "o2", body: "" },
              { id: "o3", body: "" },
              { id: "o4", body: "" },
            ],
    });
  };

  const toggleCorrect = (id: string) => {
    if (locked) return;
    if (isMultiCorrect) {
      onChange({
        correct: value.correct.includes(id)
          ? value.correct.filter((x) => x !== id)
          : [...value.correct, id],
      });
    } else {
      onChange({ correct: [id] });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-navy-800 font-heading text-[11.5px] font-bold text-white">
            {index + 1}
          </span>
          <p className="font-heading text-[13px] font-bold text-ink">
            Soal {index + 1}
            <span className="ml-1 font-medium text-muted">dari {total}</span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0 || locked}
            aria-label="Naikkan urutan"
            className="press grid size-8 place-items-center rounded-full text-muted hover:bg-line-soft disabled:opacity-30"
          >
            <ArrowUp className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1 || locked}
            aria-label="Turunkan urutan"
            className="press grid size-8 place-items-center rounded-full text-muted hover:bg-line-soft disabled:opacity-30"
          >
            <ArrowDown className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={locked}
            aria-label="Hapus soal"
            className="press grid size-8 place-items-center rounded-full text-clay-600 hover:bg-clay-50 disabled:opacity-30"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {locked && (
        <p className="flex items-start gap-2 border-b border-accent-200 bg-accent-50 px-4 py-2 text-[11.5px] leading-relaxed text-accent-900">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Soal terkunci karena sudah ada peserta yang mengerjakan. Buat ujian baru bila perlu
          mengubah isi soal.
        </p>
      )}

      <div className="scroll-thin flex-1 space-y-3.5 overflow-y-auto p-4">
        <div className="grid gap-2.5 sm:grid-cols-[1fr_110px]">
          <Field label="Tipe soal">
            <Select
              value={value.type}
              disabled={locked}
              onChange={(e) => setType(e.target.value as QuestionType)}
            >
              <option value="mcq_single">Pilihan ganda (satu jawaban)</option>
              <option value="mcq_multiple">Pilihan ganda (banyak jawaban)</option>
              <option value="true_false">Benar/Salah (per pernyataan)</option>
              <option value="essay">Esai</option>
            </Select>
          </Field>
          <Field label="Poin">
            <Input
              type="number"
              min={1}
              max={100}
              value={value.points}
              disabled={locked}
              onChange={(e) => onChange({ points: Math.max(1, Number(e.target.value) || 1) })}
            />
          </Field>
        </div>

        <Field
          label="Teks bacaan"
          hint="Opsional. Ditampilkan di atas pertanyaan; berguna untuk soal berbasis teks."
        >
          <Textarea
            value={value.passage ?? ""}
            disabled={locked}
            onChange={(e) => onChange({ passage: e.target.value || undefined })}
            placeholder="Tempel teks bacaan di sini, atau biarkan kosong…"
            className="min-h-20"
          />
        </Field>

        <Field
          label="Pertanyaan"
          required
          hint={`${value.body.trim().length} karakter`}
        >
          <Textarea
            value={value.body}
            disabled={locked}
            onChange={(e) => onChange({ body: e.target.value })}
            placeholder="Tulis pertanyaan di sini…"
            className="min-h-24"
          />
        </Field>

        {isEssay ? (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Minimal kata">
                <Input
                  type="number"
                  min={0}
                  value={value.wordMin ?? ""}
                  disabled={locked}
                  onChange={(e) => onChange({ wordMin: Number(e.target.value) || undefined })}
                  placeholder="0"
                />
              </Field>
              <Field label="Maksimal kata">
                <Input
                  type="number"
                  min={0}
                  value={value.wordMax ?? ""}
                  disabled={locked}
                  onChange={(e) => onChange({ wordMax: Number(e.target.value) || undefined })}
                  placeholder="150"
                />
              </Field>
            </div>
            <Field label="Kunci acuan / rubrik" hint="Hanya terlihat admin">
              <Textarea
                value={value.referenceAnswer ?? ""}
                disabled={locked}
                onChange={(e) => onChange({ referenceAnswer: e.target.value })}
                placeholder="Poin-poin jawaban yang diharapkan…"
                className="min-h-20"
              />
            </Field>
          </>
        ) : (
          <div>
            <div className="flex items-baseline justify-between">
              <p className="font-heading text-[13px] font-semibold text-ink-soft">
                Opsi jawaban <span className="text-clay-600">*</span>
              </p>
              <p className="text-[11px] text-muted">
                {isMulti ? "Centang semua jawaban benar" : "Pilih satu jawaban benar"}
              </p>
            </div>

            <ul className="mt-1.5 space-y-1.5">
              {value.options.map((opt, i) => {
                const isCorrect = value.correct.includes(opt.id);
                return (
                  <li key={opt.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCorrect(opt.id)}
                      disabled={locked}
                      aria-label={`Tandai opsi ${letters[i]} sebagai benar`}
                      aria-pressed={isCorrect}
                      className={cn(
                        "press grid size-8 shrink-0 place-items-center border font-heading text-[12px] font-bold transition-colors",
                        isMulti ? "rounded-[9px]" : "rounded-full",
                        isCorrect
                          ? "border-leaf-700 bg-leaf-600 text-white"
                          : "border-line bg-surface text-ink-soft hover:border-leaf-600",
                      )}
                    >
                      {isCorrect ? <Check className="size-3.5" strokeWidth={3} /> : letters[i]}
                    </button>
                    <Input
                      value={opt.body}
                      disabled={locked}
                      onChange={(e) =>
                        onChange({
                          options: value.options.map((o) =>
                            o.id === opt.id ? { ...o, body: e.target.value } : o,
                          ),
                        })
                      }
                      placeholder={`Opsi ${letters[i]}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onChange({
                          options: value.options.filter((o) => o.id !== opt.id),
                          correct: value.correct.filter((c) => c !== opt.id),
                        });
                      }}
                      disabled={locked || value.options.length <= 2}
                      aria-label={`Hapus opsi ${letters[i]}`}
                      className="press grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-clay-50 hover:text-clay-600 disabled:opacity-25"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>

            {value.options.length < 5 && (
              <button
                type="button"
                disabled={locked}
                onClick={() =>
                  onChange({
                    options: [
                      ...value.options,
                      { id: `o${value.options.length + 1}_${Date.now().toString(36)}`, body: "" },
                    ],
                  })
                }
                className="press mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-1 font-heading text-[11.5px] font-semibold text-navy-700 hover:bg-line-soft disabled:opacity-40"
              >
                <Plus className="size-3.5" /> Tambah opsi
              </button>
            )}
          </div>
        )}

        <Field label="Pembahasan" hint="Opsional · tampil di halaman hasil">
          <Textarea
            value={value.explanation}
            disabled={locked}
            onChange={(e) => onChange({ explanation: e.target.value })}
            placeholder="Jelaskan mengapa jawaban itu benar…"
            className="min-h-16"
          />
        </Field>
      </div>
    </div>
  );
}

/** Minimal CSV parser that respects quoted fields and escaped quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const SAMPLE = `tipe,soal,opsi_a,opsi_b,opsi_c,opsi_d,opsi_e,kunci,poin,pembahasan
pg,"Hasil dari 7 x 8 adalah ...",54,56,58,64,,B,1,"7 x 8 = 56"
pg_banyak,"Manakah yang termasuk bilangan prima?",2,4,5,9,,A|C,2,"2 dan 5 hanya habis dibagi 1 dan dirinya sendiri"
essay,"Jelaskan pengertian fotosintesis dengan kata-katamu sendiri.",,,,,,"Proses tumbuhan membuat makanan dengan bantuan cahaya matahari",5,`;

function CsvImportModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (questions: DraftQuestion[]) => void;
}) {
  const [text, setText] = React.useState("");
  const [errors, setErrors] = React.useState<string[]>([]);
  const [preview, setPreview] = React.useState<DraftQuestion[]>([]);

  const reset = () => {
    setText("");
    setErrors([]);
    setPreview([]);
  };

  const validate = () => {
    const rows = parseCsv(text);
    if (rows.length < 2) {
      setErrors(["CSV kosong atau tidak memiliki baris data."]);
      setPreview([]);
      return;
    }
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const need = ["tipe", "soal", "opsi_a", "opsi_b", "kunci"];
    const missing = need.filter((n) => !header.includes(n));
    if (missing.length) {
      setErrors([`Kolom wajib tidak ditemukan: ${missing.join(", ")}.`]);
      setPreview([]);
      return;
    }

    const idx = (name: string) => header.indexOf(name);
    const nextErrors: string[] = [];
    const parsed: DraftQuestion[] = [];

    rows.slice(1).forEach((row, i) => {
      const line = i + 2;
      const type = (row[idx("tipe")] ?? "").trim().toLowerCase();
      const body = (row[idx("soal")] ?? "").trim();
      if (!body) {
        nextErrors.push(`Baris ${line}: kolom "soal" kosong.`);
        return;
      }
      const optionBodies = ["opsi_a", "opsi_b", "opsi_c", "opsi_d", "opsi_e"]
        .map((name) => (idx(name) >= 0 ? (row[idx(name)] ?? "").trim() : ""))
        .filter(Boolean);
      const keyRaw = (row[idx("kunci")] ?? "").trim();
      const points = Number((row[idx("poin")] ?? "1").trim()) || 1;
      const explanation = idx("pembahasan") >= 0 ? (row[idx("pembahasan")] ?? "").trim() : "";

      if (type === "essay") {
        parsed.push({
          key: newKey(),
          type: "essay",
          body,
          points,
          options: [],
          correct: [],
          explanation,
          referenceAnswer: keyRaw,
        });
        return;
      }

      if (type !== "pg" && type !== "pg_banyak") {
        nextErrors.push(`Baris ${line}: tipe "${type}" tidak dikenal (pakai pg, pg_banyak, essay).`);
        return;
      }
      if (optionBodies.length < 2) {
        nextErrors.push(`Baris ${line}: minimal 2 opsi terisi.`);
        return;
      }
      const options = optionBodies.map((b, oi) => ({ id: `o${oi + 1}`, body: b }));
      const keys = keyRaw
        .split("|")
        .map((k) => k.trim().toUpperCase())
        .filter(Boolean);
      const correct: string[] = [];
      for (const k of keys) {
        const pos = letters.indexOf(k);
        if (pos < 0 || pos >= options.length) {
          nextErrors.push(`Baris ${line}: kunci "${k}" tidak merujuk opsi yang terisi.`);
          return;
        }
        correct.push(options[pos].id);
      }
      if (correct.length === 0) {
        nextErrors.push(`Baris ${line}: kunci jawaban kosong.`);
        return;
      }
      if (type === "pg" && correct.length > 1) {
        nextErrors.push(`Baris ${line}: tipe pg hanya boleh satu kunci.`);
        return;
      }
      parsed.push({
        key: newKey(),
        type: type === "pg" ? "mcq_single" : "mcq_multiple",
        body,
        points,
        options,
        correct,
        explanation,
      });
    });

    setErrors(nextErrors);
    setPreview(parsed);
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
        reset();
      }}
      title="Impor soal dari CSV"
      description="Tempel isi CSV di bawah. Tidak ada data yang diunggah ke server pada demo ini."
      size="lg"
      icon={
        <span className="grid size-10 place-items-center rounded-full bg-leaf-100 text-leaf-800">
          <FileSpreadsheet className="size-5" />
        </span>
      }
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              onClose();
              reset();
            }}
          >
            Batal
          </Button>
          <Button variant="secondary" onClick={validate}>
            Periksa
          </Button>
          <Button
            disabled={preview.length === 0 || errors.length > 0}
            onClick={() => {
              onImport(preview);
              onClose();
              reset();
            }}
          >
            Impor {preview.length > 0 ? `${preview.length} soal` : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-muted">
            Kolom: <code className="rounded bg-line-soft px-1 py-0.5">tipe, soal, opsi_a…e, kunci, poin, pembahasan</code>
          </p>
          <button
            type="button"
            onClick={() => setText(SAMPLE)}
            className="press rounded-full border border-line px-2.5 py-1 font-heading text-[11.5px] font-semibold text-ink-soft hover:bg-line-soft"
          >
            Isi contoh
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview([]);
            setErrors([]);
          }}
          placeholder={SAMPLE}
          className="min-h-40 w-full rounded-field border border-line bg-canvas px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-ink placeholder:text-muted focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-900/15"
        />

        {errors.length > 0 && (
          <ul className="space-y-1 rounded-field border border-clay-200 bg-clay-50 px-3 py-2">
            {errors.slice(0, 6).map((err) => (
              <li key={err} className="text-[12px] leading-relaxed text-clay-700">
                • {err}
              </li>
            ))}
            {errors.length > 6 && (
              <li className="text-[11.5px] text-clay-600">+{errors.length - 6} masalah lain</li>
            )}
          </ul>
        )}

        {preview.length > 0 && errors.length === 0 && (
          <div className="rounded-field border border-leaf-200 bg-leaf-50 px-3 py-2.5">
            <p className="font-heading text-[12.5px] font-bold text-leaf-800">
              {preview.length} soal siap diimpor
            </p>
            <ul className="mt-1.5 space-y-1">
              {preview.slice(0, 4).map((q, i) => (
                <li key={q.key} className="truncate text-[11.5px] text-leaf-800/80">
                  {i + 1}. [{typeLabel[q.type]}] {q.body}
                </li>
              ))}
              {preview.length > 4 && (
                <li className="text-[11px] text-leaf-800/60">+{preview.length - 4} soal lain</li>
              )}
            </ul>
          </div>
        )}

        <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted">
          <GripVertical className="mt-0.5 size-3.5 shrink-0" />
          Gambar tidak dapat diimpor lewat CSV, tambahkan lewat editor setelah impor.
        </p>
      </div>
    </Modal>
  );
}
