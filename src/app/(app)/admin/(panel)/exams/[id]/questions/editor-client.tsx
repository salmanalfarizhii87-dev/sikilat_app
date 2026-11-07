"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  QuestionEditor,
  questionFromModel,
  questionToPayload,
  type DraftQuestion,
} from "@/components/admin/question-editor";
import { saveExamQuestions } from "@/features/questions/actions";
import type { AdminQuestion } from "@/features/questions/types";

/**
 * Editor soal yang benar-benar menyimpan (T3.9, T4.2).
 *
 * Nilai awal datang dari Server Component (`getExamQuestions`). `locked` juga
 * dari server (`examHasAttempts`), bukan `const locked = true` seperti versi
 * sebelumnya — dulu ujian yang baru dibuat pun tampil terkunci.
 *
 * Soal disimpan sebagai satu daftar, bukan per baris. Konsekuensinya ID soal
 * berubah setiap kali disimpan (RPC menghapus lalu membuat ulang), sehingga
 * state lokal harus disegarkan dari server setelah simpan. Itu ditangani dengan
 * membandingkan identitas prop: `revalidatePath` di Server Action membuat
 * router memuat ulang data, dan pola di bawah ini mengganti draft dengan data
 * baru saat itu terjadi.
 */
export function ExamQuestionsEditor({
  examId,
  initialQuestions,
  locked,
}: {
  examId: string;
  initialQuestions: AdminQuestion[];
  locked: boolean;
}) {
  const router = useRouter();

  /*
   * Tanda tangan data server: daftar ID soal dalam urutan tampil.
   *
   * RPC `save_exam_questions` menghapus lalu membuat ulang baris soal, jadi
   * setiap penyimpanan menghasilkan ID baru. Tanda tangan ini dipakai untuk
   * mengetahui kapan draft lokal harus diganti data server — dan sengaja
   * **hanya** ID, bukan seluruh isi: render ulang server yang tidak mengubah
   * soal (mis. `router.refresh()` dari tab lain) tidak boleh menghapus
   * ketikan yang belum disimpan.
   */
  const signature = initialQuestions.map((question) => question.id).join(",");

  const [state, setState] = React.useState(() => ({
    signature,
    draft: initialQuestions.map(questionFromModel),
  }));

  /*
   * Menyesuaikan state saat prop berubah — pola resmi React ("adjusting state
   * when a prop changes"), bukan efek. Efek akan menampilkan satu bingkai data
   * lama lebih dulu, dan di sini data lama itu berarti ID soal yang sudah tidak
   * ada di database.
   */
  if (state.signature !== signature) {
    setState({ signature, draft: initialQuestions.map(questionFromModel) });
  }

  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const questions = state.draft;

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  const essayCount = questions.filter((q) => q.type === "essay").length;
  const imageCount = questions.filter(
    (q) => q.mediaPath || q.options.some((option) => option.mediaPath),
  ).length;

  const setQuestions = (next: DraftQuestion[]) => {
    setState((prev) => ({ ...prev, draft: next }));
    setError(null);
  };

  const save = async () => {
    setPending(true);
    setError(null);

    const result = await saveExamQuestions(examId, questions.map(questionToPayload));

    setPending(false);

    if (!result.ok) {
      setError(result.error.message);
      toast.error(result.error.message);
      return;
    }

    toast.success(
      `${result.data.questions} soal tersimpan (${result.data.options} opsi).`,
    );
    router.refresh();
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="md" onClick={save} disabled={locked || pending || questions.length === 0}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          {pending ? "Menyimpan…" : "Simpan soal"}
        </Button>
        <p className="text-[12.5px] text-muted">
          {questions.length} soal · {totalPoints} poin
          {essayCount > 0 && ` · ${essayCount} esai`}
          {imageCount > 0 && ` · ${imageCount} bergambar`}
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-3 rounded-field border border-clay-200 bg-clay-50 px-3 py-2 text-[12.5px] font-medium text-clay-700"
        >
          {error}
        </p>
      )}

      <QuestionEditor
        questions={questions}
        onChange={setQuestions}
        locked={locked}
        emptyLabel="Belum ada soal"
      />
    </>
  );
}
