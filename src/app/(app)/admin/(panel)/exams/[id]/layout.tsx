import type { Metadata } from "next";
import { getExam } from "@/features/exams/queries";
import { pageTitle } from "@/lib/page-title";

/**
 * Judul tab detail ujian memakai judul ujiannya sendiri.
 *
 * Sebelumnya diambil dari `demoExams.find(...)` — daftar ujian contoh dengan ID
 * `exm_01`. Untuk ujian sungguhan (UUID) hasilnya selalu `null`, jadi setiap tab
 * berbunyi "Detail ujian" dan judulnya tidak pernah berguna.
 *
 * `getExam` mengembalikan `null` bila ID tidak ada; di situ judul generik dipakai
 * karena halaman di bawahnya sendiri yang akan menampilkan 404.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  try {
    const exam = await getExam(id);
    return { title: pageTitle(exam?.title ?? "Detail ujian") };
  } catch {
    // Judul tab bukan alasan menggagalkan seluruh halaman.
    return { title: pageTitle("Detail ujian") };
  }
}

export default function ExamDetailLayout({ children }: LayoutProps<"/admin/exams/[id]">) {
  return children;
}
