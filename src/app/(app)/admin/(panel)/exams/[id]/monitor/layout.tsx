import type { Metadata } from "next";
import { pageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: pageTitle("Monitor peserta") };

export default function ExamMonitorLayout({ children }: LayoutProps<"/admin/exams/[id]/monitor">) {
  return children;
}
