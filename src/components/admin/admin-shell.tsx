"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  FilePlus2,
  FileStack,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { Logo } from "@/components/ui/primitives";
import { cn, initials } from "@/lib/utils";
import { demoExam } from "@/lib/mock-data";
import { signOut } from "@/features/auth/actions";
import { useFocusTrap } from "@/components/ui/use-focus-trap";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/exams", label: "Ujian", icon: FileStack },
  { href: "/admin/exams/new", label: "Buat ujian", icon: FilePlus2 },
  { href: "/admin/account", label: "Akun", icon: Settings },
];

/** Pola UUID, dipakai untuk mengenali segmen ID ujian di breadcrumb. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Label manusia untuk breadcrumb, dikunci per segmen rute. */

const CRUMBS: Record<string, string> = {
  exams: "Ujian",
  new: "Ujian baru",
  questions: "Soal",
  settings: "Pengaturan",
  monitor: "Monitor",
  results: "Rekap nilai",
  grading: "Penilaian",
  account: "Akun",
  login: "Masuk",
};

function buildCrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean).slice(1);
  if (segments.length === 0) return ["Dashboard"];
  return segments
    .filter((segment) => {
      /*
       * Segmen ID ujian sekarang berupa UUID, bukan `exm_01` lagi, dan tidak
       * menambah informasi apa pun: induknya sudah "Ujian", sedangkan judul
       * sebenarnya tampil di kepala halaman. Membiarkannya menghasilkan
       * breadcrumb "Ujian > Ujian"; menampilkan UUID mentah lebih buruk lagi.
       */
      return !UUID_RE.test(segment);
    })
    .map((segment) => {
      if (CRUMBS[segment]) return CRUMBS[segment];
      if (/^exm_/i.test(segment)) return demoExam.code;
      if (/^att_/i.test(segment)) return "Attempt";
      return segment.replace(/-/g, " ");
    });
}

/**
 * Identitas admin yang ditampilkan di menu. Dikirim dari Server Component lewat
 * layout, bukan dibaca dari `localStorage`: nilai di `localStorage` bisa diubah
 * siapa pun dan tidak pernah diverifikasi, jadi tidak layak jadi dasar tampilan
 * "kamu masuk sebagai X".
 */
export interface ShellAdmin {
  email: string;
  fullName: string | null;
}

export function AdminShell({
  children,
  admin,
}: {
  children: React.ReactNode;
  admin: ShellAdmin | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const crumbs = buildCrumbs(pathname);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const drawerRef = React.useRef<HTMLElement>(null);

  const adminDisplayName = admin ? (admin.fullName ?? admin.email.split("@")[0]) : "?";

  useFocusTrap(mobileOpen, drawerRef, () => setMobileOpen(false));

  const closeMenus = () => {
    setMobileOpen(false);
    setMenuOpen(false);
  };

  /*
   * Keluar lewat Server Action: hanya server yang bisa menghapus cookie sesi
   * httpOnly. Bila gagal, menu tetap terbuka dan tombolnya bisa dipakai lagi —
   * tanpa itu, pengguna melihat layar "keluar" tapi sesinya masih hidup.
   */
  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const result = await signOut();
      if (!result.ok) {
        setSigningOut(false);
        return;
      }
      closeMenus();
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  };

  // Hanya satu item yang boleh aktif. `/admin/exams/new` adalah anak dari
  // `/admin/exams`, jadi item dengan href terpanjang yang menang.
  const activeHref = nav
    .filter((item) =>
      item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-4">
        <Link
          href="/admin"
          className="press -mx-1 inline-flex min-h-11 items-center rounded-field px-1"
        >
          <Logo size="sm" />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="grid size-11 place-items-center rounded-field text-muted hover:bg-line-soft lg:hidden"
          aria-label="Tutup menu"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <nav className="scroll-thin mt-2 flex-1 space-y-0.5 overflow-y-auto px-2" aria-label="Navigasi admin">
        {nav.map((item) => {
          const active = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMenus}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press flex min-h-11 items-center gap-2.5 rounded-field px-3 py-2.5 font-heading text-[13.5px] font-semibold transition-colors",
                active ? "bg-navy-900 text-white" : "text-ink-soft hover:bg-line-soft hover:text-ink",
              )}
            >
              <item.icon className="size-4" strokeWidth={2.2} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        <p className="px-1 text-[11.5px] leading-relaxed text-muted">
          Daftar ujian dan statusnya sudah tersimpan di server. Soal, dashboard, dan rekap
          nilai masih memakai data contoh.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] border-r border-line bg-surface lg:block">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div
            className="animate-fade absolute inset-0 bg-navy-900/55"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigasi admin"
            className="animate-fade absolute inset-y-0 left-0 w-[260px] border-r border-line bg-surface"
          >
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-[236px]">
        {/* Topbar solid, tanpa blur: glass hanya untuk 1-2 elemen dan di sini tidak perlu. */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="press grid size-11 place-items-center rounded-field text-ink-soft hover:bg-line-soft lg:hidden"
            aria-label="Buka menu"
          >
            <Menu className="size-5" aria-hidden />
          </button>

          <nav aria-label="Breadcrumb" className="hidden items-center gap-2 text-[12.5px] text-muted sm:flex">
            <Link
              href="/admin"
              className="-mx-1 inline-flex min-h-11 items-center rounded-field px-1 font-semibold text-ink-soft hover:text-ink"
            >
              Admin
            </Link>
            {crumbs.map((crumb, i) => (
              <React.Fragment key={`${crumb}-${i}`}>
                <span className="text-line" aria-hidden>
                  /
                </span>
                <span>{crumb}</span>
              </React.Fragment>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="press flex h-11 items-center gap-2 rounded-field border border-line pl-1 pr-2.5 hover:bg-line-soft"
              >
                <span className="grid size-8 place-items-center rounded-[6px] bg-navy-900 font-heading text-[11.5px] font-bold text-white">
                  {admin ? initials(adminDisplayName) : "?"}
                </span>
                <span className="hidden max-w-[150px] text-left sm:block">
                  <span className="block truncate font-heading text-[12px] font-bold leading-tight text-ink">
                    {admin ? adminDisplayName : "Belum masuk"}
                  </span>
                  <span className="block text-[11px] leading-tight text-muted">Admin</span>
                </span>
                <ChevronDown className="size-3.5 text-muted" aria-hidden />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="animate-rise absolute right-0 top-12 w-56 overflow-hidden rounded-card border border-line bg-surface shadow-pop"
                >
                  <div className="border-b border-line px-3 py-2.5">
                    <p className="truncate font-heading text-[12.5px] font-bold text-ink">
                      {admin ? (admin.fullName ?? admin.email.split("@")[0]) : "Belum masuk"}
                    </p>
                    <p className="truncate text-[11.5px] text-muted">
                      {admin ? admin.email : "Sesi tidak ditemukan"}
                    </p>
                  </div>
                  <Link
                    href="/admin/account"
                    onClick={closeMenus}
                    role="menuitem"
                    className="flex min-h-11 items-center gap-2 px-3 py-2.5 text-[12.5px] text-ink-soft hover:bg-line-soft"
                  >
                    <Settings className="size-3.5" aria-hidden /> Ganti password
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    role="menuitem"
                    className="flex min-h-11 w-full items-center gap-2 px-3 py-2.5 text-left text-[12.5px] text-clay-600 hover:bg-clay-50 disabled:text-faint"
                  >
                    <LogOut className="size-3.5" aria-hidden />
                    {signingOut ? "Keluar…" : "Keluar"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
