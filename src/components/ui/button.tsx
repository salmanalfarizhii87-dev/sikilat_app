"use client";

import { cn } from "@/lib/utils";
import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark" | "soft";
type Size = "sm" | "md" | "lg" | "icon";

/*
 * Radius: tombol memakai `rounded-field` (10px) supaya bentuknya menyatakan
 * "ini kontrol", bukan "ini kartu". Alasan lengkap di DESIGN.md §5.
 */
const variants: Record<Variant, string> = {
  primary:
    "bg-accent-400 text-navy-900 border border-accent-600 hover:bg-accent-500 disabled:bg-accent-100 disabled:border-accent-200 disabled:text-accent-800",
  secondary:
    "bg-surface text-ink border border-line hover:bg-line-soft disabled:text-faint",
  soft: "bg-line-soft text-ink-soft border border-transparent hover:bg-line disabled:text-faint",
  ghost:
    "bg-transparent text-ink-soft border border-transparent hover:bg-line-soft disabled:text-faint",
  danger:
    "bg-clay-600 text-white border border-transparent hover:bg-clay-700 disabled:bg-clay-200 disabled:text-clay-700",
  dark: "bg-navy-900 text-white border border-transparent hover:bg-navy-700 disabled:bg-navy-300",
};

const sizes: Record<Size, string> = {
  // Semua ukuran tetap ≥ 44 px tinggi (R-03). Yang mengecil hanya padding dan
  // ukuran teks, bukan area sentuh.
  sm: "h-11 px-3.5 text-[13px] gap-1.5 rounded-field",
  md: "h-11 px-4 text-[14px] gap-2 rounded-field",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-field",
  icon: "size-11 rounded-field justify-center",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", block, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "press inline-flex select-none items-center justify-center font-heading font-semibold disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        block && "w-full",
        className,
      )}
      {...props}
    />
  );
});
