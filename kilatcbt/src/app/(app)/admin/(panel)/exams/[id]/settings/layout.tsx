import type { Metadata } from "next";
import { pageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: pageTitle("Pengaturan ujian") };

export default function ExamSettingsLayout({ children }: LayoutProps<"/admin/exams/[id]/settings">) {
  return children;
}
