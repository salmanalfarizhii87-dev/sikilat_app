import { cn } from "@/lib/utils";
import { Database } from "lucide-react";
import Image from "next/image";

/*
 * Badge dipakai hanya untuk status nyata (draft/aktif/arsip, lolos/tidak).
 * Tidak ada badge dekoratif di atas judul. Lihat DESIGN.md §3 dan §11.
 */
export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "amber" | "green" | "red" | "navy" | "outline";
  className?: string;
}) {
  const tones = {
    neutral: "bg-line-soft text-ink-soft border-line",
    amber: "bg-accent-100 text-accent-900 border-accent-200",
    green: "bg-leaf-100 text-leaf-800 border-leaf-200",
    red: "bg-clay-50 text-clay-700 border-clay-200",
    navy: "bg-navy-900 text-white border-navy-900",
    outline: "bg-surface text-muted border-line",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-xs border px-1.5 py-0.5 font-heading text-[11.5px] font-semibold leading-tight",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Logo({
  size = "md",
  showWordmark = true,
  className,
}: {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}) {
  const dims = { sm: "h-7", md: "h-9", lg: "h-11" } as const;
  const px = { sm: 28, md: 36, lg: 44 } as const;
  const text = { sm: "text-[15px]", md: "text-[18px]", lg: "text-[22px]" } as const;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/logo-sikilat.png"
        alt=""
        width={771}
        height={1016}
        sizes={`${px[size]}px`}
        className={cn("w-auto object-contain", dims[size])}
      />
      {showWordmark && (
        <span className={cn("font-heading font-extrabold tracking-tight text-ink", text[size])}>
          si<span className="text-navy-600">Kilat</span>
        </span>
      )}
    </span>
  );
}

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag className={cn("rounded-card border border-line bg-surface", className)}>{children}</Tag>
  );
}

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-heading text-[20px] font-bold text-ink">{title}</h2>
        {description && <p className="mt-1 text-[14px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {icon && (
        <div className="grid size-12 place-items-center rounded-card bg-line-soft text-navy-600">
          {icon}
        </div>
      )}
      <div>
        <p className="font-heading text-[15px] font-bold text-ink">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-sm text-[13.5px] leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/*
 * Penanda kejujuran data (DESIGN.md §9). Semua angka di panel admin berasal dari
 * data contoh, jadi layar yang menampilkannya harus mengatakannya.
 */
export function SampleDataNote({
  children = "Angka di halaman ini berasal dari data contoh, bukan hasil ujian sungguhan.",
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-1.5 rounded-field border border-line bg-line-soft px-2.5 py-1.5 text-[12px] leading-snug text-muted",
        className,
      )}
    >
      <Database className="mt-px size-3.5 shrink-0 text-navy-600" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
