import type { Metadata } from "next";
import { pageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: pageTitle("Akun") };

export default function AdminAccountLayout({ children }: LayoutProps<"/admin/account">) {
  return children;
}
