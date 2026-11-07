"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";

/**
 * Tombol keluar di halaman akun.
 *
 * Memakai Server Action yang sama dengan menu di shell, supaya hanya ada satu
 * jalur keluar. Bila ada dua jalur yang berbeda, cepat atau lambat salah satunya
 * lupa menghapus cookie.
 */
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const handleClick = async () => {
    if (pending) return;
    setPending(true);
    try {
      const result = await signOut();
      if (!result.ok) {
        setPending(false);
        return;
      }
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setPending(false);
    }
  };

  return (
    <Button variant="secondary" size="md" onClick={handleClick} disabled={pending}>
      <LogOut className="size-3.5" aria-hidden />
      {pending ? "Keluar…" : "Keluar dari perangkat ini"}
    </Button>
  );
}
