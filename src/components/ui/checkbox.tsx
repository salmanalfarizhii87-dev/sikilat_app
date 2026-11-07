"use client";

import { cn } from "@/lib/utils";
import { Check, Minus } from "lucide-react";

export function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (next: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "press flex items-start gap-3",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-[5px] border transition-colors",
            checked || indeterminate
              ? "border-navy-800 bg-navy-800 text-white"
              : "border-line bg-surface peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-navy-800",
          )}
        >
          {indeterminate && !checked ? (
            <Minus className="size-3.5" strokeWidth={3} aria-hidden />
          ) : checked ? (
            <Check className="size-3.5" strokeWidth={3} aria-hidden />
          ) : null}
        </span>
      </span>
      {(label || description) && (
        <span className="min-w-0 flex-1">
          {label && <span className="block text-[14px] font-semibold text-ink">{label}</span>}
          {description && (
            <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", disabled && "opacity-60")}>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-ink">{label}</p>
        {description && (
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === "string" ? label : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          // Area sentuh 44 px; yang terlihat tetap rel setinggi 28 px di tengah.
          "press -my-2 grid h-11 w-12 shrink-0 place-items-center",
          disabled && "cursor-not-allowed",
        )}
      >
        <span
          className={cn(
            "relative block h-7 w-12 rounded-full border transition-colors",
            checked ? "border-navy-800 bg-navy-800" : "border-line bg-line-soft",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-[22px] rounded-full bg-white shadow-sm transition-all",
              checked ? "left-[26px]" : "left-0.5",
            )}
          />
        </span>
      </button>
    </div>
  );
}
