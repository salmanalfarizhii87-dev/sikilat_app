import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Logo } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { CodeForm } from "@/components/participant/code-form";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-5 py-10">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        <p className="mt-5 text-[12.5px] font-medium text-muted">Kode ujian tidak dikenali</p>

        <h1 className="mt-1.5 font-heading text-[24px] font-extrabold leading-tight text-ink">
          Halaman tidak ditemukan
        </h1>
        <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-muted">
          Kode ujian mungkin salah atau sudah tidak aktif. Periksa lagi, atau minta kode baru ke
          pembuat ujian.
        </p>

        <div className="mt-5 flex justify-center">
          <CodeForm compact />
        </div>

        <div className="mt-6 flex flex-col items-center gap-2">
          <Link href="/">
            <Button variant="secondary" size="md">
              <KeyRound className="size-4" aria-hidden /> Kembali ke beranda
            </Button>
          </Link>
          <p className="text-[12px] text-muted">
            Guru?{" "}
            <Link href="/admin/login" className="font-semibold text-navy-700 hover:underline">
              Masuk ke panel admin
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
