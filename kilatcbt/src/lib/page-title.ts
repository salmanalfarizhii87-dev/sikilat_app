import type { Metadata } from "next";

/**
 * Template judul dipakai di root layout dan diulang di setiap layout admin.
 *
 * Next.js hanya menyimpan `title.template` dari layout terakhir yang punya
 * template; layout yang menulis `title` sebagai string biasa menghapusnya untuk
 * semua segmen di bawahnya. Akibatnya /admin/exams/exm_01/monitor sempat berjudul
 * "Monitor peserta" tanpa akhiran "· siKilat". Helper ini mengembalikan
 * `default` + `template` sekaligus supaya rantainya tidak putus.
 */
export function pageTitle(title: string): Metadata["title"] {
  return { default: title, template: "%s · siKilat" };
}
