import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { ExamTakingClient } from "@/components/exams/exam-taking-client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function TakeExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const exam = await db.exam.findFirst({
    where: {
      id,
      userId: user.id,
    },

    include: {
      questions: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  if (!exam) {
    notFound();
  }

  const questions = exam.questions.map(
    (item) => {
      const snapshot =
        item.questionSnapshot &&
        typeof item.questionSnapshot === "object" &&
        !Array.isArray(item.questionSnapshot)
          ? (item.questionSnapshot as Record<
              string,
              unknown
            >)
          : {};

      const rawOptions =
        snapshot.options &&
        typeof snapshot.options === "object" &&
        !Array.isArray(snapshot.options)
          ? (snapshot.options as Record<
              string,
              string
            >)
          : null;

      const rawOrder = Array.isArray(
        item.optionsOrder
      )
        ? item.optionsOrder.filter(
            (value): value is string =>
              typeof value === "string"
          )
        : null;

      return {
        id: item.id,

        type:
          typeof snapshot.type === "string"
            ? snapshot.type
            : "UNKNOWN",

        stem:
          typeof snapshot.stem === "string"
            ? snapshot.stem
            : "",

        options: rawOptions,

        optionsOrder: rawOrder,

        score: Number(item.score),

        sortOrder: item.sortOrder,

        year:
          typeof snapshot.year === "number"
            ? snapshot.year
            : null,

        originalQuestionNumber:
          typeof snapshot.originalQuestionNumber ===
          "string"
            ? snapshot.originalQuestionNumber
            : null,
      };
    }
  );

  return (
    <>
      <PageHeading
        title={exam.title}
        description={`共 ${exam.questionCount} 题 · ${Number(
          exam.totalScore
        )} 分 · ${exam.durationMinutes} 分钟`}
      />

      <ExamTakingClient
        exam={{
          id: exam.id,
          title: exam.title,
          totalScore: Number(
            exam.totalScore
          ),
          durationMinutes:
            exam.durationMinutes,
          questionCount:
            exam.questionCount,
          questions,
        }}
      />
    </>
  );
}
