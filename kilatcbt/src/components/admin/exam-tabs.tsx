"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = (id: string) => [
  { href: `/admin/exams/${id}`, label: "Ringkasan" },
  { href: `/admin/exams/${id}/questions`, label: "Soal" },
  { href: `/admin/exams/${id}/settings`, label: "Pengaturan" },
  { href: `/admin/exams/${id}/monitor`, label: "Monitor" },
  { href: `/admin/exams/${id}/results`, label: "Rekap nilai" },
];

export function ExamTabs({ examId }: { examId: string }) {
  const pathname = usePathname();

  return (
    // Lima tab tidak muat sebaris di 360-390 px. Sebelumnya strip ini hanya
    // bisa digeser, sehingga "Rekap nilai" tersembunyi tanpa petunjuk. Membungkus
    // ke baris kedua lebih jujur daripada menyembunyikan tujuan navigasi.
    <div className="-mx-1 mb-4 flex flex-wrap gap-1 px-1 pb-1">
      {tabs(examId).map((tab) => {
        const active =
          tab.href === `/admin/exams/${examId}`
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              // Target sentuh 44 px (R-03). Tab ini ada di layar admin desktop
              // tetapi juga muncul di HP, jadi tingginya tidak boleh 40 px.
              "press inline-flex min-h-11 shrink-0 items-center rounded-full border px-3.5 py-1.5 font-heading text-[12.5px] font-semibold transition-colors",
              active
                ? "border-navy-800 bg-navy-800 text-white"
                : "border-line bg-surface text-ink-soft hover:bg-line-soft",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
