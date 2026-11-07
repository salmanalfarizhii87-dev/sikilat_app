import type { Metadata } from "next";
import { pageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: pageTitle("Daftar ujian") };

export default function ExamsLayout({ children }: LayoutProps<"/admin/exams">) {
  return children;
}
