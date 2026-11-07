/**
 * Trim padding transparan dari logo + generate favicon.
 *
 * Pakai: node scripts/trim-logo.cjs
 *
 * Sumber  : logo_sikilat.png (di root project, file asli dari desainer)
 * Output 1: public/logo-sikilat.png  → logo sudah di-trim, dipakai <Image />
 * Output 2: app/icon.png             → favicon Next.js (512×512)
 *
 * Jalankan ulang skrip ini setiap kali logo_sikilat.png diganti.
 */

const sharp = require("sharp");
const fs = require("fs");

const SRC = "logo_sikilat.png";
const OUT_LOGO = "public/logo-sikilat.png";
const OUT_ICON = "app/icon.png";

/** padding di sekeliling isi logo, dalam piksel kanvas hasil trim */
const LOGO_PAD = 12;
/** ukuran kanvas favicon */
const ICON_SIZE = 512;
/** porsi kanvas favicon yang dipakai isi logo (0.82 = 82%) */
const ICON_FIT = 0.82;

(async () => {
  if (!fs.existsSync("public")) fs.mkdirSync("public", { recursive: true });

  // 1. buang area transparan di tepi
  const trimmed = await sharp(SRC)
    .trim({ threshold: 10 })
    .toBuffer({ resolveWithObject: true });

  const { width: tw, height: th } = trimmed.info;
  console.log(`isi logo (setelah trim): ${tw}×${th}  rasio ${(tw / th).toFixed(4)}`);

  // 2. logo final: isi + padding tipis supaya tepi tidak mentok
  await sharp(trimmed.data)
    .extend({
      top: LOGO_PAD,
      bottom: LOGO_PAD,
      left: LOGO_PAD,
      right: LOGO_PAD,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(OUT_LOGO);

  const lm = await sharp(OUT_LOGO).metadata();
  console.log(`→ ${OUT_LOGO}  ${lm.width}×${lm.height}  ${(fs.statSync(OUT_LOGO).size / 1024).toFixed(1)} KB`);

  // 3. favicon: kanvas persegi, logo di tengah, latar transparan
  const target = Math.round(ICON_SIZE * ICON_FIT);
  const scale = Math.min(target / tw, target / th);
  const rw = Math.round(tw * scale);
  const rh = Math.round(th * scale);

  const resized = await sharp(trimmed.data)
    .resize(rw, rh, { fit: "inside", kernel: "lanczos3" })
    .toBuffer();

  await sharp({
    create: {
      width: ICON_SIZE,
      height: ICON_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: resized,
        top: Math.round((ICON_SIZE - rh) / 2),
        left: Math.round((ICON_SIZE - rw) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(OUT_ICON);

  const im = await sharp(OUT_ICON).metadata();
  console.log(`→ ${OUT_ICON}  ${im.width}×${im.height}  ${(fs.statSync(OUT_ICON).size / 1024).toFixed(1)} KB`);
})();
