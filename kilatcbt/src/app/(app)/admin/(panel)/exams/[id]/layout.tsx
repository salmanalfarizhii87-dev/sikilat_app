import type { Metadata } from "next";
import { demoExams } from "@/lib/mock-data";
import { pageTitle } from "@/lib/page-title";

/** Judul detail ujian memakai judul ujiannya sendiri, bukan label generik. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const exam = demoExams.find((item) => item.id === id);
  return { title: pageTitle(exam?.title ?? "Detail ujian") };
}

export default function ExamDetailLayout({ children }: LayoutProps<"/admin/exams/[id]">) {
  return children;
}
