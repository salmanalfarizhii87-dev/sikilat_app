import type { Metadata } from "next";
import { pageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: pageTitle("Editor soal") };

export default function ExamQuestionsLayout({ children }: LayoutProps<"/admin/exams/[id]/questions">) {
  return children;
}
