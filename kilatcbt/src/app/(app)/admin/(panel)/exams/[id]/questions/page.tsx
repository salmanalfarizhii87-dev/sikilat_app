"use client";

import * as React from "react";
import { Download, Info, Lock, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/admin/ui";
import { ExamTabs } from "@/components/admin/exam-tabs";
import {
  QuestionEditor,
  questionFromModel,
  type DraftQuestion,
} from "@/components/admin/question-editor";
import { demoExam, demoQuestions } from "@/lib/mock-data";

export default function ExamQuestionsPage({ params }: PageProps<"/admin/exams/[id]">) {
  const { id } = React.use(params);
  const [questions, setQuestions] = React.useState<DraftQuestion[]>(() =>
    demoQuestions.map(questionFromModel),
  );
  const [dirty, setDirty] = React.useState(false);

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  const locked = true;

  /* Templat CSV dibuat di perangkat ini, jadi unduhannya benar-benar terjadi. */
  const downloadTemplate = () => {
    const csv = `tipe,soal,opsi_a,opsi_b,opsi_c,opsi_d,opsi_e,kunci,poin,pembahasan
pg,"Hasil dari 7 x 8 adalah ...",54,56,58,64,,B,1,"7 x 8 = 56"
pg_banyak,"Manakah yang termasuk bilangan prima?",2,4,5,9,,A|C,2,"2 dan 5 hanya habis dibagi 1 dan dirinya sendiri"
essay,"Jelaskan pengertian fotosintesis dengan kata-katamu sendiri.",,,,,,"Proses tumbuhan membuat makanan dengan bantuan cahaya matahari",5,`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "templat-soal-sikilat.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Templat CSV diunduh");
  };

  return (
    <>
      <PageHeader
        title="Editor soal"
        description={`${questions.length} soal, ${totalPoints} poin. Soal terkunci karena sudah ada peserta yang mengerjakan.`}
        actions={
          <>
            <Button variant="secondary" size="md" onClick={downloadTemplate}>
              <Download className="size-4" aria-hidden /> Templat CSV
            </Button>
            <Button
              size="md"
              disabled={!dirty}
              onClick={() => {
                setDirty(false);
                toast("Belum tersambung ke server. Perubahan soal tidak tersimpan permanen.");
              }}
            >
              <Save className="size-4" aria-hidden /> Simpan
            </Button>
          </>
        }
      >
        <p className="mt-2 text-[12.5px] text-muted">
          {demoExam.subjectLabel} · {demoExam.code}
        </p>
      </PageHeader>

      <ExamTabs examId={id} />

      <div className="mb-3 flex flex-wrap items-start gap-2 rounded-field border border-accent-200 bg-accent-50 px-3 py-2">
        <Lock className="mt-0.5 size-3.5 shrink-0 text-accent-900" aria-hidden />
        <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-accent-900">
          <strong className="font-semibold">Soal dan opsi hanya-baca.</strong> Setelah percobaan
          pertama masuk, isi soal tidak bisa diubah agar penilaian tetap adil. Buat ujian baru bila
          perlu revisi besar.
        </p>
      </div>

      <QuestionEditor
        questions={questions}
        onChange={(next) => {
          setQuestions(next);
          setDirty(true);
        }}
        locked={locked}
        emptyLabel="Belum ada soal"
      />

      <Panel className="mt-4" title="Tentang editor ini">
        <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0 text-navy-600" aria-hidden />
          <span>
            Perubahan di sini belum disimpan ke mana pun: aplikasi masih berjalan tanpa server.
            Setelah backend terpasang, tombol Simpan akan memanggil penyimpanan sungguhan dan
            editor ini menjadi sumber data ujian.
          </span>
        </p>
      </Panel>
    </>
  );
}
