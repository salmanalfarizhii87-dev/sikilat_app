"use client";

import { cn } from "@/lib/utils";
import { Check, EyeOff, X } from "lucide-react";
import { optionLabel } from "@/lib/mock-data";
import type { Option, Question } from "@/lib/types";

/**
 * Satu baris opsi jawaban. Target sentuh minimum 56 px supaya nyaman di HP
 * (PRD §9.1), dan teks opsi 15 px ke atas.
 */
export function OptionRow({
  option,
  index,
  selected,
  crossed,
  crossoutMode,
  multi,
  onSelect,
  onToggleCrossout,
  disabled,
}: {
  option: Option;
  index: number;
  selected: boolean;
  crossed: boolean;
  crossoutMode: boolean;
  multi?: boolean;
  onSelect: () => void;
  onToggleCrossout: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && !crossoutMode && onSelect()}
      onKeyDown={(e) => {
        if (disabled || crossoutMode) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "press group relative flex min-h-[56px] items-center gap-3 rounded-field border px-3 py-2.5 pr-14",
        !disabled && !crossoutMode && "cursor-pointer",
        selected
          ? "border-accent-700 bg-accent-50 ring-1 ring-accent-700"
          : "border-line bg-surface hover:border-navy-300 hover:bg-line-soft",
        crossed && "opacity-50",
        disabled && "cursor-default",
      )}
    >
      <span
        className={cn(
          "relative grid size-8 shrink-0 place-items-center rounded-full border font-heading text-[13px] font-bold transition-colors",
          selected
            ? "border-accent-700 bg-accent-400 text-navy-900"
            : "border-line bg-surface text-ink-soft",
        )}
      >
        {optionLabel(index)}
      </span>

      <span
        className={cn(
          "min-w-0 flex-1 text-[15px] leading-relaxed text-ink",
          crossed && "line-through decoration-2 decoration-clay-600",
        )}
      >
        {option.body}
      </span>

      {selected && !crossoutMode && (
        <span
          className="absolute right-4 grid size-6 place-items-center rounded-full bg-accent-500 text-navy-900"
          aria-hidden
        >
          <Check className="size-3.5" strokeWidth={3.2} />
        </span>
      )}

      {crossoutMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCrossout();
          }}
          aria-label={`${crossed ? "Batalkan coretan" : "Coret"} opsi ${optionLabel(index)}`}
          aria-pressed={crossed}
          className={cn(
            "press absolute right-1.5 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-field",
            crossed
              ? "bg-clay-100 text-clay-700 hover:bg-clay-200"
              : "text-muted hover:bg-line-soft hover:text-ink-soft",
          )}
        >
          {crossed ? (
            <X className="size-4.5" strokeWidth={2.6} aria-hidden />
          ) : (
            <EyeOff className="size-4.5" aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Satu pernyataan pada soal Benar/Salah.
 *
 * Berbeda dari `OptionRow` yang menyatakan pilihan dengan satu penanda, di sini
 * setiap pernyataan punya dua tombol yang selalu terlihat: Benar dan Salah.
 * Tombol yang selalu tampil — bukan menu atau kotak centang — karena peserta
 * harus bisa menilai tiap pernyataan tanpa membuka apa pun, dan karena keadaan
 * "belum dijawab" harus bisa dibedakan dari "dijawab Salah".
 *
 * Secara data, jawaban "Benar" berarti opsi ini masuk `selectedOptionIds`;
 * "Salah" berarti tidak. Itu sebabnya tipe ini bisa dinilai oleh aturan
 * "semua benar" yang sama dengan pilihan ganda banyak jawaban.
 */
export function TrueFalseRow({
  option,
  index,
  value,
  onAnswer,
  disabled,
}: {
  option: Option;
  index: number;
  /** `true` = Benar, `false` = Salah, `null` = belum dijawab. */
  value: boolean | null;
  onAnswer: (next: boolean) => void;
  disabled?: boolean;
}) {
  const label = `Pernyataan ${index + 1}`;

  return (
    <div className="rounded-field border border-line bg-surface p-3">
      <p className="text-[15px] leading-relaxed text-ink">
        <span className="mr-1.5 font-heading text-[13px] font-bold text-muted">{index + 1}.</span>
        {option.body}
      </p>

      <div
        role="radiogroup"
        aria-label={label}
        className="mt-2.5 grid grid-cols-2 gap-2"
      >
        {([true, false] as const).map((choice) => {
          const active = value === choice;
          return (
            <button
              key={String(choice)}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onAnswer(choice)}
              className={cn(
                "press flex min-h-11 items-center justify-center gap-1.5 rounded-field border font-heading text-[13px] font-semibold transition-colors",
                active
                  ? "border-accent-700 bg-accent-50 text-navy-900 ring-1 ring-accent-700"
                  : "border-line bg-surface text-ink-soft hover:border-navy-300 hover:bg-line-soft",
                disabled && "cursor-default opacity-60",
              )}
            >
              {active && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
              {choice ? "Benar" : "Salah"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Panel teks bacaan yang ditampilkan sebelum pertanyaan.
 *
 * Memakai `<details>` yang terbuka secara default: teks panjang (terpanjang
 * 1.824 karakter) mendorong pertanyaan ke bawah layar, dan peserta yang sudah
 * selesai membaca perlu bisa melipatnya. `<details>` dipilih karena perilaku
 * buka/tutup, aksesibilitas, dan pencarian dalam halaman sudah ditangani
 * peramban tanpa JavaScript tambahan.
 */
export function PassagePanel({ text }: { text: string }) {
  return (
    <details
      open
      className="group rounded-card border border-line bg-line-soft/60 p-3.5"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 font-heading text-[12.5px] font-bold uppercase tracking-wide text-navy-700">
        Teks bacaan
        <span className="text-[11.5px] font-semibold normal-case tracking-normal text-muted">
          <span className="group-open:hidden">Tampilkan</span>
          <span className="hidden group-open:inline">Sembunyikan</span>
        </span>
      </summary>
      <div className="mt-2 space-y-2 border-t border-line pt-3 text-[15px] leading-[1.8] text-ink">
        {text.split(/\n{2,}/).map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </details>
  );
}

export function EssayAnswer({
  value,
  onChange,
  wordMin,
  wordMax,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  wordMin?: number;
  wordMax?: number;
  disabled?: boolean;
}) {
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const over = wordMax ? words > wordMax : false;
  const under = wordMin ? words > 0 && words < wordMin : false;

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tulis jawabanmu di sini"
        className="min-h-44 w-full resize-y rounded-field border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-muted focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-900/15 disabled:bg-line-soft"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <span
          className={cn(
            "font-medium",
            over ? "text-clay-600" : under ? "text-accent-800" : "text-muted",
          )}
        >
          {words} kata
          {wordMin ? `, minimal ${wordMin}` : ""}
          {wordMax ? `, maksimal ${wordMax}` : ""}
        </span>
        {over && (
          <span className="font-semibold text-clay-600">
            Melebihi batas {words - (wordMax ?? 0)} kata. Persingkat jawabanmu.
          </span>
        )}
      </div>
    </div>
  );
}

export function QuestionHeader({
  question,
  index,
  total,
  children,
}: {
  question: Question;
  index: number;
  total: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
      <div className="flex items-center gap-2.5">
        <h2 className="font-heading text-[17px] font-bold text-ink">
          Soal {index + 1}
          <span className="font-medium text-muted"> dari {total}</span>
        </h2>
        <span className="rounded-xs bg-line-soft px-1.5 py-0.5 font-heading text-[11px] font-semibold text-muted">
          {question.type === "essay" ? "Esai" : `${question.points} poin`}
        </span>
      </div>
      {children}
    </div>
  );
}
