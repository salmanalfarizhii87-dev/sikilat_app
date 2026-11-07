import type { Metadata } from "next";
import { pageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: pageTitle("Penilaian esai") };

export default function ExamGradingLayout({ children }: LayoutProps<"/admin/exams/[id]/grading/[attemptId]">) {
  return children;
}
