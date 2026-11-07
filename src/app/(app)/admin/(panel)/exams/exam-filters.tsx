"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterChips } from "@/components/admin/ui";

/**
 * Kontrol daftar yang menyimpan keadaannya di URL (T3.5).
 *
 * Kenapa URL, bukan `useState`:
 *
 * - Filter dan halaman bisa dibagikan dan di-bookmark. Guru yang mengirim
 *   "daftar ujian yang diarsipkan" ke rekan kerja mengirim maksud yang sama.
 * - Tombol Back peramban bekerja seperti yang diharapkan.
 * - Server Component bisa membaca `searchParams` dan memfilter di database.
 *   Dengan `useState`, seluruh tabel harus dikirim ke peramban lebih dulu —
 *   persis yang tidak boleh terjadi saat ujian bertambah banyak.
 *
 * `router.replace` dipakai, bukan `push`: setiap ketikan di kotak cari tidak
 * boleh menambah satu entri riwayat. Tanpa itu, menekan Back setelah mengetik
 * "matematika" akan menghapus satu huruf per tekanan.
 */

/** Bangun URL baru dari parameter sekarang + perubahan. */
function buildHref(
  pathname: string,
  params: URLSearchParams,
  patch: Record<string, string | null>,
): string {
  const next = new URLSearchParams(params.toString());

  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
  }

  /*
   * Setiap perubahan filter mengembalikan ke halaman 1. Tanpa ini, berada di
   * halaman 3 lalu memfilter status akan menghasilkan halaman kosong —
   * "tidak ada ujian" padahal ujiannya ada di halaman 1.
   */
  if (!("page" in patch)) next.delete("page");

  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function ExamSearchInput({
  value,
  placeholder,
}: {
  value: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  /*
   * Input dikendalikan state lokal yang disinkronkan dari URL, bukan langsung
   * dari URL. Kalau nilainya dibaca dari `searchParams`, setiap ketikan memicu
   * navigasi server dan kursor bisa meloncat saat hasil render datang.
   *
   * Sinkronisasinya memakai pola "menyesuaikan state saat render" dari React:
   * membandingkan nilai sebelumnya lalu menulis state **di dalam render**, bukan
   * di `useEffect`. Menulis state di effect memicu render berantai yang tidak
   * perlu — dan eslint `react-hooks/set-state-in-effect` menolaknya dengan
   * alasan yang tepat.
   */
  const [text, setText] = React.useState(value);
  const [lastValue, setLastValue] = React.useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }

  React.useEffect(() => {
    if (text === value) return;

    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(queryString);
      const trimmed = text.trim();
      if (trimmed) next.set("search", trimmed);
      else next.delete("search");
      next.delete("page");

      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [text, value, queryString, router, pathname]);

  const applyNow = () => {
    const next = new URLSearchParams(queryString);
    const trimmed = text.trim();
    if (trimmed) next.set("search", trimmed);
    else next.delete("search");
    next.delete("page");

    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <form
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        // Enter langsung menerapkan tanpa menunggu jeda ketik.
        applyNow();
      }}
      role="search"
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        aria-label="Cari ujian"
        className="h-11 w-full rounded-field border border-line bg-surface pl-9 pr-3 text-[13px] text-ink placeholder:text-muted focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-900/15"
      />
    </form>
  );
}

export function ExamStatusFilter({
  value,
  counts,
}: {
  value: "all" | "draft" | "published" | "archived";
  counts: Record<"all" | "draft" | "published" | "archived", number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <FilterChips
      label="Filter status ujian"
      value={value}
      onChange={(next) => {
        router.replace(
          buildHref(pathname, new URLSearchParams(searchParams.toString()), {
            status: next === "all" ? null : next,
          }),
          { scroll: false },
        );
      }}
      options={[
        { key: "all", label: "Semua", count: counts.all },
        { key: "published", label: "Aktif", count: counts.published },
        { key: "draft", label: "Draft", count: counts.draft },
        { key: "archived", label: "Arsip", count: counts.archived },
      ]}
    />
  );
}

/** Navigasi halaman sebelumnya/berikutnya, juga lewat URL. */
export function ExamPagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  const go = (target: number) => {
    router.replace(
      buildHref(pathname, new URLSearchParams(searchParams.toString()), {
        page: target === 1 ? null : String(target),
      }),
      { scroll: false },
    );
  };

  if (totalPages <= 1) {
    return (
      <p className="mt-4 text-[12px] text-muted">
        {total === 0 ? "Tidak ada ujian." : `Menampilkan ${total} ujian.`}
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <p className="text-[12px] text-muted">
        Menampilkan {first}–{last} dari {total} ujian.
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className={cn(
            "press inline-flex h-11 items-center rounded-field border border-line px-3 font-heading text-[12.5px] font-semibold",
            page <= 1 ? "cursor-not-allowed text-faint" : "text-ink-soft hover:bg-line-soft",
          )}
        >
          Sebelumnya
        </button>
        <span className="px-1 text-[12px] tabular text-muted">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className={cn(
            "press inline-flex h-11 items-center rounded-field border border-line px-3 font-heading text-[12.5px] font-semibold",
            page >= totalPages
              ? "cursor-not-allowed text-faint"
              : "text-ink-soft hover:bg-line-soft",
          )}
        >
          Berikutnya
        </button>
      </div>
    </div>
  );
}

/** Tombol "tampilkan semua" untuk keadaan kosong. */
export function ExamResetFilters({ label = "Tampilkan semua ujian" }: { label?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <button
      type="button"
      onClick={() => router.replace(pathname, { scroll: false })}
      className="press inline-flex h-11 items-center rounded-field bg-accent-400 px-4 font-heading text-[13px] font-semibold text-navy-900 hover:bg-accent-500"
    >
      {label}
    </button>
  );
}
