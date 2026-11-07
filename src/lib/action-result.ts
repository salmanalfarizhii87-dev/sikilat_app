import { z } from "zod";

/**
 * Kontrak hasil Server Action (PRD §8.1).
 *
 * Setiap aksi mengembalikan `ActionResult<T>`, **tidak pernah** melempar error
 * ke pemanggil. Alasannya: saat Server Action melempar, Next.js mengirim pesan
 * galat generik ke klien dan membocorkan stack trace di log produksi. Dengan
 * hasil bertipe, UI bisa menampilkan pesan yang tepat dan kode error bisa diuji.
 *
 * `fields` hanya diisi untuk `VALIDATION`, berisi pesan per nama field supaya
 * formulir bisa menyorot input yang salah.
 */
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "EXAM_NOT_FOUND"
  | "EXAM_NOT_OPEN"
  | "EXAM_CLOSED"
  | "NO_ATTEMPTS_LEFT"
  | "NAME_IN_USE"
  | "INVALID_RESUME_CODE"
  | "ATTEMPT_EXPIRED"
  | "RATE_LIMITED"
  | "INTERNAL";

export interface ActionError {
  code: ErrorCode;
  message: string;
  fields?: Record<string, string[]>;
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

/**
 * `fail<T>` diberi default `never` supaya `return fail(...)` bisa dipakai di
 * fungsi yang mengembalikan `ActionResult<X>` apa pun, tanpa perlu menulis
 * `fail<X>`. `never` dapat ditugaskan ke tipe apa pun, jadi ini aman.
 */
export function fail<T = never>(
  code: ErrorCode,
  message: string,
  fields?: Record<string, string[]>,
): ActionResult<T> {
  return { ok: false, error: fields ? { code, message, fields } : { code, message } };
}

/**
 * Ubah `ZodError` menjadi `VALIDATION` dengan pesan per field.
 *
 * `z.flattenError` (Zod v4) mengumpulkan pesan per field; pesan tingkat akar
 * (`_errors`) digabung masuk ke `message` supaya tidak ada yang hilang diam-diam.
 */
export function validationFail<T = never>(error: z.ZodError, message?: string): ActionResult<T> {
  const flat = z.flattenError(error);
  const fields = Object.fromEntries(
    Object.entries(flat.fieldErrors).filter((entry): entry is [string, string[]] =>
      Array.isArray(entry[1] ? entry[1] : undefined),
    ),
  );

  const summary =
    message ??
    flat.formErrors[0] ??
    // Ambil pesan field pertama sebagai ringkasan; field-nya tetap disorot lewat `fields`.
    Object.values(fields).flat()[0] ??
    "Data yang dikirim tidak valid.";

  return fail<T>("VALIDATION", summary, fields);
}
