"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Check, Eye, EyeOff, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PageHeader, Panel } from "@/components/admin/ui";
import { clearAdminIdentity, useAdminIdentity } from "@/lib/admin-identity";
import { initials } from "@/lib/utils";

export default function AdminAccountPage() {
  const identity = useAdminIdentity();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const strength = React.useMemo(() => {
    let score = 0;
    if (next.length >= 8) score += 1;
    if (/[A-Z]/.test(next)) score += 1;
    if (/[0-9]/.test(next)) score += 1;
    if (/[^A-Za-z0-9]/.test(next)) score += 1;
    return score;
  }, [next]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) {
      setError("Masukkan password saat ini.");
      return;
    }
    if (next.length < 8) {
      setError("Password baru minimal 8 karakter.");
      return;
    }
    if (next !== confirm) {
      setError("Konfirmasi password tidak sama.");
      return;
    }
    setError(null);
    toast("Belum tersambung ke server. Password tidak berubah.");
  };

  return (
    <>
      <PageHeader
        title="Akun"
        description="Kredensial admin dan informasi sesi di perangkat ini."
      />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Panel title="Ganti password">
          <form onSubmit={submit} className="space-y-3.5">
            <Field label="Password saat ini" required htmlFor="current">
              <Input
                id="current"
                type={show ? "text" : "password"}
                value={current}
                onChange={(e) => {
                  setCurrent(e.target.value);
                  setError(null);
                }}
                placeholder="Password lama"
                autoComplete="current-password"
              />
            </Field>

            <Field
              label="Password baru"
              required
              htmlFor="next"
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
                  setError(null);
                }}
                placeholder="Minimal 8 karakter"
                autoComplete="new-password"
              />
            </Field>

            <Field label="Ulangi password baru" required htmlFor="confirm">
              <Input
                id="confirm"
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setError(null);
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
                {show ? (
                  <EyeOff className="size-3.5" aria-hidden />
                ) : (
                  <Eye className="size-3.5" aria-hidden />
                )}
                {show ? "Sembunyikan" : "Tampilkan"} password
              </button>

              <Button type="submit" size="md">
                <Check className="size-4" aria-hidden /> Simpan password
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
              Pada versi ini belum ada server autentikasi, jadi password tidak benar-benar disimpan.
              Setelah backend terpasang, password akan disimpan sebagai hash dan tidak ada reset
              lewat email.
            </p>
          </form>
        </Panel>

        <div className="space-y-4">
          <Panel title="Profil admin">
            {identity ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-full bg-navy-900 font-heading text-[15px] font-bold text-white">
                    {initials(identity.email.split("@")[0])}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-heading text-[14px] font-bold text-ink">
                      {identity.email.split("@")[0]}
                    </p>
                    <p className="truncate text-[12px] text-muted">{identity.email}</p>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-xs border border-leaf-200 bg-leaf-100 px-1.5 py-0.5 font-heading text-[11px] font-semibold text-leaf-800">
                      <ShieldCheck className="size-3" aria-hidden /> Admin
                    </span>
                  </div>
                </div>
                <dl className="mt-4 space-y-2 text-[12.5px]">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted">Peran</dt>
                    <dd className="font-medium text-ink">Admin (akses penuh)</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted">Sesi</dt>
                    <dd className="font-medium text-ink">Tersimpan di perangkat ini</dd>
                  </div>
                </dl>
              </>
            ) : (
              <div>
                <p className="text-[13px] leading-relaxed text-muted">
                  Belum ada email tersimpan di perangkat ini. Masuk lewat halaman login supaya
                  profil ini terisi.
                </p>
                <Link href="/admin/login" className="mt-3 inline-block">
                  <Button size="sm" variant="secondary">
                    Ke halaman masuk
                  </Button>
                </Link>
              </div>
            )}
          </Panel>

          <Panel title="Keamanan">
            <ul className="space-y-2">
              {[
                "Tidak ada pendaftaran publik. Akun admin dibuat manual oleh pengelola sekolah.",
                "Peserta tidak punya akun. Mereka masuk dengan kode ujian dan nama.",
                "Reset percobaan oleh admin akan tercatat di log setelah backend terpasang.",
              ].map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-soft"
                >
                  <Check className="mt-0.5 size-3.5 shrink-0 text-leaf-700" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  clearAdminIdentity();
                  toast("Sesi di perangkat ini dihapus");
                }}
              >
                <LogOut className="size-3.5" aria-hidden /> Keluar dari perangkat ini
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => toast("Belum tersambung ke server. Sesi lain tidak diubah.")}
              >
                <KeyRound className="size-3.5" aria-hidden /> Keluarkan sesi lain
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
