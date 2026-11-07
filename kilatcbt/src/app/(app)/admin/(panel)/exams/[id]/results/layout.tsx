import type { Metadata } from "next";
import { pageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: pageTitle("Rekap nilai") };

export default function ExamResultsLayout({ children }: LayoutProps<"/admin/exams/[id]/results">) {
  return children;
}
