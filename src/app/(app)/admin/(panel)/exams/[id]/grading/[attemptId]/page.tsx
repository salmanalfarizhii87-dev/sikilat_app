import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAttemptForGrading } from "@/features/grading/queries";
import { GradingClient } from "./grading-client";

/**
 * Halaman penilaian esai (T6.1, T6.2, T6.3).
 *
 * Sebelumnya komponen ini membaca `demoQuestions` dan `demoAttempts`, sehingga
 * ID attempt nyata (UUID) tidak pernah ditemukan dan nilai yang diketik admin
 * hanya tinggal di memori peramban.
 *
 * `notFound()` dipakai untuk attempt yang tidak ada **maupun** yang bukan milik
 * ujian di URL — `getAttemptForGrading` sudah menyaring keduanya, jadi tidak ada
 * perbedaan yang bisa dimanfaatkan untuk menebak ID attempt ujian lain.
 */
export const metadata: Metadata = { title: "Penilaian esai" };

export default async function GradingPage({
  params,
}: PageProps<"/admin/exams/[id]/grading/[attemptId]">) {
  const { id, attemptId } = await params;

  const attempt = await getAttemptForGrading(id, attemptId);
  if (!attempt) notFound();

  return <GradingClient attempt={attempt} />;
}
