"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CodeForm({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) {
      setError("Kode ujian minimal 4 karakter. Contoh: MAT7A2.");
      return;
    }
    setError(null);
    setPending(true);
    router.push(`/u/${clean}`);
  };

  return (
    <form onSubmit={submit} className="w-full max-w-md">
      <label htmlFor="kode-ujian" className="block text-[13px] font-semibold text-ink">
        Kode ujian
      </label>
      <div
        className={cn(
          "mt-1.5 flex items-center gap-2 rounded-field border bg-surface p-1.5 pl-3.5 transition-colors",
          error ? "border-clay-500" : "border-line focus-within:border-navy-700",
        )}
      >
        <input
          id="kode-ujian"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase().slice(0, 10));
            setError(null);
          }}
          placeholder="MAT7A2"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? "kode-error" : "kode-hint"}
          className="h-11 min-w-0 flex-1 bg-transparent font-heading text-[16px] font-semibold uppercase tracking-[0.12em] text-ink outline-none placeholder:font-sans placeholder:text-[14px] placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-muted"
        />
        <Button type="submit" size="md" disabled={pending} className={compact ? "px-3.5" : ""}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Masuk
          {!pending && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </div>
      {error ? (
        <p id="kode-error" role="alert" className="mt-2 text-[12.5px] font-medium text-clay-600">
          {error}
        </p>
      ) : (
        <p id="kode-hint" className="mt-2 text-[12px] text-muted">
          Kode diberikan oleh pembuat ujian. Huruf besar atau kecil sama saja.
        </p>
      )}
    </form>
  );
}
