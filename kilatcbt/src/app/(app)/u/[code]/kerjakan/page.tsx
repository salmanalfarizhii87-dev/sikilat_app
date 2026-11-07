import type { Metadata } from "next";
import { ExamRunnerProvider } from "@/components/exam/exam-store";
import { ExamRunner } from "@/components/exam/exam-runner";
import { demoExam, demoQuestions } from "@/lib/mock-data";

export const metadata: Metadata = { title: "Mengerjakan ujian" };

export default async function ExamRunPage() {
  return (
    <ExamRunnerProvider exam={demoExam} questions={demoQuestions} resumeCode="K7M2QP">
      <ExamRunner />
    </ExamRunnerProvider>
  );
}
