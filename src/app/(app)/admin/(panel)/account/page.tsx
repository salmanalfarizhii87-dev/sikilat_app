import { Check, KeyRound, ShieldCheck } from "lucide-react";
import { Panel } from "@/components/admin/ui";
import { PageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";
import { getAdminSession } from "@/lib/auth/require-admin";
import { SignOutButton } from "./sign-out-button";
import { PasswordForm } from "./password-form";

/**
 * Halaman akun admin (T2.6).
 *
 * Server Component: identitas dibaca dari sesi yang sudah diverifikasi, bukan
 * dari `localStorage`. Bila sesi hilang di antara `proxy.ts` dan render ini,
 * `getAdminSession()` mengembalikan `null` dan halaman menampilkan keadaan
 * netral — bukan nama orang yang tidak pernah masuk.
 */
export default async function AdminAccountPage() {
  const admin = await getAdminSession();

  return (
    <>
      <PageHeader
        title="Akun"
        description="Kredensial admin dan informasi sesi di perangkat ini."
      />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <PasswordForm />

        <div className="space-y-4">
          <Panel title="Profil admin">
            {admin ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-full bg-navy-900 font-heading text-[15px] font-bold text-white">
                    {initials(admin.fullName ?? admin.email.split("@")[0])}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-heading text-[14px] font-bold text-ink">
                      {admin.fullName ?? admin.email.split("@")[0]}
                    </p>
                    <p className="truncate text-[12px] text-muted">{admin.email}</p>
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
                    <dt className="text-muted">Masuk terakhir</dt>
                    <dd className="font-medium text-ink">
                      {admin.lastSignInAt
                        ? new Intl.DateTimeFormat("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "Asia/Jakarta",
                          }).format(new Date(admin.lastSignInAt))
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="text-[13px] leading-relaxed text-muted">
                Sesi admin tidak ditemukan. Muat ulang halaman; bila tetap kosong, masuk kembali.
              </p>
            )}
          </Panel>

          <Panel title="Keamanan">
            <ul className="space-y-2">
              {[
                "Tidak ada pendaftaran publik. Akun admin dibuat manual oleh pengelola sekolah.",
                "Peserta tidak punya akun. Mereka masuk dengan kode ujian dan nama.",
                "Reset percobaan oleh admin tercatat di log.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-soft">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-leaf-700" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <SignOutButton />
              <Button
                variant="secondary"
                size="md"
                disabled
                title="Supabase Auth belum mengaktifkan pencabutan sesi per perangkat dari sini."
              >
                <KeyRound className="size-3.5" aria-hidden /> Keluarkan sesi lain
              </Button>
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
              Pencabutan sesi per perangkat belum tersedia. Mengganti password mengakhiri semua sesi.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
