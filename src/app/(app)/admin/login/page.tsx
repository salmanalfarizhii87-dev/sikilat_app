"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { saveAdminIdentity } from "@/lib/admin-identity";
import {
  DoodleDefs,
  Doodles2xl,
  DoodlesBase,
  DoodlesBottomLeft,
  DoodlesBottomLeftTall,
  DoodlesMobile,
  DoodlesXl,
  TitleUnderline,
} from "./doodles";

function BrandMark({ size }: { size: "sm" | "lg" }) {
  const h = size === "sm" ? "h-7" : "h-9";
  const text = size === "sm" ? "text-[17px]" : "text-[21px]";
  return (
    <>
      <Image
        src="/logo-sikilat.png"
        alt=""
        width={771}
        height={1016}
        priority
        sizes={size === "sm" ? "28px" : "36px"}
        className={`${h} w-auto object-contain`}
      />
      <span className={`font-heading font-extrabold tracking-tight text-white ${text}`}>
        si<span className="text-accent-400">Kilat</span>
      </span>
    </>
  );
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  /*
   * Mode demo: belum ada Supabase Auth, jadi tidak ada kredensial yang bisa
   * diverifikasi. Halaman ini menerima input yang bentuknya wajar lalu menyimpan
   * email yang diketik, supaya shell admin menampilkan identitas nyata, bukan
   * nama contoh. Halaman ini menyatakan status itu terang-terangan di bawah form.
   */
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Masukkan email yang valid, mis. nama@sekolah.sch.id.");
      return;
    }
    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }
    setError(null);
    setPending(true);
    saveAdminIdentity(email.trim());
    router.push("/admin");
  };

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <DoodleDefs />
      {/* Banner ponsel: logo di atas gradien, sama seperti versi desktop. */}
      <div className="relative -mt-px flex h-28 shrink-0 items-center justify-center overflow-hidden rounded-b-[24px] bg-linear-to-br from-navy-900 to-navy-700 pt-px lg:hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 top-px select-none">
          <DoodlesMobile />
        </div>
        <Link href="/" className="relative z-10 inline-flex items-center gap-2">
          <BrandMark size="sm" />
        </Link>
      </div>

      {/* Panel kiri (desktop): identitas produk, disalin dari pintarly.id/login. */}
      <div className="hidden bg-linear-to-br from-navy-900 to-navy-700 lg:block lg:w-1/2">
        <div className="sticky top-0 flex h-dvh items-start justify-center overflow-hidden pt-24 [@media(min-height:1150px)]:items-center [@media(min-height:1150px)]:pb-24 [@media(min-height:1150px)]:pt-0">
          <div aria-hidden className="pointer-events-none absolute inset-0 select-none xl:hidden">
            <DoodlesBase />
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden select-none xl:block">
            <DoodlesXl />
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden select-none 2xl:block">
            <Doodles2xl />
          </div>

          <div className="pointer-events-none absolute -bottom-24 -left-24 size-[450px] opacity-25">
            <Image
              src="/logo-sikilat.png"
              alt=""
              width={450}
              height={450}
              className="size-full object-contain"
            />
          </div>

          <div
            aria-hidden
            className="pointer-events-none absolute bottom-[354px] left-0 h-[150px] w-[21%] select-none [@media(max-height:880px)]:hidden"
          >
            <DoodlesBottomLeft />
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-[354px] left-0 hidden h-[150px] w-[21%] select-none [@media(min-height:881px)]:2xl:block"
          >
            <DoodlesBottomLeftTall />
          </div>

          <div className="relative z-10 max-w-xl px-12 2xl:max-w-3xl">
            <div className="mb-8">
              <Link href="/" className="inline-flex items-center gap-2.5">
                <BrandMark size="lg" />
              </Link>
            </div>

            <h1 className="mb-4 font-heading text-4xl font-bold leading-tight tracking-tight text-white text-pretty xl:text-5xl 2xl:text-6xl 2xl:leading-[1.05]">
              Ujian{" "}
              <span className="relative inline-block">
                lebih kilat
                <TitleUnderline />
              </span>{" "}
              tanpa ribet
            </h1>

            <p className="mb-10 text-lg text-white 2xl:text-xl">
              Satu tempat untuk menyusun soal, membagikan kode, dan menilai esai.
            </p>

            <div className="text-left">
              <div className="font-heading text-2xl font-bold leading-tight text-white">
                50 peserta serentak
              </div>
              <div className="mt-1 text-sm text-white">
                target aman ujian sekolah, diuji sampai 100 peserta
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Panel kanan: form. */}
      <div className="flex flex-1 flex-col justify-center bg-canvas px-4 py-10 sm:px-6 lg:w-1/2 lg:flex-none lg:py-12">
        <div className="mx-auto w-full max-w-[384px]">
          <h2 className="font-heading text-[28px] font-bold leading-tight tracking-tight text-ink">
            Selamat datang kembali
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            Masuk dengan akun yang diberikan pengelola sekolah. Tidak ada pendaftaran publik.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email" htmlFor="email" required>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="nama@sekolah.sch.id"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                autoFocus
                className="h-12 rounded-[12px] text-[14px]"
              />
            </Field>

            <Field label="Kata sandi" htmlFor="password" required>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="h-12 rounded-[12px] pr-12 text-[14px]"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  aria-pressed={show}
                  className="press absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-[10px] text-faint hover:bg-line-soft hover:text-ink"
                >
                  {show ? (
                    <EyeOff className="size-[18px]" aria-hidden />
                  ) : (
                    <Eye className="size-[18px]" aria-hidden />
                  )}
                </button>
              </div>
            </Field>

            <div className="flex justify-end">
              <a
                href="#bantuan-password"
                className="inline-flex min-h-11 items-center text-[13.5px] font-medium text-ink-soft hover:text-ink"
              >
                Lupa kata sandi?
              </a>
            </div>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-1.5 rounded-[12px] bg-clay-50 px-3 py-2 text-[12.5px] font-medium text-clay-700"
              >
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="press inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent-400 px-6 font-heading text-[15px] font-semibold text-navy-900 transition-colors hover:bg-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-900/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-accent-100 disabled:text-accent-800"
            >
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Masuk
            </button>
          </form>

          <div id="bantuan-password" className="mt-4 rounded-[12px] border border-line bg-surface px-3.5 py-3">
            <p className="text-[12px] leading-relaxed text-muted">
              <strong className="font-semibold text-ink">Mode demo.</strong> Belum ada server
              autentikasi, jadi email dan password apa pun yang bentuknya wajar akan diterima. Jangan
              masukkan password asli.
            </p>
          </div>

          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            Belum bisa reset sendiri lewat email. Hubungi pengelola sekolah untuk reset kata sandi.
          </p>

          <p className="mt-6 text-center text-[12px] leading-relaxed text-faint">
            Dengan masuk, kamu menyetujui{" "}
            <Link
              href="/"
              className="font-medium text-ink-soft underline decoration-line underline-offset-2 hover:text-ink"
            >
              Syarat &amp; Ketentuan
            </Link>{" "}
            dan{" "}
            <Link
              href="/"
              className="font-medium text-ink-soft underline decoration-line underline-offset-2 hover:text-ink"
            >
              Kebijakan Privasi
            </Link>
            .
          </p>

          <Link
            href="/"
            className="press mx-auto mt-4 flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink-soft hover:bg-line-soft hover:text-ink"
          >
            <ArrowLeft className="size-3.5" aria-hidden /> Kembali ke halaman peserta
          </Link>
        </div>
      </div>
    </div>
  );
}
