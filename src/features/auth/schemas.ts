import { z } from "zod";

/**
 * Skema autentikasi admin (PRD §8.2, domain Auth).
 *
 * Pesan galat berbahasa Indonesia dan ditulis dari sudut pandang pengguna:
 * menyebut apa yang harus diperbaiki, bukan apa yang gagal di database.
 */

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    // Normalisasi sebelum validasi: `Admin@Sekolah.Sch.ID` dan `admin@sekolah.sch.id`
    // harus dianggap satu akun. Email Supabase Auth disimpan huruf kecil.
    .toLowerCase()
    .min(1, "Email wajib diisi.")
    .pipe(z.email("Format email tidak valid, mis. nama@sekolah.sch.id.")),

  /*
   * Sengaja hanya diperiksa "terisi", tanpa aturan panjang/karakter.
   * Aturan kekuatan password adalah urusan saat membuat password, bukan saat
   * masuk. Menolak password pendek di sini akan memberi tahu penyerang bahwa
   * password itu pasti salah, sebelum server sempat memeriksanya.
   */
  password: z.string().min(1, "Kata sandi wajib diisi."),
});

export type SignInInput = z.infer<typeof signInSchema>;

export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Kata sandi saat ini wajib diisi."),
    newPassword: z
      .string()
      .min(8, "Kata sandi baru minimal 8 karakter.")
      .max(72, "Kata sandi baru maksimal 72 karakter.")
      .regex(/[a-z]/, "Kata sandi baru harus memuat huruf kecil.")
      .regex(/[A-Z]/, "Kata sandi baru harus memuat huruf besar.")
      .regex(/[0-9]/, "Kata sandi baru harus memuat angka."),
    confirmPassword: z.string().min(1, "Konfirmasi kata sandi wajib diisi."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Konfirmasi kata sandi tidak cocok.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: "Kata sandi baru harus berbeda dari kata sandi saat ini.",
    path: ["newPassword"],
  });

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
