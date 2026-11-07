"use client";

import * as React from "react";
import { Check, Copy, ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOriginLabel } from "@/lib/client-hooks";
import type { ExamStatus } from "@/lib/types";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-[12.5px] text-muted">{eyebrow}</p>}
          <h1 className="font-heading text-[22px] font-extrabold leading-tight tracking-tight text-ink sm:text-[26px]">
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/*
 * Satu kartu statistik. Tanpa ikon dekoratif dan tanpa delta persentase:
 * ikon di setiap kartu hanya mengulang label, dan delta butuh deret waktu nyata
 * yang belum ada (DESIGN.md §9).
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "plain",
  marker,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "plain" | "amber" | "navy" | "green" | "red";
  marker?: boolean;
}) {
  const tones = {
    plain: "bg-surface border-line",
    amber: "bg-accent-50 border-accent-200",
    navy: "bg-navy-900 border-navy-900",
    green: "bg-leaf-50 border-leaf-200",
    red: "bg-clay-50 border-clay-200",
  } as const;

  const isDark = tone === "navy";

  return (
    <div className={cn("relative overflow-hidden rounded-card border px-3.5 py-3", tones[tone])}>
      {/* Motif identitas: garis tipis di tepi atas (DESIGN.md §10). */}
      {marker && (
        <span
          className={cn("absolute inset-x-0 top-0 h-[3px]", isDark ? "bg-accent-400" : "bg-navy-800")}
          aria-hidden
        />
      )}
      <p
        className={cn(
          "text-[12.5px] font-medium leading-snug",
          isDark ? "text-white/75" : "text-muted",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-heading text-[24px] font-extrabold leading-none tabular",
          isDark ? "text-white" : "text-ink",
        )}
      >
        {value}
      </p>
      {hint && (
        <p
          className={cn("mt-1.5 text-[11.5px] leading-snug", isDark ? "text-white/70" : "text-muted")}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

export function StatusBadge({
  status,
}: {
  status: ExamStatus | "in_progress" | "needs_grading" | "graded";
}) {
  const map = {
    draft: { label: "Draft", cls: "bg-line-soft text-ink-soft border-line" },
    published: { label: "Aktif", cls: "bg-leaf-100 text-leaf-800 border-leaf-200" },
    archived: { label: "Arsip", cls: "bg-line-soft text-muted border-line" },
    in_progress: { label: "Mengerjakan", cls: "bg-navy-900 text-white border-navy-900" },
    needs_grading: { label: "Perlu dinilai", cls: "bg-accent-100 text-accent-900 border-accent-200" },
    graded: { label: "Selesai", cls: "bg-leaf-100 text-leaf-800 border-leaf-200" },
  } as const;
  const item = map[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-xs border px-1.5 py-0.5 font-heading text-[11.5px] font-semibold leading-tight",
        item.cls,
      )}
    >
      {item.label}
    </span>
  );
}

export function CopyButton({
  value,
  label = "Salin",
  size = "sm",
  variant = "secondary",
  className,
}: {
  value: string;
  label?: string;
  size?: "sm" | "md";
  variant?: "secondary" | "ghost" | "dark";
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Disalin ke clipboard");
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          toast.error("Gagal menyalin. Salin manual ya.");
        }
      }}
      className={cn(
        "press inline-flex items-center gap-1.5 rounded-field border font-heading font-semibold",
        // Kedua ukuran tetap memenuhi target sentuh 44 px (R-03); yang berubah
        // hanya lebar dan ukuran teks, bukan tinggi.
        size === "sm" ? "h-11 px-3 text-[12.5px]" : "h-11 px-3.5 text-[13px]",
        variant === "secondary" && "border-line bg-surface text-ink-soft hover:bg-line-soft",
        variant === "ghost" && "border-transparent text-ink-soft hover:bg-line-soft",
        variant === "dark" && "border-navy-900 bg-navy-900 text-white hover:bg-navy-700",
        className,
      )}
    >
      {copied ? (
        <Check className="size-3.5" strokeWidth={3} aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
      {copied ? "Tersalin" : label}
    </button>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  label = "Cari",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-11 w-full rounded-field border border-line bg-surface pl-9 pr-3 text-[13px] text-ink placeholder:text-muted focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-900/15"
      />
    </div>
  );
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (key: T) => void;
  label?: string;
}) {
  return (
    <div
      className="scroll-thin flex gap-1.5 overflow-x-auto pb-0.5"
      role="group"
      aria-label={label}
    >
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          aria-pressed={value === opt.key}
          className={cn(
            "press flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-heading text-[12.5px] font-semibold transition-colors",
            value === opt.key
              ? "border-navy-900 bg-navy-900 text-white"
              : "border-line bg-surface text-ink-soft hover:bg-line-soft",
          )}
        >
          {opt.label}
          {typeof opt.count === "number" && (
            <span
              className={cn(
                "rounded-full px-1.5 text-[11px] tabular",
                value === opt.key ? "bg-white/20 text-white" : "bg-line-soft text-muted",
              )}
            >
              {opt.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  padded = true,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  padded?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-card border border-line bg-surface", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="font-heading text-[14.5px] font-bold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[12px] text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={padded ? "p-4" : undefined}>{children}</div>
    </section>
  );
}

export function ExamLinkRow({ code }: { code: string }) {
  const origin = useOriginLabel();
  const url = `https://${origin}/u/${code}`;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-field border border-line bg-canvas px-3 py-2">
      <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-soft">{url}</code>
      <CopyButton value={url} label="Salin tautan" variant="ghost" />
      <a
        href={`/u/${code}`}
        target="_blank"
        rel="noreferrer"
        className="press inline-flex size-11 items-center justify-center rounded-field border border-line bg-surface text-ink-soft hover:bg-line-soft"
        aria-label="Buka halaman peserta di tab baru"
      >
        <ExternalLink className="size-3.5" aria-hidden />
      </a>
    </div>
  );
}
