/**
 * Konversi waktu untuk jadwal ujian (T3.1).
 *
 * `<input type="datetime-local">` mengirim **jam dinding tanpa zona waktu**,
 * mis. `2026-11-10T07:30`. Kalau string itu dikirim apa adanya ke PostgREST,
 * Postgres menafsirkannya sebagai UTC — jadwal 07:30 WIB akan tersimpan sebagai
 * 14:30 WIB. Kesalahan tujuh jam ini tidak terlihat di UI (form memuat kembali
 * nilai yang sama) tetapi membuat ujian terbuka tujuh jam lebih lambat.
 *
 * Karena itu konversi dilakukan eksplisit di satu tempat: jam dinding Jakarta
 * → instan UTC saat menyimpan, dan sebaliknya saat mengisi form.
 *
 * Asia/Jakarta tidak memakai DST, jadi offset-nya tetap +07:00 sepanjang tahun.
 * Bila kelak ada zona lain, modul ini yang harus diubah — bukan pemanggilnya.
 */

const JAKARTA_OFFSET_MINUTES = 7 * 60;

const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;
const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Ubah nilai `datetime-local` (jam dinding Jakarta) menjadi instan ISO UTC.
 *
 * Mengembalikan `null` untuk string kosong **dan** untuk nilai yang tidak bisa
 * ditafsirkan. Pemanggil membedakan keduanya lewat `input === ""`.
 */
export function jakartaLocalToIso(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  // Sudah berupa instan lengkap dengan zona (mis. dari API): percayai apa adanya.
  if (HAS_ZONE.test(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const match = LOCAL_PATTERN.exec(value);
  if (!match) return null;

  /*
   * Setiap grup diurai satu per satu, **bukan** `match.map(Number)`.
   * `Number(undefined)` menghasilkan `NaN`, dan `NaN ?? 0` tetap `NaN` — jadi
   * detik yang tidak ditulis (`07:30` alih-alih `07:30:00`) akan membuat seluruh
   * perhitungan menjadi `NaN` dan jadwal yang sah ditolak. Sudah pernah terjadi
   * di sini dan tertangkap saat uji.
   */
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);

  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const instant = asUtc - JAKARTA_OFFSET_MINUTES * 60_000;

  /*
   * `Date.UTC` menormalkan tanggal yang tidak ada (31 Februari menjadi 3 Maret),
   * jadi hasilnya tidak bisa dipakai untuk membuktikan masukannya sah. Balikkan
   * lagi ke komponen Jakarta lalu bandingkan: bila berbeda, masukannya memang
   * tanggal/jam yang tidak ada dan harus ditolak, bukan digeser diam-diam.
   */
  const check = new Date(instant + JAKARTA_OFFSET_MINUTES * 60_000);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute ||
    check.getUTCSeconds() !== second
  ) {
    return null;
  }

  return new Date(instant).toISOString();
}

/**
 * Kebalikannya: instan ISO dari database menjadi nilai untuk `datetime-local`.
 *
 * `null` masuk → `""` keluar, karena input kosong berarti "tanpa jadwal"
 * (ujian dibuka/ditutup manual), bukan tengah malam.
 */
export function isoToJakartaLocal(iso: string | null | undefined): string {
  if (!iso) return "";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const shifted = new Date(date.getTime() + JAKARTA_OFFSET_MINUTES * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return [
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`,
  ].join("T");
}

/**
 * Label jam Jakarta untuk teks bantu, mis. `10 Nov 2026, 07.30 WIB`.
 *
 * Ditulis manual (bukan `toLocaleString`) supaya hasilnya sama di server dan di
 * peramban — format locale bisa berbeda antar lingkungan dan memicu peringatan
 * hidrasi.
 */
export function formatJakartaLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const shifted = new Date(date.getTime() + JAKARTA_OFFSET_MINUTES * 60_000);
  const bulan = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ];
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${shifted.getUTCDate()} ${bulan[shifted.getUTCMonth()]} ${shifted.getUTCFullYear()}, ${pad(
    shifted.getUTCHours(),
  )}.${pad(shifted.getUTCMinutes())} WIB`;
}
