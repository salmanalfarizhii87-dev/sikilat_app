"use client";

/**
 * ============================================================================
 *  siKilat — Landing Page (satu file, siap dipindah)
 * ----------------------------------------------------------------------------
 *  Struktur, ukuran, dan token desain disalin dari computed style produksi
 *  pintarly.id (7 stylesheet + runtime probe), lalu isinya diganti ke siKilat.
 *
 *  Cara pakai di project utama:
 *   1. Copy file ini  →  app/page.tsx
 *   2. Copy app/globals.css   (design token + semua kelas .lp-*)
 *   3. Copy app/layout.tsx    (font Outfit + Plus Jakarta Sans via next/font)
 *   4. Tidak ada dependency tambahan; semua ikon inline SVG.
 *
 *  GAMBAR: semua ilustrasi/avatar diganti placeholder polos.
 *  Cari `PLACEHOLDER` untuk menukarnya nanti dengan <Image /> asli.
 *  Mockup kecil di kartu mode & mockup HP dibuat dari DOM (bukan gambar),
 *  jadi tetap tajam di semua ukuran layar.
 * ============================================================================
 */

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

const APP_NAME = "siKilat";

/* -------------------------------------------------------------------------- */
/*  Animasi hero — konstanta waktu                                           */
/* -------------------------------------------------------------------------- */
/*  Nilai visual (jarak gerak, durasi loop) ada di CSS variables :root
    pada app/globals.css (blok "HERO MOTION"). Yang di sini hanya timing
    yang dijalankan JavaScript (bubble chat & stagger).                  */

/** Pesan bubble chat. Tambah/hapus/ubah teks di array ini saja. */
const BUBBLE_MESSAGES = [
  "Hai! Aku Kilat.",
  "Masukkan kode ujian dari gurumu.",
  "Tanpa akun, langsung mulai.",
  "Siap ujian hari ini?",
];

const BUBBLE_TIMING = {
  /** lama tiap pesan tampil sebelum ganti */
  hold: 3500,
  /** durasi indikator mengetik sebelum teks baru muncul */
  typing: 600,
  /** durasi transisi fade + slide teks (samakan dengan --lp-mo-bubble-in) */
  fade: 420,
  /** jeda sebelum pesan pertama muncul (setelah maskot pop-in) */
  startDelay: 1000,
};

/** Lama satu siklus lompat maskot (samakan dengan --lp-mo-hop-dur). */
const MASCOT_HOP_MS = 720;

/* -------------------------------------------------------------------------- */
/*  Hook bantu animasi                                                        */
/* -------------------------------------------------------------------------- */

/** true kalau pengguna meminta animasi dikurangi. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/** true kalau elemen sedang terlihat di layar (IntersectionObserver). */
function useInView<T extends Element>(ref: RefObject<T | null>) {
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  return inView;
}

/** true kalau tab sedang aktif (Page Visibility API). */
function useTabVisible() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    onChange();
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return visible;
}

/* -------------------------------------------------------------------------- */
/*  Bubble chat di samping kepala maskot                                      */
/* -------------------------------------------------------------------------- */

function ChatBubble({ active, reduced }: { active: boolean; reduced: boolean }) {
  const [index, setIndex] = useState(0);
  const [typing, setTyping] = useState(true);
  const firstRun = useRef(true);

  useEffect(() => {
    if (!active || reduced) return;

    const wait = typing
      ? BUBBLE_TIMING.typing + (firstRun.current ? BUBBLE_TIMING.startDelay : 0)
      : BUBBLE_TIMING.hold;

    const t = window.setTimeout(() => {
      if (typing) {
        firstRun.current = false;
        setTyping(false);
      } else {
        setIndex((i) => (i + 1) % BUBBLE_MESSAGES.length);
        setTyping(true);
      }
    }, wait);

    return () => window.clearTimeout(t);
  }, [active, reduced, typing]);

  /* reduced-motion: teks statis, tanpa indikator mengetik & tanpa loop */
  if (reduced) {
    return (
      <span className="lp-bubble" aria-hidden="true">
        <span className="lp-bubble-pop lp-mo">
          <span className="lp-bubble-body">
            <span className="lp-bubble-text">{BUBBLE_MESSAGES[0]}</span>
          </span>
        </span>
      </span>
    );
  }

  return (
    <span className="lp-bubble" aria-hidden="true">
      <span className="lp-bubble-pop lp-mo">
        <span className="lp-bubble-body">
          {typing ? (
            <span className="lp-bubble-dots lp-mo">
              <i />
              <i />
              <i />
            </span>
          ) : (
            <span key={index} className="lp-bubble-text lp-mo">
              {BUBBLE_MESSAGES[index]}
            </span>
          )}
        </span>
      </span>
    </span>
  );
}


/* Logo asli (public/logo-sikilat.png) — sudah di-trim, rasio 771×1016 ≈ 0.759
   Regenerate dengan: node scripts/trim-logo.cjs */
const LOGO_SRC = "/logo-sikilat.png";
const LOGO_W = 771;
const LOGO_H = 1016;

/* -------------------------------------------------------------------------- */
/*  Ikon                                                                      */
/* -------------------------------------------------------------------------- */

type IconName =
  | "arrow"
  | "chevron"
  | "plus"
  | "check"
  | "pause"
  | "play"
  | "moon"
  | "menu"
  | "close"
  | "key"
  | "star"
  | "clock"
  | "flame"
  | "x";

function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  const filled = name === "star" || name === "play" || name === "x" || name === "flame";
  const paths: Record<IconName, ReactNode> = {
    arrow: <path d="M5 12h13M12 5l7 7-7 7" />,
    chevron: <path d="M6 9l6 6 6-6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="M5 13l4 4L19 7" />,
    pause: (
      <>
        <path d="M9 5v14M15 5v14" />
      </>
    ),
    play: <path d="M7 4l13 8-13 8z" />,
    moon: <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    key: (
      <>
        <circle cx="8" cy="8" r="3.5" />
        <path d="M10.5 10.5L20 20M17 17l2-2M14.5 14.5l2-2" />
      </>
    ),
    star: (
      <path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16.9 6.6 19.8l1.2-6.1L3.3 9.5l6.1-.7z" />
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
    flame: <path d="M12 2.5c3.6 4 6 6.6 6 10.2a6 6 0 11-12 0c0-2 .8-3.4 2-4.7.3 1.6 1 2.4 2 2.9 0-2.9.8-5.6 2-8.4z" />,
    x: <path d="M17.3 3h3.2l-7 8 8.2 10h-6.4l-5-6.1L4.6 21H1.4l7.5-8.6L1 3h6.6l4.5 5.6zm-1.1 16.1h1.8L7.9 4.8H6z" />,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Placeholder polos                                                         */
/* -------------------------------------------------------------------------- */

/** PLACEHOLDER — ganti dengan <Image src="..." /> saat aset asli tersedia. */
function Ph({
  className = "",
  label,
  radius = 20,
}: {
  className?: string;
  label?: string;
  radius?: number;
}) {
  return (
    <div
      className={`lp-ph ${className}`}
      style={{ borderRadius: radius }}
      aria-hidden="true"
    >
      {label ? (
        <span className="sr-only">{label}</span>
      ) : null}
    </div>
  );
}

function Stars({ n = 5, className }: { n?: number; className?: string }) {
  return (
    <span className={`lp-rating-stars ${className ?? ""}`}>
      {Array.from({ length: n }).map((_, i) => (
        <Icon key={i} name="star" className="h-[14px] w-[14px]" />
      ))}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Data                                                                      */
/* -------------------------------------------------------------------------- */

const NAV_LINKS = [
  { label: "Peserta", href: "#peserta" },
  { label: "Admin", href: "#admin" },
  { label: "Cara Kerja", href: "#cara-kerja" },
  { label: "Ulasan", href: "#ulasan" },
];

const NAV_MORE = ["Panduan peserta", "Panduan admin", "Status layanan"];

const MODE_CARDS = [
  {
    title: "Ulangan",
    promise: "Pilihan ganda dan essay, nilai keluar seketika.",
    peek: "file" as const,
    badge: null as string | null,
  },
  {
    title: "Tryout",
    promise: "Jadwal buka–tutup, acak soal, rekap per peserta.",
    peek: "srcs" as const,
    badge: null as string | null,
  },
  {
    title: "Kuis",
    promise: "Kuis pendek di awal kelas, hasil langsung terlihat.",
    peek: "bs" as const,
    badge: "Kuis Matematika berlangsung",
  },
  {
    title: "Seleksi",
    promise: "Seleksi internal dengan peringkat dan rekap rapi.",
    peek: "score" as const,
    badge: null as string | null,
  },
];

const BENEFITS: {
  title: string;
  body: string;
  flip: boolean;
  art: string;
}[] = [
  {
    title: "tanpa akun. tanpa ribet.",
    body: "Peserta cukup kode ujian dan nama. Tidak ada pendaftaran, email, atau password yang bikin peserta tertahan di halaman login. Tiga langkah dari buka tautan sampai soal pertama tampil.",
    flip: false,
    art: "/tanpa-akun.png",
  },
  {
    title: "jawaban tidak hilang",
    body: "Autosave berjalan sekitar 800 ms setelah jawaban berubah. Kalau koneksi putus, jawaban masuk antrean lokal dan dikirim ulang otomatis saat pulih. Refresh atau HP mati? Attempt dilanjutkan dengan sisa waktu yang dihitung ulang dari server.",
    flip: true,
    art: "/jawaban-tidak-hilang.png",
  },
  {
    title: "nilai tanpa hitung manual",
    body: "Pilihan ganda dikoreksi otomatis begitu peserta menekan Kumpulkan. Essay masuk antrean penilaian: jawaban peserta dan kunci acuan berdampingan, isi skor dan komentar, lalu lanjut ke jawaban berikutnya.",
    flip: false,
    art: "/nilai-otomatis.png",
  },
  {
    title: "tahu siapa yang belum selesai",
    body: "Pantau peserta yang sedang mengerjakan beserta jumlah soal terjawab dan sisa waktunya. Setelah selesai, baca statistik per ujian dan unduh rekapnya sebagai arsip.",
    flip: true,
    art: "/belum-selesai.png",
  },
];

const REVIEWS_ROW_1 = [
  {
    quote:
      "bikin ulangan jadi cepat. soal selesai diketik pagi, siangnya nilai sudah masuk semua tanpa koreksi manual.",
    name: "Bu Rina",
    src: "Guru Matematika",
    kind: "x" as const,
  },
  {
    quote:
      "peserta cukup kasih kode, nggak ada lagi drama lupa password atau salah ketik email waktu ujian mau mulai.",
    name: "Pak Adit",
    src: "Wali Kelas",
    kind: "x" as const,
  },
  {
    quote:
      "anak-anak sempat hp-nya mati di tengah ujian, pas buka lagi jawabannya masih utuh dan waktunya masih sisa.",
    name: "Bu Sari",
    src: "Ulasan Google Play",
    kind: "play" as const,
  },
  {
    quote:
      "rekapnya bisa langsung diunduh ke spreadsheet, jadi laporan ke kepala sekolah nggak perlu rekap ulang.",
    name: "Pak Bimo",
    src: "Ulasan Google Play",
    kind: "play" as const,
  },
];

const REVIEWS_ROW_2 = [
  {
    quote:
      "wizard soalnya jelas, tinggal isi, atur durasi, publish. pertama kali bikin ujian langsung jalan tanpa baca panduan.",
    name: "Bu Nia",
    src: "Ulasan App Store",
    kind: "play" as const,
  },
  {
    quote:
      "nilai pilihan ganda keluar seketika, jadi waktu kelas berikutnya saya sudah tahu bagian mana yang perlu diulang.",
    name: "Pak Yusuf",
    src: "Ulasan App Store",
    kind: "play" as const,
  },
  {
    quote:
      "yang paling nolong itu timer dari server. peserta nggak bisa ngakalin dengan ngubah jam di HP-nya.",
    name: "Bu Dewi",
    src: "Panitia Tryout",
    kind: "x" as const,
  },
  {
    quote:
      "monitoringnya bikin tenang. kelihatan siapa yang masih ngerjain dan siapa yang sudah kumpul, jadi nggak bolak-balik tanya.",
    name: "Pak Hendra",
    src: "Koordinator Kurikulum",
    kind: "x" as const,
  },
];

const BANDS = [
  {
    brand: "siKilat",
    tag: "Ulangan",
    title: "Soal siap, kode dibagikan, ujian jalan",
    body: "Ketik soal satu per satu atau impor dari CSV/XLSX yang sudah kamu susun di spreadsheet. Atur poin, durasi, dan jadwal, lalu publish. Kode 6 karakter dan tautan ujian langsung muncul untuk dibagikan.",
    flip: false,
  },
  {
    brand: "siKilat",
    tag: "Tryout",
    title: "Acak soal per peserta, nilai langsung terukur",
    body: "Aktifkan acak urutan soal dan opsi supaya tidak ada dua peserta dengan urutan sama. Setelah submit, skor pilihan ganda langsung terhitung dan rekap statistik per ujian siap dibaca.",
    flip: true,
  },
  {
    brand: "siKilat",
    tag: "Kuis",
    title: "Kuis pendek, hasil sebelum sesi dimulai",
    body: "Buat kuis 5–10 soal untuk mengukur pemahaman awal. Peserta mengerjakan dari HP, dan kamu sudah bisa melihat distribusi jawaban sebelum kelas benar-benar mulai.",
    flip: false,
  },
  {
    brand: "siKilat",
    tag: "Seleksi",
    title: "Seleksi internal dengan bukti pencatatan",
    body: "Bagikan kode hanya ke peserta yang dituju, pantau lewat halaman monitoring, dan lihat catatan kejadian seperti pindah tab atau keluar layar penuh. Kontrol di browser bukan jaminan, tapi jejaknya tercatat.",
    flip: true,
  },
];

const FAQ = [
  {
    q: "Peserta perlu bikin akun dulu?",
    a: "Tidak. Peserta masuk sebagai tamu: cukup kode ujian dan nama. Sistem tetap mengenali attempt lewat token pengerjaan di cookie, jadi jawaban tetap milik orang yang benar tanpa perlu login.",
  },
  {
    q: "Kalau koneksi putus atau HP mati di tengah ujian?",
    a: "Jawaban masuk antrean lokal dan dikirim ulang otomatis saat koneksi pulih. Setelah refresh atau tab ditutup, peserta kembali ke attempt yang sama dengan jawaban utuh dan sisa waktu yang dihitung ulang dari server. Kalau cookie hilang, ada Kode Lanjut 6 karakter.",
  },
  {
    q: "Bisakah peserta melihat kunci jawaban?",
    a: "Kunci jawaban, rubrik essay, dan pembahasan tidak pernah dikirim ke browser selama ujian. Peserta hanya menerima teks soal dan opsi. Setelah selesai, tampilan hasil mengikuti pengaturan visibilitas: sembunyikan, skor saja, atau skor plus pembahasan.",
  },
  {
    q: "Soal essay dinilai bagaimana?",
    a: "Pilihan ganda dinilai otomatis saat submit. Essay masuk antrean penilaian: admin melihat jawaban peserta dan kunci acuan berdampingan, memberi skor 0 sampai poin maksimal plus komentar, lalu lanjut ke jawaban berikutnya.",
  },
  {
    q: "Berapa peserta yang bisa mengerjakan bersamaan?",
    a: "Dirancang untuk kelompok kecil: target aman 50 peserta serentak dan diuji sampai 100 peserta dengan autosave berkala. Ini bukan pengganti pengawasan: kontrol di browser selalu bisa dilewati, jadi yang siKilat sediakan hanya pencegahan ringan berupa acak soal dan opsi serta catatan kejadian seperti pindah tab atau keluar layar penuh.",
  },
];

const FOOTER_COLUMNS = [
  {
    groups: [
      {
        title: "Tentang kami",
        links: [
          "Tentang siKilat",
          "Karier",
          "Afiliasi",
          "Student Ambassador",
          "Blog",
          "siKilat untuk sekolah",
        ],
      },
    ],
  },
  {
    groups: [
      {
        title: "Produk",
        links: [
          "Ulangan harian",
          "Tryout",
          "Kuis kelas",
          "Seleksi internal",
          "Ujian susulan",
          "Bank soal",
          "Kode Lanjut",
          "Rekap nilai",
          "siKilat untuk panitia",
        ],
      },
    ],
  },
  {
    groups: [
      {
        title: "Belajar gratis",
        links: [
          "Panduan peserta",
          "Panduan admin",
          "Latihan soal",
          "Kisi-kisi dan bobot",
          "Tips ujian",
          "Simulasi tryout",
          "Cara membuat kode ujian",
          "Mengatur waktu ujian",
          "Mengacak soal dan opsi",
          "Menilai soal essay",
          "Membaca statistik ujian",
          "Mengunduh rekap nilai",
          "Menangani koneksi putus",
          "Keamanan ujian daring",
          "Etika ujian online",
          "Format soal pilihan ganda",
          "Format soal essay",
          "Lihat semua",
        ],
      },
    ],
  },
  {
    groups: [
      {
        title: "Bantuan dan dukungan",
        links: ["Pertanyaan umum", "Lapor masalah"],
      },
      {
        title: "Privasi dan ketentuan",
        links: ["Syarat dan Ketentuan", "Kebijakan Privasi", "Pemakaian Wajar"],
      },
    ],
  },
];

const FOOTER_META = [
  "siKilat",
  "Jakarta, Indonesia",
  "support@sikilat.id",
  "WhatsApp +62 812-0000-0000",
];

/* -------------------------------------------------------------------------- */
/*  Nav                                                                       */
/* -------------------------------------------------------------------------- */

function Nav() {
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`lp-nav ${stuck ? "is-stuck" : ""}`} aria-label="Navigasi utama">
      <div className="flex items-center gap-3">
        <a className="lp-nav-brand" href="#peserta" aria-label={`${APP_NAME}, beranda`}>
          <Image
            className="lp-logo"
            src={LOGO_SRC}
            alt=""
            width={LOGO_W}
            height={LOGO_H}
            priority
            sizes="88px"
          />
          <span>{APP_NAME}</span>
        </a>

        <div className="lp-nav-links ml-2">
          {NAV_LINKS.map((l) => (
            <a key={l.href} className="lp-nav-link" href={l.href}>
              {l.label}
            </a>
          ))}
          <details className="group relative">
            <summary className="lp-nav-link cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              Lainnya
              <Icon name="chevron" className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <div className="lp-nav-dropdown">
              {NAV_MORE.map((t) => (
                <a
                  key={t}
                  href="#faq"
                  className="flex min-h-11 items-center rounded-xl px-3 py-2 font-[family-name:var(--font-outfit)] text-sm font-medium text-[var(--black-charcoal)] hover:bg-[var(--neutral-100)]"
                >
                  {t}
                </a>
              ))}
            </div>
          </details>
        </div>
      </div>

      <div className="lp-nav-right">
        <button type="button" aria-label="Ganti tema" className="lp-nav-icon-btn lp-nav-hide-sm">
          <Icon name="moon" className="h-[18px] w-[18px]" />
        </button>
        <a href="/admin/login" className="lp-nav-masuk lp-nav-hide-sm">
          Masuk
        </a>
        <a href="/admin/exams/new" className="lp-btn-cta">
          Buat ujian
        </a>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Tutup menu" : "Buka menu"}
          aria-expanded={open}
          className="lp-nav-burger"
        >
          <Icon name={open ? "close" : "menu"} className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="lp-nav-drawer">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <a href="/admin/login" onClick={() => setOpen(false)}>
            Masuk admin
          </a>
        </div>
      )}
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/*  Form kode ujian                                                           */
/* -------------------------------------------------------------------------- */

function CodeForm({ id }: { id: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const clean = useMemo(() => code.replace(/[^A-Za-z0-9]/g, "").toUpperCase(), [code]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (clean.length < 4) {
      setError("Kode ujian minimal 4 karakter. Cek lagi dari pembuat ujianmu.");
      return;
    }
    setError(null);
    router.push(`/u/${clean}`);
  }

  return (
    <form onSubmit={submit} className="w-full max-w-[420px] min-w-0">
      <label htmlFor={id} className="sr-only">
        Kode ujian
      </label>
      <div className="lp-code-field">
        <span className="shrink-0 text-[var(--neutral-400)]">
          <Icon name="key" className="h-[18px] w-[18px]" />
        </span>
        <input
          id={id}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Masukkan kode ujian"
          autoComplete="off"
          spellCheck={false}
          maxLength={10}
          className="lp-code-input"
        />
        <button type="submit" className="lp-code-submit">
          Masuk
          <Icon name="arrow" className="h-[14px] w-[14px]" />
        </button>
      </div>
      {error ? (
        <p className="mt-2 pl-4 text-[13px] font-medium text-[#c0392b]">{error}</p>
      ) : (
        <p className="mt-2 pl-4 text-[13px] text-[var(--muted-foreground)]">
          Tanpa akun. Cukup kode dari gurumu.
        </p>
      )}
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Mockup kecil di kartu mode (DOM, bukan gambar)                            */
/* -------------------------------------------------------------------------- */

function PeekFile() {
  return (
    <span className="peek">
      <span className="peek__file">
        <b>PDF</b>
        <span className="peek__line" />
        <span className="peek__line" />
        <span className="peek__line peek__line--s" />
        <span className="peek__line" />
        <span className="peek__line peek__line--s" />
      </span>
      <svg className="peek__flow" viewBox="0 0 34 20" fill="none" aria-hidden="true">
        <path
          d="M2 14c6-9 14-9 20-5"
          stroke="var(--lp-ink-3)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M18 5l6 4-7 2"
          stroke="var(--lp-ink-3)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="peek__quiz">
        <span className="peek__q">Suku bunga naik, inflasi?</span>
        <span className="peek__opt">Ikut naik</span>
        <span className="peek__opt is-correct">
          Cenderung turun
          <span className="peek__check">
            <Icon name="check" className="h-full w-full" />
          </span>
        </span>
      </span>

      {/* ringkas untuk mobile */}
      <span className="peek-m">
        <span className="pm-row">
          <span className="pm-file">
            <b>PDF</b>
            <i />
            <i style={{ width: "70%" }} />
            <i />
          </span>
          <svg viewBox="0 0 24 14" fill="none" aria-hidden="true" className="h-3.5 w-4">
            <path d="M2 10c4-6 9-6 13-3" stroke="var(--lp-ink-3)" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M12 4l4 3-5 1.4" stroke="var(--lp-ink-3)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="pm-card">
            Kuis
            <i />
            <i style={{ width: "60%" }} />
          </span>
        </span>
        <span className="pm-opt">
          Turun
          <span className="pm-check">
            <Icon name="check" className="h-full w-full" />
          </span>
        </span>
      </span>
    </span>
  );
}

function PeekSrcs() {
  return (
    <span className="peek">
      <span className="peek__srcs">
        <span className="peek__src peek__src--yt" />
        <span className="peek__src peek__src--photo">
          <span>CO₂ + H₂O</span>
        </span>
        <span className="peek__src peek__src--pdf">
          <b>PDF</b>
        </span>
      </span>
      <svg className="peek__flow" viewBox="0 0 34 20" fill="none" aria-hidden="true">
        <path
          d="M2 14c6-9 14-9 20-5"
          stroke="var(--lp-ink-3)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M18 5l6 4-7 2"
          stroke="var(--lp-ink-3)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="peek__out">
        <span className="peek__note">
          <small>Catatan</small>
          <strong>Fotosintesis</strong>
          <span className="peek__line" />
          <span className="peek__line peek__line--s" />
          <span className="peek__line" />
        </span>
        <span className="peek__opt is-correct">
          Kuis 5/5
          <span className="peek__check">
            <Icon name="check" className="h-full w-full" />
          </span>
        </span>
      </span>

      {/* ringkas untuk mobile */}
      <span className="peek-m">
        <span className="pm-row">
          <span className="pm-srcs">
            <span className="pm-src--photo" />
            <span className="pm-src--yt" />
          </span>
          <svg viewBox="0 0 24 14" fill="none" aria-hidden="true" className="h-3.5 w-4">
            <path d="M2 10c4-6 9-6 13-3" stroke="var(--lp-ink-3)" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M12 4l4 3-5 1.4" stroke="var(--lp-ink-3)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="pm-card">
            <i />
            <i style={{ width: "70%" }} />
            <i />
          </span>
        </span>
        <span className="pm-opt">
          Kuis 5/5
          <span className="pm-check">
            <Icon name="check" className="h-full w-full" />
          </span>
        </span>
      </span>
    </span>
  );
}

function PeekBs() {
  return (
    <span className="peek">
      <span className="peek__bs">
        <span className="peek__bs-row">
          f(0) = 3
          <span className="peek__bs-btn is-on">Benar</span>
          <span className="peek__bs-btn">Salah</span>
        </span>
        <span className="peek__bs-row">
          f(2) = 8
          <span className="peek__bs-btn">Benar</span>
          <span className="peek__bs-btn is-on">Salah</span>
        </span>
      </span>

      {/* ringkas untuk mobile */}
      <span className="peek-m">
        <span className="pm-q">f(0) = 3</span>
        <span className="pm-bs">
          <span className="is-on">Benar</span>
          <span>Salah</span>
        </span>
      </span>
    </span>
  );
}

function PeekScore() {
  const bars = [99, 60, 69, 47, 89, 79, 80];
  return (
    <span className="peek">
      <span className="peek__score">
        <small>Skor</small>
        <strong>612</strong>
      </span>
      <span className="peek__timer">
        <Icon name="clock" className="h-[15px] w-[15px]" />
        29:41
      </span>
      <span className="peek__bars">
        {bars.map((h, i) => (
          <span
            key={i}
            className={`peek__bar ${h < 50 ? "is-low" : ""}`}
            style={{ "--lp-h": `${h}%` } as CSSProperties}
          />
        ))}
      </span>

      {/* ringkas untuk mobile */}
      <span className="peek-m">
        <span className="pm-score">
          <small>SKOR</small>
          <strong>612</strong>
        </span>
        <span className="pm-bars">
          {bars.map((h, i) => (
            <i
              key={i}
              className={h < 50 ? "is-low" : undefined}
              style={{ "--lp-h": `${h}%` } as CSSProperties}
            />
          ))}
        </span>
      </span>
    </span>
  );
}

const PEEK_MAP = {
  file: PeekFile,
  srcs: PeekSrcs,
  bs: PeekBs,
  score: PeekScore,
};

/* -------------------------------------------------------------------------- */
/*  Hero                                                                      */
/* -------------------------------------------------------------------------- */

function Hero() {
  const formId = useId();
  const gradId = useId().replace(/:/g, "");

  const heroRef = useRef<HTMLElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const inView = useInView(heroRef);
  const tabVisible = useTabVisible();
  const paused = !inView || !tabVisible;

  /* lompat kecil saat hover/tap, lalu kembali idle */
  const [hop, setHop] = useState(false);
  const hopTimer = useRef<number | null>(null);

  const triggerHop = () => {
    if (reduced) return;
    setHop(false);
    if (hopTimer.current) window.clearTimeout(hopTimer.current);
    /* restart animasi dari awal walau dipicu berulang */
    window.requestAnimationFrame(() => setHop(true));
    hopTimer.current = window.setTimeout(() => setHop(false), MASCOT_HOP_MS);
  };

  useEffect(
    () => () => {
      if (hopTimer.current) window.clearTimeout(hopTimer.current);
    },
    [],
  );

  return (
    <section
      className="lp-hero"
      id="peserta"
      ref={heroRef}
      data-motion={paused ? "paused" : undefined}
    >
      <div className="lp-hero-bg" aria-hidden="true" />

      <div className="lp-container">
        <div className="lp-hero-head">
          <div className="lp-hero-copy">
            <div className="lp-hero-text">
              <h1 className="lp-hero-title">
                <span className="lp-eyebrow">Ujian Kilat, Tanpa Ribet di {APP_NAME}</span>
                Lagi mau{" "}
                <span className="lp-ink-mark">
                  ujian apa?
                  <svg className="lp-ink-line" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                      <linearGradient id={`kilat-ink-${gradId}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="var(--lp-grad-b)" />
                        <stop offset="100%" stopColor="var(--lp-grad-a)" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M2 8c40-5 92-6 196-3"
                      pathLength={1}
                      stroke={`url(#kilat-ink-${gradId})`}
                    />
                  </svg>
                </span>
              </h1>

              <p className="lp-lead">Masukkan kode ujian, isi nama, lalu mulai.</p>
            </div>

            <div className="lp-hero-aily">
              {/* bubble chat — dekoratif, jadi disembunyikan dari screen reader */}
              <ChatBubble active={!paused} reduced={reduced} />

              <span
                className="lp-mascot"
                data-hop={hop ? "" : undefined}
                onPointerEnter={triggerHop}
                onPointerDown={triggerHop}
              >
                <span className="lp-mascot-pop lp-mo">
                  <span className="lp-mascot-float lp-mo">
                    <span className="lp-mascot-hop">
                      <Image
                        className="lp-hero-logo"
                        src={LOGO_SRC}
                        alt=""
                        width={LOGO_W}
                        height={LOGO_H}
                        priority
                        sizes="(min-width: 1024px) 181px, (min-width: 768px) 120px, (min-width: 400px) 74px, 65px"
                      />
                    </span>
                  </span>
                </span>
              </span>

              <span className="lp-float lp-float--days" style={{ top: 60, left: -110 }} aria-hidden="true">
                <span className="lp-float-enter lp-mo">
                  <span className="lp-float-drift lp-mo">
                    <span className="lp-float-card">
                      <Icon name="flame" className="lp-flame lp-mo h-4 w-4 text-[#ff9600]" />7{" "}
                      <small>hari</small>
                    </span>
                  </span>
                </span>
              </span>

              <span className="lp-float lp-float--betul" style={{ bottom: -6, right: -16 }} aria-hidden="true">
                <span className="lp-betul lp-mo">
                  <span className="lp-float-card">
                    <span className="lp-float-check">
                      {/* centang digambar lewat stroke-dashoffset */}
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lp-check-draw h-3 w-3"
                      >
                        <path d="M5 13l4 4L19 7" pathLength={1} />
                      </svg>
                    </span>
                    Betul!
                  </span>
                </span>
              </span>
            </div>

            <div className="lp-hero-form">
              <CodeForm id={formId} />
            </div>
          </div>
        </div>
        <div className="lp-mode-grid">
          {MODE_CARDS.map((c) => {
            const Peek = PEEK_MAP[c.peek];
            return (
              <a
                key={c.title}
                className="lp-mode-card"
                href="#cara-kerja"
                data-live={c.badge ? "" : undefined}
              >
                {c.badge ? (
                  <span className="lp-live-badge">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                    {c.badge}
                  </span>
                ) : null}

                <span className="lp-mode-peek" aria-hidden="true">
                  <Peek />
                </span>

                <span className="lp-mode-main">
                  <span className="lp-avatar">
                    {/* PLACEHOLDER: avatar maskot per kartu */}
                    <Ph radius={999} label="avatar" />
                  </span>
                  <span className="lp-mode-title">{c.title}</span>
                  <span className="lp-mode-promise">{c.promise}</span>
                </span>

                <span className="lp-mode-arrow" aria-hidden="true">
                  <Icon name="arrow" className="h-4 w-4 text-[var(--black-charcoal)]" />
                </span>
              </a>
            );
          })}
        </div>

        <div className="lp-hero-foot">
          <p>
            Sudah punya ujian berjalan?{" "}
            <a className="lp-hub-link" href="#faq">
              Pakai Kode Lanjut
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Benefits                                                                  */
/* -------------------------------------------------------------------------- */

function Benefits() {
  return (
    <div>
      {BENEFITS.map((b) => (
        <section key={b.title} className="overflow-x-clip">
          <div className="lp-container">
            <div className={`lp-benefit ${b.flip ? "lp-benefit--flip" : ""}`}>
              <div className="lp-benefit-copy">
                <h2 className="lp-h2">{b.title}</h2>
                <p>{b.body}</p>
              </div>
              <Image
                className="lp-benefit-art aspect-[480/349]"
                src={b.art}
                alt={`Ilustrasi ${b.title}`}
                width={480}
                height={349}
                sizes="(min-width: 1024px) 480px, 320px"
              />
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Trust + marquee ulasan                                                    */
/* -------------------------------------------------------------------------- */

function ReviewCard({ r }: { r: (typeof REVIEWS_ROW_1)[number] }) {
  return (
    <figure className="lp-rv">
      <blockquote className="lp-rv-quote">
        <p>{r.quote}</p>
      </blockquote>
      <figcaption className="lp-rv-who">
        {/* PLACEHOLDER: avatar ulasan 40×40 */}
        <Ph className="h-10 w-10 shrink-0" radius={999} />
        <span className="lp-rv-id">
          <span className="lp-rv-name">{r.name}</span>
          <span className="lp-rv-src">
            <Icon name={r.kind} className="h-[14px] w-[14px]" />
            {r.src}
          </span>
        </span>
        <Stars className="lp-rv-stars" />
      </figcaption>
    </figure>
  );
}

function Marquee({
  items,
  reverse,
}: {
  items: typeof REVIEWS_ROW_1;
  reverse?: boolean;
}) {
  const set = (
    <div className="lp-marquee-track">
      {[0, 1].map((copy) => (
        <div key={copy} className="flex" aria-hidden={copy === 1}>
          {items.map((r, i) => (
            <ReviewCard key={`${copy}-${i}`} r={r} />
          ))}
        </div>
      ))}
    </div>
  );
  return (
    <div className={`lp-marquee ${reverse ? "lp-marquee--rev" : ""}`} tabIndex={0}>
      {set}
    </div>
  );
}

function Trust() {
  const [paused, setPaused] = useState(false);

  return (
    <section id="ulasan" className="lp-trust overflow-x-clip">
      <div className="lp-container">
        <div className="lp-trust-head">
          <div className="lp-trust-copy">
            <h2 className="lp-h2">dipakai banyak guru</h2>

            <p className="lp-trust-users">
              <span className="lp-trust-num">
                1.000+
                <svg
                  className="lp-trust-underline"
                  viewBox="0 0 200 10"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 7c40-4 92-5 196-2"
                    fill="none"
                    stroke="var(--lp-grad-b)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="lp-trust-label">peserta sudah mengerjakan lewat {APP_NAME}</span>
            </p>

            <ul className="lp-ratings">
              {[
                { num: "4,8", label: "rata-rata umpan balik guru", sub: "dari 500+ ulasan" },
                { num: "0", label: "kasus jawaban hilang", sub: "pada uji coba internal" },
              ].map((r) => (
                <li key={r.label} className="lp-rating">
                  <span className="lp-rating-num">{r.num}</span>
                  <Stars />
                  <span className="lp-rating-label">
                    <b>{r.label}</b> {r.sub}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* PLACEHOLDER: ilustrasi maskot memegang kartu ulasan (aslinya 232×228) */}
          <Ph className="lp-trust-art aspect-square" radius={26} label="ilustrasi" />
        </div>
      </div>

      <div className={`lp-wall ${paused ? "is-paused" : ""}`}>
        <div className="lp-container lp-wall-bar">
          <p className="lp-wall-meta">Ulasan pengguna awal</p>
          <button
            type="button"
            onClick={() => setPaused((v) => !v)}
            aria-pressed={paused}
            aria-label={paused ? "Lanjutkan ulasan" : "Jeda ulasan"}
            className="lp-wall-btn"
          >
            <Icon name={paused ? "play" : "pause"} className="h-5 w-5" />
          </button>
        </div>

        <Marquee items={REVIEWS_ROW_1} />
        <Marquee items={REVIEWS_ROW_2} reverse />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Bands                                                                     */
/* -------------------------------------------------------------------------- */

function Bands() {
  return (
    <section id="cara-kerja" className="lp-bands">
      <div className="lp-container">
        <div className="lp-bands-head">
          <h2 className="lp-h2">satu sistem, banyak kebutuhan ujian</h2>
        </div>

        <div className="lp-band-list">
          {BANDS.map((b) => (
            <div key={b.tag} className={`lp-band ${b.flip ? "lp-band--flip" : ""}`}>
              <div className="lp-band-copy">
                <p className="lp-band-brand">
                  <span>{b.brand}</span> <b>{b.tag}</b>
                </p>
                <h3>{b.title}</h3>
                <p>{b.body}</p>
                <a className="lp-band-more" href="#faq">
                  Pelajari
                  <Icon name="arrow" className="h-4 w-4" />
                </a>
              </div>
              <div className="lp-band-visual">
                {/* PLACEHOLDER: mockup visual band (aslinya 440×323) */}
                <Ph className="aspect-[440/323] w-full" radius={22} label="mockup" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Admin section                                                             */
/* -------------------------------------------------------------------------- */

function AdminSection() {
  const days = [
    { d: "S", done: true },
    { d: "S", done: true },
    { d: "R", done: false },
    { d: "K", done: true },
    { d: "J", done: false },
    { d: "S", done: false },
    { d: "M", done: false },
  ];

  return (
    <section id="admin" className="lp-appsec">
      <div className="lp-container">
        <div className="lp-appsec-grid">
          <div className="lp-appsec-copy">
            <h2 className="lp-h2">buat ujian kapan saja, di mana saja</h2>
            <p>
              Wizard empat langkah dengan draft otomatis. Ketik soal satu per satu atau impor dari
              CSV/XLSX, atur durasi dan jadwal, publish, lalu bagikan kodenya.
            </p>
            <div className="lp-appsec-actions">
              <a href="/admin/exams/new" className="lp-btn-cta">
                Buat ujian
              </a>
              <a href="/admin/login" className="lp-band-more">
                Masuk admin
                <Icon name="arrow" className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Mockup HP — dibuat dari DOM (bukan gambar), jadi tetap tajam */}
          <div className="lp-appsec-stage" aria-hidden="true">
            <div className="lp-phone">
              <div className="lp-phone-screen">
                <span className="lp-phone-island" />
                <div className="lp-phone-status">
                  <span>09.41</span>
                  <span>5G</span>
                </div>
                <div className="lp-phone-body">
                  <div className="lp-ph-row">
                    {/* PLACEHOLDER: avatar kecil di mockup HP */}
                    <Ph className="lp-ph-ava" radius={999} />
                    <p className="lp-ph-hi">
                      <small>Selamat pagi</small>
                      Halo, Bu Rina!
                    </p>
                    <span className="lp-ph-streak">
                      <Icon name="flame" className="h-3.5 w-3.5 text-[#ff9600]" />7
                    </span>
                  </div>

                  <div className="lp-ph-card">
                    <p className="lp-ph-title">Target minggu ini</p>
                    <p className="lp-ph-meta">3 dari 4 hari mengajar</p>
                    <div className="lp-ph-week">
                      {days.map((d, i) => (
                        <span key={i} className={d.done ? "is-done" : undefined}>
                          <i />
                          {d.d}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="lp-ph-card">
                    <span className="lp-ph-tag">Lanjutkan</span>
                    <p className="lp-ph-title">Ulangan Bab 3 — Aljabar</p>
                    <div className="lp-ph-progress">
                      <span />
                    </div>
                    <div className="lp-ph-tabs">
                      <span className="is-active">Soal</span>
                      <span>Peserta</span>
                      <span>Nilai</span>
                    </div>
                  </div>

                  <div className="lp-ph-card">
                    <span className="lp-ph-tag">Peserta mengerjakan</span>
                    <p className="lp-ph-text">24 dari 32 peserta sudah mengumpulkan.</p>
                    <div className="lp-ph-option">
                      <span className="lp-ph-option-key">A</span>
                      Ikut naik
                    </div>
                    <div className="lp-ph-option is-correct">
                      <span className="lp-ph-option-key">B</span>
                      Cenderung turun
                    </div>
                  </div>
                </div>
                <span className="lp-phone-home" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  FAQ                                                                       */
/* -------------------------------------------------------------------------- */

function Faq() {
  return (
    <section id="faq" className="lp-faq-sec">
      <div className="lp-faq-inner">
        <h2 className="lp-h2">yang sering ditanyain</h2>
        <div className="lp-faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <span className="lp-faq-icon">
                  <Icon name="plus" className="h-4 w-4" />
                </span>
              </summary>
              <div className="lp-faq-answer">{f.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Final CTA                                                                 */
/* -------------------------------------------------------------------------- */

function FinalCta() {
  return (
    <section className="lp-final">
      <div className="lp-container">
        <h2 className="lp-final-title">mulai ujian bareng {APP_NAME}</h2>
        <a href="/admin/exams/new" className="lp-final-btn">
          Mulai
        </a>
        <div className="lp-final-art">
          {/* PLACEHOLDER: ilustrasi maskot final CTA (aslinya 640×400) */}
          <Ph className="aspect-[16/10] w-full" radius={26} label="ilustrasi" />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Footer                                                                    */
/* -------------------------------------------------------------------------- */

function FooterColumn({ group }: { group: { title: string; links: string[] } }) {
  const id = `footer-col-${group.title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="lp-footer-col">
      <input type="checkbox" id={id} className="lp-footer-toggle" />
      <h3>
        <label htmlFor={id}>
          {group.title}
          <Icon name="chevron" className="lp-footer-chevron h-4 w-4" />
        </label>
      </h3>
      <ul>
        {group.links.map((l) => (
          <li key={l}>
            <a className="lp-footer-link" href="#faq">
              {l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-inner">
        <div className="lp-footer-top">
          <div className="lp-footer-brand">
            <a className="lp-footer-logo" href="#peserta">
              <Image
                className="lp-logo lp-logo--footer"
                src={LOGO_SRC}
                alt=""
                width={LOGO_W}
                height={LOGO_H}
                sizes="88px"
              />
              <span>{APP_NAME}</span>
            </a>
            <p>Membantu guru dan panitia menyelenggarakan ujian tanpa ribet.</p>
            <div className="lp-footer-dl">
              <a className="lp-footer-download" href="/admin/exams/new">
                Unduh Aplikasi
              </a>
              <div className="lp-footer-badges">
                {/* PLACEHOLDER: badge App Store / Play Store / Web App */}
                <Ph className="h-11 w-[120px]" radius={8} label="badge app store" />
                <Ph className="h-11 w-[135px]" radius={8} label="badge play store" />
                <Ph className="h-11 w-[129px]" radius={8} label="badge web app" />
              </div>
            </div>
          </div>

          <nav aria-label="Tautan situs" className="lp-footer-nav">
            {FOOTER_COLUMNS.map((col, i) => (
              <div key={i} className="lp-footer-stack">
                {col.groups.map((g) => (
                  <FooterColumn key={g.title} group={g} />
                ))}
              </div>
            ))}

            <div className="lp-footer-contact">
              <div>
                <h3>Kontak</h3>
                <ul>
                  <li>
                    <a className="lp-footer-link" href="#faq">
                      Chat WhatsApp
                    </a>
                  </li>
                  <li>
                    <a className="lp-footer-link" href="#faq">
                      support@sikilat.id
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h3>Ikuti Kami</h3>
                <ul className="lp-footer-social">
                  <li>
                    <a className="lp-footer-social-link" href="#faq" aria-label="Instagram">
                      <Icon name="star" className="h-5 w-5" />
                    </a>
                  </li>
                  <li>
                    <a className="lp-footer-social-link" href="#faq" aria-label="TikTok">
                      <Icon name="play" className="h-5 w-5" />
                    </a>
                  </li>
                  <li>
                    <a className="lp-footer-social-link" href="#faq" aria-label="YouTube">
                      <Icon name="play" className="h-5 w-5" />
                    </a>
                  </li>
                  <li>
                    <a className="lp-footer-social-link" href="#faq" aria-label="X">
                      <Icon name="x" className="h-5 w-5" />
                    </a>
                  </li>
                  <li>
                    <a className="lp-footer-social-link" href="#faq" aria-label="LinkedIn">
                      <Icon name="key" className="h-5 w-5" />
                    </a>
                  </li>
                  <li>
                    <a className="lp-footer-social-link" href="#faq" aria-label="Facebook">
                      <Icon name="flame" className="h-5 w-5" />
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </nav>
        </div>

        <div className="lp-footer-bottom">
          <div className="lp-footer-meta">
            {FOOTER_META.map((m) => (
              <span key={m}>{m}</span>
            ))}
            <span>
              © {new Date().getFullYear()} {APP_NAME}
            </span>
          </div>
          <p className="lp-footer-lang">
            <span>Bahasa situs:</span>
            <a className="lp-footer-link is-current" href="#peserta" hrefLang="id" lang="id">
              Indonesia
            </a>
            <a className="lp-footer-link" href="#peserta" hrefLang="en" lang="en">
              English
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/*  Halaman                                                                   */
/* -------------------------------------------------------------------------- */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--lp-bg)] text-[var(--black-charcoal)]">
      <Nav />
      <main>
        <Hero />
        <Benefits />
        <Trust />
        <Bands />
        <AdminSection />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
