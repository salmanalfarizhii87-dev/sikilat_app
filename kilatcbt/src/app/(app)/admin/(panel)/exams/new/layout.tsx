import type { Metadata } from "next";
import { pageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: pageTitle("Buat ujian") };

export default function NewExamLayout({ children }: LayoutProps<"/admin/exams/new">) {
  return children;
}
