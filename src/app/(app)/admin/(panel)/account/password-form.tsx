"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Panel } from "@/components/admin/ui";
import { updatePassword } from "@/features/auth/actions";

/**
 * Formulir ganti kata sandi (T2.6).
 *
 * Pemeriksaan bentuk di sini hanya untuk **kecepatan umpan balik**; aturan yang
 * mengikat tetap ada di `updatePasswordSchema` di server. Logika validasi tidak
 * diduplikasi di sini — bila berbeda, pengguna akan melihat dua jawaban berbeda
 * untuk input yang sama.
 *
 * Setelah kata sandi berganti, semua sesi diakhiri (termasuk yang ini), jadi
 * pengguna diarahkan ke halaman masuk.
 */
export function PasswordForm() {
  const router = useRouter();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [pending, setPending] = React.useState(false);

  const strength = React.useMemo(() => {
    let score = 0;
    if (next.length >= 8) score += 1;
    if (/[A-Z]/.test(next)) score += 1;
    if (/[0-9]/.test(next)) score += 1;
    if (/[^A-Za-z0-9]/.test(next)) score += 1;
    return score;
  }, [next]);

  const clearErrors = () => {
    setError(null);
    setFieldErrors({});
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    clearErrors();
    setPending(true);

    try {
      const result = await updatePassword({
        currentPassword: current,
        newPassword: next,
        confirmPassword: confirm,
      });

      if (!result.ok) {
        setError(result.error.message);
        if (result.error.fields) setFieldErrors(result.error.fields);
        return;
      }

      toast.success("Kata sandi diperbarui. Silakan masuk lagi dengan kata sandi baru.");
      /*
       * Sesi sudah diakhiri di server. `refresh()` dulu supaya Server Component
       * tidak memakai muatan cache saat sesi masih ada, baru pindah ke halaman masuk.
       */
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setError("Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Panel title="Ganti password">
      <form onSubmit={submit} className="space-y-3.5">
        <Field
          label="Password saat ini"
          required
          htmlFor="current"
          error={fieldErrors.currentPassword?.[0]}
        >
          <Input
            id="current"
            type={show ? "text" : "password"}
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value);
              clearErrors();
            }}
            placeholder="Password lama"
            autoComplete="current-password"
          />
        </Field>

        <Field
          label="Password baru"
          required
          htmlFor="next"
          error={fieldErrors.newPassword?.[0]}
          hint={
            <span className="flex items-center gap-1" aria-hidden>
              {[1, 2, 3, 4].map((n) => (
                <span
                  key={n}
                  className={
                    strength >= n
                      ? strength <= 2
                        ? "h-1 w-5 rounded-full bg-clay-500"
                        : strength === 3
                          ? "h-1 w-5 rounded-full bg-accent-500"
                          : "h-1 w-5 rounded-full bg-leaf-600"
                      : "h-1 w-5 rounded-full bg-line"
                  }
                />
              ))}
            </span>
          }
        >
          <Input
            id="next"
            type={show ? "text" : "password"}
            value={next}
            onChange={(e) => {
              setNext(e.target.value);
              clearErrors();
            }}
            placeholder="Minimal 8 karakter, ada huruf besar dan angka"
            autoComplete="new-password"
          />
        </Field>

        <Field
          label="Ulangi password baru"
          required
          htmlFor="confirm"
          error={fieldErrors.confirmPassword?.[0]}
        >
          <Input
            id="confirm"
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              clearErrors();
            }}
            placeholder="Ulangi password baru"
            autoComplete="new-password"
          />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="press inline-flex h-11 items-center gap-1.5 rounded-field px-2 text-[12px] font-semibold text-ink-soft hover:bg-line-soft hover:text-ink"
          >
            {show ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
            {show ? "Sembunyikan" : "Tampilkan"} password
          </button>

          <Button type="submit" size="md" disabled={pending}>
            <Check className="size-4" aria-hidden />
            {pending ? "Menyimpan…" : "Simpan password"}
          </Button>
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-1.5 rounded-field bg-clay-50 px-2.5 py-2 text-[12.5px] font-medium text-clay-700"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <p className="text-[12px] leading-relaxed text-muted">
          Setelah password berganti, semua sesi diakhiri dan kamu perlu masuk lagi. Password disimpan
          sebagai hash oleh Supabase Auth; tidak ada reset lewat email.
        </p>
      </form>
    </Panel>
  );
}
