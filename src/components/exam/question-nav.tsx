"use client";

import { cn } from "@/lib/utils";
import { Flag, Lock } from "lucide-react";
import type { QuestionType } from "@/lib/types";

export type NavFilter = "all" | "answered" | "empty" | "flagged";

/**
 * Jawaban minimal yang dibutuhkan navigasi soal.
 *
 * Sengaja bukan tipe `Attempt` penuh: grid ini hanya perlu tahu apakah soal
 * sudah terjawab dan apakah ditandai ragu. Menerima seluruh attempt akan
 * membuatnya ikut berubah setiap kali bentuk attempt berubah, padahal
 * kebutuhannya tidak.
 */
export interface NavAnswer {
  selectedOptionIds: string[];
  essayText: string;
  flagged: boolean;
  touched?: boolean;
}

export function questionState(
  question: { id: string; type: QuestionType },
  answers: Record<string, NavAnswer | undefined> | null | undefined,
): { answered: boolean; flagged: boolean } {
  const ans = answers?.[question.id];
  const answered =
    !!ans &&
    (question.type === "essay"
      ? ans.essayText.trim().length > 0
      : // Soal Benar/Salah yang dijawab "Salah" untuk semua pernyataan punya
        // daftar opsi kosong, jadi `touched` yang menentukan sudah dijawab.
        ans.selectedOptionIds.length > 0 || ans.touched === true);
  return { answered, flagged: !!ans?.flagged };
}

/**
 * Kotak nomor soal. 44 px ke atas supaya tetap nyaman ditekan di HP
 * (PRD Â§9.1). Status tidak dibedakan hanya dengan warna: soal terisi memakai
 * isi amber, soal ragu membawa ikon bendera.
 */
export function QuestionGrid({
  questions,
  answers,
  currentId,
  onJump,
  filter = "all",
  dense,
}: {
  questions: { id: string; type: QuestionType }[];
  answers: Record<string, NavAnswer | undefined> | null | undefined;
  currentId?: string;
  onJump: (id: string) => void;
  filter?: NavFilter;
  dense?: boolean;
}) {
  const visible = questions.filter((q) => {
    const state = questionState(q, answers);
    if (filter === "answered") return state.answered;
    if (filter === "empty") return !state.answered;
    if (filter === "flagged") return state.flagged;
    return true;
  });

  if (visible.length === 0) {
    return (
      <p className="rounded-field bg-line-soft px-3 py-4 text-center text-[12px] leading-relaxed text-muted">
        Tidak ada soal pada filter ini.
      </p>
    );
  }

  return (
    <div className={cn("grid gap-2", dense ? "grid-cols-6 sm:grid-cols-8" : "grid-cols-5 sm:grid-cols-6")}>
      {visible.map((q) => {
        const state = questionState(q, answers);
        const isCurrent = q.id === currentId;
        const number = questions.findIndex((x) => x.id === q.id) + 1;
        return (
          <button
            key={q.id}
            type="button"
            onClick={() => onJump(q.id)}
            aria-label={`Soal ${number}${state.answered ? ", sudah dijawab" : ", belum dijawab"}${
              state.flagged ? ", ditandai ragu" : ""
            }`}
            aria-current={isCurrent ? "true" : undefined}
            className={cn(
              "press relative flex h-11 w-full items-center justify-center rounded-xs border font-heading text-[13.5px] font-semibold tabular",
              isCurrent
                ? "border-navy-900 bg-navy-900 text-white ring-2 ring-accent-400 ring-offset-1"
                : state.answered
                  ? "border-accent-300 bg-accent-100 text-accent-900 hover:bg-accent-200"
                  : "border-line bg-surface text-ink-soft hover:border-navy-300 hover:bg-line-soft",
            )}
          >
            {number}
            {state.flagged && (
              <span
                className={cn(
                  "absolute right-0.5 top-0.5 grid size-3 place-items-center rounded-full",
                  isCurrent ? "bg-accent-400 text-navy-900" : "bg-accent-500 text-navy-900",
                )}
                aria-hidden
              >
                <Flag className="size-2" strokeWidth={3.5} fill="currentColor" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function NavLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] font-medium text-muted">
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-xs border border-accent-300 bg-accent-100" aria-hidden />{" "}
        Terisi
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-xs border border-line bg-surface" aria-hidden /> Kosong
      </span>
      <span className="flex items-center gap-1.5">
        <Flag className="size-3 fill-accent-500 text-accent-700" aria-hidden /> Ragu
      </span>
    </div>
  );
}

export function LockedNotice() {
  return (
    <div className="flex items-start gap-2.5 rounded-field border border-accent-200 bg-accent-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-accent-900">
      <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <p>Soal dan opsi terkunci karena sudah ada peserta yang mengerjakan.</p>
    </div>
  );
}
