import type { Exam, Question } from "./types";

export const demoExam: Exam = {
  id: "exm_01",
  code: "MAT7A2",
  title: "Penilaian Tengah Semester, Matematika",
  subjectLabel: "Matematika · Kelas 7",
  description:
    "Ujian tengah semester untuk mengukur pemahaman aljabar, bilangan bulat, dan perbandingan.",
  instructions:
    "Baca setiap soal dengan teliti. Kamu boleh melewati soal dan kembali lagi nanti. Jawaban tersimpan otomatis setiap kali kamu memilih opsi. Waktu berjalan terus walau kamu menutup tab.",
  status: "published",
  durationMinutes: 60,
  maxAttempts: 2,
  scorePolicy: "highest",
  passingScore: 70,
  shuffleQuestions: false,
  shuffleOptions: false,
  askClass: true,
  resultVisibility: "score_and_review",
  resultRelease: "instant",
  createdAt: "2026-10-28T02:00:00.000Z",
};

type Seed = Omit<Question, "id" | "examId" | "options" | "correctOptionIds"> & {
  options?: string[];
  correct?: number[];
};

const seeds: Seed[] = [
  {
    position: 1,
    type: "mcq_single",
    body: "Hasil dari −7 + 12 − (−5) adalah …",
    points: 1,
    options: ["−14", "0", "10", "24"],
    correct: [2],
    explanation: "−7 + 12 = 5, lalu 5 − (−5) = 5 + 5 = 10.",
  },
  {
    position: 2,
    type: "mcq_single",
    body: "Nilai x yang memenuhi persamaan 3x − 8 = 7 adalah …",
    points: 1,
    options: ["3", "5", "7", "15"],
    correct: [1],
    explanation: "3x = 15 sehingga x = 5.",
  },
  {
    position: 3,
    type: "mcq_single",
    body: "Sebuah toko memberi diskon 25% untuk sepatu seharga Rp320.000. Harga yang harus dibayar adalah …",
    points: 1,
    options: ["Rp80.000", "Rp240.000", "Rp260.000", "Rp295.000"],
    correct: [1],
    explanation: "Diskon = 25% × 320.000 = 80.000, sehingga harga bayar 240.000.",
  },
  {
    position: 4,
    type: "mcq_multiple",
    body: "Manakah pernyataan berikut yang bernilai benar? Pilih semua jawaban yang benar.",
    points: 2,
    options: [
      "−5 lebih kecil dari −2",
      "0 adalah bilangan bulat positif",
      "Hasil kali dua bilangan negatif selalu positif",
      "−3 > 1",
    ],
    correct: [0, 2],
    explanation:
      "Pada garis bilangan −5 berada di kiri −2. Perkalian dua bilangan bertanda sama menghasilkan bilangan positif.",
  },
  {
    position: 5,
    type: "mcq_single",
    body: "Bentuk sederhana dari 4(2a − 3) − 3(a + 5) adalah …",
    points: 1,
    options: ["5a − 27", "5a + 3", "11a − 27", "11a + 3"],
    correct: [0],
    explanation: "8a − 12 − 3a − 15 = 5a − 27.",
  },
  {
    position: 6,
    type: "mcq_single",
    body: "Perbandingan uang Ani dan Budi adalah 3 : 5. Jika uang Budi Rp75.000, uang Ani adalah …",
    points: 1,
    options: ["Rp25.000", "Rp45.000", "Rp50.000", "Rp60.000"],
    correct: [1],
    explanation: "Uang Ani = 3/5 × 75.000 = 45.000.",
  },
  {
    position: 7,
    type: "mcq_single",
    body: "Gradien garis yang melalui titik (2, 3) dan (6, 11) adalah …",
    points: 1,
    options: ["1/2", "2", "4", "8"],
    correct: [1],
    explanation: "m = (11 − 3) / (6 − 2) = 8/4 = 2.",
  },
  {
    position: 8,
    type: "mcq_single",
    body: "Keliling persegi panjang dengan panjang 12 cm dan lebar 7 cm adalah …",
    points: 1,
    options: ["19 cm", "38 cm", "42 cm", "84 cm"],
    correct: [1],
    explanation: "Keliling = 2(12 + 7) = 38 cm.",
  },
  {
    position: 9,
    type: "mcq_multiple",
    body: "Manakah di antara bilangan berikut yang merupakan bilangan prima? Pilih semua jawaban yang benar.",
    points: 2,
    options: ["21", "29", "33", "37", "39"],
    correct: [1, 3],
    explanation: "29 dan 37 hanya habis dibagi 1 dan dirinya sendiri.",
  },
  {
    position: 10,
    type: "mcq_single",
    body: "Hasil dari 2³ × 2⁴ adalah …",
    points: 1,
    options: ["2⁷", "2¹²", "4⁷", "4¹²"],
    correct: [0],
    explanation: "aᵐ × aⁿ = aᵐ⁺ⁿ sehingga 2³⁺⁴ = 2⁷.",
  },
  {
    position: 11,
    type: "mcq_single",
    body: "Rata-rata dari data 6, 7, 8, 9, 10 adalah …",
    points: 1,
    options: ["7", "7,5", "8", "8,5"],
    correct: [2],
    explanation: "Jumlah data 40 dibagi 5 = 8.",
  },
  {
    position: 12,
    type: "mcq_single",
    body: "Jika sebuah dadu dilempar satu kali, peluang muncul mata dadu genap adalah …",
    points: 1,
    options: ["1/6", "1/3", "1/2", "2/3"],
    correct: [2],
    explanation: "Mata genap ada 3 dari 6 kemungkinan sehingga peluangnya 1/2.",
  },
  {
    position: 13,
    type: "mcq_single",
    body: "Nilai dari 15% dari 240 adalah …",
    points: 1,
    options: ["24", "30", "36", "48"],
    correct: [2],
    explanation: "15% × 240 = 36.",
  },
  {
    position: 14,
    type: "mcq_single",
    body: "Sebuah mobil menempuh 180 km dalam 3 jam. Kecepatan rata-ratanya adalah …",
    points: 1,
    options: ["50 km/jam", "55 km/jam", "60 km/jam", "65 km/jam"],
    correct: [2],
    explanation: "180 ÷ 3 = 60 km/jam.",
  },
  {
    position: 15,
    type: "mcq_single",
    body: "Himpunan penyelesaian dari 2x + 5 < 11 untuk x bilangan bulat adalah …",
    points: 1,
    options: ["x < 3", "x > 3", "x ≤ 3", "x ≥ 3"],
    correct: [0],
    explanation: "2x < 6 sehingga x < 3.",
  },
  {
    position: 16,
    type: "mcq_single",
    body: "Luas lingkaran dengan jari-jari 7 cm (π = 22/7) adalah …",
    points: 1,
    options: ["44 cm²", "77 cm²", "154 cm²", "308 cm²"],
    correct: [2],
    explanation: "L = πr² = 22/7 × 49 = 154 cm².",
  },
  {
    position: 17,
    type: "mcq_single",
    body: "Bentuk pecahan desimal dari 3/8 adalah …",
    points: 1,
    options: ["0,125", "0,375", "0,625", "0,875"],
    correct: [1],
    explanation: "3 ÷ 8 = 0,375.",
  },
  {
    position: 18,
    type: "essay",
    body: "Jelaskan langkah-langkah menyelesaikan sistem persamaan 2x + y = 10 dan x − y = 2 dengan metode substitusi. Tuliskan hasil akhir nilai x dan y.",
    points: 5,
    wordMin: 20,
    wordMax: 150,
    referenceAnswer:
      "Dari x − y = 2 diperoleh x = y + 2. Substitusi ke 2x + y = 10 menghasilkan 2(y + 2) + y = 10 → 3y = 6 → y = 2, lalu x = 4. Jadi x = 4 dan y = 2.",
    explanation:
      "Kunci penilaian: pemisahan variabel, proses substitusi yang benar, dan hasil akhir x = 4, y = 2.",
  },
  {
    position: 19,
    type: "essay",
    body: "Sebuah taman berbentuk persegi panjang berukuran 20 m × 15 m. Di tengah taman dibuat kolam berbentuk lingkaran berdiameter 7 m. Hitung luas taman yang tidak tertutup kolam dan jelaskan caramu.",
    points: 5,
    wordMin: 15,
    wordMax: 120,
    referenceAnswer:
      "Luas taman 20 × 15 = 300 m². Luas kolam πr² dengan r = 3,5 m ≈ 38,5 m². Luas tersisa ≈ 261,5 m².",
    explanation: "Perhatikan penggunaan jari-jari setengah diameter dan pembulatan π.",
  },
  {
    position: 20,
    type: "essay",
    body: "Data nilai delapan siswa adalah 70, 80, 90, 60, 70, 85, 95, 75. Hitung mean, median, dan modus, lalu jelaskan data mana yang paling mewakili nilai kelas.",
    points: 5,
    wordMin: 20,
    wordMax: 160,
    referenceAnswer:
      "Mean = 625/8 = 78,125. Data terurut: 60, 70, 70, 75, 80, 85, 90, 95 → median = 77,5. Modus = 70. Mean umumnya paling mewakili karena memakai seluruh data.",
    explanation: "Nilai penuh jika ketiga ukuran benar dan alasan pemilihan masuk akal.",
  },
];

const letters = ["A", "B", "C", "D", "E", "F"];

export const demoQuestions: Question[] = seeds.map((seed, index) => {
  const id = `q${String(index + 1).padStart(2, "0")}`;
  const options = (seed.options ?? []).map((body, optIndex) => ({
    id: `${id}o${optIndex + 1}`,
    position: optIndex,
    body,
  }));
  return {
    id,
    examId: demoExam.id,
    position: seed.position,
    type: seed.type,
    body: seed.body,
    points: seed.points,
    options,
    correctOptionIds: (seed.correct ?? []).map((i) => options[i].id),
    wordMin: seed.wordMin,
    wordMax: seed.wordMax,
    referenceAnswer: seed.referenceAnswer,
    explanation: seed.explanation,
  };
});

export const optionLabel = (index: number) => letters[index] ?? "?";

export const demoExams: Exam[] = [
  demoExam,
  {
    ...demoExam,
    id: "exm_02",
    code: "BIN9K1",
    title: "Latihan Tryout, Bahasa Indonesia",
    subjectLabel: "Bahasa Indonesia · Kelas 9",
    status: "draft",
    durationMinutes: 90,
    maxAttempts: 1,
    resultVisibility: "score_only",
    createdAt: "2026-11-01T03:30:00.000Z",
  },
  {
    ...demoExam,
    id: "exm_03",
    code: "IPA8B4",
    title: "Ulangan Harian, IPA (Sistem Pencernaan)",
    subjectLabel: "IPA · Kelas 8",
    status: "archived",
    durationMinutes: 45,
    maxAttempts: 1,
    createdAt: "2026-09-14T01:00:00.000Z",
  },
];
