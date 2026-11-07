import type { Metadata } from "next";
import { pageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: pageTitle("Masuk admin") };

export default function AdminLoginLayout({ children }: LayoutProps<"/admin/login">) {
  return children;
}
