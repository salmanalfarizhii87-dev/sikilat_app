/*
 * Corat-coret latar panel kiri halaman login. Bentuk path, viewBox, dan tiga
 * lapisan breakpoint (base/xl/2xl) disalin apa adanya dari pintarly.id/login,
 * termasuk gradien blue-400 → green-400. Animasi (garis tergambar, bidang pop, drift) ditambahkan di sini karena
 * markup aslinya statis.
 */

type Stroke = "h-bg" | "h-gb" | "v-bg" | "v-gb" | "d-bg" | "d-gb";
type Shape = { d: string; s: Stroke } | { d: string; f: Stroke };

const strokeProps = {
  strokeWidth: 4,
  strokeLinecap: "round",
  fill: "none",
  vectorEffect: "non-scaling-stroke",
} as const;

export function DoodleDefs() {
  return (
    <svg width="0" height="0" aria-hidden focusable="false" className="absolute size-0 overflow-hidden">
      <defs>
        <linearGradient id="doodle-h-bg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ade8fd" />
          <stop offset="100%" stopColor="#daf395" />
        </linearGradient>
        <linearGradient id="doodle-h-gb" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#daf395" />
          <stop offset="100%" stopColor="#ade8fd" />
        </linearGradient>
        <linearGradient id="doodle-v-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ade8fd" />
          <stop offset="100%" stopColor="#daf395" />
        </linearGradient>
        <linearGradient id="doodle-v-gb" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#daf395" />
          <stop offset="100%" stopColor="#ade8fd" />
        </linearGradient>
        <linearGradient id="doodle-d-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ade8fd" />
          <stop offset="100%" stopColor="#daf395" />
        </linearGradient>
        <linearGradient id="doodle-d-gb" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#daf395" />
          <stop offset="100%" stopColor="#ade8fd" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * Satu path = satu elemen bergerak. Garis digambar (dash), bidang muncul (pop),
 * dan tiap elemen dibungkus <g> yang mengapung sendiri supaya tidak serempak.
 */
function ShapePath({ shape, i }: { shape: Shape; i: number }) {
  const enter = (i % 7) * 0.14;
  const drift = (i % 5) * 0.7;

  return (
    <g className="doodle-drift" style={{ animationDelay: `${drift}s` }}>
      {"s" in shape ? (
        <path
          d={shape.d}
          stroke={`url(#doodle-${shape.s})`}
          {...strokeProps}
          pathLength={1}
          className="doodle-draw"
          style={{ animationDelay: `${enter}s` }}
        />
      ) : (
        <path
          d={shape.d}
          fill={`url(#doodle-${shape.f})`}
          className="doodle-pop"
          style={{ animationDelay: `${enter}s` }}
        />
      )}
    </g>
  );
}

function Layer({
  shapes,
  viewBox,
  className,
}: {
  shapes: Shape[];
  viewBox: string;
  className?: string;
}) {
  return (
    <svg
      className={`h-full w-full opacity-35 ${className ?? ""}`}
      viewBox={viewBox}
      preserveAspectRatio="none"
      fill="none"
    >
      <g>
        {shapes.map((shape, i) => (
          <ShapePath key={`${shape.d.slice(0, 12)}-${i}`} shape={shape} i={i} />
        ))}
      </g>
    </svg>
  );
}

const MOBILE: Shape[] = [
  { d: "M -20 60 C 40 34, 96 92, 152 62 C 196 38, 234 88, 214 118", s: "h-bg" },
  { d: "M 1020 84 C 962 112, 906 52, 848 84 C 806 106, 772 58, 792 32", s: "h-gb" },
  { d: "M 900 32 L 905 40 L 916 44 L 905 48 L 900 56 L 895 48 L 884 44 L 895 40 Z", f: "d-bg" },
];

const BASE: Shape[] = [
  { d: "M 200 -58 C 244 -28, 198 -4, 242 14 C 272 26, 314 6, 288 -14", s: "h-bg" },
  { d: "M 470 -4 L 474 3 L 483 6 L 474 9 L 470 16 L 466 9 L 457 6 L 466 3 Z", f: "d-bg" },
  { d: "M 340 13 C 350 11, 362 16, 372 15 M 357 1 C 355 9, 358 19, 355 27", s: "d-bg" },
  { d: "M 990 60 C 928 88, 872 62, 812 92 C 748 124, 700 100, 640 128", s: "h-gb" },
  { d: "M 990 210 L 994 217 L 1003 220 L 994 223 L 990 230 L 986 223 L 977 220 L 986 217 Z", f: "d-bg" },
  { d: "M 594.5 180 C 595 174.5, 606.5 174, 607.5 180.4 C 608 185.8, 596.5 186, 594.5 180 Z", f: "h-bg" },
  { d: "M 1010 800 C 952 786, 928 742, 878 726 C 828 710, 806 668, 752 648", s: "h-gb" },
  { d: "M 670.5 646 C 671 640.5, 682.5 640, 683.5 646.4 C 684 651.8, 672.5 652, 670.5 646 Z", f: "d-bg" },
  { d: "M 31.5 190 C 32 184.5, 43.5 184, 44.5 190.4 C 45 195.8, 33.5 196, 31.5 190 Z", f: "h-bg" },
];

const XL: Shape[] = [
  { d: "M 200 -58 C 244 -28, 198 -4, 242 14 C 272 26, 314 6, 288 -14", s: "h-bg" },
  { d: "M 640 -62 C 688 -34, 728 -2, 790 -18 C 838 -30, 862 4, 828 22", s: "d-gb" },
  { d: "M 470 -4 L 474 3 L 483 6 L 474 9 L 470 16 L 466 9 L 457 6 L 466 3 Z", f: "d-bg" },
  { d: "M 869.5 20 C 870 14.5, 881.5 14, 882.5 20.4 C 883 25.8, 871.5 26, 869.5 20 Z", f: "d-gb" },
  { d: "M 340 13 C 350 11, 362 16, 372 15 M 357 1 C 355 9, 358 19, 355 27", s: "d-bg" },
  { d: "M 990 60 C 928 88, 872 62, 812 92 C 748 124, 700 100, 640 128", s: "h-gb" },
  { d: "M 950 150 C 926 186, 896 178, 876 214 C 858 246, 838 240, 830 268", s: "d-gb" },
  { d: "M 692 52 C 706 49, 714 65, 701 73 C 688 81, 680 65, 690 57", s: "v-gb" },
  { d: "M 990 210 L 994 217 L 1003 220 L 994 223 L 990 230 L 986 223 L 977 220 L 986 217 Z", f: "d-bg" },
  { d: "M 594.5 180 C 595 174.5, 606.5 174, 607.5 180.4 C 608 185.8, 596.5 186, 594.5 180 Z", f: "h-bg" },
  { d: "M 744 296 C 754 294, 766 299, 776 298 M 761 284 C 759 292, 762 302, 759 310", s: "d-gb" },
  { d: "M 1010 800 C 952 786, 928 742, 878 726 C 828 710, 806 668, 752 648", s: "h-gb" },
  { d: "M 700 990 C 688 946, 664 936, 656 892 C 648 848, 626 826, 613 777", s: "d-bg" },
  { d: "M 980 650 L 984 657 L 993 660 L 984 663 L 980 670 L 976 663 L 967 660 L 976 657 Z", f: "d-gb" },
  { d: "M 670.5 646 C 671 640.5, 682.5 640, 683.5 646.4 C 684 651.8, 672.5 652, 670.5 646 Z", f: "d-bg" },
  { d: "M 984.5 840 C 985 834.5, 996.5 834, 997.5 840.4 C 998 845.8, 986.5 846, 984.5 840 Z", f: "d-gb" },
  { d: "M 734.5 900 C 735 894.5, 746.5 894, 747.5 900.4 C 748 905.8, 736.5 906, 734.5 900 Z", f: "d-bg" },
  { d: "M 552 946 C 566 943, 574 959, 561 967 C 548 975, 540 959, 550 951", s: "v-gb" },
  { d: "M 846 972 C 856 970, 868 975, 878 974 M 863 960 C 861 968, 864 978, 861 986", s: "d-gb" },
  { d: "M 130 88 C 140 86, 152 91, 162 90 M 147 76 C 145 84, 148 94, 145 102", s: "d-gb" },
  { d: "M 31.5 190 C 32 184.5, 43.5 184, 44.5 190.4 C 45 195.8, 33.5 196, 31.5 190 Z", f: "h-bg" },
  { d: "M 168 244 L 172 251 L 181 254 L 172 257 L 168 264 L 164 257 L 155 254 L 164 251 Z", f: "d-bg" },
];

const XXL: Shape[] = [
  { d: "M 790 190 C 742 214, 706 196, 664 222 C 630 242, 616 232, 596 262", s: "d-bg" },
  { d: "M 960 1000 C 942 958, 908 950, 892 910 C 876 870, 836 858, 784 809", s: "h-bg" },
  { d: "M 20 84 C 58 96, 72 134, 112 146 C 152 158, 166 190, 204 202", s: "h-gb" },
];

const BOTTOM_LEFT: Shape[] = [
  { d: "M 22 40 C 36 37, 44 53, 31 61 C 18 69, 10 53, 20 45", s: "v-gb" },
  { d: "M 112.5 128 C 113 122.5, 124.5 122, 125.5 128.4 C 126 133.8, 114.5 134, 112.5 128 Z", f: "d-bg" },
  { d: "M 196 92 L 200 99 L 209 102 L 200 105 L 196 112 L 192 105 L 183 102 L 192 99 Z", f: "d-gb" },
];

const BOTTOM_LEFT_TALL: Shape[] = [
  { d: "M 12 132 C 46 122, 62 96, 96 86 C 130 76, 146 44, 180 32", s: "h-bg" },
];

export const DoodlesMobile = () => <Layer shapes={MOBILE} viewBox="0 0 1000 200" />;
export const DoodlesBase = () => <Layer shapes={BASE} viewBox="0 0 1000 1000" />;
export const DoodlesXl = () => <Layer shapes={XL} viewBox="0 0 1000 1000" />;
export const Doodles2xl = () => <Layer shapes={XXL} viewBox="0 0 1000 1000" />;
export const DoodlesBottomLeft = () => (
  <Layer shapes={BOTTOM_LEFT} viewBox="0 0 220 150" />
);
export const DoodlesBottomLeftTall = () => (
  <Layer shapes={BOTTOM_LEFT_TALL} viewBox="0 0 220 150" />
);

/** Garis coret di bawah satu kata pada judul; tergambar dari kiri ke kanan. */
export function TitleUnderline({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute -bottom-2 left-0 h-3 w-full ${className ?? ""}`}
    >
      <svg className="h-full w-full opacity-70" viewBox="0 0 200 24" preserveAspectRatio="none" fill="none">
        <path
          d="M 4 15 C 46 6, 92 20, 140 10 C 168 4, 186 15, 196 9"
          stroke="url(#doodle-h-bg)"
          {...strokeProps}
          pathLength={1}
          strokeDasharray={1}
          className="doodle-draw"
        />
      </svg>
    </span>
  );
}
