"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Label dan kontrol harus selalu terhubung. Sebelumnya `htmlFor` opsional dan
 * sebagian besar form tidak mengisinya, sehingga pembaca layar mengumumkan
 * input tanpa nama. Sekarang id dibuat otomatis dan diteruskan ke anak
 * tunggalnya bila anak itu belum punya id sendiri.
 */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const autoId = React.useId();
  const id = htmlFor ?? autoId;

  // Hanya kontrol form yang boleh menerima `id`. Kalau anaknya pembungkus
  // (mis. div berisi input + tombol lihat password), id akan menimpa id input
  // di dalamnya dan label menunjuk elemen yang salah.
  const isControl =
    React.isValidElement(children) &&
    (children.type === Input || children.type === Textarea || children.type === Select);

  const child = isControl
    ? React.cloneElement(children as React.ReactElement<{ id?: string; "aria-invalid"?: boolean }>, {
        id: (children.props as { id?: string }).id ?? id,
        ...(error ? { "aria-invalid": true } : {}),
      })
    : children;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-semibold text-ink">
          {label}
          {required && (
            <span className="ml-0.5 text-clay-600" aria-hidden>
              *
            </span>
          )}
        </label>
        {hint && <span className="text-[12px] text-muted">{hint}</span>}
      </div>
      {child}
      {error && (
        <p role="alert" className="text-[12.5px] font-medium text-clay-600">
          {error}
        </p>
      )}
    </div>
  );
}

const base =
  "w-full rounded-field border border-line bg-surface px-3.5 text-[14px] text-ink placeholder:text-muted transition-colors hover:border-navy-300 focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-900/15 disabled:bg-line-soft disabled:text-muted";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, "h-11", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({
  className,
  children,
  id,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        id={id}
        className={cn(base, "h-11 appearance-none pr-9 font-medium", className)}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
