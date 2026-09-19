import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "考试结果",
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

function getAnswerText(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? "正确" : "错误";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map(getAnswerText)
      .join("、");
  }

  const record = asRecord(value);

  if (record.value !== undefined) {
    return getAnswerText(record.value);
  }

  if (record.correct !== undefined) {
    return getAnswerText(
      record.correct
    );
  }

  if (record.answer !== undefined) {
    return getAnswerText(
      record.answer
    );
  }

  if (record.text !== undefined) {
    return getAnswerText(
      record.text
    );
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "—";
  }
}

function getChoiceAnswerText(
  answerValue: unknown,
  optionsValue: unknown
): string {
  const key =
    getAnswerText(
      answerValue
    ).trim();

  if (!key || key === "—") {
    return "—";
  }

  const options =
    asRecord(optionsValue);

  const upperKey =
    key.toUpperCase();

  const text =
    options[upperKey] ??
    options[key];

  if (typeof text === "string") {
    return `${upperKey}. ${text}`;
  }

  return upperKey;
}

function getTypeName(
  type: string
) {
  const names: Record<
    string,
    string
  > = {
    SINGLE_CHOICE: "单选题",
    MULTIPLE_CHOICE: "多选题",
    TRUE_FALSE: "判断题",
    JUDGMENT: "辨析题",
    SHORT_ANSWER: "简答题",
    MATERIAL_ANALYSIS:
      "材料分析题",
    ESSAY: "论述题",
  };

  return names[type] || type;
}

function getExplanation(
  snapshot: Record<
    string,
    unknown
  >
): string {
  const explanation =
    snapshot.explanation;

  if (
    typeof explanation ===
      "string" &&
    explanation.trim()
  ) {
    return explanation.trim();
  }

  return "";
}

export default async function AttemptResultPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const user =
    await requireUser();

  const { id } =
    await params;

  const attempt =
    await db.examAttempt.findFirst({
      where: {
        id,
        userId: user.id,
      },

      include: {
        exam: true,

        answers: {
          include: {
            examQuestion: true,
          },
        },
      },
    });

  if (!attempt) {
    notFound();
  }

  const answers = [
    ...attempt.answers,
  ].sort(
    (a, b) =>
      a.examQuestion.sortOrder -
      b.examQuestion.sortOrder
  );

  const objectiveAnswers =
    answers.filter(
      (answer) => {
        const snapshot =
          asRecord(
            answer.examQuestion
              .questionSnapshot
          );

        const type =
          typeof snapshot.type ===
          "string"
            ? snapshot.type
            : "";

        return (
          type ===
            "SINGLE_CHOICE" ||
          type ===
            "MULTIPLE_CHOICE" ||
          type ===
            "TRUE_FALSE"
        );
      }
    );

  const subjectiveAnswers =
    answers.filter(
      (answer) => {
        const snapshot =
          asRecord(
            answer.examQuestion
              .questionSnapshot
          );

        const type =
          typeof snapshot.type ===
          "string"
            ? snapshot.type
            : "";

        return ![
          "SINGLE_CHOICE",
          "MULTIPLE_CHOICE",
          "TRUE_FALSE",
        ].includes(type);
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

  const choiceAnsweredCount =
    objectiveAnswers.filter(
      (answer) => {
        const text =
          getAnswerText(
            answer.userAnswer
          );

        return (
          text !== "—" &&
          text.trim() !== ""
        );
      }
    ).length;

  const unansweredChoiceCount =
    objectiveAnswers.length -
    choiceAnsweredCount;

  const accuracy =
    objectiveAnswers.length > 0
      ? Math.round(
          (correctCount /
            objectiveAnswers.length) *
            100
        )
      : 0;

  const objectiveScore =
    objectiveAnswers.reduce(
      (sum, answer) =>
        sum +
        Number(
          answer.awardedScore
        ),
      0
    );

  const objectiveTotalScore =
    objectiveAnswers.reduce(
      (sum, answer) =>
        sum +
        Number(
          answer.maxScore
        ),
      0
    );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* 顶部成绩 */}
      <div className="card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm text-slate-500">
              考试结果
            </p>

            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              {attempt.exam.title}
            </h1>

            {attempt.submittedAt && (
              <p className="mt-2 text-sm text-slate-500">
                交卷时间：
                {attempt.submittedAt.toLocaleString(
                  "zh-CN",
                  {
                    timeZone:
                      "Asia/Hong_Kong",
                  }
                )}
              </p>
            )}
          </div>

          <div className="rounded-2xl bg-red-50 px-6 py-4 text-center">
            <p className="text-xs text-red-500">
              选择题正确率
            </p>

            <p className="mt-1 text-3xl font-bold text-red-600">
              {accuracy}%
            </p>
          </div>
        </div>
      </div>

      {/* 数据卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <p className="text-sm text-slate-500">
            选择题
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {
              objectiveAnswers.length
            }
          </p>
        </div>

        <div className="card p-5">
          <p className="text-sm text-slate-500">
            答对
          </p>

          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {correctCount}
          </p>
        </div>

        <div className="card p-5">
          <p className="text-sm text-slate-500">
            答错
          </p>

          <p className="mt-2 text-2xl font-bold text-red-600">
            {wrongCount}
          </p>
        </div>

        <div className="card p-5">
          <p className="text-sm text-slate-500">
            未作答
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-700">
            {
              unansweredChoiceCount
            }
          </p>
        </div>
      </div>

      {/* 选择题成绩 */}
      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">
              选择题成绩
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              当前复习重点以选择题为主
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm text-slate-500">
              选择题得分
            </p>

            <p className="text-xl font-bold text-slate-900">
              {objectiveScore} /{" "}
              {
                objectiveTotalScore
              }
            </p>
          </div>
        </div>
      </div>

      {/* 选择题详情 */}
      <div className="space-y-4">
        {objectiveAnswers.map(
          (answer, index) => {
            const snapshot =
              asRecord(
                answer.examQuestion
                  .questionSnapshot
              );

            const type =
              typeof snapshot.type ===
              "string"
                ? snapshot.type
                : "";

            const stem =
              typeof snapshot.stem ===
              "string"
                ? snapshot.stem
                : "题目";

            const year =
              typeof snapshot.year ===
              "number"
                ? snapshot.year
                : null;

            const originalNumber =
              typeof snapshot.originalQuestionNumber ===
              "string"
                ? snapshot.originalQuestionNumber
                : null;

            const options =
              snapshot.options;

            const userAnswer =
              getChoiceAnswerText(
                answer.userAnswer,
                options
              );

            const correctAnswer =
              getChoiceAnswerText(
                answer.correctAnswer,
                options
              );

            const explanation =
              getExplanation(
                snapshot
              );

            return (
              <section
                key={answer.id}
                className={`card border-l-4 p-5 ${
                  answer.isCorrect
                    ? "border-l-emerald-500"
                    : "border-l-red-500"
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                    {getTypeName(
                      type
                    )}
                  </span>

                  {year && (
                    <span className="text-slate-400">
                      {year}年
                    </span>
                  )}

                  {originalNumber && (
                    <span className="text-slate-400">
                      原题第
                      {
                        originalNumber
                      }
                      题
                    </span>
                  )}

                  <span className="ml-auto">
                    {answer.isCorrect ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                        <CheckCircle2
                          size={16}
                        />
                        正确
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium text-red-600">
                        <XCircle
                          size={16}
                        />
                        错误
                      </span>
                    )}
                  </span>
                </div>

                <p className="font-medium leading-7 text-slate-900">
                  {index + 1}.{" "}
                  {stem}
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div
                    className={`rounded-xl p-4 ${
                      answer.isCorrect
                        ? "bg-emerald-50"
                        : "bg-red-50"
                    }`}
                  >
                    <p className="text-xs text-slate-500">
                      你的答案
                    </p>

                    <p
                      className={`mt-2 font-semibold leading-6 ${
                        answer.isCorrect
                          ? "text-emerald-700"
                          : "text-red-700"
                      }`}
                    >
                      {userAnswer}
                    </p>
                  </div>

                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="text-xs text-emerald-600">
                      正确答案
                    </p>

                    <p className="mt-2 font-semibold leading-6 text-emerald-700">
                      {
                        correctAnswer
                      }
                    </p>
                  </div>
                </div>

                {explanation && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500">
                      答案解析
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {explanation}
                    </p>
                  </div>
                )}
              </section>
            );
          }
        )}
      </div>

      {/* 主观题 */}
      {subjectiveAnswers.length >
        0 && (
        <div className="card p-6">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-900">
              主观题参考
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              辨析题、简答题和论述题不计入当前选择题正确率，也不进入错题本。
            </p>
          </div>

          <div className="space-y-5">
            {subjectiveAnswers.map(
              (
                answer,
                index
              ) => {
                const snapshot =
                  asRecord(
                    answer.examQuestion
                      .questionSnapshot
                  );

                const type =
                  typeof snapshot.type ===
                  "string"
                    ? snapshot.type
                    : "";

                const stem =
                  typeof snapshot.stem ===
                  "string"
                    ? snapshot.stem
                    : "题目";

                const year =
                  typeof snapshot.year ===
                  "number"
                    ? snapshot.year
                    : null;

                const originalNumber =
                  typeof snapshot.originalQuestionNumber ===
                  "string"
                    ? snapshot.originalQuestionNumber
                    : null;

                const userAnswer =
                  getAnswerText(
                    answer.userAnswer
                  );

                const correctAnswer =
                  getAnswerText(
                    answer.correctAnswer
                  );

                const explanation =
                  getExplanation(
                    snapshot
                  );

                return (
                  <section
                    key={answer.id}
                    className="rounded-xl border border-slate-200 p-5"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                        {getTypeName(
                          type
                        )}
                      </span>

                      {year && (
                        <span className="text-slate-400">
                          {year}年
                        </span>
                      )}

                      {originalNumber && (
                        <span className="text-slate-400">
                          原题第
                          {
                            originalNumber
                          }
                          题
                        </span>
                      )}
                    </div>

                    <p className="font-medium leading-7 text-slate-900">
                      {index + 1}.{" "}
                      {stem}
                    </p>

                    <div className="mt-5">
                      <p className="text-xs text-slate-500">
                        你的答案
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        {userAnswer}
                      </p>
                    </div>

                    <div className="mt-4 rounded-xl bg-amber-50 p-4">
                      <p className="text-xs font-medium text-amber-700">
                        {type ===
                        "JUDGMENT"
                          ? "参考结论"
                          : "参考答案"}
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-7 text-amber-900">
                        {
                          correctAnswer
                        }
                      </p>
                    </div>

                    {explanation && (
                      <div className="mt-3 rounded-xl bg-blue-50 p-4">
                        <p className="text-xs font-medium text-blue-700">
                          {type ===
                          "JUDGMENT"
                            ? "辨析说明"
                            : "答案解析"}
                        </p>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-blue-900">
                          {
                            explanation
                          }
                        </p>
                      </div>
                    )}
                  </section>
                );
              }
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 pb-8">
        <Link
          href="/exams/generate"
          className="btn-primary"
        >
          再做一套
        </Link>

        <Link
          href="/attempts"
          className="btn-secondary"
        >
          考试记录
        </Link>

        <Link
          href="/questions"
          className="btn-secondary"
        >
          返回题库
        </Link>
      </div>
    </div>
  );
}
