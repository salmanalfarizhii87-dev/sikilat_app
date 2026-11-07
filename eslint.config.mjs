import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /*
     * Landing page disalin apa adanya dari project `landing_page_kilatcbt`
     * (diminta 100% tanpa perubahan). Isinya masih memakai `<a>` untuk tautan
     * internal dan `setState` langsung di dalam effect, yang ditandai aturan
     * `@next/next/no-html-link-for-pages` dan `react-hooks/set-state-in-effect`.
     * Memperbaikinya berarti mengubah file asli, jadi folder ini dikecualikan
     * dari lint seperti kode pihak ketiga. Kalau nanti landing page boleh
     * diubah, hapus baris ini dan perbaiki 9 temuan di `(landing)/page.tsx`.
     */
    "src/app/(landing)/**",
  ]),
]);

export default eslintConfig;
