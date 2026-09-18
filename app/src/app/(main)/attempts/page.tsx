import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  FileText,
  Target,
  XCircle,
} from "lucide-react";

import { PageHeading } from "@/components/page-heading";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "考试记录",
};

function asRecord(
  value: unknown
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

function formatDate(
  date: Date | null
): string {
  if (!date) {
    return "—";
  }

  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AttemptsPage() {
  const user = await requireUser();

  const attempts =
    await db.examAttempt.findMany({
      where: {
        userId: user.id,
        status: "SUBMITTED",
      },

      include: {
        exam: true,

        answers: {
          select: {
            id: true,
            isCorrect: true,
            userAnswer: true,

            examQuestion: {
              select: {
                questionSnapshot: true,
              },
            },
          },
        },
      },

      orderBy: {
        submittedAt: "desc",
      },

      take: 100,
    });

  const records = attempts.map(
    (attempt) => {
      const objectiveAnswers =
        attempt.answers.filter(
          (answer) => {
            const snapshot = asRecord(
              answer.examQuestion
                .questionSnapshot
            );

            const type =
              typeof snapshot.type ===
              "string"
                ? snapshot.type
                : "";

            return (
              type === "SINGLE_CHOICE" ||
              type ===
                "MULTIPLE_CHOICE" ||
              type === "TRUE_FALSE"
            );
          }
        );

      const correctCount =
        objectiveAnswers.filter(
          (answer) =>
            answer.isCorrect === true
        ).length;

      const wrongCount =
        objectiveAnswers.filter(
          (answer) =>
            answer.isCorrect === false
        ).length;

      const answeredCount =
        objectiveAnswers.filter(
          (answer) =>
            answer.userAnswer !== null
        ).length;

      const unansweredCount =
        objectiveAnswers.length -
        answeredCount;

      const accuracy =
        objectiveAnswers.length > 0
          ? Math.round(
              (correctCount /
                objectiveAnswers.length) *
                100
            )
          : 0;

      return {
        ...attempt,
        objectiveCount:
          objectiveAnswers.length,
        correctCount,
        wrongCount,
        unansweredCount,
        accuracy,
      };
    }
  );

  const totalAttempts =
    records.length;

  const averageAccuracy =
    totalAttempts > 0
      ? Math.round(
          records.reduce(
            (sum, item) =>
              sum + item.accuracy,
            0
          ) / totalAttempts
        )
      : 0;

  const totalCorrect =
    records.reduce(
      (sum, item) =>
        sum + item.correctCount,
      0
    );

  const totalWrong =
    records.reduce(
      (sum, item) =>
        sum + item.wrongCount,
      0
    );

  return (
    <>
      <PageHeading
        title="考试记录"
        description="查看每次练习的选择题成绩、正确率和试卷详情。"
      />

      {records.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
            <FileText size={26} />
          </div>

          <h2 className="mt-4 font-semibold text-slate-900">
            暂时没有考试记录
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            完成并提交一套试卷后，
            考试记录会自动显示在这里。
          </p>

          <Link
            href="/exams/generate"
            className="btn-primary mt-5 inline-flex"
          >
            开始练习
          </Link>
        </div>
      ) : (
        <>
          {/* 总体统计 */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-5">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-600">
                  <FileText size={20} />
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    已完成练习
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {totalAttempts}
                  </p>
                </div>
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-red-50 text-red-600">
                  <Target size={20} />
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    平均正确率
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {averageAccuracy}%
                  </p>
                </div>
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={20} />
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    累计答对
                  </p>

                  <p className="mt-1 text-2xl font-bold text-emerald-600">
                    {totalCorrect}
                  </p>
                </div>
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-red-50 text-red-600">
                  <XCircle size={20} />
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    累计答错
                  </p>

                  <p className="mt-1 text-2xl font-bold text-red-600">
                    {totalWrong}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 考试记录列表 */}
          <div className="space-y-4">
            {records.map(
              (attempt) => (
                <Link
                  key={attempt.id}
                  href={`/attempts/${attempt.id}`}
                  prefetch={false}
                  className="card block p-5 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-slate-900">
                          {
                            attempt.exam
                              .title
                          }
                        </h2>

                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          已交卷
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        {formatDate(
                          attempt.submittedAt
                        )}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:min-w-[500px]">
                      <div>
                        <p className="text-xs text-slate-400">
                          选择题
                        </p>

                        <p className="mt-1 font-semibold text-slate-800">
                          {
                            attempt.objectiveCount
                          }{" "}
                          题
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          答对
                        </p>

                        <p className="mt-1 font-semibold text-emerald-600">
                          {
                            attempt.correctCount
                          }
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          答错
                        </p>

                        <p className="mt-1 font-semibold text-red-600">
                          {
                            attempt.wrongCount
                          }
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs text-slate-400">
                            正确率
                          </p>

                          <p className="mt-1 text-lg font-bold text-slate-900">
                            {
                              attempt.accuracy
                            }
                            %
                          </p>
                        </div>

                        <ChevronRight
                          size={20}
                          className="text-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  {attempt.unansweredCount >
                    0 && (
                    <p className="mt-3 text-xs text-amber-600">
                      有{" "}
                      {
                        attempt.unansweredCount
                      }{" "}
                      道选择题未作答
                    </p>
                  )}
                </Link>
              )
            )}
          </div>

          <div className="mt-6">
            <Link
              href="/exams/generate"
              className="btn-primary"
            >
              再做一套
            </Link>
          </div>
        </>
      )}
    </>
  );
}
